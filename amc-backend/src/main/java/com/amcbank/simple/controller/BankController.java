package com.amcbank.simple.controller;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Locale;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import com.amcbank.simple.model.Account;
import com.amcbank.simple.model.AppUser;
import com.amcbank.simple.model.Customer;
import com.amcbank.simple.model.Loan;
import com.amcbank.simple.model.ProductRequest;
import com.amcbank.simple.repository.ProductRequestRepository;
import com.amcbank.simple.repository.UserRepository;
import com.amcbank.simple.security.JwtService;
import com.amcbank.simple.service.BankService;

@RestController
@RequestMapping("/api")
public class BankController {

    private final BankService service;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final ProductRequestRepository productRequests;

    public BankController(BankService service,
                          UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          JwtService jwtService,
                          ProductRequestRepository productRequests) {
        this.service = service;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.productRequests = productRequests;
    }

    // Public login for both admin and customer.
    // Admin username: admin. Customer username: customer's email address.
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String password = request.get("password");
        String requestedRole = request.get("role");

        AppUser user = userRepository
                .findByUsernameIgnoreCase(username == null ? "" : username.trim())
                .orElse(null);

        if (user == null || password == null
                || !passwordEncoder.matches(password, user.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid username/email or password"));
        }

        String selectedRole = requestedRole == null ? "" : requestedRole.trim().toUpperCase(Locale.ROOT);
        if (!("CUSTOMER".equals(selectedRole) || "ADMIN".equals(selectedRole))
                || !normalizeRole(user.getRole()).equals("ROLE_" + selectedRole)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Credentials do not match the selected login type"));
        }

        // Normalize legacy database values such as ADMIN -> ROLE_ADMIN.
        String normalizedRole = normalizeRole(user.getRole());
        if (!normalizedRole.equals(user.getRole())) {
            user.setRole(normalizedRole);
            userRepository.save(user);
        }

        String token = jwtService.generateToken(user.getUsername(), normalizedRole);

        return ResponseEntity.ok(Map.of(
                "token", token,
                "username", user.getUsername(),
                "role", normalizedRole));
    }

    // Lets the frontend confirm the identity/authority established by the JWT filter.
    @GetMapping("/auth/me")
    public Map<String, Object> authenticatedUser(Authentication authentication) {
        return Map.of(
                "username", authentication.getName(),
                "authorities", authentication.getAuthorities().stream()
                        .map(a -> a.getAuthority())
                        .collect(Collectors.toList()));
    }

    // -------------------- ADMIN APIs --------------------

    @GetMapping("/dashboard")
    public Map<String, Long> dashboard() {
        return Map.of(
                "customers", service.customerCount(),
                "activeAccounts", service.activeAccountCount(),
                "activeLoans", service.activeLoanCount());
    }

    @GetMapping("/customers")
    public Object customers(@RequestParam(name = "search", defaultValue = "") String search) {
        return service.getCustomers(search);
    }

    @GetMapping("/customers/{id}")
    public Customer customer(@PathVariable("id") Long id) {
        return service.getCustomer(id);
    }

