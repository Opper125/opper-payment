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
let autoDownloadReceiptEnabled = false;

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
    document.body.setAttribute('data-theme', currentTheme);
    showLoader();
    try {
        await checkSession(); // Handles showing app or auth container
        initializeUI();       // Initialize UI elements and event listeners
    } catch (error) {
        console.error("Error during initial setup:", error);
        if (!currentUser) { // Fallback if critical error during init
            showAuthContainer();
        }
    } finally {
        // Hide loader after a delay, allowing content to render
        setTimeout(hideLoader, 1000); // Adjusted delay
    }
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
                currentUser = null;
                showAuthContainer();
                return;
            }
            currentUser = user;
            await loadUserData();
            showAppContainer();
        } else {
            currentUser = null;
            showAuthContainer();
        }
    } catch (error) {
        console.error('Session check error:', error);
        localStorage.removeItem('opperSession');
        currentUser = null;
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
            .eq('id', 1)
            .single();
        if (!settingsError && settings) {
            transfersEnabled = settings.allow_transfers;
            updateTransferStatus();
        }
        setupRealtimeSubscriptions();
        loadTransactions();
    } catch (error) {
        console.error('Load user data error:', error);
        // Potentially show an error message to the user or retry
    }
}

// Update UI with user data
function updateUserUI(userData) {
    if (!currentUser || !userData) return;

    const userInitial = currentUser.email.charAt(0).toUpperCase();
    const userName = userData.name || currentUser.email.split('@')[0];

    const userInitialEl = document.getElementById('user-initial');
    const userInitialSidebarEl = document.getElementById('user-initial-sidebar');
    const userNameEl = document.getElementById('user-name');
    const userNameSidebarEl = document.getElementById('user-name-sidebar');
    const userIdEl = document.getElementById('user-id');
    const userIdSidebarEl = document.getElementById('user-id-sidebar');
    const greetingNameEl = document.getElementById('greeting-name');
    const userBalanceEl = document.getElementById('user-balance');
    const balanceAmountEl = document.getElementById('balance-amount');
    const settingsPhoneEl = document.getElementById('settings-phone');
    const settingsEmailEl = document.getElementById('settings-email');

    if (userInitialEl) userInitialEl.textContent = userInitial;
    if (userInitialSidebarEl) userInitialSidebarEl.textContent = userInitial;
    if (userNameEl) userNameEl.textContent = userName;
    if (userNameSidebarEl) userNameSidebarEl.textContent = userName;
    if (userIdEl) userIdEl.textContent = `ID: ${currentUser.user_id}`;
    if (userIdSidebarEl) userIdSidebarEl.textContent = `ID: ${currentUser.user_id}`;
    if (greetingNameEl) greetingNameEl.textContent = userName;
    
    if (userBalanceEl) userBalanceEl.textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`;
    if (balanceAmountEl) balanceAmountEl.textContent = `${userBalance.toLocaleString()} Ks`;
    
    updateKycStatus();
    
    if (settingsPhoneEl) settingsPhoneEl.value = userData.phone || '';
    if (settingsEmailEl) settingsEmailEl.value = currentUser.email || '';
}

// Update KYC status in UI
function updateKycStatus() {
    const kycStatusElement = document.getElementById('kyc-status');
    const kycForm = document.getElementById('kyc-form');
    const kycStatusMessage = document.getElementById('kyc-status-message');
    const kycStatusIcon = document.querySelector('.kyc-status-icon');
    
    if (!kycStatusElement || !kycForm || !kycStatusMessage || !kycStatusIcon) return;

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
    } else {
        kycStatusElement.textContent = 'KYC: စောင့်ဆိုင်းဆဲ';
        kycStatusMessage.textContent = 'သင့် KYC စိစစ်နေဆဲဖြစ်ပါသည်။';
        kycStatusIcon.classList.add('pending');
        kycStatusIcon.innerHTML = '<i class="fas fa-clock"></i>';
        if (currentUser) {
            supabase.from('users').select('passport_number, passport_image').eq('user_id', currentUser.user_id).single()
                .then(({ data }) => {
                    if (data) kycForm.style.display = (data.passport_number && data.passport_image) ? 'none' : 'block';
                }).catch(err => console.error("Error checking KYC form display:", err));
        } else {
             kycForm.style.display = 'block'; // Default if no current user
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
    supabase.channel(`user-updates-${currentUser.user_id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `user_id=eq.${currentUser.user_id}`}, payload => {
            if (payload.new.balance !== undefined && payload.new.balance !== userBalance) {
                userBalance = payload.new.balance;
                const userBalanceEl = document.getElementById('user-balance');
                const balanceAmountEl = document.getElementById('balance-amount');
                if (userBalanceEl) userBalanceEl.textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`;
                if (balanceAmountEl && !balanceAmountEl.classList.contains('hidden-balance')) {
                     balanceAmountEl.textContent = `${userBalance.toLocaleString()} Ks`;
                }
            }
            if (payload.new.passport_status && payload.new.passport_status !== userKycStatus) {
                userKycStatus = payload.new.passport_status;
                updateKycStatus();
            }
        }).subscribe();
    
    supabase.channel('settings-updates')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings'}, payload => {
            if (payload.new.id === 1 && payload.new.allow_transfers !== undefined && payload.new.allow_transfers !== transfersEnabled) {
                transfersEnabled = payload.new.allow_transfers;
                updateTransferStatus();
            }
        }).subscribe();
    
    supabase.channel(`transactions-updates-${currentUser.user_id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions'}, async payload => {
            if (currentUser) {
                const { data: userData, error: userError } = await supabase.from('users').select('phone').eq('user_id', currentUser.user_id).single();
                if (userError || !userData || !userData.phone) return;
                const userPhone = userData.phone;
                if (payload.new.from_phone === userPhone || payload.new.to_phone === userPhone) {
                    if (payload.new.to_phone === userPhone && payload.new.from_phone !== userPhone && transferReceivedSound) {
                        transferReceivedSound.currentTime = 0;
                        transferReceivedSound.play().catch(e => console.warn("Received sound failed:", e));
                    }
                    loadTransactions();
                }
            }
        }).subscribe();
}

// Load transactions
async function loadTransactions() {
    try {
        if (!currentUser) return;
        const { data: userData, error: userError } = await supabase.from('users').select('phone').eq('user_id', currentUser.user_id).single();
        if (userError || !userData || !userData.phone) return;
        const userPhone = userData.phone;
        const { data: transactionsData, error } = await supabase.from('transactions').select('*')
            .or(`from_phone.eq.${userPhone},to_phone.eq.${userPhone}`)
            .order('created_at', { ascending: false }).limit(10);
        if (error) throw error;
        transactions = transactionsData || [];
        updateTransactionsUI(transactions, userPhone);
    } catch (error) {
        console.error('Load transactions error:', error);
    }
}

// Update transactions UI
function updateTransactionsUI(transactionsData, userPhone) {
    const recentTransactionsList = document.getElementById('recent-transactions-list');
    const historyTransactionsList = document.getElementById('history-transactions-list');
    if (!recentTransactionsList || !historyTransactionsList) return;
    recentTransactionsList.innerHTML = '';
    historyTransactionsList.innerHTML = '';
    if (!transactionsData || transactionsData.length === 0) {
        const emptyState = `<div class="empty-state"><i class="fas fa-history"></i><p>လုပ်ဆောင်ချက်မှတ်တမ်းမရှိသေးပါ</p></div>`;
        recentTransactionsList.innerHTML = emptyState;
        historyTransactionsList.innerHTML = emptyState;
        return;
    }
    transactionsData.forEach((transaction, index) => {
        const isSender = transaction.from_phone === userPhone;
        const otherParty = isSender ? transaction.to_phone : transaction.from_phone;
        const transactionDate = new Date(transaction.created_at).toLocaleString('my-MM', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const transactionItem = `
            <div class="transaction-item ${isSender ? 'sent' : 'received'} clickable">
                <div class="transaction-icon"><i class="fas ${isSender ? 'fa-arrow-up' : 'fa-arrow-down'}"></i></div>
                <div class="transaction-details">
                    <div class="transaction-title">${isSender ? 'ပို့ထားသော' : 'လက်ခံရရှိသော'}</div>
                    <div class="transaction-subtitle">${otherParty} ${transaction.note ? `- ${transaction.note}` : ''}</div>
                    <div class="transaction-date">${transactionDate}</div>
                </div>
                <div class="transaction-actions">
                    <div class="transaction-amount ${isSender ? 'negative' : 'positive'}">${isSender ? '-' : '+'} ${transaction.amount.toLocaleString()} Ks</div>
                    <button class="transaction-view-btn clickable" data-transaction-index="${index}"><i class="fas fa-eye"></i></button>
                </div>
            </div>`;
        if (index < 5) recentTransactionsList.innerHTML += transactionItem;
        historyTransactionsList.innerHTML += transactionItem;
    });
    document.querySelectorAll('.transaction-view-btn').forEach(button => {
        button.addEventListener('click', () => {
            const transactionIndex = button.getAttribute('data-transaction-index');
            if (transactionsData[transactionIndex]) {
                showTransactionReceipt(transactionsData[transactionIndex]);
            }
        });
    });
    addClickSoundToClickableElements();
}

// Initialize UI elements
function initializeUI() {
    addClickSoundToClickableElements();

    const autoSaveCheckbox = document.getElementById('auto-save-receipt');
    if (autoSaveCheckbox) {
        const savedAutoDownloadSetting = localStorage.getItem('autoDownloadReceiptOpper');
        if (savedAutoDownloadSetting !== null) {
            autoDownloadReceiptEnabled = JSON.parse(savedAutoDownloadSetting);
            autoSaveCheckbox.checked = autoDownloadReceiptEnabled;
        } else {
            autoSaveCheckbox.checked = false;
            localStorage.setItem('autoDownloadReceiptOpper', JSON.stringify(false));
        }
        autoSaveCheckbox.addEventListener('change', (e) => {
            autoDownloadReceiptEnabled = e.target.checked;
            localStorage.setItem('autoDownloadReceiptOpper', JSON.stringify(autoDownloadReceiptEnabled));
        });
    }

    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    const tabIndicator = document.querySelector('.tab-indicator');
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            authForms.forEach(form => {
                form.classList.remove('active');
                const errorMsg = form.querySelector('.auth-message.error');
                const successMsg = form.querySelector('.auth-message.success');
                if (errorMsg) errorMsg.style.display = 'none';
                if (successMsg) successMsg.style.display = 'none';
                if (form.id === `${tabName}-form`) form.classList.add('active');
            });
            if (tabIndicator) tabIndicator.style.transform = (tabName === 'signup') ? 'translateX(calc(100% + 4px))' : 'translateX(0%)';
        });
    });
    
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', () => {
            const input = button.previousElementSibling;
            if (input && input.type === 'password') {
                input.type = 'text'; button.classList.remove('fa-eye-slash'); button.classList.add('fa-eye');
            } else if (input) {
                input.type = 'password'; button.classList.remove('fa-eye'); button.classList.add('fa-eye-slash');
            }
        });
    });
    
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', (e) => { e.preventDefault(); showPage(link.getAttribute('data-page')); });
    });
    document.querySelectorAll('.action-card').forEach(card => {
        card.addEventListener('click', () => showPage(card.getAttribute('data-page')));
    });
    
    const menuToggle = document.getElementById('menu-toggle'), sidebar = document.getElementById('sidebar'), closeSidebar = document.getElementById('close-sidebar');
    if (menuToggle && sidebar) menuToggle.addEventListener('click', () => sidebar.classList.add('active'));
    if (closeSidebar && sidebar) closeSidebar.addEventListener('click', () => sidebar.classList.remove('active'));
    
    const profileDropdownTrigger = document.getElementById('profile-dropdown-trigger'), profileDropdown = document.getElementById('profile-dropdown');
    if (profileDropdownTrigger && profileDropdown) {
        profileDropdownTrigger.addEventListener('click', (e) => {
            e.stopPropagation(); profileDropdown.classList.toggle('active');
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
    
    const elIdsAndActions = {
        'view-profile': () => showPage('settings'), 'go-to-settings': () => showPage('settings'),
        'dropdown-logout': logout, 'logout-btn': logout,
        'refresh-balance': async () => { showLoader(); await loadUserData(); hideLoader(); },
        'download-receipt-btn': () => { // Changed ID for clarity
            if (transactions && transactions.length > 0) {
                downloadReceipt(transactions[0]); // Download latest transaction as example
            } else {
                alert("ဒေါင်းလုဒ်ဆွဲရန် ပြေစာမရှိသေးပါ။");
            }
        }
    };
    for (const id in elIdsAndActions) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', elIdsAndActions[id]);
    }

    const hideBalanceBtn = document.getElementById('hide-balance');
    const balanceAmountEl = document.getElementById('balance-amount');
    if (hideBalanceBtn && balanceAmountEl) {
        hideBalanceBtn.addEventListener('click', () => {
            const icon = hideBalanceBtn.querySelector('i');
            if (balanceAmountEl.classList.contains('hidden-balance')) {
                balanceAmountEl.textContent = `${userBalance.toLocaleString()} Ks`; balanceAmountEl.classList.remove('hidden-balance');
                if (icon) { icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
            } else {
                balanceAmountEl.textContent = '•••••• Ks'; balanceAmountEl.classList.add('hidden-balance');
                if (icon) { icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
            }
        });
    }
    
    document.querySelectorAll('input[type="file"]').forEach(input => {
        input.addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return;
            const preview = document.getElementById(input.id.replace('-upload', '-preview')); if (!preview) return;
            const reader = new FileReader();
            reader.onload = (ev) => { preview.innerHTML = `<img src="${ev.target.result}" alt="Preview">`; };
            reader.readAsDataURL(file);
        });
    });
    
    document.querySelectorAll('.theme-option').forEach(option => {
        if (option.getAttribute('data-theme') === currentTheme) option.classList.add('active');
        option.addEventListener('click', () => {
            const theme = option.getAttribute('data-theme');
            document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            document.body.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme); currentTheme = theme;
        });
    });
    
    const modals = document.querySelectorAll('.modal');
    const modalTriggers = {
        'change-password-btn': 'change-password-modal', 'change-pin-btn': 'change-pin-modal', 'delete-account-btn': 'delete-account-modal'
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
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            if (modal) modal.classList.remove('active');
        });
    });
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
    });
    setupPinInputs();
    setupFormSubmissions();
}

