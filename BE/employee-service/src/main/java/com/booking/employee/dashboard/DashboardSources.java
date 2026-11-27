package com.booking.employee.dashboard;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.util.UriUtils;

@Component
class DashboardSources {

    private final RestClient client;
    private final String ordersUrl;
    private final String busesUrl;

    DashboardSources(@Value("${dashboard.orders-stats-url}") String ordersUrl,
                     @Value("${dashboard.buses-stats-url}") String busesUrl) {
        this.ordersUrl = ordersUrl;
        this.busesUrl = busesUrl;
        var http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2))
                .followRedirects(HttpClient.Redirect.NEVER).build();
        var factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(Duration.ofSeconds(3));
        client = RestClient.builder().requestFactory(factory).build();
    }

    OrderTotals orders(Instant from, Instant to, String token) {
        var data = read("Orders", ordersUrl, Map.of("fromInclusive", from, "toExclusive", to), token,
                OrdersResponse.class);
        if (data.revenueVnd() == null) {
            throw unavailable("Orders");
        }
        return new OrderTotals(data.revenueVnd(), count(data.ticketsSold(), "Orders"));
    }

    long activeBuses(String token) {
        var data = read("Buses", busesUrl, Map.of(), token, BusesResponse.class);
        return count(data.activeBuses(), "Buses");
    }

    private <T> T read(String source, String url, Map<String, ?> params, String token, Class<T> type) {
        try {
            URI endpoint = URI.create(url.strip());
            if (!("http".equalsIgnoreCase(endpoint.getScheme()) || "https".equalsIgnoreCase(endpoint.getScheme()))
                    || endpoint.getHost() == null || endpoint.getRawUserInfo() != null
                    || endpoint.getRawQuery() != null || endpoint.getRawFragment() != null) {
                throw unavailable(source);
            }
            var uri = UriComponentsBuilder.fromUri(endpoint);
            params.forEach((name, value) -> uri.queryParam(name, UriUtils.encode(value.toString(), StandardCharsets.UTF_8)));
            var response = client.get().uri(uri.build(true).toUri()).accept(MediaType.APPLICATION_JSON)
                    .headers(headers -> headers.setBearerAuth(token)).retrieve().toEntity(type);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw unavailable(source);
            }
            return response.getBody();
        } catch (RestClientException | IllegalArgumentException exception) {
            throw unavailable(source);
        }
    }

    private static long count(BigDecimal value, String source) {
        if (value != null && value.signum() >= 0) {
            try {
                return value.longValueExact();
            } catch (ArithmeticException exception) {
                throw unavailable(source);
            }
        }
        throw unavailable(source);
    }

    private static ResponseStatusException unavailable(String source) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Không lấy được số liệu từ " + source + ".");
    }

    record OrderTotals(BigDecimal revenueVnd, long ticketsSold) {
    }

    private record OrdersResponse(BigDecimal revenueVnd, BigDecimal ticketsSold) {
    }

    private record BusesResponse(BigDecimal activeBuses) {
    }
}
