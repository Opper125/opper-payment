// Initialize Supabase Client
const supabaseUrl = 'https://vtsczzlnhsrgnbkfyizi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, { fetch: (...args) => fetch(...args) });

// Global variables
let currentUser = null;
let allowTransfers = true;
let currentTransactionId = null;
let sessionToken = null;

// Check if user is already logged in (on page load)
function checkLoggedInStatus() {
    // Check if we have a session token in local storage
    sessionToken = localStorage.getItem('sessionToken');
    const email = localStorage.getItem('userEmail');
    
    if (sessionToken && email) {
        // Validate the session token
        validateSession(sessionToken, email);
    } else {
        // Show login screen
        showLoginScreen();
    }
}

// Validate session token
async function validateSession(token, email) {
    try {
        // Get user details using email (since we don't have a validate_session function yet)
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        
        if (error) throw new Error(`Fetch user error: ${error.message}`);
        if (!user) throw new Error('User not found');
        
        // Set current user and update UI
        currentUser = user;
        
        // Show main app interface
        hideLoginScreen();
        updateUIWithUserData();
        
        // Set up realtime subscriptions
        setupRealtimeSubscriptions(currentUser.user_id);
        
    } catch (error) {
        console.error('Session validation error:', error.message);
        showLoginScreen();
    }
}

// Register a new user
async function registerUser(email, password, phone) {
    try {
        // Check if email is available
        const { data: existingUserWithEmail, error: emailError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        
        if (emailError && emailError.code !== 'PGRST116') throw new Error(`Email check error: ${emailError.message}`);
        if (existingUserWithEmail) throw new Error('Email is already in use');
        
        // Check if phone is available
        if (phone) {
            const { data: existingUserWithPhone, error: phoneError } = await supabase
                .from('users')
                .select('*')
                .eq('phone', phone)
                .single();
            
            if (phoneError && phoneError.code !== 'PGRST116') throw new Error(`Phone check error: ${phoneError.message}`);
            if (existingUserWithPhone) throw new Error('Phone number is already in use');
        }
        
        // Generate a user ID
        const userId = 'USR' + Date.now() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        
        // In a real app, we would hash the password here
        // For demo purposes, we're using plaintext (NOT SECURE)
        const passwordHash = password;  // In production, use proper hashing
        
        // Insert new user
        const { data: newUser, error } = await supabase
            .from('users')
            .insert({
                email: email,
                password_hash: passwordHash,
                user_id: userId,
                phone: phone || null,
                balance: 0,
                passport_status: 'pending'
            })
            .select('*')
            .single();
        
        if (error) throw new Error(`Registration error: ${error.message}`);
        
        // Create a login session entry
        const { data: sessionData, error: sessionError } = await supabase
            .from('login_sessions')
            .insert({
                user_id: userId,
                session_token: 'SESSION' + Date.now(),
                device_info: navigator.userAgent,
                ip_address: 'client-ip', // In a real app, this would come from the server
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
            })
            .select('session_token')
            .single();
        
        if (sessionError) throw new Error(`Session creation error: ${sessionError.message}`);
        
        // Save session info to local storage
        localStorage.setItem('sessionToken', sessionData.session_token);
        localStorage.setItem('userEmail', email);
        
        // Set current user
        currentUser = newUser;
        
        // Show success message and switch to main app
        showAlert('á€¡á€€á€±á€¬á€„á€·á€ºá€–á€½á€„á€·á€ºá€á€¼á€„á€ºá€¸ á€¡á€±á€¬á€„á€ºá€™á€¼á€„á€ºá€•á€«á€žá€Šá€º', 'success');
        hideLoginScreen();
        updateUIWithUserData();
        
        // Set up realtime subscriptions
        setupRealtimeSubscriptions(currentUser.user_id);
        
        // Log activity
        await supabase.from('activity_logs').insert({
            user_id: currentUser.user_id,
            action: 'register',
            details: { email: email },
            ip_address: 'client-ip'
        });
        
    } catch (error) {
        console.error('Registration error:', error.message);
        showAlert(`á€¡á€€á€±á€¬á€„á€·á€ºá€–á€½á€„á€·á€ºá€›á€¬á€á€½á€„á€º á€¡á€™á€¾á€¬á€¸á€›á€¾á€­á€•á€«á€žá€Šá€º: ${error.message}`, 'error');
    }
}// Login user
async function loginUser(email, password) {
    try {
        // In a real app, we would hash the password here before comparing
        // For demo purposes, we're using plaintext (NOT SECURE)
        
        // Get user by email and password
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('password_hash', password)
            .single();
        
        if (error) throw new Error(`Authentication error: ${error.message}`);
        if (!user) throw new Error('Invalid email or password');
        
        // Create a login session entry
        const { data: sessionData, error: sessionError } = await supabase
            .from('login_sessions')
            .insert({
                user_id: user.user_id,
                session_token: 'SESSION' + Date.now(),
                device_info: navigator.userAgent,
                ip_address: 'client-ip', // In a real app, this would come from the server
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
            })
            .select('session_token')
            .single();
        
        if (sessionError) throw new Error(`Session creation error: ${sessionError.message}`);
        
        // Update last login time
        await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('user_id', user.user_id);
        
        // Save session info to local storage
        localStorage.setItem('sessionToken', sessionData.session_token);
        localStorage.setItem('userEmail', email);
        
        // Set current user and update UI
        currentUser = user;
        
        // Show main app interface
        hideLoginScreen();
        updateUIWithUserData();
        
        // Set up realtime subscriptions
        setupRealtimeSubscriptions(currentUser.user_id);
        
        // Show success message
        showAlert('á€¡á€€á€±á€¬á€„á€·á€ºá€á€„á€ºá€›á€±á€¬á€€á€ºá€á€¼á€„á€ºá€¸ á€¡á€±á€¬á€„á€ºá€™á€¼á€„á€ºá€•á€«á€žá€Šá€º', 'success');
        
        // Log activity
        await supabase.from('activity_logs').insert({
            user_id: currentUser.user_id,
            action: 'login',
            details: { email: email },
            ip_address: 'client-ip'
        });
        
    } catch (error) {
        console.error('Login error:', error.message);
        showAlert(`á€¡á€€á€±á€¬á€„á€·á€ºá€á€„á€ºá€›á€±á€¬á€€á€ºá€›á€¬á€á€½á€„á€º á€¡á€™á€¾á€¬á€¸á€›á€¾á€­á€•á€«á€žá€Šá€º: ${error.message}`, 'error');
    }
}

// Logout user
async function logoutUser() {
    try {
        // If we have a session token, deactivate it
        if (sessionToken) {
            await supabase
                .from('login_sessions')
                .update({ is_active: false, last_active: new Date().toISOString() })
                .eq('session_token', sessionToken);
        }
        
        // Log activity if user is logged in
        if (currentUser) {
            await supabase.from('activity_logs').insert({
                user_id: currentUser.user_id,
                action: 'logout',
                details: {},
                ip_address: 'client-ip'
            });
        }
        
        // Clear session
        sessionToken = null;
        currentUser = null;
        
        // Clear local storage
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('userEmail');
        
        // Show login screen
        showLoginScreen();
        
        // Show message
        showAlert('á€¡á€€á€±á€¬á€„á€·á€ºá€™á€¾á€‘á€½á€€á€ºá€•á€¼á€®á€¸á€•á€«á€•á€¼á€®', 'info');
    } catch (error) {
        console.error('Logout error:', error.message);
        
        // Even if there's an error, still log out locally
        sessionToken = null;
        currentUser = null;
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('userEmail');
        showLoginScreen();
    }
}

// Show login screen
function showLoginScreen() {
    // Hide all sections
    document.querySelectorAll('.container').forEach(container => {
        container.classList.remove('active');
    });
    
    // Show login container
    document.getElementById('login-container').classList.add('active');
    
    // Hide the menu bar
    document.querySelector('.menu').style.display = 'none';
    
    // Hide ID badge and app header
    document.querySelector('.logo-header').style.display = 'none';
}

// Hide login screen
function hideLoginScreen() {
    // Hide login container
    document.getElementById('login-container').classList.remove('active');
    
    // Show wallet container
    document.getElementById('wallet').classList.add('active');
    
    // Show the menu bar
    document.querySelector('.menu').style.display = 'flex';
    
    // Show ID badge and app header
    document.querySelector('.logo-header').style.display = 'flex';
}

// Update UI with user data
function updateUIWithUserData() {
    if (!currentUser) return;
    
    // Update ID badge
    document.getElementById('id-badge').textContent = `ID: ${currentUser.user_id}`;
    document.getElementById('profile-id').textContent = currentUser.user_id;
    
    // Update balance
    document.getElementById('balance').textContent = formatCurrency(currentUser.balance);
    
    // Update status
    updateStatus(currentUser.passport_status);
    
    // Update profile fields
    if (currentUser.phone) {
        document.getElementById('phone').value = currentUser.phone;
    }
    
    if (currentUser.address) {
        document.getElementById('address').value = currentUser.address;
    }
    
    // Load history
    loadHistory();
    
    // Check transfer settings
    checkTransferSettings();
}

// Create background particles
function createParticles() {
    const container = document.getElementById('particles-container');
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random size between 5px and 20px
        const size = Math.random() * 15 + 5;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        
        // Random position
        const posX = Math.random() * 100;
        particle.style.left = `${posX}%`;
        particle.style.bottom = `-${size}px`;
        
        // Random speed between 30s and 60s
        const duration = Math.random() * 30 + 30;
        particle.style.animationDuration = `${duration}s`;
        
        // Add to container
        container.appendChild(particle);
    }
}// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('my-MM').format(amount);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('my-MM', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Show message alert
function showAlert(message, type = 'success') {
    const alert = document.createElement('div');
    alert.className = `message-alert alert-${type}`;
    
    let icon = '';
    switch(type) {
        case 'success':
            icon = '<i class="fas fa-check-circle"></i>';
            break;
        case 'error':
            icon = '<i class="fas fa-exclamation-circle"></i>';
            break;
        case 'info':
            icon = '<i class="fas fa-info-circle"></i>';
            break;
        case 'warning':
            icon = '<i class="fas fa-exclamation-triangle"></i>';
            break;
    }
    
    alert.innerHTML = `${icon} ${message}`;
    document.body.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 3500);
    
    // Play notification sound if available
    const notificationSound = document.getElementById('notification-sound');
    if (notificationSound) {
        notificationSound.play().catch(e => console.log('Sound play prevented by browser'));
    }
}

