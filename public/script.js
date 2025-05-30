// Enhanced OPPER Payment Application JavaScript
// Optimized for Mobile Devices with Modern ES6+ Features

class OpperPaymentApp {
  constructor() {
    // Supabase Configuration
    this.supabaseUrl = "https://vtsczzlnhsrgnbkfyizi.supabase.co"
    this.supabaseKey =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68"
    this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseKey, {
      fetch: (...args) => fetch(...args),
    })

    // Application State
    this.currentUser = null
    this.userBalance = 0
    this.userKycStatus = "pending"
    this.transfersEnabled = true
    this.currentTheme = localStorage.getItem("theme") || "dark"
    this.transactions = []
    this.currentPage = "dashboard"
    this.isLoading = false
    this.isMobile = window.innerWidth <= 991
    this.isBalanceHidden = false
    this.transferData = {}

    // Touch and Gesture State
    this.touchStartX = 0
    this.touchStartY = 0
    this.touchEndX = 0
    this.touchEndY = 0
    this.isGesturing = false
    this.lastTap = 0

    // DOM Elements Cache
    this.elements = {}

    this.init()
  }

  async init() {
    try {
      this.cacheElements()
      this.setupEventListeners()
      this.initializeTheme()
      this.checkMobileDevice()
      this.setupMobileOptimizations()
      this.showLoader()

      await this.checkSession()
      this.initializeUI()

      setTimeout(() => this.hideLoader(), 1500)
      this.logToConsole("OPPER Payment App initialized successfully", "success")
    } catch (error) {
      this.logToConsole(`Initialization error: ${error.message}`, "error")
    }
  }

  cacheElements() {
    this.elements = {
      loader: document.getElementById("loader"),
      authContainer: document.getElementById("auth-container"),
      appContainer: document.getElementById("app-container"),
      pinEntryModal: document.getElementById("pin-entry-modal"),
      receiptModal: document.getElementById("receipt-modal"),
      processingOverlay: document.getElementById("processing-overlay"),
      sidebar: document.getElementById("sidebar"),
      menuToggle: document.getElementById("menu-toggle"),
      profileDropdown: document.getElementById("profile-dropdown"),
      balanceAmount: document.getElementById("balance-amount"),
      userBalance: document.getElementById("user-balance"),
      consoleContainer: document.getElementById("console-container"),
      consoleOutput: document.getElementById("console-output"),
    }
  }

  setupEventListeners() {
    // Window events
    window.addEventListener(
      "resize",
      this.debounce(() => this.handleResize(), 250),
    )
    window.addEventListener("orientationchange", () => {
      setTimeout(() => this.handleOrientationChange(), 100)
    })

    // Touch events for mobile gestures
    this.setupTouchEvents()

    // Keyboard shortcuts
    this.setupKeyboardShortcuts()

    // Auth events
    this.setupAuthEvents()

    // Navigation events
    this.setupNavigationEvents()

    // Form events
    this.setupFormEvents()

    // Modal events
    this.setupModalEvents()

    // Mobile-specific events
    this.setupMobileEvents()
  }

  setupTouchEvents() {
    const mainContent = document.querySelector(".main-content")
    if (!mainContent) return

    // Touch start
    mainContent.addEventListener(
      "touchstart",
      (e) => {
        this.touchStartX = e.touches[0].clientX
        this.touchStartY = e.touches[0].clientY
        this.isGesturing = true
      },
      { passive: true },
    )

    // Touch move
    mainContent.addEventListener(
      "touchmove",
      (e) => {
        if (!this.isGesturing) return

        this.touchEndX = e.touches[0].clientX
        this.touchEndY = e.touches[0].clientY

        const deltaX = this.touchEndX - this.touchStartX
        const deltaY = this.touchEndY - this.touchStartY

        // Pull to refresh
        if (deltaY > 100 && Math.abs(deltaX) < 50 && window.scrollY === 0) {
          this.handlePullToRefresh()
        }
      },
      { passive: true },
    )

    // Touch end
    mainContent.addEventListener(
      "touchend",
      (e) => {
        if (!this.isGesturing) return

        const deltaX = this.touchEndX - this.touchStartX
        const deltaY = this.touchEndY - this.touchStartY

        // Swipe detection
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
          if (deltaX > 0 && this.touchStartX < 50) {
            // Swipe right from left edge - open sidebar
            this.openSidebar()
          } else if (deltaX < 0 && this.isSidebarOpen()) {
            // Swipe left when sidebar is open - close sidebar
            this.closeSidebar()
          }
        }

        this.isGesturing = false
      },
      { passive: true },
    )

    // Double tap detection
    document.addEventListener("touchend", (e) => {
      const currentTime = new Date().getTime()
      const tapLength = currentTime - this.lastTap

      if (tapLength < 500 && tapLength > 0) {
        // Double tap detected
        this.handleDoubleTap(e)
      }

      this.lastTap = currentTime
    })
  }

  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "k":
            e.preventDefault()
            this.focusSearch()
            break
          case "n":
            e.preventDefault()
            this.navigateToPage("transfer")
            break
          case "h":
            e.preventDefault()
            this.navigateToPage("history")
            break
          case ",":
            e.preventDefault()
            this.navigateToPage("settings")
            break
        }
      }

      if (e.key === "Escape") {
        this.closeAllModals()
      }
    })
  }

  setupAuthEvents() {
    // Auth tabs
    document.querySelectorAll(".auth-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        this.switchAuthTab(tab.dataset.tab)
      })
    })

    // Login form
    const loginBtn = document.getElementById("login-btn")
    if (loginBtn) {
      loginBtn.addEventListener("click", (e) => {
        e.preventDefault()
        this.handleLogin()
      })
    }

    // Signup form
    const signupBtn = document.getElementById("signup-btn")
    if (signupBtn) {
      signupBtn.addEventListener("click", (e) => {
        e.preventDefault()
        this.handleSignup()
      })
    }

    // Google auth buttons
    document.getElementById("google-login-btn")?.addEventListener("click", (e) => {
      e.preventDefault()
      this.simulateGoogleLogin("login")
    })

    document.getElementById("google-signup-btn")?.addEventListener("click", (e) => {
      e.preventDefault()
      this.simulateGoogleLogin("signup")
    })

    // Password visibility toggles
    document.querySelectorAll(".toggle-password").forEach((toggle) => {
      toggle.addEventListener("click", () => {
        this.togglePasswordVisibility(toggle)
      })
    })

    // Input validation
    document.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", () => this.validateInput(input))
      input.addEventListener("focus", () => this.handleInputFocus(input))
      input.addEventListener("blur", () => this.handleInputBlur(input))
    })
  }

  setupNavigationEvents() {
    // Sidebar navigation
    document.querySelectorAll(".sidebar-nav a").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault()
        this.navigateToPage(link.dataset.page)
      })
    })

    // Quick action cards
    document.querySelectorAll(".action-card").forEach((card) => {
      card.addEventListener("click", () => {
        this.navigateToPage(card.dataset.page)
      })
    })

    // Mobile menu toggle
    this.elements.menuToggle?.addEventListener("click", () => {
      this.toggleSidebar()
    })

    // Close sidebar
    document.getElementById("close-sidebar")?.addEventListener("click", () => {
      this.closeSidebar()
    })

    // Profile dropdown
    const profileTrigger = document.getElementById("profile-dropdown-trigger")
    if (profileTrigger) {
      profileTrigger.addEventListener("click", (e) => {
        e.stopPropagation()
        this.toggleProfileDropdown()
      })
    }

    // Logout buttons
    document.querySelectorAll("#logout-btn, #dropdown-logout").forEach((btn) => {
      btn.addEventListener("click", () => this.logout())
    })
  }

  setupFormEvents() {
    // Transfer form
    const transferBtn = document.getElementById("transfer-btn")
    if (transferBtn) {
      transferBtn.addEventListener("click", (e) => {
        e.preventDefault()
        this.handleTransfer()
      })
    }

    // KYC form
    const kycSubmitBtn = document.getElementById("kyc-submit-btn")
    if (kycSubmitBtn) {
      kycSubmitBtn.addEventListener("click", (e) => {
        e.preventDefault()
        this.handleKYCSubmit()
      })
    }

    // Balance actions
    document.getElementById("refresh-balance")?.addEventListener("click", () => {
      this.refreshBalance()
    })

    document.getElementById("hide-balance")?.addEventListener("click", () => {
      this.toggleBalanceVisibility()
    })

    // File uploads
    document.querySelectorAll('input[type="file"]').forEach((input) => {
      input.addEventListener("change", (e) => {
        this.handleFileUpload(e.target)
      })
    })

    // PIN inputs
    this.setupPinInputs()
  }

  setupModalEvents() {
    // Modal close buttons
    document.querySelectorAll(".modal-close, .modal-cancel").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.closeModal(e.target.closest(".modal"))
      })
    })

    // Modal background click
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          this.closeModal(modal)
        }
      })
    })

    // Modal triggers
    const modalTriggers = {
      "change-password-btn": "change-password-modal",
      "change-pin-btn": "change-pin-modal",
      "delete-account-btn": "delete-account-modal",
    }

    Object.entries(modalTriggers).forEach(([triggerId, modalId]) => {
      document.getElementById(triggerId)?.addEventListener("click", () => {
        this.openModal(modalId)
      })
    })

    // Download receipt
    document.getElementById("download-receipt")?.addEventListener("click", () => {
      this.downloadReceipt()
    })
  }

  setupMobileEvents() {
    // Prevent zoom on double tap for buttons
    document.querySelectorAll(".btn, .action-card, .transaction-item").forEach((element) => {
      element.addEventListener("touchend", (e) => {
        e.preventDefault()
        element.click()
      })
    })

    // Haptic feedback for mobile
    if ("vibrate" in navigator) {
      document.querySelectorAll(".btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          navigator.vibrate(50)
        })
      })
    }

    // Console toggle
    document.getElementById("console-toggle")?.addEventListener("click", () => {
      this.toggleConsole()
    })
  }

  checkMobileDevice() {
    const userAgent = navigator.userAgent.toLowerCase()
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent)

    if (isMobileDevice) {
      document.body.classList.add("mobile-device")
      this.optimizeForMobile()
    }

    // Check for touch support
    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
      document.body.classList.add("touch-device")
    }
  }

  setupMobileOptimizations() {
    // Prevent zoom on input focus
    const viewport = document.querySelector('meta[name="viewport"]')

    document.querySelectorAll("input, select, textarea").forEach((element) => {
      element.addEventListener("focus", () => {
        if (this.isMobile && viewport) {
          viewport.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no")
        }
      })

      element.addEventListener("blur", () => {
        if (this.isMobile && viewport) {
          viewport.setAttribute(
            "content",
            "width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes",
          )
        }
      })
    })

    // Optimize scroll performance
    document.addEventListener(
      "touchmove",
      (e) => {
        if (e.target.closest(".modal, .dropdown-menu")) {
          e.stopPropagation()
        }
      },
      { passive: false },
    )
  }

  optimizeForMobile() {
    // Add mobile-specific CSS classes
    document.body.classList.add("mobile-optimized")

    // Adjust console for mobile
    if (this.elements.consoleContainer) {
      this.elements.consoleContainer.style.width = "calc(100vw - 20px)"
      this.elements.consoleContainer.style.right = "10px"
      this.elements.consoleContainer.style.bottom = "10px"
    }
  }

  handleResize() {
    const wasMobile = this.isMobile
    this.isMobile = window.innerWidth <= 991

    if (wasMobile !== this.isMobile) {
      this.adjustLayoutForDevice()
    }

    // Close sidebar on desktop
    if (!this.isMobile && this.isSidebarOpen()) {
      this.closeSidebar()
    }
  }

  handleOrientationChange() {
    // Recalculate layout after orientation change
    setTimeout(() => {
      this.adjustLayoutForDevice()
      this.repositionModals()
    }, 300)
  }

  adjustLayoutForDevice() {
    if (this.isMobile) {
      document.body.classList.add("mobile-layout")
      this.logToConsole("Switched to mobile layout", "info")
    } else {
      document.body.classList.remove("mobile-layout")
      this.logToConsole("Switched to desktop layout", "info")
    }
  }

  repositionModals() {
    // Reposition any open modals after orientation change
    document.querySelectorAll(".modal.active").forEach((modal) => {
      const content = modal.querySelector(".modal-content")
      if (content) {
        content.style.maxHeight = `${window.innerHeight * 0.9}px`
      }
    })
  }

  handlePullToRefresh() {
    if (this.currentPage === "dashboard") {
      this.refreshBalance()
    } else if (this.currentPage === "history") {
      this.loadTransactions()
    }

    this.showToast("Refreshing...", "info")
  }

  handleDoubleTap(e) {
    const target = e.target.closest(".balance-amount")
    if (target) {
      this.toggleBalanceVisibility()
    }
  }

  // Enhanced Authentication Methods
  async handleLogin() {
    const email = document.getElementById("login-email")?.value
    const password = document.getElementById("login-password")?.value
    const errorElement = document.getElementById("login-error")
    const successElement = document.getElementById("login-success")

    if (!this.validateLoginForm(email, password)) {
      return
    }

    this.showLoader("Signing in...")
    this.logToConsole(`Login attempt for ${email}`, "info")

    try {
      const { data: user, error } = await this.supabase.from("auth_users").select("*").eq("email", email).single()

      if (error || !user) {
        this.showError(errorElement, "အကောင့်မတွေ့ရှိပါ။")
        return
      }

      if (user.password !== password) {
        this.showError(errorElement, "စကားဝှက်မှားယွင်းနေပါသည်။")
        return
      }

      this.currentUser = user

      const sessionData = {
        email: user.email,
        user_id: user.user_id,
      }
      localStorage.setItem("opperSession", JSON.stringify(sessionData))

      this.showSuccess(successElement, "အကောင့်ဝင်ရောက်နေပါသည်...")

      await this.loadUserData()
      this.showAppContainer()

      this.logToConsole("Login successful", "success")
    } catch (error) {
      this.logToConsole(`Login error: ${error.message}`, "error")
      this.showError(errorElement, "အကောင့်ဝင်ရာတွင် အမှားရှိနေပါသည်။")
    } finally {
      this.hideLoader()
    }
  }

  async handleSignup() {
    const email = document.getElementById("signup-email")?.value
    const phone = document.getElementById("signup-phone")?.value
    const password = document.getElementById("signup-password")?.value
    const confirmPassword = document.getElementById("signup-confirm-password")?.value
    const termsAgree = document.getElementById("terms-agree")?.checked
    const errorElement = document.getElementById("signup-error")
    const successElement = document.getElementById("signup-success")

    if (!this.validateSignupForm(email, phone, password, confirmPassword, termsAgree)) {
      return
    }

    this.showLoader("Creating account...")
    this.logToConsole(`Signup attempt for ${email}`, "info")

    try {
      // Check if email exists
      const { data: existingUser } = await this.supabase.from("auth_users").select("email").eq("email", email).single()

      if (existingUser) {
        this.showError(errorElement, "ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။")
        return
      }

      // Check if phone exists
      const { data: existingPhone } = await this.supabase.from("users").select("phone").eq("phone", phone).single()

      if (existingPhone) {
        this.showError(errorElement, "ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။")
        return
      }

      const userId = this.generateUserId(email)

      // Create auth user
      const { error: authError } = await this.supabase.from("auth_users").insert([
        {
          email,
          password,
          user_id: userId,
        },
      ])

      if (authError) throw authError

      // Create user profile
      const { error: profileError } = await this.supabase.from("users").insert([
        {
          user_id: userId,
          phone,
          balance: 0,
          passport_status: "pending",
        },
      ])

      if (profileError) throw profileError

      this.showSuccess(successElement, "အကောင့်ဖွင့်ပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။")
      this.clearSignupForm()

      setTimeout(() => {
        this.switchAuthTab("login")
      }, 2000)

      this.logToConsole("Signup successful", "success")
    } catch (error) {
      this.logToConsole(`Signup error: ${error.message}`, "error")
      this.showError(errorElement, "အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။")
    } finally {
      this.hideLoader()
    }
  }

  async simulateGoogleLogin(type) {
    const googleEmail = "user@gmail.com"
    const errorElement = document.getElementById(`${type}-error`)
    const successElement = document.getElementById(`${type}-success`)

    this.showLoader(`Connecting to Google...`)

    try {
      if (type === "login") {
        const { data: user, error } = await this.supabase
          .from("auth_users")
          .select("*")
          .eq("email", googleEmail)
          .single()

        if (error || !user) {
          this.showError(errorElement, "Google အကောင့်ဖြင့် အကောင့်မတွေ့ရှိပါ။ အကောင့်ဖွင့်ပါ။")
          return
        }

        this.currentUser = user
        const sessionData = {
          email: user.email,
          user_id: user.user_id,
        }
        localStorage.setItem("opperSession", JSON.stringify(sessionData))

        this.showSuccess(successElement, "Google ဖြင့် အကောင့်ဝင်ရောက်နေပါသည်...")

        await this.loadUserData()
        this.showAppContainer()
      } else {
        // Signup logic
        const { data: existingUser } = await this.supabase
          .from("auth_users")
          .select("email")
          .eq("email", googleEmail)
          .single()

        if (existingUser) {
          this.showError(errorElement, "ဤ Google အကောင့်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။")
          return
        }

        const userId = this.generateUserId(googleEmail)

        await this.supabase.from("auth_users").insert([
          {
            email: googleEmail,
            password: "google-auth",
            user_id: userId,
          },
        ])

        await this.supabase.from("users").insert([
          {
            user_id: userId,
            balance: 0,
            passport_status: "pending",
          },
        ])

        this.showSuccess(successElement, "Google ဖြင့် အကောင့်ဖွင့်ပြီးပါပြီ။")

        setTimeout(() => {
          this.switchAuthTab("login")
        }, 2000)
      }

      this.logToConsole(`Google ${type} successful`, "success")
    } catch (error) {
      this.logToConsole(`Google ${type} error: ${error.message}`, "error")
      this.showError(errorElement, `Google ${type} ရာတွင် အမှားရှိနေပါသည်။`)
    } finally {
      this.hideLoader()
    }
  }

  // Enhanced Transfer Methods
  async handleTransfer() {
    const phone = document.getElementById("transfer-phone")?.value
    const amount = Number.parseInt(document.getElementById("transfer-amount")?.value)
    const note = document.getElementById("transfer-note")?.value
    const errorElement = document.getElementById("transfer-error")

    if (!this.validateTransferForm(phone, amount)) {
      return
    }

    try {
      if (!this.transfersEnabled) {
        this.showError(errorElement, "ငွေလွှဲခြင်းကို ယာယီပိတ်ထားပါသည်။")
        return
      }

      if (this.userKycStatus !== "approved") {
        this.showError(errorElement, "ငွေလွှဲရန် KYC အတည်ပြုရန် လိုအပ်ပါသည်။")
        return
      }

      if (this.userBalance < amount) {
        this.showError(errorElement, "လက်ကျန်ငွေ မလုံလောက်ပါ။")
        return
      }

      // Check recipient
      const { data: recipient, error } = await this.supabase.from("users").select("*").eq("phone", phone).single()

      if (error || !recipient) {
        this.showError(errorElement, "လက်ခံမည့်သူ မတွေ့ရှိပါ။")
        return
      }

      this.transferData = { phone, amount, note, recipient }
      this.showPinEntryModal()
    } catch (error) {
      this.logToConsole(`Transfer validation error: ${error.message}`, "error")
      this.showError(errorElement, "ငွေလွှဲရာတွင် အမှားရှိနေပါသည်။")
    }
  }

  async processTransfer(pin) {
    this.closeModal(this.elements.pinEntryModal)
    this.showProcessingOverlay("Processing transfer...")

    try {
      // Verify PIN
      const { data: sender } = await this.supabase
        .from("users")
        .select("*")
        .eq("user_id", this.currentUser.user_id)
        .single()

      if (sender.payment_pin !== pin) {
        this.showError(document.getElementById("transfer-error"), "PIN မှားယွင်းနေပါသည်။")
        return
      }

      // Generate transaction ID
      const transactionId = `OPPER${Math.floor(1000000 + Math.random() * 9000000)}`

      // Create transaction
      const { data: transaction, error: transactionError } = await this.supabase
        .from("transactions")
        .insert([
          {
            id: transactionId,
            from_phone: sender.phone,
            from_name: sender.name || sender.phone,
            to_phone: this.transferData.phone,
            to_name: this.transferData.recipient.name || this.transferData.phone,
            amount: this.transferData.amount,
            note: this.transferData.note,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single()

      if (transactionError) throw transactionError

      // Update balances
      await Promise.all([
        this.supabase
          .from("users")
          .update({ balance: sender.balance - this.transferData.amount })
          .eq("user_id", sender.user_id),
        this.supabase
          .from("users")
          .update({ balance: this.transferData.recipient.balance + this.transferData.amount })
          .eq("user_id", this.transferData.recipient.user_id),
      ])

      // Update local balance
      this.userBalance -= this.transferData.amount
      this.updateBalanceDisplay()

      // Show success
      setTimeout(() => {
        this.hideProcessingOverlay()
        this.showTransactionReceipt(transaction)
        this.clearTransferForm()
        this.loadTransactions()

        this.showToast("Transfer completed successfully!", "success")
        this.logToConsole("Transfer completed successfully", "success")
      }, 2000)
    } catch (error) {
      this.hideProcessingOverlay()
      this.logToConsole(`Transfer error: ${error.message}`, "error")
      this.showError(document.getElementById("transfer-error"), "ငွေလွှဲရာတွင် အမှားရှိနေပါသည်။")
    }
  }

  // Enhanced UI Methods
  navigateToPage(pageId) {
    if (this.currentPage === pageId) return

    this.logToConsole(`Navigating to ${pageId}`, "info")

    // Hide current page
    document.querySelector(".page.active")?.classList.remove("active")

    // Show new page
    document.getElementById(`${pageId}-page`)?.classList.add("active")

    // Update navigation
    this.updateNavigationState(pageId)

    // Close sidebar on mobile
    if (this.isMobile) {
      this.closeSidebar()
    }

    // Load page data
    this.loadPageData(pageId)
    this.currentPage = pageId
  }

  updateNavigationState(pageId) {
    document.querySelectorAll(".sidebar-nav li").forEach((li) => li.classList.remove("active"))
    document.querySelector(`.sidebar-nav a[data-page="${pageId}"]`)?.parentElement.classList.add("active")
  }

  loadPageData(pageId) {
    switch (pageId) {
      case "dashboard":
        this.loadDashboardData()
        break
      case "history":
        this.loadTransactions()
        break
      case "kyc":
        this.updateKycStatus()
        break
      case "settings":
        this.loadUserSettings()
        break
    }
  }

  async loadDashboardData() {
    this.updateBalanceDisplay()
    this.updateUserInfo()
    this.loadTransactions()
    this.updateKycStatus()
  }

  updateBalanceDisplay() {
    if (!this.currentUser) return

    const formattedBalance = this.isBalanceHidden ? "••••••••" : `${this.userBalance.toLocaleString()} Ks`

    if (this.elements.balanceAmount) {
      this.elements.balanceAmount.textContent = formattedBalance
    }

    if (this.elements.userBalance) {
      this.elements.userBalance.textContent = `လက်ကျန်ငွေ: ${formattedBalance}`
    }
  }

  updateUserInfo() {
    if (!this.currentUser) return

    const userInitial = this.currentUser.email.charAt(0).toUpperCase()
    const userName = this.currentUser.email.split("@")[0]

    // Update all user info elements
    document.querySelectorAll("#user-initial, #user-initial-sidebar").forEach((el) => {
      el.textContent = userInitial
    })

    document.querySelectorAll("#user-name, #user-name-sidebar, #greeting-name").forEach((el) => {
      el.textContent = userName
    })

    document.querySelectorAll("#user-id, #user-id-sidebar").forEach((el) => {
      el.textContent = `ID: ${this.currentUser.user_id}`
    })
  }

  // Enhanced Modal System
  openModal(modalId) {
    const modal = document.getElementById(modalId)
    if (modal) {
      modal.classList.add("active")
      document.body.style.overflow = "hidden"

      // Focus management
      const firstFocusable = modal.querySelector("input, button, select, textarea")
      firstFocusable?.focus()

      // Add mobile-specific adjustments
      if (this.isMobile) {
        const content = modal.querySelector(".modal-content")
        if (content) {
          content.style.maxHeight = `${window.innerHeight * 0.9}px`
        }
      }
    }
  }

  closeModal(modal) {
    if (typeof modal === "string") {
      modal = document.getElementById(modal)
    }

    if (modal) {
      modal.classList.remove("active")
      document.body.style.overflow = ""
    }
  }

  closeAllModals() {
    document.querySelectorAll(".modal.active").forEach((modal) => {
      this.closeModal(modal)
    })
  }

  // Enhanced Sidebar Methods
  toggleSidebar() {
    if (this.isSidebarOpen()) {
      this.closeSidebar()
    } else {
      this.openSidebar()
    }
  }

  openSidebar() {
    this.elements.sidebar?.classList.add("active")
    this.elements.menuToggle?.classList.add("active")
  }

  closeSidebar() {
    this.elements.sidebar?.classList.remove("active")
    this.elements.menuToggle?.classList.remove("active")
  }

  isSidebarOpen() {
    return this.elements.sidebar?.classList.contains("active") || false
  }

  // Enhanced Theme System
  initializeTheme() {
    document.body.setAttribute("data-theme", this.currentTheme)

    // Update theme selector
    document.querySelectorAll(".theme-option").forEach((option) => {
      option.classList.toggle("active", option.dataset.theme === this.currentTheme)

      option.addEventListener("click", () => {
        this.setTheme(option.dataset.theme)
      })
    })
  }

  setTheme(theme) {
    document.body.setAttribute("data-theme", theme)
    localStorage.setItem("theme", theme)
    this.currentTheme = theme

    document.querySelectorAll(".theme-option").forEach((option) => {
      option.classList.toggle("active", option.dataset.theme === theme)
    })

    this.logToConsole(`Theme changed to ${theme}`, "info")
  }

  // Enhanced Console System
  toggleConsole() {
    if (this.elements.consoleContainer) {
      this.elements.consoleContainer.classList.toggle("active")
    }
  }

  logToConsole(message, type = "info") {
    if (!this.elements.consoleOutput) return

    const timestamp = new Date().toLocaleTimeString()
    const line = document.createElement("div")
    line.className = `console-line console-${type}`
    line.textContent = `[${timestamp}] ${message}`

    this.elements.consoleOutput.appendChild(line)
    this.elements.consoleOutput.scrollTop = this.elements.consoleOutput.scrollHeight

    // Limit console history
    const lines = this.elements.consoleOutput.querySelectorAll(".console-line")
    if (lines.length > 100) {
      lines[0].remove()
    }
  }

  // Enhanced Utility Methods
  showToast(message, type = "info") {
    const toast = document.createElement("div")
    toast.className = `toast toast-${type}`
    toast.textContent = message

    document.body.appendChild(toast)

    setTimeout(() => {
      toast.classList.add("show")
    }, 100)

    setTimeout(() => {
      toast.classList.remove("show")
      setTimeout(() => {
        document.body.removeChild(toast)
      }, 300)
    }, 3000)
  }

  showLoader(message = "Loading...") {
    if (this.elements.loader) {
      this.elements.loader.classList.add("active")
      const progressText = this.elements.loader.querySelector(".progress-text")
      if (progressText) {
        progressText.textContent = message
      }
    }
    this.isLoading = true
  }

  hideLoader() {
    if (this.elements.loader) {
      this.elements.loader.classList.remove("active")
    }
    this.isLoading = false
  }

  showProcessingOverlay(message) {
    if (this.elements.processingOverlay) {
      this.elements.processingOverlay.classList.add("active")
      const messageElement = document.getElementById("processing-message")
      if (messageElement) {
        messageElement.textContent = message
      }
    }
  }

  hideProcessingOverlay() {
    if (this.elements.processingOverlay) {
      this.elements.processingOverlay.classList.remove("active")
    }
  }

  showError(element, message) {
    if (element) {
      element.textContent = message
      element.className = "auth-message error"
      element.style.display = "block"

      setTimeout(() => {
        element.style.display = "none"
      }, 5000)
    }
  }

  showSuccess(element, message) {
    if (element) {
      element.textContent = message
      element.className = "auth-message success"
      element.style.display = "block"

      setTimeout(() => {
        element.style.display = "none"
      }, 5000)
    }
  }

  debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  generateUserId(email) {
    const username = email.split("@")[0]
    const randomNum = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0")
    const timestamp = Date.now().toString().slice(-4)
    return `${username.slice(0, 4)}${randomNum}${timestamp}`
  }

  // Validation Methods
  validateLoginForm(email, password) {
    if (!email || !this.isValidEmail(email)) {
      this.showError(document.getElementById("login-error"), "အီးမေးလ်လိပ်စာ မှန်ကန်စွာ ထည့်ပါ။")
      return false
    }

    if (!password || password.length < 6) {
      this.showError(document.getElementById("login-error"), "စကားဝှက် အနည်းဆုံး ၆ လုံး ဖြစ်ရပါမည်။")
      return false
    }

    return true
  }

  validateSignupForm(email, phone, password, confirmPassword, termsAgree) {
    if (!email || !this.isValidEmail(email)) {
      this.showError(document.getElementById("signup-error"), "အီးမေးလ်လိပ်စာ မှန်ကန်စွာ ထည့်ပါ။")
      return false
    }

    if (!phone || !this.isValidPhone(phone)) {
      this.showError(document.getElementById("signup-error"), "ဖုန်းနံပါတ် မှန်ကန်စွာ ထည့်ပါ။")
      return false
    }

    if (!password || password.length < 6) {
      this.showError(document.getElementById("signup-error"), "စကားဝှက် အနည်းဆုံး ၆ လုံး ဖြစ်ရပါမည်။")
      return false
    }

    if (password !== confirmPassword) {
      this.showError(document.getElementById("signup-error"), "စကားဝှက်နှင့် အတည်ပြုစကားဝှက် မတူညီပါ။")
      return false
    }

    if (!termsAgree) {
      this.showError(document.getElementById("signup-error"), "စည်းမျဉ်းစည်းကမ်းများကို သဘောတူရန် လိုအပ်ပါသည်။")
      return false
    }

    return true
  }

  validateTransferForm(phone, amount) {
    if (!phone || !this.isValidPhone(phone)) {
      this.showError(document.getElementById("transfer-error"), "ဖုန်းနံပါတ် မှန်ကန်စွာ ထည့်ပါ။")
      return false
    }

    if (!amount || amount <= 0) {
      this.showError(document.getElementById("transfer-error"), "ငွေပမာဏ မှန်ကန်စွာ ထည့်ပါ။")
      return false
    }

    if (amount < 1000) {
      this.showError(document.getElementById("transfer-error"), "ငွေပမာဏ အနည်းဆုံး 1,000 Ks ဖြစ်ရပါမည်။")
      return false
    }

    return true
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  isValidPhone(phone) {
    const phoneRegex = /^09\d{8,9}$/
    return phoneRegex.test(phone.replace(/\s/g, ""))
  }

  // Additional helper methods for completeness
  validateInput(input) {
    // Real-time input validation
    const value = input.value
    const type = input.type

    switch (type) {
      case "email":
        if (value && !this.isValidEmail(value)) {
          input.style.borderColor = "#f56565"
        } else {
          input.style.borderColor = ""
        }
        break
      case "tel":
        if (value && !this.isValidPhone(value)) {
          input.style.borderColor = "#f56565"
        } else {
          input.style.borderColor = ""
        }
        break
    }
  }

  handleInputFocus(input) {
    input.parentNode.style.transform = "translateY(-2px)"
  }

  handleInputBlur(input) {
    input.parentNode.style.transform = ""
  }

  togglePasswordVisibility(toggle) {
    const input = toggle.parentNode.querySelector("input")
    if (input) {
      const isPassword = input.type === "password"
      input.type = isPassword ? "text" : "password"
      toggle.className = `fas ${isPassword ? "fa-eye" : "fa-eye-slash"} toggle-password`
    }
  }

  switchAuthTab(tabType) {
    document.querySelectorAll(".auth-form").forEach((form) => {
      form.classList.remove("active")
    })

    document.querySelectorAll(".auth-tab").forEach((tab) => {
      tab.classList.remove("active")
    })

    document.getElementById(`${tabType}-form`)?.classList.add("active")
    document.querySelector(`[data-tab="${tabType}"]`)?.classList.add("active")

    const indicator = document.querySelector(".tab-indicator")
    if (indicator) {
      indicator.style.transform = tabType === "signup" ? "translateX(100%)" : "translateX(0)"
    }
  }

  clearSignupForm() {
    document.getElementById("signup-email").value = ""
    document.getElementById("signup-phone").value = ""
    document.getElementById("signup-password").value = ""
    document.getElementById("signup-confirm-password").value = ""
    document.getElementById("terms-agree").checked = false
  }

  clearTransferForm() {
    document.getElementById("transfer-phone").value = ""
    document.getElementById("transfer-amount").value = ""
    document.getElementById("transfer-note").value = ""
  }

  toggleBalanceVisibility() {
    this.isBalanceHidden = !this.isBalanceHidden
    this.updateBalanceDisplay()

    const hideButton = document.getElementById("hide-balance")
    if (hideButton) {
      const icon = hideButton.querySelector("i")
      icon.className = this.isBalanceHidden ? "fas fa-eye" : "fas fa-eye-slash"
    }
  }

  async refreshBalance() {
    const refreshButton = document.getElementById("refresh-balance")
    const icon = refreshButton?.querySelector("i")

    if (icon) {
      icon.style.animation = "ring-spin 1s linear infinite"
    }

    await this.loadUserData()

    if (icon) {
      icon.style.animation = ""
    }

    this.showToast("Balance refreshed", "success")
  }

  toggleProfileDropdown() {
    if (this.elements.profileDropdown) {
      this.elements.profileDropdown.classList.toggle("active")
    }
  }

  focusSearch() {
    // Placeholder for search functionality
    this.logToConsole("Search focused", "info")
  }

  // Placeholder methods for session management and other features
  async checkSession() {
    try {
      const session = localStorage.getItem("opperSession")

      if (session) {
        const sessionData = JSON.parse(session)
        const { data: user, error } = await this.supabase
          .from("auth_users")
          .select("*")
          .eq("email", sessionData.email)
          .eq("user_id", sessionData.user_id)
          .single()

        if (error || !user) {
          localStorage.removeItem("opperSession")
          this.showAuthContainer()
          return
        }

        this.currentUser = user
        await this.loadUserData()
        this.showAppContainer()
      } else {
        this.showAuthContainer()
      }
    } catch (error) {
      this.logToConsole(`Session check error: ${error.message}`, "error")
      this.showAuthContainer()
    }
  }

  async loadUserData() {
    try {
      if (!this.currentUser) return

      const { data: userData, error } = await this.supabase
        .from("users")
        .select("*")
        .eq("user_id", this.currentUser.user_id)
        .single()

      if (error) throw error

      this.userBalance = userData.balance || 0
      this.userKycStatus = userData.passport_status || "pending"

      this.updateUserInfo()
      this.updateBalanceDisplay()
      this.updateKycStatus()
      this.setupRealtimeSubscriptions()
      this.loadTransactions()
    } catch (error) {
      this.logToConsole(`Load user data error: ${error.message}`, "error")
    }
  }

  setupRealtimeSubscriptions() {
    // Setup real-time subscriptions for balance and status updates
    this.supabase
      .channel("user-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "users",
          filter: `user_id=eq.${this.currentUser.user_id}`,
        },
        (payload) => {
          if (payload.new.balance !== this.userBalance) {
            this.userBalance = payload.new.balance
            this.updateBalanceDisplay()
          }

          if (payload.new.passport_status !== this.userKycStatus) {
            this.userKycStatus = payload.new.passport_status
            this.updateKycStatus()
          }
        },
      )
      .subscribe()
  }

  async loadTransactions() {
    // Load and display transactions
    try {
      if (!this.currentUser) return

      const { data: userData } = await this.supabase
        .from("users")
        .select("phone")
        .eq("user_id", this.currentUser.user_id)
        .single()

      if (!userData?.phone) return

      const { data: transactions, error } = await this.supabase
        .from("transactions")
        .select("*")
        .or(`from_phone.eq.${userData.phone},to_phone.eq.${userData.phone}`)
        .order("created_at", { ascending: false })
        .limit(10)

      if (error) throw error

      this.transactions = transactions || []
      this.updateTransactionsUI(this.transactions, userData.phone)
    } catch (error) {
      this.logToConsole(`Load transactions error: ${error.message}`, "error")
    }
  }

  updateTransactionsUI(transactions, userPhone) {
    const recentList = document.getElementById("recent-transactions-list")
    const historyList = document.getElementById("history-transactions-list")

    if (!transactions || transactions.length === 0) {
      const emptyState = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>လုပ်ဆောင်ချက်မှတ်တမ်းမရှိသေးပါ</p>
                </div>
            `
      if (recentList) recentList.innerHTML = emptyState
      if (historyList) historyList.innerHTML = emptyState
      return
    }

    const transactionHTML = transactions
      .map((transaction, index) => {
        const isSender = transaction.from_phone === userPhone
        const otherParty = isSender ? transaction.to_phone : transaction.from_phone
        const transactionDate = new Date(transaction.created_at).toLocaleString()

        return `
                <div class="transaction-item ${isSender ? "sent" : "received"}">
                    <div class="transaction-icon">
                        <i class="fas ${isSender ? "fa-arrow-up" : "fa-arrow-down"}"></i>
                    </div>
                    <div class="transaction-details">
                        <div class="transaction-title">
                            ${isSender ? "ပို့ထားသော" : "လက်ခံရရှိသော"}
                        </div>
                        <div class="transaction-subtitle">
                            ${otherParty} ${transaction.note ? `- ${transaction.note}` : ""}
                        </div>
                        <div class="transaction-date">${transactionDate}</div>
                    </div>
                    <div class="transaction-actions">
                        <div class="transaction-amount ${isSender ? "negative" : "positive"}">
                            ${isSender ? "-" : "+"} ${transaction.amount.toLocaleString()} Ks
                        </div>
                        <button class="transaction-view-btn" onclick="app.showTransactionReceipt(${JSON.stringify(transaction).replace(/"/g, "&quot;")})">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
            `
      })
      .join("")

    if (recentList) recentList.innerHTML = transactionHTML
    if (historyList) historyList.innerHTML = transactionHTML
  }

  updateKycStatus() {
    const kycStatusElement = document.getElementById("kyc-status")
    const kycStatusMessage = document.getElementById("kyc-status-message")
    const kycStatusIcon = document.querySelector(".kyc-status-icon")
    const kycForm = document.getElementById("kyc-form")

    if (!kycStatusIcon) return

    kycStatusIcon.classList.remove("pending", "approved", "rejected")

    if (this.userKycStatus === "approved") {
      if (kycStatusElement) kycStatusElement.textContent = "KYC: အတည်ပြုပြီး"
      if (kycStatusMessage) kycStatusMessage.textContent = "သင့် KYC အတည်ပြုပြီးဖြစ်ပါသည်။"
      kycStatusIcon.classList.add("approved")
      kycStatusIcon.innerHTML = '<i class="fas fa-check-circle"></i>'
      if (kycForm) kycForm.style.display = "none"
    } else if (this.userKycStatus === "rejected") {
      if (kycStatusElement) kycStatusElement.textContent = "KYC: ငြင်းပယ်ခံရသည်"
      if (kycStatusMessage) kycStatusMessage.textContent = "သင့် KYC ငြင်းပယ်ခံရပါသည်။ ပြန်လည်တင်သွင်းပါ။"
      kycStatusIcon.classList.add("rejected")
      kycStatusIcon.innerHTML = '<i class="fas fa-times-circle"></i>'
      if (kycForm) kycForm.style.display = "block"
    } else {
      if (kycStatusElement) kycStatusElement.textContent = "KYC: စောင့်ဆိုင်းဆဲ"
      if (kycStatusMessage) kycStatusMessage.textContent = "သင့် KYC စိစစ်နေဆဲဖြစ်ပါသည်။"
      kycStatusIcon.classList.add("pending")
      kycStatusIcon.innerHTML = '<i class="fas fa-clock"></i>'
      if (kycForm) kycForm.style.display = "block"
    }
  }

  showAuthContainer() {
    if (this.elements.authContainer) {
      this.elements.authContainer.classList.remove("hidden")
    }
    if (this.elements.appContainer) {
      this.elements.appContainer.classList.add("hidden")
    }
  }

  showAppContainer() {
    if (this.elements.authContainer) {
      this.elements.authContainer.classList.add("hidden")
    }
    if (this.elements.appContainer) {
      this.elements.appContainer.classList.remove("hidden")
    }
  }

  logout() {
    localStorage.removeItem("opperSession")
    this.currentUser = null
    this.showAuthContainer()
    this.logToConsole("User logged out", "info")
  }

  // Additional methods for PIN handling, file uploads, etc.
  setupPinInputs() {
    const pinInputs = document.querySelectorAll(".pin-input")

    pinInputs.forEach((input, index) => {
      input.addEventListener("input", (e) => {
        if (e.target.value && index < pinInputs.length - 1) {
          pinInputs[index + 1].focus()
        }
      })

      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !e.target.value && index > 0) {
          pinInputs[index - 1].focus()
        }
      })
    })

    document.getElementById("confirm-pin-btn")?.addEventListener("click", () => {
      let pin = ""
      pinInputs.forEach((input) => (pin += input.value))

      if (pin.length !== 6) {
        this.showError(document.getElementById("pin-error"), "PIN ၆ လုံး ထည့်ပါ")
        return
      }

      this.processTransfer(pin)
    })
  }

  showPinEntryModal() {
    document.querySelectorAll(".pin-input").forEach((input) => {
      input.value = ""
    })

    document.getElementById("pin-error").style.display = "none"
    this.openModal("pin-entry-modal")
    document.querySelector(".pin-input")?.focus()
  }

  showTransactionReceipt(transaction) {
    // Implementation for showing transaction receipt
    this.openModal("receipt-modal")
    // Add receipt content generation here
  }

  async handleKYCSubmit() {
    // Implementation for KYC submission
    this.logToConsole("KYC submission started", "info")
  }

  handleFileUpload(input) {
    const file = input.files[0]
    if (!file) return

    const previewId = input.id.replace("-upload", "-preview")
    const preview = document.getElementById(previewId)

    if (file.type.startsWith("image/") && preview) {
      const reader = new FileReader()
      reader.onload = (e) => {
        preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`
        preview.style.display = "block"
      }
      reader.readAsDataURL(file)
    }

    this.logToConsole(`File uploaded: ${file.name}`, "success")
  }

  downloadReceipt() {
    const receiptElement = document.getElementById("receipt-container")
    if (!receiptElement) return

    // Use html2canvas if available
    if (window.html2canvas) {
      html2canvas(receiptElement).then((canvas) => {
        const link = document.createElement("a")
        link.download = `OPPER-Receipt-${Date.now()}.png`
        link.href = canvas.toDataURL("image/png")
        link.click()
      })
    }
  }

  loadUserSettings() {
    if (!this.currentUser) return

    const settingsPhone = document.getElementById("settings-phone")
    const settingsEmail = document.getElementById("settings-email")

    if (settingsPhone) settingsPhone.value = this.currentUser.phone || ""
    if (settingsEmail) settingsEmail.value = this.currentUser.email || ""
  }

  initializeUI() {
    // Initialize all UI components
    this.logToConsole("UI initialized", "info")
  }
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  window.app = new OpperPaymentApp()
})