function addClickSoundToClickableElements() {
    if (clickSound) {
        document.querySelectorAll('.clickable').forEach(el => {
            el.removeEventListener('click', playClickSoundHandler); 
            el.addEventListener('click', playClickSoundHandler);
        });
    }
}
function playClickSoundHandler() {
    if (clickSound) {
        clickSound.currentTime = 0;
        clickSound.play().catch(e => console.warn("Click sound failed:", e));
    }
}

function setupPinInputs() {
    const pinInputs = document.querySelectorAll('.pin-input');
    pinInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => { if (e.target.value && index < pinInputs.length - 1) pinInputs[index + 1].focus(); });
        input.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !e.target.value && index > 0) pinInputs[index - 1].focus(); });
    });
    const confirmPinBtn = document.getElementById('confirm-pin-btn');
    if (confirmPinBtn) {
        confirmPinBtn.addEventListener('click', () => {
            let pin = ''; pinInputs.forEach(input => { pin += input.value; });
            const pinErrorEl = document.getElementById('pin-error');
            if (pin.length !== 6) {
                if(pinErrorEl) { pinErrorEl.textContent = 'PIN ၆ လုံး ထည့်ပါ'; pinErrorEl.style.display = 'block'; } return;
            }
            if(pinErrorEl) pinErrorEl.style.display = 'none';
            processTransfer(pin);
        });
    }
}