// Show custom error alert
function showCustomError(message) {
    document.getElementById('error-alert-message').textContent = message;
    document.getElementById('error-alert-container').classList.remove('hidden');
}

// Close custom error alert
function closeErrorAlert() {
    document.getElementById('error-alert-container').classList.add('hidden');
}

// Set up realtime subscriptions
function setupRealtimeSubscriptions(userId) {
    // User updates
    supabase.channel('users-channel')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'users', filter: `user_id=eq.${userId}` }, 
            payload => {
                currentUser = { ...currentUser, ...payload.new };
                document.getElementById('balance').textContent = formatCurrency(currentUser.balance);
                updateStatus(currentUser.passport_status);
            }
        )
        .subscribe();
    
    // Transaction updates
    supabase.channel('transactions-channel')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'transactions' }, 
            async payload => {
                const transaction = payload.new;
                
                // Only show notification for receiving money
                if (transaction.to_user_id === currentUser.user_id && 
                    transaction.from_user_id !== currentUser.user_id) {
                    
                    showAlert(`${formatCurrency(transaction.amount)} á€€á€»á€•á€º á€œá€€á€ºá€á€¶á€›á€›á€¾á€­á€•á€«á€žá€Šá€º`, 'success');
                    
                    try {
                        document.getElementById('transfer-received-sound').play();
                    } catch (error) {
                        console.log('Sound play prevented by browser', error);
                    }
                    
                    // Reload history if history tab is active
                    if (document.getElementById('history').classList.contains('active')) {
                        await loadHistory();
                    }
                }
            }
        )
        .subscribe();
        
    // Notification updates
    supabase.channel('notifications-channel')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, 
            payload => {
                const notification = payload.new;
                showAlert(`${notification.title}: ${notification.message}`, 'info');
            }
        )
        .subscribe();
}

// Toggle between login and register forms
function toggleAuthForms() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authToggleBtn = document.getElementById('auth-toggle-btn');
    
    if (loginForm.classList.contains('hidden')) {
        // Switch to login
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        authToggleBtn.textContent = 'á€¡á€€á€±á€¬á€„á€·á€ºá€žá€…á€ºá€–á€½á€„á€·á€ºá€›á€”á€º';
    } else {
        // Switch to register
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        authToggleBtn.textContent = 'á€¡á€€á€±á€¬á€„á€·á€ºá€á€„á€ºá€›á€”á€º';
    }
}

// Handle login form submission
function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showAlert('á€¡á€®á€¸á€™á€±á€¸á€œá€ºá€”á€¾á€„á€·á€º á€…á€€á€¬á€¸á€á€¾á€€á€ºá€‘á€Šá€·á€ºá€•á€«', 'error');
        return;
    }
    
    // Login
    loginUser(email, password);
}

