package com.amcbank.simple.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amcbank.simple.model.Account;
import com.amcbank.simple.model.AccountTransaction;
import com.amcbank.simple.model.AppUser;
import com.amcbank.simple.model.Customer;
import com.amcbank.simple.model.Loan;
import com.amcbank.simple.repository.AccountRepository;
import com.amcbank.simple.repository.AccountTransactionRepository;
import com.amcbank.simple.repository.CustomerRepository;
import com.amcbank.simple.repository.LoanRepository;
import com.amcbank.simple.repository.UserRepository;

@Service
public class BankService {

    private final CustomerRepository customerRepository;
    private final AccountRepository accountRepository;
    private final AccountTransactionRepository accountTransactionRepository;
    private final LoanRepository loanRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public BankService(CustomerRepository customerRepository,
                       AccountRepository accountRepository,
                       AccountTransactionRepository accountTransactionRepository,
                       LoanRepository loanRepository,
                       UserRepository userRepository,
                       PasswordEncoder passwordEncoder) {
        this.customerRepository = customerRepository;
        this.accountRepository = accountRepository;
        this.accountTransactionRepository = accountTransactionRepository;
        this.loanRepository = loanRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public List<Customer> getCustomers(String search) {
        if (search == null || search.isBlank()) {
            return customerRepository.findAll();
        }
        return customerRepository
                .findByNameContainingIgnoreCaseOrCityContainingIgnoreCase(search, search);
    }

    public Customer getCustomer(Long id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Customer not found"));
    }

    // Admin creates the customer and the customer's first login password together.
    // Customer email becomes the login username.
    @Transactional
    public Customer addCustomer(Customer customer) {
        normalizeCustomer(customer);
        validateCustomer(customer, null);
        validateNewPassword(customer.getInitialPassword());

        if (userRepository.existsByUsernameIgnoreCase(customer.getEmail())) {
            throw new IllegalArgumentException("A login already exists for this email");
        }

        Customer saved = customerRepository.save(customer);

        AppUser login = new AppUser(
                saved.getEmail(),
                passwordEncoder.encode(customer.getInitialPassword()),
                "ROLE_CUSTOMER",
                saved);
        userRepository.save(login);

        return saved;
    }

    @Transactional
    public Customer updateCustomer(Long id, Customer input) {
        Customer customer = getCustomer(id);
        normalizeCustomer(input);
        validateCustomer(input, customer);

        String oldEmail = customer.getEmail();
        boolean emailChanged = !input.getEmail().equalsIgnoreCase(oldEmail);

        if (emailChanged && userRepository.existsByUsernameIgnoreCase(input.getEmail())) {
            throw new IllegalArgumentException("A login already exists for this email");
        }

        customer.setName(input.getName());
        customer.setEmail(input.getEmail());
        customer.setCity(input.getCity());
        customer.setPanNumber(input.getPanNumber());
        Customer saved = customerRepository.save(customer);

        // Keep customer login ID synchronized when an admin changes the email.
        if (emailChanged) {
            AppUser login = userRepository.findByCustomerId(id)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Customer login account not found"));
            login.setUsername(saved.getEmail());
            userRepository.save(login);
        }

        return saved;
    }

    @Transactional
    public void deleteCustomer(Long id) {
        getCustomer(id);
        if (!accountRepository.findByCustomerId(id).isEmpty()
                || !loanRepository.findByCustomerId(id).isEmpty()) {
            throw new IllegalArgumentException(
                    "Customer cannot be deleted while accounts or loans exist");
        }

        userRepository.findByCustomerId(id).ifPresent(user -> {
            userRepository.delete(user);
            userRepository.flush();
        });
        customerRepository.deleteById(id);
    }

    private void normalizeCustomer(Customer customer) {
        if (customer.getName() != null) {
            customer.setName(customer.getName().trim());
        }
        if (customer.getEmail() != null) {
            customer.setEmail(customer.getEmail().trim().toLowerCase(Locale.ROOT));
        }
        if (customer.getCity() != null) {
            customer.setCity(customer.getCity().trim());
        }
        if (customer.getPanNumber() != null) {
            customer.setPanNumber(customer.getPanNumber().trim().toUpperCase(Locale.ROOT));
        }
    }

    private void validateCustomer(Customer input, Customer existing) {
        if (input.getName() == null || input.getName().isBlank()) {
            throw new IllegalArgumentException("Customer name is required");
        }
        if (input.getEmail() == null || !input.getEmail().matches("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")) {
            throw new IllegalArgumentException("Valid email is required");
        }
        if (input.getPanNumber() == null
                || !input.getPanNumber().matches("^[A-Z]{3}[ABCFGHLJPT][A-Z][0-9]{4}[A-Z]$")) {
            throw new IllegalArgumentException(
                    "PAN must be 10 characters with a valid holder type in the 4th position");
        }

        boolean emailChanged = existing == null
                || !input.getEmail().equalsIgnoreCase(existing.getEmail());
        boolean panChanged = existing == null
                || !input.getPanNumber().equalsIgnoreCase(existing.getPanNumber());

        if (emailChanged && customerRepository.existsByEmail(input.getEmail())) {
            throw new IllegalArgumentException("Email already registered");
        }
        if (panChanged && customerRepository.existsByPanNumber(input.getPanNumber())) {
            throw new IllegalArgumentException("PAN already registered");
        }
    }

    private void validateNewPassword(String password) {
        if (password == null || password.length() < 8 || password.length() > 64) {
            throw new IllegalArgumentException(
                    "Password must contain between 8 and 64 characters");
        }
    }

    // -------------------- CUSTOMER SELF-SERVICE --------------------

    public Customer getCustomerForUsername(String username) {
        AppUser user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new IllegalArgumentException("Login account not found"));

        if (user.getCustomer() == null) {
            throw new IllegalArgumentException("No customer is linked to this login");
        }
        return user.getCustomer();
    }

