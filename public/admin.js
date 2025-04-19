// KPAY+ အက်ဒမင်စီမံခန့်ခွဲမှုစနစ် JavaScript

// Supabase အဆက်အသွယ်
const SUPABASE_URL = 'https://vtsczzlnhsrgnbkfyizi.supabase.co'; // သင့် Supabase URL ကိုထည့်ပါ
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjY4NjA4MywiZXhwIjoyMDU4MjYyMDgzfQ._Jl-xGTucb9JVIENi33RqKv6SD8FyWqcwABqvU0xtzc';
let supabaseClient = null;
let currentUser = null;
let currentToken = null;
let isAdmin = false;

// စာမျက်နှာ စတင်သည့်အခါ
document.addEventListener('DOMContentLoaded', function() {
    initializeAdminPage();
});

// Admin page စတင်ရန်
function initializeAdminPage() {
    try {
        initializeSupabase();
        
        // သိမ်းဆည်းထားသော admin session စစ်ဆေးပါ
        checkAdminLoggedInStatus();
        
        // Admin event listeners တပ်ဆင်ပါ
        setupAdminEventListeners();
    } catch (error) {
        console.error('Supabase ချိတ်ဆက်ရာတွင် အမှားရှိသည်:', error);
        showAlert('ဆာဗာချိတ်ဆက်ရာတွင် အမှားရှိသည်။ နောက်မှ ထပ်မံကြိုးစားပါ။', 'error');
    }
}

// Supabase ချိတ်ဆက်မှု စတင်ရန်
function initializeSupabase() {
    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('Supabase ချိတ်ဆက်မှု အောင်မြင်ပါသည်');
    } catch (error) {
        console.error('Supabase ချိတ်ဆက်ရာတွင် အမှားရှိသည်:', error);
        throw error;
    }
}

