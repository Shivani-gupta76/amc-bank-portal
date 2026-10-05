package com.amcbank.simple.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;

@Entity
@Table(name = "customers")
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Column(unique = true)
    private String email;

    private String city;

    @Column(unique = true)
    private String panNumber;

    // Used only when an admin creates a customer.
    // It is accepted from JSON but is never persisted or returned in API responses.
    @Transient
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String initialPassword;

    public Customer() {
    }

    public Customer(String name, String email, String city, String panNumber) {
        this.name = name;
        this.email = email;
        this.city = city;
        this.panNumber = panNumber;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getPanNumber() {
        return panNumber;
    }

    public void setPanNumber(String panNumber) {
        this.panNumber = panNumber;
    }

    public String getInitialPassword() {
        return initialPassword;
    }

    public void setInitialPassword(String initialPassword) {
        this.initialPassword = initialPassword;
    }
}
