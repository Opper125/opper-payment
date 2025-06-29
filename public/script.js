// Supabase Configuration
const supabaseUrl = "https://vtsczzlnhsrgnbkfyizi.supabase.co"
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68"
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, { fetch: (...args) => fetch(...args) })

// Import html2canvas
const html2canvas = window.html2canvas

// Global Variables
let currentUser = null
let userProfile = null // Will hold the full user profile from the 'users' table
let userBalance = 0
let userKycStatus = "pending"
let transfersEnabled = true
let currentTheme = localStorage.getItem("theme") || "dark"
let transactions = []
let recipientCheckTimeout

// DOM Elements
const loader = document.getElementById("loader")
const authContainer = document.getElementById("auth-container")
const appContainer = document.getElementById("app-container")
const pinEntryModal = document.getElementById("pin-entry-modal")
const receiptModal = document.getElementById("receipt-modal")
const processingOverlay = document.getElementById("processing-overlay")

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
  // Apply saved theme
  document.body.setAttribute("data-theme", currentTheme)

  // Show loader
  showLoader()

  // Check if user is logged in using the original custom session logic
  await checkSession()

  // Initialize UI elements
  initializeUI()

  // Hide loader after initialization
  setTimeout(hideLoader, 1500)
})

// Check if user is logged in (User's Original Custom Logic)
async function checkSession() {
  try {
    // Check local storage for session
    const session = localStorage.getItem("opperSession")

    if (session) {
      const sessionData = JSON.parse(session)
      const { data: user, error } = await supabase
        .from("auth_users")
        .select("*")
        .eq("email", sessionData.email)
        .eq("user_id", sessionData.user_id)
        .single()

      if (error || !user) {
        // Invalid session
        localStorage.removeItem("opperSession")
        showAuthContainer()
        return
      }

      // Valid session, load user data
      currentUser = user
      await loadUserData()
    } else {
      // No session found
      showAuthContainer()
    }
  } catch (error) {
    console.error("Session check error:", error)
    showAuthContainer()
  }
}

// Load user data
async function loadUserData() {
  try {
    if (!currentUser) return

    // Get user profile data
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", currentUser.user_id)
      .single()

    if (userError) throw userError

    // Update global variables
    userProfile = userData
    userBalance = userData.balance || 0
    userKycStatus = userData.passport_status || "pending"

    // Update UI with user data
    updateUserUI(userData)

    // Check system settings
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("allow_transfers")
      .eq("id", 1)
      .single()

    if (!settingsError && settings) {
      transfersEnabled = settings.allow_transfers
      updateTransferStatusUI()
    }

    // Set up realtime subscriptions
    setupRealtimeSubscriptions()

    // Load transactions
    await loadTransactions()
    showAppContainer()
  } catch (error) {
    console.error("Load user data error:", error)
    logout()
  }
}

// Update UI with user data
function updateUserUI(userData) {
  if (!currentUser || !userData) return
  // Update user name and ID in header and sidebar
  const userInitial = currentUser.email.charAt(0).toUpperCase()
  const userName = userData.name || currentUser.email.split("@")[0]

  document.getElementById("user-initial").textContent = userInitial
  document.getElementById("user-initial-sidebar").textContent = userInitial
  document.getElementById("user-name").textContent = userName
  document.getElementById("user-name-sidebar").textContent = userName
  document.getElementById("user-id").textContent = `ID: ${currentUser.user_id.slice(0, 8)}...`
  document.getElementById("user-id-sidebar").textContent = `ID: ${currentUser.user_id.slice(0, 8)}...`
  document.getElementById("greeting-name").textContent = userName

  // Update balance
  document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`
  document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`

  // Update KYC status
  updateKycStatusUI()

  // Update settings page
  document.getElementById("settings-phone").value = userData.phone || ""
  document.getElementById("settings-email").value = currentUser.email || ""
}

