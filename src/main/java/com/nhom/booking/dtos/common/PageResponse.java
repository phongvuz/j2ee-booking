package com.nhom.booking.dtos.common;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.data.domain.Page;

import java.util.List;

/** Kết quả phân trang dùng chung cho cả nhóm. */
@Getter
@AllArgsConstructor
public class PageResponse<T> {
    private final List<T> content;
    private final int page;           // trang hiện tại (bắt đầu từ 0)
    private final int size;           // số phần tử mỗi trang
    private final long totalElements;
    private final int totalPages;

    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages());
    }
}
