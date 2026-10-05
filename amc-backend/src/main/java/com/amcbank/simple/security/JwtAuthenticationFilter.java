package com.amcbank.simple.security;

import java.io.IOException;
import java.util.List;
import java.util.Locale;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.amcbank.simple.repository.UserRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    public JwtAuthenticationFilter(JwtService jwtService,
                                   UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        if (header != null
                && header.startsWith("Bearer ")
                && SecurityContextHolder.getContext().getAuthentication() == null) {

            String token = header.substring(7);

            try {
                String username = jwtService.parseToken(token).getSubject();

                // Re-read the user from the database on every request.
                // This means current database permissions are authoritative.
                userRepository.findByUsernameIgnoreCase(username).ifPresent(user -> {
                    String authorityName = normalizeRole(user.getRole());

                    if (!authorityName.isBlank()) {
                        SimpleGrantedAuthority authority =
                                new SimpleGrantedAuthority(authorityName);

                        UsernamePasswordAuthenticationToken authentication =
                                new UsernamePasswordAuthenticationToken(
                                        user.getUsername(),
                                        null,
                                        List.of(authority));

                        SecurityContextHolder.getContext()
                                .setAuthentication(authentication);
                    }
                });
            } catch (Exception ignored) {
                // Invalid/expired JWT: Spring Security will return HTTP 401.
            }
        }

        filterChain.doFilter(request, response);
    }

    // Accept both legacy values such as ADMIN/CUSTOMER and the preferred
    // Spring Security values ROLE_ADMIN/ROLE_CUSTOMER.
    private String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return "";
        }

        String normalized = role.trim().toUpperCase(Locale.ROOT);
        return normalized.startsWith("ROLE_")
                ? normalized
                : "ROLE_" + normalized;
    }
}
