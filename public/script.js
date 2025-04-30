const supabaseUrl = 'https://vtsczzlnhsrgnbkfyizi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, { fetch: (...args) => fetch(...args) });

// Global Variables
let currentUser = null;
let userBalance = 0;
let userKycStatus = 'pending';
let userPhone = '';
let transfersEnabled = true;
let currentTheme = localStorage.getItem('theme') || 'light';
let userPaymentPin = ''; // This would come from the database in a real app
let savedTransactions = [];
let verifiedReceiver = null;

// DOM Elements
const loader = document.getElementById('loader');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');

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
        userPhone = userData.phone || '';
        userPaymentPin = userData.payment_pin || '123456'; // Default PIN for demo
        
        // Update UI with user data
        updateUserUI(userData);
        
        // Check system settings
        const { data: settings, error: settingsError } = await supabase
            .from('settings')
            .select('allow_transfers')
            .eq('id', 1)
            .single();
        
        if (!settingsError && settings) {
            transfersEnabled = settings.allow_transfers;
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
            if (currentUser && (payload.new.from_phone === userPhone || payload.new.to_phone === userPhone)) {
                // Refresh transactions list
                loadTransactions();
            }
        })
        .subscribe();
}

// Load transactions
async function loadTransactions() {
    try {
        if (!currentUser || !userPhone) return;
        
        // Get recent transactions
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .or(`from_phone.eq.${userPhone},to_phone.eq.${userPhone}`)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        savedTransactions = transactions || [];
        
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
            <div class="transaction-item ${isSender ? 'sent' : 'received'}" data-transaction-id="${index}">
                <div class="transaction-icon">
                    <i class="fas ${isSender ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-title">
                        ${isSender ? 'ပို့ထားသော' : 'လက်ခံရရှိသော'}
                    </div>
                    <div class="transaction-subtitle">
                        ${otherParty} ${transaction.note ? `- ${transaction.note}` : ''}
                    </div>
                    <div class="transaction-date">
                        ${transactionDate}
                    </div>
                </div>
                <div class="transaction-amount">
                    ${isSender ? '-' : '+'}${transaction.amount.toLocaleString()} Ks
                </div>
                <div class="transaction-actions">
                    <div class="view-receipt-btn" data-transaction-id="${index}">
                        <i class="fas fa-eye"></i>
                    </div>
                </div>
            </div>
        `;
        
        // Add to recent transactions (max 5)
        if (index < 5) {
            recentTransactionsList.innerHTML += transactionItem;
        }
        
        // Add to history list
        historyTransactionsList.innerHTML += transactionItem;
    });
    
    // Add event listeners to view receipt buttons
    document.querySelectorAll('.view-receipt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const transactionId = e.currentTarget.getAttribute('data-transaction-id');
            showReceiptModal(savedTransactions[transactionId]);
        });
    });
}

// Initialize UI elements and event listeners
function initializeUI() {
    // Auth Tabs
    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            
            // Update active tab
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding form
            authForms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${tabName}-form`) {
                    form.classList.add('active');
                }
            });
        });
    });
    
    // Password Toggle
    const togglePasswordBtns = document.querySelectorAll('.toggle-password');
    
    togglePasswordBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
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
    
    // Login Form
    const loginForm = document.getElementById('login-btn');
    
    loginForm.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const rememberMe = document.getElementById('remember-me').checked;
        
        if (!email || !password) {
            showAuthMessage('login-error', 'အီးမေးလ်နှင့် စကားဝှက်ဖြည့်ပါ');
            return;
        }
        
        // Show loader
        showLoader();
        
        try {
            const { data: user, error } = await supabase
                .from('auth_users')
                .select('*')
                .eq('email', email)
                .single();
            
            if (error || !user) {
                hideLoader();
                showAuthMessage('login-error', 'အီးမေးလ် သို့မဟုတ် စကားဝှက်မှားယွင်းသည်');
                return;
            }
            
            // Validate password (in a real app, you would use proper hashing)
            if (user.password !== password) {
                hideLoader();
                showAuthMessage('login-error', 'အီးမေးလ် သို့မဟုတ် စကားဝှက်မှားယွင်းသည်');
                return;
            }
            
            // Login successful
            currentUser = user;
            
            // Save session if remember me is checked
            if (rememberMe) {
                localStorage.setItem('opperSession', JSON.stringify({
                    email: user.email,
                    user_id: user.user_id
                }));
            }
            
            await loadUserData();
            hideLoader();
            showAppContainer();
        } catch (error) {
            hideLoader();
            showAuthMessage('login-error', 'အကောင့်ဝင်ရာတွင် အမှားရှိသည်');
            console.error('Login error:', error);
        }
    });
    
    // Signup Form
    const signupForm = document.getElementById('signup-btn');
    
    signupForm.addEventListener('click', async () => {
        const email = document.getElementById('signup-email').value;
        const phone = document.getElementById('signup-phone').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;
        const termsAgree = document.getElementById('terms-agree').checked;
        
        if (!email || !phone || !password || !confirmPassword) {
            showAuthMessage('signup-error', 'အချက်အလက်အားလုံးဖြည့်ပါ');
            return;
        }
        
        if (password !== confirmPassword) {
            showAuthMessage('signup-error', 'စကားဝှက်များ မတူညီပါ');
            return;
        }
        
        if (!termsAgree) {
            showAuthMessage('signup-error', 'စည်းမျဉ်းစည်းကမ်းများကို သဘောတူရပါမည်');
            return;
        }
        
        // Show loader
        showLoader();
        
        try {
            // Check if email already exists
            const { data: existingEmail } = await supabase
                .from('auth_users')
                .select('email')
                .eq('email', email)
                .single();
            
            if (existingEmail) {
                hideLoader();
                showAuthMessage('signup-error', 'ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးဖြစ်သည်');
                return;
            }
            
            // Check if phone already exists
            const { data: existingPhone } = await supabase
                .from('users')
                .select('phone')
                .eq('phone', phone)
                .single();
            
            if (existingPhone) {
                hideLoader();
                showAuthMessage('signup-error', 'ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးဖြစ်သည်');
                return;
            }
            
            // Generate user ID
            const userId = generateUserId();
            
            // Create user in auth_users table
            const { error: authError } = await supabase
                .from('auth_users')
                .insert([
                    {
                        user_id: userId,
                        email: email,
                        password: password, // In a real app, this would be hashed
                        created_at: new Date()
                    }
                ]);
            
            if (authError) throw authError;
            
            // Create user profile in users table
            const { error: profileError } = await supabase
                .from('users')
                .insert([
                    {
                        user_id: userId,
                        phone: phone,
                        balance: 10000, // Starting balance for demo
                        passport_status: 'pending',
                        created_at: new Date()
                    }
                ]);
            
            if (profileError) throw profileError;
            
            // Signup successful
            hideLoader();
            showAuthMessage('signup-success', 'အကောင့်ဖွင့်ခြင်း အောင်မြင်ပါသည်။ အကောင့်ဝင်နိုင်ပါပြီ');
            
            // Switch to login tab after a delay
            setTimeout(() => {
                document.querySelector('.auth-tab[data-tab="login"]').click();
            }, 2000);
        } catch (error) {
            hideLoader();
            showAuthMessage('signup-error', 'အကောင့်ဖွင့်ရာတွင် အမှားရှိသည်');
            console.error('Signup error:', error);
        }
    });
    
    // Sidebar Toggle
    const menuToggle = document.getElementById('menu-toggle');
    const closeSidebar = document.getElementById('close-sidebar');
    const sidebar = document.getElementById('sidebar');
    
    menuToggle.addEventListener('click', () => {
        sidebar.classList.add('active');
    });
    
    closeSidebar.addEventListener('click', () => {
        sidebar.classList.remove('active');
    });
    
    // Page Navigation
    const navLinks = document.querySelectorAll('[data-page]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const pageName = link.getAttribute('data-page');
            
            // Update active nav item
            document.querySelectorAll('.sidebar-nav li').forEach(item => {
                item.classList.remove('active');
            });
            
            const navItem = link.closest('li');
            if (navItem) {
                navItem.classList.add('active');
            }
            
            // Show corresponding page
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });
            
            document.getElementById(`${pageName}-page`).classList.add('active');
            
            // Close sidebar on mobile
            if (window.innerWidth < 768) {
                sidebar.classList.remove('active');
            }
        });
    });
    
    // Balance Actions
    const hideBalance = document.getElementById('hide-balance');
    
    let isBalanceHidden = false;
    
    hideBalance.addEventListener('click', () => {
        const balanceAmount = document.getElementById('balance-amount');
        
        if (isBalanceHidden) {
            balanceAmount.textContent = `${userBalance.toLocaleString()} Ks`;
            hideBalance.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
            balanceAmount.textContent = '• • • • • • Ks';
            hideBalance.innerHTML = '<i class="fas fa-eye"></i>';
        }
        
        isBalanceHidden = !isBalanceHidden;
    });
    
    const refreshBalance = document.getElementById('refresh-balance');
    
    refreshBalance.addEventListener('click', async () => {
        refreshBalance.querySelector('i').classList.add('fa-spin');
        await loadUserData();
        setTimeout(() => {
            refreshBalance.querySelector('i').classList.remove('fa-spin');
        }, 1000);
    });
    
    // History Filter Tabs
    const filterTabs = document.querySelectorAll('.filter-tab');
    
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const filter = tab.getAttribute('data-filter');
            
            // Update active tab
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Filter transactions
            const transactions = document.querySelectorAll('.transaction-item');
            
            if (filter === 'all') {
                transactions.forEach(item => item.style.display = 'flex');
            } else if (filter === 'sent') {
                transactions.forEach(item => {
                    if (item.classList.contains('sent')) {
                        item.style.display = 'flex';
                    } else {
                        item.style.display = 'none';
                    }
                });
            } else if (filter === 'received') {
                transactions.forEach(item => {
                    if (item.classList.contains('received')) {
                        item.style.display = 'flex';
                    } else {
                        item.style.display = 'none';
                    }
                });
            }
        });
    });
    
    // KYC Form
    const idFrontBtn = document.getElementById('id-front-btn');
    const idBackBtn = document.getElementById('id-back-btn');
    const idFrontInput = document.getElementById('id-front');
    const idBackInput = document.getElementById('id-back');
    
    idFrontBtn.addEventListener('click', () => {
        idFrontInput.click();
    });
    
    idBackBtn.addEventListener('click', () => {
        idBackInput.click();
    });
    
    // Theme options
    const themeOptions = document.querySelectorAll('.theme-option');
    
    themeOptions.forEach(option => {
        const theme = option.getAttribute('data-theme');
        
        if (theme === currentTheme) {
            option.classList.add('active');
        }
        
        option.addEventListener('click', () => {
            themeOptions.forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            
            document.body.setAttribute('data-theme', theme);
            currentTheme = theme;
            localStorage.setItem('theme', theme);
        });
    });
    
    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    
    logoutBtn.addEventListener('click', () => {
        // Clear session
        localStorage.removeItem('opperSession');
        
        // Reset variables
        currentUser = null;
        userBalance = 0;
        userKycStatus = 'pending';
        
        // Show auth container
        showAuthContainer();
    });
    
    // Transfer page functionality
    initializeTransferPage();
}