// Admin page event listeners တပ်ဆင်ရန်
function setupAdminEventListeners() {
    // အက်ဒမင်အကောင့်ဝင်ရန်
    document.getElementById('adminLoginButton')?.addEventListener('click', handleAdminLogin);
    
    // အက်ဒမင်အကောင့်ထွက်ရန်
    document.getElementById('adminLogoutButton')?.addEventListener('click', logoutAdminUser);
    
    // Tab ခလုပ်များအတွက်
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // Active class သတ်မှတ်ပါ
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Tab content ပြပါ
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabName}-tab`).classList.add('active');
            
            // အကယ်၍ ဒေတာလိုအပ်ပါက ပြန်လည်ရယူပါ
            if (tabName === 'users') {
                loadUsers();
            } else if (tabName === 'transactions') {
                loadTransactions();
            } else if (tabName === 'verifications') {
                loadVerifications();
            } else if (tabName === 'overview') {
                loadDashboardStats();
            }
        });
    });
    
    // ရှာဖွေရန်ခလုပ်များ
    document.getElementById('userSearchButton')?.addEventListener('click', function() {
        const searchTerm = document.getElementById('userSearchInput').value;
        searchUsers(searchTerm);
    });
    
    document.getElementById('transactionSearchButton')?.addEventListener('click', function() {
        const searchTerm = document.getElementById('transactionSearchInput').value;
        searchTransactions(searchTerm);
    });
    
    // Filter ခလုပ်များ
    const filterButtons = document.querySelectorAll('.filter-buttons .filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const filterType = this.getAttribute('data-filter');
            const parentCategory = this.parentElement.parentElement.id;
            
            // Active class သတ်မှတ်ပါ
            this.parentElement.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
            
            // Filter လုပ်ဆောင်ချက်
            if (parentCategory === 'transactions-tab') {
                filterTransactions(filterType);
            } else if (parentCategory === 'verifications-tab') {
                filterVerifications(filterType);
            }
        });
    });
}

// Admin အကောင့်ဝင်ထားမှု အခြေအနေစစ်ဆေးရန်
async function checkAdminLoggedInStatus() {
    const savedToken = localStorage.getItem('kpay_admin_token');
    const savedEmail = localStorage.getItem('kpay_admin_email');
    
    if (savedToken && savedEmail) {
        try {
            // Session ကို server ဘက်တွင် စစ်ဆေးမည်
            await validateAdminSession(savedToken, savedEmail);
        } catch (error) {
            console.error('Admin session စစ်ဆေးရာတွင် အမှားရှိသည်:', error);
            localStorage.removeItem('kpay_admin_token');
            localStorage.removeItem('kpay_admin_email');
            showAdminLoginScreen();
        }
    } else {
        showAdminLoginScreen();
    }
}

// Admin session ကို server ဘက်တွင် စစ်ဆေးမည်
async function validateAdminSession(token, email) {
    try {
        // အသုံးပြုသူအချက်အလက်ရယူပါ
        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        
        if (userError || !userData) {
            throw new Error('အက်ဒမင်အသုံးပြုသူ မတွေ့ရှိပါ');
        }
        
        // Admin ဟုတ်မဟုတ်စစ်ဆေးပါ
        if (!userData.is_admin) {
            throw new Error('အက်ဒမင်ခွင့်ပြုချက်မရှိပါ');
        }
        
        // Session စစ်ဆေးပါ
        const { data, error } = await supabaseClient
            .from('login_sessions')
            .select('*')
            .eq('session_token', token)
            .eq('is_active', true)
            .eq('user_id', userData.user_id)
            .single();
        
        if (error || !data) {
            throw new Error('Session မတည်ရှိတော့ပါ သို့မဟုတ် သက်တမ်းကုန်ဆုံးသွားပါပြီ');
        }
        
        // Session တည်ရှိသေးပါက အသုံးပြုသူအချက်အလက်သိမ်းဆည်းမည်
        currentUser = userData;
        currentToken = token;
        isAdmin = true;
        
        // UI ပြင်ဆင်ပါ
        hideAdminLoginScreen();
        updateAdminUIWithUserData();
        
        // Dashboard stats ရယူပါ
        loadDashboardStats();
    } catch (error) {
        console.error('Admin session စစ်ဆေးရာတွင် အမှားရှိသည်:', error);
        localStorage.removeItem('kpay_admin_token');
        localStorage.removeItem('kpay_admin_email');
        showAdminLoginScreen();
        throw error;
    }
}

// အက်ဒမင်အကောင့်ဝင်ရောက်ရန်
async function handleAdminLogin() {
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    
    if (!email || !password) {
        showAlert('ကျေးဇူးပြု၍ အချက်အလက်အားလုံးဖြည့်စွက်ပါ', 'error');
        return;
    }
    
    try {
        // Supabase မှ အသုံးပြုသူရှာဖွေပါ
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        
        if (error || !data) {
            console.error('အသုံးပြုသူရှာဖွေရာတွင် အမှားရှိသည်:', error);
            showAlert('အီးမေးလ် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်', 'error');
            return;
        }
        
        // ဤသည်မှာ admin ဟုတ်မဟုတ်စစ်ဆေးပါ
        if (!data.is_admin) {
            showAlert('ဤအကောင့်သည် အက်ဒမင်ဖြစ်မထားပါ', 'error');
            return;
        }
        
        // စကားဝှက်စစ်ဆေးပါ
        if (data.password_hash !== password) { // လက်တွေ့တွင် hash ကို ပြန်မတိုက်ဆိုင်သင့်ပါ
            showAlert('အီးမေးလ် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်', 'error');
            return;
        }
        
        // Session ဖန်တီးပါ
        const sessionToken = generateSessionToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 ရက်
        
        const { data: sessionData, error: sessionError } = await supabaseClient.from('login_sessions').insert([
            {
                user_id: data.user_id,
                session_token: sessionToken,
                device_info: navigator.userAgent,
                ip_address: "admin_client_ip", // Server ဘက်တွင် IP ရယူသင့်သည်
                is_active: true,
                created_at: new Date().toISOString(),
                expires_at: expiresAt.toISOString(),
                last_active: new Date().toISOString()
            }
        ]);
        
        if (sessionError) {
            console.error('Session ဖန်တီးရာတွင် အမှားရှိသည်:', sessionError);
            showAlert('အကောင့်ဝင်ရာတွင် အခက်အခဲရှိသည်', 'error');
            return;
        }
        
        // နောက်ဆုံးဝင်ရောက်ချိန် update လုပ်ပါ
        const { data: updateData, error: updateError } = await supabaseClient
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('user_id', data.user_id);
        
        if (updateError) {
            console.error('နောက်ဆုံးဝင်ရောက်ချိန် update လုပ်ရာတွင် အမှားရှိသည်:', updateError);
        }
        
        // အသုံးပြုသူလုပ်ဆောင်မှုမှတ်တမ်းတင်ပါ
        const { data: activityData, error: activityError } = await supabaseClient.from('activity_logs').insert([
            {
                user_id: data.user_id,
                action: 'admin_login',
                details: JSON.stringify({ email: data.email }),
                ip_address: "admin_client_ip", // Server ဘက်တွင် IP ရယူသင့်သည်
                timestamp: new Date().toISOString()
            }
        ]);
        
        if (activityError) {
            console.error('လုပ်ဆောင်မှုမှတ်တမ်းတင်ရာတွင် အမှားရှိသည်:', activityError);
        }
        
        // လောကယ်စတိုးရိချ်တွင် admin token သိမ်းဆည်းပါ
        localStorage.setItem('kpay_admin_token', sessionToken);
        localStorage.setItem('kpay_admin_email', email);
        
        currentUser = data;
        currentToken = sessionToken;
        isAdmin = true;
        
        // UI ပြင်ဆင်ပါ
        hideAdminLoginScreen();
        updateAdminUIWithUserData();
        
        // Dashboard data ရယူပါ
        loadDashboardStats();
    } catch (error) {
        console.error('အကောင့်ဝင်ရာတွင် အမှားရှိသည်:', error);
        showAlert('အကောင့်ဝင်ရာတွင် အမှားရှိပါသည်။ ကျေးဇူးပြု၍ နောက်မှ ထပ်မံကြိုးစားပါ။', 'error');
    }
}

// Admin အကောင့်မှထွက်ရန်
async function logoutAdminUser() {
    try {
        if (!currentUser || !currentToken) {
            return;
        }
        
        // Session deactivate လုပ်ပါ
        const { data, error } = await supabaseClient
            .from('login_sessions')
            .update({ 
                is_active: false,
                last_active: new Date().toISOString()
            })
            .eq('session_token', currentToken);
        
        if (error) {
            console.error('Session deactivate လုပ်ရာတွင် အမှားရှိသည်:', error);
        }
        
        // အသုံးပြုသူလုပ်ဆောင်မှုမှတ်တမ်းတင်ပါ
        const { data: activityData, error: activityError } = await supabaseClient.from('activity_logs').insert([
            {
                user_id: currentUser.user_id,
                action: 'admin_logout',
                details: JSON.stringify({}),
                ip_address: "admin_client_ip", // Server ဘက်တွင် IP ရယူသင့်သည်
                timestamp: new Date().toISOString()
            }
        ]);
        
        if (activityError) {
            console.error('လုပ်ဆောင်မှုမှတ်တမ်းတင်ရာတွင် အမှားရှိသည်:', activityError);
        }
        
        // လောကယ်စတိုးရိချ်မှ token ဖျက်ပါ
        localStorage.removeItem('kpay_admin_token');
        localStorage.removeItem('kpay_admin_email');
        
        currentUser = null;
        currentToken = null;
        isAdmin = false;
        
        // UI ပြင်ဆင်ပါ
        showAdminLoginScreen();
    } catch (error) {
        console.error('အကောင့်မှထွက်ရာတွင် အမှားရှိသည်:', error);
        showAlert('အကောင့်မှထွက်ရာတွင် အမှားရှိပါသည်။ ကျေးဇူးပြု၍ နောက်မှ ထပ်မံကြိုးစားပါ။', 'error');
    }
}

// Admin အကောင့်ဝင်ရန် စခရင်ပြပါ
function showAdminLoginScreen() {
    document.getElementById('adminAuthScreen').classList.remove('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
}

// Admin အကောင့်ဝင်ရန် စခရင်ဖျောက်ပါ
function hideAdminLoginScreen() {
    document.getElementById('adminAuthScreen').classList.add('hidden');
    document.getElementById('adminDashboard').classList.remove('hidden');
}

// Admin အသုံးပြုသူအချက်အလက်ဖြင့် UI ပြင်ဆင်ပါ
function updateAdminUIWithUserData() {
    if (!currentUser) return;
    
    // Admin header ပြင်ဆင်ပါ
    document.getElementById('adminName').textContent = currentUser.username || currentUser.email.split('@')[0];
}

// ငွေပမာဏ format ပြောင်းပါ
function formatCurrency(amount) {
    if (!amount) return '0.00';
    return parseFloat(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// ရက်စွဲ format ပြောင်းပါ
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('my-MM', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// သတိပေးချက် ပြပါ
function showAlert(message, type = 'success') {
    // Modal သို့မဟုတ် အခြားနည်းလမ်းဖြင့် သတိပေးချက်ပြပါ
    alert(message);
}

// Modal ပိတ်ရန်
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// UserID ဖန်တီးပါ
function generateUserId() {
    return 'USR' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
}

// Session token ဖန်တီးပါ
function generateSessionToken() {
    return 'SESSION' + Date.now().toString() + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
}

// စတား ဆင်းချက်ဖြင့် စတိတပ်စ်စာသား format ပြောင်းပါ
function getStatusText(status) {
    switch (status) {
        case 'pending':
            return 'ဆောင်ရွက်ဆဲ';
        case 'success':
            return 'အောင်မြင်';
        case 'failed':
            return 'မအောင်မြင်';
        case 'approved':
            return 'အတည်ပြုပြီး';
        case 'rejected': 
            return 'ငြင်းပယ်ထား';
        default:
            return status;
    }
}

// Admin dashboard data ရယူရန်
async function loadDashboardStats() {
    if (!isAdmin) return;
    
    try {
        // အသုံးပြုသူစုစုပေါင်း
        const { data: usersData, error: usersError } = await supabaseClient
            .from('users')
            .select('count')
            .not('is_admin', 'eq', true);
            
        if (usersError) {
            console.error('အသုံးပြုသူအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', usersError);
        } else {
            document.getElementById('totalUsers').textContent = usersData[0]?.count || 0;
        }
        
        // ငွေလွှဲမှုစုစုပေါင်း
        const { data: transactionsData, error: transactionsError } = await supabaseClient
            .from('transactions')
            .select('count');
            
        if (transactionsError) {
            console.error('ငွေလွှဲမှုအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', transactionsError);
        } else {
            document.getElementById('totalTransactions').textContent = transactionsData[0]?.count || 0;
        }
        
        // အတည်ပြုရန်စောင့်ဆိုင်းမှုများ
        const { data: pendingVerificationsData, error: pendingVerificationsError } = await supabaseClient
            .from('verification_requests')
            .select('count')
            .eq('status', 'pending');
            
        if (pendingVerificationsError) {
            console.error('အတည်ပြုမှုအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', pendingVerificationsError);
        } else {
            document.getElementById('pendingVerifications').textContent = pendingVerificationsData[0]?.count || 0;
        }
        
        // ယနေ့သုံးစွဲသူများ
        const today = new Date().toISOString().split('T')[0];
        const { data: activeTodayData, error: activeTodayError } = await supabaseClient
            .from('activity_logs')
            .select('user_id')
            .like('timestamp', `${today}%`)
            .not('user_id', 'eq', 'SYSTEM');
            
        if (activeTodayError) {
            console.error('ယနေ့သုံးစွဲသူအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', activeTodayError);
        } else {
            // ထူးခြားသော အသုံးပြုသူများအရေအတွက်ရယူပါ
            const uniqueUsers = new Set();
            activeTodayData.forEach(log => uniqueUsers.add(log.user_id));
            document.getElementById('activeToday').textContent = uniqueUsers.size;
        }
        
        // လတ်တလောငွေလွှဲမှုများ
        const { data: recentTransactionsData, error: recentTransactionsError } = await supabaseClient
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);
            
        if (recentTransactionsError) {
            console.error('လတ်တလောငွေလွှဲမှုအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', recentTransactionsError);
        } else {
            const recentTransactionsTable = document.getElementById('recentTransactions');
            if (recentTransactionsTable) {
                recentTransactionsTable.innerHTML = '';
                
                if (recentTransactionsData.length === 0) {
                    const row = document.createElement('tr');
                    row.innerHTML = `<td colspan="5" class="empty-state">ငွေလွှဲမှုမှတ်တမ်းမရှိသေးပါ</td>`;
                    recentTransactionsTable.appendChild(row);
                } else {
                    recentTransactionsData.forEach(transaction => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${formatDate(transaction.created_at)}</td>
                            <td>${transaction.sender_id}</td>
                            <td>${transaction.receiver_id}</td>
                            <td>${formatCurrency(transaction.amount)} MMK</td>
                            <td><span class="status-badge status-${transaction.status}">${getStatusText(transaction.status)}</span></td>
                        `;
                        recentTransactionsTable.appendChild(row);
                    });
                }
            }
        }
    } catch (error) {
        console.error('Dashboard အချက်အလက်ရယူရာတွင် အမှားရှိသည်:', error);
    }
}

