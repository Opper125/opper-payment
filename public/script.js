// Supabase Configuration
const supabaseUrl = 'https://vtsczzlnhsrgnbkfyizi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, { fetch: (...args) => fetch(...args) });

// Global Variables
let currentUser = null;
let userBalance = 0;
let userKycStatus = 'pending';
let transfersEnabled = true;
let currentTheme = localStorage.getItem('theme') || 'light';
let transactions = [];
let paymentProviders = {
    kpay: {
        phone: "09786284670",
        name: "DHMK"
    },
    wave: {
        phone: "09786284670",
        name: "DHMK"
    }
};

// DOM Elements
const loader = document.getElementById('loader');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const pinEntryModal = document.getElementById('pin-entry-modal');
const receiptModal = document.getElementById('receipt-modal');
const processingOverlay = document.getElementById('processing-overlay');

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    // Apply saved theme
    document.body.setAttribute('data-theme', currentTheme);
    
    // Show loader
    showLoader();
    
    // Check if user is logged in
    await checkSession();
    
    // Initialize UI elements
    initializeUI();
    
    // Hide loader after initialization
    setTimeout(hideLoader, 1500);
});

// Check if user is logged in
async function checkSession() {
    try {
        // Check local storage for session
        const session = localStorage.getItem('opperSession');
        
        if (session) {
            const sessionData = JSON.parse(session);
            const { data: user, error } = await supabase
                .from('auth_users')
                .select('*')
                .eq('email', sessionData.email)
                .eq('user_id', sessionData.user_id)
                .single();
            
            if (error || !user) {
                // Invalid session
                localStorage.removeItem('opperSession');
                showAuthContainer();
                return;
            }
            
            // Valid session, load user data
            currentUser = user;
            await loadUserData();
            showAppContainer();
        } else {
            // No session found
            showAuthContainer();
        }
    } catch (error) {
        console.error('Session check error:', error);
        showAuthContainer();
    }
}

// Load user data
async function loadUserData() {
    try {
        if (!currentUser) return;
        
        // Get user profile data
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('user_id', currentUser.user_id)
            .single();
        
        if (userError) throw userError;
        
        // Update global variables
        userBalance = userData.balance || 0;
        userKycStatus = userData.passport_status || 'pending';
        
        // Update UI with user data
        updateUserUI(userData);
        
        // Check system settings
        const { data: settings, error: settingsError } = await supabase
            .from('settings')
            .select('allow_transfers, kpay_info, wave_info')
            .eq('id', 1)
            .single();
        
        if (!settingsError && settings) {
            transfersEnabled = settings.allow_transfers;
            
            // Update payment provider information
            if (settings.kpay_info) {
                paymentProviders.kpay = settings.kpay_info;
            }
            
            if (settings.wave_info) {
                paymentProviders.wave = settings.wave_info;
            }
            
            updateTransferStatus();
        }
        
        // Set up realtime subscriptions
        setupRealtimeSubscriptions();
        
        // Load transactions
        loadTransactions();
    } catch (error) {
        console.error('Load user data error:', error);
    }
}

// Update UI with user data
function updateUserUI(userData) {
    // Update user name and ID in header and sidebar
    const userInitial = currentUser.email.charAt(0).toUpperCase();
    const userName = currentUser.email.split('@')[0];
    
    document.getElementById('user-initial').textContent = userInitial;
    document.getElementById('user-initial-sidebar').textContent = userInitial;
    document.getElementById('user-name').textContent = userName;
    document.getElementById('user-name-sidebar').textContent = userName;
    document.getElementById('user-id').textContent = `ID: ${currentUser.user_id}`;
    document.getElementById('user-id-sidebar').textContent = `ID: ${currentUser.user_id}`;
    document.getElementById('greeting-name').textContent = userName;
    
    // Update balance
    document.getElementById('user-balance').textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`;
    document.getElementById('balance-amount').textContent = `${userBalance.toLocaleString()} Ks`;
    
    // Update KYC status
    updateKycStatus();
    
    // Update settings page
    document.getElementById('settings-phone').value = userData.phone || '';
    document.getElementById('settings-email').value = currentUser.email || '';
}

// Update KYC status in UI
function updateKycStatus() {
    const kycStatusElement = document.getElementById('kyc-status');
    const kycStatusCard = document.getElementById('kyc-status-card');
    const kycForm = document.getElementById('kyc-form');
    const kycStatusMessage = document.getElementById('kyc-status-message');
    const kycStatusIcon = document.querySelector('.kyc-status-icon');
    
    // Remove all status classes
    kycStatusIcon.classList.remove('pending', 'approved', 'rejected');
    
    // Update based on status
    if (userKycStatus === 'approved') {
        kycStatusElement.textContent = 'KYC: အတည်ပြုပြီး';
        kycStatusMessage.textContent = 'သင့် KYC အတည်ပြုပြီးဖြစ်ပါသည်။';
        kycStatusIcon.classList.add('approved');
        kycStatusIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
        kycForm.style.display = 'none';
    } else if (userKycStatus === 'rejected') {
        kycStatusElement.textContent = 'KYC: ငြင်းပယ်ခံရသည်';
        kycStatusMessage.textContent = 'သင့် KYC ငြင်းပယ်ခံရပါသည်။ ပြန်လည်တင်သွင်းပါ။';
        kycStatusIcon.classList.add('rejected');
        kycStatusIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
        kycForm.style.display = 'block';
    } else {
        kycStatusElement.textContent = 'KYC: စောင့်ဆိုင်းဆဲ';
        kycStatusMessage.textContent = 'သင့် KYC စိစစ်နေဆဲဖြစ်ပါသည်။';
        kycStatusIcon.classList.add('pending');
        kycStatusIcon.innerHTML = '<i class="fas fa-clock"></i>';
        
        // Check if KYC data exists
        if (currentUser) {
            supabase
                .from('users')
                .select('passport_number, passport_image')
                .eq('user_id', currentUser.user_id)
                .single()
                .then(({ data }) => {
                    if (data && data.passport_number && data.passport_image) {
                        kycForm.style.display = 'none';
                    } else {
                        kycForm.style.display = 'block';
                    }
                });
        }
    }
}

// Update transfer status in UI
function updateTransferStatus() {
    const transferStatusElement = document.getElementById('transfer-status');
    
    if (transfersEnabled) {
        transferStatusElement.textContent = 'ငွေလွှဲခြင်း: ခွင့်ပြုထားသည်';
        transferStatusElement.classList.remove('disabled');
        transferStatusElement.classList.add('enabled');
    } else {
        transferStatusElement.textContent = 'ငွေလွှဲခြင်း: ပိတ်ထားသည်';
        transferStatusElement.classList.remove('enabled');
        transferStatusElement.classList.add('disabled');
    }
}

// Set up realtime subscriptions
function setupRealtimeSubscriptions() {
    // Subscribe to user balance changes
    const userChannel = supabase
        .channel('user-updates')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'users',
            filter: `user_id=eq.${currentUser.user_id}`
        }, (payload) => {
            // Update balance if changed
            if (payload.new.balance !== userBalance) {
                userBalance = payload.new.balance;
                document.getElementById('user-balance').textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`;
                document.getElementById('balance-amount').textContent = `${userBalance.toLocaleString()} Ks`;
            }
            
            // Update KYC status if changed
            if (payload.new.passport_status !== userKycStatus) {
                userKycStatus = payload.new.passport_status;
                updateKycStatus();
            }
        })
        .subscribe();
    
    // Subscribe to system settings changes
    const settingsChannel = supabase
        .channel('settings-updates')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'settings'
        }, (payload) => {
            if (payload.new.allow_transfers !== transfersEnabled) {
                transfersEnabled = payload.new.allow_transfers;
                updateTransferStatus();
            }
            
            // Update payment provider information
            if (payload.new.kpay_info) {
                paymentProviders.kpay = payload.new.kpay_info;
            }
            
            if (payload.new.wave_info) {
                paymentProviders.wave = payload.new.wave_info;
            }
        })
        .subscribe();
    
    // Subscribe to new transactions
    const transactionsChannel = supabase
        .channel('transactions-updates')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions'
        }, (payload) => {
            // Check if transaction involves current user
            if (currentUser && (payload.new.from_phone === currentUser.phone || payload.new.to_phone === currentUser.phone)) {
                // Refresh transactions list
                loadTransactions();
            }
        })
        .subscribe();
}