// Initialize transfer page functionality
function initializeTransferPage() {
    const transferForm = document.getElementById('transfer-form');
    const verifyBtn = document.getElementById('verify-btn');
    const transferToInput = document.getElementById('transfer-to');
    const transferAmountInput = document.getElementById('transfer-amount');
    const amountInWords = document.getElementById('amount-in-words');
    const receiverStatus = document.getElementById('receiver-status');
    const verifiedUserInfo = document.getElementById('verified-user-info');
    
    // Verify button click
    verifyBtn.addEventListener('click', async () => {
        const receiverPhone = transferToInput.value.trim();
        
        if (!receiverPhone) {
            receiverStatus.textContent = "ဖုန်းနံပါတ်ထည့်ပါ";
            receiverStatus.className = "input-status error";
            return;
        }
        
        if (receiverPhone === userPhone) {
            receiverStatus.textContent = "သင့်ကိုယ်ပိုင်အကောင့်ကို ငွေလွှဲ၍မရပါ";
            receiverStatus.className = "input-status error";
            return;
        }
        
        // Show verifying message
        receiverStatus.textContent = "အကောင့်ရှာဖွေနေသည်...";
        receiverStatus.className = "input-status";
        
        try {
            // Check if receiver exists
            const { data: receiver, error } = await supabase
                .from('users')
                .select('user_id, phone')
                .eq('phone', receiverPhone)
                .single();
            
            if (error || !receiver) {
                receiverStatus.textContent = "ဤဖုန်းနံပါတ်ဖြင့် အကောင့်မရှိပါ";
                receiverStatus.className = "input-status error";
                verifiedUserInfo.classList.add('hidden');
                verifiedReceiver = null;
                console.log("Account not found");
                return;
            }
            
            // Get user details
            const { data: userData, error: userError } = await supabase
                .from('auth_users')
                .select('*')
                .eq('user_id', receiver.user_id)
                .single();
            
            if (userError || !userData) {
                receiverStatus.textContent = "အကောင့်အချက်အလက်ရယူမရပါ";
                receiverStatus.className = "input-status error";
                return;
            }
            
            // Account found
            receiverStatus.textContent = "အကောင့်ရှိပါသည်";
            receiverStatus.className = "input-status success";
            
            // Show verified user info
            verifiedReceiver = {
                user_id: receiver.user_id,
                phone: receiver.phone,
                email: userData.email
            };
            
            const receiverInitial = userData.email.charAt(0).toUpperCase();
            const receiverName = userData.email.split('@')[0];
            
            document.getElementById('receiver-initial').textContent = receiverInitial;
            document.getElementById('receiver-name').textContent = receiverName;
            document.getElementById('receiver-id').textContent = `ID: ${receiver.user_id}`;
            
            verifiedUserInfo.classList.remove('hidden');
            console.log("Account found:", receiverName);
        } catch (error) {
            receiverStatus.textContent = "အကောင့်ရှာဖွေရာတွင် အမှားရှိသည်";
            receiverStatus.className = "input-status error";
            console.error('Verify receiver error:', error);
        }
    });
    
    // Amount input change
    transferAmountInput.addEventListener('input', () => {
        const amount = parseInt(transferAmountInput.value) || 0;
        amountInWords.textContent = convertToWords(amount) + ' ကျပ်';
    });
    
    // Submit transfer form
    transferForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const receiverPhone = transferToInput.value.trim();
        const amount = parseInt(transferAmountInput.value) || 0;
        const note = document.getElementById('transfer-note').value.trim();
        
        if (!receiverPhone) {
            receiverStatus.textContent = "ဖုန်းနံပါတ်ထည့်ပါ";
            receiverStatus.className = "input-status error";
            return;
        }
        
        if (!verifiedReceiver) {
            receiverStatus.textContent = "အကောင့်အတည်ပြုပါ";
            receiverStatus.className = "input-status error";
            return;
        }
        
        if (amount < 1000) {
            const errorEl = document.createElement('div');
            errorEl.textContent = "အနည်းဆုံး 1,000 Ks လွှဲရပါမည်";
            errorEl.className = "input-status error";
            transferAmountInput.parentNode.parentNode.appendChild(errorEl);
            
            setTimeout(() => {
                errorEl.remove();
            }, 3000);
            return;
        }
        
        if (amount > userBalance) {
            const errorEl = document.createElement('div');
            errorEl.textContent = "လက်ကျန်ငွေမလုံလောက်ပါ";
            errorEl.className = "input-status error";
            transferAmountInput.parentNode.parentNode.appendChild(errorEl);
            
            setTimeout(() => {
                errorEl.remove();
            }, 3000);
            return;
        }
        
        // Open PIN modal
        openPinModal(receiverPhone, amount, note);
    });
}

