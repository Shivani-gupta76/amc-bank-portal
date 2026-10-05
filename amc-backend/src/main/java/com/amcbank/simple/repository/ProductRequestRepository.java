package com.amcbank.simple.repository;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.amcbank.simple.model.ProductRequest;
public interface ProductRequestRepository extends JpaRepository<ProductRequest, Long> {
    List<ProductRequest> findByCustomer_EmailOrderByCreatedAtDesc(String email);
    List<ProductRequest> findAllByOrderByCreatedAtDesc();
}