// Handle register form submission
function handleRegister() {
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const phone = document.getElementById('register-phone').value;
    
    if (!email || !password || !confirmPassword) {
        showAlert('á€¡á€®á€¸á€™á€±á€¸á€œá€ºá€”á€¾á€„á€·á€º á€…á€€á€¬á€¸á€á€¾á€€á€ºá€‘á€Šá€·á€ºá€•á€«', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showAlert('á€…á€€á€¬á€¸á€á€¾á€€á€ºá€”á€¾á€„á€·á€º á€¡á€á€Šá€ºá€•á€¼á€¯á€…á€€á€¬á€¸á€á€¾á€€á€ºá€á€­á€¯á€· á€™á€á€°á€•á€«', 'error');
        return;
    }
    
    if (phone && !isValidMyanmarPhone(phone)) {
        showAlert('á€™á€¾á€”á€ºá€€á€”á€ºá€žá€±á€¬ á€–á€¯á€”á€ºá€¸á€”á€¶á€•á€«á€á€ºá€‘á€Šá€·á€ºá€•á€«', 'error');
        return;
    }
    
    // Register
    registerUser(email, password, phone);
}// Check transfer settings
async function checkTransferSettings() {
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('allow_transfers')
            .single();
        
        if (error) throw new Error(`Fetch Settings Error: ${error.message}`);
        allowTransfers = data.allow_transfers;
        
        // Update transfer button state
        const transferBtn = document.getElementById('transfer-btn');
        transferBtn.disabled = !allowTransfers || currentUser.passport_status !== 'approved';
        
    } catch (error) {
        console.error('Check Transfer Settings Error:', error.message);
        allowTransfers = false;
    }
}

// Update status display
function updateStatus(status) {
    const walletStatus = document.getElementById('wallet-status');
    const profileStatus = document.getElementById('profile-status');
    const passportForm = document.getElementById('passport-form');
    const passportSubmitted = document.getElementById('passport-submitted');
    
    walletStatus.className = `status ${status}`;
    profileStatus.className = `status ${status}`;
    
    switch(status) {
        case 'pending':
            walletStatus.textContent = 'á€¡á€€á€±á€¬á€„á€·á€ºá€¡á€á€Šá€ºá€•á€¼á€¯á€›á€”á€ºá€œá€­á€¯á€¡á€•á€ºá€”á€±á€žá€Šá€º';
            profileStatus.textContent = 'á€¡á€€á€±á€¬á€„á€·á€ºá€¡á€á€Šá€ºá€•á€¼á€¯á€›á€”á€ºá€œá€­á€¯á€¡á€•á€ºá€”á€±á€žá€Šá€º';
            passportForm.classList.remove('hidden');
            passportSubmitted.classList.add('hidden');
            break;
        case 'approved':
            walletStatus.textContent = 'á€¡á€€á€±á€¬á€„á€·á€ºá€¡á€á€Šá€ºá€•á€¼á€¯á€•á€¼á€®á€¸';
            profileStatus.textContent = 'á€¡á€€á€±á€¬á€„á€·á€ºá€¡á€á€Šá€ºá€•á€¼á€¯á€•á€¼á€®á€¸';
            passportForm.classList.add('hidden');
            passportSubmitted.classList.remove('hidden');
            
            // Update submitted info
            if (currentUser.phone) {
                document.getElementById('submitted-phone').textContent = currentUser.phone;
                document.getElementById('submitted-passport').textContent = currentUser.passport_number || 'N/A';
                document.getElementById('submitted-address').textContent = currentUser.address || 'N/A';
                document.getElementById('submitted-time').textContent = formatDate(currentUser.updated_at);
            }
            break;
        case 'rejected':
            walletStatus.textContent = 'á€¡á€€á€±á€¬á€„á€·á€ºá€„á€¼á€„á€ºá€¸á€•á€šá€ºá€á€¶á€›á€•á€«á€žá€Šá€º';
            profileStatus.textContent = 'á€¡á€€á€±á€¬á€„á€·á€ºá€„á€¼á€„á€ºá€¸á€•á€šá€ºá€á€¶á€›á€•á€«á€žá€Šá€º';
            passportForm.classList.remove('hidden');
            passportSubmitted.classList.add('hidden');
            break;
    }
    
    // Update transfer button state
    const transferBtn = document.getElementById('transfer-btn');
    transferBtn.disabled = !allowTransfers || currentUser.passport_status !== 'approved';
}