// PIN Modal functionality
function openPinModal(receiverPhone, amount, note) {
    const pinModal = document.getElementById('pin-modal');
    const closePinModal = document.getElementById('close-pin-modal');
    const pinInputs = document.querySelectorAll('.pin-input');
    const pinKeys = document.querySelectorAll('.pin-key');
    const pinKeyClear = document.querySelector('.pin-key-clear');
    const pinKeySubmit = document.querySelector('.pin-key-submit');
    const pinMessage = document.getElementById('pin-message');
    
    // Show modal
    pinModal.classList.add('active');
    
    // Clear previous inputs
    pinInputs.forEach(input => {
        input.value = '';
    });
    
    // Focus first input
    pinInputs[0].focus();
    
    // Input events
    pinInputs.forEach((input, index) => {
        // Handle input
        input.addEventListener('input', function() {
            if (this.value) {
                // Move to next input// Supabase Configuration
const supabaseUrl = 'https://vtsczzlnhsrgnbkfyizi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, { fetch: (...args) => fetch(...args) });

// Global Variables
let currentUser = null;
let userBalance = 0;
let userKycStatus = 'pending';
let transfersEnabled = true;
let currentTheme = localStorage.getItem('theme') || 'light';
let userPin = '123456'; // Default PIN for demo purposes
let transactions = []; // Store transactions for in-memory database

// DOM Elements
const loader = document.getElementById('loader');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');

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
            .select('allow_transfers')
            .eq('id', 1)
            .single();
        
        if (!settingsError && settings) {
            transfersEnabled = settings.allow_transfers;
            updateTransferStatus();
        }
        
        // Load transactions
        loadTransactions();
        
        // Load PIN from localStorage for demo
        if (localStorage.getItem('userPin')) {
            userPin = localStorage.getItem('userPin');
        }
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

// Show loader
function showLoader() {
    loader.classList.add('active');
}

// Hide loader
function hideLoader() {
    loader.classList.remove('active');
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

// Initialize UI elements
function initializeUI() {
    // Auth tabs
    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const formId = tab.getAttribute('data-tab');
            
            // Update tabs
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update forms
            authForms.forEach(form => form.classList.remove('active'));
            document.getElementById(`${formId}-form`).classList.add('active');
        });
    });
    
    // Toggle password visibility
    const togglePasswordButtons = document.querySelectorAll('.toggle-password');
    
    togglePasswordButtons.forEach(button => {
        button.addEventListener('click', function() {
            const input = this.parentNode.querySelector('input');
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            
            input.setAttribute('type', type);
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    });
    
    // Login form
    const loginForm = document.getElementById('login-btn');
    
    loginForm.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        if (!email || !password) {
            showMessage('login-error', 'အီးမေးလ်နှင့် စကားဝှက်ကို ဖြည့်ပါ');
            return;
        }
        
        try {
            showLoader();
            
            const { data, error } = await supabase
                .from('auth_users')
                .select('*')
                .eq('email', email)
                .single();
            
            if (error || !data) {
                hideLoader();
                showMessage('login-error', 'အကောင့်မတွေ့ရှိပါ');
                return;
            }
            
            // Simple password check (in real app, use proper hashing)
            if (data.password !== password) {
                hideLoader();
                showMessage('login-error', 'စကားဝှက် မှားယွင်းနေပါသည်');
                return;
            }
            
            // Save session
            currentUser = data;
            localStorage.setItem('opperSession', JSON.stringify({
                email: data.email,
                user_id: data.user_id
            }));
            
            await loadUserData();
            
            hideLoader();
            showAppContainer();
            
        } catch (error) {
            hideLoader();
            showMessage('login-error', 'အကောင့်ဝင်ရာတွင် အမှားရှိပါသည်');
            console.error('Login error:', error);
        }
    });
    
    // Signup form
    const signupForm = document.getElementById('signup-btn');
    
    signupForm.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('signup-email').value;
        const phone = document.getElementById('signup-phone').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;
        const termsAgree = document.getElementById('terms-agree').checked;
        
        if (!email || !phone || !password || !confirmPassword) {
            showMessage('signup-error', 'အချက်အလက်အားလုံးဖြည့်ပါ');
            return;
        }
        
        if (password !== confirmPassword) {
            showMessage('signup-error', 'စကားဝှက်နှစ်ခု မတူညီပါ');
            return;
        }
        
        if (!termsAgree) {
            showMessage('signup-error', 'စည်းမျဉ်းစည်းကမ်းများကို သဘောတူရန်လိုအပ်ပါသည်');
            return;
        }
        
        try {
            showLoader();
            
            // Check if email already exists
            const { data: existingUser, error: checkError } = await supabase
                .from('auth_users')
                .select('email')
                .eq('email', email)
                .single();
            
            if (existingUser) {
                hideLoader();
                showMessage('signup-error', 'အီးမေးလ်ရှိပြီးဖြစ်ပါသည်');
                return;
            }
            
            // Generate user ID
            const userId = 'U' + Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
            
            // Create user
            const { error: insertError } = await supabase
                .from('auth_users')
                .insert([
                    { 
                        email: email,
                        password: password,
                        user_id: userId
                    }
                ]);
            
            if (insertError) {
                hideLoader();
                showMessage('signup-error', 'အကောင့်ဖွင့်ရာတွင် အမှားရှိပါသည်');
                console.error('Signup error:', insertError);
                return;
            }
            
            // Create user profile
            const { error: profileError } = await supabase
                .from('users')
                .insert([
                    {
                        user_id: userId,
                        phone: phone,
                        balance: 100000,  // Initial balance
                        passport_status: 'pending'
                    }
                ]);
            
            if (profileError) {
                hideLoader();
                showMessage('signup-error', 'ပရိုဖိုင်ဖန်တီးရာတွင် အမှားရှိပါသည်');
                console.error('Profile creation error:', profileError);
                return;
            }
            
            hideLoader();
            showMessage('signup-success', 'အကောင့်ဖွင့်ပြီးပါပြီ');
            
            // Switch to login tab
            document.querySelector('.auth-tab[data-tab="login"]').click();
            
        } catch (error) {
            hideLoader();
            showMessage('signup-error', 'အကောင့်ဖွင့်ရာတွင် အမှားရှိပါသည်');
            console.error('Signup error:', error);
        }
    });
    
    // Sidebar toggle
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const closeSidebar = document.getElementById('close-sidebar');
    
    menuToggle.addEventListener('click', () => {
        sidebar.classList.add('active');
    });
    
    closeSidebar.addEventListener('click', () => {
        sidebar.classList.remove('active');
    });
    
    // Navigation
    const navLinks = document.querySelectorAll('.sidebar-nav a, .action-button[data-page]');
    const pages = document.querySelectorAll('.page');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const pageId = link.getAttribute('data-page');
            
            // Update active nav link
            document.querySelectorAll('.sidebar-nav li').forEach(item => {
                item.classList.remove('active');
            });
            
            const parentLi = link.closest('li');
            if (parentLi) parentLi.classList.add('active');
            
            // Show page
            pages.forEach(page => {
                page.classList.remove('active');
            });
            
            document.getElementById(`${pageId}-page`).classList.add('active');
            
            // Close sidebar on mobile
            sidebar.classList.remove('active');
        });
    });
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('opperSession');
        currentUser = null;
        showAuthContainer();
    });
    
    // Theme toggler
    const themeOptions = document.querySelectorAll('.theme-option');
    
    themeOptions.forEach(option => {
        if (option.getAttribute('data-theme') === currentTheme) {
            option.classList.add('active');
        }
        
        option.addEventListener('click', () => {
            const theme = option.getAttribute('data-theme');
            
            document.body.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            currentTheme = theme;
            
            themeOptions.forEach(o => o.classList.remove('active'));
            option.classList.add('active');
        });
    });
    
    // Balance actions
    const hideBalanceBtn = document.getElementById('hide-balance');
    const balanceAmount = document.getElementById('balance-amount');
    
    hideBalanceBtn.addEventListener('click', () => {
        if (balanceAmount.textContent.includes('*')) {
            balanceAmount.textContent = `${userBalance.toLocaleString()} Ks`;
            hideBalanceBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
            balanceAmount.textContent = '******** Ks';
            hideBalanceBtn.innerHTML = '<i class="fas fa-eye"></i>';
        }
    });
    
    const refreshBalanceBtn = document.getElementById('refresh-balance');
    
    refreshBalanceBtn.addEventListener('click', async () => {
        try {
            refreshBalanceBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
            
            const { data, error } = await supabase
                .from('users')
                .select('balance')
                .eq('user_id', currentUser.user_id)
                .single();
            
            if (error) throw error;
            
            userBalance = data.balance;
            document.getElementById('user-balance').textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`;
            balanceAmount.textContent = `${userBalance.toLocaleString()} Ks`;
            
            setTimeout(() => {
                refreshBalanceBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            }, 1000);
            
        } catch (error) {
            console.error('Refresh balance error:', error);
            refreshBalanceBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        }
    });
    
    // Initialize transfer related functionality
    initializeTransferUI();
    
    // Initialize transaction history functionality
    initializeHistoryUI();
    
    // Initialize KYC form
    initializeKycUI();
    
    // Initialize settings
    initializeSettingsUI();
}

// Show message in auth forms
function showMessage(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.classList.add('show');
    
    setTimeout(() => {
        element.classList.remove('show');
    }, 5000);
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
        
        // Get transactions from memory or initialize with sample data for demo
        if (transactions.length === 0) {
            // Initialize with sample transactions if empty
            const currentDate = new Date();
            
            // Create sample transactions for demo - these will be replaced by actual transactions
            transactions = [
                {
                    id: 'OPPER1234567',
                    from_phone: userPhone,
                    to_phone: '09987654321',
                    amount: 50000,
                    note: 'အိမ်ငှားခ',
                    created_at: new Date(currentDate.getTime() - 86400000).toISOString(), // 1 day ago
                    status: 'completed'
                },
                {
                    id: 'OPPER7654321',
                    from_phone: '09123456789',
                    to_phone: userPhone,
                    amount: 25000,
                    note: 'ကားခ',
                    created_at: new Date(currentDate.getTime() - 172800000).toISOString(), // 2 days ago
                    status: 'completed'
                }
            ];
        }
        
        // Update UI with transactions
        updateTransactionsUI(transactions, userPhone);
    } catch (error) {
        console.error('Load transactions error:', error);
    }
}

// Update transactions UI
function updateTransactionsUI(transactionsList, userPhone) {
    const recentTransactionsList = document.getElementById('recent-transactions-list');
    const historyTransactionsList = document.getElementById('history-transactions-list');
    
    // Clear lists
    recentTransactionsList.innerHTML = '';
    historyTransactionsList.innerHTML = '';
    
    if (!transactionsList || transactionsList.length === 0) {
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
    
    // Sort transactions by date descending
    const sortedTransactions = [...transactionsList].sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
    });
    
    // Create transaction items for recent transactions (limit to 5)
    const recentTransactions = sortedTransactions.slice(0, 5);
    
    recentTransactions.forEach(transaction => {
        const isSender = transaction.from_phone === userPhone;
        const otherParty = isSender ? transaction.to_phone : transaction.from_phone;
        const transactionDate = new Date(transaction.created_at).toLocaleString();
        
        const transactionItem = `
            <div class="transaction-item ${isSender ? 'sent' : 'received'}" data-transaction-id="${transaction.id}">
                <div class="transaction-icon">
                    <i class="fas ${isSender ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-title">
                        ${isSender ? 'ပို့ထားသော' : 'လက်ခံရရှိသော'}
                    </div>
                    <div class="transaction-subtitle">
                        ${otherParty} ${transaction.note ? `- ${transaction.note}` : ''}
                    </div>
                    <div class="transaction-date">${transactionDate}</div>
                </div>
                <div class="transaction-amount">
                    ${isSender ? '-' : '+'} ${transaction.amount.toLocaleString()} Ks
                </div>
                <div class="transaction-actions">
                    <button class="view-receipt-btn" data-transaction-id="${transaction.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
        `;
        
        recentTransactionsList.innerHTML += transactionItem;
    });
    
    // Create transaction items for history page (all transactions)
    sortedTransactions.forEach(transaction => {
        const isSender = transaction.from_phone === userPhone;
        const otherParty = isSender ? transaction.to_phone : transaction.from_phone;
        const transactionDate = new Date(transaction.created_at).toLocaleString();
        
        const transactionItem = `
            <div class="transaction-item ${isSender ? 'sent' : 'received'}" data-transaction-id="${transaction.id}" data-type="${isSender ? 'sent' : 'received'}">
                <div class="transaction-icon">
                    <i class="fas ${isSender ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-title">
                        ${isSender ? 'ပို့ထားသော' : 'လက်ခံရရှိသော'}
                    </div>
                    <div class="transaction-subtitle">
                        ${otherParty} ${transaction.note ? `- ${transaction.note}` : ''}
                    </div>
                    <div class="transaction-date">${transactionDate}</div>
                </div>
                <div class="transaction-amount">
                    ${isSender ? '-' : '+'} ${transaction.amount.toLocaleString()} Ks
                </div>
                <div class="transaction-actions">
                    <button class="view-receipt-btn" data-transaction-id="${transaction.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
        `;
        
        historyTransactionsList.innerHTML += transactionItem;
    });
    
    // Add event listeners to view receipt buttons
    document.querySelectorAll('.view-receipt-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const transactionId = button.getAttribute('data-transaction-id');
            showTransactionReceipt(transactionId);
        });
    });
}

// Initialize transfer UI
function initializeTransferUI() {
    const transferForm = document.getElementById('transfer-form');
    const verifyBtn = document.getElementById('verify-btn');
    const transferToInput = document.getElementById('transfer-to');
    const receiverStatus = document.getElementById('receiver-status');
    const verifiedUserInfo = document.getElementById('verified-user-info');
    const transferAmountInput = document.getElementById('transfer-amount');
    const amountInWords = document.getElementById('amount-in-words');
    const submitTransferBtn = document.getElementById('submit-transfer-btn');
    const pinModal = document.getElementById('pin-modal');
    const closePinModal = document.getElementById('close-pin-modal');
    const pinInputs = document.querySelectorAll('.pin-input');
    const pinKeys = document.querySelectorAll('.pin-key');
    const pinKeyClear = document.querySelector('.pin-key-clear');
    const pinKeySubmit = document.querySelector('.pin-key-submit');
    const pinMessage = document.getElementById('pin-message');
    const receiptModal = document.getElementById('receipt-modal');
    const closeReceiptModal = document.getElementById('close-receipt-modal');
    const downloadReceiptBtn = document.getElementById('download-receipt');
    const closeReceiptBtn = document.getElementById('close-receipt');
    
    let verifiedReceiver = null;
    let currentPinIndex = 0;
    let enteredPin = '';
    
    // Verify recipient
    verifyBtn.addEventListener('click', async () => {
        const recipientPhone = transferToInput.value.trim();
        
        if (!recipientPhone) {
            receiverStatus.textContent = 'ဖုန်းနံပါတ်ထည့်ပါ';
            receiverStatus.className = 'input-status error';
            verifiedUserInfo.classList.add('hidden');
            verifiedReceiver = null;
            return;
        }
        
        try {
            // Check if user exists with this phone
            // In real app, this would be an API call
            console.log(`Verifying phone number: ${recipientPhone}`);
            
            // For demo, we'll create a simple check
            if (recipientPhone.startsWith('09') && recipientPhone.length === 11) {
                // Get user by phone
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('phone', recipientPhone)
                    .single();
                
                if (error || !data) {
                    receiverStatus.textContent = 'အကောင့်မတွေ့ရှိပါ';
                    receiverStatus.className = 'input-status error';
                    verifiedUserInfo.classList.add('hidden');
                    verifiedReceiver = null;
                    console.log('Account not found');
                    return;
                }
                
                // Get user details
                const { data: userData, error: userError } = await supabase
                    .from('auth_users')
                    .select('*')
                    .eq('user_id', data.user_id)
                    .single();
                
                if (userError || !userData) {
                    receiverStatus.textContent = 'အကောင့်အချက်အလက်မတွေ့ရှိပါ';
                    receiverStatus.className = 'input-status error';
                    verifiedUserInfo.classList.add('hidden');
                    verifiedReceiver = null;
                    return;
                }
                
                // Cannot transfer to self
                if (data.user_id === currentUser.user_id) {
                    receiverStatus.textContent = 'မိမိကိုယ်တိုင်ထံ ငွေလွှဲ၍မရပါ';
                    receiverStatus.className = 'input-status error';
                    verifiedUserInfo.classList.add('hidden');
                    verifiedReceiver = null;
                    return;
                }
                
                // Success - user found
                receiverStatus.textContent = 'အကောင့်တွေ့ရှိပါသည်';
                receiverStatus.className = 'input-status success';
                
                // Update verified user info
                verifiedReceiver = {
                    ...data,
                    email: userData.email
                };
                
                const receiverInitial = userData.email.charAt(0).toUpperCase();
                const receiverName = userData.email.split('@')[0];
                
                document.getElementById('receiver-initial').textContent = receiverInitial;
                document.getElementById('receiver-name').textContent = receiverName;
                document.getElementById('receiver-id').textContent = `ID: ${data.user_id}`;
                
                verifiedUserInfo.classList.remove('hidden');
                console.log('Account found:', receiverName);
            } else {
                receiverStatus.textContent = 'ဖုန်းနံပါတ်ပုံစံမှားယွင်းနေပါသည်';
                receiverStatus.className = 'input-status error';
                verifiedUserInfo.classList.add('hidden');
                verifiedReceiver = null;
                console.log('Invalid phone number format');
            }
        } catch (error) {
            console.error('Verify recipient error:', error);
            receiverStatus.textContent = 'အကောင့်စစ်ဆေးရာတွင် အမှားရှိပါသည်';
            receiverStatus.className = 'input-status error';
            verifiedUserInfo.classList.add('hidden');
            verifiedReceiver = null;
        }
    });
    
    // Amount to words converter
    transferAmountInput.addEventListener('input', function() {
        const amount = parseInt(this.value) || 0;
        amountInWords.textContent = convertToMyanmarWords(amount) + ' ကျပ်';
    });
    
    // Submit transfer
    transferForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const amount = parseInt(transferAmountInput.value) || 0;
        const note = document.getElementById('transfer-note').value;
        
        // Validate
        if (!verifiedReceiver) {
            alert('လက်ခံမည့်သူကို အတည်ပြုပါ');
            return;
        }
        
        if (amount < 1000) {
            alert('အနည်းဆုံး 1,000 ကျပ် လွှဲပို့ရပါမည်');
            return;
        }
        
        if (amount > userBalance) {
            alert('လက်ကျန်ငွေမလုံလောက်ပါ');
            return;
        }
        
        // Show PIN modal
        showPinModal();
    });
    
    // PIN modal related
    function showPinModal() {
        pinModal.classList.add('active');
        currentPinIndex = 0;
        enteredPin = '';
        
        // Clear PIN inputs
        pinInputs.forEach(input => {
            input.value = '';
        });
        
        // Focus on first PIN input
        pinInputs[0].focus();
        
        // Clear PIN message
        pinMessage.textContent = '';
        pinMessage.className = 'pin-message';
    }
    
    function hidePinModal() {
        pinModal.classList.remove('active');
    }
    
    // Close PIN modal
    closePinModal.addEventListener('click', hidePinModal);
    
    // PIN input handling
    pinInputs.forEach(input => {
        input.addEventListener('input', function() {
            if (this.value) {
                const index = parseInt(this.getAttribute('data-index'));
                enteredPin += this.value;
                
                // Move to next input
                if (index < 5) {
                    currentPinIndex = index + 1;
                    pinInputs[currentPinIndex].focus();
                }
                
                // Mask the input
                this.value = '*';
                
                // If all inputs filled, auto submit
                if (index === 5) {
                    validatePin();
                }
            }
        });
        
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && !this.value) {
                const index = parseInt(this.getAttribute('data-index'));
                
                // Move to previous input
                if (index > 0) {
                    currentPinIndex = index - 1;
                    pinInputs[currentPinIndex].focus();
                    pinInputs[currentPinIndex].value = '';
                    enteredPin = enteredPin.slice(0, -1);
                }
            }
        });
    });
    
    // PIN keypad
    pinKeys.forEach(key => {
        key.addEventListener('click', function() {
            if (currentPinIndex > 5) return;
            
            const value = this.getAttribute('data-value');
            if (value) {
                pinInputs[currentPinIndex].value = '*';
                enteredPin += value;
                
                if (currentPinIndex < 5) {
                    currentPinIndex++;
                    pinInputs[currentPinIndex].focus();
                } else {
                    // All inputs filled
                    validatePin();
                }
            }
        });
    });
    
    // Clear PIN
    pinKeyClear.addEventListener('click', function() {
        if (currentPinIndex > 0) {
            currentPinIndex--;
            pinInputs[currentPinIndex].value = '';
            enteredPin = enteredPin.slice(0, -1);
            pinInputs[currentPinIndex].focus();
        }
    });
    
    // Submit PIN
    pinKeySubmit.addEventListener('click', validatePin);
    
    // Validate PIN
    function validatePin() {
        if (enteredPin.length !== 6) {
            pinMessage.textContent = 'PIN ကုဒ် 6 လုံး ဖြည့်ပါ';
            pinMessage.className = 'pin-message error';
            return;
        }
        
        // In real app, this would validate against stored PIN
        // For demo, we'll check against the dummy PIN
        if (enteredPin !== userPin) {
            pinMessage.textContent = 'PIN ကုဒ်မှားယွင်းနေပါသည်';
            pinMessage.className = 'pin-message error';
            
            // Clear PIN inputs
            pinInputs.forEach(input => {
                input.value = '';
            });
            
            enteredPin = '';
            currentPinIndex = 0;
            pinInputs[0].focus();
            
            return;
        }
        
        // PIN is correct, process transfer
        pinMessage.textContent = 'အတည်ပြုပြီးပါပြီ...';
        pinMessage.className = 'pin-message success';
        
        // Process transfer after short delay
        setTimeout(() => {
            processTransfer();
            hidePinModal();
        }, 1000);
    }
    
    // Process transfer
    async function processTransfer() {
        const amount = parseInt(transferAmountInput.value) || 0;
        const note = document.getElementById('transfer-note').value;
        const recipientPhone = transferToInput.value.trim();
        
        try {
            showLoader();
            
            console.log('OPPER intro - ငွေလွှဲလုပ်ဆောင်နေသည်');
            
            // Get sender phone
            const { data: senderData, error: senderError } = await supabase
                .from('users')
                .select('phone')
                .eq('user_id', currentUser.user_id)
                .single();
            
            if (senderError) throw senderError;
            
            const senderPhone = senderData.phone;
            
            // Generate transaction ID
            const transactionId = 'OPPER' + Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
            
            // Create transaction in memory
            const transaction = {
                id: transactionId,
                from_phone: senderPhone,
                to_phone: recipientPhone,
                amount: amount,
                note: note,
                created_at: new Date().toISOString(),
                status: 'completed'
            };
            
            // Add to transactions array
            transactions.push(transaction);
            
            // Update balances
            userBalance -= amount;
            
            // Update user balance in Supabase
            const { error: updateError } = await supabase
                .from('users')
                .update({ balance: userBalance })
                .eq('user_id', currentUser.user_id);
            
            if (updateError) throw updateError;
            
            // Update UI
            document.getElementById('user-balance').textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`;
            document.getElementById('balance-amount').textContent = `${userBalance.toLocaleString()} Ks`;
            
            // Update transactions UI
            updateTransactionsUI(transactions, senderPhone);
            
            hideLoader();
            
            // Show receipt
            showReceipt(transaction, true);
            
            // Reset form
            transferForm.reset();
            verifiedUserInfo.classList.add('hidden');
            verifiedReceiver = null;
            receiverStatus.textContent = '';
            receiverStatus.className = 'input-status';
            amountInWords.textContent = 'သုည ကျပ်';
            
        } catch (error) {
            hideLoader();
            console.error('Transfer error:', error);
            alert('ငွေလွှဲရာတွင် အမှားရှိပါသည်');
        }
    }
    
    // Show receipt
    function showReceipt(transaction, isSender = true) {
        // Update receipt UI
        document.getElementById('receipt-amount').textContent = `${transaction.amount.toLocaleString()} Ks`;
        document.getElementById('receipt-amount-words').textContent = convertToMyanmarWords(transaction.amount) + ' ကျပ်';
        document.getElementById('receipt-transaction-id').textContent = transaction.id;
        document.getElementById('receipt-from').textContent = transaction.from_phone;
        document.getElementById('receipt-to').textContent = transaction.to_phone;
        document.getElementById('receipt-date').textContent = new Date(transaction.created_at).toLocaleString();
        
        const receiptStatusBadge = document.getElementById('receipt-status-badge');
        if (isSender) {
            receiptStatusBadge.textContent = 'ပို့ထားသော';
            receiptStatusBadge.className = 'receipt-status-badge sent';
        } else {
            receiptStatusBadge.textContent = 'လက်ခံရရှိသော';
            receiptStatusBadge.className = 'receipt-status-badge received';
        }
        
        // Handle note
        const receiptNoteContainer = document.getElementById('receipt-note-container');
        const receiptNote = document.getElementById('receipt-note');
        
        if (transaction.note) {
            receiptNote.textContent = transaction.note;
            receiptNoteContainer.style.display = 'flex';
        } else {
            receiptNoteContainer.style.display = 'none';
        }
        
        // Show receipt modal
        receiptModal.classList.add('active');
    }
    
    // Close receipt modal
    closeReceiptModal.addEventListener('click', () => {
        receiptModal.classList.remove('active');
    });
    
    closeReceiptBtn.addEventListener('click', () => {
        receiptModal.classList.remove('active');
    });
    
    // Download receipt
    downloadReceiptBtn.addEventListener('click', () => {
        const receiptContainer = document.getElementById('receipt-container');
        
        html2canvas(receiptContainer, {
            scale: 2,
            backgroundColor: 'white',
            logging: false
        }).then(canvas => {
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `OPPER_payment_receipt_${document.getElementById('receipt-transaction-id').textContent}.png`;
            link.click();
        });
    });
}