// Admin အသုံးပြုသူအချက်အလက်ရယူရန်
async function loadUsers() {
    if (!isAdmin) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) {
            console.error('အသုံးပြုသူအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', error);
            return;
        }
        
        const usersList = document.getElementById('usersList');
        if (usersList) {
            usersList.innerHTML = '';
            
            if (data.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="7" class="empty-state">အသုံးပြုသူမှတ်တမ်းမရှိသေးပါ</td>`;
                usersList.appendChild(row);
            } else {
                data.forEach(user => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${user.user_id}</td>
                        <td>${user.email}</td>
                        <td>${user.phone || '-'}</td>
                        <td>${formatCurrency(user.balance)} MMK</td>
                        <td><span class="status-badge status-${user.passport_status === 'verified' ? 'success' : user.passport_status === 'pending' ? 'pending' : 'failed'}">${user.passport_status === 'verified' ? 'အတည်ပြုပြီး' : user.passport_status === 'pending' ? 'ဆောင်ရွက်ဆဲ' : 'အတည်မပြုရသေး'}</span></td>
                        <td>${user.last_login ? formatDate(user.last_login) : '-'}</td>
                        <td class="action-buttons">
                            <button class="view-btn" onclick="viewUserDetails('${user.user_id}')">ကြည့်ရန်</button>
                        </td>
                    `;
                    usersList.appendChild(row);
                });
            }
        }
    } catch (error) {
        console.error('အသုံးပြုသူအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', error);
    }
}