// Update KYC status in UI
function updateKycStatusUI() {
  const kycStatusDisplay = document.getElementById("kyc-status-display")
  const kycStatusText = document.getElementById("kyc-status-text")
  const kycLevelTitle = document.getElementById("kyc-level-title")
  const kycStatusMessage = document.getElementById("kyc-status-message")
  const kycStatusIcon = document.querySelector("#kyc-status-card .kyc-status-icon")
  const kycForm = document.getElementById("kyc-form")

  let level = 1
  let status = "အတည်မပြုရသေးပါ"
  let iconClass = "pending"
  let formDisplay = "block"

  if (userKycStatus === "approved") {
    level = 2
    status = "အတည်ပြုပြီး"
    iconClass = "approved"
    formDisplay = "none"
  } else if (userKycStatus === "rejected") {
    status = "ငြင်းပယ်ခံရသည်"
    iconClass = "rejected"
  } else if (userKycStatus === "pending") {
    status = "စောင့်ဆိုင်းဆဲ"
    // Hide form if already submitted
    if (userProfile && userProfile.passport_number) {
      formDisplay = "none"
    }
  }

  kycStatusDisplay.className = `status-item level-${level}`
  kycStatusText.textContent = `KYC: Level ${level} (${status})`
  kycLevelTitle.textContent = `KYC Level ${level}`
  kycStatusMessage.textContent = status
  kycStatusIcon.className = `kyc-status-icon ${iconClass}`
  kycStatusIcon.innerHTML = `<i class="fas ${iconClass === "approved" ? "fa-check-circle" : iconClass === "rejected" ? "fa-times-circle" : "fa-clock"}"></i>`
  kycForm.style.display = formDisplay
}

// Update transfer status in UI
function updateTransferStatusUI() {
  const transferStatusDisplay = document.getElementById("transfer-status-display")
  const transferStatusText = document.getElementById("transfer-status-text")
  if (transfersEnabled) {
    transferStatusDisplay.className = "status-item enabled"
    transferStatusText.textContent = "ငွေလွှဲခြင်း: ခွင့်ပြုထားသည်"
  } else {
    transferStatusDisplay.className = "status-item disabled"
    transferStatusText.textContent = "ငွေလွှဲခြင်း: ပိတ်ထားသည်"
  }
}

// Set up realtime subscriptions
function setupRealtimeSubscriptions() {
  // Subscribe to user profile changes
  supabase
    .channel(`public:users:user_id=eq.${currentUser.user_id}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "users", filter: `user_id=eq.${currentUser.user_id}` },
      (payload) => {
        const updatedProfile = payload.new
        userProfile = updatedProfile
        userBalance = updatedProfile.balance
        userKycStatus = updatedProfile.passport_status
        updateUserUI(updatedProfile)
      },
    )
    .subscribe()

  // Subscribe to system settings changes
  supabase
    .channel("public:settings")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings", filter: "id=eq.1" }, (payload) => {
      transfersEnabled = payload.new.allow_transfers
      updateTransferStatusUI()
    })
    .subscribe()

  // Subscribe to new transactions involving the current user
  supabase
    .channel(`public:transactions`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "transactions",
        filter: `or(from_phone.eq.${userProfile.phone},to_phone.eq.${userProfile.phone})`,
      },
      () => {
        loadTransactions()
      },
    )
    .subscribe()
}

// Load transactions
async function loadTransactions() {
  try {
    if (!userProfile || !userProfile.phone) return

    const userPhone = userProfile.phone

    // Get recent transactions
    const { data: transactionsData, error } = await supabase
      .from("transactions")
      .select("*")
      .or(`from_phone.eq.${userPhone},to_phone.eq.${userPhone}`)
      .order("created_at", { ascending: false })
      .limit(10)

    if (error) throw error

    // Store transactions globally
    transactions = transactionsData || []

    // Update UI with transactions
    updateTransactionsUI(transactions, userPhone)
  } catch (error) {
    console.error("Load transactions error:", error)
  }
}

// Update transactions UI
function updateTransactionsUI(transactions, userPhone) {
  const recentTransactionsList = document.getElementById("recent-transactions-list")
  const historyTransactionsList = document.getElementById("history-transactions-list")

  // Clear lists
  recentTransactionsList.innerHTML = ""
  historyTransactionsList.innerHTML = ""

  if (!transactions || transactions.length === 0) {
    // Show empty state
    const emptyState = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>လုပ်ဆောင်ချက်မှတ်တမ်းမရှိသေးပါ</p>
            </div>
        `
    recentTransactionsList.innerHTML = emptyState
    historyTransactionsList.innerHTML = emptyState
    return
  }

  // Create transaction items
  transactions.forEach((transaction, index) => {
    const isSender = transaction.from_phone === userPhone
    const otherPartyName = isSender ? transaction.to_name : transaction.from_name
    const transactionDate = new Date(transaction.created_at).toLocaleString()

    const transactionItem = `
            <div class="transaction-item ${isSender ? "sent" : "received"}">
                <div class="transaction-icon">
                    <i class="fas ${isSender ? "fa-arrow-up" : "fa-arrow-down"}"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-title">
                        ${isSender ? "To: " + otherPartyName : "From: " + otherPartyName}
                    </div>
                    <div class="transaction-date">${transactionDate}</div>
                </div>
                <div class="transaction-amount ${isSender ? "negative" : "positive"}">
                    ${isSender ? "-" : "+"} ${transaction.amount.toLocaleString()} Ks
                </div>
            </div>
        `

    // Add to recent transactions (only first 5)
    if (index < 5) {
      recentTransactionsList.innerHTML += transactionItem
    }

    // Add to history transactions
    historyTransactionsList.innerHTML += transactionItem
  })
}

