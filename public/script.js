// Supabase Configuration
const supabaseUrl = 'https://vtsczzlnhsrgnbkfyizi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, { fetch: (...args) => fetch(...args) });

// Global Variables
let currentUser = null;
let userBalance = 0;
let userKycStatus = 'pending';
let transfersEnabled = true;
let currentTheme = localStorage.getItem('theme') || 'light'; // Default to light if nothing stored
let transactions = [];

// DOM Elements
const loader = document.getElementById('loader');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const pinEntryModal = document.getElementById('pin-entry-modal');
const receiptModal = document.getElementById('receipt-modal');
const processingOverlay = document.getElementById('processing-overlay');

// Audio Elements
const clickSound = document.getElementById('click-sound');
const transferSentSound = document.getElementById('transfer-sent-sound');
const transferReceivedSound = document.getElementById('transfer-received-sound');

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    // Apply saved theme or default
    document.body.setAttribute('data-theme', currentTheme);
    
    // Show loader
    showLoader();
    
    // Check if user is logged in
    await checkSession();
    
    // Initialize UI elements
    initializeUI();
    
    // Hide loader after initialization
    setTimeout(hideLoader, 1500); // Adjusted timeout for potentially faster load perception
});

// Check if user is logged in
async function checkSession() {
    try {
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
                localStorage.removeItem('opperSession');
                showAuthContainer();
                return;
            }
            
            currentUser = user;
            await loadUserData();
            showAppContainer();
        } else {
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
        
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('user_id', currentUser.user_id)
            .single();
        
        if (userError) throw userError;
        
        userBalance = userData.balance || 0;
        userKycStatus = userData.passport_status || 'pending';
        
        updateUserUI(userData);
        
        const { data: settings, error: settingsError } = await supabase
            .from('settings')
            .select('allow_transfers')
            .eq('id', 1) // Assuming settings table has a single row with id 1
            .single();
        
        if (!settingsError && settings) {
            transfersEnabled = settings.allow_transfers;
            updateTransferStatus();
        }
        
        setupRealtimeSubscriptions();
        loadTransactions();
    } catch (error) {
        console.error('Load user data error:', error);
    }
}

// Update UI with user data
function updateUserUI(userData) {
    const userInitial = currentUser.email.charAt(0).toUpperCase();
    const userName = userData.name || currentUser.email.split('@')[0]; // Use userData.name if available

    document.getElementById('user-initial').textContent = userInitial;
    document.getElementById('user-initial-sidebar').textContent = userInitial;
    document.getElementById('user-name').textContent = userName;
    document.getElementById('user-name-sidebar').textContent = userName;
    document.getElementById('user-id').textContent = `ID: ${currentUser.user_id}`;
    document.getElementById('user-id-sidebar').textContent = `ID: ${currentUser.user_id}`;
    document.getElementById('greeting-name').textContent = userName;
    
    document.getElementById('user-balance').textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`;
    document.getElementById('balance-amount').textContent = `${userBalance.toLocaleString()} Ks`;
    
    updateKycStatus();
    
    document.getElementById('settings-phone').value = userData.phone || '';
    document.getElementById('settings-email').value = currentUser.email || '';
}

// Update KYC status in UI
function updateKycStatus() {
    const kycStatusElement = document.getElementById('kyc-status');
    const kycStatusCard = document.getElementById('kyc-status-card'); // This element exists in HTML
    const kycForm = document.getElementById('kyc-form');
    const kycStatusMessage = document.getElementById('kyc-status-message');
    const kycStatusIcon = document.querySelector('.kyc-status-icon'); // Ensure this selector is correct
    
    if (!kycStatusElement || !kycForm || !kycStatusMessage || !kycStatusIcon || !kycStatusCard) {
        console.warn('KYC UI elements not found.');
        return;
    }

    kycStatusIcon.classList.remove('pending', 'approved', 'rejected');
    
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
    } else { // pending or any other status
        kycStatusElement.textContent = 'KYC: စောင့်ဆိုင်းဆဲ';
        kycStatusMessage.textContent = 'သင့် KYC စိစစ်နေဆဲဖြစ်ပါသည်။';
        kycStatusIcon.classList.add('pending');
        kycStatusIcon.innerHTML = '<i class="fas fa-clock"></i>';
        
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
                }).catch(err => console.error("Error checking KYC form display status:", err));
        }
    }
}

// Update transfer status in UI
function updateTransferStatus() {
    const transferStatusElement = document.getElementById('transfer-status');
    if (!transferStatusElement) return;

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
    if (!currentUser) return;

    // Subscribe to user balance changes
    supabase
        .channel(`user-updates-${currentUser.user_id}`) // Unique channel per user
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'users',
            filter: `user_id=eq.${currentUser.user_id}`
        }, (payload) => {
            if (payload.new.balance !== undefined && payload.new.balance !== userBalance) {
                userBalance = payload.new.balance;
                document.getElementById('user-balance').textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`;
                document.getElementById('balance-amount').textContent = `${userBalance.toLocaleString()} Ks`;
            }
            if (payload.new.passport_status && payload.new.passport_status !== userKycStatus) {
                userKycStatus = payload.new.passport_status;
                updateKycStatus();
            }
        })
        .subscribe();
    
    // Subscribe to system settings changes
    supabase
        .channel('settings-updates')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'settings'
            // filter: `id=eq.1` // If settings table has a specific row for global settings
        }, (payload) => {
            // Assuming the settings table might have multiple rows, or a specific one.
            // If it's always row id 1:
            if (payload.new.id === 1 && payload.new.allow_transfers !== undefined && payload.new.allow_transfers !== transfersEnabled) {
                transfersEnabled = payload.new.allow_transfers;
                updateTransferStatus();
            }
        })
        .subscribe();
    
    // Subscribe to new transactions
    supabase
        .channel(`transactions-updates-${currentUser.user_id}`) // Potentially unique channel
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions'
            // No client-side filter here, logic below will check if it's relevant
        }, async (payload) => {
            if (currentUser) {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('phone')
                    .eq('user_id', currentUser.user_id)
                    .single();

                if (userError || !userData || !userData.phone) {
                    console.warn('Could not get user phone for transaction sound/update:', userError);
                    // Fallback: if the transaction involves user_id directly (if such fields exist)
                    // or if currentUser.phone was somehow populated elsewhere.
                    // This part depends on how robust you want the fallback to be.
                    // For now, just try to load transactions if it seems plausible.
                    if ( (payload.new.from_user_id && payload.new.from_user_id === currentUser.user_id) || 
                         (payload.new.to_user_id && payload.new.to_user_id === currentUser.user_id) ) {
                        loadTransactions();
                    }
                    return;
                }
                const userPhone = userData.phone;

                if (payload.new.from_phone === userPhone || payload.new.to_phone === userPhone) {
                    if (payload.new.to_phone === userPhone && payload.new.from_phone !== userPhone) {
                        if (transferReceivedSound) {
                            transferReceivedSound.currentTime = 0;
                            transferReceivedSound.play().catch(error => console.warn("Transfer received sound play failed:", error));
                        }
                    }
                    loadTransactions();
                }
            }
        })
        .subscribe();
}

