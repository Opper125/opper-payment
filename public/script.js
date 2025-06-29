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
    
    // Setup real-time verification
    setupRealtimeVerification();
    
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
                .eq('id', sessionData.userId)
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
    if (!currentUser) return;
    
    try {
        // Update user info in UI
        updateUserUI(currentUser);
        
        // Update KYC status
        updateKycStatus();
        
        // Update transfer status
        updateTransferStatus();
        
        // Setup realtime subscriptions
        setupRealtimeSubscriptions();
        
        // Load transactions
        await loadTransactions();
        
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Update user UI
function updateUserUI(userData) {
    const userName = userData.email.split('@')[0];
    const userInitial = userName.charAt(0).toUpperCase();
    const userId = userData.id.toString().padStart(8, '0');
    
    // Update header
    document.getElementById('user-name').textContent = userName;
    document.getElementById('user-id').textContent = `ID: ${userId}`;
    document.getElementById('user-initial').textContent = userInitial;
    
    // Update sidebar
    document.getElementById('user-name-sidebar').textContent = userName;
    document.getElementById('user-id-sidebar').textContent = `ID: ${userId}`;
    document.getElementById('user-initial-sidebar').textContent = userInitial;
    
    // Update greeting
    document.getElementById('greeting-name').textContent = userName;
    
    // Update balance
    userBalance = parseFloat(userData.balance) || 0;
    document.getElementById('balance-amount').textContent = `${userBalance.toLocaleString()} Ks`;
    document.getElementById('user-balance').textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`;
    
    // Update settings
    document.getElementById('settings-email').textContent = userData.email;
    document.getElementById('settings-phone').textContent = userData.phone || 'မထည့်သွင်းထားပါ';
    
    // Store KYC status
    userKycStatus = userData.kyc_status || 'pending';
}

// Update KYC status
function updateKycStatus() {
    const kycStatusElement = document.getElementById('kyc-status');
    const kycStatusCard = document.getElementById('kyc-status-card');
    
    if (userKycStatus === 'approved') {
        kycStatusElement.textContent = 'KYC: အတည်ပြုပြီး';
        kycStatusCard.innerHTML = `
            <div class="status-card approved">
                <div class="status-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="status-info">
                    <h4>KYC အခြေအနေ: အတည်ပြုပြီး</h4>
                    <p>သင့်အကောင့်သည် အပြည့်အ၀ အတည်ပြုပြီးဖြစ်ပါသည်</p>
                </div>
            </div>
        `;
    } else if (userKycStatus === 'rejected') {
        kycStatusElement.textContent = 'KYC: ငြင်းပယ်ခံရသည်';
        kycStatusCard.innerHTML = `
            <div class="status-card rejected">
                <div class="status-icon">
                    <i class="fas fa-times-circle"></i>
                </div>
                <div class="status-info">
                    <h4>KYC အခြေအနေ: ငြင်းပယ်ခံရသည်</h4>
                    <p>သင့် KYC လျှောက်ထားမှုကို ငြင်းပယ်ခံရပါသည်။ ပြန်လည်လျှောက်ထားပါ</p>
                </div>
            </div>
        `;
    } else {
        kycStatusElement.textContent = 'KYC: စောင့်ဆိုင်းဆဲ';
        kycStatusCard.innerHTML = `
            <div class="status-card pending">
                <div class="status-icon">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="status-info">
                    <h4>KYC အခြေအနေ: စောင့်ဆိုင်းဆဲ</h4>
                    <p>သင့်အကောင့်အတည်ပြုခြင်းအတွက် အောက်ပါအချက်အလက်များ ဖြည့်စွက်ပါ</p>
                </div>
            </div>
        `;
    }
}

// Update transfer status
function updateTransferStatus() {
    const transferStatusElement = document.getElementById('transfer-status');
    
    if (userKycStatus === 'approved') {
        transfersEnabled = true;
        transferStatusElement.textContent = 'ငွေလွှဲခြင်း: ခွင့်ပြုထားသည်';
    } else {
        transfersEnabled = userBalance < 100000; // Allow small transfers without KYC
        transferStatusElement.textContent = transfersEnabled ? 
            'ငွေလွှဲခြင်း: ကန့်သတ်ချက်ရှိသည်' : 
            'ငွေလွှဲခြင်း: KYC လိုအပ်သည်';
    }
}

// Setup realtime subscriptions
function setupRealtimeSubscriptions() {
    // Subscribe to balance changes
    supabase
        .channel('balance_changes')
        .on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'auth_users', filter: `id=eq.${currentUser.id}` },
            (payload) => {
                currentUser = payload.new;
                updateUserUI(currentUser);
            }
        )
        .subscribe();
    
    // Subscribe to new transactions
    supabase
        .channel('transaction_changes')
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'transactions' },
            async (payload) => {
                if (payload.new.from_user_id === currentUser.id || payload.new.to_user_id === currentUser.id) {
                    await loadTransactions();
                }
            }
        )
        .subscribe();
}

// Load transactions
async function loadTransactions() {
    try {
        const { data: transactionData, error } = await supabase
            .from('transactions')
            .select(`
                *,
                from_user:auth_users!transactions_from_user_id_fkey(email, phone),
                to_user:auth_users!transactions_to_user_id_fkey(email, phone)
            `)
            .or(`from_user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`)
            .order('created_at', { ascending: false })
            .limit(50);
            
        if (error) {
            console.error('Error loading transactions:', error);
            return;
        }
        
        transactions = transactionData || [];
        updateTransactionsUI(transactions, currentUser.phone);
        
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

// Update transactions UI
function updateTransactionsUI(transactions, userPhone) {
    const recentTransactionsList = document.getElementById('recent-transactions-list');
    const transactionList = document.getElementById('transaction-list');
    
    if (transactions.length === 0) {
        const emptyState = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>လုပ်ဆောင်ချက်မှတ်တမ်းမရှိသေးပါ</p>
            </div>
        `;
        recentTransactionsList.innerHTML = emptyState;
        if (transactionList) transactionList.innerHTML = emptyState;
        return;
    }
    
    // Recent transactions (last 5)
    const recentTransactions = transactions.slice(0, 5);
    recentTransactionsList.innerHTML = recentTransactions.map(transaction => {
        const isSent = transaction.from_user_id === currentUser.id;
        const otherUser = isSent ? transaction.to_user : transaction.from_user;
        const amount = parseFloat(transaction.amount);
        const formattedDate = new Date(transaction.created_at).toLocaleDateString('my-MM');
        
        return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-icon ${isSent ? 'sent' : 'received'}">
                        <i class="fas ${isSent ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                    </div>
                    <div class="transaction-details">
                        <h4>${isSent ? 'ပို့သည်' : 'လက်ခံသည်'} ${otherUser?.phone || otherUser?.email || 'Unknown'}</h4>
                        <p>${formattedDate} • ${transaction.status === 'completed' ? 'အောင်မြင်' : transaction.status === 'pending' ? 'စောင့်ဆိုင်းဆဲ' : 'မအောင်မြင်'}</p>
                    </div>
                </div>
                <div class="transaction-amount">
                    <p class="amount ${isSent ? 'sent' : 'received'}">
                        ${isSent ? '-' : '+'}${amount.toLocaleString()} Ks
                    </p>
                    <p class="status">${transaction.status === 'completed' ? 'အောင်မြင်' : transaction.status === 'pending' ? 'စောင့်ဆိုင်းဆဲ' : 'မအောင်မြင်'}</p>
                </div>
            </div>
        `;
    }).join('');
    
    // All transactions (for history page)
    if (transactionList) {
        transactionList.innerHTML = transactions.map(transaction => {
            const isSent = transaction.from_user_id === currentUser.id;
            const otherUser = isSent ? transaction.to_user : transaction.from_user;
            const amount = parseFloat(transaction.amount);
            const formattedDate = new Date(transaction.created_at).toLocaleDateString('my-MM');
            const formattedTime = new Date(transaction.created_at).toLocaleTimeString('my-MM', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            return `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <div class="transaction-icon ${isSent ? 'sent' : 'received'}">
                            <i class="fas ${isSent ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                        </div>
                        <div class="transaction-details">
                            <h4>${isSent ? 'ပို့သည်' : 'လက်ခံသည်'} ${otherUser?.phone || otherUser?.email || 'Unknown'}</h4>
                            <p>${formattedDate} ${formattedTime}</p>
                            ${transaction.note ? `<p class="transaction-note">${transaction.note}</p>` : ''}
                        </div>
                    </div>
                    <div class="transaction-amount">
                        <p class="amount ${isSent ? 'sent' : 'received'}">
                            ${isSent ? '-' : '+'}${amount.toLocaleString()} Ks
                        </p>
                        <p class="status">${transaction.status === 'completed' ? 'အောင်မြင်' : transaction.status === 'pending' ? 'စောင့်ဆိုင်းဆဲ' : 'မအောင်မြင်'}</p>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Initialize UI
function initializeUI() {
    // Setup auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Update active tab
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show target form
            document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
            document.getElementById(`${targetTab}-form`).classList.add('active');
        });
    });
    
    // Setup sidebar navigation
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = link.dataset.page;
            showPage(targetPage);
        });
    });
    
    // Setup menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const closeSidebar = document.getElementById('close-sidebar');
    
    menuToggle?.addEventListener('click', () => {
        sidebar.classList.add('active');
    });
    
    closeSidebar?.addEventListener('click', () => {
        sidebar.classList.remove('active');
    });
    
    // Setup password toggles
    setupPasswordToggles();
    
    // Setup PIN inputs
    setupPinInputs();
    
    // Setup form submissions
    setupFormSubmissions();
    
    // Setup modals
    setupModals();
}

