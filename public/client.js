const SUPABASE_URL = 'https://vtsczzlnhsrgnbkfyizi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68';
let supabaseClient = null;
let currentUser = null;
let currentUserDetails = null;
let currentToken = null;
let activeWebSocket = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeClientPage();
});

// Client page စတင်ရန်
function initializeClientPage() {
    // Supabase ချိတ်ဆက်မှု
    try {
        initializeSupabase();
        
        // သိမ်းဆည်းထားသော session စစ်ဆေးပါ
        checkLoggedInStatus();
        
        // အခြားအကြောင်းအရာများ event listeners တပ်ဆင်ပါ
        setupClientEventListeners();
    } catch (error) {
        console.error('Supabase ချိတ်ဆက်ရာတွင် အမှားရှိသည်:', error);
        showCustomError('ဆာဗာချိတ်ဆက်ရာတွင် အမှားရှိသည်။ နောက်မှ ထပ်မံကြိုးစားပါ။');
    }

    // Demo စနစ်တွင် ခေတ္တစာရင်းမှတ်တမ်းများကို နမူနာအဖြစ် ပြင်ဆင်ပါ
    setupDemoData();
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

// Client page event listeners တပ်ဆင်ရန်
function setupClientEventListeners() {
    // အကောင့်ဝင်ရန်နှင့် အကောင့်အသစ်ဖွင့်ရန် ခလုပ်များ
    document.getElementById('loginTab').addEventListener('click', function() {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('loginTab').classList.add('active');
        document.getElementById('registerTab').classList.remove('active');
    });
    
    document.getElementById('registerTab').addEventListener('click', function() {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.remove('hidden');
        document.getElementById('loginTab').classList.remove('active');
        document.getElementById('registerTab').classList.add('active');
    });
    
    // အကောင့်ဝင်ရန်
    document.getElementById('loginButton').addEventListener('click', handleLogin);
    
    // အကောင့်အသစ်ဖွင့်ရန်
    document.getElementById('registerButton').addEventListener('click', handleRegister);
    
    // အမြန်ခလုပ်များကို နှိပ်သည့်အခါ
    document.getElementById('topupButton').addEventListener('click', function() {
        showSection('topupScreen');
    });
    
    document.getElementById('transferButton').addEventListener('click', function() {
        showSection('transferScreen');
    });
    
    document.getElementById('historyButton').addEventListener('click', function() {
        showSection('historyScreen');
        loadHistory();
    });
    
    document.getElementById('profileButton').addEventListener('click', function() {
        showSection('profileScreen');
    });
    
    // ငွေလွှဲရန်အတည်ပြုခလုပ်ကို နှိပ်သည့်အခါ
    document.getElementById('confirmTransferButton').addEventListener('click', processTransfer);
    
    // အိုင်ဒီအတည်ပြုခလုပ်ကို နှိပ်သည့်အခါ
    document.getElementById('verifyIdButton').addEventListener('click', function() {
        showSection('verifyIdScreen');
    });
    
    // အိုင်ဒီအတည်ပြုရန်တင်သွင်းခလုပ်ကို နှိပ်သည့်အခါ
    document.getElementById('submitVerificationButton').addEventListener('click', submitPassport);
    
    // အကောင့်ထွက်ရန်ခလုပ်ကို နှိပ်သည့်အခါ
    document.getElementById('logoutButton').addEventListener('click', logoutUser);
    
    // ငွေဖြည့်နည်းရွေးချယ်သည့်အခါ
    const topupOptions = document.querySelectorAll('.topup-option');
    topupOptions.forEach(option => {
        option.addEventListener('click', function() {
            document.getElementById('topupForm').classList.remove('hidden');
            
            // ရွေးချယ်ထားသော ငွေဖြည့်နည်းကို မီးမောင်းထိုးပြပါ
            topupOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // ငွေဖြည့်ရန်အတည်ပြုခလုပ်ကို နှိပ်သည့်အခါ
    document.getElementById('confirmTopupButton').addEventListener('click', function() {
        const amount = document.getElementById('topupAmount').value;
        const phone = document.getElementById('topupPhone').value;
        const selectedMethod = document.querySelector('.topup-option.active')?.dataset.method;
        
        if (!amount || !phone || !selectedMethod) {
            showCustomError('ကျေးဇူးပြု၍ အချက်အလက်အားလုံးဖြည့်စွက်ပါ');
            return;
        }
        
        if (parseInt(amount) < 1000) {
            showCustomError('အနည်းဆုံး ၁,၀၀၀ ကျပ် ဖြည့်သွင်းရပါမည်');
            return;
        }
        
        if (!isValidMyanmarPhone(phone)) {
            showCustomError('ဖုန်းနံပါတ်မှားယွင်းနေပါသည်');
            return;
        }
        
        // ဤနေရာတွင် ငွေဖြည့်ကုဒ်ထည့်သွင်းရန် မိုဒယ်ဖြင့် ပြပါမည်
        // လက်ရှိ demo အတွက် အကောင့်ကို တိုက်ရိုက်ငွေထည့်ပါ
        simulatePayment(amount, 'topup');
    });
    
    // စတင်နေစဉ် ပြဿနာရှိလျှင် error စာတမ်းပိတ်ရန်
    document.getElementById('alertBox').querySelector('.alert-close').addEventListener('click', closeErrorAlert);
}

// အကောင့်ဝင်ထားမှု အခြေအနေစစ်ဆေးရန်
async function checkLoggedInStatus() {
    const savedToken = localStorage.getItem('kpay_token');
    const savedEmail = localStorage.getItem('kpay_email');
    
    if (savedToken && savedEmail) {
        try {
            // Session ကို server ဘက်တွင် စစ်ဆေးမည်
            await validateSession(savedToken, savedEmail);
        } catch (error) {
            console.error('Session စစ်ဆေးရာတွင် အမှားရှိသည်:', error);
            localStorage.removeItem('kpay_token');
            localStorage.removeItem('kpay_email');
            showLoginScreen();
        }
    } else {
        showLoginScreen();
    }
}

// Session ကို server ဘက်တွင် စစ်ဆေးမည်
async function validateSession(token, email) {
    try {
        // Supabase မှတစ်ဆင့် server ဘက်ကို ဆက်သွယ်စစ်ဆေးမည်
        const { data, error } = await supabaseClient
            .from('login_sessions')
            .select('*')
            .eq('session_token', token)
            .eq('is_active', true)
            .single();
        
        if (error || !data) {
            throw new Error('Session မတည်ရှိတော့ပါ သို့မဟုတ် သက်တမ်းကုန်ဆုံးသွားပါပြီ');
        }
        
        // သက်တမ်းကုန်ဆုံးချိန် စစ်ဆေးပါ
        const expiresAt = new Date(data.expires_at);
        if (expiresAt < new Date()) {
            throw new Error('Session သက်တမ်းကုန်ဆုံးသွားပါပြီ');
        }
        
        // အသုံးပြုသူအချက်အလက်ရယူပါ
        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .select('*')
            .eq('user_id', data.user_id)
            .single();
        
        if (userError || !userData) {
            throw new Error('အသုံးပြုသူ မတွေ့ရှိပါ');
        }
        
        // Session တည်ရှိသေးပါက အသုံးပြုသူအချက်အလက်သိမ်းဆည်းမည်
        currentUser = userData;
        currentUserDetails = data;
        currentToken = token;
        
        // websocket ချိတ်ဆက်မှု စတင်ပါ
        setupRealtimeSubscriptions(userData.user_id);
        
        // UI ပြင်ဆင်ပါ
        hideLoginScreen();
        updateUIWithUserData();
    } catch (error) {
        console.error('Session စစ်ဆေးရာတွင် အမှားရှိသည်:', error);
        localStorage.removeItem('kpay_token');
        localStorage.removeItem('kpay_email');
        showLoginScreen();
        throw error;
    }
}

// အသုံးပြုသူ မှတ်ပုံတင်ရန်
async function registerUser(email, password, phone) {
    try {
        if (!email || !password || !phone) {
            showCustomError('ကျေးဇူးပြု၍ အချက်အလက်အားလုံးဖြည့်စွက်ပါ');
            return;
        }
        
        if (!isValidMyanmarPhone(phone)) {
            showCustomError('ဖုန်းနံပါတ်မှားယွင်းနေပါသည်');
            return;
        }
        
        const user_id = generateUserId(); // 'USR' နှင့်စသော ID ဖန်တီးပါ
        
        // Supabase တွင် အသုံးပြုသူအသစ်ဖန်တီးပါ
        const { data, error } = await supabaseClient.from('users').insert([
            {
                user_id,
                email,
                password_hash: password, // လက်တွေ့တွင် hash ဖြစ်သင့်သည်
                phone,
                balance: "0",
                passport_status: "not_verified",
                is_admin: false
            }
        ]).select();
        
        if (error) {
            console.error('အသုံးပြုသူအသစ်ဖန်တီးရာတွင် အမှားရှိသည်:', error);
            if (error.code === '23505') { // Unique constraint violation
                showCustomError('ဤအီးမေးလ် သို့မဟုတ် ဖုန်းနံပါတ်ကို အသုံးပြုပြီးသားဖြစ်သည်');
            } else {
                showCustomError('အသုံးပြုသူအသစ်ဖန်တီးရာတွင် အမှားရှိသည်');
            }
            return;
        }
        
        // Session ဖန်တီးပါ
        const sessionToken = generateSessionToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 ရက်
        
        const { data: sessionData, error: sessionError } = await supabaseClient.from('login_sessions').insert([
            {
                user_id,
                session_token: sessionToken,
                device_info: navigator.userAgent,
                ip_address: "client_ip", // Server ဘက်တွင် IP ရယူသင့်သည်
                is_active: true,
                created_at: new Date().toISOString(),
                expires_at: expiresAt.toISOString(),
                last_active: new Date().toISOString()
            }
        ]);
        
        if (sessionError) {
            console.error('Session ဖန်တီးရာတွင် အမှားရှိသည်:', sessionError);
            showCustomError('အကောင့်ဖွင့်အောင်မြင်သော်လည်း၊ အကောင့်ဝင်ရန် အခက်အခဲရှိသည်');
            return;
        }
        
        // အသုံးပြုသူလုပ်ဆောင်မှုမှတ်တမ်းတင်ပါ
        const { data: activityData, error: activityError } = await supabaseClient.from('activity_logs').insert([
            {
                user_id,
                action: 'register',
                details: JSON.stringify({ email }),
                ip_address: "client_ip", // Server ဘက်တွင် IP ရယူသင့်သည်
                timestamp: new Date().toISOString()
            }
        ]);
        
        if (activityError) {
            console.error('လုပ်ဆောင်မှုမှတ်တမ်းတင်ရာတွင် အမှားရှိသည်:', activityError);
        }
        
        // လောကယ်စတိုးရိချ်တွင် token သိမ်းဆည်းပါ
        localStorage.setItem('kpay_token', sessionToken);
        localStorage.setItem('kpay_email', email);
        
        currentUser = data[0];
        currentToken = sessionToken;
        
        // websocket ချိတ်ဆက်မှု စတင်ပါ
        setupRealtimeSubscriptions(user_id);
        
        // UI ပြင်ဆင်ပါ
        hideLoginScreen();
        updateUIWithUserData();
        
        showAlert('အကောင့်အသစ်ဖွင့်ခြင်း အောင်မြင်ပါသည်', 'success');
    } catch (error) {
        console.error('မှတ်ပုံတင်ရာတွင် အမှားရှိသည်:', error);
        showCustomError('အကောင့်ဖွင့်ရာတွင် အမှားရှိပါသည်။ ကျေးဇူးပြု၍ နောက်မှ ထပ်မံကြိုးစားပါ။');
    }
}

// အသုံးပြုသူဝင်ရောက်ရန်
async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showCustomError('ကျေးဇူးပြု၍ အချက်အလက်အားလုံးဖြည့်စွက်ပါ');
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
            showCustomError('အီးမေးလ် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်');
            return;
        }
        
        // စကားဝှက်စစ်ဆေးပါ
        if (data.password_hash !== password) { // လက်တွေ့တွင် hash ကို ပြန်မတိုက်ဆိုင်သင့်ပါ
            showCustomError('အီးမေးလ် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်');
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
                ip_address: "client_ip", // Server ဘက်တွင် IP ရယူသင့်သည်
                is_active: true,
                created_at: new Date().toISOString(),
                expires_at: expiresAt.toISOString(),
                last_active: new Date().toISOString()
            }
        ]);
        
        if (sessionError) {
            console.error('Session ဖန်တီးရာတွင် အမှားရှိသည်:', sessionError);
            showCustomError('အကောင့်ဝင်ရာတွင် အခက်အခဲရှိသည်');
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
                action: 'login',
                details: JSON.stringify({ email: data.email }),
                ip_address: "client_ip", // Server ဘက်တွင် IP ရယူသင့်သည်
                timestamp: new Date().toISOString()
            }
        ]);
        
        if (activityError) {
            console.error('လုပ်ဆောင်မှုမှတ်တမ်းတင်ရာတွင် အမှားရှိသည်:', activityError);
        }
        
        // လောကယ်စတိုးရိချ်တွင် token သိမ်းဆည်းပါ
        localStorage.setItem('kpay_token', sessionToken);
        localStorage.setItem('kpay_email', email);
        
        currentUser = data;
        currentToken = sessionToken;
        
        // websocket ချိတ်ဆက်မှု စတင်ပါ
        setupRealtimeSubscriptions(data.user_id);
        
        // UI ပြင်ဆင်ပါ
        hideLoginScreen();
        updateUIWithUserData();
        
        showAlert('အကောင့်ဝင်ရောက်ခြင်း အောင်မြင်ပါသည်', 'success');
    } catch (error) {
        console.error('အကောင့်ဝင်ရာတွင် အမှားရှိသည်:', error);
        showCustomError('အကောင့်ဝင်ရာတွင် အမှားရှိပါသည်။ ကျေးဇူးပြု၍ နောက်မှ ထပ်မံကြိုးစားပါ။');
    }
}

