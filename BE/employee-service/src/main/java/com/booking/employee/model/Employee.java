package com.booking.employee.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "employees")
public class Employee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "emp_code", nullable = false, unique = true, length = 20)
    private String msnv;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, length = 50)
    private String role;

    @Column(nullable = false, unique = true, length = 20)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EmployeeStatus status = EmployeeStatus.WORKING;

    protected Employee() {
    }

    public Employee(String msnv, String name, String role, String phone) {
        updateProfile(msnv, name, role, phone);
    }

    public void updateProfile(String msnv, String name, String role, String phone) {
        this.msnv = msnv;
        this.name = name;
        this.role = role;
        this.phone = phone;
    }

    public void resign() {
        status = EmployeeStatus.RESIGNED;
    }

    public void updateWorkStatus(EmployeeStatus status) {
        this.status = status;
    }

    public Long getId() {
        return id;
    }

    public String getMsnv() {
        return msnv;
    }

    public String getName() {
        return name;
    }

    public String getRole() {
        return role;
    }

    public String getPhone() {
        return phone;
    }

    public EmployeeStatus getStatus() {
        return status;
    }
}