// Show a specific section
function showSection(sectionId) {
    ['wallet', 'history', 'services', 'profile'].forEach(id => {
        document.getElementById(id).classList.toggle('active', id === sectionId);
        document.getElementById(`${id}-btn`).classList.toggle('active', id === sectionId);
    });
    
    // If switching to history, reload it
    if (sectionId === 'history') {
        loadHistory();
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Toggle transfer form
function toggleTransfer() {
    const transferSection = document.getElementById('transfer');
    transferSection.classList.toggle('hidden');
    
    // Clear form if closing
    if (transferSection.classList.contains('hidden')) {
        document.getElementById('transfer-phone').value = '';
        document.getElementById('transfer-amount').value = '';
        document.getElementById('transfer-note').value = '';
        document.getElementById('transfer-pin').value = '';
        document.getElementById('receiver-name').textContent = '';
        document.getElementById('transfer-error').classList.add('hidden');
    }
}

// Check phone number for receiver info
async function checkPhone() {
    const phoneInput = document.getElementById('transfer-phone');
    const receiverName = document.getElementById('receiver-name');
    
    if (phoneInput.value.length < 9) {
        receiverName.textContent = '';
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('user_id, phone, passport_status')
            .eq('phone', phoneInput.value)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            receiverName.textContent = '';
            return;
        }
        
        if (data) {
            if (data.user_id === currentUser.user_id) {
                receiverName.textContent = 'âŒ á€€á€­á€¯á€šá€·á€ºá€€á€­á€¯á€šá€ºá€€á€­á€¯ á€„á€½á€±á€œá€½á€¾á€²áá€™á€›á€•á€«';
                receiverName.style.color = 'var(--error)';
            } else if (data.passport_status !== 'approved') {
                receiverName.textContent = 'âŒ á€¡á€€á€±á€¬á€„á€·á€ºá€¡á€á€Šá€ºá€™á€•á€¼á€¯á€›á€žá€±á€¸á€žá€±á€¬ á€¡á€žá€¯á€¶á€¸á€•á€¼á€¯á€žá€°';
                receiverName.style.color = 'var(--error)';
            } else {
                receiverName.textContent = 'âœ“ á€¡á€žá€¯á€¶á€¸á€•á€¼á€¯á€žá€°á€›á€¾á€­á€•á€«á€žá€Šá€º';
                receiverName.style.color = 'var(--success)';
            }
        } else {
            receiverName.textContent = 'â“ á€¡á€žá€¯á€¶á€¸á€•á€¼á€¯á€žá€°á€›á€¾á€¬á€™á€á€½á€±á€·á€•á€«';
            receiverName.style.color = 'var(--warning)';
        }
    } catch (error) {
        console.error('Check Phone Error:', error.message);
        receiverName.textContent = '';
    }
}

// Load transaction history
async function loadHistory() {
    try {
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '<div class="loading-spinner" style="margin: 30px auto;"></div>';
        
        const monthFilter = document.getElementById('month-filter').value;
        let startDate = new Date();
        
        if (monthFilter === 'previous') {
            startDate.setMonth(startDate.getMonth() - 1);
            startDate.setDate(1);
        } else if (monthFilter === 'current') {
            startDate.setDate(1);
        } else {
            // For 'all', go back 6 months
            startDate.setMonth(startDate.getMonth() - 6);
        }
        
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .or(`from_user_id.eq.${currentUser.user_id},to_user_id.eq.${currentUser.user_id}`)
            .order('created_at', { ascending: false });
        
        if (error) throw new Error(`Fetch Transactions Error: ${error.message}`);
        
        // Calculate totals
        let totalIn = 0;
        let totalOut = 0;
        
        historyList.innerHTML = '';
        
        if (!transactions || transactions.length === 0) {
            historyList.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--gray-light);">
                <i class="fas fa-history" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                <p>á€™á€¾á€á€ºá€á€™á€ºá€¸á€™á€»á€¬á€¸á€™á€›á€¾á€­á€žá€±á€¸á€•á€«</p>
            </div>`;
            
            document.getElementById('total-in').textContent = `0 á€€á€»á€•á€º`;
            document.getElementById('total-out').textContent = `0 á€€á€»á€•á€º`;
            return;
        }
        
        transactions.forEach(transaction => {
            // Determine transaction type
            const isReceived = transaction.to_user_id === currentUser.user_id;
            
            // Update totals
            if (isReceived) {
                totalIn += transaction.amount;
            } else {
                totalOut += transaction.amount + (transaction.fee || 0);
            }
            
            const item = document.createElement('div');
            item.className = `history-item ${isReceived ? 'in' : 'out'}`;
            
            item.innerHTML = `
                <div class="transaction-header">
                    <div class="transaction-type">
                        <i class="fas fa-${isReceived ? 'arrow-down' : 'arrow-up'}"></i>
                        ${isReceived ? 'á€›á€›á€¾á€­á€á€²á€·á€žá€±á€¬' : 'á€•á€­á€¯á€·á€á€²á€·á€žá€±á€¬'}
                    </div>
                    <div class="transaction-amount ${isReceived ? 'in' : 'out'}">
                        ${isReceived ? '+' : '-'} ${formatCurrency(transaction.amount)} á€€á€»á€•á€º
                    </div>
                </div>
                
                <div class="transaction-date">
                    <i class="far fa-clock" style="margin-right: 5px;"></i> ${formatDate(transaction.created_at)}
                </div>
                
                <div class="transaction-detail">
                    <span class="transaction-detail-label">
                        ${isReceived ? 'á€œá€½á€¾á€²á€•á€±á€¸á€žá€°' : 'á€œá€€á€ºá€á€¶á€žá€°'}:
                    </span>
                    <span class="transaction-detail-value">
                        ${isReceived ? 
                            (transaction.from_phone || 'á€¡á€™á€Šá€ºá€™á€žá€­') : 
                            (transaction.to_phone || 'á€¡á€™á€Šá€ºá€™á€žá€­')}
                    </span>
                </div>
                
                <div class="transaction-detail">
                    <span class="transaction-detail-label">á€¡á€­á€¯á€„á€ºá€’á€®:</span>
                    <span class="transaction-detail-value">${transaction.transaction_id}</span>
                </div>
                
                ${transaction.fee > 0 ? `
                    <div class="transaction-detail">
                        <span class="transaction-detail-label">á€á€”á€ºá€†á€±á€¬á€„á€ºá€:</span>
                        <span class="transaction-detail-value">${formatCurrency(transaction.fee)} á€€á€»á€•á€º</span>
                    </div>
                ` : ''}
                
                ${transaction.note ? `
                    <div class="transaction-note">
                        <i class="fas fa-sticky-note" style="margin-right: 5px;"></i> ${transaction.note}
                    </div>
                ` : ''}
                
                <button class="print-btn" onclick="showReceipt('${transaction.transaction_id}', '${isReceived ? 'received' : 'sent'}')">
                    <i class="fas fa-print"></i>
                </button>
            `;
            
            historyList.appendChild(item);
        });
        
        // Update totals display
        document.getElementById('total-in').textContent = `${formatCurrency(totalIn)} á€€á€»á€•á€º`;
        document.getElementById('total-out').textContent = `${formatCurrency(totalOut)} á€€á€»á€•á€º`;
        
    } catch (error) {
        console.error('Load History Error:', error.message);
        document.getElementById('history-list').innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--error);">
                <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <p>á€™á€¾á€á€ºá€á€™á€ºá€¸á€™á€»á€¬á€¸ á€›á€šá€°á€›á€¬á€á€½á€„á€º á€¡á€™á€¾á€¬á€¸á€›á€¾á€­á€•á€«á€žá€Šá€º</p>
            </div>
        `;
    }
}// Hide download bar
function hideDownloadBar() {
    document.getElementById('download-bar').style.display = 'none';
}

// Download APK
function downloadApk() {
    alert('APK á€’á€±á€«á€„á€ºá€¸á€œá€¯á€•á€º á€…á€á€„á€ºá€†á€½á€²á€šá€°á€”á€±á€•á€«á€•á€¼á€®');
    window.open('https://example.com/kpay-plus.apk', '_blank');
}

// Preview file
function previewFile(inputId) {
    const fileInput = document.getElementById(inputId);
    const fileNameElement = document.getElementById(`${inputId}-name`);
    const previewElement = document.getElementById(`${inputId}-preview`);
    
    if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        
        // Show file name
        fileNameElement.textContent = file.name;
        fileNameElement.classList.add('show');
        
        // Show preview for image files
        const reader = new FileReader();
        reader.onload = function(e) {
            previewElement.src = e.target.result;
            previewElement.classList.add('show');
        };
        
        reader.readAsDataURL(file);
    } else {
        fileNameElement.textContent = '';
        fileNameElement.classList.remove('show');
        previewElement.src = '';
        previewElement.classList.remove('show');
    }
}

