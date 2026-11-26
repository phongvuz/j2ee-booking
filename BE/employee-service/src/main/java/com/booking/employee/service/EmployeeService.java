package com.booking.employee.service;

import com.booking.employee.dto.EmployeeRequest;
import com.booking.employee.model.Employee;
import com.booking.employee.model.EmployeeStatus;
import com.booking.employee.repository.EmployeeRepository;
import java.sql.SQLException;
import java.util.EnumMap;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EmployeeService {

    private final EmployeeRepository employees;

    public EmployeeService(EmployeeRepository employees) {
        this.employees = employees;
    }

    public List<Employee> list() {
        return employees.findAll();
    }

    public Headcount headcount() {
        var totals = new EnumMap<EmployeeStatus, Long>(EmployeeStatus.class);
        employees.countByWorkStatus().forEach(row -> totals.put(row.getStatus(), row.getTotal()));
        long working = totals.getOrDefault(EmployeeStatus.WORKING, 0L);
        long onLeave = totals.getOrDefault(EmployeeStatus.ON_LEAVE, 0L);
        return new Headcount(working + onLeave, working, onLeave, totals.getOrDefault(EmployeeStatus.RESIGNED, 0L));
    }

    public boolean isDriverEligible(Long id) {
        var employee = employees.findById(id).orElseThrow(EmployeeService::notFound);
        String role = employee.getRole().strip();
        return employee.getStatus() == EmployeeStatus.WORKING
                && (role.equalsIgnoreCase("Tài xế") || role.equalsIgnoreCase("Driver"));
    }

    public Employee create(EmployeeRequest request) {
        request.validate();
        return save(new Employee(request.msnv(), request.name(), request.role(), request.phone()));
    }

    @Transactional
    public Employee update(Long id, EmployeeRequest request) {
        request.validate();
        Employee employee = findForUpdate(id);
        employee.updateProfile(request.msnv(), request.name(), request.role(), request.phone());
        return save(employee);
    }

    @Transactional
    public void resign(Long id) {
        findForUpdate(id).resign();
    }

    @Transactional
    public Employee updateWorkStatus(Long id, String status) {
        if (!"WORKING".equals(status) && !"ON_LEAVE".equals(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái phải là WORKING hoặc ON_LEAVE.");
        }
        Employee employee = findForUpdate(id);
        if (employee.getStatus() == EmployeeStatus.RESIGNED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nhân viên đã nghỉ việc.");
        }
        employee.updateWorkStatus(EmployeeStatus.valueOf(status));
        return employee;
    }

    private Employee findForUpdate(Long id) {
        return employees.findOneById(id).orElseThrow(EmployeeService::notFound);
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy nhân viên.");
    }

    private Employee save(Employee employee) {
        try {
            return employees.saveAndFlush(employee);
        } catch (DataIntegrityViolationException exception) {
            if (exception.getMostSpecificCause() instanceof SQLException sqlException
                    && "23505".equals(sqlException.getSQLState())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Mã nhân viên hoặc số điện thoại đã tồn tại.", exception);
            }
            throw exception;
        }
    }

    public record Headcount(long current, long working, long onLeave, long resigned) {
    }
}