// Admin ငွေလွှဲမှုအချက်အလက်ရယူရန်
async function loadTransactions() {
    if (!isAdmin) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) {
            console.error('ငွေလွှဲမှုအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', error);
            return;
        }
        
        const transactionsList = document.getElementById('transactionsList');
        if (transactionsList) {
            transactionsList.innerHTML = '';
            
            if (data.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="7" class="empty-state">ငွေလွှဲမှုမှတ်တမ်းမရှိသေးပါ</td>`;
                transactionsList.appendChild(row);
            } else {
                data.forEach(transaction => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${transaction.transaction_id}</td>
                        <td>${formatDate(transaction.created_at)}</td>
                        <td>${transaction.sender_id}</td>
                        <td>${transaction.receiver_id}</td>
                        <td>${formatCurrency(transaction.amount)} MMK</td>
                        <td><span class="status-badge status-${transaction.status}">${getStatusText(transaction.status)}</span></td>
                        <td class="action-buttons">
                            <button class="view-btn" onclick="viewTransactionDetails('${transaction.transaction_id}')">ကြည့်ရန်</button>
                        </td>
                    `;
                    transactionsList.appendChild(row);
                });
            }
        }
    } catch (error) {
        console.error('ငွေလွှဲမှုအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', error);
    }
}

// Admin အတည်ပြုမှုအချက်အလက်ရယူရန်
async function loadVerifications() {
    if (!isAdmin) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('verification_requests')
            .select('*')
            .order('submitted_at', { ascending: false });
            
        if (error) {
            console.error('အတည်ပြုမှုအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', error);
            return;
        }
        
        const verificationsList = document.getElementById('verificationsList');
        if (verificationsList) {
            verificationsList.innerHTML = '';
            
            if (data.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="5" class="empty-state">အတည်ပြုမှုတောင်းဆိုချက်မရှိသေးပါ</td>`;
                verificationsList.appendChild(row);
            } else {
                data.forEach(verification => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${verification.user_id}</td>
                        <td>${verification.user_id}</td>
                        <td>${formatDate(verification.submitted_at)}</td>
                        <td><span class="status-badge status-${verification.status === 'approved' ? 'success' : verification.status === 'pending' ? 'pending' : 'failed'}">${getStatusText(verification.status)}</span></td>
                        <td class="action-buttons">
                            <button class="view-btn" onclick="viewVerificationDetails('${verification.user_id}')">ကြည့်ရန်</button>
                            ${verification.status === 'pending' ? `
                                <button class="approve-btn" onclick="approveVerification('${verification.user_id}')">အတည်ပြုရန်</button>
                                <button class="reject-btn" onclick="rejectVerification('${verification.user_id}')">ငြင်းပယ်ရန်</button>
                            ` : ''}
                        </td>
                    `;
                    verificationsList.appendChild(row);
                });
            }
        }
    } catch (error) {
        console.error('အတည်ပြုမှုအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', error);
    }
}

