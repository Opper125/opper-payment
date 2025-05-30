>
Rewrite the entire script.js file with enhanced functionality, proper mobile responsiveness, and smooth animations. Include all the necessary JavaScript for the OPPER Payment application with improved user experience, better error handling, and modern ES6+ features.

```javascript
// Enhanced OPPER Payment Application JavaScript
// Modern ES6+ Implementation with Improved Mobile Responsiveness

class OpperPayment {
    constructor() {
        this.currentUser = null;
        this.currentPage = 'dashboard';
        this.isLoading = false;
        this.transactions = [];
        this.balance = 0;
        this.isBalanceHidden = false;
        this.transferData = {};
        this.isDarkMode = false;
        this.isMobile = window.innerWidth <= 991;
        this.touchStart = null;
        this.touchEnd = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeTheme();
        this.checkMobileDevice();
        this.startIntroAnimation();
        this.initializeConsole();
        this.setupGestureControls();
        this.setupKeyboardShortcuts();
        this.logMessage('OPPER Payment System Initialized', 'info');
    }

    // Enhanced Event Listeners with Mobile Support
    setupEventListeners() {
        // Resize handler for responsive design
        window.addEventListener('resize', this.debounce(() => {
            this.handleResize();
        }, 250));

        // Auth form handlers
        this.setupAuthEventListeners();
        
        // Navigation handlers
        this.setupNavigationEventListeners();
        
        // Form handlers
        this.setupFormEventListeners();
        
        // Modal handlers
        this.setupModalEventListeners();
        
        // Mobile-specific handlers
        this.setupMobileEventListeners();
        
        // Profile dropdown handlers
        this.setupProfileDropdownHandlers();
        
        // Settings handlers
        this.setupSettingsEventListeners();
        
        // Console handlers
        this.setupConsoleEventListeners();
    }

    setupAuthEventListeners() {
        // Tab switching
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchAuthTab(e.target.dataset.tab);
            });
        });

        // Login form
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Signup form
        const signupBtn = document.getElementById('signup-btn');
        if (signupBtn) {
            signupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleSignup();
            });
        }

        // Google login/signup
        document.getElementById('google-login-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleGoogleAuth('login');
        });

        document.getElementById('google-signup-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleGoogleAuth('signup');
        });

        // Password visibility toggles
        document.querySelectorAll('.toggle-password').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                this.togglePasswordVisibility(e.target);
            });
        });

        // Enhanced input focus effects
        document.querySelectorAll('.input-with-icon input').forEach(input => {
            input.addEventListener('focus', (e) => {
                this.animateInputFocus(e.target, true);
            });
            
            input.addEventListener('blur', (e) => {
                this.animateInputFocus(e.target, false);
            });
            
            // Real-time validation
            input.addEventListener('input', (e) => {
                this.validateInput(e.target);
            });
        });
    }

    setupNavigationEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.sidebar-nav a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.currentTarget.dataset.page;
                this.navigateToPage(page);
            });
        });

        // Quick action cards
        document.querySelectorAll('.action-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                if (page) {
                    this.navigateToPage(page);
                }
            });
        });

        // Menu toggle for mobile
        const menuToggle = document.getElementById('menu-toggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        // Close sidebar
        const closeSidebar = document.getElementById('close-sidebar');
        if (closeSidebar) {
            closeSidebar.addEventListener('click', () => {
                this.closeSidebar();
            });
        }

        // Logout buttons
        document.querySelectorAll('#logout-btn, #dropdown-logout').forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleLogout();
            });
        });
    }

    setupFormEventListeners() {
        // Transfer form
        const transferBtn = document.getElementById('transfer-btn');
        if (transferBtn) {
            transferBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleTransfer();
            });
        }

        // KYC form
        const kycSubmitBtn = document.getElementById('kyc-submit-btn');
        if (kycSubmitBtn) {
            kycSubmitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleKYCSubmit();
            });
        }

        // File upload handlers
        document.querySelectorAll('input[type="file"]').forEach(input => {
            input.addEventListener('change', (e) => {
                this.handleFileUpload(e.target);
            });
        });

        // Balance actions
        document.getElementById('refresh-balance')?.addEventListener('click', () => {
            this.refreshBalance();
        });

        document.getElementById('hide-balance')?.addEventListener('click', () => {
            this.toggleBalanceVisibility();
        });

        // Filter handlers
        document.getElementById('history-type')?.addEventListener('change', (e) => {
            this.filterTransactions();
        });

        document.getElementById('history-date')?.addEventListener('change', (e) => {
            this.filterTransactions();
        });
    }

    setupModalEventListeners() {
        // Modal close buttons
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.closeModal(e.target.closest('.modal'));
            });
        });

        // Modal background click to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        });

        // Change password modal
        document.getElementById('change-password-btn')?.addEventListener('click', () => {
            this.openModal('change-password-modal');
        });

        // Change PIN modal
        document.getElementById('change-pin-btn')?.addEventListener('click', () => {
            this.openModal('change-pin-modal');
        });

        // Delete account modal
        document.getElementById('delete-account-btn')?.addEventListener('click', () => {
            this.openModal('delete-account-modal');
        });

        // Save buttons
        document.getElementById('save-password-btn')?.addEventListener('click', () => {
            this.handlePasswordChange();
        });

        document.getElementById('save-pin-btn')?.addEventListener('click', () => {
            this.handlePINChange();
        });

        document.getElementById('confirm-delete-btn')?.addEventListener('click', () => {
            this.handleAccountDeletion();
        });

        // PIN entry modal
        this.setupPINInputHandlers();
    }

    setupMobileEventListeners() {
        // Touch events for better mobile experience
        let touchStartX = 0;
        let touchStartY = 0;

        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (!touchStartX || !touchStartY) return;

            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;

            // Swipe detection
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
                if (deltaX > 0 && touchStartX < 50) {
                    // Swipe right from left edge - open sidebar
                    this.openSidebar();
                } else if (deltaX < 0 && this.isSidebarOpen()) {
                    // Swipe left when sidebar is open - close sidebar
                    this.closeSidebar();
                }
            }

            touchStartX = 0;
            touchStartY = 0;
        }, { passive: true });

        // Prevent zoom on double tap for certain elements
        document.querySelectorAll('.btn, .action-card, .transaction-item').forEach(element => {
            element.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.target.click();
            });
        });
    }

    setupProfileDropdownHandlers() {
        const profileTrigger = document.getElementById('profile-dropdown-trigger');
        const profileDropdown = document.getElementById('profile-dropdown');

        if (profileTrigger && profileDropdown) {
            profileTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleProfileDropdown();
            });

            // Position dropdown
            profileTrigger.addEventListener('click', () => {
                const rect = profileTrigger.getBoundingClientRect();
                profileDropdown.style.top = `${rect.bottom + 8}px`;
                profileDropdown.style.right = `${window.innerWidth - rect.right}px`;
            });

            // Dropdown item handlers
            document.getElementById('view-profile')?.addEventListener('click', () => {
                this.navigateToPage('settings');
                this.closeProfileDropdown();
            });

            document.getElementById('go-to-settings')?.addEventListener('click', () => {
                this.navigateToPage('settings');
                this.closeProfileDropdown();
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!profileTrigger.contains(e.target) && !profileDropdown.contains(e.target)) {
                    this.closeProfileDropdown();
                }
            });
        }
    }

    setupSettingsEventListeners() {
        // Theme selector
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const theme = e.currentTarget.dataset.theme;
                this.setTheme(theme);
            });
        });
    }

    setupConsoleEventListeners() {
        const consoleToggle = document.getElementById('console-toggle');
        if (consoleToggle) {
            consoleToggle.addEventListener('click', () => {
                this.toggleConsole();
            });
        }
    }

    setupPINInputHandlers() {
        const pinInputs = document.querySelectorAll('.pin-input');
        pinInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                const value = e.target.value;
                if (value.length === 1 && index < pinInputs.length - 1) {
                    pinInputs[index + 1].focus();
                }
                e.target.classList.toggle('filled', value.length > 0);
                this.validatePINInput();
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
                    pinInputs[index - 1].focus();
                }
            });

            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const paste = e.clipboardData.getData('text');
                if (/^\d{6}$/.test(paste)) {
                    pinInputs.forEach((inp, i) => {
                        inp.value = paste[i] || '';
                        inp.classList.toggle('filled', inp.value.length > 0);
                    });
                    this.validatePINInput();
                }
            });
        });

        document.getElementById('confirm-pin-btn')?.addEventListener('click', () => {
            this.confirmPINEntry();
        });
    }

    setupGestureControls() {
        // Add gesture support for better mobile UX
        let gestureZone = document.querySelector('.main-content');
        if (!gestureZone) return;

        let isGesturing = false;
        let gestureStartX = 0;
        let gestureStartY = 0;

        gestureZone.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isGesturing = true;
                gestureStartX = e.touches[0].clientX;
                gestureStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        gestureZone.addEventListener('touchmove', (e) => {
            if (!isGesturing) return;
            
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const deltaX = currentX - gestureStartX;
            const deltaY = currentY - gestureStartY;

            // Pull to refresh gesture
            if (deltaY > 100 && Math.abs(deltaX) < 50 && window.scrollY === 0) {
                this.handlePullToRefresh();
            }
        }, { passive: true });

        gestureZone.addEventListener('touchend', () => {
            isGesturing = false;
        }, { passive: true });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Keyboard shortcuts for better accessibility
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'k':
                        e.preventDefault();
                        this.focusSearch();
                        break;
                    case 'n':
                        e.preventDefault();
                        this.navigateToPage('transfer');
                        break;
                    case 'h':
                        e.preventDefault();
                        this.navigateToPage('history');
                        break;
                    case ',':
                        e.preventDefault();
                        this.navigateToPage('settings');
                        break;
                }
            }

            // Escape key to close modals
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    // Enhanced Mobile Responsiveness
    handleResize() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 991;

        if (wasMobile !== this.isMobile) {
            this.adjustLayoutForDevice();
        }

        // Adjust console position on mobile
        if (this.isMobile) {
            this.adjustConsoleForMobile();
        }
    }

    adjustLayoutForDevice() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.querySelector('.main-content');

        if (this.isMobile) {
            sidebar?.classList.remove('active');
            this.logMessage('Switched to mobile layout', 'info');
        } else {
            this.logMessage('Switched to desktop layout', 'info');
        }
    }

    checkMobileDevice() {
        // Enhanced mobile detection
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent);
        
        if (isMobileDevice) {
            document.body.classList.add('mobile-device');
            this.optimizeForMobile();
        }
    }

    optimizeForMobile() {
        // Add mobile-specific optimizations
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        }

        // Prevent zoom on input focus
        document.querySelectorAll('input, select, textarea').forEach(element => {
            element.addEventListener('focus', () => {
                if (this.isMobile) {
                    viewport?.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
                }
            });

            element.addEventListener('blur', () => {
                if (this.isMobile) {
                    viewport?.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
                }
            });
        });
    }

    // Enhanced Animations and Transitions
    startIntroAnimation() {
        const introAnimation = document.getElementById('intro-animation');
        if (!introAnimation) return;

        // Enhanced intro sequence
        setTimeout(() => {
            this.playIntroSound();
        }, 1000);

        setTimeout(() => {
            introAnimation.style.opacity = '0';
            introAnimation.style.transform = 'scale(1.1)';
            
            setTimeout(() => {
                introAnimation.style.display = 'none';
                this.revealMainContent();
            }, 1000);
        }, 3500);
    }

    revealMainContent() {
        const authContainer = document.getElementById('auth-container');
        if (authContainer) {
            authContainer.style.opacity = '0';
            authContainer.style.transform = 'translateY(30px)';
            authContainer.style.display = 'flex';
            
            setTimeout(() => {
                authContainer.style.transition = 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
                authContainer.style.opacity = '1';
                authContainer.style.transform = 'translateY(0)';
            }, 100);
        }
        
        this.logMessage('Main content revealed', 'success');
    }

    playIntroSound() {
        // Play a subtle notification sound if enabled
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.3);
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            // Silently fail if audio context is not available
        }
    }

    // Enhanced Authentication
    async handleLogin() {
        const email = document.getElementById('login-email')?.value;
        const password = document.getElementById('login-password')?.value;
        const rememberMe = document.getElementById('remember-me')?.checked;

        if (!this.validateLoginForm(email, password)) {
            return;
        }

        this.showLoader('Signing in...');
        this.logMessage(`Login attempt for ${email}`, 'info');

        try {
            // Simulate API call
            await this.delay(2000);
            
            // Mock successful login
            const userData = {
                email: email,
                name: this.extractNameFromEmail(email),
                id: this.generateUserId(),
                balance: Math.floor(Math.random() * 1000000),
                phone: '09123456789',
                kycStatus: 'pending'
            };

            this.currentUser = userData;
            
            if (rememberMe) {
                localStorage.setItem('opperUser', JSON.stringify(userData));
            }

            this.showSuccessMessage('login-success', 'Successfully signed in!');
            this.logMessage('Login successful', 'success');
            
            setTimeout(() => {
                this.showMainApp();
            }, 1500);

        } catch (error) {
            this.showErrorMessage('login-error', 'Login failed. Please try again.');
            this.logMessage(`Login failed: ${error.message}`, 'error');
        } finally {
            this.hideLoader();
        }
    }

    async handleSignup() {
        const email = document.getElementById('signup-email')?.value;
        const phone = document.getElementById('signup-phone')?.value;
        const password = document.getElementById('signup-password')?.value;
        const confirmPassword = document.getElementById('signup-confirm-password')?.value;
        const termsAgree = document.getElementById('terms-agree')?.checked;

        if (!this.validateSignupForm(email, phone, password, confirmPassword, termsAgree)) {
            return;
        }

        this.showLoader('Creating account...');
        this.logMessage(`Signup attempt for ${email}`, 'info');

        try {
            await this.delay(3000);
            
            const userData = {
                email: email,
                name: this.extractNameFromEmail(email),
                id: this.generateUserId(),
                balance: 0,
                phone: phone,
                kycStatus: 'pending'
            };

            this.currentUser = userData;
            localStorage.setItem('opperUser', JSON.stringify(userData));

            this.showSuccessMessage('signup-success', 'Account created successfully!');
            this.logMessage('Signup successful', 'success');
            
            setTimeout(() => {
                this.showMainApp();
            }, 1500);

        } catch (error) {
            this.showErrorMessage('signup-error', 'Signup failed. Please try again.');
            this.logMessage(`Signup failed: ${error.message}`, 'error');
        } finally {
            this.hideLoader();
        }
    }

    async handleGoogleAuth(type) {
        this.showLoader(`Connecting to Google...`);
        this.logMessage(`Google ${type} attempt`, 'info');

        try {
            await this.delay(2000);
            
            // Mock Google auth
            const userData = {
                email: 'user@gmail.com',
                name: 'Google User',
                id: this.generateUserId(),
                balance: Math.floor(Math.random() * 500000),
                phone: '09987654321',
                kycStatus: 'pending'
            };

            this.currentUser = userData;
            localStorage.setItem('opperUser', JSON.stringify(userData));

            this.showSuccessMessage(`${type}-success`, `Google ${type} successful!`);
            this.logMessage('Google auth successful', 'success');
            
            setTimeout(() => {
                this.showMainApp();
            }, 1500);

        } catch (error) {
            this.showErrorMessage(`${type}-error`, `Google ${type} failed. Please try again.`);
            this.logMessage(`Google auth failed: ${error.message}`, 'error');
        } finally {
            this.hideLoader();
        }
    }

    // Enhanced Form Validation
    validateLoginForm(email, password) {
        let isValid = true;

        if (!email || !this.isValidEmail(email)) {
            this.showFieldError('login-email', 'Please enter a valid email address');
            isValid = false;
        }

        if (!password || password.length < 6) {
            this.showFieldError('login-password', 'Password must be at least 6 characters');
            isValid = false;
        }

        return isValid;
    }

    validateSignupForm(email, phone, password, confirmPassword, termsAgree) {
        let isValid = true;

        if (!email || !this.isValidEmail(email)) {
            this.showFieldError('signup-email', 'Please enter a valid email address');
            isValid = false;
        }

        if (!phone || !this.isValidPhone(phone)) {
            this.showFieldError('signup-phone', 'Please enter a valid phone number');
            isValid = false;
        }

        if (!password || password.length < 6) {
            this.showFieldError('signup-password', 'Password must be at least 6 characters');
            isValid = false;
        }

        if (password !== confirmPassword) {
            this.showFieldError('signup-confirm-password', 'Passwords do not match');
            isValid = false;
        }

        if (!termsAgree) {
            this.showErrorMessage('signup-error', 'Please agree to the terms and conditions');
            isValid = false;
        }

        return isValid;
    }

    validateInput(input) {
        const value = input.value;
        const type = input.type;
        const id = input.id;

        // Clear previous errors
        this.clearFieldError(id);

        switch (type) {
            case 'email':
                if (value && !this.isValidEmail(value)) {
                    this.showFieldError(id, 'Invalid email format');
                }
                break;
            case 'tel':
                if (value && !this.isValidPhone(value)) {
                    this.showFieldError(id, 'Invalid phone number format');
                }
                break;
            case 'password':
                if (value && value.length < 6) {
                    this.showFieldError(id, 'Password too short');
                }
                break;
            case 'number':
                if (value && (isNaN(value) || parseFloat(value) <= 0)) {
                    this.showFieldError(id, 'Invalid amount');
                }
                break;
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isValidPhone(phone) {
        const phoneRegex = /^09\d{8,9}$/;
        return phoneRegex.test(phone.replace(/\s/g, ''));
    }

    // Enhanced Navigation
    navigateToPage(pageId) {
        if (this.currentPage === pageId) return;

        this.logMessage(`Navigating to ${pageId}`, 'info');

        // Hide current page
        const currentPageElement = document.querySelector('.page.active');
        if (currentPageElement) {
            currentPageElement.classList.remove('active');
        }

        // Show new page
        const newPageElement = document.getElementById(`${pageId}-page`);
        if (newPageElement) {
            newPageElement.classList.add('active');
        }

        // Update navigation state
        this.updateNavigationState(pageId);
        
        // Close sidebar on mobile after navigation
        if (this.isMobile) {
            this.closeSidebar();
        }

        // Load page-specific data
        this.loadPageData(pageId);
        
        this.currentPage = pageId;
    }

    updateNavigationState(pageId) {
        // Update sidebar navigation
        document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
        document.querySelector(`.sidebar-nav a[data-page="${pageId}"]`)?.parentElement.classList.add('active');
    }

    loadPageData(pageId) {
        switch (pageId) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'history':
                this.loadTransactionHistory();
                break;
            case 'kyc':
                this.loadKYCStatus();
                break;
            case 'settings':
                this.loadUserSettings();
                break;
        }
    }

    // Enhanced Data Loading
    async loadDashboardData() {
        this.updateBalance();
        this.updateUserInfo();
        this.loadRecentTransactions();
        this.updateKYCStatus();
    }

    updateBalance() {
        if (!this.currentUser) return;

        const balanceElement = document.getElementById('balance-amount');
        const userBalanceElement = document.getElementById('user-balance');
        
        const formattedBalance = this.isBalanceHidden ? 
            '••••••••' : 
            this.formatCurrency(this.currentUser.balance);

        if (balanceElement) {
            this.animateValue(balanceElement, 0, this.currentUser.balance, 2000, !this.isBalanceHidden);
        }

        if (userBalanceElement) {
            userBalanceElement.textContent = `လက်ကျန်ငွေ: ${formattedBalance}`;
        }
    }

    updateUserInfo() {
        if (!this.currentUser) return;

        const userInitial = this.currentUser.name.charAt(0).toUpperCase();
        const userName = this.currentUser.name;
        const userId = this.currentUser.id;

        // Update all user info elements
        document.querySelectorAll('#user-initial, #user-initial-sidebar').forEach(el => {
            el.textContent = userInitial;
        });

        document.querySelectorAll('#user-name, #user-name-sidebar, #greeting-name').forEach(el => {
            el.textContent = userName;
        });

        document.querySelectorAll('#user-id, #user-id-sidebar').forEach(el => {
            el.textContent = `ID: ${userId}`;
        });

        // Update settings form
        const settingsPhone = document.getElementById('settings-phone');
        const settingsEmail = document.getElementById('settings-email');
        
        if (settingsPhone) settingsPhone.value = this.currentUser.phone;
        if (settingsEmail) settingsEmail.value = this.currentUser.email;
    }

    loadRecentTransactions() {
        const container = document.getElementById('recent-transactions-list');
        if (!container) return;

        if (this.transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>လုပ်ဆောင်ချက်မှတ်တမ်းမရှိသေးပါ</p>
                </div>
            `;
            return;
        }

        const recentTransactions = this.transactions.slice(0, 5);
        container.innerHTML = recentTransactions.map(transaction => 
            this.createTransactionHTML(transaction)
        ).join('');
    }

    // Enhanced Transfer Functionality
    async handleTransfer() {
        const phone = document.getElementById('transfer-phone')?.value;
        const amount = parseFloat(document.getElementById('transfer-amount')?.value);
        const note = document.getElementById('transfer-note')?.value;

        if (!this.validateTransferForm(phone, amount)) {
            return;
        }

        // Check sufficient balance
        if (amount > this.currentUser.balance) {
            this.showErrorMessage('transfer-error', 'Insufficient balance');
            return;
        }

        this.transferData = { phone, amount, note };
        this.openPINModal();
    }

    validateTransferForm(phone, amount) {
        let isValid = true;

        if (!phone || !this.isValidPhone(phone)) {
            this.showFieldError('transfer-phone', 'Invalid phone number');
            isValid = false;
        }

        if (!amount || amount <= 0) {
            this.showFieldError('transfer-amount', 'Invalid amount');
            isValid = false;
        }

        if (amount < 1000) {
            this.showFieldError('transfer-amount', 'Minimum transfer amount is 1,000 Ks');
            isValid = false;
        }

        return isValid;
    }

    openPINModal() {
        this.openModal('pin-entry-modal');
        // Clear previous PIN entries
        document.querySelectorAll('.pin-input').forEach(input => {
            input.value = '';
            input.classList.remove('filled');
        });
        // Focus first PIN input
        document.querySelector('.pin-input')?.focus();
    }

    async confirmPINEntry() {
        const pin = this.collectPINValue();
        
        if (pin.length !== 6) {
            this.showErrorMessage('pin-error', 'Please enter complete PIN');
            return;
        }

        this.closeModal(document.getElementById('pin-entry-modal'));
        await this.processTransfer();
    }

    collectPINValue() {
        return Array.from(document.querySelectorAll('.pin-input'))
            .map(input => input.value)
            .join('');
    }

    async processTransfer() {
        this.showProcessingOverlay('Processing transfer...');
        this.logMessage('Processing transfer', 'info');

        try {
            // Simulate processing steps
            await this.delay(1000);
            this.updateProcessingStep(1);
            
            await this.delay(1500);
            this.updateProcessingStep(2);
            
            await this.delay(1000);
            this.updateProcessingStep(3);
            
            await this.delay(500);

            // Create transaction record
            const transaction = {
                id: this.generateTransactionId(),
                type: 'sent',
                amount: this.transferData.amount,
                recipient: this.transferData.phone,
                note: this.transferData.note,
                date: new Date(),
                status: 'completed'
            };

            this.transactions.unshift(transaction);
            this.currentUser.balance -= this.transferData.amount;
            
            // Update storage
            localStorage.setItem('opperUser', JSON.stringify(this.currentUser));
            localStorage.setItem('opperTransactions', JSON.stringify(this.transactions));

            this.hideProcessingOverlay();
            this.showReceiptModal(transaction);
            this.clearTransferForm();
            this.updateBalance();
            
            this.logMessage('Transfer completed successfully', 'success');

        } catch (error) {
            this.hideProcessingOverlay();
            this.showErrorMessage('transfer-error', 'Transfer failed. Please try again.');
            this.logMessage(`Transfer failed: ${error.message}`, 'error');
        }
    }

    showReceiptModal(transaction) {
        const modal = document.getElementById('receipt-modal');
        const container = document.getElementById('receipt-container');
        
        if (container) {
            container.innerHTML = this.generateReceiptHTML(transaction);
        }
        
        this.openModal('receipt-modal');
        
        // Setup download handler
        document.getElementById('download-receipt')?.addEventListener('click', () => {
            this.downloadReceipt();
        });
    }

    generateReceiptHTML(transaction) {
        return `
            <div class="receipt">
                <div class="receipt-logo">
                    <div class="receipt-logo-circle">
                        <div class="receipt-logo-text">OPPER</div>
                    </div>
                    <div class="receipt-logo-subtitle">Payment</div>
                </div>
                
                <div class="receipt-status">
                    <div class="receipt-status-icon ${transaction.type}">
                        <i class="fas ${transaction.type === 'sent' ? 'fa-paper-plane' : 'fa-arrow-down'}"></i>
                    </div>
                    <div class="receipt-status-text">
                        ${transaction.type === 'sent' ? 'Payment Sent' : 'Payment Received'}
                    </div>
                </div>
                
                <div class="receipt-amount">
                    <div class="receipt-amount-label">Amount</div>
                    <div class="receipt-amount-value">${this.formatCurrency(transaction.amount)}</div>
                </div>
                
                <div class="receipt-details">
                    <div class="receipt-detail-row">
                        <span class="receipt-detail-label">To:</span>
                        <span class="receipt-detail-value">${transaction.recipient}</span>
                    </div>
                    <div class="receipt-detail-row">
                        <span class="receipt-detail-label">Date:</span>
                        <span class="receipt-detail-value">${this.formatDate(transaction.date)}</span>
                    </div>
                    <div class="receipt-detail-row">
                        <span class="receipt-detail-label">Time:</span>
                        <span class="receipt-detail-value">${this.formatTime(transaction.date)}</span>
                    </div>
                    ${transaction.note ? `
                    <div class="receipt-detail-row">
                        <span class="receipt-detail-label">Note:</span>
                        <span class="receipt-detail-value">${transaction.note}</span>
                    </div>
                    ` : ''}
                    <div class="receipt-detail-row">
                        <span class="receipt-detail-label">Status:</span>
                        <span class="receipt-detail-value" style="color: #48bb78;">Completed</span>
                    </div>
                </div>
                
                <div class="receipt-transaction-id">
                    <div class="receipt-transaction-id-label">Transaction ID</div>
                    <div class="receipt-transaction-id-value">${transaction.id}</div>
                </div>
                
                <div class="receipt-footer">
                    Thank you for using OPPER Payment!<br>
                    This is a computer generated receipt.
                </div>
            </div>
        `;
    }

    async downloadReceipt() {
        try {
            const receiptElement = document.querySelector('.receipt');
            if (!receiptElement) return;

            // Use html2canvas to capture the receipt
            const canvas = await html2canvas(receiptElement, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true
            });

            // Create download link
            const link = document.createElement('a');
            link.download = `opper-receipt-${Date.now()}.png`;
            link.href = canvas.toDataURL();
            link.click();

            this.logMessage('Receipt downloaded', 'success');
        } catch (error) {
            this.logMessage('Failed to download receipt', 'error');
        }
    }

    // Enhanced UI Utilities
    showLoader(message = 'Loading...') {
        const loader = document.getElementById('loader');
        const progressText = document.querySelector('.progress-text');
        
        if (loader) {
            loader.classList.add('active');
            if (progressText) {
                progressText.textContent = message;
            }
        }
        
        this.isLoading = true;
    }

    hideLoader() {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.classList.remove('active');
        }
        this.isLoading = false;
    }

    showProcessingOverlay(message) {
        const overlay = document.getElementById('processing-overlay');
        const messageElement = document.getElementById('processing-message');
        
        if (overlay) {
            overlay.classList.add('active');
            if (messageElement) {
                messageElement.textContent = message;
            }
        }
        
        // Reset processing steps
        document.querySelectorAll('.step').forEach((step, index) => {
            step.classList.toggle('active', index === 0);
        });
    }

    hideProcessingOverlay() {
        const overlay = document.getElementById('processing-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    updateProcessingStep(stepNumber) {
        document.querySelectorAll('.step').forEach((step, index) => {
            step.classList.toggle('active', index < stepNumber);
        });
    }

    showMainApp() {
        document.getElementById('auth-container')?.classList.add('hidden');
        document.getElementById('app-container')?.classList.remove('hidden');
        
        this.loadDashboardData();
        this.logMessage('Main app loaded', 'success');
    }

    // Enhanced Modal System
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Focus management for accessibility
            const firstFocusable = modal.querySelector('input, button, select, textarea');
            firstFocusable?.focus();
        }
    }

    closeModal(modal) {
        if (typeof modal === 'string') {
            modal = document.getElementById(modal);
        }
        
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            this.closeModal(modal);
        });
    }

    // Enhanced Sidebar Controls
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const menuToggle = document.getElementById('menu-toggle');
        
        if (sidebar) {
            const isOpen = sidebar.classList.contains('active');
            if (isOpen) {
                this.closeSidebar();
            } else {
                this.openSidebar();
            }
        }
    }

    openSidebar() {
        const sidebar = document.getElementById('sidebar');
        const menuToggle = document.getElementById('menu-toggle');
        
        if (sidebar) {
            sidebar.classList.add('active');
            menuToggle?.classList.add('active');
        }
    }

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const menuToggle = document.getElementById('menu-toggle');
        
        if (sidebar) {
            sidebar.classList.remove('active');
            menuToggle?.classList.remove('active');
        }
    }

    isSidebarOpen() {
        const sidebar = document.getElementById('sidebar');
        return sidebar?.classList.contains('active') || false;
    }

    // Enhanced Theme System
    initializeTheme() {
        const savedTheme = localStorage.getItem('opperTheme') || 'dark';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('opperTheme', theme);
        
        // Update theme selector
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.toggle('active', option.dataset.theme === theme);
        });
        
        this.logMessage(`Theme changed to ${theme}`, 'info');
    }

    // Enhanced Console System
    initializeConsole() {
        this.consoleOutput = document.getElementById('console-output');
        this.consoleContainer = document.getElementById('console-container');
        this.isConsoleOpen = false;
    }

    toggleConsole() {
        this.isConsoleOpen = !this.isConsoleOpen;
        const container = document.getElementById('console-container');
        
        if (container) {
            container.classList.toggle('active', this.isConsoleOpen);
        }
    }

    logMessage(message, type = 'info') {
        if (!this.consoleOutput) return;

        const timestamp = new Date().toLocaleTimeString();
        const line = document.createElement('div');
        line.className = `console-line console-${type}`;
        line.textContent = `[${timestamp}] ${message}`;
        
        this.consoleOutput.appendChild(line);
        this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;

        // Limit console history
        const lines = this.consoleOutput.querySelectorAll('.console-line');
        if (lines.length > 100) {
            lines[0].remove();
        }
    }

    // Enhanced Utility Functions
    animateValue(element, start, end, duration, shouldAnimate = true) {
        if (!shouldAnimate) {
            element.textContent = this.isBalanceHidden ? '••••••••' : this.formatCurrency(end);
            return;
        }

        const startTime = performance.now();
        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const current = start + (end - start) * this.easeOutCubic(progress);
            element.textContent = this.formatCurrency(Math.floor(current));
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };
        
        requestAnimationFrame(update);
    }

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US').format(amount) + ' Ks';
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('en-GB').format(new Date(date));
    }

    formatTime(date) {
        return new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(new Date(date));
    }

    extractNameFromEmail(email) {
        return email.split('@')[0].replace(/[^a-zA-Z]/g, ' ').trim() || 'User';
    }

    generateUserId() {
        return 'OP' + Math.random().toString(36).substr(2, 8).toUpperCase();
    }

    generateTransactionId() {
        return 'TX' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    showSuccessMessage(elementId, message) {
        this.showMessage(elementId, message, 'success');
    }

    showErrorMessage(elementId, message) {
        this.showMessage(elementId, message, 'error');
    }

    showMessage(elementId, message, type) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.className = `auth-message ${type}`;
            element.style.display = 'block';
            
            setTimeout(() => {
                element.style.display = 'none';
            }, 5000);
        }
    }

    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.style.borderColor = '#f56565';
            field.setAttribute('data-error', message);
            
            // Add error tooltip
            let errorTooltip = field.parentNode.querySelector('.error-tooltip');
            if (!errorTooltip) {
                errorTooltip = document.createElement('div');
                errorTooltip.className = 'error-tooltip';
                field.parentNode.appendChild(errorTooltip);
            }
            errorTooltip.textContent = message;
            errorTooltip.style.display = 'block';
        }
    }

    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.style.borderColor = '';
            field.removeAttribute('data-error');
            
            const errorTooltip = field.parentNode.querySelector('.error-tooltip');
            if (errorTooltip) {
                errorTooltip.style.display = 'none';
            }
        }
    }

    // Add more enhanced methods for complete functionality
    togglePasswordVisibility(toggleButton) {
        const input = toggleButton.parentNode.querySelector('input');
        if (input) {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            toggleButton.className = `fas ${isPassword ? 'fa-eye' : 'fa-eye-slash'} toggle-password`;
        }
    }

    animateInputFocus(input, isFocused) {
        const icon = input.parentNode.querySelector('i:not(.toggle-password)');
        const focusLine = input.parentNode.querySelector('.input-focus-line');
        
        if (isFocused) {
            input.parentNode.style.transform = 'translateY(-2px)';
            input.style.boxShadow = '0 0 0 3px var(--primary-glow)';
            if (icon) icon.style.color = 'var(--primary-solid)';
        } else {
            input.parentNode.style.transform = '';
            input.style.boxShadow = '';
            if (icon) icon.style.color = '';
        }
    }

    switchAuthTab(tabType) {
        // Hide all forms
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        
        // Remove active class from all tabs
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Show selected form and activate tab
        document.getElementById(`${tabType}-form`)?.classList.add('active');
        document.querySelector(`[data-tab="${tabType}"]`)?.classList.add('active');
        
        // Move tab indicator
        const indicator = document.querySelector('.tab-indicator');
        if (indicator) {
            indicator.style.transform = tabType === 'signup' ? 'translateX(100%)' : 'translateX(0)';
        }
    }

    toggleBalanceVisibility() {
        this.isBalanceHidden = !this.isBalanceHidden;
        const balanceElement = document.getElementById('balance-amount');
        const hideButton = document.getElementById('hide-balance');
        
        if (balanceElement) {
            balanceElement.classList.toggle('hidden-balance', this.isBalanceHidden);
            balanceElement.textContent = this.isBalanceHidden ? 
                '••••••••' : 
                this.formatCurrency(this.currentUser.balance);
        }
        
        if (hideButton) {
            const icon = hideButton.querySelector('i');
            icon.className = this.isBalanceHidden ? 'fas fa-eye' : 'fas fa-eye-slash';
        }
    }

    async refreshBalance() {
        const refreshButton = document.getElementById('refresh-balance');
        const icon = refreshButton?.querySelector('i');
        
        if (icon) {
            icon.style.animation = 'ring-spin 1s linear infinite';
        }
        
        await this.delay(1000);
        
        // Simulate balance update
        this.currentUser.balance += Math.floor(Math.random() * 10000);
        this.updateBalance();
        
        if (icon) {
            icon.style.animation = '';
        }
        
        this.logMessage('Balance refreshed', 'success');
    }

    toggleProfileDropdown() {
        const dropdown = document.getElementById('profile-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('active');
        }
    }

    closeProfileDropdown() {
        const dropdown = document.getElementById('profile-dropdown');
        if (dropdown) {
            dropdown.classList.remove('active');
        }
    }

    handleLogout() {
        localStorage.removeItem('opperUser');
        localStorage.removeItem('opperTransactions');
        this.currentUser = null;
        this.transactions = [];
        
        document.getElementById('app-container')?.classList.add('hidden');
        document.getElementById('auth-container')?.classList.remove('hidden');
        
        this.logMessage('User logged out', 'info');
    }

    clearTransferForm() {
        document.getElementById('transfer-phone').value = '';
        document.getElementById('transfer-amount').value = '';
        document.getElementById('transfer-note').value = '';
    }

    validatePINInput() {
        const inputs = document.querySelectorAll('.pin-input');
        const confirmBtn = document.getElementById('confirm-pin-btn');
        const allFilled = Array.from(inputs).every(input => input.value.length === 1);
        
        if (confirmBtn) {
            confirmBtn.disabled = !allFilled;
            confirmBtn.style.opacity = allFilled ? '1' : '0.5';
        }
    }

    loadTransactionHistory() {
        const container = document.getElementById('history-transactions-list');
        if (!container) return;

        if (this.transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>လုပ်ဆောင်ချက်မှတ်တမ်းမရှိသေးပါ</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.transactions.map(transaction => 
            this.createTransactionHTML(transaction)
        ).join('');
    }

    createTransactionHTML(transaction) {
        return `
            <div class="transaction-item ${transaction.type}">
                <div class="transaction-icon">
                    <i class="fas ${transaction.type === 'sent' ? 'fa-paper-plane' : 'fa-arrow-down'}"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-title">
                        ${transaction.type === 'sent' ? 'ငွေပေးချေမှု' : 'ငွေလက်ခံမှု'}
                    </div>
                    <div class="transaction-subtitle">${transaction.recipient}</div>
                    <div class="transaction-date">${this.formatDate(transaction.date)}</div>
                </div>
                <div class="transaction-actions">
                    <div class="transaction-amount ${transaction.type === 'sent' ? 'negative' : 'positive'}">
                        ${transaction.type === 'sent' ? '-' : '+'}${this.formatCurrency(transaction.amount)}
                    </div>
                    <button class="transaction-view-btn" onclick="app.viewTransactionDetails('${transaction.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
        `;
    }

    filterTransactions() {
        const typeFilter = document.getElementById('history-type')?.value;
        const dateFilter = document.getElementById('history-date')?.value;
        
        let filteredTransactions = [...this.transactions];
        
        if (typeFilter && typeFilter !== 'all') {
            filteredTransactions = filteredTransactions.filter(t => t.type === typeFilter);
        }
        
        if (dateFilter && dateFilter !== 'all') {
            const now = new Date();
            filteredTransactions = filteredTransactions.filter(t => {
                const transactionDate = new Date(t.date);
                switch (dateFilter) {
                    case 'today':
                        return transactionDate.toDateString() === now.toDateString();
                    case 'week':
                        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
                        return transactionDate >= weekAgo;
                    case 'month':
                        return transactionDate.getMonth() === now.getMonth() && 
                               transactionDate.getFullYear() === now.getFullYear();
                    default:
                        return true;
                }
            });
        }
        
        this.renderFilteredTransactions(filteredTransactions);
    }

    renderFilteredTransactions(transactions) {
        const container = document.getElementById('history-transactions-list');
        if (!container) return;

        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>ရှာဖွေမှုနှင့်ကိုက်ညီသော မှတ်တမ်းမရှိပါ</p>
                </div>
            `;
            return;
        }

        container.innerHTML = transactions.map(transaction => 
            this.createTransactionHTML(transaction)
        ).join('');
    }

    loadKYCStatus() {
        const statusCard = document.getElementById('kyc-status-card');
        const statusIcon = statusCard?.querySelector('.kyc-status-icon');
        const statusMessage = document.getElementById('kyc-status-message');
        
        if (this.currentUser) {
            const status = this.currentUser.kycStatus || 'pending';
            
            if (statusIcon) {
                statusIcon.className = `kyc-status-icon ${status}`;
            }
            
            if (statusMessage) {
                const messages = {
                    'pending': 'စောင့်ဆိုင်းဆဲ',
                    'approved': 'အတည်ပြုပြီး',
                    'rejected': 'ငြင်းပယ်ခံရသည်'
                };
                statusMessage.textContent = messages[status];
            }
        }
    }

    async handleKYCSubmit() {
        const passport = document.getElementById('kyc-passport')?.value;
        const address = document.getElementById('kyc-address')?.value;
        const pin = document.getElementById('kyc-pin')?.value;
        const confirmPin = document.getElementById('kyc-confirm-pin')?.value;
        const passportFile = document.getElementById('passport-upload')?.files[0];
        const selfieFile = document.getElementById('selfie-upload')?.files[0];

        if (!this.validateKYCForm(passport, address, pin, confirmPin, passportFile, selfieFile)) {
            return;
        }

        this.showLoader('Submitting KYC documents...');
        
        try {
            await this.delay(3000);
            
            this.currentUser.kycStatus = 'pending';
            localStorage.setItem('opperUser', JSON.stringify(this.currentUser));
            
            this.showSuccessMessage('kyc-success', 'KYC documents submitted successfully!');
            this.loadKYCStatus();
            
            this.logMessage('KYC submission successful', 'success');
            
        } catch (error) {
            this.showErrorMessage('kyc-error', 'KYC submission failed. Please try again.');
            this.logMessage(`KYC submission failed: ${error.message}`, 'error');
        } finally {
            this.hideLoader();
        }
    }

    validateKYCForm(passport, address, pin, confirmPin, passportFile, selfieFile) {
        let isValid = true;

        if (!passport || passport.length < 6) {
            this.showFieldError('kyc-passport', 'Invalid passport number');
            isValid = false;
        }

        if (!address || address.length < 10) {
            this.showFieldError('kyc-address', 'Address too short');
            isValid = false;
        }

        if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
            this.showFieldError('kyc-pin', 'PIN must be 6 digits');
            isValid = false;
        }

        if (pin !== confirmPin) {
            this.showFieldError('kyc-confirm-pin', 'PINs do not match');
            isValid = false;
        }

        if (!passportFile) {
            this.showErrorMessage('kyc-error', 'Please upload passport photo');
            isValid = false;
        }

        if (!selfieFile) {
            this.showErrorMessage('kyc-error', 'Please upload selfie photo');
            isValid = false;
        }

        return isValid;
    }

    handleFileUpload(input) {
        const file = input.files[0];
        if (!file) return;

        const previewId = input.id.replace('-upload', '-preview');
        const preview = document.getElementById(previewId);
        const label = input.parentNode.querySelector('.file-upload-label span');
        const progress = input.parentNode.querySelector('.upload-progress');

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (preview) {
                    preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
                    preview.style.display = 'block';
                }
            };
            reader.readAsDataURL(file);
        }

        if (label) {
            label.textContent = file.name;
        }

        // Simulate upload progress
        if (progress) {
            let width = 0;
            const interval = setInterval(() => {
                width += Math.random() * 30;
                progress.style.width = Math.min(width, 100) + '%';
                
                if (width >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        progress.style.width = '0%';
                    }, 1000);
                }
            }, 200);
        }

        this.logMessage(`File uploaded: ${file.name}`, 'success');
    }

    loadUserSettings() {
        if (!this.currentUser) return;

        const settingsPhone = document.getElementById('settings-phone');
        const settingsEmail = document.getElementById('settings-email');
        
        if (settingsPhone) settingsPhone.value = this.currentUser.phone;
        if (settingsEmail) settingsEmail.value = this.currentUser.email;
    }

    async handlePasswordChange() {
        const currentPassword = document.getElementById('current-password')?.value;
        const newPassword = document.getElementById('new-password')?.value;
        const confirmPassword = document.getElementById('confirm-new-password')?.value;

        if (!this.validatePasswordChange(currentPassword, newPassword, confirmPassword)) {
            return;
        }

        this.showLoader('Changing password...');
        
        try {
            await this.delay(2000);
            
            this.showSuccessMessage('change-password-success', 'Password changed successfully!');
            this.closeModal('change-password-modal');
            
            this.logMessage('Password changed successfully', 'success');
            
        } catch (error) {
            this.showErrorMessage('change-password-error', 'Failed to change password');
            this.logMessage(`Password change failed: ${error.message}`, 'error');
        } finally {
            this.hideLoader();
        }
    }

    validatePasswordChange(current, newPass, confirm) {
        let isValid = true;

        if (!current || current.length < 6) {
            this.showFieldError('current-password', 'Invalid current password');
            isValid = false;
        }

        if (!new   'Invalid current password');
            isValid = false;
        }

        if (!newPass || newPass.length < 6) {
            this.showFieldError('new-password', 'New password too short');
            isValid = false;
        }

        if (newPass !== confirm) {
            this.showFieldError('confirm-new-password', 'Passwords do not match');
            isValid = false;
        }

        return isValid;
    }

    async handlePINChange() {
        const currentPIN = document.getElementById('current-pin')?.value;
        const newPIN = document.getElementById('new-pin')?.value;
        const confirmPIN = document.getElementById('confirm-new-pin')?.value;

        if (!this.validatePINChange(currentPIN, newPIN, confirmPIN)) {
            return;
        }

        this.showLoader('Changing PIN...');
        
        try {
            await this.delay(2000);
            
            this.showSuccessMessage('change-pin-success', 'PIN changed successfully!');
            this.closeModal('change-pin-modal');
            
            this.logMessage('PIN changed successfully', 'success');
            
        } catch (error) {
            this.showErrorMessage('change-pin-error', 'Failed to change PIN');
            this.logMessage(`PIN change failed: ${error.message}`, 'error');
        } finally {
            this.hideLoader();
        }
    }

    validatePINChange(current, newPIN, confirm) {
        let isValid = true;

        if (!current || current.length !== 6 || !/^\d{6}$/.test(current)) {
            this.showFieldError('current-pin', 'Invalid current PIN');
            isValid = false;
        }

        if (!newPIN || newPIN.length !== 6 || !/^\d{6}$/.test(newPIN)) {
            this.showFieldError('new-pin', 'PIN must be 6 digits');
            isValid = false;
        }

        if (newPIN !== confirm) {
            this.showFieldError('confirm-new-pin', 'PINs do not match');
            isValid = false;
        }

        return isValid;
    }

    async handleAccountDeletion() {
        const password = document.getElementById('delete-password')?.value;
        const confirmDelete = document.getElementById('confirm-delete')?.checked;

        if (!password || password.length < 6) {
            this.showErrorMessage('delete-account-error', 'Please enter your password');
            return;
        }

        if (!confirmDelete) {
            this.showErrorMessage('delete-account-error', 'Please confirm account deletion');
            return;
        }

        this.showLoader('Deleting account...');
        
        try {
            await this.delay(3000);
            
            localStorage.removeItem('opperUser');
            localStorage.removeItem('opperTransactions');
            
            this.logMessage('Account deleted successfully', 'warning');
            
            setTimeout(() => {
                this.handleLogout();
            }, 1000);
            
        } catch (error) {
            this.showErrorMessage('delete-account-error', 'Failed to delete account');
            this.logMessage(`Account deletion failed: ${error.message}`, 'error');
        } finally {
            this.hideLoader();
        }
    }

    viewTransactionDetails(transactionId) {
        const transaction = this.transactions.find(t => t.id === transactionId);
        if (transaction) {
            this.showReceiptModal(transaction);
        }
    }

    handlePullToRefresh() {
        if (this.currentPage === 'dashboard') {
            this.refreshBalance();
        } else if (this.currentPage === 'history') {
            this.loadTransactionHistory();
        }
    }

    focusSearch() {
        // Focus search functionality - could be implemented later
        this.logMessage('Search focused', 'info');
    }

    adjustConsoleForMobile() {
        const console = document.getElementById('console-container');
        if (console && this.isMobile) {
            console.style.width = 'calc(100vw - 20px)';
            console.style.right = '10px';
            console.style.bottom = '10px';
        }
    }

    // Initialize the application when DOM is loaded
    static initialize() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                window.app = new OpperPayment();
            });
        } else {
            window.app = new OpperPayment();
        }
    }
}

// Auto-initialize the application
OpperPayment.initialize();

// Add some global utility functions for button interactions
function addRippleEffect(event) {
    const button = event.currentTarget;
    const ripple = button.querySelector('.btn-ripple');
    
    if (ripple) {
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
    }
}

// Add ripple effect to all buttons
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('click', addRippleEffect);
    });
});

// Add touch feedback for mobile devices
if ('ontouchstart' in window) {
    document.addEventListener('touchstart', (e) => {
        if (e.target.classList.contains('btn') || e.target.closest('.btn')) {
            e.target.style.transform = 'scale(0.95)';
        }
    });

    document.addEventListener('touchend', (e) => {
        if (e.target.classList.contains('btn') || e.target.closest('.btn')) {
            setTimeout(() => {
                e.target.style.transform = '';
            }, 150);
        }
    });
}

// Service Worker Registration for PWA capabilities
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Handle online/offline status
window.addEventListener('online', () => {
    if (window.app) {
        window.app.logMessage('Connection restored', 'success');
    }
});

window.addEventListener('offline', () => {
    if (window.app) {
        window.app.logMessage('Connection lost - working offline', 'warning');
    }
});

// Prevent right-click context menu on production
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

// Prevent text selection on certain elements
document.addEventListener('selectstart', (e) => {
    if (e.target.closest('.btn, .action-card, .sidebar-nav')) {
        e.preventDefault();
    }
});

// Enhanced error handling
window.addEventListener('error', (e) => {
    if (window.app) {
        window.app.logMessage(`Error: ${e.message}`, 'error');
    }
});

window.addEventListener('unhandledrejection', (e) => {
    if (window.app) {
        window.app.logMessage(`Unhandled Promise: ${e.reason}`, 'error');
    }
});

// Auto-save form data to prevent loss
let formSaveTimeout;
document.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        clearTimeout(formSaveTimeout);
        formSaveTimeout = setTimeout(() => {
            const formData = {};
            const form = e.target.closest('form') || e.target.closest('.auth-form, .transfer-form, .kyc-form');
            if (form) {
                const inputs = form.querySelectorAll('input, textarea, select');
                inputs.forEach(input => {
                    if (input.type !== 'password' && input.type !== 'file') {
                        formData[input.id] = input.value;
                    }
                });
                sessionStorage.setItem('opperFormData', JSON.stringify(formData));
            }
        }, 1000);
    }
});

// Restore form data on page load
window.addEventListener('load', () => {
    const savedFormData = sessionStorage.getItem('opperFormData');
    if (savedFormData) {
        try {
            const formData = JSON.parse(savedFormData);
            Object.keys(formData).forEach(id => {
                const input = document.getElementById(id);
                if (input && input.type !== 'password') {
                    input.value = formData[id];
                }
            });
        } catch (e) {
            // Silently fail if data is corrupted
        }
    }
});

// Performance monitoring
if ('performance' in window) {
    window.addEventListener('load', () => {
        setTimeout(() => {
            const perfData = performance.getEntriesByType('navigation')[0];
            if (window.app && perfData) {
                window.app.logMessage(`Page loaded in ${Math.round(perfData.loadEventEnd - perfData.fetchStart)}ms`, 'info');
            }
        }, 0);
    });
}

This generation may require the following integrations: 
<AddIntegration names={["supabase"]} />