function setupFormSubmissions() {
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const emailEl = document.getElementById('login-email');
            const passwordEl = document.getElementById('login-password');
            const email = emailEl ? emailEl.value : '';
            const password = passwordEl ? passwordEl.value : '';
            const errEl = document.getElementById('login-error');
            const sucEl = document.getElementById('login-success');
            
            if (!errEl || !sucEl) return; // Essential elements missing
            errEl.style.display = 'none'; sucEl.style.display = 'none';

            if (!email || !password) { errEl.textContent = 'အီးမေးလ်နှင့် စကားဝှက် ထည့်ပါ။'; errEl.style.display = 'block'; return; }
            
            showLoader();
            try {
                const { data: user, error } = await supabase.from('auth_users').select('*').eq('email', email).single();
                if (error || !user) { errEl.textContent = 'အကောင့်မတွေ့ရှိပါ။'; errEl.style.display = 'block'; throw new Error('User not found'); }
                if (user.password !== password) { errEl.textContent = 'စကားဝှက်မှားယွင်းနေပါသည်။'; errEl.style.display = 'block'; throw new Error('Incorrect password'); }
                
                currentUser = user; localStorage.setItem('opperSession', JSON.stringify({ email: user.email, user_id: user.user_id }));
                sucEl.textContent = 'အကောင့်ဝင်ရောက်နေပါသည်...'; sucEl.style.display = 'block';
                
                await loadUserData();
                showAppContainer();
                sucEl.style.display = 'none';
            } catch (error) {
                console.error('Login error:', error.message);
                // Error messages are already set by specific checks, or a generic one if needed.
            } finally {
                hideLoader();
            }
        });
    }
    
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) googleLoginBtn.addEventListener('click', () => simulateGoogleLogin('login'));
    
    const signupBtn = document.getElementById('signup-btn');
    if (signupBtn) {
        signupBtn.addEventListener('click', async () => {
            const email = document.getElementById('signup-email').value, phone = document.getElementById('signup-phone').value;
            const password = document.getElementById('signup-password').value, confirmPassword = document.getElementById('signup-confirm-password').value;
            const termsAgree = document.getElementById('terms-agree').checked;
            const errEl = document.getElementById('signup-error'), sucEl = document.getElementById('signup-success');
            
            if (!errEl || !sucEl) return;
            errEl.style.display = 'none'; sucEl.style.display = 'none';

            if (!email || !phone || !password || !confirmPassword) { errEl.textContent = 'အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။'; errEl.style.display = 'block'; return; }
            if (password !== confirmPassword) { errEl.textContent = 'စကားဝှက်နှင့် အတည်ပြုစကားဝှက် မတူညီပါ။'; errEl.style.display = 'block'; return; }
            if (!termsAgree) { errEl.textContent = 'စည်းမျဉ်းစည်းကမ်းများကို သဘောတူရန် လိုအပ်ပါသည်။'; errEl.style.display = 'block'; return; }

            showLoader();
            try {
                const { data: existingE } = await supabase.from('auth_users').select('email').eq('email', email).maybeSingle();
                if (existingE) { errEl.textContent = 'ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။'; errEl.style.display = 'block'; throw new Error('Email exists'); }
                const { data: existingP } = await supabase.from('users').select('phone').eq('phone', phone).maybeSingle();
                if (existingP) { errEl.textContent = 'ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။'; errEl.style.display = 'block'; throw new Error('Phone exists'); }

                const userId = generateUserId(email);
                const { error: authErr } = await supabase.from('auth_users').insert([{ email, password, user_id: userId }]);
                if (authErr) throw authErr;
                const { error: profileErr } = await supabase.from('users').insert([{ user_id: userId, phone, balance: 0, passport_status: 'pending' }]);
                if (profileErr) throw profileErr;
                
                errEl.style.display = 'none';
                sucEl.textContent = 'အကောင့်ဖွင့်ပြီးပါပြီ။ Login tab ကိုနှိပ်၍ အကောင့်ဝင်နိုင်ပါပြီ။';
                sucEl.style.display = 'block';
                const signupForm = document.getElementById('signup-form');
                if (signupForm) signupForm.reset();
                const termsCheckbox = document.getElementById('terms-agree');
                if (termsCheckbox) termsCheckbox.checked = false;
                
                setTimeout(() => { sucEl.style.display = 'none'; }, 3000);
            } catch (error) {
                console.error('Signup error:', error);
                sucEl.style.display = 'none';
                if (!errEl.textContent || errEl.style.display === 'none') { // If no specific error was set
                    errEl.textContent = 'အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။';
                    if (error.message && (error.message.includes("auth_users_email_key") || error.message.includes("users_phone_key")) ) {
                         errEl.textContent = 'ဤအီးမေးလ် သို့မဟုတ် ဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးသားဖြစ်နိုင်ပါသည်။';
                    }
                    errEl.style.display = 'block';
                }
            } finally {
                hideLoader();
            }
        });
    }

    const googleSignupBtn = document.getElementById('google-signup-btn');
    if (googleSignupBtn) googleSignupBtn.addEventListener('click', () => simulateGoogleLogin('signup'));

    const transferBtn = document.getElementById('transfer-btn');
    if (transferBtn) {
        transferBtn.addEventListener('click', async () => {
            const phone = document.getElementById('transfer-phone').value, amount = parseInt(document.getElementById('transfer-amount').value);
            const errEl = document.getElementById('transfer-error'), sucEl = document.getElementById('transfer-success');
            if (!errEl || !sucEl) return;
            errEl.style.display = 'none'; sucEl.style.display = 'none';

            if (!phone || !amount) { errEl.textContent = 'ဖုန်းနံပါတ်နှင့် ငွေပမာဏ ထည့်ပါ။'; errEl.style.display = 'block'; return; }
            if (amount < 1000) { errEl.textContent = 'ငွေပမာဏ အနည်းဆုံး 1,000 Ks ဖြစ်ရပါမည်။'; errEl.style.display = 'block'; return; }
            if (!transfersEnabled) { errEl.textContent = 'ငွေလွှဲခြင်းကို ယာယီပိတ်ထားပါသည်။'; errEl.style.display = 'block'; return; }
            if (userKycStatus !== 'approved') { errEl.textContent = 'ငွေလွှဲရန် KYC အတည်ပြုရန် လိုအပ်ပါသည်။'; errEl.style.display = 'block'; return; }
            if (userBalance < amount) { errEl.textContent = 'လက်ကျန်ငွေ မလုံလောက်ပါ။'; errEl.style.display = 'block'; return; }
            
            showLoader();
            try {
                const { data: senderData } = await supabase.from('users').select('phone').eq('user_id', currentUser.user_id).single();
                if (senderData && senderData.phone === phone) { errEl.textContent = 'ကိုယ့်ကိုယ်ကို ငွေလွှဲ၍မရပါ။'; errEl.style.display = 'block'; throw new Error("Self transfer");}
                const { data: recipient, error: recipientError } = await supabase.from('users').select('*').eq('phone', phone).single();
                if (recipientError || !recipient) { errEl.textContent = 'လက်ခံမည့်သူ မတွေ့ရှိပါ။'; errEl.style.display = 'block'; throw new Error("Recipient not found");}
                
                errEl.style.display = 'none'; showPinEntryModal();
            } catch (error) {
                console.error('Transfer validation error:', error.message);
            } finally {
                hideLoader();
            }
        });
    }

    const kycSubmitBtn = document.getElementById('kyc-submit-btn');
    if (kycSubmitBtn) {
        kycSubmitBtn.addEventListener('click', async () => {
            const pNum = document.getElementById('kyc-passport').value, addr = document.getElementById('kyc-address').value;
            const pin = document.getElementById('kyc-pin').value, confPin = document.getElementById('kyc-confirm-pin').value;
            const pFileEl = document.getElementById('passport-upload'), sFileEl = document.getElementById('selfie-upload');
            const pFile = pFileEl ? pFileEl.files[0] : null;
            const sFile = sFileEl ? sFileEl.files[0] : null;
            const errEl = document.getElementById('kyc-error'), sucEl = document.getElementById('kyc-success');
            
            if (!errEl || !sucEl) return;
            errEl.style.display = 'none'; sucEl.style.display = 'none';

            if (!pNum||!addr||!pin||!confPin||!pFile||!sFile) { errEl.textContent='အချက်အလက်အားလုံး ဖြည့်ပါ။'; errEl.style.display='block'; return; }
            if (pin!==confPin) { errEl.textContent='PIN မတူညီပါ။'; errEl.style.display='block'; return; }
            if (pin.length!==6||!/^\d+$/.test(pin)) { errEl.textContent='PIN ၆လုံးဂဏန်းဖြစ်ရမည်။'; errEl.style.display='block'; return; }
            
            showLoader();
            try {
                const pFName = `passport_${currentUser.user_id}_${Date.now()}.${pFile.name.split('.').pop()}`;
                const { error: pErr } = await supabase.storage.from('kyc-documents').upload(pFName, pFile); if (pErr) throw pErr;
                const { data: pUrlData } = supabase.storage.from('kyc-documents').getPublicUrl(pFName);
                const pUrl = pUrlData ? pUrlData.publicUrl : null;

                const sFName = `selfie_${currentUser.user_id}_${Date.now()}.${sFile.name.split('.').pop()}`;
                const { error: sErr } = await supabase.storage.from('kyc-documents').upload(sFName, sFile); if (sErr) throw sErr;
                const { data: sUrlData } = supabase.storage.from('kyc-documents').getPublicUrl(sFName);
                const sUrl = sUrlData ? sUrlData.publicUrl : null;

                if (!pUrl || !sUrl) throw new Error("Failed to get public URLs for KYC documents.");

                const { error: uErr } = await supabase.from('users').update({
                    passport_number:pNum, address:addr, payment_pin:pin, passport_image:pUrl, selfie_image:sUrl,
                    passport_status:'pending', submitted_at: new Date().toISOString()
                }).eq('user_id', currentUser.user_id); if (uErr) throw uErr;
                
                sucEl.textContent='KYC တင်သွင်းပြီးပါပြီ။'; sucEl.style.display='block'; userKycStatus='pending'; updateKycStatus();
                const kycForm = document.getElementById('kyc-form'); if (kycForm) kycForm.reset();
                const passportPreview = document.getElementById('passport-preview'); if (passportPreview) passportPreview.innerHTML='';
                const selfiePreview = document.getElementById('selfie-preview'); if (selfiePreview) selfiePreview.innerHTML='';
                setTimeout(() => sucEl.style.display='none', 3000);
            } catch (error) {
                console.error('KYC error:', error); errEl.textContent='KYC တင်သွင်းရာတွင် အမှားရှိနေပါသည်။'; errEl.style.display='block';
            } finally { hideLoader(); }
        });
    }
    // Placeholder for other form submissions (change password, pin, delete account)
    // They should follow a similar pattern of showLoader, try-catch-finally, hideLoader, and message display.
}