// အသုံးပြုသူများရှာဖွေရန်
async function searchUsers(searchTerm) {
    if (!isAdmin || !searchTerm) return;
    
    try {
        // ဖုန်းနံပါတ် သို့မဟုတ် အီးမေးလ်ဖြင့် ရှာဖွေပါ
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .or(`email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,user_id.ilike.%${searchTerm}%`);
            
        if (error) {
            console.error('အသုံးပြုသူရှာဖွေရာတွင် အမှားရှိသည်:', error);
            return;
        }
        
        const usersList = document.getElementById('usersList');
        if (usersList) {
            usersList.innerHTML = '';
            
            if (data.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="7" class="empty-state">ရှာဖွေမှုနှင့်ကိုက်ညီသော အသုံးပြုသူမရှိပါ</td>`;
                usersList.appendChild(row);
            } else {
                data.forEach(user => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${user.user_id}</td>
                        <td>${user.email}</td>
                        <td>${user.phone || '-'}</td>
                        <td>${formatCurrency(user.balance)} MMK</td>
                        <td><span class="status-badge status-${user.passport_status === 'verified' ? 'success' : user.passport_status === 'pending' ? 'pending' : 'failed'}">${user.passport_status === 'verified' ? 'အတည်ပြုပြီး' : user.passport_status === 'pending' ? 'ဆောင်ရွက်ဆဲ' : 'အတည်မပြုရသေး'}</span></td>
                        <td>${user.last_login ? formatDate(user.last_login) : '-'}</td>
                        <td class="action-buttons">
                            <button class="view-btn" onclick="viewUserDetails('${user.user_id}')">ကြည့်ရန်</button>
                        </td>
                    `;
                    usersList.appendChild(row);
                });
            }
        }
    } catch (error) {
        console.error('အသုံးပြုသူရှာဖွေရာတွင် အမှားရှိသည်:', error);
    }
}

// ငွေလွှဲမှုများရှာဖွေရန်
async function searchTransactions(searchTerm) {
    if (!isAdmin || !searchTerm) return;
    
    try {
        // ငွေလွှဲမှု ID သို့မဟုတ် အသုံးပြုသူ ID ဖြင့် ရှာဖွေပါ
        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .or(`transaction_id.ilike.%${searchTerm}%,sender_id.ilike.%${searchTerm}%,receiver_id.ilike.%${searchTerm}%`);
            
        if (error) {
            console.error('ငွေလွှဲမှုရှာဖွေရာတွင် အမှားရှိသည်:', error);
            return;
        }
        
        const transactionsList = document.getElementById('transactionsList');
        if (transactionsList) {
            transactionsList.innerHTML = '';
            
            if (data.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="7" class="empty-state">ရှာဖွေမှုနှင့်ကိုက်ညီသော ငွေလွှဲမှုမရှိပါ</td>`;
                transactionsList.appendChild(row);
            } else {
                data.forEach(transaction => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${transaction.transaction_id}</td>
                        <td>${formatDate(transaction.created_at)}</td>
                        <td>${transaction.sender_id}</td>
                        <td>${transaction.receiver_id}</td>
                        <td>${formatCurrency(transaction.amount)} MMK</td>
                        <td><span class="status-badge status-${transaction.status}">${getStatusText(transaction.status)}</span></td>
                        <td class="action-buttons">
                            <button class="view-btn" onclick="viewTransactionDetails('${transaction.transaction_id}')">ကြည့်ရန်</button>
                        </td>
                    `;
                    transactionsList.appendChild(row);
                });
            }
        }
    } catch (error) {
        console.error('ငွေလွှဲမှုရှာဖွေရာတွင် အမှားရှိသည်:', error);
    }
}

// ငွေလွှဲမှုများစစ်ထုတ်ရန်
function filterTransactions(status) {
    if (!isAdmin) return;
    
    try {
        loadTransactionsWithFilter(status);
    } catch (error) {
        console.error('ငွေလွှဲမှုစစ်ထုတ်ရာတွင် အမှားရှိသည်:', error);
    }
}