// အကောင့်အသစ်ဖွင့်ရန်
async function handleRegister() {
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const phone = document.getElementById('registerPhone').value;
    
    if (!email || !password || !phone) {
        showCustomError('ကျေးဇူးပြု၍ အချက်အလက်အားလုံးဖြည့်စွက်ပါ');
        return;
    }
    
    if (!isValidMyanmarPhone(phone)) {
        showCustomError('ဖုန်းနံပါတ်မှားယွင်းနေပါသည်');
        return;
    }
    
    registerUser(email, password, phone);
}

// အကောင့်မှထွက်ရန်
async function logoutUser() {
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
                action: 'logout',
                details: JSON.stringify({}),
                ip_address: "client_ip", // Server ဘက်တွင် IP ရယူသင့်သည်
                timestamp: new Date().toISOString()
            }
        ]);
        
        if (activityError) {
            console.error('လုပ်ဆောင်မှုမှတ်တမ်းတင်ရာတွင် အမှားရှိသည်:', activityError);
        }
        
        // websocket ဖြုတ်ပါ
        if (activeWebSocket) {
            activeWebSocket.close();
            activeWebSocket = null;
        }
        
        // လောကယ်စတိုးရိချ်မှ token ဖျက်ပါ
        localStorage.removeItem('kpay_token');
        localStorage.removeItem('kpay_email');
        
        currentUser = null;
        currentToken = null;
        
        // UI ပြင်ဆင်ပါ
        showLoginScreen();
        
        showAlert('အကောင့်မှထွက်ခြင်း အောင်မြင်ပါသည်', 'success');
    } catch (error) {
        console.error('အကောင့်မှထွက်ရာတွင် အမှားရှိသည်:', error);
        showCustomError('အကောင့်မှထွက်ရာတွင် အမှားရှိပါသည်။ ကျေးဇူးပြု၍ နောက်မှ ထပ်မံကြိုးစားပါ။');
    }
}

