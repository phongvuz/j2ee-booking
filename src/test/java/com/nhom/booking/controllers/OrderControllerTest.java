package com.nhom.booking.controllers;

import com.nhom.booking.dtos.common.PageResponse;
import com.nhom.booking.dtos.order.OrderCreateRequest;
import com.nhom.booking.dtos.order.OrderDTO;
import com.nhom.booking.dtos.order.OrderUpdateRequest;
import com.nhom.booking.exception.DuplicateResourceException;
import com.nhom.booking.exception.InvalidStateException;
import com.nhom.booking.exception.ResourceNotFoundException;
import com.nhom.booking.interfaces.order.IOrder;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(OrderController.class)
class OrderControllerTest {

    private static final String VALID_CREATE_BODY = """
            {
              "tripId": 1,
              "userId": 2,
              "customerName": "Nguyễn Văn A",
              "customerPhone": "0901112223",
              "seats": ["1B1", "1B2"]
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private IOrder orderService;

    // ---------------- ĐỌC ----------------

    @Test
    void shouldGetOrderById() throws Exception {
        OrderDTO dto = new OrderDTO();
        dto.setId(1L);
        dto.setPnrCode("NHAXE-1A2B3C");
        when(orderService.getById(1L)).thenReturn(dto);

        mockMvc.perform(get("/api/v1/orders/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.pnrCode").value("NHAXE-1A2B3C"));
    }

    @Test
    void shouldReturn404WhenOrderNotFound() throws Exception {
        when(orderService.getById(99L)).thenThrow(new ResourceNotFoundException("Không tìm thấy đơn hàng"));

        mockMvc.perform(get("/api/v1/orders/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Không tìm thấy đơn hàng"));
    }

    @Test
    void shouldListOrdersWithPaging() throws Exception {
        when(orderService.getOrders(any(), any(), anyInt(), anyInt()))
                .thenReturn(new PageResponse<>(List.of(new OrderDTO()), 0, 10, 1L, 1));

        mockMvc.perform(get("/api/v1/orders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void shouldRejectLookupWithoutPhone() throws Exception {
        mockMvc.perform(get("/api/v1/orders/search").param("pnr", "NHAXE-1A2B3C"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldRejectInvalidStatus() throws Exception {
        mockMvc.perform(get("/api/v1/orders").param("status", "ABC"))
                .andExpect(status().isBadRequest());
    }

    // ---------------- ĐẶT VÉ ----------------

    @Test
    void shouldCreateOrder() throws Exception {
        OrderDTO dto = new OrderDTO();
        dto.setId(4L);
        when(orderService.create(any(OrderCreateRequest.class))).thenReturn(dto);

        mockMvc.perform(post("/api/v1/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_CREATE_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(4));
    }

    @Test
    void shouldRejectCreateWithoutSeats() throws Exception {
        mockMvc.perform(post("/api/v1/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tripId": 1, "userId": 2, "customerName": "A",
                                 "customerPhone": "0901112223", "seats": []}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details").exists());
    }

    @Test
    void shouldRejectCreateWithMoreThanFiveSeats() throws Exception {
        mockMvc.perform(post("/api/v1/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tripId": 1, "userId": 2, "customerName": "A",
                                 "customerPhone": "0901112223",
                                 "seats": ["1A1","1A2","1A3","1A4","1A5","1A6"]}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldRejectCreateWithInvalidPhone() throws Exception {
        mockMvc.perform(post("/api/v1/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tripId": 1, "userId": 2, "customerName": "A",
                                 "customerPhone": "123", "seats": ["1A1"]}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldReturn409WhenSeatAlreadyTaken() throws Exception {
        when(orderService.create(any(OrderCreateRequest.class)))
                .thenThrow(new DuplicateResourceException("Ghế đã có người đặt: 1B1"));

        mockMvc.perform(post("/api/v1/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_CREATE_BODY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Ghế đã có người đặt: 1B1"));
    }

    // ---------------- SỬA / THANH TOÁN / HỦY ----------------

    @Test
    void shouldUpdateOrder() throws Exception {
        OrderDTO dto = new OrderDTO();
        dto.setId(1L);
        dto.setCustomerName("Trần Văn B");
        when(orderService.update(any(Long.class), any(OrderUpdateRequest.class))).thenReturn(dto);

        mockMvc.perform(put("/api/v1/orders/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"customerName": "Trần Văn B", "customerPhone": "0912223334"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerName").value("Trần Văn B"));
    }

    @Test
    void shouldPayOrder() throws Exception {
        OrderDTO dto = new OrderDTO();
        dto.setId(1L);
        when(orderService.pay(1L)).thenReturn(dto);

        mockMvc.perform(patch("/api/v1/orders/1/pay"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void shouldReturn409WhenPayingCancelledOrder() throws Exception {
        when(orderService.pay(2L)).thenThrow(new InvalidStateException("Đơn đã hủy"));

        mockMvc.perform(patch("/api/v1/orders/2/pay"))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldCancelOrder() throws Exception {
        mockMvc.perform(delete("/api/v1/orders/1"))
                .andExpect(status().isNoContent());
    }
}
