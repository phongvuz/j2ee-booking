package com.nhom.booking.services.order;

import com.nhom.booking.dtos.order.BookedSeatsDTO;
import com.nhom.booking.dtos.order.OrderCreateRequest;
import com.nhom.booking.dtos.order.OrderDTO;
import com.nhom.booking.entities.Order;
import com.nhom.booking.entities.OrderSeat;
import com.nhom.booking.entities.OrderStatus;
import com.nhom.booking.entities.Trip;
import com.nhom.booking.entities.User;
import com.nhom.booking.exception.DuplicateResourceException;
import com.nhom.booking.exception.InvalidStateException;
import com.nhom.booking.exception.ResourceNotFoundException;
import com.nhom.booking.repositories.OrderRepository;
import com.nhom.booking.repositories.OrderSeatRepository;
import com.nhom.booking.repositories.TripRepository;
import com.nhom.booking.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.nhom.booking.entities.Trip;
import java.util.Optional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private OrderSeatRepository orderSeatRepository;
    @Mock
    private TripRepository tripRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private PnrGenerator pnrGenerator;

    @InjectMocks
    private OrderService orderService;

    private User user;
    private Trip trip;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(2L);
        user.setUsername("client01");
        user.setRole("CLIENT");

        trip = new Trip();
        trip.setId(1L);
        trip.setTripCode("VN01");
        trip.setDeparture("SGN");
        trip.setDestination("DLT");
        trip.setDepartureDate(LocalDate.now().plusDays(3));
        trip.setDepartureTime(LocalTime.of(21, 0));
        trip.setPrice(new BigDecimal("300000.00"));
        trip.setEmptySeats(20);
    }

    private OrderCreateRequest createRequest(String... seats) {
        OrderCreateRequest request = new OrderCreateRequest();
        request.setTripId(1L);
        request.setUserId(2L);
        request.setCustomerName("Nguyễn Văn A");
        request.setCustomerPhone("0901112223");
        request.setSeats(List.of(seats));
        return request;
    }

    private Order existingOrder(Long id, OrderStatus status, String... seatCodes) {
        Order order = new Order();
        order.setId(id);
        order.setPnrCode("NHAXE-TEST01");
        order.setCustomerName("Nguyễn Văn A");
        order.setCustomerPhone("0901112223");
        order.setTrip(trip);
        order.setUser(user);
        order.setTotalPrice(new BigDecimal("600000.00"));
        order.setStatus(status);
        for (String code : seatCodes) {
            OrderSeat seat = new OrderSeat();
            seat.setOrder(order);
            seat.setTripId(trip.getId());
            seat.setSeatCode(code);
            order.getSeats().add(seat);
        }
        return order;
    }

    // ---------------- ĐẶT VÉ ----------------

    @Test
    void createShouldCalculatePriceTakeSeatsAndStartPending() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(tripRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(trip));
        when(orderSeatRepository.findTakenSeatCodes(eq(1L), anyCollection())).thenReturn(List.of());
        when(pnrGenerator.generate()).thenReturn("NHAXE-ABC123");
        when(orderRepository.saveAndFlush(any(Order.class))).thenAnswer(invocation -> {
            Order saved = invocation.getArgument(0);
            saved.setId(10L);
            return saved;
        });

        OrderDTO dto = orderService.create(createRequest("1B1", "1B2"));

        assertEquals(10L, dto.getId());
        assertEquals("NHAXE-ABC123", dto.getPnrCode());
        assertEquals(OrderStatus.PENDING, dto.getStatus());
        assertEquals(0, new BigDecimal("600000.00").compareTo(dto.getTotalPrice()));
        assertEquals(List.of("1B1", "1B2"), dto.getSeats());
        assertEquals(18, trip.getEmptySeats());
    }

    @Test
    void createShouldFailWhenSeatAlreadyTaken() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(tripRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(trip));
        when(orderSeatRepository.findTakenSeatCodes(eq(1L), anyCollection())).thenReturn(List.of("1B1"));

        assertThrows(DuplicateResourceException.class,
                () -> orderService.create(createRequest("1B1", "1B2")));

        verify(orderRepository, never()).saveAndFlush(any());
        assertEquals(20, trip.getEmptySeats());
    }

    @Test
    void createShouldFailWhenRequestHasDuplicateSeats() {
        assertThrows(IllegalArgumentException.class,
                () -> orderService.create(createRequest("1B1", "1B1")));

        verifyNoInteractions(orderRepository, tripRepository, userRepository);
    }

    @Test
    void createShouldFailWhenNotEnoughEmptySeats() {
        trip.setEmptySeats(1);
        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(tripRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(trip));

        assertThrows(IllegalArgumentException.class,
                () -> orderService.create(createRequest("1B1", "1B2")));

        verify(orderRepository, never()).saveAndFlush(any());
    }

    @Test
    void createShouldFailWhenTripAlreadyDeparted() {
        trip.setDepartureDate(LocalDate.now().minusDays(1));
        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(tripRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(trip));

        assertThrows(IllegalArgumentException.class,
                () -> orderService.create(createRequest("1B1")));

        verify(orderRepository, never()).saveAndFlush(any());
    }

    // ---------------- THANH TOÁN ----------------

    @Test
    void payShouldMovePendingOrderToPaid() {
        Order order = existingOrder(5L, OrderStatus.PENDING, "1A1", "1A2");
        when(orderRepository.findByIdForUpdate(5L)).thenReturn(Optional.of(order));

        OrderDTO dto = orderService.pay(5L);

        assertEquals(OrderStatus.PAID, dto.getStatus());
        assertEquals(OrderStatus.PAID, order.getStatus());
    }

    @Test
    void payShouldFailWhenOrderIsNotPending() {
        Order order = existingOrder(5L, OrderStatus.CANCELLED);
        when(orderRepository.findByIdForUpdate(5L)).thenReturn(Optional.of(order));

        assertThrows(InvalidStateException.class, () -> orderService.pay(5L));
    }

    // ---------------- HỦY ----------------

    @Test
    void cancelShouldReleaseSeatsAndRestoreEmptySeats() {
        trip.setEmptySeats(18);
        Order order = existingOrder(5L, OrderStatus.PAID, "1A1", "1A2");
        when(orderRepository.findByIdForUpdate(5L)).thenReturn(Optional.of(order));
        when(tripRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(trip));

        orderService.cancel(5L);

        assertEquals(OrderStatus.CANCELLED, order.getStatus());
        assertTrue(order.getSeats().isEmpty());
        assertEquals(20, trip.getEmptySeats());
    }

    @Test
    void cancelShouldFailWhenAlreadyCancelled() {
        Order order = existingOrder(5L, OrderStatus.CANCELLED);
        when(orderRepository.findByIdForUpdate(5L)).thenReturn(Optional.of(order));

        assertThrows(InvalidStateException.class, () -> orderService.cancel(5L));
        verifyNoInteractions(tripRepository);
    }

    // ---------------- TỰ HỦY QUÁ HẠN ----------------

    @Test
    void expireShouldCancelPendingOrder() {
        trip.setEmptySeats(19);
        Order order = existingOrder(7L, OrderStatus.PENDING, "2B3");
        when(orderRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(order));
        when(tripRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(trip));

        orderService.expireOrder(7L);

        assertEquals(OrderStatus.CANCELLED, order.getStatus());
        assertEquals(20, trip.getEmptySeats());
    }

    @Test
    void expireShouldSkipOrderThatWasPaidInTheMeantime() {
        Order order = existingOrder(7L, OrderStatus.PAID, "2B3");
        when(orderRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(order));

        orderService.expireOrder(7L);

        assertEquals(OrderStatus.PAID, order.getStatus());
        verifyNoInteractions(tripRepository);
    }

    // ---------------- GHẾ ĐÃ ĐẶT ----------------

    @Test
    void getBookedSeatsShouldReturnSeatsOfTheTrip() {
        Trip trip = new Trip();
        trip.setEmptySeats(20);
        when(tripRepository.findById(3L)).thenReturn(Optional.of(trip));
        when(orderSeatRepository.findSeatCodesByTripId(3L)).thenReturn(List.of("1A1", "2B3"));

        BookedSeatsDTO dto = orderService.getBookedSeats(3L);

        assertEquals(3L, dto.getTripId());
        assertEquals(20, dto.getAvailableSeats());
        assertEquals(List.of("1A1", "2B3"), dto.getBookedSeats());
    }

    @Test
    void getBookedSeatsShouldFailWhenTripDoesNotExist() {

        assertThrows(ResourceNotFoundException.class, () -> orderService.getBookedSeats(99L));
        verifyNoInteractions(orderSeatRepository);
    }
}