function showPinEntryModal() {
    document.querySelectorAll('.pin-input').forEach(input => { input.value = ''; });
    const pinErrorEl = document.getElementById('pin-error'); if(pinErrorEl) pinErrorEl.style.display = 'none';
    if(pinEntryModal) pinEntryModal.classList.add('active');
    const firstPinInput = document.querySelector('.pin-input'); if(firstPinInput) firstPinInput.focus();
}

async function processTransfer(pin) {
    const phone = document.getElementById('transfer-phone').value, amount = parseInt(document.getElementById('transfer-amount').value);
    const note = document.getElementById('transfer-note').value;
    const errEl = document.getElementById('transfer-error'), sucEl = document.getElementById('transfer-success');
    
    if(pinEntryModal) pinEntryModal.classList.remove('active');
    if(processingOverlay) processingOverlay.classList.add('active'); else showLoader(); // Fallback loader

    if (errEl) errEl.style.display = 'none';
    if (sucEl) sucEl.style.display = 'none';

    try {
        const { data: sender, error: sErr } = await supabase.from('users').select('*').eq('user_id', currentUser.user_id).single(); if (sErr) throw sErr;
        if (sender.payment_pin !== pin) { if(errEl){ errEl.textContent='PIN မှားယွင်းနေပါသည်။'; errEl.style.display='block';} throw new Error("Incorrect PIN"); }
        
        const { data: recipient, error: rErr } = await supabase.from('users').select('*').eq('phone', phone).single();
        if (rErr || !recipient) { if(errEl){ errEl.textContent='လက်ခံမည့်သူ မတွေ့ရှိပါ။'; errEl.style.display='block';} throw new Error("Recipient not found"); }
        
        const tId = `OPPER${Math.floor(1000000 + Math.random() * 9000000)}`;
        const tPayload = { id:tId, from_phone:sender.phone, from_name:sender.name||sender.phone, to_phone:recipient.phone, to_name:recipient.name||recipient.phone, amount, note, created_at:new Date().toISOString() };
        const { data: transaction, error: tErr } = await supabase.from('transactions').insert([tPayload]).select().single(); if (tErr) throw tErr;
        
        await supabase.from('users').update({ balance: sender.balance - amount }).eq('user_id', sender.user_id);
        await supabase.from('users').update({ balance: recipient.balance + amount }).eq('user_id', recipient.user_id);
        
        userBalance -= amount;
        const userBalanceEl = document.getElementById('user-balance');
        const balanceAmountEl = document.getElementById('balance-amount');
        if (userBalanceEl) userBalanceEl.textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`;
        if (balanceAmountEl && !balanceAmountEl.classList.contains('hidden-balance')) {
            balanceAmountEl.textContent = `${userBalance.toLocaleString()} Ks`;
        }
        
        setTimeout(() => { // Delay for UX, showing success
            if (sucEl) { sucEl.textContent = `${amount.toLocaleString()} Ks ကို ${phone} သို့ အောင်မြင်စွာ လွှဲပြီးပါပြီ။`; sucEl.style.display = 'block';}
            if (transferSentSound) { transferSentSound.currentTime=0; transferSentSound.play().catch(e=>console.warn("Sent sound fail:",e));}
            showTransactionReceipt(transaction);
            if (autoDownloadReceiptEnabled) downloadReceipt(transaction);
            
            const transferPhoneEl = document.getElementById('transfer-phone');
            const transferAmountEl = document.getElementById('transfer-amount');
            const transferNoteEl = document.getElementById('transfer-note');
            if (transferPhoneEl) transferPhoneEl.value='';
            if (transferAmountEl) transferAmountEl.value='';
            if (transferNoteEl) transferNoteEl.value='';

            loadTransactions();
            setTimeout(() => { if (sucEl) sucEl.style.display='none';}, 3000);
        }, 500); // Short delay before showing success, main processing is done
    } catch (error) {
        console.error('Transfer error:', error.message);
        // Error messages are set by specific checks or a generic one here
        if (errEl && errEl.style.display === 'none') {
            errEl.textContent = 'ငွေလွှဲရာတွင် အမှားရှိနေပါသည်။'; errEl.style.display = 'block';
        }
    } finally {
        if(processingOverlay) processingOverlay.classList.remove('active'); else hideLoader();
    }
}

function showTransactionReceipt(transaction) {
    if (!currentUser || !transaction) return;
    supabase.from('users').select('phone').eq('user_id', currentUser.user_id).single().then(({ data: userData }) => {
        if (!userData) return;
        const userPhone = userData.phone, isSender = transaction.from_phone === userPhone;
        const tDate = new Date(transaction.created_at).toLocaleString('my-MM', { year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
        const receiptHTML = `
            <div class="receipt">
                <div class="receipt-logo-area">
                    <div class="opper-logo-container">
                        <img src="https://github.com/Opper125/opper-payment/raw/main/logo.png" alt="OPPER Logo" class="opper-logo-img" crossOrigin="anonymous">
                        <span class="opper-logo-text">OPPER Pay</span>
                    </div>
                    <img src="https://github.com/Opper125/opper-payment/raw/main/github.png" alt="GitHub Logo" class="github-logo-img" crossOrigin="anonymous">
                </div>
                <div class="receipt-status"><div class="receipt-status-icon ${isSender?'sent':'received'}"><i class="fas ${isSender?'fa-paper-plane':'fa-check-circle'}"></i></div><div class="receipt-status-text">${isSender?'ငွေပေးပို့ပြီးပါပြီ':'ငွေလက်ခံရရှိပါပြီ'}</div></div>
                <div class="receipt-amount"><div class="receipt-amount-label">ငွေပမာဏ</div><div class="receipt-amount-value">${transaction.amount.toLocaleString()} Ks</div></div>
                <div class="receipt-details">
                    <div class="receipt-detail-row"><div class="receipt-detail-label">From</div><div class="receipt-detail-value">${transaction.from_name || transaction.from_phone} (${transaction.from_phone})</div></div>
                    <div class="receipt-detail-row"><div class="receipt-detail-label">To</div><div class="receipt-detail-value">${transaction.to_name || transaction.to_phone} (${transaction.to_phone})</div></div>
                    ${transaction.note?`<div class="receipt-detail-row"><div class="receipt-detail-label">Note</div><div class="receipt-detail-value">${transaction.note}</div></div>`:''}
                    <div class="receipt-detail-row"><div class="receipt-detail-label">Date</div><div class="receipt-detail-value">${tDate}</div></div>
                    <div class="receipt-detail-row"><div class="receipt-detail-label">Payment Method</div><div class="receipt-detail-value">OPPER Pay</div></div>
                </div>
                <div class="receipt-transaction-id"><div class="receipt-transaction-id-label">ငွေလွှဲလုပ်ဆောင်ချက်အမှတ်စဥ်</div><div class="receipt-transaction-id-value">${transaction.id}</div></div>
                <div class="receipt-footer">OPPER Payment ကိုအသုံးပြုသည့်အတွက် ကျေးဇူးတင်ပါသည်</div>
            </div>`;
        const receiptContainer = document.getElementById('receipt-container');
        if (receiptContainer) receiptContainer.innerHTML = receiptHTML;
        if (receiptModal) receiptModal.classList.add('active');
    }).catch(err => console.error("Error fetching user phone for receipt:", err));
}

function downloadReceipt(transactionDetails) {
    const receiptElement = document.getElementById('receipt-container');
    if (!receiptElement) { console.error("Receipt element not found."); return; }
    // Ensure html2canvas is loaded. You might need to include it via a <script> tag in your HTML.
    if (typeof html2canvas === 'undefined') {
        console.error("html2canvas library is not loaded.");
        alert('ပြေစာဒေါင်းလုဒ်ဆွဲရန် html2canvas library လိုအပ်ပါသည်။');
        return;
    }

    setTimeout(() => { // Delay to ensure images are rendered
        html2canvas(receiptElement, {
            scale: 1, useCORS: true, backgroundColor: '#ffffff', logging: false,
        }).then(canvas => {
            const fileNameBase = transactionDetails && transactionDetails.id ? transactionDetails.id : Date.now();
            const link = document.createElement('a');
            link.download = `OPPER-Receipt-${fileNameBase}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(err => {
            console.error("Error generating receipt image with html2canvas:", err);
            alert('ပြေစာပုံရိပ်ဖန်တီးရာတွင် အမှားဖြစ်ပွားခဲ့သည်။ Console ကိုစစ်ဆေးပါ။');
        });
    }, 500);
}