// Initialize history UI
function initializeHistoryUI() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const filter = tab.getAttribute('data-filter');
            
            // Update active tab
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Filter transactions
            const transactionItems = document.querySelectorAll('#history-transactions-list .transaction-item');
            
            transactionItems.forEach(item => {
                if (filter === 'all' || item.getAttribute('data-type') === filter) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });
}

// Show transaction receipt from history
function showTransactionReceipt(transactionId) {
    const transaction = transactions.find(t => t.id === transactionId);
    
    if (!transaction) return;
    
    // Get current user phone
    if (!currentUser) return;
    
    supabase
        .from('users')
        .select('phone')
        .eq('user_id', currentUser.user_id)
        .single()
        .then(({ data }) => {
            if (!data || !data.phone) return;
            
            const isSender = transaction.from_phone === data.phone;
            showReceipt(transaction, isSender);
        });
}

// Show receipt (used by both transfer and history)
function showReceipt(transaction, isSender = true) {
    // Update receipt UI
    document.getElementById('receipt-amount').textContent = `${transaction.amount.toLocaleString()} Ks`;
    document.getElementById('receipt-amount-words').textContent = convertToMyanmarWords(transaction.amount) + ' ကျပ်';
    document.getElementById('receipt-transaction-id').textContent = transaction.id;
    document.getElementById('receipt-from').textContent = transaction.from_phone;
    document.getElementById('receipt-to').textContent = transaction.to_phone;
    document.getElementById('receipt-date').textContent = new Date(transaction.created_at).toLocaleString();
    
    const receiptStatusBadge = document.getElementById('receipt-status-badge');
    if (isSender) {
        receiptStatusBadge.textContent = 'ပို့ထားသော';
        receiptStatusBadge.className = 'receipt-status-badge sent';
    } else {
        receiptStatusBadge.textContent = 'ငွေလက်ခံရရှိသည်';
        receiptStatusBadge.className = 'receipt-status-badge received';
    }
    
    // Handle note
    const receiptNoteContainer = document.getElementById('receipt-note-container');
    const receiptNote = document.getElementById('receipt-note');
    
    if (transaction.note) {
        receiptNote.textContent = transaction.note;
        receiptNoteContainer.style.display = 'flex';
    } else {
        receiptNoteContainer.style.display = 'none';
    }
    
    // Show receipt modal
    document.getElementById('receipt-modal').classList.add('active');
}