// ငွေလွှဲမှုများစစ်ထုတ်ပြီး ရယူရန်
async function loadTransactionsWithFilter(status) {
    try {
        let query = supabaseClient
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (status !== 'all') {
            query = query.eq('status', status);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('ငွေလွှဲမှုအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', error);
            return;
        }
        
        const transactionsList = document.getElementById('transactionsList');
        if (transactionsList) {
            transactionsList.innerHTML = '';
            
            if (data.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="7" class="empty-state">ကိုက်ညီသော ငွေလွှဲမှုမရှိပါ</td>`;
                transactionsList.appendChild(row);
            } else {
                data.forEach(transaction => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${transaction.transaction_id}</td>
                        <td>${formatDate(transaction.created_at)}</td>
                        <td>${transaction.sender_id}</td>
                        <td>${transaction.receiver_id}</td>
                        <td>${formatCurrency(transaction.amount)} MMK</td>
                        <td><span class="status-badge status-${transaction.status}">${getStatusText(transaction.status)}</span></td>
                        <td class="action-buttons">
                            <button class="view-btn" onclick="viewTransactionDetails('${transaction.transaction_id}')">ကြည့်ရန်</button>
                        </td>
                    `;
                    transactionsList.appendChild(row);
                });
            }
        }
    } catch (error) {
        console.error('ငွေလွှဲမှုစစ်ထုတ်ရာတွင် အမှားရှိသည်:', error);
    }
}

// အတည်ပြုမှုများစစ်ထုတ်ရန်
function filterVerifications(status) {
    if (!isAdmin) return;
    
    try {
        loadVerificationsWithFilter(status);
    } catch (error) {
        console.error('အတည်ပြုမှုစစ်ထုတ်ရာတွင် အမှားရှိသည်:', error);
    }
}

// အတည်ပြုမှုများစစ်ထုတ်ပြီး ရယူရန်
async function loadVerificationsWithFilter(status) {
    try {
        let query = supabaseClient
            .from('verification_requests')
            .select('*')
            .order('submitted_at', { ascending: false });
            
        if (status !== 'all') {
            query = query.eq('status', status);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('အတည်ပြုမှုအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', error);
            return;
        }
        
        const verificationsList = document.getElementById('verificationsList');
        if (verificationsList) {
            verificationsList.innerHTML = '';
            
            if (data.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="5" class="empty-state">ကိုက်ညီသော အတည်ပြုမှုတောင်းဆိုချက်မရှိပါ</td>`;
                verificationsList.appendChild(row);
            } else {
                data.forEach(verification => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${verification.user_id}</td>
                        <td>${verification.user_id}</td>
                        <td>${formatDate(verification.submitted_at)}</td>
                        <td><span class="status-badge status-${verification.status === 'approved' ? 'success' : verification.status === 'pending' ? 'pending' : 'failed'}">${getStatusText(verification.status)}</span></td>
                        <td class="action-buttons">
                            <button class="view-btn" onclick="viewVerificationDetails('${verification.user_id}')">ကြည့်ရန်</button>
                            ${verification.status === 'pending' ? `
                                <button class="approve-btn" onclick="approveVerification('${verification.user_id}')">အတည်ပြုရန်</button>
                                <button class="reject-btn" onclick="rejectVerification('${verification.user_id}')">ငြင်းပယ်ရန်</button>
                            ` : ''}
                        </td>
                    `;
                    verificationsList.appendChild(row);
                });
            }
        }
    } catch (error) {
        console.error('အတည်ပြုမှုစစ်ထုတ်ရာတွင် အမှားရှိသည်:', error);
    }
}

// အသုံးပြုသူအသေးစိတ်ကြည့်ရန်
async function viewUserDetails(userId) {
    if (!isAdmin) return;
    
    try {
        // အသုံးပြုသူအချက်အလက်ရယူပါ
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('user_id', userId)
            .single();
            
        if (error) {
            console.error('အသုံးပြုသူအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', error);
            showAlert('အသုံးပြုသူအချက်အလက်ရယူရာတွင် အမှားရှိပါသည်', 'error');
            return;
        }
        
        // Modal တွင်အချက်အလက်များဖော်ပြပါ
        const userDetailsContent = document.getElementById('userDetailsContent');
        if (userDetailsContent) {
            userDetailsContent.innerHTML = `
                <div class="detail-item">
                    <label>အသုံးပြုသူ ID</label>
                    <div class="value">${data.user_id}</div>
                </div>
                <div class="detail-item">
                    <label>အီးမေးလ်</label>
                    <div class="value">${data.email}</div>
                </div>
                <div class="detail-item">
                    <label>ဖုန်းနံပါတ်</label>
                    <div class="value">${data.phone || '-'}</div>
                </div>
                <div class="detail-item">
                    <label>လက်ကျန်ငွေ</label>
                    <div class="value">${formatCurrency(data.balance)} MMK</div>
                </div>
                <div class="detail-item">
                    <label>အိုင်ဒီအခြေအနေ</label>
                    <div class="value">${data.passport_status === 'verified' ? 'အတည်ပြုပြီး' : data.passport_status === 'pending' ? 'ဆောင်ရွက်ဆဲ' : 'အတည်မပြုရသေး'}</div>
                </div>
                <div class="detail-item">
                    <label>နောက်ဆုံးဝင်ရောက်ချိန်</label>
                    <div class="value">${data.last_login ? formatDate(data.last_login) : '-'}</div>
                </div>
                <div class="detail-item">
                    <label>အကောင့်ဖွင့်ချိန်</label>
                    <div class="value">${formatDate(data.created_at)}</div>
                </div>
            `;
            
            // Modal ဖွင့်ပြပါ
            document.getElementById('userDetailModal').style.display = 'block';
        }
    } catch (error) {
        console.error('အသုံးပြုသူအချက်အလက်ကြည့်ရှုရာတွင် အမှားရှိသည်:', error);
        showAlert('အသုံးပြုသူအချက်အလက်ကြည့်ရှုရာတွင် အမှားရှိပါသည်', 'error');
    }
}