// အကောင့်ဝင်ရန် စခရင်ပြပါ
function showLoginScreen() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('mainScreen').classList.add('hidden');
}

// အကောင့်ဝင်ရန် စခရင်ဖျောက်ပါ
function hideLoginScreen() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
}

// အသုံးပြုသူအချက်အလက်ဖြင့် UI ပြင်ဆင်ပါ
function updateUIWithUserData() {
    if (!currentUser) return;
    
    // Header UI ပြင်ဆင်ပါ
    document.getElementById('userBalance').textContent = formatCurrency(currentUser.balance) + ' MMK';
    
    // Profile UI ပြင်ဆင်ပါ
    document.getElementById('profileName').textContent = currentUser.username || currentUser.email.split('@')[0];
    document.getElementById('profilePhone').textContent = currentUser.phone || '-';
    document.getElementById('profileEmail').textContent = currentUser.email;
    
    // ငွေလွှဲအခြေအနေကို စစ်ဆေးပါ
    checkTransferSettings();
    
    // မှတ်တမ်းကို ရယူပါ
    loadHistory();
}

// Animation ဖြင့် အပေါ်မှအောက်သို့ကျလာသော ငွေခွေများ
function createParticles() {
    const count = 10;
    const container = document.querySelector('.main-container');
    
    if (!container) return;
    
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 3 + 's';
        
        const coinImage = document.createElement('img');
        coinImage.src = 'https://cdn-icons-png.flaticon.com/512/2489/2489756.png';
        coinImage.alt = 'Coin';
        coinImage.style.width = '20px';
        coinImage.style.height = '20px';
        
        particle.appendChild(coinImage);
        container.appendChild(particle);
        
        // Animation ပြီးဆုံးပါက ဖျက်ပါ
        setTimeout(() => {
            if (container.contains(particle)) {
                container.removeChild(particle);
            }
        }, 3000 + (Math.random() * 3000));
    }
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

// အောင်မြင်မှု alert ပြပါ
function showAlert(message, type = 'success') {
    const alertBox = document.getElementById('alertBox');
    if (!alertBox) return;
    
    const alertMessage = document.getElementById('alertMessage');
    if (!alertMessage) return;
    
    alertMessage.textContent = message;
    alertBox.className = `alert ${type}`;
    alertBox.classList.remove('hidden');
    
    setTimeout(() => {
        alertBox.classList.add('hidden');
    }, 3000);
}

// အမှား alert ပြပါ
function showCustomError(message) {
    const alertBox = document.getElementById('alertBox');
    if (!alertBox) return;
    
    const alertMessage = document.getElementById('alertMessage');
    if (!alertMessage) return;
    
    alertMessage.textContent = message;
    alertBox.className = 'alert error';
    alertBox.classList.remove('hidden');
}

// အမှား alert ပိတ်ပါ
function closeErrorAlert() {
    const alertBox = document.getElementById('alertBox');
    if (alertBox) {
        alertBox.classList.add('hidden');
    }
}

