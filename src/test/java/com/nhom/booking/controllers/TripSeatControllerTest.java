package com.nhom.booking.controllers;

import com.nhom.booking.dtos.order.BookedSeatsDTO;
import com.nhom.booking.exception.ResourceNotFoundException;
import com.nhom.booking.interfaces.order.IOrder;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TripSeatController.class)
class TripSeatControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private IOrder orderService;

    @Test
    void shouldReturnBookedSeats() throws Exception {
        when(orderService.getBookedSeats(1L))
                .thenReturn(new BookedSeatsDTO(1L, List.of("1A1", "1A2"), 20));

        mockMvc.perform(get("/api/v1/trips/1/booked-seats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tripId").value(1))
                .andExpect(jsonPath("$.bookedSeats.length()").value(2))
                .andExpect(jsonPath("$.bookedSeats[0]").value("1A1"));
    }

    @Test
    void shouldReturnEmptyListWhenNoSeatIsBooked() throws Exception {
        when(orderService.getBookedSeats(3L)).thenReturn(new BookedSeatsDTO(3L, List.of(), 22));

        mockMvc.perform(get("/api/v1/trips/3/booked-seats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bookedSeats.length()").value(0));
    }

    @Test
    void shouldReturn404WhenTripNotFound() throws Exception {
        when(orderService.getBookedSeats(999L))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy chuyến xe với id: 999"));

        mockMvc.perform(get("/api/v1/trips/999/booked-seats"))
                .andExpect(status().isNotFound());
    }
}