// ငွေလွှဲမှုအသေးစိတ်ကြည့်ရန်
async function viewTransactionDetails(transactionId) {
    if (!isAdmin) return;
    
    try {
        // ငွေလွှဲမှုအချက်အလက်ရယူပါ
        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .eq('transaction_id', transactionId)
            .single();
            
        if (error) {
            console.error('ငွေလွှဲမှုအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', error);
            showAlert('ငွေလွှဲမှုအချက်အလက်ရယူရာတွင် အမှားရှိပါသည်', 'error');
            return;
        }
        
        // Modal တွင်အချက်အလက်များဖော်ပြပါ
        const transactionDetailsContent = document.getElementById('transactionDetailsContent');
        if (transactionDetailsContent) {
            transactionDetailsContent.innerHTML = `
                <div class="detail-item">
                    <label>ငွေလွှဲမှု ID</label>
                    <div class="value">${data.transaction_id}</div>
                </div>
                <div class="detail-item">
                    <label>ပို့သူ</label>
                    <div class="value">${data.sender_id}</div>
                </div>
                <div class="detail-item">
                    <label>လက်ခံသူ</label>
                    <div class="value">${data.receiver_id}</div>
                </div>
                <div class="detail-item">
                    <label>ငွေပမာဏ</label>
                    <div class="value">${formatCurrency(data.amount)} MMK</div>
                </div>
                <div class="detail-item">
                    <label>အခြေအနေ</label>
                    <div class="value status-${data.status}">${getStatusText(data.status)}</div>
                </div>
                <div class="detail-item">
                    <label>မှတ်ချက်</label>
                    <div class="value">${data.description || '-'}</div>
                </div>
                <div class="detail-item">
                    <label>ငွေလွှဲချိန်</label>
                    <div class="value">${formatDate(data.created_at)}</div>
                </div>
            `;
            
            // Modal ဖွင့်ပြပါ
            document.getElementById('transactionDetailModal').style.display = 'block';
        }
    } catch (error) {
        console.error('ငွေလွှဲမှုအချက်အလက်ကြည့်ရှုရာတွင် အမှားရှိသည်:', error);
        showAlert('ငွေလွှဲမှုအချက်အလက်ကြည့်ရှုရာတွင် အမှားရှိပါသည်', 'error');
    }
}

// အတည်ပြုမှုအသေးစိတ်ကြည့်ရန်
async function viewVerificationDetails(userId) {
    if (!isAdmin) return;
    
    try {
        // အတည်ပြုမှုအချက်အလက်ရယူပါ
        const { data, error } = await supabaseClient
            .from('verification_requests')
            .select('*')
            .eq('user_id', userId)
            .single();
            
        if (error) {
            console.error('အတည်ပြုမှုအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', error);
            showAlert('အတည်ပြုမှုအချက်အလက်ရယူရာတွင် အမှားရှိပါသည်', 'error');
            return;
        }
        
        // အသုံးပြုသူအချက်အလက်ရယူပါ
        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .select('*')
            .eq('user_id', userId)
            .single();
            
        if (userError) {
            console.error('အသုံးပြုသူအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', userError);
            showAlert('အသုံးပြုသူအချက်အလက်ရယူရာတွင် အမှားရှိပါသည်', 'error');
            return;
        }
        
        // Modal တွင်အချက်အလက်များဖော်ပြပါ
        const verificationDetailsContent = document.getElementById('verificationDetailsContent');
        if (verificationDetailsContent) {
            verificationDetailsContent.innerHTML = `
                <div class="detail-item">
                    <label>အသုံးပြုသူ ID</label>
                    <div class="value">${data.user_id}</div>
                </div>
                <div class="detail-item">
                    <label>အီးမေးလ်</label>
                    <div class="value">${userData.email}</div>
                </div>
                <div class="detail-item">
                    <label>ဖုန်းနံပါတ်</label>
                    <div class="value">${userData.phone || '-'}</div>
                </div>
                <div class="detail-item">
                    <label>အခြေအနေ</label>
                    <div class="value status-${data.status}">${getStatusText(data.status)}</div>
                </div>
                <div class="detail-item">
                    <label>တင်သွင်းချိန်</label>
                    <div class="value">${formatDate(data.submitted_at)}</div>
                </div>
                <div class="detail-item">
                    <label>စစ်ဆေးခဲ့ချိန်</label>
                    <div class="value">${data.reviewed_at ? formatDate(data.reviewed_at) : '-'}</div>
                </div>
            `;
            
            // ဓာတ်ပုံများ URL ရယူပါ
            const idDocUrl = supabaseClient.storage.from('verification_documents').getPublicUrl(data.id_document).data.publicUrl;
            const selfieUrl = supabaseClient.storage.from('verification_documents').getPublicUrl(data.selfie).data.publicUrl;
            
            // ဓာတ်ပုံများဖော်ပြပါ
            const verificationImages = document.getElementById('verificationImages');
            if (verificationImages) {
                verificationImages.innerHTML = `
                    <div class="verification-image">
                        <img src="${idDocUrl}" alt="အိုင်ဒီကတ်">
                    </div>
                    <div class="verification-image">
                        <img src="${selfieUrl}" alt="ကိုယ်တိုင်ဓာတ်ပုံ">
                    </div>
                `;
            }
            
            // အတည်ပြုရန်နှင့် ငြင်းပယ်ရန်ခလုပ်များကို pending ဖြစ်မှသာပြပါ
            const verificationModalFooter = document.getElementById('verificationModalFooter');
            if (verificationModalFooter) {
                verificationModalFooter.innerHTML = `
                    <button class="btn btn-outline" onclick="closeModal('verificationDetailModal')">ပိတ်မည်</button>
                    ${data.status === 'pending' ? `
                        <button class="btn btn-primary" onclick="approveVerification('${data.user_id}')">အတည်ပြုရန်</button>
                        <button class="btn btn-outline danger" onclick="rejectVerification('${data.user_id}')">ငြင်းပယ်ရန်</button>
                    ` : ''}
                `;
            }
            
            // Modal ဖွင့်ပြပါ
            document.getElementById('verificationDetailModal').style.display = 'block';
        }
    } catch (error) {
        console.error('အတည်ပြုမှုအချက်အလက်ကြည့်ရှုရာတွင် အမှားရှိသည်:', error);
        showAlert('အတည်ပြုမှုအချက်အလက်ကြည့်ရှုရာတွင် အမှားရှိပါသည်', 'error');
    }
}

