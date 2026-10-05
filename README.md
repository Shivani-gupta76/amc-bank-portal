# AMC Bank Demo Banking Portal

A classroom banking portal that demonstrates a React frontend connected to a Java Spring Boot API, PostgreSQL, JWT authentication, and role-based access. This is a local demo, not a real banking service.

## Technology

- Java 17 and Spring Boot 3.3.4
- Spring Web, Spring Data JPA, Spring Security, and JWT
- PostgreSQL
- React 19 and Vite

## Features

### Customer portal

- View profile, accounts, loans, and transaction statements
- Open a Savings or Current account
- Deposit or withdraw from an owned account
- Transfer to another active AMC Bank account by account number
- Filter statements by activity and date, and download a CSV
- Change password
- Apply for insurance, credit cards, and fixed deposits; view application status

### Administrator portal

- Dashboard with customer, active-account, and active-loan totals
- Create customer records and customer logins; search, edit, and delete customers
- Open accounts for customers and perform deposits, withdrawals, and transfers
- Review account activity and download transaction statements
- Sanction loans and review loan details
- Review and approve or decline insurance, credit-card, and fixed-deposit applications

Insurance, credit-card, and fixed-deposit screens implement application and review workflows only. They do not issue real policies or cards, or book/fund real fixed deposits. Account balances and transactions are demo data stored in the local database.

## Run locally

### 1. Configure PostgreSQL

Start PostgreSQL and create the database used by the current backend configuration:

```sql
CREATE DATABASE "amc-bank";
```

Copy `amc-backend/src/main/resources/application.properties.example` to `application.properties` in the same folder. The example defaults to `localhost:1234/amc-bank`; update `DB_URL` and `DB_USERNAME` as needed. Set `DB_PASSWORD` and `JWT_SECRET` as environment variables in the Eclipse Run Configuration (**Run → Run Configurations → Environment**). Keep the local `application.properties` file untracked.

### 2. Run the backend in Eclipse

1. Import `amc-backend` using **File → Import → Maven → Existing Maven Projects**.
2. Select the `amc-backend` folder and finish the import.
3. If needed, right-click the project and choose **Maven → Update Project**.
4. Run `AmcBankApplication.java` as a Spring Boot App.
5. The API should be available at `http://localhost:8080`.

### 3. Run the frontend

1. Open `amc-frontend` in VS Code or a terminal.
2. Run:

```bash
npm install
npm run dev
```

3. Open the URL printed by Vite. It is usually `http://localhost:5173`; if that port is occupied, Vite may use `http://localhost:5174`.

The frontend calls the backend at `http://localhost:8080/api`.

## Demo login

- Administrator: `admin` / `admin123`
- Customer: select **Customer** and use the email and initial password created by an administrator.

The admin login is a classroom demo account. Do not reuse it or its password outside this local project.

## Main API groups

- Public login: `POST /api/login`
- Authenticated identity: `GET /api/auth/me`
- Admin: `/api/dashboard`, `/api/customers/**`, `/api/accounts/**`, `/api/loans`, `/api/product-requests/**`
- Customer: `/api/customer/**`, including `/api/customer/me/products`

## Example rules in the demo

- Deposits and withdrawals must be greater than zero.
- A withdrawal cannot exceed the available account balance.
- Customer transactions are restricted to the customer's own accounts.
- Loan principal must be at least ₹10,000.
- Loan interest must be greater than 0% and no more than 50%.
- Loan tenure is 1–480 months; a customer may have up to 3 active loans.
- Loan eligibility also checks the active-account balance.
- Customer PAN values are checked against the expected 10-character format; this is format validation, not government KYC verification.

## GitHub and credentials

Before pushing this project to GitHub, remove the local database password from `application.properties` and configure credentials safely for your environment. Do not commit real database passwords, JWT secrets, or customer data. The `.gitignore` excludes generated build folders, `.env` files, and the local `application.properties`; commit the safe `application.properties.example` instead.

For production, use managed secrets, a strong JWT secret, HTTPS, database migrations, audit logging, and appropriate banking compliance and security controls.