// Load transactions
async function loadTransactions() {
    try {
        if (!currentUser) return;
        
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('phone')
            .eq('user_id', currentUser.user_id)
            .single();
        
        if (userError || !userData || !userData.phone) return;
        const userPhone = userData.phone;
        
        const { data: transactionsData, error } = await supabase
            .from('transactions')
            .select('*')
            .or(`from_phone.eq.${userPhone},to_phone.eq.${userPhone}`)
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        transactions = transactionsData || [];
        updateTransactionsUI(transactions, userPhone);
    } catch (error) {
        console.error('Load transactions error:', error);
    }
}

// Update transactions UI
function updateTransactionsUI(transactionsData, userPhone) { // Renamed transactions to transactionsData to avoid conflict
    const recentTransactionsList = document.getElementById('recent-transactions-list');
    const historyTransactionsList = document.getElementById('history-transactions-list');
    
    if (!recentTransactionsList || !historyTransactionsList) return;

    recentTransactionsList.innerHTML = '';
    historyTransactionsList.innerHTML = '';
    
    if (!transactionsData || transactionsData.length === 0) {
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
    
    transactionsData.forEach((transaction, index) => {
        const isSender = transaction.from_phone === userPhone;
        const otherParty = isSender ? transaction.to_phone : transaction.from_phone;
        const transactionDate = new Date(transaction.created_at).toLocaleString('my-MM', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }); // Localized date format
        
        const transactionItem = `
            <div class="transaction-item ${isSender ? 'sent' : 'received'} clickable">
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
                <div class="transaction-actions">
                    <div class="transaction-amount ${isSender ? 'negative' : 'positive'}">
                        ${isSender ? '-' : '+'} ${transaction.amount.toLocaleString()} Ks
                    </div>
                    <button class="transaction-view-btn clickable" data-transaction-index="${index}">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
        `;
        
        if (index < 5) {
            recentTransactionsList.innerHTML += transactionItem;
        }
        historyTransactionsList.innerHTML += transactionItem;
    });
    
    document.querySelectorAll('.transaction-view-btn').forEach(button => {
        button.addEventListener('click', () => {
            const transactionIndex = button.getAttribute('data-transaction-index');
            showTransactionReceipt(transactionsData[transactionIndex]); // Use transactionsData
        });
    });
    // Re-apply click sound listeners if new .clickable elements were added
    addClickSoundToClickableElements();
}