async function simulateGoogleLogin(type) { alert(`Google ${type} ကို ဤနေရာတွင် အကောင်အထည်ဖော်ရန် လိုအပ်ပါသည်။`); }
function generateUserId(email) { return `OPPER-${email.substring(0,3)}${Date.now().toString().slice(-4)}`; }

function showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) targetPage.classList.add('active');
    else console.warn(`Page not found: ${pageName}-page`);

    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-page') === pageName) link.classList.add('active');
    });
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('active');
    addClickSoundToClickableElements();
}

function logout() {
    localStorage.removeItem('opperSession');
    currentUser = null;
    userBalance = 0;
    userKycStatus = 'pending';
    transactions = [];
    showAuthContainer();
    // Clear UI fields if necessary
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    if (loginForm) loginForm.reset();
    if (signupForm) signupForm.reset();
}

function showLoader() { if(loader) loader.classList.add('active'); }
function hideLoader() { if(loader) loader.classList.remove('active'); }
function showAuthContainer() { if(authContainer) authContainer.classList.remove('hidden'); if(appContainer) appContainer.classList.add('hidden'); }
function showAppContainer() { if(authContainer) authContainer.classList.add('hidden'); if(appContainer) appContainer.classList.remove('hidden'); }

// --- Modal Form Submissions (Change Password, PIN, Delete Account) ---
// These should follow the robust error handling and loader management pattern.