    // Customer JSON includes initialPassword. It is write-only and never stored on Customer.
    @PostMapping("/customers")
    public ResponseEntity<Customer> addCustomer(@RequestBody Customer customer) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.addCustomer(customer));
    }

    @PutMapping("/customers/{id}")
    public Customer updateCustomer(@PathVariable("id") Long id,
                                   @RequestBody Customer customer) {
        return service.updateCustomer(id, customer);
    }

    @DeleteMapping("/customers/{id}")
    public ResponseEntity<Void> deleteCustomer(@PathVariable("id") Long id) {
        service.deleteCustomer(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/customers/{customerId}/accounts")
    public Object accounts(@PathVariable("customerId") Long customerId) {
        return service.getAccounts(customerId);
    }

    @GetMapping("/customers/{customerId}/transactions")
    public Object accountTransactions(@PathVariable("customerId") Long customerId) {
        return service.getAccountTransactions(customerId);
    }

    @PostMapping("/customers/{customerId}/accounts")
    public ResponseEntity<Account> openAccount(@PathVariable("customerId") Long customerId,
                                               @RequestBody Account account) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.openAccount(customerId, account));
    }

    @PostMapping("/accounts/{accountId}/deposit")
    public Account deposit(@PathVariable("accountId") Long accountId,
                           @RequestParam("amount") BigDecimal amount) {
        return service.deposit(accountId, amount);
    }

    @PostMapping("/accounts/{accountId}/withdraw")
    public Account withdraw(@PathVariable("accountId") Long accountId,
                            @RequestParam("amount") BigDecimal amount) {
        return service.withdraw(accountId, amount);
    }

    @PostMapping("/accounts/transfer")
    public ResponseEntity<?> transfer(@RequestParam("fromAccountId") Long fromAccountId,
                                      @RequestParam("toAccountId") Long toAccountId,
                                      @RequestParam("amount") BigDecimal amount) {
        service.transferAccounts(fromAccountId, toAccountId, amount);
        return ResponseEntity.ok(Map.of("message", "Transfer completed successfully"));
    }

    @GetMapping("/loans")
    public Object allLoans() {
        return service.getAllLoans();
    }

    @GetMapping("/customers/{customerId}/loans")
    public Object loans(@PathVariable("customerId") Long customerId) {
        return service.getLoans(customerId);
    }

    @PostMapping("/customers/{customerId}/loans")
    public ResponseEntity<Loan> sanctionLoan(@PathVariable("customerId") Long customerId,
                                             @RequestBody Loan loan) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.sanctionLoan(customerId, loan));
    }

    // -------------------- CUSTOMER SELF-SERVICE APIs --------------------

    @GetMapping("/customer/me")
    public Customer myProfile(Authentication authentication) {
        return service.getCustomerForUsername(authentication.getName());
    }

    @GetMapping("/customer/me/accounts")
    public Object myAccounts(Authentication authentication) {
        return service.getMyAccounts(authentication.getName());
    }

    @PostMapping("/customer/me/accounts")
    public ResponseEntity<Account> openMyAccount(Authentication authentication,
                                                   @RequestBody Account account) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.openMyAccount(authentication.getName(), account));
    }

    @GetMapping("/customer/me/transactions")
    public Object myAccountTransactions(Authentication authentication) {
        return service.getMyAccountTransactions(authentication.getName());
    }

    @GetMapping("/customer/me/loans")
    public Object myLoans(Authentication authentication) {
        return service.getMyLoans(authentication.getName());
    }

    // Customer can deposit only into an account linked to their own login.
    @PostMapping("/customer/me/accounts/{accountId}/deposit")
    public Account depositMyAccount(Authentication authentication,
                                    @PathVariable("accountId") Long accountId,
                                    @RequestParam("amount") BigDecimal amount) {
        return service.depositMyAccount(authentication.getName(), accountId, amount);
    }

    // Customer can withdraw only from their own account and only when
    // amount <= available balance. BankService performs the ownership/balance checks.
    @PostMapping("/customer/me/accounts/{accountId}/withdraw")
    public Account withdrawMyAccount(Authentication authentication,
                                     @PathVariable("accountId") Long accountId,
                                     @RequestParam("amount") BigDecimal amount) {
        return service.withdrawMyAccount(authentication.getName(), accountId, amount);
    }

    @PostMapping("/customer/me/transfers")
    public ResponseEntity<?> transferMyAccounts(Authentication authentication,
                                                @RequestParam("fromAccountId") Long fromAccountId,
                                                @RequestParam("toAccountNumber") String toAccountNumber,
                                                @RequestParam("amount") BigDecimal amount) {
        service.transferMyAccount(authentication.getName(), fromAccountId, toAccountNumber, amount);
        return ResponseEntity.ok(Map.of("message", "Transfer completed successfully"));
    }

    @PostMapping("/customer/me/password")
    public ResponseEntity<?> changeMyPassword(Authentication authentication,
                                              @RequestBody Map<String, String> request) {
        service.changeCustomerPassword(
                authentication.getName(),
                request.get("currentPassword"),
                request.get("newPassword"));

        return ResponseEntity.ok(Map.of(
                "message", "Password changed successfully. Use the new password next time you login."));
    }


    // -------------------- CUSTOMER PRODUCT REQUESTS --------------------
    @GetMapping("/customer/me/products")
    public Object myProductRequests(Authentication authentication) {
        return productRequests.findByCustomer_EmailOrderByCreatedAtDesc(authentication.getName());
    }

    @PostMapping("/customer/me/products")
    public ResponseEntity<ProductRequest> createProductRequest(Authentication authentication,
                                                               @RequestBody ProductRequest request) {
        Customer customer = service.getCustomerForUsername(authentication.getName());
        request.setId(null);
        request.setCustomer(customer);
        request.setStatus("PENDING");
        request.setCreatedAt(java.time.LocalDateTime.now());
        String type = request.getProductType() == null ? "" : request.getProductType().trim().toUpperCase(Locale.ROOT);
        if (!java.util.Set.of("INSURANCE", "CREDIT_CARD", "FIXED_DEPOSIT").contains(type)) {
            throw new IllegalArgumentException("Choose Insurance, Credit Card, or Fixed Deposit");
        }
        request.setProductType(type);
        if (request.getAmount() == null || request.getAmount().signum() <= 0) {
            throw new IllegalArgumentException("Enter a valid amount");
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(productRequests.save(request));
    }

    @GetMapping("/product-requests")
    public Object allProductRequests() {
        return productRequests.findAllByOrderByCreatedAtDesc();
    }

    @PutMapping("/product-requests/{id}/status")
    public ProductRequest updateProductRequestStatus(@PathVariable("id") Long id,
                                                     @RequestBody Map<String, String> body) {
        ProductRequest item = productRequests.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product request not found"));
        String status = body.getOrDefault("status", "").trim().toUpperCase(Locale.ROOT);
        if (!java.util.Set.of("APPROVED", "DECLINED").contains(status)) {
            throw new IllegalArgumentException("Status must be APPROVED or DECLINED");
        }
        item.setStatus(status);
        return productRequests.save(item);
    }
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<?> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.badRequest()
                .body(Map.of("message", ex.getMessage()));
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