// Initialize UI elements
function initializeUI() {
  // Auth tabs
  const authTabs = document.querySelectorAll(".auth-tab")
  const authForms = document.querySelectorAll(".auth-form")

  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.getAttribute("data-tab")

      // Update active tab
      authTabs.forEach((t) => t.classList.remove("active"))
      tab.classList.add("active")

      // Show corresponding form
      authForms.forEach((form) => {
        form.classList.remove("active")
        if (form.id === `${tabName}-form`) {
          form.classList.add("active")
        }
      })
    })
  })

  // Toggle password visibility
  const togglePasswordButtons = document.querySelectorAll(".toggle-password")

  togglePasswordButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.previousElementSibling
      if (input.type === "password") {
        input.type = "text"
        button.classList.remove("fa-eye-slash")
        button.classList.add("fa-eye")
      } else {
        input.type = "password"
        button.classList.remove("fa-eye")
        button.classList.add("fa-eye-slash")
      }
    })
  })

  // Sidebar navigation
  const sidebarLinks = document.querySelectorAll(".sidebar-nav a")
  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault()
      showPage(link.dataset.page)
    })
  })

  // Quick action cards
  const actionCards = document.querySelectorAll(".action-card")
  actionCards.forEach((card) => {
    card.addEventListener("click", () => {
      showPage(card.dataset.page)
    })
  })

  // Mobile menu toggle
  const menuToggle = document.getElementById("menu-toggle")
  const closeSidebar = document.getElementById("close-sidebar")
  const sidebar = document.getElementById("sidebar")

  menuToggle.addEventListener("click", () => sidebar.classList.add("active"))
  closeSidebar.addEventListener("click", () => sidebar.classList.remove("active"))

  // Profile dropdown
  const profileDropdownTrigger = document.getElementById("profile-dropdown-trigger")
  const profileDropdown = document.getElementById("profile-dropdown")

  profileDropdownTrigger.addEventListener("click", (e) => {
    e.stopPropagation()
    profileDropdown.classList.toggle("active")
    const rect = profileDropdownTrigger.getBoundingClientRect()
    profileDropdown.style.top = `${rect.bottom + 10}px`
    profileDropdown.style.right = `${window.innerWidth - rect.right}px`
  })

  document.addEventListener("click", () => profileDropdown.classList.remove("active"))

  // Dropdown actions
  document.getElementById("view-profile").addEventListener("click", () => showPage("settings"))
  document.getElementById("go-to-settings").addEventListener("click", () => showPage("settings"))
  document.getElementById("dropdown-logout").addEventListener("click", logout)

  // Logout button
  document.getElementById("logout-btn").addEventListener("click", logout)

  // Balance actions
  document.getElementById("refresh-balance").addEventListener("click", () => loadUserData())
  document.getElementById("hide-balance").addEventListener("click", () => {
    const balanceAmount = document.getElementById("balance-amount")
    if (balanceAmount.classList.contains("hidden-balance")) {
      balanceAmount.textContent = `${userBalance.toLocaleString()} Ks`
      balanceAmount.classList.remove("hidden-balance")
      document.querySelector("#hide-balance i").className = "fas fa-eye-slash"
    } else {
      balanceAmount.textContent = "•••••• Ks"
      balanceAmount.classList.add("hidden-balance")
      document.querySelector("#hide-balance i").className = "fas fa-eye"
    }
  })

  // File uploads preview
  const fileInputs = document.querySelectorAll('input[type="file"]')
  fileInputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      const file = e.target.files[0]
      if (!file) return

      const previewId = input.id.replace("-upload", "-preview")
      const preview = document.getElementById(previewId)
      const fileNameEl = document.getElementById(input.id.replace("-upload", "-file-name"))
      if (fileNameEl) fileNameEl.textContent = file.name

      const reader = new FileReader()
      reader.onload = (e) => {
        preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`
      }
      reader.readAsDataURL(file)
    })
  })

  // Theme selector
  const themeOptions = document.querySelectorAll(".theme-option")
  themeOptions.forEach((option) => {
    if (option.getAttribute("data-theme") === currentTheme) {
      option.classList.add("active")
    }

    option.addEventListener("click", () => {
      const theme = option.getAttribute("data-theme")
      themeOptions.forEach((o) => o.classList.remove("active"))
      option.classList.add("active")
      document.body.setAttribute("data-theme", theme)
      localStorage.setItem("theme", theme)
      currentTheme = theme
    })
  })

  // Modal handling
  const modals = document.querySelectorAll(".modal")
  const modalTriggers = {
    "change-password-btn": "change-password-modal",
    "change-pin-btn": "change-pin-modal",
    "delete-account-btn": "delete-account-modal",
  }

  Object.keys(modalTriggers).forEach((triggerId) => {
    const trigger = document.getElementById(triggerId)
    const modalId = modalTriggers[triggerId]
    if (trigger) {
      trigger.addEventListener("click", () => document.getElementById(modalId).classList.add("active"))
    }
  })

  const modalCloseButtons = document.querySelectorAll(".modal-close, .modal-cancel")
  modalCloseButtons.forEach((button) => {
    button.addEventListener("click", () => button.closest(".modal").classList.remove("active"))
  })

  modals.forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("active")
    })
  })

  // PIN Input handling
  setupPinInputs()

  // Download receipt button
  document.getElementById("download-receipt").addEventListener("click", downloadReceipt)

  // Form submissions
  setupFormSubmissions()

  // Recipient check on input
  document.getElementById("transfer-phone").addEventListener("input", handleRecipientCheck)
}

// Check recipient details with debounce
function handleRecipientCheck(e) {
  const phone = e.target.value
  const recipientInfoEl = document.getElementById("recipient-info")
  clearTimeout(recipientCheckTimeout)

  if (phone.length < 9) {
    recipientInfoEl.style.display = "none"
    return
  }

  recipientInfoEl.style.display = "flex"
  recipientInfoEl.innerHTML = `<div class="loading-text"><i class="fas fa-spinner fa-spin"></i> စစ်ဆေးနေသည်...</div>`

  recipientCheckTimeout = setTimeout(async () => {
    if (phone === userProfile.phone) {
      recipientInfoEl.innerHTML = `<div class="error-text"><i class="fas fa-exclamation-triangle"></i> ကိုယ့်ကိုယ်ကို ငွေလွှဲ၍မရပါ။</div>`
      return
    }
    const { data, error } = await supabase.from("users").select("name, passport_status").eq("phone", phone).single()
    if (error || !data) {
      recipientInfoEl.innerHTML = `<div class="error-text"><i class="fas fa-times-circle"></i> လက်ခံမည့်သူ မတွေ့ရှိပါ။</div>`
    } else {
      const kycLevel = data.passport_status === "approved" ? 2 : 1
      const kycStatus = kycLevel === 2 ? "အတည်ပြုပြီး" : "အတည်မပြုရသေး"
      recipientInfoEl.innerHTML = `
                <div class="avatar"><i class="fas fa-user"></i></div>
                <div class="info">
                    <div class="name">${data.name || `User (${phone.slice(-4)})`}</div>
                    <div class="kyc-status kyc-level-${kycLevel}">
                        <i class="fas fa-shield-alt"></i> KYC Level ${kycLevel} (${kycStatus})
                    </div>
                </div>
            `
    }
  }, 1000)
}

// Setup PIN inputs
function setupPinInputs() {
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

  document.getElementById("confirm-pin-btn").addEventListener("click", () => {
    const pin = Array.from(pinInputs)
      .map((i) => i.value)
      .join("")
    if (pin.length !== 6) {
      showMessage("pin-error", "PIN ၆ လုံး ထည့်ပါ")
      return
    }
    processTransferWithPin(pin)
  })
}

// Setup form submissions (User's Original Logic)
function setupFormSubmissions() {
  // Login form
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault()
    const email = document.getElementById("login-email").value
    const password = document.getElementById("login-password").value

    if (!email || !password) {
      showMessage("login-error", "အီးမေးလ်နှင့် စကားဝှက် ထည့်ပါ။")
      return
    }

    try {
      const { data: user, error } = await supabase.from("auth_users").select("*").eq("email", email).single()

      if (error || !user || user.password !== password) {
        showMessage("login-error", "အီးမေးလ် (သို့) စကားဝှက် မှားယွင်းနေပါသည်။")
        return
      }

      currentUser = user
      localStorage.setItem("opperSession", JSON.stringify({ email: user.email, user_id: user.user_id }))
      showMessage("login-success", "အကောင့်ဝင်ရောက်နေပါသည်...", true)
      await loadUserData()
    } catch (error) {
      console.error("Login error:", error)
      showMessage("login-error", "အကောင့်ဝင်ရာတွင် အမှားရှိနေပါသည်။")
    }
  })

  // Signup form
  document.getElementById("signup-form").addEventListener("submit", async (e) => {
    e.preventDefault()
    const email = document.getElementById("signup-email").value
    const phone = document.getElementById("signup-phone").value
    const password = document.getElementById("signup-password").value
    const confirmPassword = document.getElementById("signup-confirm-password").value
    const termsAgree = document.getElementById("terms-agree").checked

    if (!email || !phone || !password || !confirmPassword) {
      showMessage("signup-error", "အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။")
      return
    }
    if (password !== confirmPassword) {
      showMessage("signup-error", "စကားဝှက်နှင့် အတည်ပြုစကားဝှက် မတူညီပါ။")
      return
    }
    if (!termsAgree) {
      showMessage("signup-error", "စည်းမျဉ်းစည်းကမ်းများကို သဘောတူရန် လိုအပ်ပါသည်။")
      return
    }

    try {
      const { data: existingUser } = await supabase.from("auth_users").select("email").eq("email", email).single()
      if (existingUser) {
        showMessage("signup-error", "ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။")
        return
      }
      const { data: existingPhone } = await supabase.from("users").select("phone").eq("phone", phone).single()
      if (existingPhone) {
        showMessage("signup-error", "ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။")
        return
      }

      const userId = generateUserId(email)
      const { error: authError } = await supabase.from("auth_users").insert([{ email, password, user_id: userId }])
      if (authError) throw authError

      const { error: profileError } = await supabase
        .from("users")
        .insert([{ user_id: userId, phone, balance: 0, passport_status: "pending", name: email.split("@")[0] }])
      if (profileError) throw profileError

      showMessage("signup-success", "အကောင့်ဖွင့်ပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။", true)
      document.getElementById("signup-form").reset()
      setTimeout(() => document.querySelector('.auth-tab[data-tab="login"]').click(), 2000)
    } catch (error) {
      console.error("Signup error:", error)
      showMessage("signup-error", "အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။")
    }
  })

  // Transfer form
  document.getElementById("transfer-form").addEventListener("submit", async (e) => {
    e.preventDefault()
    const phone = document.getElementById("transfer-phone").value
    const amount = Number.parseInt(document.getElementById("transfer-amount").value)

    if (!phone || !amount) {
      showMessage("transfer-error", "ဖုန်းနံပါတ်နှင့် ငွေပမာဏ ထည့်ပါ။")
      return
    }
    if (amount < 1000) {
      showMessage("transfer-error", "ငွေပမာဏ အနည်းဆုံး 1,000 Ks ဖြစ်ရပါမည်။")
      return
    }
    if (!transfersEnabled) {
      showMessage("transfer-error", "ငွေလွှဲခြင်းကို ယာယီပိတ်ထားပါသည်။")
      return
    }
    if (userKycStatus !== "approved") {
      showMessage("transfer-error", "ငွေလွှဲရန် KYC အတည်ပြုရန် လိုအပ်ပါသည်။")
      return
    }
    if (userBalance < amount) {
      showMessage("transfer-error", "လက်ကျန်ငွေ မလုံလောက်ပါ။")
      return
    }
    if (userProfile.phone === phone) {
      showMessage("transfer-error", "ကိုယ့်ကိုယ်ကို ငွေလွှဲ၍မရပါ။")
      return
    }

    const { data: recipient, error } = await supabase.from("users").select("user_id").eq("phone", phone).single()
    if (error || !recipient) {
      showMessage("transfer-error", "လက်ခံမည့်သူ မတွေ့ရှိပါ။")
      return
    }

    showPinEntryModal()
  })

  // KYC form
  document.getElementById("kyc-form").addEventListener("submit", async (e) => {
    e.preventDefault()
    const passportNumber = document.getElementById("kyc-passport").value
    const address = document.getElementById("kyc-address").value
    const pin = document.getElementById("kyc-pin").value
    const confirmPin = document.getElementById("kyc-confirm-pin").value
    const passportFile = document.getElementById("passport-upload").files[0]
    const selfieFile = document.getElementById("selfie-upload").files[0]

    if (!passportNumber || !address || !pin || !confirmPin || !passportFile || !selfieFile) {
      showMessage("kyc-error", "အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။")
      return
    }
    if (pin !== confirmPin) {
      showMessage("kyc-error", "PIN နှင့် အတည်ပြု PIN မတူညီပါ။")
      return
    }
    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      showMessage("kyc-error", "PIN သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။")
      return
    }

    processingOverlay.classList.add("active")
    try {
      const passportFileName = `passport_${currentUser.user_id}_${Date.now()}`
      const { error: passportError } = await supabase.storage
        .from("kyc-documents")
        .upload(passportFileName, passportFile)
      if (passportError) throw passportError
      const { data: passportUrl } = supabase.storage.from("kyc-documents").getPublicUrl(passportFileName)

      const selfieFileName = `selfie_${currentUser.user_id}_${Date.now()}`
      const { error: selfieError } = await supabase.storage.from("kyc-documents").upload(selfieFileName, selfieFile)
      if (selfieError) throw selfieError
      const { data: selfieUrl } = supabase.storage.from("kyc-documents").getPublicUrl(selfieFileName)

      const { error: updateError } = await supabase
        .from("users")
        .update({
          passport_number: passportNumber,
          address,
          payment_pin: pin,
          passport_image: passportUrl.publicUrl,
          selfie_image: selfieUrl.publicUrl,
          passport_status: "pending",
          submitted_at: new Date().toISOString(),
        })
        .eq("user_id", currentUser.user_id)
      if (updateError) throw updateError

      showMessage("kyc-success", "KYC အချက်အလက်များ အောင်မြင်စွာ တင်သွင်းပြီးပါပြီ။", true)
      userKycStatus = "pending"
      updateKycStatusUI()
      document.getElementById("kyc-form").reset()
    } catch (error) {
      console.error("KYC submission error:", error)
      showMessage("kyc-error", "KYC တင်သွင်းရာတွင် အမှားရှိနေပါသည်။")
    } finally {
      processingOverlay.classList.remove("active")
    }
  })

  // Change password form
  document.getElementById("save-password-btn").addEventListener("click", async () => {
    const currentPassword = document.getElementById("current-password").value
    const newPassword = document.getElementById("new-password").value
    const confirmNewPassword = document.getElementById("confirm-new-password").value

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      showMessage("change-password-error", "အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။")
      return
    }
    if (newPassword !== confirmNewPassword) {
      showMessage("change-password-error", "စကားဝှက်အသစ်နှင့် အတည်ပြုစကားဝှက် မတူညီပါ။")
      return
    }

    try {
      if (currentUser.password !== currentPassword) {
        showMessage("change-password-error", "လက်ရှိစကားဝှက် မှားယွင်းနေပါသည်။")
        return
      }
      const { error: updateError } = await supabase
        .from("auth_users")
        .update({ password: newPassword })
        .eq("user_id", currentUser.user_id)
      if (updateError) throw updateError

      showMessage("change-password-success", "စကားဝှက် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။", true)
      document.getElementById("change-password-modal").classList.remove("active")
    } catch (error) {
      console.error("Change password error:", error)
      showMessage("change-password-error", "စကားဝှက်ပြောင်းရာတွင် အမှားရှိနေပါသည်။")
    }
  })
}

// Show PIN entry modal
function showPinEntryModal() {
  document.querySelectorAll(".pin-input").forEach((input) => (input.value = ""))
  showMessage("pin-error", "", false) // Clear previous errors
  pinEntryModal.classList.add("active")
  document.querySelector(".pin-input").focus()
}

// Process transfer with PIN using the RPC function
async function processTransferWithPin(pin) {
  const phone = document.getElementById("transfer-phone").value
  const amount = Number.parseInt(document.getElementById("transfer-amount").value)
  const note = document.getElementById("transfer-note").value

  pinEntryModal.classList.remove("active")
  processingOverlay.classList.add("active")

  try {
    // Check PIN first
    if (userProfile.payment_pin !== pin) {
      throw new Error("PIN မှားယွင်းနေပါသည်။")
    }

    // Call the secure RPC function
    const { data: transaction, error } = await supabase.rpc("create_transaction", {
      sender_id: currentUser.user_id,
      recipient_phone: phone,
      transfer_amount: amount,
      transfer_note: note,
    })

    if (error) throw error

    // Simulate processing time
    setTimeout(async () => {
      processingOverlay.classList.remove("active")
      showMessage("transfer-success", `${amount.toLocaleString()} Ks ကို ${phone} သို့ အောင်မြင်စွာ လွှဲပြောင်းပြီးပါပြီ။`, true)

      // The RPC function already updated the balances, now we just need to show the receipt
      // and refresh local data
      await loadUserData() // Refresh all data to be safe
      showTransactionReceipt(transaction[0]) // The RPC returns an array with one object
      document.getElementById("transfer-form").reset()
      document.getElementById("recipient-info").style.display = "none"
    }, 2000)
  } catch (error) {
    console.error("Transfer error:", error)
    processingOverlay.classList.remove("active")
    showMessage("transfer-error", error.message)
  }
}

// Show transaction receipt
function showTransactionReceipt(transaction) {
  const isSender = transaction.from_phone === userProfile.phone

  const receiptHTML = `
        <div class="receipt">
            <div class="receipt-logo">
                <div class="receipt-logo-circle"><span class="receipt-logo-text">OPPER</span></div>
                <div class="receipt-logo-subtitle">OPPER Pay</div>
            </div>
            <div class="receipt-status">
                <div class="receipt-status-icon ${isSender ? "sent" : "received"}">
                    <i class="fas ${isSender ? "fa-paper-plane" : "fa-check-circle"}"></i>
                </div>
                <div class="receipt-status-text">${isSender ? "ငွေပေးပို့ပြီးပါပြီ" : "ငွေလက်ခံရရှိပါပြီ"}</div>
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
                ${transaction.note ? `<div class="receipt-detail-row"><div class="receipt-detail-label">Note</div><div class="receipt-detail-value">${transaction.note}</div></div>` : ""}
                <div class="receipt-detail-row">
                    <div class="receipt-detail-label">Date</div>
                    <div class="receipt-detail-value">${new Date(transaction.created_at).toLocaleString()}</div>
                </div>
            </div>
            <div class="receipt-transaction-id">
                <div class="receipt-transaction-id-label">ငွေလွှဲလုပ်ဆောင်ချက်အမှတ်စဥ်</div>
                <div class="receipt-transaction-id-value">${transaction.id}</div>
            </div>
            <div class="receipt-footer">OPPER Payment ကိုအသုံးပြုသည့်အတွက် ကျေးဇူးတင်ပါသည်</div>
        </div>
    `

  document.getElementById("receipt-container").innerHTML = receiptHTML
  receiptModal.classList.add("active")
}

// Download receipt as PNG
function downloadReceipt() {
  const receiptElement = document.getElementById("receipt-container")
  if (!receiptElement) return

  html2canvas(receiptElement).then((canvas) => {
    const link = document.createElement("a")
    link.download = `OPPER-Receipt-${Date.now()}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  })
}