// Add CSS for toast notifications
const toastStyles = `
.toast {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    transform: translateX(100%);
    transition: transform 0.3s ease;
}

.toast.show {
    transform: translateX(0);
}

.toast-success {
    background: #48bb78;
}

.toast-error {
    background: #f56565;
}

.toast-info {
    background: #4299e1;
}

.toast-warning {
    background: #ed8936;
}

@media (max-width: 768px) {
    .toast {
        right: 10px;
        left: 10px;
        transform: translateY(-100%);
    }
    
    .toast.show {
        transform: translateY(0);
    }
}
`

// Add styles to document
const styleSheet = document.createElement("style")
styleSheet.textContent = toastStyles
document.head.appendChild(styleSheet)

// Service Worker registration for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("SW registered: ", registration)
      })
      .catch((registrationError) => {
        console.log("SW registration failed: ", registrationError)
      })
  })
}

// Handle online/offline status
window.addEventListener("online", () => {
  if (window.app) {
    window.app.logToConsole("Connection restored", "success")
    window.app.showToast("Connection restored", "success")
  }
})

window.addEventListener("offline", () => {
  if (window.app) {
    window.app.logToConsole("Connection lost - working offline", "warning")
    window.app.showToast("Working offline", "warning")
  }
})

// Prevent context menu on production
if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault()
  })
}