// Initialize KYC UI
function initializeKycUI() {
    const idFrontBtn = document.getElementById('id-front-btn');
    const idBackBtn = document.getElementById('id-back-btn');
    const idFrontInput = document.getElementById('id-front');
    const idBackInput = document.getElementById('id-back');
    const idFrontPlaceholder = document.getElementById('id-front-placeholder');
    const idBackPlaceholder = document.getElementById('id-back-placeholder');
    const submitKycBtn = document.getElementById('submit-kyc-btn');
    
    idFrontBtn.addEventListener('click', () => {
        idFrontInput.click();
    });
    
    idBackBtn.addEventListener('click', () => {
        idBackInput.click();
    });
    
    idFrontInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            idFrontPlaceholder.innerHTML = `<p>${this.files[0].name}</p>`;
        }
    });
    
    idBackInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            idBackPlaceholder.innerHTML = `<p>${this.files[0].name}</p>`;
        }
    });
    
    submitKycBtn.addEventListener('click', async () => {
        const passportNumber = document.getElementById('passport-number').value;
        
        if (!passportNumber) {
            alert('ကတ်ပြားနံပါတ်ထည့်ပါ');
            return;
        }
        
        if (!idFrontInput.files || !idFrontInput.files[0]) {
            alert('ကတ်ပြား (ရှေ့) ဓာတ်ပုံရွေးပါ');
            return;
        }
        
        if (!idBackInput.files || !idBackInput.files[0]) {
            alert('ကတ်ပြား (နောက်) ဓာတ်ပုံရွေးပါ');
            return;
        }
        
        try {
            showLoader();
            
            // In real app, this would upload images to storage
            // For demo, we'll just update the status
            
            // Update user KYC status
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    passport_number: passportNumber,
                    passport_image: 'uploaded',
                    passport_status: 'pending'
                })
                .eq('user_id', currentUser.user_id);
            
            if (updateError) throw updateError;
            
            // Update UI
            userKycStatus = 'pending';
            updateKycStatus();
            
            hideLoader();
            alert('KYC အချက်အလက်များ အောင်မြင်စွာတင်သွင်းပြီးပါပြီ');
            
        } catch (error) {
            hideLoader();
            console.error('KYC submission error:', error);
            alert('KYC တင်သွင်းရာတွင် အမှားရှိပါသည်');
        }
    });
}

