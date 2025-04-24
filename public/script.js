const supabaseUrl = 'https://vtsczzlnhsrgnbkfyizi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, { fetch: (...args) => fetch(...args) });
const imgurClientId = '5befa9dd970c7d0';
const logoUrl = 'https://github.com/Opper125/opper-payment/raw/main/logo.png';

let currentUser = { user_id: null, balance: 0, passport_status: 'pending', phone: null, email: null };
let allowTransfers = true;
let currentTransactionId = null;
let receiverData = null;

// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
    // Auth elements
    const authContainer = document.getElementById('auth-container');
    const loginBox = document.getElementById('login-box');
    const signupBox = document.getElementById('signup-box');
    const showSignupLink = document.getElementById('show-signup');
    const showLoginLink = document.getElementById('show-login');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const loginMessage = document.getElementById('login-message');
    const signupMessage = document.getElementById('signup-message');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Sound elements
    const introSound = document.getElementById('intro-sound');
    const clickSound = document.getElementById('click-sound');
    const playSoundBtn = document.getElementById('play-sound-btn');
    
    // Add click sound to all buttons
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', function() {
            playClickSound();
        });
    });
    
    // Auth event listeners
    showSignupLink.addEventListener('click', function(e) {
        e.preventDefault();
        loginBox.classList.add('hidden');
        signupBox.classList.remove('hidden');
    });
    
    showLoginLink.addEventListener('click', function(e) {
        e.preventDefault();
        signupBox.classList.add('hidden');
        loginBox.classList.remove('hidden');
    });
    
    loginBtn.addEventListener('click', function() {
        login();
    });
    
    signupBtn.addEventListener('click', function() {
        signup();
    });
    
    logoutBtn.addEventListener('click', function() {
        logout();
    });
    
    // Profile upload button
    const uploadProfileBtn = document.getElementById('upload-profile-btn');
    if (uploadProfileBtn) {
        uploadProfileBtn.addEventListener('click', function() {
            uploadProfileImage();
        });
    }
    
    // Play sound button
    if (playSoundBtn) {
        playSoundBtn.addEventListener('click', function() {
            playIntroSound();
        });
    }
    
    // Submit passport button
    const submitPassportBtn = document.getElementById('submit-passport-btn');
    if (submitPassportBtn) {
        submitPassportBtn.addEventListener('click', function() {
            submitPassport();
        });
    }
    
    // Intro animation
    setTimeout(() => {
        document.getElementById('intro-container').style.display = 'none';
        checkSession();
    }, 8000);
});

// Play click sound
function playClickSound() {
    const clickSound = document.getElementById('click-sound');
    if (clickSound) {
        clickSound.currentTime = 0;
        clickSound.play().catch(err => console.error('Click sound error:', err));
    }
}

// Play intro sound
function playIntroSound() {
    const introSound = document.getElementById('intro-sound');
    if (introSound) {
        introSound.play().catch(err => console.error('Intro sound error:', err));
    }
}

// Check if user is already logged in
async function checkSession() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
            // User is logged in
            currentUser.email = session.user.email;
            document.getElementById('auth-container').style.display = 'none';
            await initializeUser(session.user.email);
        } else {
            // No active session, show login
            document.getElementById('auth-container').style.display = 'flex';
        }
    } catch (error) {
        console.error('Session check error:', error.message);
        document.getElementById('auth-container').style.display = 'flex';
    }
}

// Login function
async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const loginMessage = document.getElementById('login-message');
    
    if (!email || !password) {
        loginMessage.textContent = 'အီးမေးလ်နှင့် စကားဝှက် ထည့်သွင်းပါ။';
        loginMessage.className = 'auth-message error';
        return;
    }
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        loginMessage.textContent = 'အကောင့်ဝင်ရောက်နေသည်...';
        loginMessage.className = 'auth-message success';
        
        // Hide auth container and initialize user
        document.getElementById('auth-container').style.display = 'none';
        await initializeUser(email);
        
    } catch (error) {
        console.error('Login error:', error.message);
        loginMessage.textContent = 'အကောင့်ဝင်ရောက်မှု မအောင်မြင်ပါ။ အီးမေးလ်နှင့် စကားဝှက်ကို စစ်ဆေးပါ။';
        loginMessage.className = 'auth-message error';
    }
}