// Submit passport verification
async function submitPassport() {
    const passportNumber = document.getElementById('passport-number').value;
    const address = document.getElementById('address').value;
    const phone = document.getElementById('phone').value;
    const pin = document.getElementById('payment-pin').value;
    const passportFile = document.getElementById('passport-image').files[0];
    const selfieFile = document.getElementById('selfie-image').files[0];
    
    if (!passportNumber || !address || !phone || !pin) {
        showAlert('á€€á€»á€±á€¸á€‡á€°á€¸á€•á€¼á€¯á á€¡á€á€»á€€á€ºá€¡á€œá€€á€ºá€¡á€¬á€¸á€œá€¯á€¶á€¸ á€–á€¼á€Šá€·á€ºá€žá€½á€„á€ºá€¸á€•á€«', 'error');
        return;
    }
    
    if (phone.length < 9 || !phone.startsWith('09')) {
        showAlert('á€™á€¾á€”á€ºá€€á€”á€ºá€žá€±á€¬ á€–á€¯á€”á€ºá€¸á€”á€¶á€•á€«á€á€ºá€‘á€Šá€·á€ºá€žá€½á€„á€ºá€¸á€•á€«', 'error');
        return;
    }
    
    if (pin.length !== 6 || isNaN(pin)) {
        showAlert('á€•á€„á€ºá€”á€¶á€•á€«á€á€º á† á€œá€¯á€¶á€¸á€–á€¼á€…á€ºá€›á€•á€«á€™á€Šá€º', 'error');
        return;
    }
    
    try {
        // Show loading state
        const submitBtn = document.getElementById('submit-passport-btn');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'á€á€„á€ºá€žá€½á€„á€ºá€¸á€”á€±á€žá€Šá€º...';
        submitBtn.disabled = true;
        
        // Check if phone is already used by another account
        if (phone !== currentUser.phone) {
            const { data: existingPhoneUser, error: phoneError } = await supabase
                .from('users')
                .select('user_id')
                .eq('phone', phone)
                .neq('user_id', currentUser.user_id)
                .single();
                
            if (phoneError && phoneError.code !== 'PGRST116') throw new Error(`Phone check error: ${phoneError.message}`);
            if (existingPhoneUser) throw new Error('á€¤á€–á€¯á€”á€ºá€¸á€”á€¶á€•á€«á€á€ºá€€á€­á€¯ á€¡á€á€¼á€¬á€¸á€¡á€€á€±á€¬á€„á€·á€ºá€™á€¾ á€¡á€žá€¯á€¶á€¸á€•á€¼á€¯á€‘á€¬á€¸á€•á€¼á€®á€¸á€–á€¼á€…á€ºá€•á€«á€žá€Šá€º');
        }
        
        // File handling - convert to base64 for storage if needed
        let passportBase64 = null;
        let selfieBase64 = null;
        
        if (passportFile) {
            const reader = new FileReader();
            passportBase64 = await new Promise((resolve) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(passportFile);
            });
        }
        
        if (selfieFile) {
            const reader = new FileReader();
            selfieBase64 = await new Promise((resolve) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(selfieFile);
            });
        }
        
        // Update user with form data
        const updateData = {
            passport_number: passportNumber,
            address: address,
            phone: phone,
            payment_pin: pin,
            updated_at: new Date().toISOString()
        };
        
        // Only add images if they exist (to avoid overwriting existing ones)
        if (passportBase64) {
            updateData.passport_image = passportBase64;
        }
        
        if (selfieBase64) {
            updateData.selfie_image = selfieBase64;
        }
        
        const { error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('user_id', currentUser.user_id);
        
        if (updateError) throw new Error(`Update User Error: ${updateError.message}`);
        
        // Update local user
        currentUser = {
            ...currentUser,
            passport_number: passportNumber,
            address: address,
            phone: phone,
            payment_pin: pin,
        };
        
        if (passportBase64) currentUser.passport_image = passportBase64;
        if (selfieBase64) currentUser.selfie_image = selfieBase64;
        
        showAlert('á€¡á€á€»á€€á€ºá€¡á€œá€€á€ºá€™á€»á€¬á€¸ á€¡á€±á€¬á€„á€ºá€™á€¼á€„á€ºá€…á€½á€¬ á€á€„á€ºá€žá€½á€„á€ºá€¸á€•á€¼á€®á€¸á€•á€«á€•á€¼á€®', 'success');
        
        // Reset form
        document.getElementById('passport-number').value = '';
        document.getElementById('address').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('payment-pin').value = '';
        document.getElementById('passport-image').value = '';
        document.getElementById('selfie-image').value = '';
        
        // Reset file previews
        document.getElementById('passport-image-name').textContent = '';
        document.getElementById('passport-image-name').classList.remove('show');
        document.getElementById('passport-image-preview').src = '';
        document.getElementById('passport-image-preview').classList.remove('show');
        
        document.getElementById('selfie-image-name').textContent = '';
        document.getElementById('selfie-image-name').classList.remove('show');
        document.getElementById('selfie-image-preview').src = '';
        document.getElementById('selfie-image-preview').classList.remove('show');
        
        // Show pending message
        document.getElementById('passport-form').classList.add('hidden');
        document.getElementById('passport-submitted').classList.remove('hidden');
        
        document.getElementById('submitted-phone').textContent = phone;
        document.getElementById('submitted-passport').textContent = passportNumber;
        document.getElementById('submitted-address').textContent = address;
        document.getElementById('submitted-time').textContent = formatDate(new Date());
        
        // Log activity for admin to see
        await supabase.from('activity_logs').insert({
            user_id: currentUser.user_id,
            action: 'submit_verification',
            details: {
                passport_number: passportNumber,
                phone: phone,
                address: address
            },
            ip_address: 'client-ip'
        });
        
        // Create a notification for admin
        await supabase.from('notifications').insert({
            user_id: 'ADMIN',
            title: 'New Verification Request',
            message: `User ${currentUser.user_id} has submitted verification information`,
            read: false
        });
        
    } catch (error) {
        console.error('Submit Passport Error:', error.message);
        showCustomError(`á€¡á€á€»á€€á€ºá€¡á€œá€€á€ºá€á€„á€ºá€žá€½á€„á€ºá€¸á€›á€¬á€á€½á€„á€º á€¡á€™á€¾á€¬á€¸á€›á€¾á€­á€•á€«á€žá€Šá€º: ${error.message}`);
    } finally {
        // Reset button
        const submitBtn = document.getElementById('submit-passport-btn');
        submitBtn.textContent = 'á€á€„á€ºá€žá€½á€„á€ºá€¸á€™á€Šá€º';
        submitBtn.disabled = false;
    }
}