const savePasswordBtn = document.getElementById('save-password-btn');
if (savePasswordBtn) {
    savePasswordBtn.addEventListener('click', async () => {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmNewPassword = document.getElementById('confirm-new-password').value;
        const errorElement = document.getElementById('change-password-error');
        const successElement = document.getElementById('change-password-success');
        if (!errorElement || !successElement) return;
        errorElement.style.display = 'none'; successElement.style.display = 'none';

        if (!currentPassword || !newPassword || !confirmNewPassword) {
            errorElement.textContent = 'အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။'; errorElement.style.display = 'block'; return;
        }
        if (newPassword !== confirmNewPassword) {
            errorElement.textContent = 'စကားဝှက်အသစ်နှင့် အတည်ပြုစကားဝှက် မတူညီပါ။'; errorElement.style.display = 'block'; return;
        }
        showLoader();
        try {
            const { data: user, error } = await supabase.from('auth_users').select('password').eq('user_id', currentUser.user_id).single();
            if (error) throw error;
            if (user.password !== currentPassword) {
                errorElement.textContent = 'လက်ရှိစကားဝှက် မှားယွင်းနေပါသည်။'; errorElement.style.display = 'block'; throw new Error("Incorrect current password");
            }
            const { error: updateError } = await supabase.from('auth_users').update({ password: newPassword }).eq('user_id', currentUser.user_id);
            if (updateError) throw updateError;
            successElement.textContent = 'စကားဝှက် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။'; successElement.style.display = 'block';
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-new-password').value = '';
            setTimeout(() => {
                const modal = document.getElementById('change-password-modal');
                if (modal) modal.classList.remove('active');
                successElement.style.display = 'none';
            }, 2000);
        } catch (error) {
            console.error('Change password error:', error.message);
            if (errorElement.style.display === 'none') { // Show generic if no specific error set
                 errorElement.textContent = 'စကားဝှက်ပြောင်းရာတွင် အမှားရှိနေပါသည်။'; errorElement.style.display = 'block';
            }
        } finally {
            hideLoader();
        }
    });
}

