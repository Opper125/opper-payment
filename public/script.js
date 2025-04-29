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
let recipientInfo = null; // Store recipient information

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
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .or(`from_phone.eq.${userPhone},to_phone.eq.${userPhone}`)
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        
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
    transactions.forEach(transaction => {
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
                <div class="transaction-amount ${isSender ? 'negative' : 'positive'}">
                    ${isSender ? '-' : '+'} ${transaction.amount.toLocaleString()} Ks
                </div>
            </div>
        `;
        
        // Add to recent transactions
        recentTransactionsList.innerHTML += transactionItem;
        
        // Add to history transactions
        historyTransactionsList.innerHTML += transactionItem;
    });

    // Add click event to show receipt
    document.querySelectorAll('.transaction-item').forEach(item => {
        item.addEventListener('click', () => {
            const transactionId = item.getAttribute('data-transaction-id');
            const transaction = transactions.find(t => t.id == transactionId);
            if (transaction) {
                showTransactionReceipt(transaction, userPhone);
            }
        });
    });
}

// Initialize UI elements
function initializeUI() {
    // Auth tabs
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
    
    // Toggle password visibility
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
    
    // Sidebar navigation
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a');
    const pages = document.querySelectorAll('.page');
    
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageName = link.getAttribute('data-page');
            
            // Update active link
            sidebarLinks.forEach(l => l.parentElement.classList.remove('active'));
            link.parentElement.classList.add('active');
            
            // Show corresponding page
            pages.forEach(page => {
                page.classList.remove('active');
                if (page.id === `${pageName}-page`) {
                    page.classList.add('active');
                }
            });
            
            // Close sidebar on mobile
            if (window.innerWidth < 992) {
                document.getElementById('sidebar').classList.remove('active');
            }
        });
    });
    
    // Quick action cards
    const actionCards = document.querySelectorAll('.action-card');
    
    actionCards.forEach(card => {
        card.addEventListener('click', () => {
            const pageName = card.getAttribute('data-page');
            
            // Update active link in sidebar
            sidebarLinks.forEach(link => {
                link.parentElement.classList.remove('active');
                if (link.getAttribute('data-page') === pageName) {
                    link.parentElement.classList.add('active');
                }
            });
            
            // Show corresponding page
            pages.forEach(page => {
                page.classList.remove('active');
                if (page.id === `${pageName}-page`) {
                    page.classList.add('active');
                }
            });
        });
    });
    
    // Mobile menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    const closeSidebar = document.getElementById('close-sidebar');
    const sidebar = document.getElementById('sidebar');
    
    menuToggle.addEventListener('click', () => {
        sidebar.classList.add('active');
    });
    
    closeSidebar.addEventListener('click', () => {
        sidebar.classList.remove('active');
    });
    
    // Profile dropdown
    const profileDropdownTrigger = document.getElementById('profile-dropdown-trigger');
    const profileDropdown = document.getElementById('profile-dropdown');
    
    profileDropdownTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('active');
        
        // Position dropdown
        const rect = profileDropdownTrigger.getBoundingClientRect();
        profileDropdown.style.top = `${rect.bottom + 10}px`;
        profileDropdown.style.right = `${window.innerWidth - rect.right}px`;
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        profileDropdown.classList.remove('active');
    });
    
    // Dropdown actions
    document.getElementById('view-profile').addEventListener('click', () => {
        // Show profile page (settings for now)
        showPage('settings');
    });
    
    document.getElementById('go-to-settings').addEventListener('click', () => {
        showPage('settings');
    });
    
    document.getElementById('dropdown-logout').addEventListener('click', () => {
        logout();
    });
    
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', () => {
        logout();
    });
    
    // Balance actions
    document.getElementById('refresh-balance').addEventListener('click', async () => {
        await loadUserData();
    });
    
    document.getElementById('hide-balance').addEventListener('click', () => {
        const balanceAmount = document.getElementById('balance-amount');
        if (balanceAmount.classList.contains('hidden-balance')) {
            balanceAmount.textContent = `${userBalance.toLocaleString()} Ks`;
            balanceAmount.classList.remove('hidden-balance');
            document.querySelector('#hide-balance i').classList.remove('fa-eye');
            document.querySelector('#hide-balance i').classList.add('fa-eye-slash');
        } else {
            balanceAmount.textContent = '••••••';
            balanceAmount.classList.add('hidden-balance');
            document.querySelector('#hide-balance i').classList.remove('fa-eye-slash');
            document.querySelector('#hide-balance i').classList.add('fa-eye');
        }
    });
    
    // File uploads preview
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const previewId = input.id.replace('-upload', '-preview');
            const preview = document.getElementById(previewId);
            
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        });
    });
    
    // Theme selector
    const themeOptions = document.querySelectorAll('.theme-option');
    
    themeOptions.forEach(option => {
        if (option.getAttribute('data-theme') === currentTheme) {
            option.classList.add('active');
        }
        
        option.addEventListener('click', () => {
            const theme = option.getAttribute('data-theme');
            
            // Update active option
            themeOptions.forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            
            // Apply theme
            document.body.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            currentTheme = theme;
        });
    });
    
    // Modal handling
    const modals = document.querySelectorAll('.modal');
    const modalTriggers = {
        'change-password-btn': 'change-password-modal',
        'change-pin-btn': 'change-pin-modal',
        'delete-account-btn': 'delete-account-modal'
    };
    
    // Open modals
    Object.keys(modalTriggers).forEach(triggerId => {
        const trigger = document.getElementById(triggerId);
        const modalId = modalTriggers[triggerId];
        
        if (trigger) {
            trigger.addEventListener('click', () => {
                document.getElementById(modalId).classList.add('active');
            });
        }
    });
    
    // Close modals
    const modalCloseButtons = document.querySelectorAll('.modal-close, .modal-cancel');
    
    modalCloseButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            modal.classList.remove('active');
        });
    });
    
    // Close modal when clicking outside
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Form submissions
    setupFormSubmissions();

    // Create receipt modal
    createReceiptModal();
}

// Create receipt modal
function createReceiptModal() {
    // Create the modal element
    const receiptModal = document.createElement('div');
    receiptModal.id = 'receipt-modal';
    receiptModal.className = 'modal';
    
    // Create modal content
    receiptModal.innerHTML = `
        <div class="modal-content receipt-modal-content">
            <div class="modal-header">
                <h3>ငွေလွှဲပြေစာ</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div id="receipt-container">
                    <div class="receipt">
                        <div class="receipt-header">
                            <img src="https://github.com/Opper125/opper-payment/raw/main/logo.png" alt="OPPER Logo" class="receipt-logo">
                            <h2>OPPER</h2>
                        </div>
                        <div class="receipt-title">ငွေလွှဲပြေစာ</div>
                        <div class="receipt-status" id="receipt-status">
                            <span class="status-badge">ပို့ထားသော</span>
                        </div>
                        <div class="receipt-details">
                            <div class="receipt-row">
                                <div class="receipt-label">ငွေပမာဏ</div>
                                <div class="receipt-value" id="receipt-amount">0 Ks</div>
                            </div>
                            <div class="receipt-row">
                                <div class="receipt-label">မှ</div>
                                <div class="receipt-value" id="receipt-from">-</div>
                            </div>
                            <div class="receipt-row">
                                <div class="receipt-label">သို့</div>
                                <div class="receipt-value" id="receipt-to">-</div>
                            </div>
                            <div class="receipt-row">
                                <div class="receipt-label">ရက်စွဲ</div>
                                <div class="receipt-value" id="receipt-date">-</div>
                            </div>
                            <div class="receipt-row">
                                <div class="receipt-label">မှတ်ချက်</div>
                                <div class="receipt-value" id="receipt-note">-</div>
                            </div>
                            <div class="receipt-row">
                                <div class="receipt-label">Transaction ID</div>
                                <div class="receipt-value" id="receipt-id">-</div>
                            </div>
                        </div>
                        <div class="receipt-footer">
                            <div class="receipt-thank-you">OPPER Payment ကို အသုံးပြုသည့်အတွက် ကျေးဇူးတင်ပါသည်။</div>
                            <div class="receipt-contact">အကူအညီလိုအပ်ပါက ဖုန်း - 09xxxxxxxxx သို့ ဆက်သွယ်ပါ။</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" id="download-receipt">
                    <i class="fas fa-download"></i>
                    <span>ပြေစာကို ဒေါင်းလုဒ်ဆွဲရန်</span>
                </button>
                <button class="btn btn-primary" id="close-receipt">
                    <span>ပိတ်မည်</span>
                </button>
            </div>
        </div>
    `;
    
    // Append modal to body
    document.body.appendChild(receiptModal);
    
    // Add event listeners
    document.getElementById('close-receipt').addEventListener('click', () => {
        receiptModal.classList.remove('active');
    });
    
    document.getElementById('download-receipt').addEventListener('click', () => {
        downloadReceipt();
    });
    
    document.querySelector('#receipt-modal .modal-close').addEventListener('click', () => {
        receiptModal.classList.remove('active');
    });
}

// Show transaction receipt
function showTransactionReceipt(transaction, userPhone) {
    const isSender = transaction.from_phone === userPhone;
    const statusText = isSender ? 'ပို့ထားသော' : 'လက်ခံရရှိသော';
    const statusClass = isSender ? 'sent' : 'received';
    const transactionDate = new Date(transaction.created_at).toLocaleString();
    const transactionId = transaction.id || generateTransactionId();
    
    // Update receipt content
    document.getElementById('receipt-status').innerHTML = `<span class="status-badge ${statusClass}">${statusText}</span>`;
    document.getElementById('receipt-amount').textContent = `${transaction.amount.toLocaleString()} Ks`;
    document.getElementById('receipt-from').textContent = transaction.from_phone;
    document.getElementById('receipt-to').textContent = transaction.to_phone;
    document.getElementById('receipt-date').textContent = transactionDate;
    document.getElementById('receipt-note').textContent = transaction.note || '-';
    document.getElementById('receipt-id').textContent = transactionId;
    
    // Show receipt modal
    document.getElementById('receipt-modal').classList.add('active');
}

// Generate transaction ID
function generateTransactionId() {
    return 'TXN' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
}

// Download receipt as PNG
function downloadReceipt() {
    const receiptElement = document.querySelector('.receipt');
    
    // Use html2canvas to convert the receipt to an image
    html2canvas(receiptElement, {
        scale: 2,
        backgroundColor: null,
        logging: false
    }).then(canvas => {
        // Convert canvas to data URL
        const imgData = canvas.toDataURL('image/png');
        
        // Create download link
        const link = document.createElement('a');
        link.href = imgData;
        link.download = 'OPPER_Receipt_' + Date.now() + '.png';
        
        // Check if running in Android WebView
        if (window.Android) {
            // Call Android method to save image
            try {
                window.Android.saveImageToGallery(imgData);
                alert('ပြေစာကို ဖုန်းထဲသို့ သိမ်းဆည်းပြီးပါပြီ။');
            } catch (e) {
                console.error('Android save failed:', e);
                // Fallback to normal download
                link.click();
            }
        } else {
            // Normal browser download
            link.click();
        }
    }).catch(err => {
        console.error('Receipt download error:', err);
        alert('ပြေစာကို ဒေါင်းလုဒ်ဆွဲရာတွင် အမှားရှိနေပါသည်။');
    });
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
        
        try {
            // Check if user exists
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
            
            // Check password
            if (user.password !== password) {
                errorElement.textContent = 'စကားဝှက်မှားယွင်းနေပါသည်။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            // Login successful
            currentUser = user;
            
            // Save session
            const sessionData = {
                email: user.email,
                user_id: user.user_id
            };
            localStorage.setItem('opperSession', JSON.stringify(sessionData));
            
            // Show success message
            errorElement.style.display = 'none';
            successElement.textContent = 'အကောင့်ဝင်ရောက်နေပါသည်...';
            successElement.style.display = 'block';
            
            // Load user data and show app
            await loadUserData();
            showAppContainer();
        } catch (error) {
            console.error('Login error:', error);
            errorElement.textContent = 'အကောင့်ဝင်ရာတွင် အမှားရှိနေပါသည်။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
        }
    });
    
    // Google login
    const googleLoginBtn = document.getElementById('google-login-btn');
    
    googleLoginBtn.addEventListener('click', () => {
        // For demo purposes, we'll simulate Google login
        simulateGoogleLogin('login');
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
            // Check if email already exists
            const { data: existingUser, error: checkError } = await supabase
                .from('auth_users')
                .select('email')
                .eq('email', email)
                .single();
            
            if (existingUser) {
                errorElement.textContent = 'ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            // Check if phone already exists
            const { data: existingPhone, error: phoneError } = await supabase
                .from('users')
                .select('phone')
                .eq('phone', phone)
                .single();
            
            if (existingPhone) {
                errorElement.textContent = 'ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            // Generate user ID (based on email)
            const userId = generateUserId(email);
            
            // Create auth user
            const { data: authUser, error: authError } = await supabase
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
            
            if (authError) throw authError;
            
            // Create user profile
            const { data: userProfile, error: profileError } = await supabase
                .from('users')
                .insert([
                    {
                        user_id: userId,
                        phone,
                        balance: 0,
                        passport_status: 'pending'
                    }
                ])
                .select()
                .single();
            
            if (profileError) throw profileError;
            
            // Signup successful
            errorElement.style.display = 'none';
            successElement.textContent = 'အကောင့်ဖွင့်ပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။';
            successElement.style.display = 'block';
            
            // Clear form
            document.getElementById('signup-email').value = '';
            document.getElementById('signup-phone').value = '';
            document.getElementById('signup-password').value = '';
            document.getElementById('signup-confirm-password').value = '';
            document.getElementById('terms-agree').checked = false;
            
            // Switch to login tab after a delay
            setTimeout(() => {
                document.querySelector('.auth-tab[data-tab="login"]').click();
            }, 2000);
        } catch (error) {
            console.error('Signup error:', error);
            errorElement.textContent = 'အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
        }
    });
    
    // Google signup
    const googleSignupBtn = document.getElementById('google-signup-btn');
    
    googleSignupBtn.addEventListener('click', () => {
        // For demo purposes, we'll simulate Google signup
        simulateGoogleLogin('signup');
    });
    
    // Transfer form
    const transferBtn = document.getElementById('transfer-btn');
    const transferPhoneInput = document.getElementById('transfer-phone');
    const recipientStatusElement = document.createElement('div');
    recipientStatusElement.className = 'recipient-status';
    transferPhoneInput.parentNode.appendChild(recipientStatusElement);
    
    // Add event listener to check recipient status when phone number is entered
    transferPhoneInput.addEventListener('blur', async () => {
        const phone = transferPhoneInput.value;
        if (!phone || phone.length < 9) {
            recipientStatusElement.innerHTML = '';
            recipientInfo = null;
            return;
        }
        
        try {
            // Check if recipient exists
            const { data: recipient, error } = await supabase
                .from('users')
                .select('*')
                .eq('phone', phone)
                .single();
            
            if (error || !recipient) {
                recipientStatusElement.innerHTML = '<span class="status-badge rejected">အကောင့်မတွေ့ရှိပါ</span>';
                recipientInfo = null;
                return;
            }
            
            // Store recipient info
            recipientInfo = recipient;
            
            // Check if account is approved
            if (recipient.passport_status === 'approved') {
                recipientStatusElement.innerHTML = '<span class="status-badge approved">အတည်ပြုပြီးအကောင့်</span>';
            } else {
                recipientStatusElement.innerHTML = '<span class="status-badge pending">အတည်မပြုရသေးသောအကောင့်</span>';
            }
        } catch (error) {
            console.error('Recipient check error:', error);
            recipientStatusElement.innerHTML = '';
            recipientInfo = null;
        }
    });
    
    transferBtn.addEventListener('click', async () => {
        const phone = document.getElementById('transfer-phone').value;
        const amount = parseInt(document.getElementById('transfer-amount').value);
        const note = document.getElementById('transfer-note').value;
        const pin = document.getElementById('transfer-pin').value;
        const errorElement = document.getElementById('transfer-error');
        const successElement = document.getElementById('transfer-success');
        
        // Validate inputs
        if (!phone || !amount || !pin) {
            errorElement.textContent = 'ဖုန်းနံပါတ်၊ ငွေပမာဏနှင့် PIN ထည့်ပါ။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        if (amount < 1000) {
            errorElement.textContent = 'ငွေပမာဏ အနည်းဆုံး 1,000 Ks ဖြစ်ရပါမည်။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        try {
            // Check if transfers are enabled
            const { data: settings, error: settingsError } = await supabase
                .from('settings')
                .select('allow_transfers')
                .eq('id', 1)
                .single();
            
            if (settingsError) throw settingsError;
            
            if (!settings.allow_transfers) {
                errorElement.textContent = 'ငွေလွှဲခြင်းကို ယာယီပိတ်ထားပါသည်။ နောက်မှ ပြန်လည်ကြိုးစားပါ။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            // Get sender's data
            const { data: sender, error: senderError } = await supabase
                .from('users')
                .select('*')
                .eq('user_id', currentUser.user_id)
                .single();
            
            if (senderError) throw senderError;
            
            // Check PIN
            if (sender.payment_pin !== pin) {
                errorElement.textContent = 'PIN မှားယွင်းနေပါသည်။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            // Check KYC status
            if (sender.passport_status !== 'approved') {
                errorElement.textContent = 'ငွေလွှဲရန် KYC အတည်ပြုရန် လိုအပ်ပါသည်။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            // Check balance
            if (sender.balance < amount) {
                errorElement.textContent = 'လက်ကျန်ငွေ မလုံလောက်ပါ။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            // Check if recipient exists
            let recipient;
            if (recipientInfo) {
                recipient = recipientInfo;
            } else {
                const { data: recipientData, error: recipientError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('phone', phone)
                    .single();
                
                if (recipientError || !recipientData) {
                    errorElement.textContent = 'လက်ခံမည့်သူ မတွေ့ရှိပါ။';
                    errorElement.style.display = 'block';
                    successElement.style.display = 'none';
                    return;
                }
                
                recipient = recipientData;
            }
            
            // Check if sending to self
            if (sender.phone === recipient.phone) {
                errorElement.textContent = 'ကိုယ့်ကိုယ်ကို ငွေလွှဲ၍မရပါ။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            // Create transaction
            const transactionId = generateTransactionId();
            const timestamp = new Date().toISOString();
            
            const { data: transaction, error: transactionError } = await supabase
                .from('transactions')
                .insert([
                    {
                        id: transactionId,
                        from_phone: sender.phone,
                        to_phone: recipient.phone,
                        amount,
                        note,
                        created_at: timestamp
                    }
                ])
                .select()
                .single();
            
            if (transactionError) throw transactionError;
            
            // Update sender's balance
            const { error: updateSenderError } = await supabase
                .from('users')
                .update({ balance: sender.balance - amount })
                .eq('user_id', sender.user_id);
            
            if (updateSenderError) throw updateSenderError;
            
            // Update recipient's balance
            const { error: updateRecipientError } = await supabase
                .from('users')
                .update({ balance: recipient.balance + amount })
                .eq('user_id', recipient.user_id);
            
            if (updateRecipientError) throw updateRecipientError;
            
            // Transfer successful
            errorElement.style.display = 'none';
            successElement.textContent = `${amount.toLocaleString()} Ks ကို ${phone} သို့ အောင်မြင်စွာ လွှဲပြောင်းပြီးပါပြီ။`;
            successElement.style.display = 'block';
            
            // Show receipt
            showTransactionReceipt({
                id: transactionId,
                from_phone: sender.phone,
                to_phone: recipient.phone,
                amount,
                note,
                created_at: timestamp
            }, sender.phone);
            
            // Clear form
            document.getElementById('transfer-phone').value = '';
            document.getElementById('transfer-amount').value = '';
            document.getElementById('transfer-note').value = '';
            document.getElementById('transfer-pin').value = '';
            recipientStatusElement.innerHTML = '';
            recipientInfo = null;
            
            // Refresh user data
            await loadUserData();
        } catch (error) {
            console.error('Transfer error:', error);
            errorElement.textContent = 'ငွေလွှဲရာတွင် အမှားရှိနေပါသည်။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
        }
    });
    
    // KYC form
    const kycSubmitBtn = document.getElementById('kyc-submit-btn');
    
    kycSubmitBtn.addEventListener('click', async () => {
        const passportNumber = document.getElementById('kyc-passport').value;
        const address = document.getElementById('kyc-address').value;
        const pin = document.getElementById('kyc-pin').value;
        const confirmPin = document.getElementById('kyc-confirm-pin').value;
        const passportFile = document.getElementById('passport-upload').files[0];
        const selfieFile = document.getElementById('selfie-upload').files[0];
        const errorElement = document.getElementById('kyc-error');
        const successElement = document.getElementById('kyc-success');
        
        // Validate inputs
        if (!passportNumber || !address || !pin || !confirmPin || !passportFile || !selfieFile) {
            errorElement.textContent = 'အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        if (pin !== confirmPin) {
            errorElement.textContent = 'PIN နှင့် အတည်ပြု PIN မတူညီပါ။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        if (pin.length !== 6 || !/^\d+$/.test(pin)) {
            errorElement.textContent = 'PIN သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        try {
            // Upload passport image
            const passportFileName = `passport_${currentUser.user_id}_${Date.now()}`;
            const { data: passportData, error: passportError } = await supabase.storage
                .from('kyc-documents')
                .upload(passportFileName, passportFile);
            
            if (passportError) throw passportError;
            
            // Get passport URL
            const { data: passportUrl } = await supabase.storage
                .from('kyc-documents')
                .getPublicUrl(passportFileName);
            
            // Upload selfie image
            const selfieFileName = `selfie_${currentUser.user_id}_${Date.now()}`;
            const { data: selfieData, error: selfieError } = await supabase.storage
                .from('kyc-documents')
                .upload(selfieFileName, selfieFile);
            
            if (selfieError) throw selfieError;
            
            // Get selfie URL
            const { data: selfieUrl } = await supabase.storage
                .from('kyc-documents')
                .getPublicUrl(selfieFileName);
            
            // Update user profile
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    passport_number: passportNumber,
                    address,
                    payment_pin: pin,
                    passport_image: passportUrl.publicUrl,
                    selfie_image: selfieUrl.publicUrl,
                    passport_status: 'pending',
                    submitted_at: new Date().toISOString()
                })
                .eq('user_id', currentUser.user_id);
            
            if (updateError) throw updateError;
            
            // KYC submission successful
            errorElement.style.display = 'none';
            successElement.textContent = 'KYC အချက်အလက်များ အောင်မြင်စွာ တင်သွင်းပြီးပါပြီ။ စိစစ်နေပါပြီ။';
            successElement.style.display = 'block';
            
            // Update KYC status
            userKycStatus = 'pending';
            updateKycStatus();
            
            // Clear form
            document.getElementById('kyc-passport').value = '';
            document.getElementById('kyc-address').value = '';
            document.getElementById('kyc-pin').value = '';
            document.getElementById('kyc-confirm-pin').value = '';
            document.getElementById('passport-upload').value = '';
            document.getElementById('selfie-upload').value = '';
            document.getElementById('passport-preview').innerHTML = '';
            document.getElementById('selfie-preview').innerHTML = '';
        } catch (error) {
            console.error('KYC submission error:', error);
            errorElement.textContent = 'KYC တင်သွင်းရာတွင် အမှားရှိနေပါသည်။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
        }
    });
    
    // Change password form
    const savePasswordBtn = document.getElementById('save-password-btn');
    
    savePasswordBtn.addEventListener('click', async () => {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmNewPassword = document.getElementById('confirm-new-password').value;
        const errorElement = document.getElementById('change-password-error');
        const successElement = document.getElementById('change-password-success');
        
        // Validate inputs
        if (!currentPassword || !newPassword || !confirmNewPassword) {
            errorElement.textContent = 'အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        if (newPassword !== confirmNewPassword) {
            errorElement.textContent = 'စကားဝှက်အသစ်နှင့် အတည်ပြုစကားဝှက် မတူညီပါ။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        try {
            // Check current password
            const { data: user, error } = await supabase
                .from('auth_users')
                .select('password')
                .eq('user_id', currentUser.user_id)
                .single();
            
            if (error) throw error;
            
            if (user.password !== currentPassword) {
                errorElement.textContent = 'လက်ရှိစကားဝှက် မှားယွင်းနေပါသည်။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            // Update password
            const { error: updateError } = await supabase
                .from('auth_users')
                .update({ password: newPassword })
                .eq('user_id', currentUser.user_id);
            
            if (updateError) throw updateError;
            
            // Password change successful
            errorElement.style.display = 'none';
            successElement.textContent = 'စကားဝှက် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။';
            successElement.style.display = 'block';
            
            // Clear form
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-new-password').value = '';
            
            // Close modal after a delay
            setTimeout(() => {
                document.getElementById('change-password-modal').classList.remove('active');
            }, 2000);
        } catch (error) {
            console.error('Change password error:', error);
            errorElement.textContent = 'စကားဝှက်ပြောင်းရာတွင် အမှားရှိနေပါသည်။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
        }
    });
    
    // Change PIN form
    const savePinBtn = document.getElementById('save-pin-btn');
    
    savePinBtn.addEventListener('click', async () => {
        const currentPin = document.getElementById('current-pin').value;
        const newPin = document.getElementById('new-pin').value;
        const confirmNewPin = document.getElementById('confirm-new-pin').value;
        const errorElement = document.getElementById('change-pin-error');
        const successElement = document.getElementById('change-pin-success');
        
        // Validate inputs
        if (!currentPin || !newPin || !confirmNewPin) {
            errorElement.textContent = 'အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        if (newPin !== confirmNewPin) {
            errorElement.textContent = 'PIN အသစ်နှင့် အတည်ပြု PIN မတူညီပါ။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
            errorElement.textContent = 'PIN သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        try {
            // Check current PIN
            const { data: user, error } = await supabase
                .from('users')
                .select('payment_pin')
                .eq('user_id', currentUser.user_id)
                .single();
            
            if (error) throw error;
            
            if (user.payment_pin !== currentPin) {
                errorElement.textContent = 'လက်ရှိ PIN မှားယွင်းနေပါသည်။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            // Update PIN
            const { error: updateError } = await supabase
                .from('users')
                .update({ payment_pin: newPin })
                .eq('user_id', currentUser.user_id);
            
            if (updateError) throw updateError;
            
            // PIN change successful
            errorElement.style.display = 'none';
            successElement.textContent = 'PIN အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။';
            successElement.style.display = 'block';
            
            // Clear form
            document.getElementById('current-pin').value = '';
            document.getElementById('new-pin').value = '';
            document.getElementById('confirm-new-pin').value = '';
            
            // Close modal after a delay
            setTimeout(() => {
                document.getElementById('change-pin-modal').classList.remove('active');
            }, 2000);
        } catch (error) {
            console.error('Change PIN error:', error);
            errorElement.textContent = 'PIN ပြောင်းရာတွင် အမှားရှိနေပါသည်။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
        }
    });
    
    // Delete account form
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    
    confirmDeleteBtn.addEventListener('click', async () => {
        const password = document.getElementById('delete-password').value;
        const confirmDelete = document.getElementById('confirm-delete').checked;
        const errorElement = document.getElementById('delete-account-error');
        
        // Validate inputs
        if (!password || !confirmDelete) {
            errorElement.textContent = 'စကားဝှက်ထည့်၍ အတည်ပြုချက်ကို အမှန်ခြစ်ပါ။';
            errorElement.style.display = 'block';
            return;
        }
        
        try {
            // Check password
            const { data: user, error } = await supabase
                .from('auth_users')
                .select('password')
                .eq('user_id', currentUser.user_id)
                .single();
            
            if (error) throw error;
            
            if (user.password !== password) {
                errorElement.textContent = 'စကားဝှက် မှားယွင်းနေပါသည်။';
                errorElement.style.display = 'block';
                return;
            }
            
            // Delete user profile
            const { error: deleteProfileError } = await supabase
                .from('users')
                .delete()
                .eq('user_id', currentUser.user_id);
            
            if (deleteProfileError) throw deleteProfileError;
            
            // Delete auth user
            const { error: deleteAuthError } = await supabase
                .from('auth_users')
                .delete()
                .eq('user_id', currentUser.user_id);
            
            if (deleteAuthError) throw deleteAuthError;
            
            // Account deletion successful
            localStorage.removeItem('opperSession');
            currentUser = null;
            
            // Show auth container
            showAuthContainer();
            
            // Close modal
            document.getElementById('delete-account-modal').classList.remove('active');
            
            // Show message
            alert('အကောင့်ကို အောင်မြင်စွာ ဖျက်ပြီးပါပြီ။');
        } catch (error) {
            console.error('Delete account error:', error);
            errorElement.textContent = 'အကောင့်ဖျက်ရာတွင် အမှားရှိနေပါသည်။';
            errorElement.style.display = 'block';
        }
    });
}

// Simulate Google login/signup
function simulateGoogleLogin(type) {
    // For demo purposes, we'll use a mock Google account
    const googleEmail = 'user@  {
    // For demo purposes, we'll use a mock Google account
    const googleEmail = 'user@gmail.com';
    const googleName = 'User';
    
    if (type === 'login') {
        // Check if account exists
        supabase
            .from('auth_users')
            .select('*')
            .eq('email', googleEmail)
            .single()
            .then(({ data: user, error }) => {
                if (error || !user) {
                    // No account found, show error
                    const errorElement = document.getElementById('login-error');
                    errorElement.textContent = 'Google အကောင့်ဖြင့် အကောင့်မတွေ့ရှိပါ။ အကောင့်ဖွင့်ပါ။';
                    errorElement.style.display = 'block';
                    return;
                }
                
                // Login successful
                currentUser = user;
                
                // Save session
                const sessionData = {
                    email: user.email,
                    user_id: user.user_id
                };
                localStorage.setItem('opperSession', JSON.stringify(sessionData));
                
                // Show success message
                const successElement = document.getElementById('login-success');
                successElement.textContent = 'Google ဖြင့် အကောင့်ဝင်ရောက်နေပါသည်...';
                successElement.style.display = 'block';
                
                // Load user data and show app
                loadUserData().then(() => {
                    showAppContainer();
                });
            });
    } else if (type === 'signup') {
        // Check if account already exists
        supabase
            .from('auth_users')
            .select('email')
            .eq('email', googleEmail)
            .single()
            .then(({ data: existingUser, error: checkError }) => {
                if (existingUser) {
                    // Account already exists
                    const errorElement = document.getElementById('signup-error');
                    errorElement.textContent = 'ဤ Google အကောင့်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။';
                    errorElement.style.display = 'block';
                    return;
                }
                
                // Generate user ID
                const userId = generateUserId(googleEmail);
                
                // Create auth user
                supabase
                    .from('auth_users')
                    .insert([
                        {
                            email: googleEmail,
                            password: 'google-auth', // Special password for Google auth
                            user_id: userId
                        }
                    ])
                    .select()
                    .single()
                    .then(({ data: authUser, error: authError }) => {
                        if (authError) {
                            console.error('Google signup error:', authError);
                            const errorElement = document.getElementById('signup-error');
                            errorElement.textContent = 'Google ဖြင့် အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။';
                            errorElement.style.display = 'block';
                            return;
                        }
                        
                        // Create user profile
                        supabase
                            .from('users')
                            .insert([
                                {
                                    user_id: userId,
                                    balance: 0,
                                    passport_status: 'pending'
                                }
                            ])
                            .then(({ error: profileError }) => {
                                if (profileError) {
                                    console.error('Google signup profile error:', profileError);
                                    const errorElement = document.getElementById('signup-error');
                                    errorElement.textContent = 'Google ဖြင့် အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။';
                                    errorElement.style.display = 'block';
                                    return;
                                }
                                
                                // Signup successful
                                const successElement = document.getElementById('signup-success');
                                successElement.textContent = 'Google ဖြင့် အကောင့်ဖွင့်ပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။';
                                successElement.style.display = 'block';
                                
                                // Switch to login tab after a delay
                                setTimeout(() => {
                                    document.querySelector('.auth-tab[data-tab="login"]').click();
                                }, 2000);
                            });
                    });
            });
    }
}

// Generate user ID based on email
function generateUserId(email) {
    // Extract username from email
    const username = email.split('@')[0];
    
    // Generate random number
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    // Combine with timestamp
    const timestamp = Date.now().toString().slice(-4);
    
    // Create user ID
    return `${username.slice(0, 4)}${randomNum}${timestamp}`;
}

// Show specific page
function showPage(pageName) {
    // Update active link in sidebar
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a');
    sidebarLinks.forEach(link => {
        link.parentElement.classList.remove('active');
        if (link.getAttribute('data-page') === pageName) {
            link.parentElement.classList.add('active');
        }
    });
    
    // Show corresponding page
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
        page.classList.remove('active');
        if (page.id === `${pageName}-page`) {
            page.classList.add('active');
        }
    });
    
    // Close dropdown
    document.getElementById('profile-dropdown').classList.remove('active');
    
    // Close sidebar on mobile
    if (window.innerWidth < 992) {
        document.getElementById('sidebar').classList.remove('active');
    }
}

// Logout function
function logout() {
    // Clear session
    localStorage.removeItem('opperSession');
    currentUser = null;
    
    // Show auth container
    showAuthContainer();
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