// Service section functions
function showService(serviceId) {
    const serviceDetails = document.getElementById('service-details');
    const serviceTitle = document.getElementById('service-title');
    const serviceContent = document.getElementById('service-content');
    
    serviceDetails.classList.remove('hidden');
    
    switch(serviceId) {
        case 'mobile-topup':
            serviceTitle.textContent = 'á€–á€¯á€”á€ºá€¸á€„á€½á€±á€–á€¼á€Šá€·á€ºá€á€”á€ºá€†á€±á€¬á€„á€ºá€™á€¾á€¯';
            serviceContent.innerHTML = `
                <div style="background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: var(--radius-md);">
                    <p style="text-align: center; margin-bottom: 20px;">á€á€”á€ºá€†á€±á€¬á€„á€ºá€™á€¾á€¯á€€á€­á€¯ á€¡á€™á€¼á€”á€ºá€†á€¯á€¶á€¸ á€•á€¼á€”á€ºá€œá€Šá€ºá€›á€›á€¾á€­á€”á€­á€¯á€„á€ºá€›á€”á€º á€†á€±á€¬á€„á€ºá€›á€½á€€á€ºá€”á€±á€•á€«á€žá€Šá€ºá‹</p>
                    <div style="text-align: center;">
                        <i class="fas fa-tools" style="font-size: 3rem; margin-bottom: 15px; color: var(--warning);"></i>
                        <p>á€šá€á€¯á€œá€€á€ºá€›á€¾á€­á€á€½á€„á€º á€•á€¼á€„á€ºá€†á€„á€ºá€”á€±á€†á€²á€–á€¼á€…á€ºá€•á€«á€žá€Šá€º</p>
                    </div>
                </div>
            `;
            break;
        case 'bill-payment':
            serviceTitle.textContent = 'á€˜á€±á€œá€ºá€•á€±á€¸á€á€»á€±á€á€¼á€„á€ºá€¸';
            serviceContent.innerHTML = `
                <div style="background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: var(--radius-md);">
                    <p style="text-align: center; margin-bottom: 20px;">á€á€”á€ºá€†á€±á€¬á€„á€ºá€™á€¾á€¯á€€á€­á€¯ á€¡á€™á€¼á€”á€ºá€†á€¯á€¶á€¸ á€•á€¼á€”á€ºá€œá€Šá€ºá€›á€›á€¾á€­á€”á€­á€¯á€„á€ºá€›á€”á€º á€†á€±á€¬á€„á€ºá€›á€½á€€á€ºá€”á€±á€•á€«á€žá€Šá€ºá‹</p>
                    <div style="text-align: center;">
                        <i class="fas fa-tools" style="font-size: 3rem; margin-bottom: 15px; color: var(--warning);"></i>
                        <p>á€šá€á€¯á€œá€€á€ºá€›á€¾á€­á€á€½á€„á€º á€•á€¼á€„á€ºá€†á€„á€ºá€”á€±á€†á€²á€–á€¼á€…á€ºá€•á€«á€žá€Šá€º</p>
                    </div>
                </div>
            `;
            break;
        case 'game-topup':
            serviceTitle.textContent = 'á€‚á€­á€™á€ºá€¸á€„á€½á€±á€–á€¼á€Šá€·á€ºá€á€¼á€„á€ºá€¸';
            serviceContent.innerHTML = `
                <div style="background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: var(--radius-md);">
                    <p style="text-align: center; margin-bottom: 20px;">á€á€”á€ºá€†á€±á€¬á€„á€ºá€™á€¾á€¯á€€á€­á€¯ á€¡á€™á€¼á€”á€ºá€†á€¯á€¶á€¸ á€•á€¼á€”á€ºá€œá€Šá€ºá€›á€›á€¾á€­á€”á€­á€¯á€„á€ºá€›á€”á€º á€†á€±á€¬á€„á€ºá€›á€½á€€á€ºá€”á€±á€•á€«á€žá€Šá€ºá‹</p>
                    <div style="text-align: center;">
                        <i class="fas fa-tools" style="font-size: 3rem; margin-bottom: 15px; color: var(--warning);"></i>
                        <p>á€šá€á€¯á€œá€€á€ºá€›á€¾á€­á€á€½á€„á€º á€•á€¼á€„á€ºá€†á€„á€ºá€”á€±á€†á€²á€–á€¼á€…á€ºá€•á€«á€žá€Šá€º</p>
                    </div>
                </div>
            `;
            break;
        case 'merchant':
            serviceTitle.textContent = 'á€•á€±á€¸á€á€»á€±á€”á€­á€¯á€„á€ºá€žá€±á€¬ á€†á€­á€¯á€„á€ºá€™á€»á€¬á€¸';
            serviceContent.innerHTML = `
                <div style="background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: var(--radius-md);">
                    <p style="text-align: center; margin-bottom: 20px;">á€á€”á€ºá€†á€±á€¬á€„á€ºá€™á€¾á€¯á€€á€­á€¯ á€¡á€™á€¼á€”á€ºá€†á€¯á€¶á€¸ á€•á€¼á€”á€ºá€œá€Šá€ºá€›á€›á€¾á€­á€”á€­á€¯á€„á€ºá€›á€”á€º á€†á€±á€¬á€„á€ºá€›á€½á€€á€ºá€”á€±á€•á€«á€žá€Šá€ºá‹</p>
                    <div style="text-align: center;">
                        <i class="fas fa-tools" style="font-size: 3rem; margin-bottom: 15px; color: var(--warning);"></i>
                        <p>á€šá€á€¯á€œá€€á€ºá€›á€¾á€­á€á€½á€„á€º á€•á€¼á€„á€ºá€†á€„á€ºá€”á€±á€†á€²á€–á€¼á€…á€ºá€•á€«á€žá€Šá€º</p>
                    </div>
                </div>
            `;
            break;
    }
}function hideServiceDetails() {
    document.getElementById('service-details').classList.add('hidden');
}

// Show topup options
function showTopupOptions() {
    showAlert('á€¤á€á€”á€ºá€†á€±á€¬á€„á€ºá€™á€¾á€¯á€€á€­á€¯ á€™á€€á€¼á€¬á€™á€®á€›á€›á€¾á€­á€”á€­á€¯á€„á€ºá€•á€«á€á€±á€¬á€·á€™á€Šá€º', 'info');
}