// အတည်ပြုမှုကို အတည်ပြုရန်
async function approveVerification(userId) {
    if (!isAdmin) return;
    
    try {
        // အတည်ပြုမှုအခြေအနေကို update လုပ်ပါ
        const { data, error } = await supabaseClient
            .from('verification_requests')
            .update({
                status: 'approved',
                reviewed_at: new Date().toISOString(),
                reviewer_id: currentUser.user_id
            })
            .eq('user_id', userId);
            
        if (error) {
            console.error('အတည်ပြုမှုအခြေအနေ update လုပ်ရာတွင် အမှားရှိသည်:', error);
            showAlert('အတည်ပြုမှုအခြေအနေ update လုပ်ရာတွင် အမှားရှိပါသည်', 'error');
            return;
        }
        
        // အသုံးပြုသူ အိုင်ဒီအခြေအနေကို update လုပ်ပါ
        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .update({
                passport_status: 'verified'
            })
            .eq('user_id', userId);
            
        if (userError) {
            console.error('အသုံးပြုသူအခြေအနေ update လုပ်ရာတွင် အမှားရှိသည်:', userError);
            showAlert('အသုံးပြုသူအခြေအနေ update လုပ်ရာတွင် အမှားရှိပါသည်', 'error');
            return;
        }
        
        // Modal ပိတ်ပါ
        closeModal('verificationDetailModal');
        
        // အတည်ပြုမှုစာရင်းကို refresh လုပ်ပါ
        loadVerifications();
        
        showAlert('အတည်ပြုမှုအောင်မြင်ပါသည်', 'success');
    } catch (error) {
        console.error('အတည်ပြုမှုအခြေအနေ update လုပ်ရာတွင် အမှားရှိသည်:', error);
        showAlert('အတည်ပြုမှုအခြေအနေ update လုပ်ရာတွင် အမှားရှိပါသည်', 'error');
    }
}

// အတည်ပြုမှုကို ငြင်းပယ်ရန်
async function rejectVerification(userId) {
    if (!isAdmin) return;
    
    try {
        // အတည်ပြုမှုအခြေအနေကို update လုပ်ပါ
        const { data, error } = await supabaseClient
            .from('verification_requests')
            .update({
                status: 'rejected',
                reviewed_at: new Date().toISOString(),
                reviewer_id: currentUser.user_id
            })
            .eq('user_id', userId);
            
        if (error) {
            console.error('အတည်ပြုမှုအခြေအနေ update လုပ်ရာတွင် အမှားရှိသည်:', error);
            showAlert('အတည်ပြုမှုအခြေအနေ update လုပ်ရာတွင် အမှားရှိပါသည်', 'error');
            return;
        }
        
        // အသုံးပြုသူ အိုင်ဒီအခြေအနေကို update လုပ်ပါ
        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .update({
                passport_status: 'rejected'
            })
            .eq('user_id', userId);
            
        if (userError) {
            console.error('အသုံးပြုသူအခြေအနေ update လုပ်ရာတွင် အမှားရှိသည်:', userError);
            showAlert('အသုံးပြုသူအခြေအနေ update လုပ်ရာတွင် အမှားရှိပါသည်', 'error');
            return;
        }
        
        // Modal ပိတ်ပါ
        closeModal('verificationDetailModal');
        
        // အတည်ပြုမှုစာရင်းကို refresh လုပ်ပါ
        loadVerifications();
        
        showAlert('ငြင်းပယ်ခြင်းအောင်မြင်ပါသည်', 'success');
    } catch (error) {
        console.error('အတည်ပြုမှုအခြေအနေ update လုပ်ရာတွင် အမှားရှိသည်:', error);
        showAlert('အတည်ပြုမှုအခြေအနေ update လုပ်ရာတွင် အမှားရှိပါသည်', 'error');
    }
}