// Initialize settings UI
function initializeSettingsUI() {
    const updateProfileBtn = document.getElementById('update-profile-btn');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const setPaymentPinBtn = document.getElementById('set-payment-pin-btn');
    
    updateProfileBtn.addEventListener('click', async () => {
        const name = document.getElementById('settings-name').value;
        
        try {
            showLoader();
            
            // Update user profile
            const { error } = await supabase
                .from('users')
                .update({ name: name })
                .eq('user_id', currentUser.user_id);
            
            if (error) throw error;
            
            hideLoader();
            alert('ပရိုဖိုင်မွမ်းမံပြီးပါပြီ');
            
        } catch (error) {
            hideLoader();
            console.error('Update profile error:', error);
            alert('ပရိုဖိုင်မွမ်းမံရာတွင် အမှားရှိပါသည်');
        }
    });
    
    changePasswordBtn.addEventListener('click', async () => {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmNewPassword = document.getElementById('confirm-new-password').value;
        
        if (!currentPassword || !newPassword || !confirmNewPassword) {
            alert('အချက်အလက်အားလုံးဖြည့်ပါ');
            return;
        }
        
        if (newPassword !== confirmNewPassword) {
            alert('စကားဝှက်အသစ် နှစ်ခု မတူညီပါ');
            return;
        }
        
        try {
            showLoader();
            
            // Verify current password
            const { data, error } = await supabase
                .from('auth_users')
                .select('password')
                .eq('user_id', currentUser.user_id)
                .single();
            
            if (error) throw error;
            
            if (data.password !== currentPassword) {
                hideLoader();
                alert('လက်ရှိစကားဝှက် မမှန်ကန်ပါ');
                return;
            }
            
            // Update password
            const { error: updateError } = await supabase
                .from('auth_users')
                .update({ password: newPassword })
                .eq('user_id', currentUser.user_id);
            
            if (updateError) throw updateError;
            
            hideLoader();
            alert('စကားဝှက်ပြောင်းပြီးပါပြီ');
            
            // Clear form
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-new-password').value = '';
            
        } catch (error) {
            hideLoader();
            console.error('Change password error:', error);
            alert('စကားဝှက်ပြောင်းရာတွင် အမှားရှိပါသည်');
        }
    });
    
    setPaymentPinBtn.addEventListener('click', () => {
        // Prompt for payment PIN
        const pinInput = prompt('သင်၏ 6 လုံးပါ Payment PIN ကို ထည့်ပါ:');
        
        if (!pinInput) return;
        
        if (pinInput.length !== 6 || !/^\d+$/.test(pinInput)) {
            alert('PIN ကုဒ်သည် ဂဏန်း 6 လုံး ဖြစ်ရပါမည်');
            return;
        }
        
        // Set PIN
        userPin = pinInput;
        localStorage.setItem('userPin', userPin);
        
        alert('Payment PIN သတ်မှတ်ပြီးပါပြီ');
    });
}

