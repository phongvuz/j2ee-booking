package com.booking.employee.service;

import com.booking.employee.dto.EmployeeRequest;
import com.booking.employee.model.Employee;
import com.booking.employee.repository.EmployeeRepository;
import java.sql.SQLException;
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

    private Employee findForUpdate(Long id) {
        return employees.findOneById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy nhân viên."));
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
}