// Enhanced error handling
window.addEventListener("error", (e) => {
  if (window.app) {
    window.app.logToConsole(`Error: ${e.message}`, "error")
  }
})

window.addEventListener("unhandledrejection", (e) => {
  if (window.app) {
    window.app.logToConsole(`Unhandled Promise: ${e.reason}`, "error")
  }
})

// Auto-save form data to prevent loss on mobile
let formSaveTimeout
document.addEventListener("input", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    clearTimeout(formSaveTimeout)
    formSaveTimeout = setTimeout(() => {
      const formData = {}
      const form = e.target.closest("form") || e.target.closest(".auth-form, .transfer-form, .kyc-form")
      if (form) {
        const inputs = form.querySelectorAll("input, textarea, select")
        inputs.forEach((input) => {
          if (input.type !== "password" && input.type !== "file") {
            formData[input.id] = input.value
          }
        })
        sessionStorage.setItem("opperFormData", JSON.stringify(formData))
      }
    }, 1000)
  }
})

// Restore form data on page load
window.addEventListener("load", () => {
  const savedFormData = sessionStorage.getItem("opperFormData")
  if (savedFormData) {
    try {
      const formData = JSON.parse(savedFormData)
      Object.keys(formData).forEach((id) => {
        const input = document.getElementById(id)
        if (input && input.type !== "password") {
          input.value = formData[id]
        }
      })
    } catch (e) {
      // Silently fail if data is corrupted
    }
  }
})