// Helper function to convert numbers to Myanmar words
function convertToMyanmarWords(num) {
    if (num === 0) return 'သုည';
    
    const units = ['', 'တစ်', 'နှစ်', 'သုံး', 'လေး', 'ငါး', 'ခြောက်', 'ခုနစ်', 'ရှစ်', 'ကိုး'];
    const teens = ['ဆယ်', 'ဆယ့်တစ်', 'ဆယ့်နှစ်', 'ဆယ့်သုံး', 'ဆယ့်လေး', 'ဆယ့်ငါး', 'ဆယ့်ခြောက်', 'ဆယ့်ခုနစ်', 'ဆယ့်ရှစ်', 'ဆယ့်ကိုး'];
    const tens = ['', 'ဆယ်', 'နှစ်ဆယ်', 'သုံးဆယ်', 'လေးဆယ်', 'ငါးဆယ်', 'ခြောက်ဆယ်', 'ခုနစ်ဆယ်', 'ရှစ်ဆယ်', 'ကိုးဆယ်'];
    
    function process(n) {
        if (n < 10) return units[n];
        if (n < 20) return teens[n - 10];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? units[n % 10] : '');
        if (n < 1000) return units[Math.floor(n / 100)] + 'ရာ' + (n % 100 ? process(n % 100) : '');
        if (n < 1000000) return process(Math.floor(n / 1000)) + 'ထောင်' + (n % 1000 ? process(n % 1000) : '');
        if (n < 10000000) return process(Math.floor(n / 100000)) + 'သိန်း' + (n % 100000 ? process(n % 100000) : '');
        return process(Math.floor(n / 10000000)) + 'ကုဋေ' + (n % 10000000 ? process(n % 10000000) : '');
    }
    
    return process(num);
}
