package com.nhom.booking.mappers;

import com.nhom.booking.dtos.order.OrderDTO;
import com.nhom.booking.entities.Order;
import com.nhom.booking.entities.OrderSeat;
import com.nhom.booking.entities.Trip;

import java.util.List;

public final class OrderMapper {

    private OrderMapper() {
    }

    /** Gọi trong transaction của service (vì trip, user, seats là lazy). */
    public static OrderDTO toDTO(Order order) {
        Trip trip = order.getTrip();
        List<String> seatCodes = order.getSeats().stream()
                .map(OrderSeat::getSeatCode)
                .sorted()
                .toList();

        return OrderDTO.builder()
                .id(order.getId())
                .pnrCode(order.getPnrCode())
                .customerName(order.getCustomerName())
                .customerPhone(order.getCustomerPhone())
                .userId(order.getUser().getId())
                .tripId(trip.getId())
                .tripCode(trip.getTripCode())
                .departure(trip.getDeparture())
                .destination(trip.getDestination())
                .departureDate(trip.getDepartureDate())
                .departureTime(trip.getDepartureTime())
                .seats(seatCodes)
                .totalPrice(order.getTotalPrice())
                .status(order.getStatus())
                .bookingDate(order.getBookingDate())
                .build();
    }
}
