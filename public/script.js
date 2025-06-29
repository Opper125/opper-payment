// Supabase Configuration
const supabaseUrl = "https://vtsczzlnhsrgnbkfyizi.supabase.co"
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68"
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, { fetch: (...args) => fetch(...args) })

// Import html2canvas
const html2canvas = window.html2canvas

// Global Variables
let currentUser = null
let userProfile = null // This will hold the full user profile from the 'users' table
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
  document.body.setAttribute("data-theme", currentTheme)
  showLoader()
  await checkSession()
  initializeUI()
  setTimeout(hideLoader, 1500)
})

// Check user session from localStorage
async function checkSession() {
  try {
    const session = localStorage.getItem("opperSession")
    if (session) {
      const sessionData = JSON.parse(session)
      // Verify session with the database
      const { data: user, error } = await supabase
        .from("auth_users")
        .select("*")
        .eq("user_id", sessionData.user_id)
        .single()

      if (error || !user) {
        localStorage.removeItem("opperSession")
        showAuthContainer()
        return
      }
      currentUser = user
      await loadUserData()
    } else {
      showAuthContainer()
    }
  } catch (error) {
    console.error("Session check error:", error)
    showAuthContainer()
  }
}

// Load all necessary user data
async function loadUserData() {
  try {
    if (!currentUser) return

    const { data: profileData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", currentUser.user_id)
      .single()

    if (userError) throw userError
    userProfile = profileData

    updateUserUI()

    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("allow_transfers")
      .eq("id", 1)
      .single()

    if (!settingsError && settings) {
      transfersEnabled = settings.allow_transfers
      updateTransferStatusUI()
    }

    await loadTransactions()
    setupRealtimeSubscriptions()
    showAppContainer()
  } catch (error) {
    console.error("Load user data error:", error)
    logout()
  }
}

// Update all UI elements with user data
function updateUserUI() {
  if (!currentUser || !userProfile) return

  const userInitial = currentUser.email.charAt(0).toUpperCase()
  const userName = userProfile.name || currentUser.email.split("@")[0]
  const userId = `ID: ${currentUser.user_id.slice(0, 8)}...`

  document.getElementById("user-initial").textContent = userInitial
  document.getElementById("user-initial-sidebar").textContent = userInitial
  document.getElementById("user-name").textContent = userName
  document.getElementById("user-name-sidebar").textContent = userName
  document.getElementById("user-id").textContent = userId
  document.getElementById("user-id-sidebar").textContent = userId
  document.getElementById("greeting-name").textContent = userName

  document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userProfile.balance.toLocaleString()} Ks`
  document.getElementById("balance-amount").textContent = `${userProfile.balance.toLocaleString()} Ks`

  updateKycStatusUI()

  document.getElementById("settings-phone").value = userProfile.phone || ""
  document.getElementById("settings-email").value = currentUser.email || ""
}

// Update KYC status display
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

  if (userProfile.passport_status === "approved") {
    level = 2
    status = "အတည်ပြုပြီး"
    iconClass = "approved"
    formDisplay = "none"
  } else if (userProfile.passport_status === "rejected") {
    status = "ငြင်းပယ်ခံရသည်"
    iconClass = "rejected"
  } else if (userProfile.passport_status === "pending") {
    status = "စောင့်ဆိုင်းဆဲ"
    formDisplay = "none"
  }

  kycStatusDisplay.className = `status-item level-${level}`
  kycStatusText.textContent = `KYC: Level ${level} (${status})`
  kycLevelTitle.textContent = `KYC Level ${level}`
  kycStatusMessage.textContent = status
  kycStatusIcon.className = `kyc-status-icon ${iconClass}`
  kycStatusIcon.innerHTML = `<i class="fas ${iconClass === "approved" ? "fa-check-circle" : iconClass === "rejected" ? "fa-times-circle" : "fa-clock"}"></i>`
  kycForm.style.display = formDisplay
}

// Update transfer status display
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
  supabase
    .channel(`public:users:user_id=eq.${currentUser.user_id}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "users", filter: `user_id=eq.${currentUser.user_id}` },
      (payload) => {
        userProfile = payload.new
        updateUserUI()
      },
    )
    .subscribe()

  supabase
    .channel("public:settings")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings", filter: "id=eq.1" }, (payload) => {
      transfersEnabled = payload.new.allow_transfers
      updateTransferStatusUI()
    })
    .subscribe()

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

