package TripService.trip.entity;

import TripService.bus.entity.Bus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "trips")
public class Trip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "trip_code", nullable = false, unique = true, length = 20)
    private String tripCode;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bus_id", nullable = false)
    private Bus bus;

    @Column(nullable = false, length = 100)
    private String departure;

    @Column(nullable = false, length = 100)
    private String destination;

    @Column(name = "departure_date", nullable = false)
    private LocalDate departureDate;

    @Column(name = "departure_time", nullable = false)
    private LocalTime departureTime;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(name = "empty_seats", nullable = false)
    private int emptySeats;

    protected Trip() {
    }

    public Trip(String tripCode, Bus bus, String departure, String destination, LocalDate departureDate,
            LocalTime departureTime, BigDecimal price, int emptySeats) {
        updateDetails(tripCode, bus, departure, destination, departureDate, departureTime, price, emptySeats);
    }

    public void updateDetails(String tripCode, Bus bus, String departure, String destination,
            LocalDate departureDate, LocalTime departureTime, BigDecimal price, int emptySeats) {
        this.tripCode = tripCode;
        this.bus = bus;
        this.departure = departure;
        this.destination = destination;
        this.departureDate = departureDate;
        this.departureTime = departureTime;
        this.price = price;
        this.emptySeats = emptySeats;
    }

    public Long getId() { return id; }
    public String getTripCode() { return tripCode; }
    public Bus getBus() { return bus; }
    public String getDeparture() { return departure; }
    public String getDestination() { return destination; }
    public LocalDate getDepartureDate() { return departureDate; }
    public LocalTime getDepartureTime() { return departureTime; }
    public BigDecimal getPrice() { return price; }
    public int getEmptySeats() { return emptySeats; }
}