// Load transactions
async function loadTransactions() {
    try {
        if (!currentUser) return;
        
        // Get user phone number
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('phone')
            .eq('user_id', currentUser.user_id)
            .single();
        
        if (userError || !userData || !userData.phone) return;
        
        const userPhone = userData.phone;
        
        // Get recent transactions
        const { data: transactionsData, error } = await supabase
            .from('transactions')
            .select('*')
            .or(`from_phone.eq.${userPhone},to_phone.eq.${userPhone}`)
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        // Store transactions globally
        transactions = transactionsData || [];
        
        // Update UI with transactions
        updateTransactionsUI(transactions, userPhone);
    } catch (error) {
        console.error('Load transactions error:', error);
    }
}

// Update transactions UI
function updateTransactionsUI(transactions, userPhone) {
    const recentTransactionsList = document.getElementById('recent-transactions-list');
    const historyTransactionsList = document.getElementById('history-transactions-list');
    
    // Clear lists
    recentTransactionsList.innerHTML = '';
    historyTransactionsList.innerHTML = '';
    
    if (!transactions || transactions.length === 0) {
        // Show empty state
        const emptyState = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>လုပ်ဆောင်ချက်မှတ်တမ်းမရှိသေးပါ</p>
            </div>
        `;
        recentTransactionsList.innerHTML = emptyState;
        historyTransactionsList.innerHTML = emptyState;
        return;
    }
    
    // Create transaction items
    transactions.forEach((transaction, index) => {
        const isSender = transaction.from_phone === userPhone;
        const otherParty = isSender ? transaction.to_phone : transaction.from_phone;
        const transactionDate = new Date(transaction.created_at).toLocaleString();
        
        const transactionItem = `
            <div class="transaction-item ${isSender ? 'sent' : 'received'} ${transaction.status === 'pending' ? 'pending' : ''}">
                <div class="transaction-icon">
                    <i class="fas ${transaction.status === 'pending' ? 'fa-clock' : isSender ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-header">
                        <h4 class="transaction-title">
                            ${transaction.status === 'pending' 
                                ? `ဆိုင်းငံ့ထားသော ${transaction.type === 'deposit' ? 'ငွေသွင်းမှု' : 'ငွေထုတ်မှု'}`
                                : transaction.type === 'deposit' ? 'ငွေသွင်းခြင်း' : 'ငွေထုတ်ခြင်း'
                            }
                        </h4>
                        <span class="transaction-amount ${transaction.type === 'deposit' ? 'deposit' : 'withdraw'}">
                            ${transaction.type === 'deposit' ? '+' : '-'}${parseFloat(transaction.amount).toLocaleString()} Ks
                        </span>
                    </div>
                    <div class="transaction-meta">
                        <span class="transaction-payment">
                            ${transaction.payment_method.toUpperCase()} - 
                            ${transaction.type === 'deposit' 
                                ? paymentProviders[transaction.payment_method].phone 
                                : transaction.recipient_phone
                            }
                        </span>
                        <span class="transaction-date">${transactionDate}</span>
                    </div>
                    ${transaction.status === 'pending' ? `
                        <div class="transaction-status">
                            <span class="status-badge">စောင့်ဆိုင်းဆဲ</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Add to recent transactions (first 5)
        if (index < 5) {
            recentTransactionsList.innerHTML += transactionItem;
        }
        
        // Add to history transactions (all)
        historyTransactionsList.innerHTML += transactionItem;
    });
}

// Initialize UI elements
function initializeUI() {
    // Auth tabs
    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            authTabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Hide all forms
            authForms.forEach(form => form.classList.remove('active'));
            // Show corresponding form
            const formId = tab.getAttribute('data-tab') + '-form';
            document.getElementById(formId).classList.add('active');
        });
    });
    
    // Password toggles
    const togglePasswordBtns = document.querySelectorAll('.toggle-password');
    
    togglePasswordBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.parentElement.querySelector('input');
            if (input.type === 'password') {
                input.type = 'text';
                btn.classList.remove('fa-eye-slash');
                btn.classList.add('fa-eye');
            } else {
                input.type = 'password';
                btn.classList.remove('fa-eye');
                btn.classList.add('fa-eye-slash');
            }
        });
    });
    
    // Sidebar toggle
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const closeSidebar = document.getElementById('close-sidebar');
    
    if (menuToggle && sidebar && closeSidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.add('active');
        });
        
        closeSidebar.addEventListener('click', () => {
            sidebar.classList.remove('active');
        });
    }
    
    // Navigation links
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    const pages = document.querySelectorAll('.page');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(l => l.parentElement.classList.remove('active'));
            // Add active class to clicked link
            link.parentElement.classList.add('active');
            
            // Hide all pages
            pages.forEach(page => page.classList.remove('active'));
            
            // Show corresponding page
            const pageId = link.getAttribute('data-page') + '-page';
            document.getElementById(pageId).classList.add('active');
            
            // Close sidebar on mobile
            if (window.innerWidth < 768) {
                sidebar.classList.remove('active');
            }
        });
    });
    
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            if (currentTheme === 'light') {
                document.body.setAttribute('data-theme', 'dark');
                currentTheme = 'dark';
            } else {
                document.body.setAttribute('data-theme', 'light');
                currentTheme = 'light';
            }
            
            localStorage.setItem('theme', currentTheme);
        });
    }
    
    // Balance hide/show
    const hideBalanceBtn = document.getElementById('hide-balance');
    const balanceAmount = document.getElementById('balance-amount');
    
    if (hideBalanceBtn && balanceAmount) {
        let isHidden = false;
        
        hideBalanceBtn.addEventListener('click', () => {
            if (isHidden) {
                balanceAmount.textContent = userBalance.toLocaleString() + ' Ks';
                hideBalanceBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                balanceAmount.textContent = '********';
                hideBalanceBtn.innerHTML = '<i class="fas fa-eye"></i>';
            }
            
            isHidden = !isHidden;
        });
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Set up PIN inputs
    setupPinInputs();
    
    // Set up form submissions
    setupFormSubmissions();
    
    // Setup KPay and Wave payment modals
    setupPaymentModals();
}

// Setup PIN inputs
function setupPinInputs() {
    const pinInputs = document.querySelectorAll('.pin-input');
    
    pinInputs.forEach((input, index) => {
        // Handle input
        input.addEventListener('input', () => {
            if (input.value.length === 1) {
                // Move to next input
                if (index < pinInputs.length - 1) {
                    pinInputs[index + 1].focus();
                }
            }
        });
        
        // Handle backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value) {
                // Move to previous input
                if (index > 0) {
                    pinInputs[index - 1].focus();
                }
            }
        });
        
        // Handle paste
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const paste = e.clipboardData.getData('text');
            
            if (paste.length === pinInputs.length && /^\d+$/.test(paste)) {
                pinInputs.forEach((pinInput, i) => {
                    pinInput.value = paste[i];
                });
            }
        });
    });
    
    // Pin confirm button
    const pinConfirmBtn = document.getElementById('pin-confirm');
    
    if (pinConfirmBtn) {
        pinConfirmBtn.addEventListener('click', () => {
            // Collect PIN
            let pin = '';
            pinInputs.forEach(input => {
                pin += input.value;
            });
            
            // Validate PIN
            if (pin.length !== pinInputs.length) {
                document.getElementById('pin-error').textContent = 'ကျေးဇူးပြု၍ ပင်နံပါတ် အပြည့်ထည့်ပါ။';
                document.getElementById('pin-error').style.display = 'block';
                return;
            }
            
            // Process transfer
            pinEntryModal.classList.remove('active');
            processTransfer(pin);
        });
    }
}

// Setup form submissions
function setupFormSubmissions() {
    // Login form
    const loginBtn = document.getElementById('login-btn');
    
    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorElement = document.getElementById('login-error');
        const successElement = document.getElementById('login-success');
        
        // Validate inputs
        if (!email || !password) {
            errorElement.textContent = 'အီးမေးလ်နှင့် စကားဝှက် ထည့်ပါ။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        // Show loader
        showProcessing();
        
        try {
            // Authenticate with Supabase
            const { data: user, error } = await supabase
                .from('auth_users')
                .select('*')
                .eq('email', email)
                .single();
            
            if (error || !user) {
                throw new Error('အီးမေးလ် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်။');
            }
            
            // Simple password check (in real app, use proper hashing)
            if (user.password !== password) {
                throw new Error('အီးမေးလ် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်။');
            }
            
            // Save session
            localStorage.setItem('opperSession', JSON.stringify({
                email: user.email,
                user_id: user.user_id
            }));
            
            // Show success
            successElement.textContent = 'အကောင့်ဝင်ရောက်ခြင်း အောင်မြင်ပါသည်။ ရွှေ့ပြောင်းနေသည်...';
            successElement.style.display = 'block';
            errorElement.style.display = 'none';
            
            // Load user data and show app
            currentUser = user;
            await loadUserData();
            setTimeout(() => {
                hideProcessing();
                showAppContainer();
            }, 1000);
        } catch (error) {
            // Show error
            errorElement.textContent = error.message;
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            hideProcessing();
        }
    });
    
    // Signup form
    const signupBtn = document.getElementById('signup-btn');
    
    signupBtn.addEventListener('click', async () => {
        const email = document.getElementById('signup-email').value;
        const phone = document.getElementById('signup-phone').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;
        const termsAgree = document.getElementById('terms-agree').checked;
        const errorElement = document.getElementById('signup-error');
        const successElement = document.getElementById('signup-success');
        
        // Validate inputs
        if (!email || !phone || !password || !confirmPassword) {
            errorElement.textContent = 'ကျေးဇူးပြု၍ ဖြည့်စွက်ရန် လိုအပ်သည့် အချက်အလက်များအားလုံး ဖြည့်စွက်ပါ။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        if (password !== confirmPassword) {
            errorElement.textContent = 'စကားဝှက်နှင့် အတည်ပြုစကားဝှက် မတူညီပါ။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        if (!termsAgree) {
            errorElement.textContent = 'စည်းမျဉ်းစည်းကမ်းများကို သဘောတူရန် လိုအပ်ပါသည်။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        // Show loader
        showProcessing();
        
        try {
            // Check if email already exists
            const { data: existingUser, error: checkError } = await supabase
                .from('auth_users')
                .select('email')
                .eq('email', email)
                .single();
            
            if (existingUser) {
                throw new Error('ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။');
            }
            
            // Generate user ID
            const userId = generateUserId(email);
            
            // Create auth user
            const { data: authUser, error: createAuthError } = await supabase
                .from('auth_users')
                .insert([
                    {
                        email,
                        password,
                        user_id: userId
                    }
                ])
                .select()
                .single();
            
            if (createAuthError) throw createAuthError;
            
            // Create user profile
            const { data: userProfile, error: createProfileError } = await supabase
                .from('users')
                .insert([
                    {
                        user_id: userId,
                        email,
                        phone,
                        balance: 0,
                        passport_status: 'pending'
                    }
                ])
                .select()
                .single();
            
            if (createProfileError) throw createProfileError;
            
            // Show success
            successElement.textContent = 'အကောင့်ဖွင့်ခြင်း အောင်မြင်ပါသည်။ အကောင့်ဝင်ရန် ဆက်လုပ်ပါ။';
            successElement.style.display = 'block';
            errorElement.style.display = 'none';
            
            // Clear form
            document.getElementById('signup-email').value = '';
            document.getElementById('signup-phone').value = '';
            document.getElementById('signup-password').value = '';
            document.getElementById('signup-confirm-password').value = '';
            document.getElementById('terms-agree').checked = false;
            
            // Switch to login tab
            document.querySelector('.auth-tab[data-tab="login"]').click();
            
            hideProcessing();
        } catch (error) {
            // Show error
            errorElement.textContent = error.message;
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            hideProcessing();
        }
    });
    
    // Google login
    const googleLoginBtn = document.getElementById('google-login-btn');
    const googleSignupBtn = document.getElementById('google-signup-btn');
    
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => simulateGoogleLogin('login'));
    }
    
    if (googleSignupBtn) {
        googleSignupBtn.addEventListener('click', () => simulateGoogleLogin('signup'));
    }
    
    // Transfer form
    const transferForm = document.getElementById('transfer-form');
    
    if (transferForm) {
        transferForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const phone = document.getElementById('transfer-phone').value;
            const amount = document.getElementById('transfer-amount').value;
            const errorElement = document.getElementById('transfer-error');
            
            // Validate inputs
            if (!phone || !amount) {
                errorElement.textContent = 'ဖုန်းနံပါတ်နှင့် ပမာဏ ထည့်ပါ။';
                errorElement.style.display = 'block';
                return;
            }
            
            // Validate phone number
            if (!/^(09|\+?959)\d{7,9}$/.test(phone)) {
                errorElement.textContent = 'မှန်ကန်သော ဖုန်းနံပါတ် ထည့်ပါ။';
                errorElement.style.display = 'block';
                return;
            }
            
            // Validate amount
            const amountValue = parseFloat(amount);
            if (isNaN(amountValue) || amountValue <= 0) {
                errorElement.textContent = 'မှန်ကန်သော ပမာဏ ထည့်ပါ။';
                errorElement.style.display = 'block';
                return;
            }
            
            // Check if amount is greater than balance
            if (amountValue > userBalance) {
                errorElement.textContent = 'လက်ကျန်ငွေ မလုံလောက်ပါ။';
                errorElement.style.display = 'block';
                return;
            }
            
            // Clear error
            errorElement.style.display = 'none';
            
            // Show PIN entry modal
            showPinEntryModal();
        });
    }
    
    // KYC form
    const kycForm = document.getElementById('kyc-form');
    
    if (kycForm) {
        kycForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const passportNumber = document.getElementById('passport-number').value;
            const passportFile = document.getElementById('passport-file').files[0];
            const errorElement = document.getElementById('kyc-error');
            const successElement = document.getElementById('kyc-success');
            
            // Validate inputs
            if (!passportNumber || !passportFile) {
                errorElement.textContent = 'ကျေးဇူးပြု၍ နိုင်ငံသားကဒ်နံပါတ်နှင့် ပုံတင်ပါ။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            // Show loader
            showProcessing();
            
            try {
                // Upload passport image
                const filePath = `passports/${currentUser.user_id}_${Date.now()}`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('documents')
                    .upload(filePath, passportFile);
                
                if (uploadError) throw uploadError;
                
                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('documents')
                    .getPublicUrl(filePath);
                
                // Update user profile
                const { error: updateError } = await supabase
                    .from('users')
                    .update({
                        passport_number: passportNumber,
                        passport_image: urlData.publicUrl
                    })
                    .eq('user_id', currentUser.user_id);
                
                if (updateError) throw updateError;
                
                // Show success
                successElement.textContent = 'KYC အချက်အလက်များ အောင်မြင်စွာ တင်သွင်းပြီးပါပြီ။ စစ်ဆေးပြီး မကြာမီ အတည်ပြုပေးပါမည်။';
                successElement.style.display = 'block';
                errorElement.style.display = 'none';
                
                // Hide form
                kycForm.style.display = 'none';
                
                hideProcessing();
            } catch (error) {
                // Show error
                errorElement.textContent = error.message;
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                hideProcessing();
            }
        });
    }
    
    // Settings form
    const settingsForm = document.getElementById('settings-form');
    
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const phone = document.getElementById('settings-phone').value;
            const currentPassword = document.getElementById('settings-current-password').value;
            const newPassword = document.getElementById('settings-new-password').value;
            const errorElement = document.getElementById('settings-error');
            const successElement = document.getElementById('settings-success');
            
            // Validate current password if changing password
            if (newPassword && !currentPassword) {
                errorElement.textContent = 'ကျေးဇူးပြု၍ လက်ရှိစကားဝှက် ထည့်ပါ။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            // Show loader
            showProcessing();
            
            try {
                // Update phone number
                if (phone && phone !== currentUser.phone) {
                    const { error: phoneError } = await supabase
                        .from('users')
                        .update({ phone })
                        .eq('user_id', currentUser.user_id);
                    
                    if (phoneError) throw phoneError;
                }
                
                // Update password
                if (newPassword && currentPassword) {
                    // Verify current password
                    const { data: userData, error: userError } = await supabase
                        .from('auth_users')
                        .select('password')
                        .eq('user_id', currentUser.user_id)
                        .single();
                    
                    if (userError) throw userError;
                    
                    if (userData.password !== currentPassword) {
                        throw new Error('လက်ရှိစကားဝှက် မှားယွင်းနေပါသည်။');
                    }
                    
                    // Update password
                    const { error: passwordError } = await supabase
                        .from('auth_users')
                        .update({ password: newPassword })
                        .eq('user_id', currentUser.user_id);
                    
                    if (passwordError) throw passwordError;
                }
                
                // Show success
                successElement.textContent = 'ဆက်တင်များ အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ။';
                successElement.style.display = 'block';
                errorElement.style.display = 'none';
                
                // Clear password fields
                document.getElementById('settings-current-password').value = '';
                document.getElementById('settings-new-password').value = '';
                
                hideProcessing();
            } catch (error) {
                // Show error
                errorElement.textContent = error.message;
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                hideProcessing();
            }
        });
    }
}

// Setup KPay and Wave payment modals for deposits and withdrawals
function setupPaymentModals() {
    // Get the deposit and withdraw buttons
    const depositBtn = document.querySelector('.deposit-btn');
    const withdrawBtn = document.querySelector('.withdraw-btn');
    
    if (depositBtn) {
        depositBtn.addEventListener('click', () => {
            showDepositModal();
        });
    }
    
    if (withdrawBtn) {
        withdrawBtn.addEventListener('click', () => {
            showWithdrawModal();
        });
    }
}

// Show deposit modal
function showDepositModal() {
    const modal = document.createElement('div');
    modal.className = 'modal deposit-modal active';
    modal.id = 'deposit-modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">ငွေသွင်းရန်</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="deposit-steps">
                    <div class="step-indicator active">1</div>
                    <div class="step-line"></div>
                    <div class="step-indicator">2</div>
                    <div class="step-line"></div>
                    <div class="step-indicator">3</div>
                </div>
                
                <div class="step-content active" id="deposit-step-1">
                    <h3 class="step-title">ငွေလွှဲနည်း ရွေးချယ်ပါ</h3>
                    <div class="payment-methods">
                        <div class="payment-method" data-method="kpay">
                            <img src="https://raw.githubusercontent.com/Opper125/opper-payment/main/kpay-logo.png" alt="KPay Logo" class="payment-logo">
                            <span class="payment-name">KPay</span>
                        </div>
                        <div class="payment-method" data-method="wave">
                            <img src="https://raw.githubusercontent.com/Opper125/opper-payment/main/wave-logo.png" alt="Wave Logo" class="payment-logo">
                            <span class="payment-name">Wave</span>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-block" id="deposit-next-1" disabled>
                        <span>ရှေ့ဆက်ရန်</span>
                        <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
                
                <div class="step-content" id="deposit-step-2">
                    <h3 class="step-title">ငွေလွှဲရန် အချက်အလက်</h3>
                    <div class="payment-info">
                        <div class="info-item">
                            <span class="info-label">ငွေလွှဲနည်း:</span>
                            <span class="info-value" id="deposit-method-display">KPay</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">ဖုန်းနံပါတ်:</span>
                            <span class="info-value" id="deposit-phone-display">09786284670</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">အမည်:</span>
                            <span class="info-value" id="deposit-name-display">DHMK</span>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="deposit-amount">ငွေလွှဲမည့် ပမာဏ</label>
                        <div class="input-with-icon">
                            <input type="number" id="deposit-amount" placeholder="ပမာဏ ရိုက်ထည့်ပါ" min="10000" max="1000000">
                            <span class="input-suffix">Ks</span>
                        </div>
                        <p class="input-hint">အနည်းဆုံး 10,000 Ks မှ အများဆုံး 1,000,000 Ks အထိ</p>
                    </div>
                    
                    <div class="form-actions">
                        <button class="btn btn-outline" id="deposit-back-2">
                            <i class="fas fa-arrow-left"></i>
                            <span>နောက်သို့</span>
                        </button>
                        <button class="btn btn-primary" id="deposit-next-2">
                            <span>ရှေ့ဆက်ရန်</span>
                            <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
                
                <div class="step-content" id="deposit-step-3">
                    <h3 class="step-title">ဖြတ်ပိုင်းတင်ရန်</h3>
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i>
                        <span>ကျေးဇူးပြု၍ ပေးပို့ထားသော အချက်အလက်အတိုင်း ငွေလွှဲပြီးမှ ဆက်လက်လုပ်ဆောင်ပါ</span>
                    </div>
                    
                    <div class="upload-area" id="receipt-upload-area">
                        <input type="file" id="receipt-file" accept="image/*" hidden>
                        <div class="upload-placeholder">
                            <i class="fas fa-cloud-upload-alt"></i>
                            <p>ဖြတ်ပိုင်းပုံအား ဆွဲတင်ပါ သို့မဟုတ် ရွေးချယ်ပါ</p>
                            <span class="upload-hint">PNG, JPG, JPEG (အများဆုံး 5MB)</span>
                        </div>
                        <div class="upload-preview" id="receipt-preview" style="display: none;">
                            <img id="receipt-image" src="" alt="Receipt Preview">
                            <button class="remove-upload" id="remove-receipt">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="deposit-note">မှတ်ချက် (ရွေးချယ်နိုင်)</label>
                        <textarea id="deposit-note" placeholder="မှတ်ချက် ရိုက်ထည့်ပါ" rows="3"></textarea>
                    </div>
                    
                    <div class="form-actions">
                        <button class="btn btn-outline" id="deposit-back-3">
                            <i class="fas fa-arrow-left"></i>
                            <span>နောက်သို့</span>
                        </button>
                        <button class="btn btn-primary" id="deposit-submit">
                            <span>တင်ပြမည်</span>
                            <i class="fas fa-check"></i>
                        </button>
                    </div>
                </div>
                
                <div class="step-content" id="deposit-success">
                    <div class="success-animation">
                        <div class="success-icon">
                            <i class="fas fa-check"></i>
                        </div>
                        <h3 class="success-title">ငွေသွင်းရန် တင်ပြပြီးပါပြီ</h3>
                        <p class="success-message">သင့်ငွေသွင်းမှုကို စစ်ဆေးပြီး မကြာမီ အတည်ပြုပေးပါမည်</p>
                    </div>
                    
                    <button class="btn btn-primary btn-block" id="deposit-done">
                        <span>ပြီးပါပြီ</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Setup event listeners
    setupDepositModalEvents();
}

// Show withdraw modal
function showWithdrawModal() {
    const modal = document.createElement('div');
    modal.className = 'modal withdraw-modal active';
    modal.id = 'withdraw-modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">ငွေထုတ်ရန်</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="withdraw-steps">
                    <div class="step-indicator active">1</div>
                    <div class="step-line"></div>
                    <div class="step-indicator">2</div>
                    <div class="step-line"></div>
                    <div class="step-indicator">3</div>
                </div>
                
                <div class="step-content active" id="withdraw-step-1">
                    <h3 class="step-title">ငွေလွှဲနည်း ရွေးချယ်ပါ</h3>
                    <div class="payment-methods">
                        <div class="payment-method" data-method="kpay">
                            <img src="https://raw.githubusercontent.com/Opper125/opper-payment/main/kpay-logo.png" alt="KPay Logo" class="payment-logo">
                            <span class="payment-name">KPay</span>
                        </div>
                        <div class="payment-method" data-method="wave">
                            <img src="https://raw.githubusercontent.com/Opper125/opper-payment/main/wave-logo.png" alt="Wave Logo" class="payment-logo">
                            <span class="payment-name">Wave</span>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-block" id="withdraw-next-1" disabled>
                        <span>ရှေ့ဆက်ရန်</span>
                        <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
                
                <div class="step-content" id="withdraw-step-2">
                    <h3 class="step-title">ငွေထုတ်ရန် အချက်အလက်</h3>
                    
                    <div class="balance-info">
                        <span class="balance-label">လက်ကျန်ငွေ:</span>
                        <span class="balance-value" id="withdraw-balance-display">${userBalance.toLocaleString()} Ks</span>
                    </div>
                    
                    <div class="form-group">
                        <label for="withdraw-phone">ငွေလက်ခံမည့် ဖုန်းနံပါတ်</label>
                        <div class="input-with-icon">
                            <i class="fas fa-phone"></i>
                            <input type="tel" id="withdraw-phone" placeholder="09xxxxxxxxx">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="withdraw-name">အကောင့်အမည်</label>
                        <div class="input-with-icon">
                            <i class="fas fa-user"></i>
                            <input type="text" id="withdraw-name" placeholder="အမည်ထည့်ပါ">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="withdraw-amount">ငွေထုတ်မည့် ပမာဏ</label>
                        <div class="input-with-icon">
                            <input type="number" id="withdraw-amount" placeholder="ပမာဏ ရိုက်ထည့်ပါ" min="10000" max="1000000">
                            <span class="input-suffix">Ks</span>
                        </div>
                        <p class="input-hint">အနည်းဆုံး 10,000 Ks မှ အများဆုံး 1,000,000 Ks အထိ</p>
                    </div>
                    
                    <div class="form-actions">
                        <button class="btn btn-outline" id="withdraw-back-2">
                            <i class="fas fa-arrow-left"></i>
                            <span>နောက်သို့</span>
                        </button>
                        <button class="btn btn-primary" id="withdraw-next-2">
                            <span>ရှေ့ဆက်ရန်</span>
                            <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
                
                <div class="step-content" id="withdraw-step-3">
                    <h3 class="step-title">ငွေထုတ်မှု အတည်ပြုခြင်း</h3>
                    
                    <div class="confirmation-details">
                        <div class="info-item">
                            <span class="info-label">ငွေလွှဲနည်း:</span>
                            <span class="info-value" id="withdraw-method-confirm">KPay</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">ဖုန်းနံပါတ်:</span>
                            <span class="info-value" id="withdraw-phone-confirm"></span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">အကောင့်အမည်:</span>
                            <span class="info-value" id="withdraw-name-confirm"></span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">ပမာဏ:</span>
                            <span class="info-value" id="withdraw-amount-confirm">0 Ks</span>
                        </div>
                    </div>
                    
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>သင်၏ ငွေထုတ်ယူမှုကို စစ်ဆေးအတည်ပြုပြီးမှ သင့်ဖုန်းထဲသို့ ငွေရောက်ရှိမည်ဖြစ်ပါသည်</span>
                    </div>
                    
                    <div class="form-actions">
                        <button class="btn btn-outline" id="withdraw-back-3">
                            <i class="fas fa-arrow-left"></i>
                            <span>နောက်သို့</span>
                        </button>
                        <button class="btn btn-primary" id="withdraw-submit">
                            <span>တင်ပြမည်</span>
                            <i class="fas fa-check"></i>
                        </button>
                    </div>
                </div>
                
                <div class="step-content" id="withdraw-success">
                    <div class="success-animation">
                        <div class="success-icon">
                            <i class="fas fa-check"></i>
                        </div>
                        <h3 class="success-title">ငွေထုတ်ရန် တင်ပြပြီးပါပြီ</h3>
                        <p class="success-message">သင့်ငွေထုတ်မှုကို စစ်ဆေးပြီး မကြာမီ အတည်ပြုပေးပါမည်</p>
                    </div>
                    
                    <button class="btn btn-primary btn-block" id="withdraw-done">
                        <span>ပြီးပါပြီ</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Setup event listeners
    setupWithdrawModalEvents();
}

// Setup deposit modal events
function setupDepositModalEvents() {
    const modal = document.getElementById('deposit-modal');
    const closeBtn = modal.querySelector('.modal-close');
    const paymentMethods = modal.querySelectorAll('.payment-method');
    const nextBtn1 = document.getElementById('deposit-next-1');
    const nextBtn2 = document.getElementById('deposit-next-2');
    const backBtn2 = document.getElementById('deposit-back-2');
    const backBtn3 = document.getElementById('deposit-back-3');
    const submitBtn = document.getElementById('deposit-submit');
    const doneBtn = document.getElementById('deposit-done');
    const uploadArea = document.getElementById('receipt-upload-area');
    const receiptFile = document.getElementById('receipt-file');
    const receiptPreview = document.getElementById('receipt-preview');
    const receiptImage = document.getElementById('receipt-image');
    const removeReceiptBtn = document.getElementById('remove-receipt');
    
    // Selected payment method
    let selectedMethod = null;
    
    // Close modal
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    // Select payment method
    paymentMethods.forEach(method => {
        method.addEventListener('click', () => {
            // Remove active class from all methods
            paymentMethods.forEach(m => m.classList.remove('active'));
            
            // Add active class to selected method
            method.classList.add('active');
            
            // Store selected method
            selectedMethod = method.getAttribute('data-method');
            
            // Enable next button
            nextBtn1.disabled = false;
        });
    });
    
    // Next button 1
    nextBtn1.addEventListener('click', () => {
        // Update payment info display
        document.getElementById('deposit-method-display').textContent = selectedMethod === 'kpay' ? 'KPay' : 'Wave';
        document.getElementById('deposit-phone-display').textContent = paymentProviders[selectedMethod].phone;
        document.getElementById('deposit-name-display').textContent = paymentProviders[selectedMethod].name;
        
        // Show step 2
        document.getElementById('deposit-step-1').classList.remove('active');
        document.getElementById('deposit-step-2').classList.add('active');
        
        // Update step indicators
        const stepIndicators = modal.querySelectorAll('.step-indicator');
        stepIndicators[0].classList.remove('active');
        stepIndicators[0].classList.add('completed');
        stepIndicators[1].classList.add('active');
    });
    
    // Back button 2
    backBtn2.addEventListener('click', () => {
        // Show step 1
        document.getElementById('deposit-step-2').classList.remove('active');
        document.getElementById('deposit-step-1').classList.add('active');
        
        // Update step indicators
        const stepIndicators = modal.querySelectorAll('.step-indicator');
        stepIndicators[0].classList.add('active');
        stepIndicators[0].classList.remove('completed');
        stepIndicators[1].classList.remove('active');
    });
    
    // Next button 2
    nextBtn2.addEventListener('click', () => {
        const amount = document.getElementById('deposit-amount').value;
        
        // Validate amount
        if (!amount || isNaN(parseFloat(amount))) {
            alert('ကျေးဇူးပြု၍ မှန်ကန်သော ပမာဏ ထည့်သွင်းပါ');
            return;
        }
        
        const amountValue = parseFloat(amount);
        if (amountValue < 10000 || amountValue > 1000000) {
            alert('ပမာဏသည် 10,000 Ks နှင့် 1,000,000 Ks ကြား ဖြစ်ရမည်');
            return;
        }
        
        // Show step 3
        document.getElementById('deposit-step-2').classList.remove('active');
        document.getElementById('deposit-step-3').classList.add('active');
        
        // Update step indicators
        const stepIndicators = modal.querySelectorAll('.step-indicator');
        stepIndicators[1].classList.remove('active');
        stepIndicators[1].classList.add('completed');
        stepIndicators[2].classList.add('active');
    });
    
    // Back button 3
    backBtn3.addEventListener('click', () => {
        // Show step 2
        document.getElementById('deposit-step-3').classList.remove('active');
        document.getElementById('deposit-step-2').classList.add('active');
        
        // Update step indicators
        const stepIndicators = modal.querySelectorAll('.step-indicator');
        stepIndicators[1].classList.add('active');
        stepIndicators[1].classList.remove('completed');
        stepIndicators[2].classList.remove('active');
    });
    
    // Upload receipt
    uploadArea.addEventListener('click', () => {
        receiptFile.click();
    });
    
    receiptFile.addEventListener('change', event => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('ဖိုင်အရွယ်အစားသည် 5MB ထက်မကျော်လွန်ရပါ');
                receiptFile.value = '';
                return;
            }
            
            // Create preview
            const reader = new FileReader();
            reader.onload = e => {
                receiptImage.src = e.target.result;
                receiptPreview.style.display = 'block';
                uploadArea.querySelector('.upload-placeholder').style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Remove receipt
    removeReceiptBtn.addEventListener('click', e => {
        e.stopPropagation();
        receiptFile.value = '';
        receiptImage.src = '';
        receiptPreview.style.display = 'none';
        uploadArea.querySelector('.upload-placeholder').style.display = 'block';
    });
    
    // Submit deposit
    submitBtn.addEventListener('click', async () => {
        const amount = document.getElementById('deposit-amount').value;
        const note = document.getElementById('deposit-note').value;
        
        // Validate receipt
        if (!receiptFile.files || !receiptFile.files[0]) {
            alert('ကျေးဇူးပြု၍ ဖြတ်ပိုင်းပုံ တင်ပါ');
            return;
        }
        
        // Show loader
        showProcessing();
        
        try {
            // Upload receipt image
            const file = receiptFile.files[0];
            const filePath = `receipts/${currentUser.user_id}_${Date.now()}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file);
            
            if (uploadError) throw uploadError;
            
            // Get public URL
            const { data: urlData } = supabase.storage
                .from('documents')
                .getPublicUrl(filePath);
            
            // Get user phone
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('phone')
                .eq('user_id', currentUser.user_id)
                .single();
            
            if (userError) throw userError;
            
            // Create transaction
            const { data: transaction, error: txError } = await supabase
                .from('transactions')
                .insert([
                    {
                        user_id: currentUser.user_id,
                        type: 'deposit',
                        amount: parseFloat(amount),
                        status: 'pending',
                        payment_method: selectedMethod,
                        from_phone: userData.phone,
                        to_phone: paymentProviders[selectedMethod].phone,
                        receipt_image: urlData.publicUrl,
                        note: note || null
                    }
                ])
                .select()
                .single();
            
            if (txError) throw txError;
            
            // Hide processing
            hideProcessing();
            
            // Show success
            document.getElementById('deposit-step-3').classList.remove('active');
            document.getElementById('deposit-success').classList.add('active');
            
            // Refresh transactions
            loadTransactions();
        } catch (error) {
            console.error('Deposit error:', error);
            alert('ငွေသွင်းမှု အမှား - ' + error.message);
            hideProcessing();
        }
    });
    
    // Done button
    doneBtn.addEventListener('click', () => {
        modal.remove();
    });
}