// Signup function
async function signup() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const signupMessage = document.getElementById('signup-message');
    
    if (!email || !password || !confirmPassword) {
        signupMessage.textContent = 'အီးမေးလ်နှင့် စကားဝှက် အားလုံးထည့်သွင်းပါ။';
        signupMessage.className = 'auth-message error';
        return;
    }
    
    if (password !== confirmPassword) {
        signupMessage.textContent = 'စကားဝှက်နှစ်ခု မတူညီပါ။';
        signupMessage.className = 'auth-message error';
        return;
    }
    
    try {
        // Check if email already exists
        const { data: existingUsers, error: checkError } = await supabase
            .from('users')
            .select('email')
            .eq('email', email);
        
        if (checkError) throw checkError;
        
        if (existingUsers && existingUsers.length > 0) {
            signupMessage.textContent = 'ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးသားဖြစ်သည်။';
            signupMessage.className = 'auth-message error';
            return;
        }
        
        // Create new user in auth
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        // Generate a unique 6-digit ID
        const userId = generateUniqueId();
        
        // Create user record in database
        const { error: insertError } = await supabase
            .from('users')
            .insert({
                user_id: userId,
                email: email,
                balance: 0,
                passport_status: 'pending',
                created_at: new Date().toISOString()
            });
        
        if (insertError) throw insertError;
        
        signupMessage.textContent = 'အကောင့်ဖွင့်ခြင်း အောင်မြင်ပါသည်။ အကောင့်ဝင်ရောက်နိုင်ပါပြီ။';
        signupMessage.className = 'auth-message success';
        
        // Switch to login after short delay
        setTimeout(() => {
            document.getElementById('signup-box').classList.add('hidden');
            document.getElementById('login-box').classList.remove('hidden');
            document.getElementById('login-email').value = email;
        }, 2000);
        
    } catch (error) {
        console.error('Signup error:', error.message);
        signupMessage.textContent = 'အကောင့်ဖွင့်ခြင်း မအောင်မြင်ပါ။ နောက်မှ ထပ်စမ်းကြည့်ပါ။';
        signupMessage.className = 'auth-message error';
    }
}

// Logout function
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Clear user data and show login
        currentUser = { user_id: null, balance: 0, passport_status: 'pending', phone: null, email: null };
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('login-box').classList.remove('hidden');
        document.getElementById('signup-box').classList.add('hidden');
        
        // Clear form fields
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('signup-email').value = '';
        document.getElementById('signup-password').value = '';
        document.getElementById('confirm-password').value = '';
        
        // Show wallet section
        showSection('wallet');
        
    } catch (error) {
        console.error('Logout error:', error.message);
        alert('အကောင့်ထွက်ရာတွင် အမှားရှိနေပါသည်။ နောက်မှ ထပ်စမ်းကြည့်ပါ။');
    }
}

