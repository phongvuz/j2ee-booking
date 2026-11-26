package TripService.bus.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "buses")
public class Bus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "bus_code", nullable = false, unique = true, length = 20)
    private String busCode;

    @Column(name = "plate_number", nullable = false, unique = true, length = 20)
    private String plateNumber;

    @Column(nullable = false, length = 100)
    private String type;

    @Column(name = "seat_count", nullable = false)
    private int seatCount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private BusStatus status;

    protected Bus() {
    }

    public Bus(String busCode, String plateNumber, String type, int seatCount, BusStatus status) {
        updateDetails(busCode, plateNumber, type, seatCount, status);
    }

    public void updateDetails(String busCode, String plateNumber, String type, int seatCount, BusStatus status) {
        this.busCode = busCode;
        this.plateNumber = plateNumber;
        this.type = type;
        this.seatCount = seatCount;
        this.status = status;
    }

    public Long getId() { return id; }
    public String getBusCode() { return busCode; }
    public String getPlateNumber() { return plateNumber; }
    public String getType() { return type; }
    public int getSeatCount() { return seatCount; }
    public BusStatus getStatus() { return status; }
}