// Generate user ID based on email (User's Original Logic)
function generateUserId(email) {
  const username = email.split("@")[0]
  const randomNum = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0")
  const timestamp = Date.now().toString().slice(-4)
  return `${username.slice(0, 4)}${randomNum}${timestamp}`
}

// Show specific page
function showPage(pageName) {
  const sidebarLinks = document.querySelectorAll(".sidebar-nav a")
  sidebarLinks.forEach((link) => {
    link.parentElement.classList.remove("active")
    if (link.getAttribute("data-page") === pageName) {
      link.parentElement.classList.add("active")
    }
  })

  const pages = document.querySelectorAll(".page")
  pages.forEach((page) => {
    page.classList.remove("active")
    if (page.id === `${pageName}-page`) {
      page.classList.add("active")
    }
  })

  document.getElementById("profile-dropdown").classList.remove("active")
  if (window.innerWidth < 992) {
    document.getElementById("sidebar").classList.remove("active")
  }
}

// Logout function
function logout() {
  localStorage.removeItem("opperSession")
  currentUser = null
  userProfile = null
  showAuthContainer()
}

// UI visibility helpers
function showLoader() {
  loader.classList.add("active")
}
function hideLoader() {
  loader.classList.remove("active")
}
function showAuthContainer() {
  authContainer.classList.remove("hidden")
  appContainer.classList.add("hidden")
}
function showAppContainer() {
  authContainer.classList.add("hidden")
  appContainer.classList.remove("hidden")
}

// Display temporary messages
function showMessage(elementId, message, isSuccess = false) {
  const el = document.getElementById(elementId)
  if (!el) return
  el.textContent = message
  el.style.display = message ? "block" : "none"

  // Clear other message type
  const otherType = isSuccess ? elementId.replace("success", "error") : elementId.replace("error", "success")
  const otherEl = document.getElementById(otherType)
  if (otherEl) otherEl.style.display = "none"

  if (message) {
    setTimeout(() => {
      el.style.display = "none"
    }, 5000)
  }
}