// Load user transactions
async function loadTransactions() {
  if (!userProfile || !userProfile.phone) return
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .or(`from_phone.eq.${userProfile.phone},to_phone.eq.${userProfile.phone}`)
    .order("created_at", { ascending: false })
    .limit(10)

  if (error) {
    console.error("Error loading transactions:", error)
    return
  }
  transactions = data || []
  updateTransactionsUI()
}

// Update transaction lists in UI
function updateTransactionsUI() {
  const recentList = document.getElementById("recent-transactions-list")
  const historyList = document.getElementById("history-transactions-list")
  recentList.innerHTML = ""
  historyList.innerHTML = ""

  if (transactions.length === 0) {
    const emptyState = `<div class="empty-state"><i class="fas fa-history"></i><p>လုပ်ဆောင်ချက်မှတ်တမ်းမရှိသေးပါ</p></div>`
    recentList.innerHTML = emptyState
    historyList.innerHTML = emptyState
    return
  }

  transactions.forEach((tx, index) => {
    const isSender = tx.from_phone === userProfile.phone
    const itemHTML = `
      <div class="transaction-item ${isSender ? "sent" : "received"}">
        <div class="transaction-icon"><i class="fas ${isSender ? "fa-arrow-up" : "fa-arrow-down"}"></i></div>
        <div class="transaction-details">
          <div class="transaction-title">${isSender ? "To: " + tx.to_name : "From: " + tx.from_name}</div>
          <div class="transaction-date">${new Date(tx.created_at).toLocaleString()}</div>
        </div>
        <div class="transaction-amount ${isSender ? "negative" : "positive"}">
          ${isSender ? "-" : "+"} ${tx.amount.toLocaleString()} Ks
        </div>
      </div>`
    if (index < 5) recentList.innerHTML += itemHTML
    historyList.innerHTML += itemHTML
  })
}