// Initialize UI elements
function initializeUI() {
    addClickSoundToClickableElements();

    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            const tabIndicator = document.querySelector('.tab-indicator');

            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            authForms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${tabName}-form`) {
                    form.classList.add('active');
                }
            });

            if (tabIndicator) {
                if (tabName === 'signup') {
                    tabIndicator.style.transform = 'translateX(calc(100% + 4px))';
                } else {
                    tabIndicator.style.transform = 'translateX(0%)';
                }
            }
        });
    });
    
    const togglePasswordButtons = document.querySelectorAll('.toggle-password');
    togglePasswordButtons.forEach(button => {
        button.addEventListener('click', () => {
            const input = button.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                button.classList.remove('fa-eye-slash');
                button.classList.add('fa-eye');
            } else {
                input.type = 'password';
                button.classList.remove('fa-eye');
                button.classList.add('fa-eye-slash');
            }
        });
    });
    
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a');
    const pages = document.querySelectorAll('.page');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageName = link.getAttribute('data-page');
            showPage(pageName);
        });
    });
    
    const actionCards = document.querySelectorAll('.action-card');
    actionCards.forEach(card => {
        card.addEventListener('click', () => {
            const pageName = card.getAttribute('data-page');
            showPage(pageName);
        });
    });
    
    const menuToggle = document.getElementById('menu-toggle');
    const closeSidebar = document.getElementById('close-sidebar');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) menuToggle.addEventListener('click', () => sidebar.classList.add('active'));
    if (closeSidebar && sidebar) closeSidebar.addEventListener('click', () => sidebar.classList.remove('active'));
    
    const profileDropdownTrigger = document.getElementById('profile-dropdown-trigger');
    const profileDropdown = document.getElementById('profile-dropdown');
    if (profileDropdownTrigger && profileDropdown) {
        profileDropdownTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('active');
            const rect = profileDropdownTrigger.getBoundingClientRect();
            profileDropdown.style.top = `${rect.bottom + 10}px`;
            profileDropdown.style.right = `${window.innerWidth - rect.right}px`;
        });
    }
    
    document.addEventListener('click', (e) => {
        if (profileDropdown && !profileDropdown.contains(e.target) && profileDropdownTrigger && !profileDropdownTrigger.contains(e.target)) {
            profileDropdown.classList.remove('active');
        }
    });
    
    const viewProfileBtn = document.getElementById('view-profile');
    if (viewProfileBtn) viewProfileBtn.addEventListener('click', () => showPage('settings'));
    
    const goToSettingsBtn = document.getElementById('go-to-settings');
    if (goToSettingsBtn) goToSettingsBtn.addEventListener('click', () => showPage('settings'));

    const dropdownLogoutBtn = document.getElementById('dropdown-logout');
    if (dropdownLogoutBtn) dropdownLogoutBtn.addEventListener('click', logout);
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    
    const refreshBalanceBtn = document.getElementById('refresh-balance');
    if (refreshBalanceBtn) refreshBalanceBtn.addEventListener('click', async () => await loadUserData());
    
    const hideBalanceBtn = document.getElementById('hide-balance');
    if (hideBalanceBtn) {
        hideBalanceBtn.addEventListener('click', () => {
            const balanceAmountEl = document.getElementById('balance-amount');
            const icon = hideBalanceBtn.querySelector('i');
            if (balanceAmountEl.classList.contains('hidden-balance')) {
                balanceAmountEl.textContent = `${userBalance.toLocaleString()} Ks`;
                balanceAmountEl.classList.remove('hidden-balance');
                if (icon) { icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
            } else {
                balanceAmountEl.textContent = '•••••• Ks'; // Added Ks for consistency
                balanceAmountEl.classList.add('hidden-balance');
                if (icon) { icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
            }
        });
    }
    
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const previewId = input.id.replace('-upload', '-preview');
            const preview = document.getElementById(previewId);
            if (!preview) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        });
    });
    
    const themeOptions = document.querySelectorAll('.theme-option');
    themeOptions.forEach(option => {
        if (option.getAttribute('data-theme') === currentTheme) {
            option.classList.add('active');
        }
        option.addEventListener('click', () => {
            const theme = option.getAttribute('data-theme');
            themeOptions.forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            document.body.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            currentTheme = theme;
        });
    });
    
    const modals = document.querySelectorAll('.modal');
    const modalTriggers = {
        'change-password-btn': 'change-password-modal',
        'change-pin-btn': 'change-pin-modal',
        'delete-account-btn': 'delete-account-modal'
    };
    Object.keys(modalTriggers).forEach(triggerId => {
        const trigger = document.getElementById(triggerId);
        const modalId = modalTriggers[triggerId];
        if (trigger) {
            trigger.addEventListener('click', () => {
                const modal = document.getElementById(modalId);
                if (modal) modal.classList.add('active');
            });
        }
    });
    
    const modalCloseButtons = document.querySelectorAll('.modal-close, .modal-cancel');
    modalCloseButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            if (modal) modal.classList.remove('active');
        });
    });
    
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    setupPinInputs();
    
    const downloadReceiptBtn = document.getElementById('download-receipt');
    if (downloadReceiptBtn) downloadReceiptBtn.addEventListener('click', downloadReceipt);
    
    setupFormSubmissions();
}

// Add click sound to all elements with 'clickable' class
function addClickSoundToClickableElements() {
    if (clickSound) {
        const clickableElements = document.querySelectorAll('.clickable');
        clickableElements.forEach(el => {
            // Remove existing listener to avoid duplicates if called multiple times
            el.removeEventListener('click', playClickSoundHandler); 
            el.addEventListener('click', playClickSoundHandler);
        });
    }
}

function playClickSoundHandler() {
    if (clickSound) {
        clickSound.currentTime = 0;
        clickSound.play().catch(error => console.warn("Click sound play failed:", error));
    }
}


// Setup PIN inputs
function setupPinInputs() {
    const pinInputs = document.querySelectorAll('.pin-input');
    pinInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value && index < pinInputs.length - 1) {
                pinInputs[index + 1].focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                pinInputs[index - 1].focus();
            }
        });
    });
    
    const confirmPinBtn = document.getElementById('confirm-pin-btn');
    if (confirmPinBtn) {
        confirmPinBtn.addEventListener('click', () => {
            let pin = '';
            pinInputs.forEach(input => { pin += input.value; });
            const pinErrorEl = document.getElementById('pin-error');

            if (pin.length !== 6) {
                if(pinErrorEl) {
                    pinErrorEl.textContent = 'PIN ၆ လုံး ထည့်ပါ';
                    pinErrorEl.style.display = 'block';
                }
                return;
            }
            if(pinErrorEl) pinErrorEl.style.display = 'none';
            processTransfer(pin);
        });
    }
}

// Setup form submissions
function setupFormSubmissions() {
    // Login form
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const errorElement = document.getElementById('login-error');
            const successElement = document.getElementById('login-success');
            
            if (!email || !password) {
                errorElement.textContent = 'အီးမေးလ်နှင့် စကားဝှက် ထည့်ပါ။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            try {
                const { data: user, error } = await supabase
                    .from('auth_users')
                    .select('*')
                    .eq('email', email)
                    .single();
                
                if (error || !user) {
                    errorElement.textContent = 'အကောင့်မတွေ့ရှိပါ။';
                    errorElement.style.display = 'block';
                    successElement.style.display = 'none';
                    return;
                }
                
                if (user.password !== password) { // Note: Plain text password check (demo only)
                    errorElement.textContent = 'စကားဝှက်မှားယွင်းနေပါသည်။';
                    errorElement.style.display = 'block';
                    successElement.style.display = 'none';
                    return;
                }
                
                currentUser = user;
                const sessionData = { email: user.email, user_id: user.user_id };
                localStorage.setItem('opperSession', JSON.stringify(sessionData));
                
                errorElement.style.display = 'none';
                successElement.textContent = 'အကောင့်ဝင်ရောက်နေပါသည်...';
                successElement.style.display = 'block';
                
                await loadUserData();
                showAppContainer();
                successElement.style.display = 'none'; // Hide after loading
            } catch (error) {
                console.error('Login error:', error);
                errorElement.textContent = 'အကောင့်ဝင်ရာတွင် အမှားရှိနေပါသည်။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
            }
        });
    }
    
    // Google login
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) googleLoginBtn.addEventListener('click', () => simulateGoogleLogin('login'));
    
    // Signup form
    const signupBtn = document.getElementById('signup-btn');
    if (signupBtn) {
        signupBtn.addEventListener('click', async () => {
            const email = document.getElementById('signup-email').value;
            const phone = document.getElementById('signup-phone').value;
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('signup-confirm-password').value;
            const termsAgree = document.getElementById('terms-agree').checked;
            const errorElement = document.getElementById('signup-error');
            const successElement = document.getElementById('signup-success');

            if (!email || !phone || !password || !confirmPassword) {
                errorElement.textContent = 'အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။';
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

            try {
                const { data: existingUserByEmail } = await supabase.from('auth_users').select('email').eq('email', email).single();
                if (existingUserByEmail) {
                    errorElement.textContent = 'ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။';
                    errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
                }
                const { data: existingUserByPhone } = await supabase.from('users').select('phone').eq('phone', phone).single();
                if (existingUserByPhone) {
                    errorElement.textContent = 'ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။';
                    errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
                }

                const userId = generateUserId(email);
                const { data: authUser, error: authError } = await supabase.from('auth_users').insert([{ email, password, user_id: userId }]).select().single();
                if (authError) throw authError;

                const { error: profileError } = await supabase.from('users').insert([{ user_id: userId, phone, balance: 0, passport_status: 'pending' }]);
                if (profileError) throw profileError;

                errorElement.style.display = 'none';
                successElement.textContent = 'အကောင့်ဖွင့်ပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။';
                successElement.style.display = 'block';
                
                document.getElementById('signup-form').reset(); // Reset form fields
                document.getElementById('terms-agree').checked = false;


                setTimeout(() => {
                    document.querySelector('.auth-tab[data-tab="login"]').click();
                    successElement.style.display = 'none';
                }, 2000);
            } catch (error) {
                console.error('Signup error:', error);
                errorElement.textContent = 'အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
            }
        });
    }

    // Google signup
    const googleSignupBtn = document.getElementById('google-signup-btn');
    if (googleSignupBtn) googleSignupBtn.addEventListener('click', () => simulateGoogleLogin('signup'));

    // Transfer form
    const transferBtn = document.getElementById('transfer-btn');
    if (transferBtn) {
        transferBtn.addEventListener('click', async () => {
            const phone = document.getElementById('transfer-phone').value;
            const amount = parseInt(document.getElementById('transfer-amount').value);
            // const note = document.getElementById('transfer-note').value; // Note is captured later in processTransfer
            const errorElement = document.getElementById('transfer-error');
            const successElement = document.getElementById('transfer-success');

            if (!phone || !amount) {
                errorElement.textContent = 'ဖုန်းနံပါတ်နှင့် ငွေပမာဏ ထည့်ပါ။';
                errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
            }
            if (amount < 1000) {
                errorElement.textContent = 'ငွေပမာဏ အနည်းဆုံး 1,000 Ks ဖြစ်ရပါမည်။';
                errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
            }
            if (!transfersEnabled) {
                errorElement.textContent = 'ငွေလွှဲခြင်းကို ယာယီပိတ်ထားပါသည်။ နောက်မှ ပြန်လည်ကြိုးစားပါ။';
                errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
            }
            if (userKycStatus !== 'approved') {
                errorElement.textContent = 'ငွေလွှဲရန် KYC အတည်ပြုရန် လိုအပ်ပါသည်။';
                errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
            }
            if (userBalance < amount) {
                errorElement.textContent = 'လက်ကျန်ငွေ မလုံလောက်ပါ။';
                errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
            }

            try {
                const { data: senderData } = await supabase.from('users').select('phone').eq('user_id', currentUser.user_id).single();
                if (senderData && senderData.phone === phone) {
                    errorElement.textContent = 'ကိုယ့်ကိုယ်ကို ငွေလွှဲ၍မရပါ။';
                    errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
                }

                const { data: recipient, error: recipientError } = await supabase.from('users').select('*').eq('phone', phone).single();
                if (recipientError || !recipient) {
                    errorElement.textContent = 'လက်ခံမည့်သူ မတွေ့ရှိပါ။';
                    errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
                }
                
                errorElement.style.display = 'none';
                showPinEntryModal();
            } catch (error) {
                console.error('Transfer validation error:', error);
                errorElement.textContent = 'ငွေလွှဲရာတွင် အမှားရှိနေပါသည်။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
            }
        });
    }

    // KYC form
    const kycSubmitBtn = document.getElementById('kyc-submit-btn');
    if (kycSubmitBtn) {
        kycSubmitBtn.addEventListener('click', async () => {
            const passportNumber = document.getElementById('kyc-passport').value;
            const address = document.getElementById('kyc-address').value;
            const pin = document.getElementById('kyc-pin').value;
            const confirmPin = document.getElementById('kyc-confirm-pin').value;
            const passportFile = document.getElementById('passport-upload').files[0];
            const selfieFile = document.getElementById('selfie-upload').files[0];
            const errorElement = document.getElementById('kyc-error');
            const successElement = document.getElementById('kyc-success');

            if (!passportNumber || !address || !pin || !confirmPin || !passportFile || !selfieFile) {
                errorElement.textContent = 'အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။';
                errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
            }
            if (pin !== confirmPin) {
                errorElement.textContent = 'PIN နှင့် အတည်ပြု PIN မတူညီပါ။';
                errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
            }
            if (pin.length !== 6 || !/^\d+$/.test(pin)) {
                errorElement.textContent = 'PIN သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။';
                errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
            }

            try {
                showLoader(); // Show loader during uploads
                const passportFileName = `passport_${currentUser.user_id}_${Date.now()}.${passportFile.name.split('.').pop()}`;
                const { error: passportError } = await supabase.storage.from('kyc-documents').upload(passportFileName, passportFile);
                if (passportError) throw passportError;
                const { data: passportUrlData } = supabase.storage.from('kyc-documents').getPublicUrl(passportFileName);

                const selfieFileName = `selfie_${currentUser.user_id}_${Date.now()}.${selfieFile.name.split('.').pop()}`;
                const { error: selfieError } = await supabase.storage.from('kyc-documents').upload(selfieFileName, selfieFile);
                if (selfieError) throw selfieError;
                const { data: selfieUrlData } = supabase.storage.from('kyc-documents').getPublicUrl(selfieFileName);

                const { error: updateError } = await supabase.from('users').update({
                    passport_number: passportNumber, address, payment_pin: pin,
                    passport_image: passportUrlData.publicUrl, selfie_image: selfieUrlData.publicUrl,
                    passport_status: 'pending', submitted_at: new Date().toISOString()
                }).eq('user_id', currentUser.user_id);
                if (updateError) throw updateError;

                errorElement.style.display = 'none';
                successElement.textContent = 'KYC အချက်အလက်များ အောင်မြင်စွာ တင်သွင်းပြီးပါပြီ။ စိစစ်နေပါပြီ။';
                successElement.style.display = 'block';
                userKycStatus = 'pending';
                updateKycStatus();
                document.getElementById('kyc-form').reset();
                document.getElementById('passport-preview').innerHTML = '';
                document.getElementById('selfie-preview').innerHTML = '';
                setTimeout(() => successElement.style.display = 'none', 3000);
            } catch (error) {
                console.error('KYC submission error:', error);
                errorElement.textContent = 'KYC တင်သွင်းရာတွင် အမှားရှိနေပါသည်။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
            } finally {
                hideLoader();
            }
        });
    }

    // Change password form
    const savePasswordBtn = document.getElementById('save-password-btn');
    if (savePasswordBtn) {
        savePasswordBtn.addEventListener('click', async () => {
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmNewPassword = document.getElementById('confirm-new-password').value;
            const errorElement = document.getElementById('change-password-error');
            const successElement = document.getElementById('change-password-success');

            if (!currentPassword || !newPassword || !confirmNewPassword) {
                errorElement.textContent = 'အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။';
                errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
            }
            if (newPassword !== confirmNewPassword) {
                errorElement.textContent = 'စကားဝှက်အသစ်နှင့် အတည်ပြုစကားဝှက် မတူညီပါ။';
                errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
            }

            try {
                const { data: user, error } = await supabase.from('auth_users').select('password').eq('user_id', currentUser.user_id).single();
                if (error) throw error;
                if (user.password !== currentPassword) { // Plain text check
                    errorElement.textContent = 'လက်ရှိစကားဝှက် မှားယွင်းနေပါသည်။';
                    errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
                }

                const { error: updateError } = await supabase.from('auth_users').update({ password: newPassword }).eq('user_id', currentUser.user_id);
                if (updateError) throw updateError;

                errorElement.style.display = 'none';
                successElement.textContent = 'စကားဝှက် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။';
                successElement.style.display = 'block';
                document.getElementById('change-password-modal').querySelector('form')?.reset(); // Assuming form tag wraps inputs

                setTimeout(() => {
                    document.getElementById('change-password-modal').classList.remove('active');
                    successElement.style.display = 'none';
                }, 2000);
            } catch (error) {
                console.error('Change password error:', error);
                errorElement.textContent = 'စကားဝှက်ပြောင်းရာတွင် အမှားရှိနေပါသည်။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
            }
        });
    }

    // Change PIN form
    const savePinBtn = document.getElementById('save-pin-btn');
    if (savePinBtn) {
        savePinBtn.addEventListener('click', async () => {
            const currentPin = document.getElementById('current-pin').value;
            const newPin = document.getElementById('new-pin').value;
            const confirmNewPin = document.getElementById('confirm-new-pin').value;
            const errorElement = document.getElementById('change-pin-error');
            const successElement = document.getElementById('change-pin-success');

            if (!currentPin || !newPin || !confirmNewPin) {
                errorElement.textContent = 'အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။';
                errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
            }
            if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
                errorElement.textContent = 'PIN အသစ်သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။';
                errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
            }
            if (newPin !== confirmNewPin) {
                errorElement.textContent = 'PIN အသစ်နှင့် အတည်ပြု PIN မတူညီပါ။';
                errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
            }

            try {
                const { data: user, error: fetchError } = await supabase.from('users').select('payment_pin').eq('user_id', currentUser.user_id).single();
                if (fetchError) throw fetchError;

                if (user.payment_pin !== currentPin) {
                    errorElement.textContent = 'လက်ရှိ PIN မှားယွင်းနေပါသည်။';
                    errorElement.style.display = 'block'; successElement.style.display = 'none'; return;
                }

                const { error: updateError } = await supabase.from('users').update({ payment_pin: newPin }).eq('user_id', currentUser.user_id);
                if (updateError) throw updateError;

                errorElement.style.display = 'none';
                successElement.textContent = 'PIN အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။';
                successElement.style.display = 'block';
                document.getElementById('change-pin-modal').querySelector('form')?.reset();


                setTimeout(() => {
                    document.getElementById('change-pin-modal').classList.remove('active');
                    successElement.style.display = 'none';
                }, 2000);
            } catch (error) {
                console.error('Change PIN error:', error);
                errorElement.textContent = 'PIN ပြောင်းရာတွင် အမှားရှိနေပါသည်။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
            }
        });
    }

    // Delete Account confirmation
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            const password = document.getElementById('delete-password').value;
            const confirmCheckbox = document.getElementById('confirm-delete').checked;
            const errorElement = document.getElementById('delete-account-error');

            if (!password) {
                errorElement.textContent = 'စကားဝှက်ထည့်ပါ။';
                errorElement.style.display = 'block'; return;
            }
            if (!confirmCheckbox) {
                errorElement.textContent = 'အကောင့်ဖျက်လိုကြောင်း အတည်ပြုပါ။';
                errorElement.style.display = 'block'; return;
            }

            try {
                const { data: authUser, error: fetchError } = await supabase.from('auth_users').select('password').eq('user_id', currentUser.user_id).single();
                if (fetchError) throw fetchError;

                if (authUser.password !== password) { // Plain text check
                    errorElement.textContent = 'စကားဝှက် မှားယွင်းနေပါသည်။';
                    errorElement.style.display = 'block'; return;
                }
                
                errorElement.style.display = 'none';
                // Actual deletion is complex and requires backend/admin rights.
                // For this demo, we will simulate by logging out.
                alert('အကောင့်ဖျက်ခြင်း လုပ်ဆောင်ချက်ကို ဤနေရာတွင် အကောင်အထည်ဖော်ရန် လိုအပ်ပါသည်။ လုံခြုံရေးအတွက်၊ ဤ client-side script မှ အသုံးပြုသူအကောင့်အပြည့်အစုံကို တိုက်ရိုက်ဖျက်မည်မဟုတ်ပါ။ ယခု အကောင့်မှထွက်ပါမည်။');
                
                document.getElementById('delete-account-modal').classList.remove('active');
                logout();

            } catch (error) {
                console.error('Delete account error:', error);
                errorElement.textContent = 'အကောင့်ဖျက်ရာတွင် အမှားရှိနေပါသည်။';
                errorElement.style.display = 'block';
            }
        });
    }
}

// Show PIN entry modal
function showPinEntryModal() {
    document.querySelectorAll('.pin-input').forEach(input => { input.value = ''; });
    const pinErrorEl = document.getElementById('pin-error');
    if(pinErrorEl) pinErrorEl.style.display = 'none';
    if(pinEntryModal) pinEntryModal.classList.add('active');
    const firstPinInput = document.querySelector('.pin-input');
    if(firstPinInput) firstPinInput.focus();
}

// Process transfer with PIN
async function processTransfer(pin) {
    const phone = document.getElementById('transfer-phone').value;
    const amount = parseInt(document.getElementById('transfer-amount').value);
    const note = document.getElementById('transfer-note').value;
    const errorElement = document.getElementById('transfer-error');
    const successElement = document.getElementById('transfer-success');
    
    if(pinEntryModal) pinEntryModal.classList.remove('active');
    if(processingOverlay) processingOverlay.classList.add('active');
    
    try {
        const { data: sender, error: senderError } = await supabase.from('users').select('*').eq('user_id', currentUser.user_id).single();
        if (senderError) throw senderError;

        if (sender.payment_pin !== pin) {
            if(processingOverlay) processingOverlay.classList.remove('active');
            errorElement.textContent = 'PIN မှားယွင်းနေပါသည်။';
            errorElement.style.display = 'block'; successElement.style.display = 'none';
            return;
        }
        
        const { data: recipient, error: recipientError } = await supabase.from('users').select('*').eq('phone', phone).single();
        if (recipientError || !recipient) { // Check if recipient was found
             if(processingOverlay) processingOverlay.classList.remove('active');
             errorElement.textContent = 'လက်ခံမည့်သူ မတွေ့ရှိပါ။'; // This error was missing if recipient check failed earlier
             errorElement.style.display = 'block'; successElement.style.display = 'none';
             return;
        }
        
        const transactionId = `OPPER${Math.floor(1000000 + Math.random() * 9000000)}`;
        const transactionPayload = {
            id: transactionId, from_phone: sender.phone, from_name: sender.name || sender.phone,
            to_phone: recipient.phone, to_name: recipient.name || recipient.phone,
            amount, note, created_at: new Date().toISOString()
        };
        const { data: transaction, error: transactionError } = await supabase.from('transactions').insert([transactionPayload]).select().single();
        if (transactionError) throw transactionError;
        
        await supabase.from('users').update({ balance: sender.balance - amount }).eq('user_id', sender.user_id);
        await supabase.from('users').update({ balance: recipient.balance + amount }).eq('user_id', recipient.user_id); // Use recipient.user_id
        
        userBalance -= amount;
        document.getElementById('user-balance').textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`;
        document.getElementById('balance-amount').textContent = `${userBalance.toLocaleString()} Ks`;
        
        setTimeout(() => {
            if(processingOverlay) processingOverlay.classList.remove('active');
            errorElement.style.display = 'none';
            successElement.textContent = `${amount.toLocaleString()} Ks ကို ${phone} သို့ အောင်မြင်စွာ လွှဲပြောင်းပြီးပါပြီ။`;
            successElement.style.display = 'block';
            
            if (transferSentSound) {
                transferSentSound.currentTime = 0;
                transferSentSound.play().catch(error => console.warn("Transfer sent sound play failed:", error));
            }

            showTransactionReceipt(transaction);
            document.getElementById('transfer-phone').value = '';
            document.getElementById('transfer-amount').value = '';
            document.getElementById('transfer-note').value = '';
            loadTransactions();
            setTimeout(() => successElement.style.display = 'none', 3000);
        }, 2000);
    } catch (error) {
        console.error('Transfer error:', error);
        if(processingOverlay) processingOverlay.classList.remove('active');
        errorElement.textContent = 'ငွေလွှဲရာတွင် အမှားရှိနေပါသည်။';
        errorElement.style.display = 'block';
        successElement.style.display = 'none';
    }
}