// Generate a unique 6-digit ID
function generateUniqueId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Retry operation with exponential backoff
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            console.warn(`Retry ${i + 1}/${maxRetries} failed: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Initialize user
async function initializeUser(email) {
    try {
        // Get user data from database
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        
        if (error) throw error;
        
        if (user) {
            currentUser = user;
            
            // Update UI with user data
            document.getElementById('id-badge').textContent = `ID: ${user.user_id}`;
            document.getElementById('mi-id').textContent = user.user_id;
            document.getElementById('balance').textContent = `${user.balance} Ks`;
            
            // Update passport status
            updateStatus(user.passport_status);
            
            // Show profile section if passport is approved
            if (user.passport_status === 'approved') {
                document.getElementById('profile-section').classList.remove('hidden');
                
                // Load profile image if exists
                if (user.profile_image) {
                    document.getElementById('current-profile').src = user.profile_image;
                }
            }
            
            // Check transfer settings
            await checkTransferSettings();
            
            // Load transaction history
            loadHistory();
            
            // Set up real-time subscriptions
            setupRealtimeSubscriptions(user.user_id);
        } else {
            console.error('User not found in database');
            document.getElementById('auth-container').style.display = 'flex';
        }
    } catch (error) {
        console.error('Initialization Error:', error.message);
        alert(`အကောင့်စတင်ရာတွင် အမှားရှိနေပါသည်: ${error.message}`);
        document.getElementById('auth-container').style.display = 'flex';
    }
}

// Check transfer settings
async function checkTransferSettings() {
    try {
        const { data, error } = await supabase.from("settings").select("allow_transfers").single();
        
        if (!error && data) {
            allowTransfers = data.allow_transfers;
        } else {
            allowTransfers = false;
        }
    } catch (error) {
        console.error("Check Transfer Settings Error:", error.message);
        allowTransfers = false;
    }
}

// Set up realtime subscriptions
function setupRealtimeSubscriptions(userId) {
    // Users channel
    supabase
        .channel("users-channel")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "users", filter: `user_id=eq.${userId}` },
            (payload) => {
                currentUser = { ...currentUser, ...payload.new };
                document.getElementById('balance').textContent = `${currentUser.balance} Ks`;
                updateStatus(currentUser.passport_status);
            },
        )
        .subscribe();
    
    // Transactions channel
    supabase
        .channel("transactions-channel")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, async (payload) => {
            const transaction = payload.new;
            if (transaction.to_phone === currentUser.phone) {
                // Show notification for received money
                showReceivedNotification(transaction.amount, transaction.from_phone);
                
                // Play received sound
                document.getElementById('transfer-received-sound').play().catch(err => console.error('Received sound error:', err));
                
                // Reload history
                loadHistory();
            }
        })
        .subscribe();
    
    // Settings channel
    supabase
        .channel("settings-channel")
        .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, (payload) => {
            allowTransfers = payload.new.allow_transfers;
        })
        .subscribe();
}

function showSection(sectionId) {
    ['wallet', 'host', 'mi', 'game'].forEach(id => {
        document.getElementById(id).classList.toggle('active', id === sectionId);
        document.getElementById(`${id}-btn`).classList.toggle('active', id === sectionId);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openTelegram() {
    window.open('https://t.me/OPPERN', '_blank');
}

function showPhoneInput() {
    if (currentUser.passport_status !== 'approved') {
        alert('ငွေလွှဲရန် မှတ်ပုံတင်အတည်ပြုရန်လိုအပ်ပါသည်။');
        return;
    }
    if (!allowTransfers) {
        alert('ငွေလွှဲခြင်းစနစ်ကို ယာယီပိတ်ထားပါသည်။');
        return;
    }
    document.getElementById('transfer-phone-section').classList.remove('hidden');
    document.getElementById('transfer-details').classList.add('hidden');
    document.getElementById('pin-overlay').style.display = 'none';
}

async function checkPhone() {
    try {
        const phone = document.getElementById('transfer-phone').value;
        const receiverName = document.getElementById('receiver-name');
        const receiverProfile = document.getElementById('receiver-profile');
        const nextBtn = document.getElementById('next-btn');
        
        receiverName.textContent = '';
        receiverProfile.classList.add('hidden');
        nextBtn.disabled = true;
        
        if (phone.match(/^09\d{9}$/)) {
            if (phone === currentUser.phone) {
                receiverName.className = 'account-status not-found';
                receiverName.textContent = 'သင့်ကိုယ်ပိုင်ဖုန်းနံပါတ်သို့ ငွေလွှဲ၍မရပါ။';
                return;
            }

            const { data: receiver, error } = await supabase
                .from('users')
                .select('user_id, phone, passport_status, profile_image')
                .eq('phone', phone)
                .single();
                
            if (error && error.code !== 'PGRST116') throw error;
            
            if (receiver && receiver.passport_status === 'approved') {
                receiverName.className = 'account-status found';
                receiverName.textContent = `အကောင့်တွေ့ရှိပါသည်: ${receiver.phone} (ID: ${receiver.user_id})`;
                
                // Show receiver profile if available
                if (receiver.profile_image) {
                    document.getElementById('receiver-image').src = receiver.profile_image;
                } else {
                    document.getElementById('receiver-image').src = logoUrl;
                }
                
                document.getElementById('receiver-phone').textContent = receiver.phone;
                receiverProfile.classList.remove('hidden');
                
                nextBtn.disabled = false;
                receiverData = receiver;
            } else {
                receiverName.className = 'account-status not-found';
                receiverName.textContent = 'အကောင့်မတွေ့ရှိပါ သို့မဟုတ် မှတ်ပုံတင်အတည်ပြုမထားပါ။';
            }
        }
    } catch (error) {
        console.error('Check Phone Error:', error.message);
        document.getElementById('receiver-name').textContent = 'အမှားရှိနေပါသည်။';
    }
}

function showTransferDetails() {
    if (!receiverData) return;
    document.getElementById('transfer-phone-section').classList.add('hidden');
    document.getElementById('transfer-details').classList.remove('hidden');
    document.getElementById('transfer-receiver').textContent = `${receiverData.phone} (ID: ${receiverData.user_id})`;
}

function showPinOverlay() {
    const amount = parseInt(document.getElementById('transfer-amount').value);
    if (!amount || amount <= 0 || amount > 1000000) {
        document.getElementById('transfer-error').textContent = 'ငွေပမာဏမှားယွင်းနေပါသည်။ အများဆုံး 1,000,000 Ks ဖြစ်ရပါမည်။';
        document.getElementById('transfer-error').classList.remove('hidden');
        return;
    }
    document.getElementById('transfer-details').classList.add('hidden');
    document.getElementById('pin-overlay').style.display = 'flex';
    const pinBoxes = document.querySelectorAll('.pin-box');
    pinBoxes.forEach(box => {
        box.value = '';
        box.classList.remove('filled');
    });
    pinBoxes[0].focus();
    document.getElementById('pin-error').classList.add('hidden');
}

function closePinOverlay() {
    document.getElementById('pin-overlay').style.display = 'none';
    document.getElementById('transfer-details').classList.remove('hidden');
}

function handlePinInput(current, index) {
    const pinBoxes = document.querySelectorAll('.pin-box');
    if (current.value.length === 1) {
        current.classList.add('filled');
        if (index < 5) {
            pinBoxes[index + 1].focus();
        } else {
            pinBoxes[index].blur();
        }
    } else {
        current.classList.remove('filled');
    }
}

async function downloadReceipt() {
    try {
        const ticketContent = document.getElementById('ticket-content');
        const canvas = await html2canvas(ticketContent, {
            scale: 4,
            useCORS: true,
            backgroundColor: '#FFFFFF',
            logging: false,
            imageTimeout: 15000
        });
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `OPPER${currentTransactionId}.png`;
        link.click();
    } catch (error) {
        console.error('Download Receipt Error:', error.message);
        alert(`ပြေစာဒေါင်းလုဒ်ဆွဲရာတွင် အမှားရှိနေပါသည်: ${error.message}`);
    }
}

async function printReceipt() {
    try {
        window.print();
    } catch (error) {
        console.error('Print Receipt Error:', error.message);
        alert(`ပြေစာပရင့်ထုတ်ရာတွင် အမှားရှိနေပါသည်: ${error.message}`);
    }
}

async function submitTransfer() {
    try {
        if (!allowTransfers) {
            document.getElementById('pin-error').textContent = 'ငွေလွှဲခြင်းစနစ်ကို ယာယီပိတ်ထားပါသည်။';
            document.getElementById('pin-error').classList.remove('hidden');
            return;
        }

        const pin = Array.from(document.querySelectorAll('.pin-box')).map(box => box.value).join('');
        const phone = receiverData.phone;
        const amount = parseInt(document.getElementById('transfer-amount').value);
        const note = document.getElementById('transfer-note').value;

        if (pin.length !== 6) {
            document.getElementById('pin-error').textContent = 'PIN သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။';
            document.getElementById('pin-error').classList.remove('hidden');
            return;
        }

        const animation = document.createElement('div');
        animation.className = 'transfer-animation';
        animation.textContent = 'ငွေလွှဲနေပါသည်...';
        document.body.appendChild(animation);

        const { data: sender, error: senderError } = await supabase
            .from('users')
            .select('*')
            .eq('user_id', currentUser.user_id)
            .eq('payment_pin', pin)
            .single();
            
        if (senderError) throw new Error(`Sender Fetch Error: ${senderError.message}`);
        
        const { data: receiver, error: receiverError } = await supabase
            .from('users')
            .select('*')
            .eq('phone', phone)
            .single();
            
        if (receiverError) throw new Error(`Receiver Fetch Error: ${receiverError.message}`);

        if (!sender || !receiver || sender.balance < amount || receiver.passport_status !== 'approved') {
            document.getElementById('pin-error').textContent = !sender ? 'PIN မှားယွင်းနေပါသည်။' : !receiver ? 'လက်ခံမည့်သူ၏အကောင့်ကို ရှာမတွေ့ပါ။' : sender.balance < amount ? 'လက်ကျန်ငွေ မလုံလောက်ပါ။' : 'လက်ခံမည့်သူ၏ မှတ်ပုံတင်အတည်ပြုမထားပါ။';
            document.getElementById('pin-error').classList.remove('hidden');
            animation.remove();
            return;
        }

        const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Yangon' });
        
        // Generate transaction ID
        const transactionId = generateTransactionId();

        await retryOperation(async () => {
            const { error: updateSenderError } = await supabase
                .from('users')
                .update({ balance: sender.balance - amount })
                .eq('user_id', sender.user_id);
            if (updateSenderError) throw new Error(`Update Sender Error: ${updateSenderError.message}`);
        });

        await retryOperation(async () => {
            const { error: updateReceiverError } = await supabase
                .from('users')
                .update({ balance: receiver.balance + amount })
                .eq('user_id', receiver.user_id);
            if (updateReceiverError) throw new Error(`Update Receiver Error: ${updateReceiverError.message}`);
        });

        await retryOperation(async () => {
            const { error: insertError } = await supabase
                .from('transactions')
                .insert({
                    id: transactionId,
                    from_phone: sender.phone,
                    to_phone: receiver.phone,
                    amount: amount,
                    note: note || null,
                    timestamp: now,
                    created_at: new Date().toISOString()
                });
            if (insertError) throw new Error(`Insert Transaction Error: ${insertError.message}`);
        });

        currentUser.balance = sender.balance - amount;
        document.getElementById('balance').textContent = `${currentUser.balance} Ks`;
        document.getElementById('pin-overlay').style.display = 'none';

        animation.remove();

        document.getElementById('transfer-sent-sound').play().catch(err => console.error('Sent sound error:', err));

        const successAnimation = document.createElement('div');
        successAnimation.className = 'success-animation';
        successAnimation.innerHTML = `
            <img src="${logoUrl}" alt="OPPER Logo">
            ငွေလွှဲခြင်း အောင်မြင်ပါသည်
        `;
        document.body.appendChild(successAnimation);

        currentTransactionId = transactionId;

        setTimeout(async () => {
            successAnimation.remove();

            const ticketContent = document.getElementById('ticket-content');
            ticketContent.innerHTML = `
                <div class="header">
                    <img src="${logoUrl}" alt="OPPER Logo">
                    <h1>OPPER Payment</h1>
                </div>
                <div class="content">
                    <p><strong>ငွေလွှဲပြေစာ</strong></p>
                    <p><strong>လုပ်ငန်းစဉ်အမှတ်:</strong> ${transactionId}</p>
                    <p><strong>ငွေပမာဏ:</strong> ${amount} Ks</p>
                    <p><strong>ပေးပို့သူ:</strong> ${sender.phone}</p>
                    <p><strong>လက်ခံသူ:</strong> ${receiver.phone}</p>
                    <p><strong>လက်ခံသူ ID:</strong> ${receiver.user_id}</p>
                    <p><strong>မှတ်ချက်:</strong> ${note || 'မရှိပါ'}</p>
                    <p><strong>အချိန်:</strong> ${now}</p>
                    <p><strong>အခြေအနေ:</strong> ပေးပို့ပြီး</p>
                    <div class="done-ui">
                        <img src="${logoUrl}" alt="Done Icon">
                        လုပ်ငန်းစဉ်ပြီးဆုံးပါပြီ
                    </div>
                    <div class="footer">
                        Powered by OPPER Payment
                    </div>
                </div>
            `;
            document.getElementById('receipt-overlay').style.display = 'flex';
        }, 2500);

        loadHistory();
    } catch (error) {
        console.error('Transfer Error:', error.message);
        document.getElementById('pin-error').textContent = `ငွေလွှဲရာတွင် အမှားရှိနေပါသည်: ${error.message}`;
        document.getElementById('pin-error').classList.remove('hidden');
        const animation = document.querySelector('.transfer-animation');
        if (animation) animation.remove();
    }
}

// Generate transaction ID with OPPER prefix and 7 digits
function generateTransactionId() {
    const randomDigits = Math.floor(1000000 + Math.random() * 9000000).toString();
    return `OPPER${randomDigits}`;
}

async function loadHistory() {
    try {
        const month = document.getElementById('month-filter').value;
        const now = new Date();
        const year = now.getFullYear();
        const monthFilter = month === 'current' ? now.getMonth() : now.getMonth() - 1;
        const startDate = new Date(year, monthFilter, 1).toISOString();
        const endDate = new Date(year, monthFilter + 1, 0).toISOString();

        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .or(`from_phone.eq.${currentUser.phone},to_phone.eq.${currentUser.phone}`)
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('created_at', { ascending: false });
        if (error) throw error;

        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '';
        let totalIn = 0, totalOut = 0;

        (transactions || []).forEach(t => {
            const item = document.createElement('div');
            item.className = `history-item ${t.from_phone === currentUser.phone ? 'out' : 'in'}`;
            item.innerHTML = `
                ${t.from_phone === currentUser.phone ? '-' : '+'}${t.amount} Ks<br>
                ဖုန်း: ${t.from_phone === currentUser.phone ? t.to_phone : t.from_phone}<br>
                မှတ်ချက်: ${t.note || 'မရှိပါ'}<br>
                အချိန်: ${t.timestamp}<br>
                လုပ်ငန်းစဉ်အမှတ်: ${t.id}<br>
                အခြေအနေ: ${t.from_phone === currentUser.phone ? 'ပေးပို့ပြီး' : 'လက်ခံရရှိပြီး'}
                <button class="print-btn" onclick="showReceipt('${t.id}')"></button>
            `;
            historyList.appendChild(item);
            if (t.from_phone === currentUser.phone) totalOut += t.amount;
            else totalIn += t.amount;
        });

        document.getElementById('total-in').textContent = `${totalIn} Ks`;
        document.getElementById('total-out').textContent = `${totalOut} Ks`;
    } catch (error) {
        console.error('Load History Error:', error.message);
        alert(`ငွေလွှဲမှုမှတ်တမ်းများ ဖတ်ရာတွင် အမှားရှိနေပါသည်: ${error.message}`);
    }
}

async function showReceipt(transactionId) {
    try {
        const { data: transaction, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', transactionId)
            .single();
        if (error) throw error;

        currentTransactionId = transactionId;
        const toUserId = transaction.to_phone === currentUser.phone 
            ? currentUser.user_id 
            : (await supabase.from('users').select('user_id').eq('phone', transaction.to_phone).single()).data.user_id;

        const ticketContent = document.getElementById('ticket-content');
        ticketContent.innerHTML = `
            <div class="header">
                <img src="${logoUrl}" alt="OPPER Logo">
                <h1>OPPER Payment</h1>
            </div>
            <div class="content">
                <p><strong>ငွေလွှဲပြေစာ</strong></p>
                <p><strong>လုပ်ငန်းစဉ်အမှတ်:</strong> ${transaction.id}</p>
                <p><strong>ငွေပမာဏ:</strong> ${transaction.amount} Ks</p>
                <p><strong>ပေးပို့သူ:</strong> ${transaction.from_phone}</p>
                <p><strong>လက်ခံသူ:</strong> ${transaction.to_phone}</p>
                <p><strong>လက်ခံသူ ID:</strong> ${toUserId}</p>
                <p><strong>မှတ်ချက်:</strong> ${transaction.note || 'မရှိပါ'}</p>
                <p><strong>အချိန်:</strong> ${transaction.timestamp}</p>
                <p><strong>အခြေအနေ:</strong> ${transaction.from_phone === currentUser.phone ? 'ပေးပို့ပြီး' : 'လက်ခံရရှိပြီး'}</p>
                <div class="done-ui">
                    <img src="${logoUrl}" alt="Done Icon">
                    လုပ်ငန်းစဉ်ပြီးဆုံးပါပြီ
                </div>
                <div class="footer">
                    Powered by OPPER Payment
                </div>
            </div>
        `;
        
        document.getElementById('receipt-overlay').style.display = 'flex';
    } catch (error) {
        console.error('Show Receipt Error:', error.message);
        alert(`ပြေစာပြရာတွင် အမှားရှိနေပါသည်: ${error.message}`);
    }
}

function closeReceipt() {
    document.getElementById('receipt-overlay').style.display = 'none';
    showSection('wallet');
}

function updateStatus(status) {
    const walletStatus = document.getElementById('wallet-status');
    const miStatus = document.getElementById('mi-status');
    walletStatus.className = `status ${status}`;
    miStatus.className = `status ${status}`;

    if (status === 'pending') {
        walletStatus.textContent = 'မှတ်ပုံတင်အတည်ပြုရန်လိုအပ်သည်';
        miStatus.textContent = 'မှတ်ပုံတင်အတည်ပြုရန်လိုအပ်သည်';
        document.getElementById('transfer-btn').disabled = true;
    } else if (status === 'approved') {
        walletStatus.textContent = 'အတည်ပြုပြီး';
        miStatus.textContent = 'အတည်ပြုပြီး';
        document.getElementById('transfer-btn').disabled = false;
        document.getElementById('profile-section').classList.remove('hidden');
    } else {
        walletStatus.textContent = 'မှတ်ပုံတင်ငြင်းပယ်ခံရသည်';
        miStatus.textContent = 'မှတ်ပုံတင်ငြင်းပယ်ခံရသည်';
        document.getElementById('transfer-btn').disabled = true;
    }

    const passportForm = document.getElementById('passport-form');
    const passportSubmitted = document.getElementById('passport-submitted');

    if (status === 'approved' || (status === 'pending' && currentUser.submitted_at)) {
        passportForm.classList.add('hidden');
        passportSubmitted.classList.remove('hidden');
        document.getElementById('submitted-phone').textContent = currentUser.phone || 'N/A';
        document.getElementById('submitted-passport').textContent = currentUser.passport_number || 'N/A';
        document.getElementById('submitted-address').textContent = currentUser.address || 'N/A';
        document.getElementById('submitted-time').textContent = currentUser.submitted_at ? new Date(currentUser.submitted_at).toLocaleString() : 'N/A';
    } else {
        passportForm.classList.remove('hidden');
        passportSubmitted.classList.add('hidden');
    }
}

async function uploadToImgur(file) {
    try {
        const formData = new FormData();
        formData.append('image', file);
        const response = await fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: { Authorization: `Client-ID ${imgurClientId}` },
            body: formData,
            timeout: 10000
        });
        const data = await response.json();
        if (!data.success) throw new Error('Imgur Upload Failed');
        return data.data.link;
    } catch (error) {
        console.error('Imgur Upload Error:', error.message);
        throw error;
    }
}

async function submitPassport() {
    try {
        const passportNumber = document.getElementById('passport-number').value;
        const address = document.getElementById('address').value;
        const phone = document.getElementById('phone').value;
        const paymentPin = document.getElementById('payment-pin').value;
        const passportImage = document.getElementById('passport-image').files[0];
        const selfieImage = document.getElementById('selfie-image').files[0];

        if (!passportNumber || !address || !phone.match(/^09\d{9}$/) || paymentPin.length !== 6 || !passportImage || !selfieImage) {
            alert('အချက်အလက်အားလုံးကို မှန်ကန်စွာဖြည့်စွက်ပါ။ PIN သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။');
            return;
        }

        // Check if phone is already registered
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('phone, passport_status')
            .eq('phone', phone)
            .single();
            
        if (checkError && checkError.code !== 'PGRST116') throw new Error(`Check Phone Error: ${checkError.message}`);
        
        if (existingUser && existingUser.passport_status === 'approved') {
            alert('ဤဖုန်းနံပါတ်သည် မှတ်ပုံတင်ပြီး အတည်ပြုပြီးဖြစ်ပါသည်။');
            return;
        }

        const passportImageUrl = await uploadToImgur(passportImage);
        const selfieImageUrl = await uploadToImgur(selfieImage);

        await retryOperation(async () => {
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    passport_number: passportNumber,
                    address: address,
                    phone: phone,
                    payment_pin: paymentPin,
                    passport_image: passportImageUrl,
                    selfie_image: selfieImageUrl,
                    passport_status: 'pending',
                    submitted_at: new Date().toISOString()
                })
                .eq('user_id', currentUser.user_id);
            if (updateError) throw new Error(`Update User Error: ${updateError.message}`);
        });

        currentUser = {
            ...currentUser,
            passport_number: passportNumber,
            address: address,
            phone: phone,
            passport_status: 'pending',
            submitted_at: new Date().toISOString()
        };

        updateStatus('pending');
        alert('မှတ်ပုံတင်အချက်အလက်များ အောင်မြင်စွာ တင်သွင်းပြီးပါပြီ!');
    } catch (error) {
        console.error('Submit Passport Error:', error.message);
        alert(`မှတ်ပုံတင်အချက်အလက်များ တင်သွင်းရာတွင် အမှားရှိနေပါသည်: ${error.message}`);
    }
}

async function uploadProfileImage() {
    try {
        const profileImage = document.getElementById('profile-image').files[0];
        const profileMessage = document.getElementById('profile-message');
        
        if (!profileImage) {
            profileMessage.textContent = 'ဓာတ်ပုံရွေးချယ်ပါ။';
            profileMessage.className = 'error-message';
            profileMessage.classList.remove('hidden');
            return;
        }
        
        if (currentUser.passport_status !== 'approved') {
            profileMessage.textContent = 'ပရိုဖိုင်ဓာတ်ပုံတင်ရန် မှတ်ပုံတင်အတည်ပြုရန်လိုအပ်ပါသည်။';
            profileMessage.className = 'error-message';
            profileMessage.classList.remove('hidden');
            return;
        }
        
        const profileImageUrl = await uploadToImgur(profileImage);
        
        await retryOperation(async () => {
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    profile_image: profileImageUrl
                })
                .eq('user_id', currentUser.user_id);
            if (updateError) throw new Error(`Update Profile Error: ${updateError.message}`);
        });
        
        currentUser.profile_image = profileImageUrl;
        document.getElementById('current-profile').src = profileImageUrl;
        
        profileMessage.textContent = 'ပရိုဖိုင်ဓာတ်ပုံ အောင်မြင်စွာ တင်ပြီးပါပြီ!';
        profileMessage.className = 'success-message';
        profileMessage.classList.remove('hidden');
        
        setTimeout(() => {
            profileMessage.classList.add('hidden');
        }, 3000);
        
    } catch (error) {
        console.error('Upload Profile Error:', error.message);
        const profileMessage = document.getElementById('profile-message');
        profileMessage.textContent = `ပရိုဖိုင်ဓာတ်ပုံတင်ရာတွင် အမှားရှိနေပါသည်: ${error.message}`;
        profileMessage.className = 'error-message';
        profileMessage.classList.remove('hidden');
    }
}

function showReceivedNotification(amount, fromPhone) {
    const notification = document.createElement("div");
    notification.className = "receiver-message";
    notification.textContent = `${amount} Ks လက်ခံရရှိပါသည်။ (${fromPhone} မှ)`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 4000);
}

function hideDownloadBar() {
    document.getElementById('download-bar').style.display = 'none';
}

function downloadApk() {
    window.open('https://appsgeyser.io/18731061/OPPER-Payment', '_blank');
}