// Initialize all UI event listeners
function initializeUI() {
  // Auth tabs
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.tab
      document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"))
      tab.classList.add("active")
      document.querySelectorAll(".auth-form").forEach((form) => {
        form.classList.toggle("active", form.id === `${tabName}-form`)
      })
    })
  })

  // Password visibility
  document.querySelectorAll(".toggle-password").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.previousElementSibling
      input.type = input.type === "password" ? "text" : "password"
      button.className = `fas ${input.type === "password" ? "fa-eye-slash" : "fa-eye"} toggle-password`
    })
  })

  // Sidebar navigation
  document.querySelectorAll(".sidebar-nav a, .action-card, .view-all").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault()
      showPage(link.dataset.page)
    })
  })

  // Mobile menu
  document
    .getElementById("menu-toggle")
    .addEventListener("click", () => document.getElementById("sidebar").classList.add("active"))
  document
    .getElementById("close-sidebar")
    .addEventListener("click", () => document.getElementById("sidebar").classList.remove("active"))

  // Profile dropdown
  const profileDropdownTrigger = document.getElementById("profile-dropdown-trigger")
  const profileDropdown = document.getElementById("profile-dropdown")
  profileDropdownTrigger.addEventListener("click", (e) => {
    e.stopPropagation()
    profileDropdown.classList.toggle("active")
  })
  document.addEventListener("click", () => profileDropdown.classList.remove("active"))
  document.getElementById("go-to-settings").addEventListener("click", () => showPage("settings"))
  document.getElementById("dropdown-logout").addEventListener("click", logout)

  // Logout button
  document.getElementById("logout-btn").addEventListener("click", logout)

  // Balance actions
  document.getElementById("refresh-balance").addEventListener("click", () => loadUserData())
  document.getElementById("hide-balance").addEventListener("click", () => {
    const balanceAmount = document.getElementById("balance-amount")
    const isHidden = balanceAmount.textContent.includes("•")
    balanceAmount.textContent = isHidden ? `${userProfile.balance.toLocaleString()} Ks` : "•••••• Ks"
    document.querySelector("#hide-balance i").className = `fas ${isHidden ? "fa-eye-slash" : "fa-eye"}`
  })

  // File uploads
  document.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      const file = e.target.files[0]
      if (!file) return
      const previewEl = document.getElementById(input.id.replace("-upload", "-preview"))
      const fileNameEl = document.getElementById(input.id.replace("-upload", "-file-name"))
      if (fileNameEl) fileNameEl.textContent = file.name
      const reader = new FileReader()
      reader.onload = (e) => {
        previewEl.innerHTML = `<img src="${e.target.result}" alt="Preview">`
      }
      reader.readAsDataURL(file)
    })
  })

  // Theme selector
  document.querySelectorAll(".theme-option").forEach((option) => {
    if (option.dataset.theme === currentTheme) option.classList.add("active")
    option.addEventListener("click", () => {
      const theme = option.dataset.theme
      document.body.setAttribute("data-theme", theme)
      localStorage.setItem("theme", theme)
      currentTheme = theme
      document.querySelectorAll(".theme-option").forEach((o) => o.classList.remove("active"))
      option.classList.add("active")
    })
  })

  // Modal handling
  const modalTriggers = {
    "change-password-btn": "change-password-modal",
    "change-pin-btn": "change-pin-modal",
    "delete-account-btn": "delete-account-modal",
  }
  Object.entries(modalTriggers).forEach(([triggerId, modalId]) => {
    document
      .getElementById(triggerId)
      ?.addEventListener("click", () => document.getElementById(modalId).classList.add("active"))
  })
  document.querySelectorAll(".modal-close, .modal-cancel").forEach((button) => {
    button.addEventListener("click", () => button.closest(".modal").classList.remove("active"))
  })
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("active")
    })
  })

  // PIN Input
  setupPinInputs()
  setupFormSubmissions()
  document.getElementById("transfer-phone").addEventListener("input", handleRecipientCheck)
  document.getElementById("download-receipt").addEventListener("click", downloadReceipt)
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

// Setup all form submission handlers
function setupFormSubmissions() {
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault()
    const email = document.getElementById("login-email").value
    const password = document.getElementById("login-password").value
    const { data: user, error } = await supabase.from("auth_users").select("*").eq("email", email).single()

    if (error || !user || user.password !== password) {
      return showMessage("login-error", "အီးမေးလ် (သို့) စကားဝှက် မှားယွင်းနေပါသည်။")
    }

    currentUser = user
    localStorage.setItem("opperSession", JSON.stringify({ user_id: user.user_id }))
    await loadUserData()
  })

  document.getElementById("signup-form").addEventListener("submit", async (e) => {
    e.preventDefault()
    const email = document.getElementById("signup-email").value
    const phone = document.getElementById("signup-phone").value
    const password = document.getElementById("signup-password").value
    if (password !== document.getElementById("signup-confirm-password").value) {
      return showMessage("signup-error", "စကားဝှက် မတူညီပါ။")
    }
    // This is a simplified signup. A real app should use Supabase Auth.
    // For this demo, we follow the user's original logic.
    const userId = generateUserId(email)
    const { data: authUser, error: authError } = await supabase
      .from("auth_users")
      .insert([{ user_id: userId, email, password }])
      .select()
      .single()
    if (authError) return showMessage("signup-error", "အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။")

    const { error: profileError } = await supabase
      .from("users")
      .insert([{ user_id: userId, phone, balance: 0, passport_status: "pending" }])
    if (profileError) return showMessage("signup-error", "အကောင့်အချက်အလက်ဖန်တီးရာတွင် အမှားရှိနေပါသည်။")

    showMessage("signup-success", "အကောင့်ဖွင့်ပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။")
  })

  document.getElementById("transfer-form").addEventListener("submit", (e) => {
    e.preventDefault()
    const amount = Number.parseInt(document.getElementById("transfer-amount").value)
    if (userProfile.balance < amount) return showMessage("transfer-error", "လက်ကျန်ငွေ မလုံလောက်ပါ။")
    if (userProfile.passport_status !== "approved") return showMessage("transfer-error", "ငွေလွှဲရန် KYC အတည်ပြုရန် လိုအပ်ပါသည်။")
    pinEntryModal.classList.add("active")
    document.querySelector(".pin-input").focus()
  })

  document.getElementById("kyc-form").addEventListener("submit", async (e) => {
    e.preventDefault()
    // KYC submission logic here...
    showMessage("kyc-success", "KYC အချက်အလက်များ တင်သွင်းပြီးပါပြီ။")
  })
}