// Show transaction receipt
function showTransactionReceipt(transaction) {
    supabase.from('users').select('phone').eq('user_id', currentUser.user_id).single()
        .then(({ data: userData }) => {
            if (!userData) return;
            const userPhone = userData.phone;
            const isSender = transaction.from_phone === userPhone;
            const transactionDate = new Date(transaction.created_at).toLocaleString('my-MM', {
                 year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const receiptHTML = `
                <div class="receipt">
                    <div class="receipt-logo-area">
                        <div class="opper-logo-container">
                            <img src="https://github.com/Opper125/opper-payment/raw/main/logo.png" alt="OPPER Logo" class="opper-logo-img">
                            <span class="opper-logo-text">OPPER Pay</span>
                        </div>
                        <img src="https://github.com/Opper125/opper-payment/raw/main/github.png" alt="GitHub Logo" class="github-logo-img">
                    </div>
                    <div class="receipt-status">
                        <div class="receipt-status-icon ${isSender ? 'sent' : 'received'}">
                            <i class="fas ${isSender ? 'fa-paper-plane' : 'fa-check-circle'}"></i>
                        </div>
                        <div class="receipt-status-text">
                            ${isSender ? 'ငွေပေးပို့ပြီးပါပြီ' : 'ငွေလက်ခံရရှိပါပြီ'}
                        </div>
                    </div>
                    <div class="receipt-amount">
                        <div class="receipt-amount-label">ငွေပမာဏ</div>
                        <div class="receipt-amount-value">${transaction.amount.toLocaleString()} Ks</div>
                    </div>
                    <div class="receipt-details">
                        <div class="receipt-detail-row">
                            <div class="receipt-detail-label">From</div>
                            <div class="receipt-detail-value">${transaction.from_name} (${transaction.from_phone})</div>
                        </div>
                        <div class="receipt-detail-row">
                            <div class="receipt-detail-label">To</div>
                            <div class="receipt-detail-value">${transaction.to_name} (${transaction.to_phone})</div>
                        </div>
                        ${transaction.note ? `
                        <div class="receipt-detail-row">
                            <div class="receipt-detail-label">Note</div>
                            <div class="receipt-detail-value">${transaction.note}</div>
                        </div>` : ''}
                        <div class="receipt-detail-row">
                            <div class="receipt-detail-label">Date</div>
                            <div class="receipt-detail-value">${transactionDate}</div>
                        </div>
                        <div class="receipt-detail-row">
                            <div class="receipt-detail-label">Payment Method</div>
                            <div class="receipt-detail-value">OPPER Pay</div>
                        </div>
                    </div>
                    <div class="receipt-transaction-id">
                        <div class="receipt-transaction-id-label">ငွေလွှဲလုပ်ဆောင်ချက်အမှတ်စဥ်</div>
                        <div class="receipt-transaction-id-value">${transaction.id}</div>
                    </div>
                    <div class="receipt-footer">
                        OPPER Payment ကိုအသုံးပြုသည့်အတွက် ကျေးဇူးတင်ပါသည်
                    </div>
                </div>`;
            
            const receiptContainer = document.getElementById('receipt-container');
            if (receiptContainer) receiptContainer.innerHTML = receiptHTML;
            if (receiptModal) receiptModal.classList.add('active');
        }).catch(err => console.error("Error fetching user phone for receipt:", err));
}

// Download receipt as PNG
function downloadReceipt() {
    const receiptElement = document.getElementById('receipt-container');
    if (!receiptElement || typeof html2canvas === 'undefined') {
        console.error("Receipt element or html2canvas not found.");
        return;
    }
    html2canvas(receiptElement, { scale: 2, useCORS: true }).then(canvas => { // Added scale and useCORS
        const link = document.createElement('a');
        link.download = `OPPER-Receipt-${transaction.id || Date.now()}.png`; // Use transaction ID if available
        link.href = canvas.toDataURL('image/png');
        link.click();
    }).catch(err => console.error("Error generating receipt image:", err));
}

// Simulate Google login/signup
async function simulateGoogleLogin(type) { // Made async
    const googleEmail = 'user@gmail.com';
    // const googleName = 'User'; // Not directly used for user creation here
    const errorElementId = type === 'login' ? 'login-error' : 'signup-error';
    const successElementId = type === 'login' ? 'login-success' : 'signup-success';
    const errorElement = document.getElementById(errorElementId);
    const successElement = document.getElementById(successElementId);

    try {
        if (type === 'login') {
            const { data: user, error } = await supabase.from('auth_users').select('*').eq('email', googleEmail).single();
            if (error || !user) {
                errorElement.textContent = 'Google အကောင့်ဖြင့် အကောင့်မတွေ့ရှိပါ။ အကောင့်ဖွင့်ပါ။';
                errorElement.style.display = 'block'; return;
            }
            currentUser = user;
            localStorage.setItem('opperSession', JSON.stringify({ email: user.email, user_id: user.user_id }));
            successElement.textContent = 'Google ဖြင့် အကောင့်ဝင်ရောက်နေပါသည်...';
            successElement.style.display = 'block';
            await loadUserData();
            showAppContainer();
            successElement.style.display = 'none';
        } else if (type === 'signup') {
            const { data: existingUser } = await supabase.from('auth_users').select('email').eq('email', googleEmail).single();
            if (existingUser) {
                errorElement.textContent = 'ဤ Google အကောင့်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။';
                errorElement.style.display = 'block'; return;
            }
            const userId = generateUserId(googleEmail);
            const { data: authUser, error: authError } = await supabase.from('auth_users').insert([{ email: googleEmail, password: 'google-auth', user_id: userId }]).select().single();
            if (authError) throw authError;

            const { error: profileError } = await supabase.from('users').insert([{ user_id: userId, balance: 0, passport_status: 'pending' }]); // Add phone if available/required
            if (profileError) throw profileError;

            successElement.textContent = 'Google ဖြင့် အကောင့်ဖွင့်ပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။';
            successElement.style.display = 'block';
            setTimeout(() => {
                document.querySelector('.auth-tab[data-tab="login"]').click();
                successElement.style.display = 'none';
            }, 2000);
        }
    } catch (error) {
        console.error(`Google ${type} error:`, error);
        errorElement.textContent = `Google ဖြင့် ${type === 'login' ? 'အကောင့်ဝင်' : 'အကောင့်ဖွင့်'}ရာတွင် အမှားရှိနေပါသည်။`;
        errorElement.style.display = 'block';
        if (successElement) successElement.style.display = 'none';
    }
}

// Generate user ID based on email
function generateUserId(email) {
    const username = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').slice(0, 4); // Sanitize and shorten
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const timestamp = Date.now().toString().slice(-4);
    return `${username}${randomNum}${timestamp}`;
}

// Show specific page
function showPage(pageName) {
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a');
    sidebarLinks.forEach(link => {
        link.parentElement.classList.remove('active');
        if (link.getAttribute('data-page') === pageName) {
            link.parentElement.classList.add('active');
        }
    });
    
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
        page.classList.remove('active');
        if (page.id === `${pageName}-page`) {
            page.classList.add('active');
        }
    });
    
    const profileDropdownEl = document.getElementById('profile-dropdown');
    if (profileDropdownEl) profileDropdownEl.classList.remove('active');
    
    const sidebarEl = document.getElementById('sidebar');
    if (window.innerWidth < 992 && sidebarEl) {
        sidebarEl.classList.remove('active');
    }
}

// Logout function
function logout() {
    localStorage.removeItem('opperSession');
    currentUser = null;
    // Optionally, unsubscribe from Supabase channels if they are stored globally
    // supabase.removeAllChannels(); // Or specific channels
    showAuthContainer();
}

// Show loader
function showLoader() { if(loader) loader.classList.add('active'); }
// Hide loader
function hideLoader() { if(loader) loader.classList.remove('active'); }
// Show auth container
function showAuthContainer() {
    if(authContainer) authContainer.classList.remove('hidden');
    if(appContainer) appContainer.classList.add('hidden');
}
// Show app container
function showAppContainer() {
    if(authContainer) authContainer.classList.add('hidden');
    if(appContainer) appContainer.classList.remove('hidden');
}
