package com.amcbank.simple.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.amcbank.simple.model.Loan;

public interface LoanRepository extends JpaRepository<Loan, Long> {

    // Explicit JPQL is used so Spring does not have to guess a nested property
    // from the method name. Loan has a Customer field named "customer";
    // therefore the query correctly navigates customer.id.
    @Query("select l from Loan l where l.customer.id = :customerId")
    List<Loan> findByCustomerId(@Param("customerId") Long customerId);

    @Query("select count(l) from Loan l "
         + "where l.customer.id = :customerId and l.status = :status")
    long countByCustomerIdAndStatus(@Param("customerId") Long customerId,
                                    @Param("status") String status);

    long countByStatus(String status);
}
