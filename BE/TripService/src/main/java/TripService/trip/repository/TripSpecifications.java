package TripService.trip.repository;

import TripService.trip.entity.Trip;
import jakarta.persistence.criteria.Predicate;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

public final class TripSpecifications {

    private TripSpecifications() {
    }

    public static Specification<Trip> search(String departure, String destination, LocalDate date, Long busId) {
        return (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (departure != null && !departure.isBlank()) {
                predicates.add(builder.equal(builder.lower(root.get("departure")),
                        departure.strip().toLowerCase(Locale.ROOT)));
            }
            if (destination != null && !destination.isBlank()) {
                predicates.add(builder.equal(builder.lower(root.get("destination")),
                        destination.strip().toLowerCase(Locale.ROOT)));
            }
            if (date != null) {
                predicates.add(builder.equal(root.get("departureDate"), date));
            }
            if (busId != null) {
                predicates.add(builder.equal(root.get("bus").get("id"), busId));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
    }
}