// Setup PIN input functionality
function setupPinInputs() {
  const pinInputs = document.querySelectorAll(".pin-input")
  pinInputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      if (input.value && index < pinInputs.length - 1) {
        pinInputs[index + 1].focus()
      }
    })
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && index > 0) {
        pinInputs[index - 1].focus()
      }
    })
  })
  document.getElementById("confirm-pin-btn").addEventListener("click", processTransferWithPin)
}

// Process transfer after PIN confirmation
async function processTransferWithPin() {
  const pin = Array.from(document.querySelectorAll(".pin-input"))
    .map((i) => i.value)
    .join("")
  if (pin !== userProfile.payment_pin) {
    return showMessage("pin-error", "PIN မှားယွင်းနေပါသည်။")
  }

  pinEntryModal.classList.remove("active")
  processingOverlay.classList.add("active")

  const amount = Number.parseInt(document.getElementById("transfer-amount").value)
  const to_phone = document.getElementById("transfer-phone").value
  const note = document.getElementById("transfer-note").value

  try {
    // This should ideally be a server-side function (RPC) for security
    const { data: transaction, error } = await supabase.rpc("create_transaction", {
      sender_id: currentUser.user_id,
      recipient_phone: to_phone,
      transfer_amount: amount,
      transfer_note: note,
    })

    if (error) throw error

    setTimeout(async () => {
      processingOverlay.classList.remove("active")
      showMessage("transfer-success", "ငွေလွှဲခြင်း အောင်မြင်ပါသည်။")
      await loadUserData()
      showTransactionReceipt(transaction[0])
      document.getElementById("transfer-form").reset()
      document.getElementById("recipient-info").style.display = "none"
    }, 2000)
  } catch (error) {
    processingOverlay.classList.remove("active")
    showMessage("transfer-error", `ငွေလွှဲခြင်း မအောင်မြင်ပါ: ${error.message}`)
  }
}

// Show transaction receipt modal
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

// Download receipt as image
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

// Generate user ID based on email
function generateUserId(email) {
  const username = email.split("@")[0]
  const randomNum = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0")
  const timestamp = Date.now().toString().slice(-4)
  return `${username.slice(0, 4)}${randomNum}${timestamp}`
}

// Navigate between pages
function showPage(pageName) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"))
  document.getElementById(`${pageName}-page`).classList.add("active")
  document.querySelectorAll(".sidebar-nav li").forEach((li) => li.classList.remove("active"))
  document.querySelector(`.sidebar-nav a[data-page="${pageName}"]`).parentElement.classList.add("active")
  if (window.innerWidth < 992) {
    document.getElementById("sidebar").classList.remove("active")
  }
}

// Logout user
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
function showMessage(elementId, message) {
  const el = document.getElementById(elementId)
  el.textContent = message
  el.style.display = "block"
  setTimeout(() => {
    el.style.display = "none"
  }, 5000)
}
