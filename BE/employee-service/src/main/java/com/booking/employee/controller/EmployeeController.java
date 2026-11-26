package com.booking.employee.controller;

import com.booking.employee.dto.EmployeeRequest;
import com.booking.employee.model.Employee;
import com.booking.employee.service.EmployeeService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/employees")
public class EmployeeController {

    private final EmployeeService employees;

    public EmployeeController(EmployeeService employees) {
        this.employees = employees;
    }

    @GetMapping
    public List<Employee> list() {
        return employees.list();
    }

    @GetMapping("/{id}/driver-eligibility")
    public DriverEligibility driverEligibility(@PathVariable Long id) {
        return new DriverEligibility(employees.isDriverEligible(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Employee create(@RequestBody EmployeeRequest request) {
        return employees.create(request);
    }

    @PutMapping("/{id}")
    public Employee update(@PathVariable Long id, @RequestBody EmployeeRequest request) {
        return employees.update(id, request);
    }

    @PatchMapping("/{id}/status")
    public Employee updateWorkStatus(@PathVariable Long id, @RequestBody WorkStatusRequest request) {
        return employees.updateWorkStatus(id, request.status());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resign(@PathVariable Long id) {
        employees.resign(id);
    }

    public record DriverEligibility(boolean eligible) {
    }

    public record WorkStatusRequest(String status) {
    }
}