    public List<Account> getMyAccounts(String username) {
        Customer customer = getCustomerForUsername(username);
        return accountRepository.findByCustomerId(customer.getId());
    }

    @Transactional
    public Account openMyAccount(String username, Account input) {
        Customer customer = getCustomerForUsername(username);
        return openAccount(customer.getId(), input);
    }

    public List<AccountTransaction> getMyAccountTransactions(String username) {
        Customer customer = getCustomerForUsername(username);
        return accountTransactionRepository.findByCustomerIdOrderByCreatedAtDesc(customer.getId());
    }

    public List<Loan> getMyLoans(String username) {
        Customer customer = getCustomerForUsername(username);
        return loanRepository.findByCustomerId(customer.getId());
    }

    // Customer self-service deposit. The account must belong to the logged-in customer.
    @Transactional
    public Account depositMyAccount(String username, Long accountId, BigDecimal amount) {
        Account account = getOwnedActiveAccount(username, accountId);
        validatePositiveAmount(amount);
        account.setBalance(account.getBalance().add(amount));
        accountTransactionRepository.save(new AccountTransaction(account, "DEPOSIT", amount,
                account.getBalance()));
        return account;
    }

    // Customer self-service withdrawal. The requested amount must be less than
    // or equal to the available balance; negative balances are never allowed.
    @Transactional
    public Account withdrawMyAccount(String username, Long accountId, BigDecimal amount) {
        Account account = getOwnedActiveAccount(username, accountId);
        validatePositiveAmount(amount);

        if (amount.compareTo(account.getBalance()) > 0) {
            throw new IllegalArgumentException(
                    "Withdrawal amount cannot exceed available balance of "
                    + account.getBalance());
        }

        account.setBalance(account.getBalance().subtract(amount));
        accountTransactionRepository.save(new AccountTransaction(account, "WITHDRAWAL", amount,
                account.getBalance()));
        return account;
    }

    // The source must belong to the logged-in customer; a transfer recipient can
    // be any active account at this bank.
    @Transactional
    public void transferMyAccount(String username, Long fromAccountId,
                                  String toAccountNumber, BigDecimal amount) {
        getOwnedActiveAccount(username, fromAccountId);
        Account recipient = accountRepository.findByAccountNumber(
                toAccountNumber == null ? "" : toAccountNumber.trim().toUpperCase(Locale.ROOT))
                .orElseThrow(() -> new IllegalArgumentException("Recipient account was not found"));
        transferAccounts(fromAccountId, recipient.getId(), amount);
    }

    private Account getOwnedActiveAccount(String username, Long accountId) {
        Customer customer = getCustomerForUsername(username);
        Account account = getActiveAccount(accountId);

        if (account.getCustomer() == null
                || !account.getCustomer().getId().equals(customer.getId())) {
            throw new IllegalArgumentException(
                    "You can perform transactions only on your own account");
        }
        return account;
    }

    @Transactional
    public void changeCustomerPassword(String username,
                                       String currentPassword,
                                       String newPassword) {
        AppUser user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new IllegalArgumentException("Login account not found"));

        if (!"ROLE_CUSTOMER".equals(user.getRole()) || user.getCustomer() == null) {
            throw new IllegalArgumentException("Password change is available to customers here");
        }
        if (currentPassword == null
                || !passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }

        validateNewPassword(newPassword);
        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw new IllegalArgumentException(
                    "New password must be different from the current password");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    // -------------------- ACCOUNTS --------------------

    public List<Account> getAccounts(Long customerId) {
        getCustomer(customerId);
        return accountRepository.findByCustomerId(customerId);
    }

    public List<AccountTransaction> getAccountTransactions(Long customerId) {
        getCustomer(customerId);
        return accountTransactionRepository.findByCustomerIdOrderByCreatedAtDesc(customerId);
    }

