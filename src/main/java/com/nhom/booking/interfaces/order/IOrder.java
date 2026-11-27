package com.nhom.booking.interfaces.order;

import com.nhom.booking.dtos.common.PageResponse;
import com.nhom.booking.dtos.order.BookedSeatsDTO;
import com.nhom.booking.dtos.order.OrderCreateRequest;
import com.nhom.booking.dtos.order.OrderDTO;
import com.nhom.booking.dtos.order.OrderUpdateRequest;
import com.nhom.booking.entities.OrderStatus;

import java.util.List;

public interface IOrder {

    // ---------- Đọc ----------

    /** Chi tiết một đơn theo id. */
    OrderDTO getById(Long id);

    /** Danh sách đơn cho admin: lọc theo từ khóa (PNR, tên, SĐT) và trạng thái, có phân trang. */
    PageResponse<OrderDTO> getOrders(String keyword, OrderStatus status, int page, int size);

    /** Tra cứu vé công khai: cần cả mã PNR và số điện thoại. */
    OrderDTO lookup(String pnr, String phone);

    /** Ghế đã có người đặt của một chuyến (để tô xám trên sơ đồ ghế). */
    BookedSeatsDTO getBookedSeats(Long tripId);

    // ---------- Ghi ----------

    /** Đặt vé: kiểm tra chuyến và ghế, sinh PNR, tính tiền, trừ số ghế trống. Đơn mới ở trạng thái PENDING. */
    OrderDTO create(OrderCreateRequest request);

    /** Sửa tên và số điện thoại khách (không sửa được đơn đã hủy). */
    OrderDTO update(Long id, OrderUpdateRequest request);

    /** Xác nhận thanh toán: PENDING -> PAID. */
    OrderDTO pay(Long id);

    /** Hủy đơn (xóa mềm): đổi sang CANCELLED, trả ghế và cộng lại số ghế trống. */
    void cancel(Long id);

    // ---------- Tự hủy đơn quá hạn ----------

    /** Id các đơn PENDING đã đặt quá số phút cho trước. */
    List<Long> findExpiredOrderIds(int timeoutMinutes);

    /** Hủy một đơn quá hạn (bỏ qua nếu trong lúc đó đơn đã được thanh toán hoặc hủy). */
    void expireOrder(Long id);
}