// Show receipt
async function showReceipt(transactionId, type) {
    try {
        const { data: transaction, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('transaction_id', transactionId)
            .single();
        
        if (error) throw new Error(`Fetch Transaction Error: ${error.message}`);
        
        const receiptDetails = document.getElementById('receipt-details');
        
        receiptDetails.innerHTML = `
            <div class="receipt-amount">
                <div class="amount-label">${type === 'sent' ? 'á€•á€±á€¸á€•á€­á€¯á€·á€„á€½á€±' : 'á€œá€€á€ºá€á€¶á€›á€›á€¾á€­á€„á€½á€±'}</div>
                <div class="amount-value">${formatCurrency(transaction.amount)} á€€á€»á€•á€º</div>
            </div>
            
            <div class="receipt-detail">
                <span class="detail-label">á€¡á€­á€¯á€„á€ºá€’á€®</span>
                <span class="detail-value">${transaction.transaction_id}</span>
            </div>
            
            <div class="receipt-detail">
                <span class="detail-label">á€›á€€á€ºá€…á€½á€²</span>
                <span class="detail-value">${formatDate(transaction.created_at)}</span>
            </div>
            
            <div class="receipt-detail">
                <span class="detail-label">${type === 'sent' ? 'á€œá€€á€ºá€á€¶á€žá€°' : 'á€•á€±á€¸á€•á€­á€¯á€·á€žá€°'}</span>
                <span class="detail-value">${type === 'sent' ? transaction.to_phone : transaction.from_phone}</span>
            </div>
            
            ${transaction.fee > 0 ? `
                <div class="receipt-detail">
                    <span class="detail-label">á€á€”á€ºá€†á€±á€¬á€„á€ºá€</span>
                    <span class="detail-value">${formatCurrency(transaction.fee)} á€€á€»á€•á€º</span>
                </div>
            ` : ''}
            
            ${transaction.note ? `
                <div class="receipt-detail">
                    <span class="detail-label">á€™á€¾á€á€ºá€á€»á€€á€º</span>
                    <span class="detail-value">${transaction.note}</span>
                </div>
            ` : ''}
        `;
        
        // Generate QR code
        const qrData = JSON.stringify({
            id: transaction.transaction_id,
            amount: transaction.amount,
            date: transaction.created_at,
            type: type,
            from: transaction.from_phone,
            to: transaction.to_phone
        });
        
        // Check if QRCode library is available
        if (typeof QRCode !== 'undefined') {
            const qrContainer = document.getElementById('receipt-qr-code').parentNode;
            qrContainer.innerHTML = '';
            
            new QRCode(qrContainer, {
                text: qrData,
                width: 120,
                height: 120,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        } else {
            document.getElementById('receipt-qr-code').src = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrData)}&size=150x150`;
        }
        
        // Show receipt
        document.getElementById('receipt-overlay').style.display = 'flex';
        
    } catch (error) {
        console.error('Show Receipt Error:', error.message);
        showAlert('á€•á€¼á€±á€…á€¬á€•á€¼á€žá€›á€¬á€á€½á€„á€º á€¡á€™á€¾á€¬á€¸á€›á€¾á€­á€•á€«á€žá€Šá€º', 'error');
    }
}

// Close receipt
function closeReceipt() {
    document.getElementById('receipt-overlay').style.display = 'none';
}

// Download receipt
function downloadReceipt() {
    try {
        const receiptContainer = document.getElementById('receipt-container');
        
        html2canvas(receiptContainer, {
            scale: 2,
            logging: false,
            useCORS: true,
            backgroundColor: '#ffffff'
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'KPAY+_Receipt.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            showAlert('á€•á€¼á€±á€…á€¬ á€’á€±á€«á€„á€ºá€¸á€œá€¯á€•á€ºá€†á€½á€²á€•á€¼á€®á€¸á€•á€«á€•á€¼á€®', 'success');
        });
    } catch (error) {
        console.error('Download Receipt Error:', error.message);
        showAlert('á€•á€¼á€±á€…á€¬á€’á€±á€«á€„á€ºá€¸á€œá€¯á€•á€ºá€†á€½á€²á€›á€¬á€á€½á€„á€º á€¡á€™á€¾á€¬á€¸á€›á€¾á€­á€•á€«á€žá€Šá€º', 'error');
    }
}

// Process transfer
async function processTransfer() {
    const recipientPhone = document.getElementById('transfer-phone').value;
    const amount = parseInt(document.getElementById('transfer-amount').value);
    const note = document.getElementById('transfer-note').value;
    const pin = document.getElementById('transfer-pin').value;
    const errorMsg = document.getElementById('transfer-error');
    
    errorMsg.classList.add('hidden');
    
    if (!recipientPhone || !amount || !pin) {
        errorMsg.textContent = 'á€€á€»á€±á€¸á€‡á€°á€¸á€•á€¼á€¯á á€œá€­á€¯á€¡á€•á€ºá€žá€±á€¬ á€¡á€á€»á€€á€ºá€¡á€œá€€á€ºá€™á€»á€¬á€¸ á€–á€¼á€Šá€·á€ºá€žá€½á€„á€ºá€¸á€•á€«';
        errorMsg.classList.remove('hidden');
        return;
    }
    
    if (recipientPhone.length < 9 || !recipientPhone.startsWith('09')) {
        errorMsg.textContent = 'á€™á€¾á€”á€ºá€€á€”á€ºá€žá€±á€¬ á€–á€¯á€”á€ºá€¸á€”á€¶á€•á€«á€á€ºá€‘á€Šá€·á€ºá€žá€½á€„á€ºá€¸á€•á€«';
        errorMsg.classList.remove('hidden');
        return;
    }
    
    if (amount < 1000 || amount > 1000000) {
        errorMsg.textContent = 'á€„á€½á€±á€•á€™á€¬á€á€žá€Šá€º á,á€á€á€ á€™á€¾ á,á€á€á€,á€á€á€ á€€á€»á€•á€ºá€¡á€á€½á€„á€ºá€¸ á€–á€¼á€…á€ºá€›á€•á€«á€™á€Šá€º';
        errorMsg.classList.remove('hidden');
        return;
    }
    
    if (pin.length !== 6 || isNaN(pin)) {
        errorMsg.textContent = 'á€•á€„á€ºá€”á€¶á€•á€«á€á€º á† á€œá€¯á€¶á€¸á€–á€¼á€…á€ºá€›á€•á€«á€™á€Šá€º';
        errorMsg.classList.remove('hidden');
        return;
    }
    
    if (pin !== currentUser.payment_pin) {
        errorMsg.textContent = 'á€•á€„á€ºá€”á€¶á€•á€«á€á€ºá€™á€¾á€¬á€¸á€šá€½á€„á€ºá€¸á€”á€±á€•á€«á€žá€Šá€º';
        errorMsg.classList.remove('hidden');
        return;
    }
    
    try {
        // Show loading animation
        const transferAnimation = document.createElement('div');
        transferAnimation.className = 'transfer-animation';
        transferAnimation.innerHTML = `
            <div>á€„á€½á€±á€œá€½á€¾á€²á€á€¼á€„á€ºá€¸á€œá€¯á€•á€ºá€„á€”á€ºá€¸á€…á€¥á€º</div>
            <div class="transfer-loading">
                <div class="loading-spinner"></div>
                <div style="margin-top: 10px;">á€á€±á€á€¹á€á€…á€±á€¬á€„á€·á€ºá€†á€­á€¯á€„á€ºá€¸á€•á€±á€¸á€•á€«...</div>
            </div>
        `;
        document.body.appendChild(transferAnimation);
        
        // Check if recipient exists and is approved
        const { data: recipient, error: recipientError } = await supabase
            .from('users')
            .select('user_id, passport_status, balance')
            .eq('phone', recipientPhone)
            .single();
        
        if (recipientError) {
            document.body.removeChild(transferAnimation);
            errorMsg.textContent = 'á€œá€€á€ºá€á€¶á€™á€Šá€·á€ºá€žá€° á€›á€¾á€¬á€™á€á€½á€±á€·á€•á€«';
            errorMsg.classList.remove('hidden');
            return;
        }
        
        if (recipient.user_id === currentUser.user_id) {
            document.body.removeChild(transferAnimation);
            errorMsg.textContent = 'á€€á€­á€¯á€šá€·á€ºá€€á€­á€¯á€šá€ºá€€á€­á€¯ á€„á€½á€±á€œá€½á€¾á€²áá€™á€›á€•á€«';
            errorMsg.classList.remove('hidden');
            return;
        }
        
        if (recipient.passport_status !== 'approved') {
            document.body.removeChild(transferAnimation);
            errorMsg.textContent = 'á€œá€€á€ºá€á€¶á€™á€Šá€·á€ºá€žá€°á á€¡á€€á€±á€¬á€„á€·á€ºá€žá€Šá€º á€¡á€á€Šá€ºá€•á€¼á€¯á€‘á€¬á€¸á€á€¼á€„á€ºá€¸á€™á€›á€¾á€­á€žá€±á€¸á€•á€«';
            errorMsg.classList.remove('hidden');
            return;
        }
        
        // Check if transfers are allowed
        if (!allowTransfers) {
            document.body.removeChild(transferAnimation);
            errorMsg.textContent = 'á€šá€á€¯á€œá€€á€ºá€›á€¾á€­á€á€½á€„á€º á€„á€½á€±á€œá€½á€¾á€²á€á€¼á€„á€ºá€¸á€á€”á€ºá€†á€±á€¬á€„á€ºá€™á€¾á€¯ á€›á€•á€ºá€†á€­á€¯á€„á€ºá€¸á€‘á€¬á€¸á€•á€«á€žá€Šá€º';
            errorMsg.classList.remove('hidden');
            return;
        }
        
        // Check if user has sufficient balance
        if (currentUser.balance < amount) {
            document.body.removeChild(transferAnimation);
            errorMsg.textContent = 'á€œá€€á€ºá€€á€»á€”á€ºá€„á€½á€± á€™á€œá€¯á€¶á€œá€±á€¬á€€á€ºá€•á€«';
            errorMsg.classList.remove('hidden');
            return;
        }
        
        // Generate transaction ID
        const transactionId = 'TXN' + Date.now() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        
        // Deduct from sender first
        const { error: deductError } = await supabase
            .from('users')
            .update({ 
                balance: currentUser.balance - amount,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', currentUser.user_id);
        
        if (deductError) {
            document.body.removeChild(transferAnimation);
            throw new Error(`Deduct Error: ${deductError.message}`);
        }
        
        // Add to recipient
        const { error: addError } = await supabase
            .from('users')
            .update({ 
                balance: recipient.balance + amount,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', recipient.user_id);
        
        if (addError) {
            // Rollback sender deduction if recipient update fails
            await supabase
                .from('users')
                .update({ 
                    balance: currentUser.balance,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', currentUser.user_id);
            
            document.body.removeChild(transferAnimation);
            throw new Error(`Add Error: ${addError.message}`);
        }
        
        // Record transaction
        const { error: transactionError } = await supabase
            .from('transactions')
            .insert({
                transaction_id: transactionId,
                from_user_id: currentUser.user_id,
                to_user_id: recipient.user_id,
                from_phone: currentUser.phone,
                to_phone: recipientPhone,
                amount: amount,
                fee: 0,
                note: note,
                created_at: new Date().toISOString()
            });
        
        if (transactionError) {
            document.body.removeChild(transferAnimation);
            throw new Error(`Transaction Error: ${transactionError.message}`);
        }
        
        // Create notification for recipient
        await supabase.from('notifications').insert({
            user_id: recipient.user_id,
            title: 'á€„á€½á€±á€œá€€á€ºá€á€¶á€›á€›á€¾á€­',
            message: `${formatCurrency(amount)} á€€á€»á€•á€º ${currentUser.phone} á€™á€¾á€›á€›á€¾á€­á€á€²á€·á€žá€Šá€º`,
            read: false
        });
        
        // Update local user
        currentUser.balance -= amount;
        
        // Show success animation
        document.body.removeChild(transferAnimation);
        
        const successAnimation = document.createElement('div');
        successAnimation.className = 'success-animation';
        successAnimation.innerHTML = `
            <div class="checkmark"></div>
            <div>á€„á€½á€±á€œá€½á€¾á€²á€•á€¼á€®á€¸á€•á€«á€•á€¼á€®</div>
            <div style="font-size: 1rem; margin-top: 5px; font-weight: normal;">${formatCurrency(amount)} á€€á€»á€•á€º</div>
        `;
        document.body.appendChild(successAnimation);
        
        // Play sound
        try {
            document.getElementById('transfer-sent-sound').play();
        } catch (error) {
            console.log('Sound play prevented by browser', error);
        }
        
        // Save transaction ID for receipt
        currentTransactionId = transactionId;
        
        // Log activity
        await supabase.from('activity_logs').insert({
            user_id: currentUser.user_id,
            action: 'money_transfer',
            details: {
                transaction_id: transactionId,
                recipient_id: recipient.user_id,
                recipient_phone: recipientPhone,
                amount: amount
            },
            ip_address: 'client-ip'
        });
        
        // Remove success animation after delay
        setTimeout(() => {
            document.body.removeChild(successAnimation);
            
            // Show receipt
            showReceipt(transactionId, 'sent');
            
            // Reset form and close
            toggleTransfer();
        }, 5000);
        
    } catch (error) {
        console.error('Transfer Error:', error.message);
        errorMsg.textContent = `á€„á€½á€±á€œá€½á€¾á€²á€›á€¬á€á€½á€„á€º á€¡á€™á€¾á€¬á€¸á€›á€¾á€­á€•á€«á€žá€Šá€º: ${error.message}`;
        errorMsg.classList.remove('hidden');
        
        // Remove any lingering animations
        const animations = document.querySelectorAll('.transfer-animation, .success-animation');
        animations.forEach(el => el.remove());
    }
}

// Check if phone number is valid
function isValidMyanmarPhone(phone) {
    return /^09\d{7,9}$/.test(phone);
}

// Initialize
window.onload = () => {
    createParticles();
    
    // Check if user is logged in
    checkLoggedInStatus();
    
    // Add event listeners
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('register-btn').addEventListener('click', handleRegister);
    document.getElementById('auth-toggle-btn').addEventListener('click', toggleAuthForms);
    document.getElementById('logout-btn').addEventListener('click', logoutUser);
    document.getElementById('submit-passport-btn').addEventListener('click', submitPassport);
    document.getElementById('confirm-transfer-btn').addEventListener('click', processTransfer);
    
    // Set timeout to hide intro container if it doesn't disappear
    setTimeout(() => {
        const introContainer = document.getElementById('intro-container');
        if (introContainer && getComputedStyle(introContainer).visibility !== 'hidden') {
            introContainer.style.display = 'none';
        }
    }, 8000);
};