// Realtime ချိတ်ဆက်မှု
function setupRealtimeSubscriptions(userId) {
    if (!userId) return;
    
    try {
        // WebSocket URL ဖန်တီးပါ
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        console.log(`WebSocket URL: ${wsUrl}`);
        
        if (activeWebSocket) {
            activeWebSocket.close();
        }
        
        activeWebSocket = new WebSocket(wsUrl);
        
        activeWebSocket.onopen = function() {
            console.log('WebSocket ချိတ်ဆက်မှု အောင်မြင်ပါသည်');
            // အသုံးပြုသူ authenticate ပြုလုပ်ရန် message ပို့ပါ
            const authMessage = {
                type: 'auth',
                userId: userId
            };
            activeWebSocket.send(JSON.stringify(authMessage));
        };
        
        activeWebSocket.onmessage = function(event) {
            console.log('WebSocket message ရရှိပါသည်:', event.data);
            try {
                const data = JSON.parse(event.data);
                
                // message အမျိုးအစားပေါ်မူတည်၍ လုပ်ဆောင်ချက်များ
                if (data.type === 'auth_success') {
                    console.log('WebSocket authentication အောင်မြင်ပါသည်');
                } else if (data.type === 'transaction_update') {
                    // ငွေလွှဲမှု update ဖြစ်ပါက အသုံးပြုသူပိုက်ဆံအိတ် update လုပ်ပါ
                    updateBalance();
                    loadHistory();
                    showAlert('ငွေလွှဲမှု အခြေအနေ ပြောင်းလဲသွားပါပြီ', 'info');
                } else if (data.type === 'verification_update') {
                    // အိုင်ဒီအတည်ပြုမှု update ဖြစ်ပါက သတိပေးချက်ပြပါ
                    updateUIWithUserData();
                    showAlert('အိုင်ဒီအတည်ပြုမှု အခြေအနေ ပြောင်းလဲသွားပါပြီ', 'info');
                }
            } catch (error) {
                console.error('WebSocket message ပြန်ဖြေရာတွင် အမှားရှိသည်:', error);
            }
        };
        
        activeWebSocket.onerror = function(error) {
            console.error('WebSocket အမှား:', error);
        };
        
        activeWebSocket.onclose = function(event) {
            console.log('WebSocket ချိတ်ဆက်မှု ပိတ်သွားပါပြီ:', event.code, event.reason);
            // ပြန်လည်ချိတ်ဆက်ရန် ကြိုးစားပါ
            setTimeout(() => {
                if (currentUser) {
                    setupRealtimeSubscriptions(userId);
                }
            }, 3000);
        };
    } catch (error) {
        console.error('WebSocket ချိတ်ဆက်ရာတွင် အမှားရှိသည်:', error);
    }
}

// လက်ကျန်ငွေ update ရန်
async function updateBalance() {
    if (!currentUser) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('balance')
            .eq('user_id', currentUser.user_id)
            .single();
        
        if (error) {
            console.error('လက်ကျန်ငွေရယူရာတွင် အမှားရှိသည်:', error);
            return;
        }
        
        // UI တွင် update လုပ်ပါ
        currentUser.balance = data.balance;
        document.getElementById('userBalance').textContent = formatCurrency(data.balance) + ' MMK';
    } catch (error) {
        console.error('လက်ကျန်ငွေ update လုပ်ရာတွင် အမှားရှိသည်:', error);
    }
}

// ငွေလွှဲမှု အခြေအနေစစ်ဆေးရန်
async function checkTransferSettings() {
    if (!currentUser) return;
    
    // အိုင်ဒီအတည်ပြုမှု အခြေအနေကိုစစ်ဆေးပါ
    if (currentUser.passport_status !== 'verified') {
        // အိုင်ဒီအတည်ပြုထားခြင်းမရှိပါက ငွေလွှဲခွင့်ကန့်သတ်ပါ
        document.getElementById('transferButton').classList.add('disabled');
        document.getElementById('transferAmount')?.setAttribute('max', '50000');
        updateStatus('ငွေလွှဲနိုင်သည့်ပမာဏကို တစ်ရက်လျှင် ၅၀,၀၀၀ ကျပ်သာ ခွင့်ပြုထားပါသည်။ အကန့်အသတ်မဲ့ငွေလွှဲနိုင်ရန် <a href="#" onclick="showSection(\'verifyIdScreen\')">အိုင်ဒီအတည်ပြုခြင်း</a> ပြုလုပ်ပါ။');
    } else {
        document.getElementById('transferButton').classList.remove('disabled');
        document.getElementById('transferAmount')?.removeAttribute('max');
        document.getElementById('verifyIdButton')?.setAttribute('disabled', 'disabled');
        document.getElementById('verifyIdButton').textContent = 'အိုင်ဒီအတည်ပြုပြီး';
        updateStatus('သင်၏အိုင်ဒီအတည်ပြုပြီးဖြစ်သည့်အတွက် ငွေလွှဲနိုင်သည့်ပမာဏ ကန့်သတ်ချက်မရှိပါ။');
    }
}

// ငွေလွှဲနိုင်သည့် အခြေအနေပြင်ဆင်ရန်
function updateStatus(status) {
    const statusElement = document.createElement('div');
    statusElement.className = 'status-message';
    statusElement.innerHTML = status;
    
    const existingStatus = document.querySelector('.status-message');
    if (existingStatus) {
        existingStatus.parentNode.removeChild(existingStatus);
    }
    
    const quickActions = document.querySelector('.quick-actions');
    if (quickActions) {
        quickActions.insertAdjacentElement('afterend', statusElement);
    }
}

// စခရင်များပြပါ
function showSection(sectionId) {
    // အခြားစခရင်များဖျောက်ပါ
    const sections = document.querySelectorAll('.overlay-screen');
    sections.forEach(section => {
        section.classList.add('hidden');
    });
    
    // တောင်းဆိုသော စခရင်ပြပါ
    document.getElementById(sectionId).classList.remove('hidden');
    
    // အပိုလုပ်ဆောင်ချက်များ
    if (sectionId === 'historyScreen') {
        loadHistory();
    } else if (sectionId === 'transferScreen') {
        document.getElementById('receiverPhone').value = '';
        document.getElementById('transferAmount').value = '';
        document.getElementById('transferNote').value = '';
    }
}

// စခရင်များဖျောက်ပါ
function hideSection(sectionId) {
    document.getElementById(sectionId).classList.add('hidden');
}

