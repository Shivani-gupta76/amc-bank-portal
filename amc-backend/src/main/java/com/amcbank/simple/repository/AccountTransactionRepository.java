package com.amcbank.simple.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.amcbank.simple.model.AccountTransaction;

public interface AccountTransactionRepository extends JpaRepository<AccountTransaction, Long> {

    @Query("select t from AccountTransaction t where t.account.customer.id = :customerId "
         + "order by t.createdAt desc, t.id desc")
    List<AccountTransaction> findByCustomerIdOrderByCreatedAtDesc(
            @Param("customerId") Long customerId);

    @Query("select t from AccountTransaction t where t.account.customer.email = :email "
         + "order by t.createdAt desc, t.id desc")
    List<AccountTransaction> findByCustomerEmailOrderByCreatedAtDesc(
            @Param("email") String email);
}
