package com.amcbank.simple;

import java.util.Locale;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.amcbank.simple.model.AppUser;
import com.amcbank.simple.repository.UserRepository;

@SpringBootApplication
public class AmcBankApplication {

    public static void main(String[] args) {
        SpringApplication.run(AmcBankApplication.class, args);
    }

    @Bean
    CommandLineRunner initializeUsers(UserRepository userRepository,
                                      PasswordEncoder passwordEncoder) {
        return args -> {
            // Repair legacy role values such as ADMIN/CUSTOMER if an older database
            // is reused. Spring Security will then consistently see ROLE_ADMIN or
            // ROLE_CUSTOMER.
            userRepository.findAll().forEach(user -> {
                String normalized = normalizeRole(user.getRole());
                if (!normalized.equals(user.getRole())) {
                    user.setRole(normalized);
                    userRepository.save(user);
                }
            });

            // Create the classroom admin the first time. If admin already exists,
            // explicitly repair its role without resetting its password.
            AppUser admin = userRepository.findByUsernameIgnoreCase("admin")
                    .orElse(null);

            if (admin == null) {
                userRepository.save(new AppUser(
                        "admin",
                        passwordEncoder.encode("admin123"),
                        "ROLE_ADMIN"));
            } else if (!"ROLE_ADMIN".equals(admin.getRole())) {
                admin.setRole("ROLE_ADMIN");
                userRepository.save(admin);
            }
        };
    }

    private String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return "ROLE_CUSTOMER";
        }
        String normalized = role.trim().toUpperCase(Locale.ROOT);
        return normalized.startsWith("ROLE_")
                ? normalized
                : "ROLE_" + normalized;
    }
}
