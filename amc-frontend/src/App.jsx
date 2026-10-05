import { useEffect, useState } from 'react';

const API = 'http://localhost:8080/api'; // calling Spring Boot Rest API for backend access
const APP_VERSION = 'v6-banking-portal';
const PAN_PATTERN = /^[A-Z]{3}[ABCFGHLJPT][A-Z][0-9]{4}[A-Z]$/;

function normalizePan(value) {
  return value.replace(/\s+/g, '').toUpperCase().slice(0, 10);
}

// Prevent a JWT/role saved by an older project version from being reused.
if (localStorage.getItem('amc_app_version') !== APP_VERSION) {
  localStorage.removeItem('amc_token');
  localStorage.removeItem('amc_username');
  localStorage.removeItem('amc_role');
  localStorage.setItem('amc_app_version', APP_VERSION);
}

async function request(url, options = {}) {
  // Never attach an old/stale token to the login request.
  const token = url === '/login' ? null : localStorage.getItem('amc_token');

  const response = await fetch(API + url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const data = await response.json();
      message = data.message || message;
    } catch {
      // Keep the default message if the response has no JSON body.
    }

    if (response.status === 401 && url !== '/login') {
      clearLogin();
      window.location.reload();
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

function clearLogin() {
  localStorage.removeItem('amc_token');
  localStorage.removeItem('amc_username');
  localStorage.removeItem('amc_role');
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(Boolean(localStorage.getItem('amc_token')));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginRole, setLoginRole] = useState('CUSTOMER');
  const [message, setMessage] = useState('');

  if (!loggedIn) {
    async function login(e) {
      e.preventDefault();
      setMessage('');

      try {
        const data = await request('/login', {
          method: 'POST',
          body: JSON.stringify({ username, password, role: loginRole })
        });

        if (!['ROLE_ADMIN', 'ROLE_CUSTOMER'].includes(data.role)) {
          throw new Error(`Unsupported login role: ${data.role}`);
        }

        localStorage.setItem('amc_token', data.token);
        localStorage.setItem('amc_username', data.username);
        localStorage.setItem('amc_role', data.role);

        // Verify the newly issued token against Spring Security before showing
        // the admin/customer application. This catches role/token mismatches early.
        const auth = await request('/auth/me');
        if (!auth.authorities?.includes(data.role)) {
          clearLogin();
          throw new Error('Login role verification failed. Please login again.');
        }

        setLoggedIn(true);
      } catch (err) {
        setMessage(err.message);
      }
    }

    return (
      <div className="login-page">
        <form className="card login-card" onSubmit={login}>
          <div className="brand-mark">A</div>
          <p className="eyebrow">AMC BANK · DIGITAL BANKING</p>
          <h1>Welcome back</h1>
          <p className="muted">Sign in to your secure banking workspace.</p>
          <label>Sign in as</label>
          <div className="role-picker">
            <button type="button" className={loginRole === 'CUSTOMER' ? 'role-choice selected' : 'role-choice'} onClick={() => setLoginRole('CUSTOMER')}>Customer</button>
            <button type="button" className={loginRole === 'ADMIN' ? 'role-choice selected' : 'role-choice'} onClick={() => setLoginRole('ADMIN')}>Administrator</button>
          </div>
          <label>{loginRole === 'CUSTOMER' ? 'Email address' : 'Admin username'}</label>
          <input type={loginRole === 'CUSTOMER' ? 'email' : 'text'} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          {message && <p className="error">{message}</p>}
          <button className="sign-in">Sign in securely</button>
          <p className="login-note">Protected access · Demo banking portal</p>
        
        </form>
      </div>
    );
  }

  function logout() {
    clearLogin();
    setLoggedIn(false);
  }

  const role = localStorage.getItem('amc_role') || '';
  const usernameFromLogin = localStorage.getItem('amc_username') || '';

  if (role === 'ROLE_CUSTOMER') {
    return <CustomerApplication username={usernameFromLogin} role={role} onLogout={logout} />;
  }

  if (role === 'ROLE_ADMIN') {
    return <AdminApplication username={usernameFromLogin || 'admin'} role={role} onLogout={logout} />;
  }

  // A stale/invalid role in localStorage must never be treated as admin.
  clearLogin();
  return (
    <div className="login-page">
      <div className="card login-card">
        <h2>Session reset</h2>
        <p className="error">Invalid saved role. Refresh the page and login again.</p>
      </div>
    </div>
  );
}

function AdminApplication({ username, role, onLogout }) {
  const [view, setView] = useState('dashboard');
  const [stats, setStats] = useState({ customers: 0, activeAccounts: 0, activeLoans: 0 });
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [customerLoans, setCustomerLoans] = useState([]);
  const [allLoans, setAllLoans] = useState([]);
  const [productRequests, setProductRequests] = useState([]);
  const [productModule, setProductModule] = useState('INSURANCE');
  const [activityCustomerId, setActivityCustomerId] = useState('');
  const [activityTransactions, setActivityTransactions] = useState([]);
  const [activityAccounts, setActivityAccounts] = useState([]);
  const [allBankAccounts, setAllBankAccounts] = useState([]);
  const [transactionAction, setTransactionAction] = useState({ type: 'DEPOSIT', accountId: '', destinationId: '', amount: '' });
  const [loanCustomerId, setLoanCustomerId] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [customerForm, setCustomerForm] = useState({
    name: '', email: '', city: '', panNumber: '', initialPassword: ''
  });
  const [panError, setPanError] = useState('');
  const [accountForm, setAccountForm] = useState({ type: 'SAVINGS', balance: 0 });
  const [loanForm, setLoanForm] = useState({
    type: 'HOME', principal: 10000, interestRate: 8, tenureMonths: 12
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadDashboard();
    loadCustomers('');
  }, []);

  async function run(action) {
    setMessage('');
    try {
      await action();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function loadDashboard() {
    setStats(await request('/dashboard'));
  }

  async function loadCustomers(text = search) {
    const data = await request(`/customers?search=${encodeURIComponent(text)}`);
    setCustomers(data);
    return data;
  }

  async function openLoansModule() {
    setView('loans');
    await run(async () => {
      const [customerData, loanData] = await Promise.all([
        request('/customers?search='),
        request('/loans')
      ]);
      setCustomers(customerData);
      setAllLoans(loanData);
      if (!loanCustomerId && customerData.length > 0) {
        setLoanCustomerId(String(customerData[0].id));
      }
      setView('loans');
    });
  }


  async function openProductModule(type = 'INSURANCE') {
    setProductModule(type);
    setView('products');
    await run(async () => { setProductRequests(await request('/product-requests')); setView('products'); });
  }
  async function setProductStatus(id, status) {
    await run(async () => {
      await request(`/product-requests/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      setProductRequests(await request('/product-requests'));
      setMessage(`Request ${status.toLowerCase()} successfully`);
    });
  }
  async function openTransactionsModule(customerId = activityCustomerId) {
    setView('activity');
    await run(async () => {
      const customerData = await request('/customers?search=');
      setCustomers(customerData);
      const nextId = customerData.some(c => String(c.id) === String(customerId))
        ? String(customerId)
        : String(customerData[0]?.id || '');
      setActivityCustomerId(nextId);
      if (nextId) await loadActivityCustomer(nextId, customerData);
      else {
        setActivityTransactions([]);
        setActivityAccounts([]);
        setAllBankAccounts([]);
      }
      setView('activity');
    });
  }

  async function loadActivityCustomer(customerId, customerData = customers) {
    if (!customerId) return;
    const [transactionData, accountData, accountGroups] = await Promise.all([
      request(`/customers/${customerId}/transactions`),
      request(`/customers/${customerId}/accounts`),
      Promise.all(customerData.map(c => request(`/customers/${c.id}/accounts`)))
    ]);
    setActivityCustomerId(String(customerId));
    setActivityTransactions(transactionData);
    setActivityAccounts(accountData);
    setAllBankAccounts(accountGroups.flatMap((group, index) => group.map(a => ({
      ...a, customerName: customerData[index].name
    }))));
    setTransactionAction(current => ({
      ...current,
      accountId: accountData.some(a => String(a.id) === current.accountId)
        ? current.accountId : String(accountData[0]?.id || ''),
      destinationId: ''
    }));
  }

  async function performAdminTransaction(e) {
    e.preventDefault();
    await run(async () => {
      const { type, accountId, destinationId, amount } = transactionAction;
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error('Enter an amount greater than zero');
      if (!accountId) throw new Error('Open an account before making a transaction');
      if (type === 'TRANSFER' && !destinationId) throw new Error('Choose a destination account');
      if (type === 'TRANSFER') {
        await request(`/accounts/transfer?fromAccountId=${accountId}&toAccountId=${destinationId}&amount=${encodeURIComponent(amount)}`, { method: 'POST' });
      } else {
        await request(`/accounts/${accountId}/${type.toLowerCase()}?amount=${encodeURIComponent(amount)}`, { method: 'POST' });
      }
      await loadActivityCustomer(activityCustomerId);
      setTransactionAction(current => ({ ...current, amount: '' }));
      setMessage(type === 'TRANSFER' ? 'Transfer completed successfully' : `${type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} completed successfully`);
      await loadDashboard();
    });
  }

  async function openAccountFromActivity() {
    const customer = customers.find(c => String(c.id) === activityCustomerId);
    if (customer) await openCustomer(customer);
  }

  function emptyCustomerForm() {
    return { name: '', email: '', city: '', panNumber: '', initialPassword: '' };
  }

  async function saveCustomer(e) {
    e.preventDefault();
    const normalizedPan = normalizePan(customerForm.panNumber);
    if (!PAN_PATTERN.test(normalizedPan)) {
      setPanError('PAN must contain exactly 10 characters. Example: ABCPD1234E (P is the holder type).');
      return;
    }
    setPanError('');
    await run(async () => {
      const submittedCustomer = { ...customerForm, panNumber: normalizedPan };
      if (editingId) {
        const { initialPassword, ...updateData } = submittedCustomer;
        await request(`/customers/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(updateData)
        });
      } else {
        await request('/customers', {
          method: 'POST',
          body: JSON.stringify(submittedCustomer)
        });
      }
      setEditingId(null);
      setCustomerForm(emptyCustomerForm());
      await loadCustomers();
      await loadDashboard();
      setMessage(editingId
        ? 'Customer updated successfully'
        : 'Customer and login created successfully');
    });
  }

  function editCustomer(customer) {
    setEditingId(customer.id);
    setCustomerForm({
      name: customer.name,
      email: customer.email,
      city: customer.city || '',
      panNumber: customer.panNumber,
      initialPassword: ''
    });
    setView('customers');
  }

  async function deleteCustomer(id) {
    if (!confirm('Delete this customer and customer login?')) return;
    await run(async () => {
      await request(`/customers/${id}`, { method: 'DELETE' });
      await loadCustomers();
      await loadDashboard();
      setMessage('Customer and login deleted');
    });
  }

  async function openCustomer(customer) {
    await run(async () => {
      setSelectedCustomer(customer);
      setAccounts(await request(`/customers/${customer.id}/accounts`));
      setCustomerLoans(await request(`/customers/${customer.id}/loans`));
      setView('customer');
    });
  }

  async function openAccount(e) {
    e.preventDefault();
    await run(async () => {
      await request(`/customers/${selectedCustomer.id}/accounts`, {
        method: 'POST',
        body: JSON.stringify({ ...accountForm, balance: Number(accountForm.balance) })
      });
      setAccounts(await request(`/customers/${selectedCustomer.id}/accounts`));
      await loadDashboard();
      setMessage('Account opened successfully');
    });
  }

  async function money(accountId, operation) {
    const amount = prompt(`Enter amount to ${operation}:`);
    if (!amount) return;
    await run(async () => {
      await request(`/accounts/${accountId}/${operation}?amount=${encodeURIComponent(amount)}`, {
        method: 'POST'
      });
      setAccounts(await request(`/customers/${selectedCustomer.id}/accounts`));
      setMessage(`${operation} completed`);
    });
  }

  function loanPayload() {
    return {
      ...loanForm,
      principal: Number(loanForm.principal),
      interestRate: Number(loanForm.interestRate),
      tenureMonths: Number(loanForm.tenureMonths)
    };
  }

  async function sanctionLoanForCustomer(customerId) {
    await request(`/customers/${customerId}/loans`, {
      method: 'POST',
      body: JSON.stringify(loanPayload())
    });
  }

  async function sanctionLoanFromCustomer(e) {
    e.preventDefault();
    await run(async () => {
      await sanctionLoanForCustomer(selectedCustomer.id);
      setCustomerLoans(await request(`/customers/${selectedCustomer.id}/loans`));
      await loadDashboard();
      setMessage('Loan sanctioned successfully');
    });
  }

  async function sanctionLoanFromModule(e) {
    e.preventDefault();
    await run(async () => {
      if (!loanCustomerId) throw new Error('Please select a customer');
      await sanctionLoanForCustomer(loanCustomerId);
      setAllLoans(await request('/loans'));
      await loadDashboard();
      setMessage('Loan sanctioned successfully');
    });
  }

  return (
    <div>
      <Header username={username} role={role} onLogout={onLogout}>
        <button className="nav-button" onClick={() => { setView('dashboard'); loadDashboard(); }}>Dashboard</button>
        <button className="nav-button" onClick={() => { setView('customers'); run(() => loadCustomers()); }}>Customers</button>
        <button className="nav-button" onClick={() => openTransactionsModule()}>Transactions</button>
        <button className="nav-button loan-nav" onClick={openLoansModule}>Loans</button>
<button className="nav-button" onClick={() => openProductModule('INSURANCE')}>Insurance</button>
<button className="nav-button" onClick={() => openProductModule('CREDIT_CARD')}>Credit Cards</button>
<button className="nav-button" onClick={() => openProductModule('FIXED_DEPOSIT')}>Fixed Deposits</button>
      </Header>

      <main>
        <Message text={message} />

        {view === 'dashboard' && (
          <section>
            <h2>Admin Dashboard</h2>
            <div className="stats">
              <Stat title="Customers" value={stats.customers} />
              <Stat title="Active Accounts" value={stats.activeAccounts} />
              <Stat title="Active Loans" value={stats.activeLoans} />
            </div>
            <div className="card module-banner activity-banner">
              <div>
                <h3>Account Activity & Statements</h3>
                <p>Review a customer’s deposits, withdrawals, and account history. Filter and export statements as CSV.</p>
              </div>
              <button onClick={() => openTransactionsModule()}>Open Transactions</button>
            </div>
            <div className="card module-banner customer-login-banner">
              <div>
                <h3>Customer Login Facility</h3>
                <p>When adding a customer, create the first password. The customer's email becomes the login ID.</p>
              </div>
              <button onClick={() => setView('customers')}>Create Customer Login</button>
            </div>
            <div className="card module-banner">
              <div>
                <h3>Loan Module</h3>
                <p>Sanction HOME, CAR and PERSONAL loans, calculate EMI and view all sanctioned loans.</p>
              </div>
              <button onClick={openLoansModule}>Open Loan Module</button>
            </div>
          </section>
        )}

        {view === 'customers' && (
          <section>
            <h2>Customers</h2>
            <div className="grid-2">
              <div className="card">
                <h3>{editingId ? 'Edit Customer' : 'Add Customer + Create Login'}</h3>
                <form onSubmit={saveCustomer}>
                  <label>Name</label>
                  <input placeholder="Name" value={customerForm.name} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} required />
                  <label>Email / Customer Login ID</label>
                  <input type="email" placeholder="customer@example.com" value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} required />
                  <label>City</label>
                  <input placeholder="City" value={customerForm.city} onChange={e => setCustomerForm({ ...customerForm, city: e.target.value })} />
                  <label>PAN Number</label>
                  <input aria-invalid={Boolean(panError)} aria-describedby="pan-help" placeholder="Example: ABCPD1234E" maxLength="10" autoCapitalize="characters" autoComplete="off" pattern="[A-Za-z]{3}[ABCFGHLJPTabcfghljpt][A-Za-z][0-9]{4}[A-Za-z]" title="PAN must be 10 characters, e.g. ABCPD1234E. The 4th character is the holder type." onInvalid={e => e.currentTarget.setCustomValidity('PAN must be 10 characters: 5 letters, 4 digits, then 1 letter. Use a valid holder type in position 4, e.g. ABCPD1234E.')} value={customerForm.panNumber} onChange={e => { e.currentTarget.setCustomValidity(''); setPanError(''); setCustomerForm({ ...customerForm, panNumber: normalizePan(e.target.value) }); }} required />
                  <span id="pan-help" className={panError ? 'field-error' : 'hint'}>{panError || `PAN has ${customerForm.panNumber.length}/10 characters. Format: 5 letters, 4 digits, 1 letter (example: ABCPD1234E).`}</span>
                  {!editingId && (
                    <>
                      <label>First Login Password</label>
                      <input
                        type="password"
                        minLength="8"
                        maxLength="64"
                        placeholder="Minimum 6 characters"
                        value={customerForm.initialPassword}
                        onChange={e => setCustomerForm({ ...customerForm, initialPassword: e.target.value })}
                        required
                      />
                      <p className="hint">Give this temporary/first password to the customer. The customer can change it after login.</p>
                    </>
                  )}
                  {editingId && <p className="hint">Changing the email also changes the customer's login ID. Password is not changed here.</p>}
                  <div className="actions">
                    <button>{editingId ? 'Update Customer' : 'Create Customer + Login'}</button>
                    {editingId && (
                      <button type="button" className="secondary" onClick={() => { setEditingId(null); setCustomerForm(emptyCustomerForm()); }}>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="card">
                <h3>Search</h3>
                <div className="actions">
                  <input placeholder="Name or city" value={search} onChange={e => setSearch(e.target.value)} />
                  <button onClick={() => loadCustomers()}>Search</button>
                  <button className="secondary" onClick={() => { setSearch(''); loadCustomers(''); }}>Clear</button>
                </div>
                <hr />
                <p><strong>Customer login rule</strong></p>
                <p className="muted">Login ID = customer's email address. Password = first password entered by the admin.</p>
              </div>
            </div>

            <div className="card table-wrap">
              <table>
                <thead><tr><th>ID</th><th>Name</th><th>Login Email</th><th>City</th><th>PAN</th><th>Actions</th></tr></thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id}>
                      <td>{c.id}</td><td>{c.name}</td><td>{c.email}</td><td>{c.city}</td><td>{c.panNumber}</td>
                      <td className="actions">
                        <button onClick={() => openCustomer(c)}>Profile &amp; Products</button>
                        <button className="secondary" onClick={() => editCustomer(c)}>Edit</button>
                        <button className="danger" onClick={() => deleteCustomer(c.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {customers.length === 0 && <tr><td colSpan="6">No customers found.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {view === 'loans' && (
          <section>
            <div className="module-title">
              <div><h2>Loan Module</h2><p className="muted">Sanction a loan and view all loans.</p></div>
              <span className="module-badge">{allLoans.length} loan(s)</span>
            </div>

            <div className="grid-2">
              <div className="card">
                <h3>Sanction New Loan</h3>
                {customers.length === 0 ? <p>Add a customer first.</p> : (
                  <form onSubmit={sanctionLoanFromModule}>
                    <label>Customer</label>
                    <select value={loanCustomerId} onChange={e => setLoanCustomerId(e.target.value)} required>
                      <option value="">Select Customer</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.email}</option>)}
                    </select>
                    <LoanFields loanForm={loanForm} setLoanForm={setLoanForm} />
                    <button>Sanction Loan</button>
                  </form>
                )}
              </div>
              <LoanRules />
            </div>

            <div className="card table-wrap">
              <div className="actions between"><h3>All Loans</h3><button className="secondary" onClick={openLoansModule}>Refresh</button></div>
              <LoanTable loans={allLoans} showCustomer />
            </div>
          </section>
        )}


        {view === 'products' && (
          <section><div className="module-title"><div><h2>{productModule === 'INSURANCE' ? 'Insurance Applications' : productModule === 'CREDIT_CARD' ? 'Credit Card Applications' : 'Fixed Deposit Applications'}</h2><p className="muted">Review customer product applications and update their status.</p></div><button className="secondary" onClick={() => openProductModule(productModule)}>Refresh</button></div>
            <div className="card table-wrap"><table><thead><tr><th>Customer</th><th>Product</th><th>Amount / Cover</th><th>Term</th><th>Requested</th><th>Status</th><th>Actions</th></tr></thead><tbody>{productRequests.filter(r => r.productType === productModule).map(r => <tr key={r.id}><td>{r.customerName} · {r.customerEmail}</td><td>{r.productType.replace('_', ' ')}{r.productName ? ` · ${r.productName}` : ''}</td><td>₹{Number(r.amount).toLocaleString('en-IN')}</td><td>{r.termMonths ? `${r.termMonths} months` : '—'}</td><td>{String(r.createdAt || '').replace('T', ' ')}</td><td>{r.status}</td><td className="actions">{r.status === 'PENDING' && <><button onClick={() => setProductStatus(r.id, 'APPROVED')}>Approve</button><button className="danger" onClick={() => setProductStatus(r.id, 'DECLINED')}>Decline</button></>}</td></tr>)}{productRequests.filter(r => r.productType === productModule).length === 0 && <tr><td colSpan="7">No applications in this module yet.</td></tr>}</tbody></table></div>
          </section>
        )}
        {view === 'activity' && (
          <section>
            <div className="module-title">
              <div><h2>Account Activity</h2><p className="muted">Select a customer to review and export their transaction statement.</p></div>
              <span className="module-badge">{activityTransactions.length} transaction(s)</span>
            </div>
            <div className="card statement-filters admin-activity-filters">
              <label>Customer<select value={activityCustomerId} onChange={e => openTransactionsModule(e.target.value)}>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}
              </select></label>
              <button className="secondary" onClick={() => openTransactionsModule()}>Refresh</button>
              <button onClick={openAccountFromActivity}>Open Account for this Customer</button>
            </div>
            <div className="card">
              <h3>Make a transaction</h3>
              {activityAccounts.length === 0 ? (
                <p className="muted">This customer has no account yet. Open an account above to enable deposits, withdrawals, and transfers.</p>
              ) : (
                <form className="transaction-form" onSubmit={performAdminTransaction}>
                  <label>Action<select value={transactionAction.type} onChange={e => setTransactionAction({ ...transactionAction, type: e.target.value })}>
                    <option value="DEPOSIT">Deposit</option><option value="WITHDRAW">Withdraw</option><option value="TRANSFER">Transfer to another account</option>
                  </select></label>
                  <label>From account<select value={transactionAction.accountId} onChange={e => setTransactionAction({ ...transactionAction, accountId: e.target.value })} required>
                    {activityAccounts.map(a => <option key={a.id} value={a.id}>{a.accountNumber} · {a.type} · Available ₹{Number(a.balance || 0).toLocaleString('en-IN')}</option>)}
                  </select></label>
                  {transactionAction.type === 'TRANSFER' && <label>To account<select value={transactionAction.destinationId} onChange={e => setTransactionAction({ ...transactionAction, destinationId: e.target.value })} required>
                    <option value="">Select recipient account</option>
                    {allBankAccounts.filter(a => String(a.id) !== transactionAction.accountId && a.status === 'ACTIVE').map(a => <option key={a.id} value={a.id}>{a.customerName} · {a.accountNumber} · {a.type}</option>)}
                  </select></label>}
                  <label>Amount (₹)<input type="number" min="0.01" step="0.01" value={transactionAction.amount} onChange={e => setTransactionAction({ ...transactionAction, amount: e.target.value })} placeholder="0.00" required /></label>
                  <button>{transactionAction.type === 'DEPOSIT' ? 'Deposit funds' : transactionAction.type === 'WITHDRAW' ? 'Withdraw funds' : 'Transfer funds'}</button>
                </form>
              )}
            </div>
            <div className="card table-wrap">
              <div className="actions between"><h3>Customer Transactions</h3><button onClick={() => downloadStatement(activityTransactions)}>Download CSV</button></div>
              <TransactionTable transactions={activityTransactions} />
            </div>
          </section>
        )}

        {view === 'customer' && selectedCustomer && (
          <section>
            <div className="actions between">
              <div>
                <h2>{selectedCustomer.name}</h2>
                <p className="muted">Customer login: {selectedCustomer.email}</p>
              </div>
              <button className="secondary" onClick={() => setView('customers')}>Back</button>
            </div>

            <div className="grid-2">
              <div className="card">
                <h3>Open Account</h3>
                <form onSubmit={openAccount}>
                  <label>Account Type</label>
                  <select value={accountForm.type} onChange={e => setAccountForm({ ...accountForm, type: e.target.value })}>
                    <option>SAVINGS</option><option>CURRENT</option>
                  </select>
                  <label>Opening Balance</label>
                  <input type="number" min="0" value={accountForm.balance} onChange={e => setAccountForm({ ...accountForm, balance: e.target.value })} />
                  <button>Open Account</button>
                </form>
              </div>
              <div className="card">
                <h3>Sanction Loan</h3>
                <form onSubmit={sanctionLoanFromCustomer}>
                  <LoanFields loanForm={loanForm} setLoanForm={setLoanForm} />
                  <button>Sanction Loan</button>
                </form>
              </div>
            </div>

            <div className="card table-wrap">
              <h3>Accounts</h3>
              <AccountTable accounts={accounts} showActions onMoney={money} />
            </div>
            <div className="card table-wrap">
              <h3>Customer Loans</h3>
              <LoanTable loans={customerLoans} />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function CustomerApplication({ username, role, onLogout }) {
  const [view, setView] = useState('dashboard');
  const [profile, setProfile] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loans, setLoans] = useState([]);
  const [productRequests, setProductRequests] = useState([]);
  const [productForm, setProductForm] = useState({ productType: 'INSURANCE', productName: 'Health Insurance', amount: '', termMonths: '', notes: '' });
  const [transactions, setTransactions] = useState([]);
  const [transactionFilter, setTransactionFilter] = useState({ type: 'ALL', from: '', to: '' });
  const [transferForm, setTransferForm] = useState({ fromAccountId: '', toAccountNumber: '', amount: '' });
  const [newAccountForm, setNewAccountForm] = useState({ type: 'SAVINGS', balance: '0' });
  const [message, setMessage] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  useEffect(() => {
    loadMyData();
  }, []);

  async function run(action) {
    setMessage('');
    try {
      await action();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function loadMyData() {
    await run(async () => {
      const [profileData, accountData, loanData, transactionData] = await Promise.all([
        request('/customer/me'),
        request('/customer/me/accounts'),
        request('/customer/me/loans'),
        request('/customer/me/transactions')
      ]);
      setProfile(profileData);
      setAccounts(accountData);
      setLoans(loanData);
      setTransactions(transactionData);
    });
  }


  async function openCustomerProducts(type = 'INSURANCE') {
    setView('products');
    const name = type === 'INSURANCE' ? 'Health Insurance' : type === 'CREDIT_CARD' ? 'Classic Credit Card' : 'Fixed Deposit';
    setProductForm(current => ({ ...current, productType: type, productName: name }));
    await run(async () => { setProductRequests(await request('/customer/me/products')); setView('products'); });
  }
  async function submitProductRequest(e) {
    e.preventDefault();
    await run(async () => {
      const payload = { ...productForm, amount: Number(productForm.amount), termMonths: productForm.termMonths ? Number(productForm.termMonths) : null };
      if (!(payload.amount > 0)) throw new Error('Enter an amount greater than zero');
      await request('/customer/me/products', { method: 'POST', body: JSON.stringify(payload) });
      setProductRequests(await request('/customer/me/products'));
      setProductForm({ productType: 'INSURANCE', productName: 'Health Insurance', amount: '', termMonths: '', notes: '' });
      setMessage('Application submitted successfully');
    });
  }
  async function changePassword(e) {
    e.preventDefault();
    await run(async () => {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error('New password and confirm password do not match');
      }
      await request('/customer/me/password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage('Password changed successfully');
    });
  }

  async function customerMoney(accountId, operation) {
    const account = accounts.find(a => a.id === accountId);
    if (!account) {
      setMessage('Account not found');
      return;
    }

    const balanceText = Number(account.balance || 0).toLocaleString();
    const input = window.prompt(
      operation === 'withdraw'
        ? `Available balance: ₹${balanceText}\nEnter amount to withdraw:`
        : `Current balance: ₹${balanceText}\nEnter amount to deposit:`
    );

    if (input === null) return;

    const amount = Number(input);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage('Amount must be greater than zero');
      return;
    }

    // Friendly browser-side check. The backend repeats this check using BigDecimal,
    // so the balance rule cannot be bypassed by changing the React code.
    if (operation === 'withdraw' && amount > Number(account.balance || 0)) {
      setMessage(`Withdrawal denied. Available balance is ₹${balanceText}`);
      return;
    }

    await run(async () => {
      await request(`/customer/me/accounts/${accountId}/${operation}?amount=${encodeURIComponent(input)}`, {
        method: 'POST'
      });
      const updatedAccounts = await request('/customer/me/accounts');
      setAccounts(updatedAccounts);
      setMessage(operation === 'deposit'
        ? 'Deposit completed successfully'
        : 'Withdrawal completed successfully');
    });
  }

  async function transferBetweenMyAccounts(e) {
    e.preventDefault();
    await run(async () => {
      const { fromAccountId, toAccountNumber, amount } = transferForm;
      if (!fromAccountId || !toAccountNumber.trim()) throw new Error('Select a source account and enter the recipient account number');
      if (accounts.find(a => String(a.id) === fromAccountId)?.accountNumber === toAccountNumber.trim().toUpperCase()) throw new Error('Choose a different recipient account');
      if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new Error('Enter an amount greater than zero');
      await request(`/customer/me/transfers?fromAccountId=${fromAccountId}&toAccountNumber=${encodeURIComponent(toAccountNumber.trim())}&amount=${encodeURIComponent(amount)}`, { method: 'POST' });
      const [accountData, transactionData] = await Promise.all([
        request('/customer/me/accounts'), request('/customer/me/transactions')
      ]);
      setAccounts(accountData);
      setTransactions(transactionData);
      setTransferForm({ fromAccountId: '', toAccountNumber: '', amount: '' });
      setMessage('Transfer completed successfully');
    });
  }

  async function openMyAccount(e) {
    e.preventDefault();
    await run(async () => {
      const balance = Number(newAccountForm.balance || 0);
      if (!Number.isFinite(balance) || balance < 0) throw new Error('Opening balance cannot be negative');
      await request('/customer/me/accounts', {
        method: 'POST',
        body: JSON.stringify({ type: newAccountForm.type, balance })
      });
      await loadMyData();
      setMessage('New account opened successfully');
    });
  }

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const activeLoans = loans.filter(l => l.status === 'ACTIVE').length;
  const filteredTransactions = transactions.filter(t => {
    const typeMatches = transactionFilter.type === 'ALL' || t.type === transactionFilter.type;
    const day = String(t.createdAt || '').slice(0, 10);
    return typeMatches && (!transactionFilter.from || day >= transactionFilter.from)
      && (!transactionFilter.to || day <= transactionFilter.to);
  });

  return (
    <div>
      <Header username={username} role={role} onLogout={onLogout}>
        <button className="nav-button" onClick={() => setView('dashboard')}>My Dashboard</button>
        <button className="nav-button" onClick={() => setView('accounts')}>My Accounts</button>
        <button className="nav-button" onClick={() => setView('transactions')}>Statements</button>
        <button className="nav-button loan-nav" onClick={() => setView('loans')}>My Loans</button>
<button className="nav-button" onClick={() => openCustomerProducts('INSURANCE')}>Insurance</button>
<button className="nav-button" onClick={() => openCustomerProducts('CREDIT_CARD')}>Credit Cards</button>
<button className="nav-button" onClick={() => openCustomerProducts('FIXED_DEPOSIT')}>Fixed Deposits</button>
        <button className="nav-button" onClick={() => setView('password')}>Change Password</button>
      </Header>

      <main>
        <Message text={message} />

        {view === 'dashboard' && (
          <section>
            <h2>Customer Dashboard</h2>
            <div className="welcome-card card">
              <h3>Welcome{profile ? `, ${profile.name}` : ''}</h3>
              <p>This dashboard shows only your own AMC Bank information.</p>
            </div>
            <div className="stats">
              <Stat title="My Accounts" value={accounts.length} />
              <Stat title="Total Balance" value={`₹${totalBalance.toLocaleString()}`} />
              <Stat title="Active Loans" value={activeLoans} />
            </div>
            {profile && (
              <div className="card">
                <h3>My Profile</h3>
                <div className="profile-grid">
                  <div><span>Name</span><strong>{profile.name}</strong></div>
                  <div><span>Email / Login ID</span><strong>{profile.email}</strong></div>
                  <div><span>City</span><strong>{profile.city || '-'}</strong></div>
                  <div><span>PAN</span><strong>{profile.panNumber}</strong></div>
                </div>
              </div>
            )}
          </section>
        )}

        {view === 'accounts' && (
          <section>
            <h2>My Accounts</h2>
            <div className="card">
              <h3>Open a new account</h3>
              <form className="transaction-form" onSubmit={openMyAccount}>
                <label>Account type<select value={newAccountForm.type} onChange={e => setNewAccountForm({ ...newAccountForm, type: e.target.value })}><option value="SAVINGS">Savings</option><option value="CURRENT">Current</option></select></label>
                <label>Opening deposit (₹)<input type="number" min="0" step="0.01" value={newAccountForm.balance} onChange={e => setNewAccountForm({ ...newAccountForm, balance: e.target.value })} required /></label>
                <button>Open account</button>
              </form>
              <p className="hint">Your new account will be linked to your customer profile and appear below when opened.</p>
            </div>
            <div className="card">
              <h3>Deposit / Withdraw</h3>
              <p className="muted">Use the buttons beside your account. Withdrawal is allowed only when the requested amount is less than or equal to the available balance.</p>
            </div>
            <div className="card table-wrap">
              <AccountTable accounts={accounts} showActions onMoney={customerMoney} />
            </div>
            <div className="card">
              <h3>Transfer to another AMC Bank account</h3>
              {accounts.length === 0 ? <p className="muted">Open an account before making a transfer.</p> : (
                <form className="transaction-form" onSubmit={transferBetweenMyAccounts}>
                  <label>From account<select value={transferForm.fromAccountId} onChange={e => setTransferForm({ ...transferForm, fromAccountId: e.target.value })} required><option value="">Select source account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.accountNumber} · Available ₹{Number(a.balance || 0).toLocaleString('en-IN')}</option>)}</select></label>
                  <label>Recipient account number<input value={transferForm.toAccountNumber} onChange={e => setTransferForm({ ...transferForm, toAccountNumber: e.target.value.toUpperCase() })} placeholder="ACXXXXXXXX" autoComplete="off" required /></label>
                  <label>Amount (₹)<input type="number" min="0.01" step="0.01" value={transferForm.amount} onChange={e => setTransferForm({ ...transferForm, amount: e.target.value })} placeholder="0.00" required /></label>
                  <button>Transfer funds</button>
                </form>
              )}
            </div>
            <p className="hint">For security, you can transact only on accounts linked to your own customer login. The backend validates account ownership and available balance.</p>
          </section>
        )}

        {view === 'transactions' && (
          <section>
            <div className="module-title">
              <div><h2>Account Statements</h2><p className="muted">Review deposits, withdrawals, and account activity across your accounts.</p></div>
              <button className="secondary" onClick={() => run(async () => setTransactions(await request('/customer/me/transactions')))}>Refresh</button>
            </div>
            <div className="card statement-filters">
              <label>Activity type<select value={transactionFilter.type} onChange={e => setTransactionFilter({ ...transactionFilter, type: e.target.value })}>
                <option value="ALL">All activity</option><option value="DEPOSIT">Deposits</option><option value="WITHDRAWAL">Withdrawals</option><option value="TRANSFER_OUT">Transfers sent</option><option value="TRANSFER_IN">Transfers received</option><option value="ACCOUNT_OPENED">Account opened</option>
              </select></label>
              <label>From<input type="date" value={transactionFilter.from} onChange={e => setTransactionFilter({ ...transactionFilter, from: e.target.value })} /></label>
              <label>To<input type="date" value={transactionFilter.to} onChange={e => setTransactionFilter({ ...transactionFilter, to: e.target.value })} /></label>
              <button className="secondary" onClick={() => setTransactionFilter({ type: 'ALL', from: '', to: '' })}>Clear filters</button>
            </div>
            <div className="card table-wrap">
              <div className="actions between"><h3>Transactions</h3><button onClick={() => downloadStatement(filteredTransactions)}>Download CSV</button></div>
              <TransactionTable transactions={filteredTransactions} />
            </div>
          </section>
        )}

        {view === 'loans' && (
          <section>
            <h2>My Loans</h2>
            <div className="card table-wrap">
              <LoanTable loans={loans} />
            </div>
            <p className="hint">Customers can view their own loans and EMI. Loan sanctioning remains an admin operation.</p>
          </section>
        )}


        {view === 'products' && (
          <section><h2>Explore Bank Products</h2><div className="grid-2"><div className="card"><h3>Apply for a product</h3><form onSubmit={submitProductRequest}>
            <label>Product type<select value={productForm.productType} onChange={e => setProductForm({ ...productForm, productType: e.target.value, productName: e.target.value === 'INSURANCE' ? 'Health Insurance' : e.target.value === 'CREDIT_CARD' ? 'Classic Credit Card' : 'Fixed Deposit' })}><option value="INSURANCE">Insurance</option><option value="CREDIT_CARD">Credit Card</option><option value="FIXED_DEPOSIT">Fixed Deposit</option></select></label>
            <label>Product<select value={productForm.productName} onChange={e => setProductForm({ ...productForm, productName: e.target.value })}>{productForm.productType === 'INSURANCE' ? <><option>Health Insurance</option><option>Life Insurance</option><option>Motor Insurance</option><option>Travel Insurance</option></> : productForm.productType === 'CREDIT_CARD' ? <><option>Classic Credit Card</option><option>Rewards Credit Card</option><option>Travel Credit Card</option></> : <><option>Fixed Deposit</option><option>Tax Saver Deposit</option></>}</select></label>
            <label>{productForm.productType === 'INSURANCE' ? 'Coverage requested (₹)' : productForm.productType === 'CREDIT_CARD' ? 'Requested credit limit (₹)' : 'Deposit amount (₹)'}<input type="number" min="1" step="0.01" value={productForm.amount} onChange={e => setProductForm({ ...productForm, amount: e.target.value })} required /></label>
            {productForm.productType !== 'CREDIT_CARD' && <label>{productForm.productType === 'INSURANCE' ? 'Policy term (months)' : 'Deposit term (months)'}<input type="number" min="1" max="600" value={productForm.termMonths} onChange={e => setProductForm({ ...productForm, termMonths: e.target.value })} required /></label>}
            <label>Notes (optional)<input value={productForm.notes} onChange={e => setProductForm({ ...productForm, notes: e.target.value })} maxLength="250" /></label><button>Submit application</button>
          </form><p className="hint">Applications are saved for bank review. A fixed deposit application is not funded until the bank approves and books it.</p></div>
          <div className="card"><div className="actions between"><h3>My applications</h3><button className="secondary" onClick={openCustomerProducts}>Refresh</button></div><div className="table-wrap"><table><thead><tr><th>Product</th><th>Amount</th><th>Term</th><th>Status</th></tr></thead><tbody>{productRequests.map(r => <tr key={r.id}><td>{r.productType.replace('_', ' ')} · {r.productName}</td><td>₹{Number(r.amount).toLocaleString('en-IN')}</td><td>{r.termMonths ? `${r.termMonths} mo` : '—'}</td><td>{r.status}</td></tr>)}{productRequests.length === 0 && <tr><td colSpan="4">No applications yet.</td></tr>}</tbody></table></div></div></div></section>
        )}
        {view === 'password' && (
          <section className="narrow-section">
            <h2>Change Password</h2>
            <div className="card">
              <p className="muted">Enter the first/current password created by the admin, then choose your new password.</p>
              <form onSubmit={changePassword}>
                <label>Current Password</label>
                <input type="password" value={passwordForm.currentPassword} onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} required />
                <label>New Password</label>
                <input type="password" minLength="8" maxLength="64" autoComplete="new-password" value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required />
                <label>Confirm New Password</label>
                <input type="password" minLength="8" maxLength="64" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} required />
                <button>Change Password</button>
              </form>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Header({ username, role, onLogout, children }) {
  return (
    <header>
      <div><strong>AMC Bank</strong> <span className="muted-light">{username} · {role}</span></div>
      <nav>{children}<button className="nav-button" onClick={onLogout}>Logout</button></nav>
    </header>
  );
}

function Message({ text }) {
  if (!text) return null;
  const good = text.toLowerCase().includes('success') || text.includes('completed') || text.includes('deleted');
  return <div className={good ? 'success' : 'error-box'}>{text}</div>;
}

function Stat({ title, value }) {
  return <div className="card stat"><div className="stat-value">{value}</div><div>{title}</div></div>;
}

function LoanFields({ loanForm, setLoanForm }) {
  return (
    <>
      <label>Loan Type</label>
      <select value={loanForm.type} onChange={e => setLoanForm({ ...loanForm, type: e.target.value })}>
        <option>HOME</option><option>CAR</option><option>PERSONAL</option>
      </select>
      <label>Principal Amount</label>
      <input type="number" min="10000" value={loanForm.principal} onChange={e => setLoanForm({ ...loanForm, principal: e.target.value })} required />
      <label>Interest Rate (%)</label>
      <input type="number" min="0.1" max="50" step="0.1" value={loanForm.interestRate} onChange={e => setLoanForm({ ...loanForm, interestRate: e.target.value })} required />
      <label>Tenure (Months)</label>
      <input type="number" min="1" max="480" value={loanForm.tenureMonths} onChange={e => setLoanForm({ ...loanForm, tenureMonths: e.target.value })} required />
    </>
  );
}

function LoanRules() {
  return (
    <div className="card loan-rules">
      <h3>AMC Bank Loan Rules</h3>
      <p><strong>Rule 1:</strong> Minimum loan principal is ₹10,000.</p>
      <p><strong>Rule 2:</strong> A customer can have a maximum of 3 ACTIVE loans.</p>
      <p><strong>Rule 3:</strong> Active account balance must be at least 10% of the requested principal.</p>
    </div>
  );
}

function AccountTable({ accounts, showActions = false, onMoney }) {
  return (
    <table>
      <thead><tr><th>Account No.</th><th>Type</th><th>Balance</th><th>Status</th>{showActions && <th>Actions</th>}</tr></thead>
      <tbody>
        {accounts.map(a => (
          <tr key={a.id}>
            <td>{a.accountNumber}</td><td>{a.type}</td><td>₹{Number(a.balance).toLocaleString()}</td><td>{a.status}</td>
            {showActions && <td className="actions"><button onClick={() => onMoney(a.id, 'deposit')}>Deposit</button><button className="secondary" onClick={() => onMoney(a.id, 'withdraw')}>Withdraw</button></td>}
          </tr>
        ))}
        {accounts.length === 0 && <tr><td colSpan={showActions ? 5 : 4}>No accounts yet.</td></tr>}
      </tbody>
    </table>
  );
}

function downloadStatement(transactions) {
  const columns = ['Date and time', 'Account number', 'Activity', 'Amount', 'Balance after'];
  const rows = transactions.map(t => [t.createdAt, t.accountNumber, t.type, t.amount, t.balanceAfter]);
  const csv = [columns, ...rows].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `amc-bank-statement-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function TransactionTable({ transactions }) {
  return (
    <table>
      <thead><tr><th>Date and time</th><th>Account</th><th>Activity</th><th>Amount</th><th>Balance after</th></tr></thead>
      <tbody>
        {transactions.map(t => (
          <tr key={t.id}><td>{t.createdAt ? new Date(t.createdAt).toLocaleString() : '-'}</td><td>{t.accountNumber || '-'}</td><td><span className="activity-badge">{String(t.type || '').replaceAll('_', ' ')}</span></td><td>₹{Number(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td><td>₹{Number(t.balanceAfter || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
        ))}
        {transactions.length === 0 && <tr><td colSpan="5">No transactions match these filters.</td></tr>}
      </tbody>
    </table>
  );
}

function LoanTable({ loans, showCustomer = false }) {
  return (
    <table>
      <thead>
        <tr>{showCustomer && <th>Customer</th>}<th>Type</th><th>Principal</th><th>Rate</th><th>Months</th><th>EMI</th><th>Status</th></tr>
      </thead>
      <tbody>
        {loans.map(l => (
          <tr key={l.id}>
            {showCustomer && <td>{l.customerName || `Customer #${l.customerId}`}</td>}
            <td>{l.type}</td><td>₹{Number(l.principal).toLocaleString()}</td><td>{l.interestRate}%</td><td>{l.tenureMonths}</td><td>₹{Number(l.emi).toLocaleString()}</td><td>{l.status}</td>
          </tr>
        ))}
        {loans.length === 0 && <tr><td colSpan={showCustomer ? 7 : 6}>No loans yet.</td></tr>}
      </tbody>
    </table>
  );
}