const savePinBtn = document.getElementById('save-pin-btn');
if (savePinBtn) {
    savePinBtn.addEventListener('click', async () => {
        const currentPin = document.getElementById('current-pin').value;
        const newPin = document.getElementById('new-pin').value;
        const confirmNewPin = document.getElementById('confirm-new-pin').value;
        const errorElement = document.getElementById('change-pin-error');
        const successElement = document.getElementById('change-pin-success');
        if (!errorElement || !successElement) return;
        errorElement.style.display = 'none'; successElement.style.display = 'none';

        if (!currentPin || !newPin || !confirmNewPin) {
            errorElement.textContent = 'အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။'; errorElement.style.display = 'block'; return;
        }
        if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
            errorElement.textContent = 'PIN အသစ်သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။'; errorElement.style.display = 'block'; return;
        }
        if (newPin !== confirmNewPin) {
            errorElement.textContent = 'PIN အသစ်နှင့် အတည်ပြု PIN မတူညီပါ။'; errorElement.style.display = 'block'; return;
        }
        showLoader();
        try {
            const { data: user, error } = await supabase.from('users').select('payment_pin').eq('user_id', currentUser.user_id).single();
            if (error) throw error;
            if (user.payment_pin !== currentPin) {
                errorElement.textContent = 'လက်ရှိ PIN မှားယွင်းနေပါသည်။'; errorElement.style.display = 'block'; throw new Error("Incorrect current PIN");
            }
            const { error: updateError } = await supabase.from('users').update({ payment_pin: newPin }).eq('user_id', currentUser.user_id);
            if (updateError) throw updateError;
            successElement.textContent = 'PIN အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။'; successElement.style.display = 'block';
            document.getElementById('current-pin').value = '';
            document.getElementById('new-pin').value = '';
            document.getElementById('confirm-new-pin').value = '';
            setTimeout(() => {
                const modal = document.getElementById('change-pin-modal');
                if (modal) modal.classList.remove('active');
                successElement.style.display = 'none';
            }, 2000);
        } catch (error) {
            console.error('Change PIN error:', error.message);
             if (errorElement.style.display === 'none') {
                errorElement.textContent = 'PIN ပြောင်းရာတွင် အမှားရှိနေပါသည်။'; errorElement.style.display = 'block';
            }
        } finally {
            hideLoader();
        }
    });
}