// Setup password toggles
function setupPasswordToggles() {
    document.querySelectorAll('.toggle-password').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const input = toggle.previousElementSibling;
            const isPassword = input.type === 'password';
            
            input.type = isPassword ? 'text' : 'password';
            toggle.classList.toggle('fa-eye-slash', !isPassword);
            toggle.classList.toggle('fa-eye', isPassword);
        });
    });
}

// Setup PIN inputs
function setupPinInputs() {
    const pinInputs = document.querySelectorAll('.pin-digit');
    
    pinInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < pinInputs.length - 1) {
                pinInputs[index + 1].focus();
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
                pinInputs[index - 1].focus();
            }
        });
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
            errorElement.textContent = 'အီးမေးလ်နှင့် စကားဝှက် ဖြည့်စွက်ပါ။';
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
                errorElement.textContent = 'အီးမေးလ် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            // In a real app, you would verify the password with bcrypt
            // For demo purposes, we'll just check if it matches the stored password
            if (user.password !== password) {
                errorElement.textContent = 'အီးမေးလ် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            // Store session
            const sessionData = {
                userId: user.id,
                email: user.email,
                loginTime: new Date().toISOString()
            };
            
            localStorage.setItem('opperSession', JSON.stringify(sessionData));
            
            // Clear form and show success
            errorElement.style.display = 'none';
            successElement.textContent = 'အကောင့်ဝင်ခြင်း အောင်မြင်ပါသည်!';
            successElement.style.display = 'block';
            
            // Load user data and show app
            currentUser = user;
            await loadUserData();
            
            setTimeout(() => {
                showAppContainer();
            }, 1000);
            
        } catch (error) {
            console.error('Login error:', error);
            errorElement.textContent = 'အကောင့်ဝင်ရာတွင် အမှားရှိနေပါသည်။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
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
            errorElement.textContent = 'အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        if (password !== confirmPassword) {
            errorElement.textContent = 'စကားဝှက်နှစ်ခု မတူညီပါ။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        if (!termsAgree) {
            errorElement.textContent = 'စည်းမျဉ်းစည်းကမ်းများကို သဘောတူရပါမည်။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        try {
            // Check if user already exists
            const { data: existingUser } = await supabase
                .from('auth_users')
                .select('id')
                .or(`email.eq.${email},phone.eq.${phone}`)
                .single();
                
            if (existingUser) {
                errorElement.textContent = 'ဤအီးမေးလ် သို့မဟုတ် ဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိနေပြီးဖြစ်ပါသည်။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            // Create new user
            const { data: newUser, error } = await supabase
                .from('auth_users')
                .insert([{
                    email: email,
                    phone: phone,
                    password: password, // In production, this should be hashed
                    balance: 10000, // Starting balance
                    kyc_status: 'pending',
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();
                
            if (error) {
                console.error('Signup error:', error);
                errorElement.textContent = 'အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            // Clear form and show success
            errorElement.style.display = 'none';
            successElement.textContent = 'အကောင့်ဖွင့်ခြင်း အောင်မြင်ပါသည်! အကောင့်ဝင်ပါ။';
            successElement.style.display = 'block';
            
            // Clear form
            document.getElementById('signup-email').value = '';
            document.getElementById('signup-phone').value = '';
            document.getElementById('signup-password').value = '';
            document.getElementById('signup-confirm-password').value = '';
            document.getElementById('terms-agree').checked = false;
            
            // Switch to login tab
            setTimeout(() => {
                document.querySelector('.auth-tab[data-tab="login"]').click();
                document.getElementById('login-email').value = email;
            }, 2000);
            
        } catch (error) {
            console.error('Signup error:', error);
            errorElement.textContent = 'အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
        }
    });
    
    // Transfer form
    const transferBtn = document.getElementById('transfer-btn');
    
    transferBtn.addEventListener('click', async () => {
        const phone = document.getElementById('transfer-phone').value;
        const amount = parseFloat(document.getElementById('transfer-amount').value);
        const note = document.getElementById('transfer-note').value;
        const errorElement = document.getElementById('transfer-error');
        const successElement = document.getElementById('transfer-success');
        
        // Validate inputs
        if (!phone || !amount) {
            errorElement.textContent = 'ဖုန်းနံပါတ်နှင့် ငွေပမာဏ ဖြည့်စွက်ပါ။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        if (amount < 1000) {
            errorElement.textContent = 'အနည်းဆုံး 1,000 Ks လွှဲရပါမည်။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        const fee = 100;
        const total = amount + fee;
        
        if (total > userBalance) {
            errorElement.textContent = 'လက်ကျန်ငွေ မလုံလောက်ပါ။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        try {
            // Check if recipient exists
            const { data: recipient, error: recipientError } = await supabase
                .from('auth_users')
                .select('*')
                .eq('phone', phone)
                .single();
                
            if (recipientError || !recipient) {
                console.log('No account found for phone number:', phone);
                errorElement.textContent = 'လက်ခံမည့်သူ မတွေ့ရှိပါ။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            console.log('Account found:', recipient);
            
            // Clear any previous errors
            errorElement.style.display = 'none';
            
            // Show PIN entry modal
            showPinEntryModal();
        } catch (error) {
            console.error('Transfer validation error:', error);
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
        
        if (pin.length !== 4) {
            errorElement.textContent = 'PIN သည် ၄ လုံးသားဖြစ်ရပါမည်။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
            return;
        }
        
        try {
            // In a real app, you would upload the files to storage
            // For now, we'll just update the user's KYC status to pending
            
            const { error } = await supabase
                .from('auth_users')
                .update({
                    passport_number: passportNumber,
                    address: address,
                    pin: pin, // In production, this should be hashed
                    kyc_status: 'pending',
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentUser.id);
                
            if (error) {
                console.error('KYC submission error:', error);
                errorElement.textContent = 'KYC လျှောက်ထားရာတွင် အမှားရှိနေပါသည်။';
                errorElement.style.display = 'block';
                successElement.style.display = 'none';
                return;
            }
            
            // Clear form and show success
            errorElement.style.display = 'none';
            successElement.textContent = 'KYC လျှောက်ထားမှု အောင်မြင်ပါသည်! စစ်ဆေးမှုကို စောင့်ဆိုင်းပါ။';
            successElement.style.display = 'block';
            
            // Update local user data
            currentUser.passport_number = passportNumber;
            currentUser.address = address;
            currentUser.pin = pin;
            currentUser.kyc_status = 'pending';
            
            updateKycStatus();
            
        } catch (error) {
            console.error('KYC submission error:', error);
            errorElement.textContent = 'KYC လျှောက်ထားရာတွင် အမှားရှိနေပါသည်။';
            errorElement.style.display = 'block';
            successElement.style.display = 'none';
        }
    });
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', logout);
    
    // Google login simulation
    document.getElementById('google-login-btn').addEventListener('click', () => {
        simulateGoogleLogin('login');
    });
    
    document.getElementById('google-signup-btn').addEventListener('click', () => {
        simulateGoogleLogin('signup');
    });
}

// Setup modals
function setupModals() {
    // PIN entry modal
    const closePinModal = document.getElementById('close-pin-modal');
    const confirmPinBtn = document.getElementById('confirm-pin-btn');
    
    closePinModal?.addEventListener('click', () => {
        pinEntryModal.classList.remove('active');
    });
    
    confirmPinBtn?.addEventListener('click', async () => {
        const pinDigits = document.querySelectorAll('.pin-digit');
        const pin = Array.from(pinDigits).map(input => input.value).join('');
        
        if (pin.length !== 4) {
            alert('PIN ကို အပြည့်အစုံ ထည့်ပါ');
            return;
        }
        
        await processTransfer(pin);
    });
    
    // Receipt modal
    const closeReceiptModal = document.getElementById('close-receipt-modal');
    const downloadReceiptBtn = document.getElementById('download-receipt-btn');
    
    closeReceiptModal?.addEventListener('click', () => {
        receiptModal.classList.remove('active');
    });
    
    downloadReceiptBtn?.addEventListener('click', downloadReceipt);
    
    // Click outside to close modals
    [pinEntryModal, receiptModal].forEach(modal => {
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

// Show PIN entry modal
function showPinEntryModal() {
    pinEntryModal.classList.add('active');
    document.querySelector('.pin-digit').focus();
}

// Process transfer
async function processTransfer(pin) {
    const phone = document.getElementById('transfer-phone').value;
    const amount = parseFloat(document.getElementById('transfer-amount').value);
    const note = document.getElementById('transfer-note').value;
    
    try {
        // Verify PIN (in a real app, this would be hashed and checked securely)
        if (currentUser.pin && pin !== currentUser.pin) {
            alert('PIN မှားယွင်းနေပါသည်');
            return;
        }
        
        // Close PIN modal and show processing
        pinEntryModal.classList.remove('active');
        processingOverlay.classList.add('active');
        
        // Get recipient
        const { data: recipient } = await supabase
            .from('auth_users')
            .select('*')
            .eq('phone', phone)
            .single();
        
        const fee = 100;
        const total = amount + fee;
        
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Create transaction
        const { data: transaction, error: transactionError } = await supabase
            .from('transactions')
            .insert([{
                from_user_id: currentUser.id,
                to_user_id: recipient.id,
                amount: amount.toString(),
                fee: fee.toString(),
                note: note || null,
                status: 'completed',
                created_at: new Date().toISOString()
            }])
            .select()
            .single();
            
        if (transactionError) {
            throw transactionError;
        }
        
        // Update balances
        await Promise.all([
            supabase
                .from('auth_users')
                .update({ balance: (userBalance - total).toString() })
                .eq('id', currentUser.id),
            supabase
                .from('auth_users')
                .update({ balance: (parseFloat(recipient.balance) + amount).toString() })
                .eq('id', recipient.id)
        ]);
        
        // Update local balance
        userBalance -= total;
        currentUser.balance = userBalance.toString();
        updateUserUI(currentUser);
        
        // Hide processing overlay
        processingOverlay.classList.remove('active');
        
        // Show transaction receipt
        showTransactionReceipt({
            ...transaction,
            recipient_phone: recipient.phone,
            recipient_email: recipient.email
        });
        
        // Clear transfer form
        document.getElementById('transfer-phone').value = '';
        document.getElementById('transfer-amount').value = '';
        document.getElementById('transfer-note').value = '';
        
        // Clear PIN inputs
        document.querySelectorAll('.pin-digit').forEach(input => input.value = '');
        
        // Reload transactions
        await loadTransactions();
        
    } catch (error) {
        console.error('Transfer processing error:', error);
        processingOverlay.classList.remove('active');
        alert('ငွေလွှဲရာတွင် အမှားရှိနေပါသည်');
    }
}

// Show transaction receipt
function showTransactionReceipt(transaction) {
    // Update receipt details
    document.getElementById('receipt-sender').textContent = currentUser.email;
    document.getElementById('receipt-recipient').textContent = transaction.recipient_phone;
    document.getElementById('receipt-amount').textContent = `${parseFloat(transaction.amount).toLocaleString()} Ks`;
    document.getElementById('receipt-fee').textContent = `${parseFloat(transaction.fee).toLocaleString()} Ks`;
    document.getElementById('receipt-total').textContent = `${(parseFloat(transaction.amount) + parseFloat(transaction.fee)).toLocaleString()} Ks`;
    document.getElementById('receipt-date').textContent = new Date(transaction.created_at).toLocaleString('my-MM');
    document.getElementById('receipt-ref').textContent = `TXN${transaction.id.toString().padStart(8, '0')}`;
    
    // Show receipt modal
    receiptModal.classList.add('active');
}

// Download receipt
function downloadReceipt() {
    const receiptContent = document.getElementById('receipt-content');
    
    html2canvas(receiptContent).then(canvas => {
        const link = document.createElement('a');
        link.download = `OPPER_Receipt_${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    });
}

// Simulate Google login
function simulateGoogleLogin(type) {
    const emails = ['johndoe@gmail.com', 'maryjane@gmail.com', 'alexsmith@gmail.com'];
    const randomEmail = emails[Math.floor(Math.random() * emails.length)];
    
    if (type === 'login') {
        document.getElementById('login-email').value = randomEmail;
        document.getElementById('login-password').value = 'password123';
        
        // Show success message
        const successElement = document.getElementById('login-success');
        successElement.textContent = 'Google အကောင့်ဖြင့် ချိတ်ဆက်ပြီးပါပြီ!';
        successElement.style.display = 'block';
        
        // Simulate login after delay
        setTimeout(() => {
            document.getElementById('login-btn').click();
        }, 1500);
    } else {
        document.getElementById('signup-email').value = randomEmail;
        document.getElementById('signup-phone').value = `0912345${Math.floor(Math.random() * 9000) + 1000}`;
        document.getElementById('signup-password').value = 'password123';
        document.getElementById('signup-confirm-password').value = 'password123';
        document.getElementById('terms-agree').checked = true;
        
        // Show success message
        const successElement = document.getElementById('signup-success');
        successElement.textContent = 'Google အကောင့်ဖြင့် ချိတ်ဆက်ပြီးပါပြီ!';
        successElement.style.display = 'block';
        
        // Auto submit after delay
        setTimeout(() => {
            document.getElementById('signup-btn').click();
        }, 1500);
    }
}

// Helper function to generate unique user ID
function generateUserId(email) {
    return email.split('@')[0] + Math.random().toString(36).substr(2, 4);
}

// Show page
function showPage(pageName) {
    // Update sidebar active state
    document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
    document.querySelector(`[data-page="${pageName}"]`).closest('li').classList.add('active');
    
    // Show target page
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(`${pageName}-page`).classList.add('active');
    
    // Close sidebar on mobile
    if (window.innerWidth <= 1024) {
        document.getElementById('sidebar').classList.remove('active');
    }
}

// Logout
function logout() {
    localStorage.removeItem('opperSession');
    currentUser = null;
    showAuthContainer();
}

// Show/hide functions
function showLoader() {
    loader.classList.add('active');
}

function hideLoader() {
    loader.classList.remove('active');
}

function showAuthContainer() {
    authContainer.style.display = 'flex';
    appContainer.classList.add('hidden');
}

function showAppContainer() {
    authContainer.style.display = 'none';
    appContainer.classList.remove('hidden');
}

// Auto-update transfer summary
document.getElementById('transfer-amount')?.addEventListener('input', (e) => {
    const amount = parseFloat(e.target.value) || 0;
    const fee = 100;
    const total = amount + fee;
    
    const summaryDiv = document.getElementById('transfer-summary');
    
    if (amount > 0) {
        document.getElementById('summary-amount').textContent = `${amount.toLocaleString()} Ks`;
        document.getElementById('summary-total').textContent = `${total.toLocaleString()} Ks`;
        summaryDiv.style.display = 'block';
    } else {
        summaryDiv.style.display = 'none';
    }
});

// Enhanced Google login simulation
function simulateGoogleLogin(type) {
    const mockUsers = [
        { email: 'aung.myat@gmail.com', phone: '09123456789' },
        { email: 'thida.win@gmail.com', phone: '09987654321' },
        { email: 'kyaw.min@gmail.com', phone: '09456789123' }
    ];
    
    const randomUser = mockUsers[Math.floor(Math.random() * mockUsers.length)];
    
    if (type === 'login') {
        // Simulate existing user login
        document.getElementById('login-email').value = randomUser.email;
        document.getElementById('login-password').value = 'password123';
        
        setTimeout(() => {
            document.getElementById('login-btn').click();
        }, 1000);
    } else {
        // Simulate new user signup
        const uniqueEmail = `${generateUserId(randomUser.email)}@gmail.com`;
        const uniquePhone = `091${Math.floor(Math.random() * 90000000) + 10000000}`;
        
        document.getElementById('signup-email').value = uniqueEmail;
        document.getElementById('signup-phone').value = uniquePhone;
        document.getElementById('signup-password').value = 'password123';
        document.getElementById('signup-confirm-password').value = 'password123';
        document.getElementById('terms-agree').checked = true;
        
        setTimeout(() => {
            document.getElementById('signup-btn')
                .addEventListener('click', async () => {
                    // Create account with Google info
                    try {
                        const { data: newUser, error } = await supabase
                            .from('auth_users')
                            .insert([{
                                email: uniqueEmail,
                                phone: uniquePhone,
                                password: 'password123',
                                balance: 15000,
                                kyc_status: 'pending',
                                created_at: new Date().toISOString()
                            }])
                            .select()
                            .single();
                            
                        if (!error) {
                            const successElement = document.getElementById('signup-success');
                            successElement.textContent = 'Google ဖြင့် အကောင့်ဖွင့်ခြင်း အောင်မြင်ပါသည်!';
                            successElement.style.display = 'block';
                            
                            setTimeout(() => {
                                // Auto switch to login
                                document.querySelector('.auth-tab[data-tab="login"]').click();
                                document.getElementById('login-email').value = uniqueEmail;
                                setTimeout(() => {
                                    document.querySelector('.auth-tab[data-tab="login"]').click();
                                }, 2000);
                            });
                    });
            });
    }
}

// Real-time verification functionality
function setupRealtimeVerification() {
    const transferPhoneInput = document.getElementById('transfer-phone');
    const verificationIndicator = document.getElementById('phone-verification');
    const recipientInfo = document.getElementById('recipient-info');
    
    if (!transferPhoneInput) return;
    
    let verificationTimeout;
    
    transferPhoneInput.addEventListener('input', (e) => {
        const phone = e.target.value.trim();
        
        // Clear previous timeout
        clearTimeout(verificationTimeout);
        
        // Hide previous results
        recipientInfo.style.display = 'none';
        recipientInfo.classList.remove('show');
        
        // Reset verification indicator
        verificationIndicator.classList.remove('active', 'success', 'error');
        
        // Check if phone number is valid format
        if (phone.length >= 9 && phone.startsWith('09')) {
            // Show loading indicator
            verificationIndicator.classList.add('active');
            verificationIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            
            // Debounce verification check
            verificationTimeout = setTimeout(() => {
                verifyPhoneNumber(phone);
            }, 800);
        }
    });
}

async function verifyPhoneNumber(phone) {
    const verificationIndicator = document.getElementById('phone-verification');
    const recipientInfo = document.getElementById('recipient-info');
    const verificationCard = recipientInfo.querySelector('.verification-card');
    const verificationIcon = recipientInfo.querySelector('.verification-icon');
    const recipientName = document.getElementById('recipient-name');
    const recipientId = document.getElementById('recipient-id');
    const recipientKyc = document.getElementById('recipient-kyc');
    
    try {
        // Check if account exists
        const { data: recipient, error } = await supabase
            .from('auth_users')
            .select('*')
            .eq('phone', phone)
            .single();
            
        if (error || !recipient) {
            // Account not found
            verificationIndicator.classList.remove('success');
            verificationIndicator.classList.add('error');
            verificationIndicator.innerHTML = '<i class="fas fa-times-circle"></i>';
            
            // Show error state
            verificationCard.classList.add('error');
            verificationIcon.innerHTML = '<i class="fas fa-user-times"></i>';
            recipientName.textContent = 'အကောင့်မတွေ့ရှိပါ';
            recipientId.textContent = 'ဖုန်းနံပါတ်ကို စစ်ဆေးပါ';
            recipientKyc.innerHTML = '<span class="level-indicator">မရှိ</span><i class="fas fa-exclamation-triangle"></i>';
            
            recipientInfo.style.display = 'block';
            setTimeout(() => {
                recipientInfo.classList.add('show');
            }, 10);
            
        } else {
            // Account found
            verificationIndicator.classList.remove('error');
            verificationIndicator.classList.add('success');
            verificationIndicator.innerHTML = '<i class="fas fa-check-circle"></i>';
            
            // Show success state
            verificationCard.classList.remove('error');
            verificationIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
            recipientName.textContent = recipient.email || 'အကောင့်ရှိသည်';
            recipientId.textContent = `ID: ${recipient.id}`;
            
            // Set KYC level
            const kycLevel = recipient.kyc_status === 'approved' ? 2 : 1;
            const kycClass = kycLevel === 2 ? 'level-2' : 'level-1';
            const kycIcon = kycLevel === 2 ? 'fa-shield-alt' : 'fa-clock';
            
            recipientKyc.className = `kyc-level-badge ${kycClass}`;
            recipientKyc.innerHTML = `<span class="level-indicator">Level ${kycLevel}</span><i class="fas ${kycIcon}"></i>`;
            
            recipientInfo.style.display = 'block';
            setTimeout(() => {
                recipientInfo.classList.add('show');
            }, 10);
        }
        
    } catch (error) {
        console.error('Phone verification error:', error);
        verificationIndicator.classList.remove('success');
        verificationIndicator.classList.add('error');
        verificationIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
    }
}
