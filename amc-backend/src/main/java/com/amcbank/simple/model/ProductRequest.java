package com.amcbank.simple.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "product_requests")
public class ProductRequest {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    @JsonIgnore
    private Customer customer;
    @Column(nullable = false)
    private String productType;
    private String productName;
    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;
    private Integer termMonths;
    private String notes;
    @Column(nullable = false)
    private String status = "PENDING";
    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    public ProductRequest() {}
    public Long getId(){return id;} public void setId(Long v){id=v;}
    public Customer getCustomer(){return customer;} public void setCustomer(Customer v){customer=v;}
    public Long getCustomerId(){return customer==null?null:customer.getId();}
    public String getCustomerName(){return customer==null?null:customer.getName();}
    public String getCustomerEmail(){return customer==null?null:customer.getEmail();}
    public String getProductType(){return productType;} public void setProductType(String v){productType=v;}
    public String getProductName(){return productName;} public void setProductName(String v){productName=v;}
    public BigDecimal getAmount(){return amount;} public void setAmount(BigDecimal v){amount=v;}
    public Integer getTermMonths(){return termMonths;} public void setTermMonths(Integer v){termMonths=v;}
    public String getNotes(){return notes;} public void setNotes(String v){notes=v;}
    public String getStatus(){return status;} public void setStatus(String v){status=v;}
    public LocalDateTime getCreatedAt(){return createdAt;} public void setCreatedAt(LocalDateTime v){createdAt=v;}
}