const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
        const password = document.getElementById('delete-password').value;
        const confirmCheckboxEl = document.getElementById('confirm-delete');
        const confirmCheckbox = confirmCheckboxEl ? confirmCheckboxEl.checked : false;
        const errorElement = document.getElementById('delete-account-error');
        if (!errorElement) return;
        errorElement.style.display = 'none';

        if (!password) {
            errorElement.textContent = 'စကားဝှက်ထည့်ပါ။'; errorElement.style.display = 'block'; return;
        }
        if (!confirmCheckbox) {
            errorElement.textContent = 'အကောင့်ဖျက်လိုကြောင်း အတည်ပြုပါ။'; errorElement.style.display = 'block'; return;
        }
        showLoader();
        try {
            const { data: authUser, error } = await supabase.from('auth_users').select('password').eq('user_id', currentUser.user_id).single();
            if (error) throw error;
            if (authUser.password !== password) {
                errorElement.textContent = 'စကားဝှက် မှားယွင်းနေပါသည်။'; errorElement.style.display = 'block'; throw new Error("Incorrect password for delete");
            }
            // Actual deletion logic should be handled server-side or with more care.
            // For now, just logging out.
            alert('အကောင့်ဖျက်ခြင်း လုပ်ဆောင်ချက်ကို လုံခြုံရေးအရ server-side တွင်ပြုလုပ်သင့်ပါသည်။ ယခု အကောင့်မှထွက်ပါမည်။');
            const modal = document.getElementById('delete-account-modal');
            if (modal) modal.classList.remove('active');
            logout();
        } catch (error) {
            console.error('Delete account error:', error.message);
            if (errorElement.style.display === 'none') {
                errorElement.textContent = 'အကောင့်ဖျက်ရာတွင် အမှားရှိနေပါသည်။'; errorElement.style.display = 'block';
            }
        } finally {
            hideLoader();
        }
    });
}