// Setup withdraw modal events
function setupWithdrawModalEvents() {
    const modal = document.getElementById('withdraw-modal');
    const closeBtn = modal.querySelector('.modal-close');
    const paymentMethods = modal.querySelectorAll('.payment-method');
    const nextBtn1 = document.getElementById('withdraw-next-1');
    const nextBtn2 = document.getElementById('withdraw-next-2');
    const backBtn2 = document.getElementById('withdraw-back-2');
    const backBtn3 = document.getElementById('withdraw-back-3');
    const submitBtn = document.getElementById('withdraw-submit');
    const doneBtn = document.getElementById('withdraw-done');
    
    // Selected payment method
    let selectedMethod = null;
    
    // Close modal
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    // Select payment method
    paymentMethods.forEach(method => {
        method.addEventListener('click', () => {
            // Remove active class from all methods
            paymentMethods.forEach(m => m.classList.remove('active'));
            
            // Add active class to selected method
            method.classList.add('active');
            
            // Store selected method
            selectedMethod = method.getAttribute('data-method');
            
            // Enable next button
            nextBtn1.disabled = false;
        });
    });
    
    // Next button 1
    nextBtn1.addEventListener('click', () => {
        // Show step 2
        document.getElementById('withdraw-step-1').classList.remove('active');
        document.getElementById('withdraw-step-2').classList.add('active');
        
        // Update step indicators
        const stepIndicators = modal.querySelectorAll('.step-indicator');
        stepIndicators[0].classList.remove('active');
        stepIndicators[0].classList.add('completed');
        stepIndicators[1].classList.add('active');
    });
    
    // Back button 2
    backBtn2.addEventListener('click', () => {
        // Show step 1
        document.getElementById('withdraw-step-2').classList.remove('active');
        document.getElementById('withdraw-step-1').classList.add('active');
        
        // Update step indicators
        const stepIndicators = modal.querySelectorAll('.step-indicator');
        stepIndicators[0].classList.add('active');
        stepIndicators[0].classList.remove('completed');
        stepIndicators[1].classList.remove('active');
    });
    
    // Next button 2
    nextBtn2.addEventListener('click', () => {
        const phone = document.getElementById('withdraw-phone').value;
        const name = document.getElementById('withdraw-name').value;
        const amount = document.getElementById('withdraw-amount').value;
        
        // Validate inputs
        if (!phone || !name || !amount) {
            alert('ကျေးဇူးပြု၍ လိုအပ်သော အချက်အလက်များ ဖြည့်စွက်ပါ');
            return;
        }
        
        // Validate phone number
        if (!/^(09|\+?959)\d{7,9}$/.test(phone)) {
            alert('မှန်ကန်သော ဖုန်းနံပါတ် ထည့်ပါ');
            return;
        }
        
        // Validate amount
        if (!amount || isNaN(parseFloat(amount))) {
            alert('ကျေးဇူးပြု၍ မှန်ကန်သော ပမာဏ ထည့်သွင်းပါ');
            return;
        }
        
        const amountValue = parseFloat(amount);
        if (amountValue < 10000 || amountValue > 1000000) {
            alert('ပမာဏသည် 10,000 Ks နှင့် 1,000,000 Ks ကြား ဖြစ်ရမည်');
            return;
        }
        
        // Check balance
        if (amountValue > userBalance) {
            alert('လက်ကျန်ငွေ မလုံလောက်ပါ');
            return;
        }
        
        // Update confirmation display
        document.getElementById('withdraw-method-confirm').textContent = selectedMethod === 'kpay' ? 'KPay' : 'Wave';
        document.getElementById('withdraw-phone-confirm').textContent = phone;
        document.getElementById('withdraw-name-confirm').textContent = name;
        document.getElementById('withdraw-amount-confirm').textContent = parseFloat(amount).toLocaleString() + ' Ks';
        
        // Show step 3
        document.getElementById('withdraw-step-2').classList.remove('active');
        document.getElementById('withdraw-step-3').classList.add('active');
        
        // Update step indicators
        const stepIndicators = modal.querySelectorAll('.step-indicator');
        stepIndicators[1].classList.remove('active');
        stepIndicators[1].classList.add('completed');
        stepIndicators[2].classList.add('active');
    });
    
    // Back button 3
    backBtn3.addEventListener('click', () => {
        // Show step 2
        document.getElementById('withdraw-step-3').classList.remove('active');
        document.getElementById('withdraw-step-2').classList.add('active');
        
        // Update step indicators
        const stepIndicators = modal.querySelectorAll('.step-indicator');
        stepIndicators[1].classList.add('active');
        stepIndicators[1].classList.remove('completed');
        stepIndicators[2].classList.remove('active');
    });
    
    // Submit withdrawal
    submitBtn.addEventListener('click', async () => {
        const phone = document.getElementById('withdraw-phone').value;
        const name = document.getElementById('withdraw-name').value;
        const amount = document.getElementById('withdraw-amount').value;
        
        // Show loader
        showProcessing();
        
        try {
            // Get user phone
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('phone')
                .eq('user_id', currentUser.user_id)
                .single();
            
            if (userError) throw userError;
            
            // Create transaction
            const { data: transaction, error: txError } = await supabase
                .from('transactions')
                .insert([
                    {
                        user_id: currentUser.user_id,
                        type: 'withdraw',
                        amount: parseFloat(amount),
                        status: 'pending',
                        payment_method: selectedMethod,
                        from_phone: userData.phone,
                        to_phone: phone,
                        recipient_name: name,
                        note: null
                    }
                ])
                .select()
                .single();
            
            if (txError) throw txError;
            
            // Update user balance (deduct immediately, will be refunded if rejected)
            const { error: balanceError } = await supabase
                .from('users')
                .update({ balance: userBalance - parseFloat(amount) })
                .eq('user_id', currentUser.user_id);
            
            if (balanceError) throw balanceError;
            
            // Update local balance
            userBalance -= parseFloat(amount);
            document.getElementById('user-balance').textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`;
            document.getElementById('balance-amount').textContent = `${userBalance.toLocaleString()} Ks`;
            
            // Hide processing
            hideProcessing();
            
            // Show success
            document.getElementById('withdraw-step-3').classList.remove('active');
            document.getElementById('withdraw-success').classList.add('active');
            
            // Refresh transactions
            loadTransactions();
        } catch (error) {
            console.error('Withdraw error:', error);
            alert('ငွေထုတ်မှု အမှား - ' + error.message);
            hideProcessing();
        }
    });
    
    // Done button
    doneBtn.addEventListener('click', () => {
        modal.remove();
    });
}

// Show PIN entry modal
function showPinEntryModal() {
    // Clear previous PIN inputs
    document.querySelectorAll('.pin-input').forEach(input => {
        input.value = '';
    });
    
    // Clear error message
    document.getElementById('pin-error').style.display = 'none';
    
    // Show modal
    pinEntryModal.classList.add('active');
}

// Process transfer
async function processTransfer(pin) {
    const phone = document.getElementById('transfer-phone').value;
    const amount = parseInt(document.getElementById('transfer-amount').value);
    const note = document.getElementById('transfer-note').value;
    const errorElement = document.getElementById('transfer-error');
    const successElement = document.getElementById('transfer-success');
    
    // Show processing overlay
    showProcessing();
    
    try {
        // Validate PIN (in real app, verify with server)
        if (pin !== '1234') {
            throw new Error('ပင်နံပါတ် မှားယွင်းနေပါသည်။');
        }
        
        // Check if recipient exists
        const { data: recipients, error: recipientError } = await supabase
            .from('users')
            .select('user_id, phone')
            .eq('phone', phone);
        
        if (recipientError) throw recipientError;
        
        if (!recipients || recipients.length === 0) {
            throw new Error('ရည်ရွယ်ရာ ဖုန်းနံပါတ်ကို မတွေ့ပါ။');
        }
        
        const recipient = recipients[0];
        
        // Get sender phone
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('phone')
            .eq('user_id', currentUser.user_id)
            .single();
        
        if (userError) throw userError;
        
        // Create transaction
        const { data: transaction, error: txError } = await supabase
            .from('transactions')
            .insert([
                {
                    user_id: currentUser.user_id,
                    type: 'transfer',
                    amount,
                    status: 'completed',
                    payment_method: 'internal',
                    from_phone: userData.phone,
                    to_phone: phone,
                    note: note || null
                }
            ])
            .select()
            .single();
        
        if (txError) throw txError;
        
        // Update sender balance
        const { error: senderError } = await supabase
            .from('users')
            .update({ balance: userBalance - amount })
            .eq('user_id', currentUser.user_id);
        
        if (senderError) throw senderError;
        
        // Update recipient balance
        const { error: recipientUpdateError } = await supabase
            .from('users')
            .update({ 
                balance: supabase.sql`balance + ${amount}` 
            })
            .eq('user_id', recipient.user_id);
        
        if (recipientUpdateError) throw recipientUpdateError;
        
        // Update local balance
        userBalance -= amount;
        document.getElementById('user-balance').textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`;
        document.getElementById('balance-amount').textContent = `${userBalance.toLocaleString()} Ks`;
        
        // Clear form
        document.getElementById('transfer-phone').value = '';
        document.getElementById('transfer-amount').value = '';
        document.getElementById('transfer-note').value = '';
        
        // Show success
        errorElement.style.display = 'none';
        successElement.textContent = `${amount.toLocaleString()} Ks ကို ${phone} သို့ လွှဲပြောင်းပြီးပါပြီ။`;
        successElement.style.display = 'block';
        
        // Show transaction receipt
        setTimeout(() => {
            showTransactionReceipt(transaction);
        }, 1000);
        
        // Refresh transactions
        loadTransactions();
    } catch (error) {
        console.error('Transfer error:', error);
        
        // Show error
        errorElement.textContent = error.message;
        errorElement.style.display = 'block';
        successElement.style.display = 'none';
    } finally {
        hideProcessing();
    }
}

// Show transaction receipt
function showTransactionReceipt(transaction) {
    // Format transaction data
    const amount = parseInt(transaction.amount).toLocaleString();
    const date = new Date(transaction.created_at).toLocaleString();
    
    // Create receipt content
    const receiptContent = document.getElementById('receipt-content');
    receiptContent.innerHTML = `
        <div class="receipt-header">
            <img src="https://github.com/Opper125/opper-payment/raw/main/logo.png" alt="OPPER Logo" class="receipt-logo">
            <h2>ငွေလွှဲပြေစာ</h2>
        </div>
        <div class="receipt-details">
            <div class="receipt-row">
                <span class="receipt-label">အိုင်ဒီ:</span>
                <span class="receipt-value">#${transaction.id}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">ပေးပို့သူ:</span>
                <span class="receipt-value">${transaction.from_phone}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">လက်ခံသူ:</span>
                <span class="receipt-value">${transaction.to_phone}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">ပမာဏ:</span>
                <span class="receipt-value">${amount} Ks</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">ရက်စွဲ:</span>
                <span class="receipt-value">${date}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">အခြေအနေ:</span>
                <span class="receipt-value success">အောင်မြင်</span>
            </div>
        </div>
        <div class="receipt-footer">
            <div class="receipt-qr">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=OPPER${transaction.id}" alt="QR Code">
            </div>
            <p>OPPER Payment မှ ကျေးဇူးတင်ပါသည်</p>
        </div>
    `;
    
    // Show receipt modal
    receiptModal.classList.add('active');
}

// Download receipt
function downloadReceipt() {
    const receiptElement = document.getElementById('receipt-content');
    
    html2canvas(receiptElement, {
        backgroundColor: '#ffffff',
        scale: 2
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `receipt-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

// Simulate Google login (for demo)
function simulateGoogleLogin(type) {
    // Show processing overlay
    showProcessing();
    
    // Simulate API call delay
    setTimeout(async () => {
        try {
            // Generate fake Google email
            const email = `user${Math.floor(Math.random() * 1000)}@gmail.com`;
            const userId = generateUserId(email);
            
            if (type === 'signup') {
                // Check if email already exists
                const { data: existingUser, error: checkError } = await supabase
                    .from('auth_users')
                    .select('email')
                    .eq('email', email)
                    .single();
                
                if (existingUser) {
                    throw new Error('ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။');
                }
                
                // Create auth user
                const { data: authUser, error: createAuthError } = await supabase
                    .from('auth_users')
                    .insert([
                        {
                            email,
                            password: `google_${Math.random().toString(36).substring(2)}`,
                            user_id: userId
                        }
                    ])
                    .select()
                    .single();
                
                if (createAuthError) throw createAuthError;
                
                // Create user profile
                const { data: userProfile, error: createProfileError } = await supabase
                    .from('users')
                    .insert([
                        {
                            user_id: userId,
                            email,
                            phone: '',
                            balance: 0,
                            passport_status: 'pending'
                        }
                    ])
                    .select()
                    .single();
                
                if (createProfileError) throw createProfileError;
                
                // Show success
                const successElement = document.getElementById('signup-success');
                const errorElement = document.getElementById('signup-error');
                
                successElement.textContent = 'Google ဖြင့် အကောင့်ဖွင့်ခြင်း အောင်မြင်ပါသည်။ ရွှေ့ပြောင်းနေသည်...';
                successElement.style.display = 'block';
                errorElement.style.display = 'none';
                
                // Save session
                localStorage.setItem('opperSession', JSON.stringify({
                    email,
                    user_id: userId
                }));
                
                // Load user data and show app
                currentUser = authUser;
                await loadUserData();
                setTimeout(() => {
                    hideProcessing();
                    showAppContainer();
                }, 1000);
            } else {
                // Login with Google
                const { data: user, error } = await supabase
                    .from('auth_users')
                    .select('*')
                    .eq('email', email)
                    .single();
                
                if (error || !user) {
                    throw new Error('Google အကောင့်ဖြင့် အကောင့်ဖွင့်ရန် လိုအပ်ပါသည်။');
                }
                
                // Save session
                localStorage.setItem('opperSession', JSON.stringify({
                    email,
                    user_id: user.user_id
                }));
                
                // Show success
                const successElement = document.getElementById('login-success');
                const errorElement = document.getElementById('login-error');
                
                successElement.textContent = 'Google ဖြင့် အကောင့်ဝင်ရောက်ခြင်း အောင်မြင်ပါသည်။ ရွှေ့ပြောင်းနေသည်...';
                successElement.style.display = 'block';
                errorElement.style.display = 'none';
                
                // Load user data and show app
                currentUser = user;
                await loadUserData();
                setTimeout(() => {
                    hideProcessing();
                    showAppContainer();
                }, 1000);
            }
        } catch (error) {
            console.error('Google login error:', error);
            
            // Show error
            const errorElement = document.getElementById(type === 'signup' ? 'signup-error' : 'login-error');
            const successElement = document.getElementById(type === 'signup' ? 'signup-success' : 'login-success');
            
            errorElement.textContent = error.message;
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            
            hideProcessing();
        }
    }, 2000);
}

// Generate user ID from email
function generateUserId(email) {
    return Math.floor(1000000 + Math.random() * 9000000).toString();
}

// Show page
function showPage(pageName) {
    const pages = document.querySelectorAll('.page');
    
    pages.forEach(page => {
        page.classList.remove('active');
    });
    
    document.getElementById(pageName + '-page').classList.add('active');
}

// Logout
function logout() {
    // Clear session
    localStorage.removeItem('opperSession');
    
    // Show auth container
    showAuthContainer();
    
    // Reset user data
    currentUser = null;
    userBalance = 0;
    userKycStatus = 'pending';
    transactions = [];
}

// Show loader
function showLoader() {
    loader.classList.add('active');
}

// Hide loader
function hideLoader() {
    loader.classList.remove('active');
}

// Show processing overlay
function showProcessing() {
    processingOverlay.classList.add('active');
}

// Hide processing overlay
function hideProcessing() {
    processingOverlay.classList.remove('active');
}

// Show auth container
function showAuthContainer() {
    authContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
}

// Show app container
function showAppContainer() {
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
}