    @Transactional
    public Account openAccount(Long customerId, Account input) {
        Customer customer = getCustomer(customerId);

        if (input.getType() == null
                || !(input.getType().equalsIgnoreCase("SAVINGS")
                || input.getType().equalsIgnoreCase("CURRENT"))) {
            throw new IllegalArgumentException("Account type must be SAVINGS or CURRENT");
        }

        BigDecimal openingBalance = input.getBalance() == null
                ? BigDecimal.ZERO : input.getBalance();
        if (openingBalance.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Opening balance cannot be negative");
        }

        Account account = new Account();
        account.setAccountNumber("AC" + UUID.randomUUID().toString()
                .replace("-", "").substring(0, 8).toUpperCase());
        account.setType(input.getType().toUpperCase());
        account.setBalance(openingBalance);
        account.setStatus("ACTIVE");
        account.setCustomer(customer);
        Account saved = accountRepository.save(account);
        accountTransactionRepository.save(new AccountTransaction(saved, "ACCOUNT_OPENED",
                openingBalance, openingBalance));
        return saved;
    }

    @Transactional
    public Account deposit(Long accountId, BigDecimal amount) {
        Account account = getActiveAccount(accountId);
        validatePositiveAmount(amount);
        account.setBalance(account.getBalance().add(amount));
        accountTransactionRepository.save(new AccountTransaction(account, "DEPOSIT", amount,
                account.getBalance()));
        return account;
    }

    @Transactional
    public Account withdraw(Long accountId, BigDecimal amount) {
        Account account = getActiveAccount(accountId);
        validatePositiveAmount(amount);

        if (amount.compareTo(account.getBalance()) > 0) {
            throw new IllegalArgumentException(
                    "Withdrawal amount cannot exceed available balance of "
                    + account.getBalance());
        }

        BigDecimal newBalance = account.getBalance().subtract(amount);
        account.setBalance(newBalance);
        accountTransactionRepository.save(new AccountTransaction(account, "WITHDRAWAL", amount,
                newBalance));
        return account;
    }

    // Atomic internal account transfer.
    @Transactional
    public void transferAccounts(Long fromAccountId, Long toAccountId, BigDecimal amount) {
        if (fromAccountId == null || toAccountId == null || fromAccountId.equals(toAccountId)) {
            throw new IllegalArgumentException("Choose two different accounts for the transfer");
        }
        validatePositiveAmount(amount);
        Account from = getActiveAccount(fromAccountId);
        Account to = getActiveAccount(toAccountId);
        if (amount.compareTo(from.getBalance()) > 0) {
            throw new IllegalArgumentException("Transfer amount cannot exceed available balance of "
                    + from.getBalance());
        }

        from.setBalance(from.getBalance().subtract(amount));
        to.setBalance(to.getBalance().add(amount));
        accountTransactionRepository.save(new AccountTransaction(from, "TRANSFER_OUT", amount,
                from.getBalance()));
        accountTransactionRepository.save(new AccountTransaction(to, "TRANSFER_IN", amount,
                to.getBalance()));
    }

    private Account getActiveAccount(Long id) {
        Account account = accountRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));
        if (!"ACTIVE".equalsIgnoreCase(account.getStatus())) {
            throw new IllegalArgumentException("Account is not active");
        }
        return account;
    }

    private void validatePositiveAmount(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be greater than zero");
        }
    }

    // -------------------- LOANS --------------------

    public List<Loan> getAllLoans() {
        return loanRepository.findAll();
    }

    public List<Loan> getLoans(Long customerId) {
        getCustomer(customerId);
        return loanRepository.findByCustomerId(customerId);
    }

    public Loan sanctionLoan(Long customerId, Loan input) {
        Customer customer = getCustomer(customerId);

        if (input.getPrincipal() == null
                || input.getPrincipal().compareTo(new BigDecimal("10000")) < 0) {
            throw new IllegalArgumentException("Loan principal must be at least 10000");
        }
        if (input.getType() == null || input.getType().isBlank()) {
            throw new IllegalArgumentException("Loan type is required");
        }
        if (input.getTenureMonths() <= 0 || input.getTenureMonths() > 480) {
            throw new IllegalArgumentException("Tenure must be between 1 and 480 months");
        }
        if (input.getInterestRate() <= 0 || input.getInterestRate() > 50) {
            throw new IllegalArgumentException("Interest rate must be between 0 and 50");
        }
        if (loanRepository.countByCustomerIdAndStatus(customerId, "ACTIVE") >= 3) {
            throw new IllegalArgumentException("Customer already has 3 active loans");
        }

        BigDecimal totalBalance = accountRepository.findByCustomerId(customerId)
                .stream()
                .filter(a -> "ACTIVE".equalsIgnoreCase(a.getStatus()))
                .map(Account::getBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal requiredBalance = input.getPrincipal().multiply(new BigDecimal("0.10"));
        if (totalBalance.compareTo(requiredBalance) < 0) {
            throw new IllegalArgumentException(
                    "Customer balance must be at least 10% of loan principal");
        }

        input.setCustomer(customer);
        input.setStatus("ACTIVE");
        input.calculateEmi();
        return loanRepository.save(input);
    }

    // -------------------- DASHBOARD --------------------

    public long customerCount() {
        return customerRepository.count();
    }

    public long activeAccountCount() {
        return accountRepository.countByStatus("ACTIVE");
    }

    public long activeLoanCount() {
        return loanRepository.countByStatus("ACTIVE");
    }
}
