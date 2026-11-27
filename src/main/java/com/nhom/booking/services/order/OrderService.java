package com.nhom.booking.services.order;

import com.nhom.booking.dtos.common.PageResponse;
import com.nhom.booking.dtos.order.BookedSeatsDTO;
import com.nhom.booking.dtos.order.OrderCreateRequest;
import com.nhom.booking.dtos.order.OrderDTO;
import com.nhom.booking.dtos.order.OrderUpdateRequest;
import com.nhom.booking.entities.Order;
import com.nhom.booking.entities.OrderSeat;
import com.nhom.booking.entities.OrderStatus;
import com.nhom.booking.entities.Trip;
import com.nhom.booking.entities.User;
import com.nhom.booking.exception.DuplicateResourceException;
import com.nhom.booking.exception.InvalidStateException;
import com.nhom.booking.exception.ResourceNotFoundException;
import com.nhom.booking.interfaces.order.IOrder;
import com.nhom.booking.mappers.OrderMapper;
import com.nhom.booking.repositories.OrderRepository;
import com.nhom.booking.repositories.OrderSeatRepository;
import com.nhom.booking.repositories.TripRepository;
import com.nhom.booking.repositories.UserRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderService implements IOrder {

    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_PNR_ATTEMPTS = 10;

    private final OrderRepository orderRepository;
    private final OrderSeatRepository orderSeatRepository;
    private final TripRepository tripRepository;
    private final UserRepository userRepository;
    private final PnrGenerator pnrGenerator;

    // =====================================================================
    // ĐỌC
    // =====================================================================

    @Override
    @Transactional(readOnly = true)
    public OrderDTO getById(Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> orderNotFound(id));
        return OrderMapper.toDTO(order);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<OrderDTO> getOrders(String keyword, OrderStatus status, int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "bookingDate"));

        Specification<Order> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (keyword != null && !keyword.isBlank()) {
                String like = "%" + keyword.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("pnrCode")), like),
                        cb.like(cb.lower(root.get("customerName")), like),
                        cb.like(root.get("customerPhone"), like)));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<OrderDTO> result = orderRepository.findAll(spec, pageable).map(OrderMapper::toDTO);
        return PageResponse.from(result);
    }

    @Override
    @Transactional(readOnly = true)
    public OrderDTO lookup(String pnr, String phone) {
        // Thông báo chung, không tiết lộ là sai PNR hay sai SĐT
        Order order = orderRepository
                .findByPnrCodeIgnoreCaseAndCustomerPhone(pnr.trim(), phone.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy vé với thông tin đã nhập"));
        return OrderMapper.toDTO(order);
    }

    @Override
    @Transactional(readOnly = true)
    public BookedSeatsDTO getBookedSeats(Long tripId) {
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy chuyến xe với id: " + tripId
                ));

        List<String> bookedSeats =
                orderSeatRepository.findSeatCodesByTripId(tripId);

        return new BookedSeatsDTO(
                tripId,
                bookedSeats,
                trip.getEmptySeats()
        );
    }

    // =====================================================================
    // GHI
    // =====================================================================

    @Override
    @Transactional
    public OrderDTO create(OrderCreateRequest request) {
        List<String> seatCodes = request.getSeats();
        if (new HashSet<>(seatCodes).size() != seatCodes.size()) {
            throw new IllegalArgumentException("Danh sách ghế bị trùng nhau");
        }

        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy người dùng với id: " + request.getUserId()));

        // Khóa dòng chuyến: các lần đặt/hủy cùng chuyến sẽ được xử lý lần lượt
        Trip trip = tripRepository.findByIdForUpdate(request.getTripId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy chuyến xe với id: " + request.getTripId()));

        LocalDateTime departureTime = LocalDateTime.of(trip.getDepartureDate(), trip.getDepartureTime());
        if (!departureTime.isAfter(LocalDateTime.now())) {
            throw new IllegalArgumentException("Chuyến xe đã khởi hành, không thể đặt vé");
        }

        if (trip.getEmptySeats() < seatCodes.size()) {
            throw new IllegalArgumentException("Chuyến này chỉ còn " + trip.getEmptySeats() + " ghế trống");
        }

        // TODO: kiểm tra mã ghế có tồn tại trong xe của chuyến (theo bus.seat_count)
        //       sau khi nhóm thống nhất quy ước mã ghế.
        List<String> takenSeats = orderSeatRepository.findTakenSeatCodes(trip.getId(), seatCodes);
        if (!takenSeats.isEmpty()) {
            throw new DuplicateResourceException("Ghế đã có người đặt: " + String.join(", ", takenSeats));
        }

        Order order = new Order();
        order.setPnrCode(generateUniquePnr());
        order.setCustomerName(request.getCustomerName().trim());
        order.setCustomerPhone(request.getCustomerPhone().trim());
        order.setTrip(trip);
        order.setUser(user);
        order.setTotalPrice(trip.getPrice().multiply(BigDecimal.valueOf(seatCodes.size())));
        order.setStatus(OrderStatus.PENDING);
        order.setBookingDate(LocalDateTime.now());

        for (String code : seatCodes) {
            OrderSeat seat = new OrderSeat();
            seat.setOrder(order);
            seat.setTripId(trip.getId());
            seat.setSeatCode(code);
            order.getSeats().add(seat);
        }

        trip.setEmptySeats(trip.getEmptySeats() - seatCodes.size());

        try {
            // flush ngay để UNIQUE (trip_id, seat_code) của database là chốt chặn cuối cùng
            orderRepository.saveAndFlush(order);
        } catch (DataIntegrityViolationException ex) {
            throw new DuplicateResourceException("Ghế vừa có người đặt trước, vui lòng chọn ghế khác");
        }

        return OrderMapper.toDTO(order);
    }

    @Override
    @Transactional
    public OrderDTO update(Long id, OrderUpdateRequest request) {
        Order order = getOrderForUpdate(id);
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new InvalidStateException("Không thể sửa đơn đã hủy");
        }
        order.setCustomerName(request.getCustomerName().trim());
        order.setCustomerPhone(request.getCustomerPhone().trim());
        return OrderMapper.toDTO(order);
    }

    @Override
    @Transactional
    public OrderDTO pay(Long id) {
        Order order = getOrderForUpdate(id);
        if (order.getStatus() != OrderStatus.PENDING) {
            throw new InvalidStateException(
                    "Chỉ đơn đang chờ thanh toán mới thanh toán được (trạng thái hiện tại: "
                            + order.getStatus() + ")");
        }
        order.setStatus(OrderStatus.PAID);
        return OrderMapper.toDTO(order);
    }

    @Override
    @Transactional
    public void cancel(Long id) {
        Order order = getOrderForUpdate(id);
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new InvalidStateException("Đơn đã được hủy trước đó");
        }
        cancelAndReleaseSeats(order);
    }

    // =====================================================================
    // TỰ HỦY ĐƠN QUÁ HẠN
    // =====================================================================

    @Override
    @Transactional(readOnly = true)
    public List<Long> findExpiredOrderIds(int timeoutMinutes) {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(timeoutMinutes);
        return orderRepository.findIdsByStatusAndBookingDateBefore(OrderStatus.PENDING, cutoff);
    }

    @Override
    @Transactional
    public void expireOrder(Long id) {
        orderRepository.findByIdForUpdate(id).ifPresent(order -> {
            // đọc lại sau khi khóa: nếu vừa được thanh toán hoặc hủy thì bỏ qua
            if (order.getStatus() == OrderStatus.PENDING) {
                cancelAndReleaseSeats(order);
            }
        });
    }

    // =====================================================================
    // HÀM PHỤ
    // =====================================================================

    private Order getOrderForUpdate(Long id) {
        return orderRepository.findByIdForUpdate(id).orElseThrow(() -> orderNotFound(id));
    }

    private ResourceNotFoundException orderNotFound(Long id) {
        return new ResourceNotFoundException("Không tìm thấy đơn hàng với id: " + id);
    }

    /** Đổi sang CANCELLED, xóa ghế của đơn (trả ghế) và cộng lại số ghế trống của chuyến. */
    private void cancelAndReleaseSeats(Order order) {
        Long tripId = order.getTrip().getId();
        Trip trip = tripRepository.findByIdForUpdate(tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chuyến xe với id: " + tripId));

        trip.setEmptySeats(trip.getEmptySeats() + order.getSeats().size());
        order.getSeats().clear(); // orphanRemoval: xóa các dòng order_seats
        order.setStatus(OrderStatus.CANCELLED);
    }

    private String generateUniquePnr() {
        for (int i = 0; i < MAX_PNR_ATTEMPTS; i++) {
            String pnr = pnrGenerator.generate();
            if (!orderRepository.existsByPnrCode(pnr)) {
                return pnr;
            }
        }
        throw new IllegalStateException("Không thể sinh mã PNR duy nhất");
    }
}
