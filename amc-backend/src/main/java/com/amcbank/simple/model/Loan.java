package com.amcbank.simple.model;

import java.math.BigDecimal;
import java.math.RoundingMode;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "loans")
public class Loan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // HOME, CAR or PERSONAL
    private String type;

    private BigDecimal principal;
    private double interestRate;
    private int tenureMonths;
    private BigDecimal emi;
    private String status = "ACTIVE";

    @ManyToOne
    @JoinColumn(name = "customer_id", nullable = false)
    @JsonIgnore
    private Customer customer;

    public Loan() {
    }

    public void calculateEmi() {
        if (principal == null || tenureMonths <= 0) {
            emi = BigDecimal.ZERO;
            return;
        }

        if (interestRate == 0) {
            emi = principal.divide(
                    BigDecimal.valueOf(tenureMonths), 2, RoundingMode.HALF_UP);
            return;
        }

        // Standard EMI formula: P*r*(1+r)^n / ((1+r)^n - 1)
        double p = principal.doubleValue();
        double monthlyRate = interestRate / 1200.0;
        double factor = Math.pow(1 + monthlyRate, tenureMonths);
        double result = p * monthlyRate * factor / (factor - 1);

        emi = BigDecimal.valueOf(result).setScale(2, RoundingMode.HALF_UP);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public BigDecimal getPrincipal() {
        return principal;
    }

    public void setPrincipal(BigDecimal principal) {
        this.principal = principal;
    }

    public double getInterestRate() {
        return interestRate;
    }

    public void setInterestRate(double interestRate) {
        this.interestRate = interestRate;
    }

    public int getTenureMonths() {
        return tenureMonths;
    }

    public void setTenureMonths(int tenureMonths) {
        this.tenureMonths = tenureMonths;
    }

    public BigDecimal getEmi() {
        return emi;
    }

    public void setEmi(BigDecimal emi) {
        this.emi = emi;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    // These two read-only properties make the top-level Loan Module easy to render
    // without adding another DTO file. The full Customer object remains @JsonIgnore.
    public Long getCustomerId() {
        return customer == null ? null : customer.getId();
    }

    public String getCustomerName() {
        return customer == null ? null : customer.getName();
    }

    public Customer getCustomer() {
        return customer;
    }

    public void setCustomer(Customer customer) {
        this.customer = customer;
    }
}
