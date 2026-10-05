package com.amcbank.simple.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "app_users")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Admin uses "admin". Customers use their email address as the username.
    @Column(nullable = false, unique = true)
    private String username;

    // Only a BCrypt hash is stored here, never the plain-text password.
    @Column(nullable = false)
    private String password;

    // ROLE_ADMIN or ROLE_CUSTOMER
    @Column(nullable = false)
    private String role;

    // Null for the admin user. Present for customer login accounts.
    @OneToOne
    @JoinColumn(name = "customer_id", unique = true)
    @JsonIgnore
    private Customer customer;

    public AppUser() {
    }

    public AppUser(String username, String password, String role) {
        this(username, password, role, null);
    }

    public AppUser(String username, String password, String role, Customer customer) {
        this.username = username;
        this.password = password;
        this.role = role;
        this.customer = customer;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public Customer getCustomer() {
        return customer;
    }

    public void setCustomer(Customer customer) {
        this.customer = customer;
    }
}