// Performance monitoring
if ("performance" in window) {
  window.addEventListener("load", () => {
    setTimeout(() => {
      const perfData = performance.getEntriesByType("navigation")[0]
      if (window.app && perfData) {
        window.app.logToConsole(`Page loaded in ${Math.round(perfData.loadEventEnd - perfData.fetchStart)}ms`, "info")
      }
    }, 0)
  })
}

// Mobile-specific optimizations
if ("ontouchstart" in window) {
  // Add touch feedback
  document.addEventListener("touchstart", (e) => {
    if (e.target.classList.contains("btn") || e.target.closest(".btn")) {
      e.target.style.transform = "scale(0.95)"
    }
  })

  document.addEventListener("touchend", (e) => {
    if (e.target.classList.contains("btn") || e.target.closest(".btn")) {
      setTimeout(() => {
        e.target.style.transform = ""
      }, 150)
    }
  })
}

// Prevent text selection on UI elements
document.addEventListener("selectstart", (e) => {
  if (e.target.closest(".btn, .action-card, .sidebar-nav, .auth-tab")) {
    e.preventDefault()
  }
})

// Enhanced mobile viewport handling
function handleViewportChange() {
  const vh = window.innerHeight * 0.01
  document.documentElement.style.setProperty("--vh", `${vh}px`)
}

window.addEventListener("resize", handleViewportChange)
window.addEventListener("orientationchange", () => {
  setTimeout(handleViewportChange, 100)
})

// Initial viewport setup
handleViewportChange()

// Export app instance for global access
window.OpperPaymentApp = OpperPaymentApp