// ဖုန်းနံပါတ်စစ်ဆေးရန်
async function checkPhone() {
    const receiverPhone = document.getElementById('receiverPhone').value;
    
    if (!receiverPhone) {
        showCustomError('ကျေးဇူးပြု၍ လက်ခံမည့်ဖုန်းနံပါတ်ထည့်ပါ');
        return false;
    }
    
    if (!isValidMyanmarPhone(receiverPhone)) {
        showCustomError('ဖုန်းနံပါတ်မှားယွင်းနေပါသည်');
        return false;
    }
    
    // ဖုန်းနံပါတ်နှင့် အသုံးပြုသူရှာဖွေပါ
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('user_id, phone, email')
            .eq('phone', receiverPhone)
            .single();
        
        if (error || !data) {
            showCustomError('ဖုန်းနံပါတ်နှင့် အသုံးပြုသူမတွေ့ရှိပါ');
            return false;
        }
        
        // ကိုယ့်ဖုန်းနံပါတ်ကိုယ်ဖြစ်နေပါက အမှားပြပါ
        if (data.user_id === currentUser.user_id) {
            showCustomError('သင့်ကိုယ်ပိုင်ဖုန်းနံပါတ်သို့ ငွေမလွှဲနိုင်ပါ');
            return false;
        }
        
        return data;
    } catch (error) {
        console.error('ဖုန်းနံပါတ်စစ်ဆေးရာတွင် အမှားရှိသည်:', error);
        showCustomError('ဖုန်းနံပါတ်စစ်ဆေးရာတွင် အမှားရှိပါသည်');
        return false;
    }
}

