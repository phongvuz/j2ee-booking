package com.nhom.booking.repositories;

import com.nhom.booking.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;

/** TẠM THỜI - Người 4 (Auth) sẽ thay bằng bản đầy đủ. */
public interface UserRepository extends JpaRepository<User, Long> {
}