// မှတ်တမ်းများရယူရန်
async function loadHistory() {
    if (!currentUser) return;
    
    try {
        // ပထမတွင် အခြေအနေ loading ပြပါ
        const historyList = document.getElementById('historyList');
        if (!historyList) return;
        
        historyList.innerHTML = '<div class="loading">မှတ်တမ်းများရယူနေသည်...</div>';
        
        // ငွေလွှဲမှုမှတ်တမ်းများရယူပါ
        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .or(`sender_id.eq.${currentUser.user_id},receiver_id.eq.${currentUser.user_id}`)
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (error) {
            console.error('မှတ်တမ်းများရယူရာတွင် အမှားရှိသည်:', error);
            historyList.innerHTML = '<div class="empty-state">မှတ်တမ်းများရယူရာတွင် အမှားရှိပါသည်</div>';
            return;
        }
        
        // UI ပြင်ဆင်ပါ
        if (!data || data.length === 0) {
            historyList.innerHTML = '<div class="empty-state">ငွေလွှဲမှုမှတ်တမ်းများမရှိသေးပါ</div>';
            return;
        }
        
        historyList.innerHTML = '';
        
        // ငွေလွှဲမှုမှတ်တမ်းများဖော်ပြပါ
        data.forEach(transaction => {
            const isOutgoing = transaction.sender_id === currentUser.user_id;
            const otherParty = isOutgoing ? transaction.receiver_id : transaction.sender_id;
            
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <div class="history-item-header">
                    <div class="history-item-type">${isOutgoing ? 'ငွေလွှဲမှု' : 'ငွေလက်ခံမှု'}</div>
                    <div class="history-item-date">${formatDate(transaction.created_at)}</div>
                </div>
                <div class="history-item-body">
                    <div class="history-item-user">${otherParty}</div>
                    <div class="history-item-amount ${isOutgoing ? 'negative' : 'positive'}">
                        ${isOutgoing ? '-' : '+'} ${formatCurrency(transaction.amount)} MMK
                    </div>
                </div>
                <div class="history-item-footer">
                    <div class="history-item-status status-${transaction.status}">
                        ${getStatusText(transaction.status)}
                    </div>
                    <div class="history-item-id" onclick="showReceipt('${transaction.transaction_id}', '${isOutgoing ? 'out' : 'in'}')">
                        ပြေစာကြည့်ရန်
                    </div>
                </div>
            `;
            
            historyList.appendChild(historyItem);
        });
        
        // အဓိက စခရင်၏ မှတ်တမ်းများကိုလည်း update လုပ်ပါ
        updateTransactionList(data.slice(0, 3));
    } catch (error) {
        console.error('မှတ်တမ်းများရယူရာတွင် အမှားရှိသည်:', error);
        const historyList = document.getElementById('historyList');
        if (historyList) {
            historyList.innerHTML = '<div class="empty-state">မှတ်တမ်းများရယူရာတွင် အမှားရှိပါသည်</div>';
        }
    }
}

// အဓိက စခရင်၏ မှတ်တမ်းများကို update လုပ်ပါ
function updateTransactionList(transactions) {
    const transactionList = document.getElementById('transactionList');
    if (!transactionList) return;
    
    if (!transactions || transactions.length === 0) {
        transactionList.innerHTML = '<div class="empty-state">လတ်တလော ငွေလွှဲမှုမရှိသေးပါ</div>';
        return;
    }
    
    transactionList.innerHTML = '';
    
    transactions.forEach(transaction => {
        const isOutgoing = transaction.sender_id === currentUser.user_id;
        const otherParty = isOutgoing ? transaction.receiver_id : transaction.sender_id;
        
        const transactionItem = document.createElement('div');
        transactionItem.className = 'transaction-item';
        transactionItem.innerHTML = `
            <div class="transaction-left">
                <div class="transaction-icon">
                    <img src="https://cdn-icons-png.flaticon.com/512/${isOutgoing ? '5454' : '5956'}//${isOutgoing ? '5454292' : '5956592'}.png" alt="${isOutgoing ? 'ငွေလွှဲမှု' : 'ငွေလက်ခံမှု'}">
                </div>
                <div class="transaction-info">
                    <h4>${isOutgoing ? 'ငွေလွှဲမှု' : 'ငွေလက်ခံမှု'}</h4>
                    <p>${otherParty} • ${formatDate(transaction.created_at)}</p>
                </div>
            </div>
            <div class="transaction-amount ${isOutgoing ? 'negative' : 'positive'}">
                ${isOutgoing ? '-' : '+'} ${formatCurrency(transaction.amount)} MMK
            </div>
        `;
        
        transactionList.appendChild(transactionItem);
    });
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
        default:
            return status;
    }
}

// ဒေါင်းလုဒ်ဘားကိုဖျောက်ပါ
function hideDownloadBar() {
    const downloadBar = document.getElementById('downloadBar');
    if (downloadBar) {
        downloadBar.style.display = 'none';
    }
    
    // ၇ ရက်ကြာအောင် သိမ်းထားပါ
    localStorage.setItem('hideDownloadBar', new Date().getTime());
}

// APK ဒေါင်းလုဒ်လုပ်ရန်
function downloadApk() {
    // APK ဒေါင်းလုဒ်လုပ်ရန် လင့်ခ်
    window.location.href = 'https://example.com/download/kpay.apk';
}

// ဖိုင်ကြိုတင်ကြည့်ရှုရန်
function previewFile(inputId) {
    const input = document.getElementById(inputId);
    const previewDiv = document.getElementById(inputId + 'Preview');
    
    if (input.files && input.files[0] && previewDiv) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            previewDiv.innerHTML = `<img src="${e.target.result}" alt="ရွေးချယ်ထားသောဖိုင်">`;
        };
        
        reader.readAsDataURL(input.files[0]);
    }
}

// အိုင်ဒီအတည်ပြုရန် ဖိုင်များတင်သွင်းရန်
async function submitPassport() {
    if (!currentUser) return;
    
    const idCardFile = document.getElementById('idCardFile').files[0];
    const selfieFile = document.getElementById('selfieFile').files[0];
    
    if (!idCardFile || !selfieFile) {
        showCustomError('ကျေးဇူးပြု၍ အိုင်ဒီကတ်နှင့် ကိုယ်တိုင်ဓာတ်ပုံ နှစ်ခုစလုံးတင်ပါ');
        return;
    }
    
    try {
        // ဓာတ်ပုံများကို Supabase Storage သို့တင်ပါ
        const idCardPath = `verification/${currentUser.user_id}/id_card`;
        const selfiePath = `verification/${currentUser.user_id}/selfie`;
        
        // Supabase Storage သို့ ဓာတ်ပုံများတင်ပါ
        const idCardUpload = await supabaseClient.storage.from('verification_documents').upload(idCardPath, idCardFile, {
            cacheControl: '3600',
            upsert: true
        });
        
        if (idCardUpload.error) {
            console.error('အိုင်ဒီကတ်ဓာတ်ပုံတင်ရာတွင် အမှားရှိသည်:', idCardUpload.error);
            showCustomError('အိုင်ဒီကတ်ဓာတ်ပုံတင်ရာတွင် အမှားရှိပါသည်။ ကျေးဇူးပြု၍ နောက်မှ ထပ်မံကြိုးစားပါ။');
            return;
        }
        
        const selfieUpload = await supabaseClient.storage.from('verification_documents').upload(selfiePath, selfieFile, {
            cacheControl: '3600',
            upsert: true
        });
        
        if (selfieUpload.error) {
            console.error('ကိုယ်တိုင်ဓာတ်ပုံတင်ရာတွင် အမှားရှိသည်:', selfieUpload.error);
            showCustomError('ကိုယ်တိုင်ဓာတ်ပုံတင်ရာတွင် အမှားရှိပါသည်။ ကျေးဇူးပြု၍ နောက်မှ ထပ်မံကြိုးစားပါ။');
            return;
        }
        
        // အတည်ပြုမှုဇယားတွင် အချက်အလက်ထည့်သွင်းပါ
        const { data, error } = await supabaseClient.from('verification_requests').insert([
            {
                user_id: currentUser.user_id,
                id_document: idCardPath,
                selfie: selfiePath,
                status: 'pending',
                submitted_at: new Date().toISOString()
            }
        ]);
        
        if (error) {
            console.error('အတည်ပြုမှုတောင်းဆိုချက်ဖန်တီးရာတွင် အမှားရှိသည်:', error);
            showCustomError('အတည်ပြုမှုတောင်းဆိုချက်ဖန်တီးရာတွင် အမှားရှိပါသည်။ ကျေးဇူးပြု၍ နောက်မှ ထပ်မံကြိုးစားပါ။');
            return;
        }
        
        // အသုံးပြုသူ passport_status ကို pending သို့ပြောင်းပါ
        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .update({ passport_status: 'pending' })
            .eq('user_id', currentUser.user_id);
        
        if (userError) {
            console.error('အသုံးပြုသူ အခြေအနေ update လုပ်ရာတွင် အမှားရှိသည်:', userError);
        } else {
            // currentUser ကို update လုပ်ပါ
            currentUser.passport_status = 'pending';
        }
        
        // UI ပြင်ဆင်ပါ
        hideSection('verifyIdScreen');
        showAlert('အိုင်ဒီအတည်ပြုရန် တင်သွင်းခြင်း အောင်မြင်ပါသည်', 'success');
        
        // ငွေလွှဲခွင့်ပြုချက်စစ်ဆေးရန် update လုပ်ပါ
        checkTransferSettings();
    } catch (error) {
        console.error('အိုင်ဒီအတည်ပြုရန် တင်သွင်းရာတွင် အမှားရှိသည်:', error);
        showCustomError('အိုင်ဒီအတည်ပြုရန် တင်သွင်းရာတွင် အမှားရှိပါသည်။ ကျေးဇူးပြု၍ နောက်မှ ထပ်မံကြိုးစားပါ။');
    }
}

// ဝန်ဆောင်မှုအသေးစိတ်ပြရန်
function showService(serviceId) {
    const serviceDetailScreen = document.getElementById('serviceDetailScreen');
    const serviceDetailTitle = document.getElementById('serviceDetailTitle');
    
    if (!serviceDetailScreen || !serviceDetailTitle) return;
    
    // ဝန်ဆောင်မှုအားလုံးကို ဖျောက်ပါ
    const serviceContents = document.querySelectorAll('.service-detail-content');
    serviceContents.forEach(content => {
        content.classList.add('hidden');
    });
    
    // တောင်းဆိုသော ဝန်ဆောင်မှုကိုပြပါ
    document.getElementById(serviceId + 'Service').classList.remove('hidden');
    
    // ခေါင်းစဉ်ပြင်ဆင်ပါ
    switch (serviceId) {
        case 'internet':
            serviceDetailTitle.textContent = 'အင်တာနက်ဘေလ်ဆောင်ရန်';
            break;
        case 'electricity':
            serviceDetailTitle.textContent = 'လျှပ်စစ်မီတာဘေလ်ဆောင်ရန်';
            break;
        case 'water':
            serviceDetailTitle.textContent = 'ရေဖိုးဆောင်ရန်';
            break;
        case 'donation':
            serviceDetailTitle.textContent = 'အလှူငွေထည့်ဝင်ရန်';
            break;
    }
    
    serviceDetailScreen.classList.remove('hidden');
}

// ဝန်ဆောင်မှုအသေးစိတ်ကိုဖျောက်ပါ
function hideServiceDetails() {
    document.getElementById('serviceDetailScreen').classList.add('hidden');
}

// ငွေဖြည့်နည်းများပြရန်
function showTopupOptions() {
    const topupScreen = document.getElementById('topupScreen');
    if (!topupScreen) return;
    
    topupScreen.classList.remove('hidden');
    document.getElementById('topupForm').classList.add('hidden');
    
    // ရွေးချယ်ထားမှုများကို reset လုပ်ပါ
    const topupOptions = document.querySelectorAll('.topup-option');
    topupOptions.forEach(option => {
        option.classList.remove('active');
    });
}

// ပြေစာပြရန်
async function showReceipt(transactionId, type) {
    try {
        // ငွေလွှဲမှုအချက်အလက်ရယူပါ
        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .eq('transaction_id', transactionId)
            .single();
        
        if (error || !data) {
            console.error('ငွေလွှဲမှုအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', error);
            showCustomError('ငွေလွှဲမှုအချက်အလက်ရယူရာတွင် အမှားရှိပါသည်');
            return;
        }
        
        // ပြေစာအချက်အလက်များပြင်ဆင်ပါ
        document.getElementById('receiptType').textContent = type === 'out' ? 'ငွေလွှဲမှု' : 'ငွေလက်ခံမှု';
        document.getElementById('receiptDate').textContent = formatDate(data.created_at);
        document.getElementById('receiptId').textContent = data.transaction_id;
        document.getElementById('receiptSender').textContent = data.sender_id;
        document.getElementById('receiptReceiver').textContent = data.receiver_id;
        document.getElementById('receiptAmount').textContent = formatCurrency(data.amount) + ' MMK';
        document.getElementById('receiptNote').textContent = data.description || '-';
        document.getElementById('receiptStatus').textContent = getStatusText(data.status);
        document.getElementById('receiptStatus').className = `value status-${data.status}`;
        
        // ပြေစာစခရင်ပြပါ
        document.getElementById('receiptScreen').classList.remove('hidden');
    } catch (error) {
        console.error('ပြေစာပြရာတွင် အမှားရှိသည်:', error);
        showCustomError('ပြေစာပြရာတွင် အမှားရှိပါသည်');
    }
}

// ပြေစာကိုဖျောက်ပါ
function closeReceipt() {
    document.getElementById('receiptScreen').classList.add('hidden');
}

// ပြေစာဒေါင်းလုဒ်လုပ်ရန်
function downloadReceipt() {
    alert('ပြေစာဒေါင်းလုဒ်လုပ်နေသည်။ ခဏစောင့်ပါ...');
    
    // Demo တွင် function ပိတ်ထားပါသည်
    setTimeout(() => {
        showAlert('ပြေစာဒေါင်းလုဒ်လုပ်ခြင်း အောင်မြင်ပါသည်', 'success');
    }, 1500);
}

// ငွေလွှဲမှုအတည်ပြုရန်
async function processTransfer() {
    if (!currentUser) {
        showCustomError('ကျေးဇူးပြု၍ ဦးစွာအကောင့်ဝင်ပါ');
        return;
    }
    
    const receiverPhone = document.getElementById('receiverPhone').value;
    const amount = document.getElementById('transferAmount').value;
    const note = document.getElementById('transferNote').value;
    
    if (!receiverPhone || !amount) {
        showCustomError('ကျေးဇူးပြု၍ လက်ခံမည့်ဖုန်းနံပါတ်နှင့် ငွေပမာဏထည့်ပါ');
        return;
    }
    
    if (parseFloat(amount) <= 0) {
        showCustomError('ကျေးဇူးပြု၍ မှန်ကန်သော ငွေပမာဏထည့်ပါ');
        return;
    }
    
    if (parseFloat(amount) > parseFloat(currentUser.balance)) {
        showCustomError('သင့်တွင် လုံလောက်သော လက်ကျန်ငွေမရှိပါ');
        return;
    }
    
    try {
        // လက်ခံမည့်သူရှိမရှိစစ်ဆေးပါ
        const receiverData = await checkPhone();
        
        if (!receiverData) {
            return;
        }
        
        // ငွေလွှဲမှု ID ဖန်တီးပါ
        const transactionId = 'TXN' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        
        // ငွေလွှဲမှုဖန်တီးပါ
        const { data, error } = await supabaseClient.from('transactions').insert([
            {
                transaction_id: transactionId,
                sender_id: currentUser.user_id,
                receiver_id: receiverData.user_id,
                amount: amount.toString(),
                description: note,
                status: 'pending',
                created_at: new Date().toISOString()
            }
        ]);
        
        if (error) {
            console.error('ငွေလွှဲမှုဖန်တီးရာတွင် အမှားရှိသည်:', error);
            showCustomError('ငွေလွှဲမှုဖန်တီးရာတွင် အမှားရှိပါသည်။ ကျေးဇူးပြု၍ နောက်မှ ထပ်မံကြိုးစားပါ။');
            return;
        }
        
        // ငွေလွှဲမှုလုပ်ဆောင်ရန် Demo function ခေါ်ပါ
        simulatePayment(amount, 'transfer', receiverData.user_id, transactionId);
        
        // UI ပြင်ဆင်ပါ
        hideSection('transferScreen');
        showAlert('ငွေလွှဲမှုစတင်ပါပြီ', 'success');
    } catch (error) {
        console.error('ငွေလွှဲရာတွင် အမှားရှိသည်:', error);
        showCustomError('ငွေလွှဲရာတွင် အမှားရှိပါသည်။ ကျေးဇူးပြု၍ နောက်မှ ထပ်မံကြိုးစားပါ။');
    }
}

// Demo စနစ်တွင် ခေတ္တ ငွေပေးချေမှုကို simulate လုပ်ပါ
async function simulatePayment(amount, type, receiverId = null, transactionId = null) {
    if (!currentUser) return;
    
    // Demo စနစ်တွင် 2-5 စက္ကန့်ကြာမည်
    const processingTime = Math.floor(Math.random() * 3000) + 2000;
    showAlert('ငွေလွှဲမှုဆောင်ရွက်နေသည်...', 'info');
    
    setTimeout(async () => {
        try {
            if (type === 'transfer') {
                // ငွေပေးချေသူ balance နုတ်ယူပါ
                const newSenderBalance = (parseFloat(currentUser.balance) - parseFloat(amount)).toString();
                
                const { data: senderData, error: senderError } = await supabaseClient
                    .from('users')
                    .update({ balance: newSenderBalance })
                    .eq('user_id', currentUser.user_id);
                
                if (senderError) {
                    console.error('ပို့သူငွေပမာဏ update လုပ်ရာတွင် အမှားရှိသည်:', senderError);
                    showCustomError('ငွေလွှဲရာတွင် အမှားရှိပါသည်။ ကျေးဇူးပြု၍ နောက်မှ ထပ်မံကြိုးစားပါ။');
                    return;
                }
                
                // လက်ခံသူ balance ထည့်ပါ
                const { data: receiverUser, error: receiverFetchError } = await supabaseClient
                    .from('users')
                    .select('balance')
                    .eq('user_id', receiverId)
                    .single();
                
                if (receiverFetchError) {
                    console.error('လက်ခံသူအချက်အလက်ရယူရာတွင် အမှားရှိသည်:', receiverFetchError);
                    showCustomError('ငွေလွှဲရာတွင် အမှားရှိပါသည်။ ကျေးဇူးပြု၍ နောက်မှ ထပ်မံကြိုးစားပါ။');
                    return;
                }
                
                const newReceiverBalance = (parseFloat(receiverUser.balance) + parseFloat(amount)).toString();
                
                const { data: receiverData, error: receiverError } = await supabaseClient
                    .from('users')
                    .update({ balance: newReceiverBalance })
                    .eq('user_id', receiverId);
                
                if (receiverError) {
                    console.error('လက်ခံသူငွေပမာဏ update လုပ်ရာတွင် အမှားရှိသည်:', receiverError);
                    showCustomError('ငွေလွှဲရာတွင် အမှားရှိပါသည်။ ကျေးဇူးပြု၍ နောက်မှ ထပ်မံကြိုးစားပါ။');
                    return;
                }
                
                // ငွေလွှဲမှုအခြေအနေ update လုပ်ပါ
                const { data: txnData, error: txnError } = await supabaseClient
                    .from('transactions')
                    .update({ status: 'success' })
                    .eq('transaction_id', transactionId);
                
                if (txnError) {
                    console.error('ငွေလွှဲမှုအခြေအနေ update လုပ်ရာတွင် အမှားရှိသည်:', txnError);
                }
                
                // currentUser သည် စတိတ်မဟုတ်တော့ဘဲ နိုင်ငံခြားတွင် update လုပ်ပါ
                currentUser.balance = newSenderBalance;
                
                // UI ပြင်ဆင်ပါ
                document.getElementById('userBalance').textContent = formatCurrency(newSenderBalance) + ' MMK';
                
                showAlert('ငွေလွှဲမှုအောင်မြင်ပါသည်', 'success');
                
                // ငွေလွှဲမှုမှတ်တမ်းကို ပြန်ရယူပါ
                setTimeout(() => {
                    loadHistory();
                }, 1000);
            } else if (type === 'topup') {
                // Demo တွင် ငွေဖြည့်ခြင်းကို တိုက်ရိုက် balance ပေါင်းခြင်းဖြင့် ပြုလုပ်ပါ
                const newBalance = (parseFloat(currentUser.balance) + parseFloat(amount)).toString();
                
                const { data, error } = await supabaseClient
                    .from('users')
                    .update({ balance: newBalance })
                    .eq('user_id', currentUser.user_id);
                
                if (error) {
                    console.error('ငွေဖြည့်ရာတွင် အမှားရှိသည်:', error);
                    showCustomError('ငွေဖြည့်ရာတွင် အမှားရှိပါသည်။ ကျေးဇူးပြု၍ နောက်မှ ထပ်မံကြိုးစားပါ။');
                    return;
                }
                
                // ငွေဖြည့်မှု ID ဖန်တီးပါ
                const topupTxnId = 'TOP' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                
                // ငွေဖြည့်မှုမှတ်တမ်းတင်ပါ
                const { data: txnData, error: txnError } = await supabaseClient.from('transactions').insert([
                    {
                        transaction_id: topupTxnId,
                        sender_id: 'SYSTEM',
                        receiver_id: currentUser.user_id,
                        amount: amount.toString(),
                        description: 'ငွေဖြည့်ခြင်း',
                        status: 'success',
                        created_at: new Date().toISOString()
                    }
                ]);
                
                if (txnError) {
                    console.error('ငွေဖြည့်မှုမှတ်တမ်းတင်ရာတွင် အမှားရှိသည်:', txnError);
                }
                
                // currentUser သည် စတိတ်မဟုတ်တော့ဘဲ နိုင်ငံခြားတွင် update လုပ်ပါ
                currentUser.balance = newBalance;
                
                // UI ပြင်ဆင်ပါ
                document.getElementById('userBalance').textContent = formatCurrency(newBalance) + ' MMK';
                
                // topup screen ကိုဖျောက်ပါ
                hideSection('topupScreen');
                
                showAlert('ငွေဖြည့်ခြင်းအောင်မြင်ပါသည်', 'success');
                
                // ငွေဖြည့်အလွန် animation ပြပါ
                createParticles();
                
                // ငွေလွှဲမှုမှတ်တမ်းကို ပြန်ရယူပါ
                setTimeout(() => {
                    loadHistory();
                }, 1000);
            }
        } catch (error) {
            console.error('ငွေပေးချေမှု simulate လုပ်ရာတွင် အမှားရှိသည်:', error);
            showCustomError('ငွေပေးချေမှုဆောင်ရွက်ရာတွင် အမှားရှိပါသည်။ ကျေးဇူးပြု၍ နောက်မှ ထပ်မံကြိုးစားပါ။');
        }
    }, processingTime);
}

// ဖုန်းနံပါတ်စစ်ဆေးရန်
function isValidMyanmarPhone(phone) {
    // မြန်မာဖုန်းနံပါတ် format: 09xxxxxxxxx
    const phoneRegex = /^09\d{7,9}$/;
    return phoneRegex.test(phone);
}

// အသုံးပြုသူ ID ဖန်တီးပါ
function generateUserId() {
    return 'USR' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
}

// Session token ဖန်တီးပါ
function generateSessionToken() {
    return 'SESSION' + Date.now().toString() + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
}

// Demo စနစ်တွင် ခေတ္တစာရင်းမှတ်တမ်းများကို နမူနာအဖြစ် ပြင်ဆင်ပါ
function setupDemoData() {
    // Demo စနစ်တွင် ဒေါင်းလုဒ်ဘားပြရန်စစ်ဆေးပါ
    const lastHiddenTime = localStorage.getItem('hideDownloadBar');
    const downloadBar = document.getElementById('downloadBar');
    
    if (downloadBar) {
        if (!lastHiddenTime || (new Date().getTime() - parseInt(lastHiddenTime)) > 7 * 24 * 60 * 60 * 1000) {
            downloadBar.style.display = 'flex';
        } else {
            downloadBar.style.display = 'none';
        }
    }
}
