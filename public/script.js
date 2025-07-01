// Supabase Configuration
const supabaseUrl = "https://vtsczzlnhsrgnbkfyizi.supabase.co"
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68"
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, { fetch: (...args) => fetch(...args) })

// Global Variables
let currentUser = null
let userBalance = 0
let userKycStatus = "pending"
let transfersEnabled = true
let currentTheme = localStorage.getItem("theme") || "light"
let transactions = []

// DOM Elements
const loader = document.getElementById("loader")
const authContainer = document.getElementById("auth-container")
const appContainer = document.getElementById("app-container")
const pinEntryModal = document.getElementById("pin-entry-modal")
const receiptModal = document.getElementById("receipt-modal")
const processingOverlay = document.getElementById("processing-overlay")

// Import html2canvas
const html2canvas = window.html2canvas

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
  document.body.setAttribute("data-theme", currentTheme)
  showLoader()
  await checkSession()
  initializeUI()
  setTimeout(hideLoader, 1500)
})

// --- UTILITY FUNCTIONS ---

// Debounce function to limit API calls
function debounce(func, delay) {
  let timeout
  return function (...args) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), delay)
  }
}

// Animate balance changes
function animateBalance(elements, start, end, duration) {
  if (start === end) return
  let startTimestamp = null
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp
    const progress = Math.min((timestamp - startTimestamp) / duration, 1)
    const currentValue = Math.floor(progress * (end - start) + start)

    elements.forEach((el) => {
      if (!el) return
      if (el.id === "user-balance") {
        el.textContent = `လက်ကျန်ငွေ: ${currentValue.toLocaleString()} Ks`
      } else if (el.id === "balance-amount") {
        if (!el.classList.contains("hidden-balance")) {
          el.textContent = `${currentValue.toLocaleString()} Ks`
        }
      }
    })

    if (progress < 1) {
      window.requestAnimationFrame(step)
    } else {
      elements.forEach((el) => {
        if (!el) return
        if (el.id === "user-balance") {
          el.textContent = `လက်ကျန်ငွေ: ${end.toLocaleString()} Ks`
        } else if (el.id === "balance-amount") {
          if (!el.classList.contains("hidden-balance")) {
            el.textContent = `${end.toLocaleString()} Ks`
          }
        }
      })
    }
  }
  window.requestAnimationFrame(step)
}

// Play sound function
function playSound(soundId) {
  try {
    const sound = document.getElementById(soundId)
    if (sound) {
      sound.currentTime = 0 // Rewind to the start
      sound.play().catch((error) => console.log(`Audio play failed for ${soundId}: ${error}`))
    }
  } catch (error) {
    console.error(`Could not play sound ${soundId}:`, error)
  }
}

// --- AUTH & SESSION MANAGEMENT ---

async function checkSession() {
  try {
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
        localStorage.removeItem("opperSession")
        showAuthContainer()
        return
      }

      currentUser = user
      await loadUserData()
      showAppContainer()
    } else {
      showAuthContainer()
    }
  } catch (error) {
    console.error("Session check error:", error)
    showAuthContainer()
  }
}

async function loadUserData() {
  try {
    if (!currentUser) return

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", currentUser.user_id)
      .single()

    if (userError) throw userError

    userBalance = userData.balance || 0
    userKycStatus = userData.passport_status || "pending"

    updateUserUI(userData)

    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("allow_transfers")
      .eq("id", 1)
      .single()

    if (!settingsError && settings) {
      transfersEnabled = settings.allow_transfers
      updateTransferStatus()
    }

    setupRealtimeSubscriptions()
    loadTransactions()
  } catch (error) {
    console.error("Load user data error:", error)
  }
}

// --- UI UPDATE FUNCTIONS ---

function updateUserUI(userData) {
  const userInitial = currentUser.email.charAt(0).toUpperCase()
  const userName = currentUser.email.split("@")[0]

  document.getElementById("user-initial").textContent = userInitial
  document.getElementById("user-initial-sidebar").textContent = userInitial
  document.getElementById("user-name").textContent = userName
  document.getElementById("user-name-sidebar").textContent = userName
  document.getElementById("user-id").textContent = `ID: ${currentUser.user_id}`
  document.getElementById("user-id-sidebar").textContent = `ID: ${currentUser.user_id}`
  document.getElementById("greeting-name").textContent = userName

  document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`
  document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`

  updateKycStatus()

  document.getElementById("settings-phone").value = userData.phone || ""
  document.getElementById("settings-email").value = currentUser.email || ""
}

function updateKycStatus() {
  const kycStatusElement = document.getElementById("kyc-status")
  const kycForm = document.getElementById("kyc-form")
  const kycStatusMessage = document.getElementById("kyc-status-message")
  const kycStatusIcon = document.querySelector(".kyc-status-icon")

  kycStatusIcon.classList.remove("pending", "approved", "rejected")

  if (userKycStatus === "approved") {
    kycStatusElement.textContent = "KYC: အတည်ပြုပြီး"
    kycStatusMessage.textContent = "သင့် KYC အတည်ပြုပြီးဖြစ်ပါသည်။"
    kycStatusIcon.classList.add("approved")
    kycStatusIcon.innerHTML = '<i class="fas fa-check-circle"></i>'
    kycForm.style.display = "none"
  } else if (userKycStatus === "rejected") {
    kycStatusElement.textContent = "KYC: ငြင်းပယ်ခံရသည်"
    kycStatusMessage.textContent = "သင့် KYC ငြင်းပယ်ခံရပါသည်။ ပြန်လည်တင်သွင်းပါ။"
    kycStatusIcon.classList.add("rejected")
    kycStatusIcon.innerHTML = '<i class="fas fa-times-circle"></i>'
    kycForm.style.display = "block"
  } else {
    kycStatusElement.textContent = "KYC: စောင့်ဆိုင်းဆဲ"
    kycStatusMessage.textContent = "သင့် KYC စိစစ်နေဆဲဖြစ်ပါသည်။"
    kycStatusIcon.classList.add("pending")
    kycStatusIcon.innerHTML = '<i class="fas fa-clock"></i>'

    if (currentUser) {
      supabase
        .from("users")
        .select("passport_number, passport_image")
        .eq("user_id", currentUser.user_id)
        .single()
        .then(({ data }) => {
          if (data && data.passport_number && data.passport_image) {
            kycForm.style.display = "none"
          } else {
            kycForm.style.display = "block"
          }
        })
    }
  }
}

function updateTransferStatus() {
  const transferStatusElement = document.getElementById("transfer-status")

  if (transfersEnabled) {
    transferStatusElement.textContent = "ငွေလွှဲခြင်း: ခွင့်ပြုထားသည်"
    transferStatusElement.classList.remove("disabled")
    transferStatusElement.classList.add("enabled")
  } else {
    transferStatusElement.textContent = "ငွေလွှဲခြင်း: ပိတ်ထားသည်"
    transferStatusElement.classList.remove("enabled")
    transferStatusElement.classList.add("disabled")
  }
}

// --- REALTIME & TRANSACTIONS ---

function setupRealtimeSubscriptions() {
  const userChannel = supabase
    .channel("user-updates")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "users",
        filter: `user_id=eq.${currentUser.user_id}`,
      },
      (payload) => {
        if (payload.new.balance !== userBalance) {
          const oldBalance = userBalance
          const newBalance = payload.new.balance

          if (newBalance > oldBalance) {
            playSound("transfer-received-sound")
          }

          userBalance = newBalance

          const balanceElements = [document.getElementById("user-balance"), document.getElementById("balance-amount")]
          animateBalance(balanceElements, oldBalance, newBalance, 1500)
        }

        if (payload.new.passport_status !== userKycStatus) {
          userKycStatus = payload.new.passport_status
          updateKycStatus()
        }
      },
    )
    .subscribe()

  const settingsChannel = supabase
    .channel("settings-updates")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "settings",
      },
      (payload) => {
        if (payload.new.allow_transfers !== transfersEnabled) {
          transfersEnabled = payload.new.allow_transfers
          updateTransferStatus()
        }
      },
    )
    .subscribe()

  const transactionsChannel = supabase
    .channel("transactions-updates")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "transactions",
      },
      (payload) => {
        if (
          currentUser &&
          (payload.new.from_phone === currentUser.phone || payload.new.to_phone === currentUser.phone)
        ) {
          loadTransactions()
        }
      },
    )
    .subscribe()
}

async function loadTransactions() {
  try {
    if (!currentUser) return

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("phone")
      .eq("user_id", currentUser.user_id)
      .single()

    if (userError || !userData || !userData.phone) return

    const userPhone = userData.phone

    const { data: transactionsData, error } = await supabase
      .from("transactions")
      .select("*")
      .or(`from_phone.eq.${userPhone},to_phone.eq.${userPhone}`)
      .order("created_at", { ascending: false })
      .limit(10)

    if (error) throw error

    transactions = transactionsData || []
    updateTransactionsUI(transactions, userPhone)
  } catch (error) {
    console.error("Load transactions error:", error)
  }
}

function updateTransactionsUI(transactions, userPhone) {
  const recentTransactionsList = document.getElementById("recent-transactions-list")
  const historyTransactionsList = document.getElementById("history-transactions-list")

  recentTransactionsList.innerHTML = ""
  historyTransactionsList.innerHTML = ""

  if (!transactions || transactions.length === 0) {
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

  transactions.forEach((transaction, index) => {
    const isSender = transaction.from_phone === userPhone
    const otherParty = isSender ? transaction.to_phone : transaction.from_phone
    const transactionDate = new Date(transaction.created_at).toLocaleString()

    const transactionItem = `
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
                  <button class="transaction-view-btn clickable" data-transaction-index="${index}">
                      <i class="fas fa-eye"></i>
                  </button>
              </div>
          </div>
      `

    if (index < 5) {
      recentTransactionsList.innerHTML += transactionItem
    }
    historyTransactionsList.innerHTML += transactionItem
  })

  document.querySelectorAll(".transaction-view-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const transactionIndex = button.getAttribute("data-transaction-index")
      showTransactionReceipt(transactions[transactionIndex])
    })
  })
}

// --- UI INITIALIZATION & EVENT LISTENERS ---

function initializeUI() {
  // Global click sound listener
  document.body.addEventListener("click", (e) => {
    if (e.target.closest(".clickable")) {
      playSound("click-sound")
    }
  })

  // Auth tabs
  const authTabs = document.querySelectorAll(".auth-tab")
  const authForms = document.querySelectorAll(".auth-form")
  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.getAttribute("data-tab")
      authTabs.forEach((t) => t.classList.remove("active"))
      tab.classList.add("active")
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
  const pages = document.querySelectorAll(".page")
  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault()
      showPage(link.getAttribute("data-page"))
    })
  })

  // Quick action cards
  const actionCards = document.querySelectorAll(".action-card")
  actionCards.forEach((card) => {
    card.addEventListener("click", () => {
      showPage(card.getAttribute("data-page"))
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
  document.getElementById("logout-btn").addEventListener("click", logout)

  // Balance actions
  document.getElementById("refresh-balance").addEventListener("click", async () => await loadUserData())
  document.getElementById("hide-balance").addEventListener("click", () => {
    const balanceAmount = document.getElementById("balance-amount")
    if (balanceAmount.classList.contains("hidden-balance")) {
      balanceAmount.textContent = `${userBalance.toLocaleString()} Ks`
      balanceAmount.classList.remove("hidden-balance")
      document.querySelector("#hide-balance i").classList.replace("fa-eye", "fa-eye-slash")
    } else {
      balanceAmount.textContent = "••••••"
      balanceAmount.classList.add("hidden-balance")
      document.querySelector("#hide-balance i").classList.replace("fa-eye-slash", "fa-eye")
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
      if (e.target === modal) {
        modal.classList.remove("active")
      }
    })
  })

  // PIN Input handling
  setupPinInputs()

  // Download receipt button
  document.getElementById("download-receipt").addEventListener("click", downloadReceipt)

  // Form submissions
  setupFormSubmissions()
}

function setupPinInputs() {
  const pinInputs = document.querySelectorAll(".pin-input")
  pinInputs.forEach((input, index) => {
    input.addEventListener("input", (e) => {
      if (e.target.value) {
        const nextInput = pinInputs[index + 1]
        if (nextInput) nextInput.focus()
      }
    })
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !e.target.value) {
        const prevInput = pinInputs[index - 1]
        if (prevInput) prevInput.focus()
      }
    })
  })
  document.getElementById("confirm-pin-btn").addEventListener("click", () => {
    let pin = ""
    pinInputs.forEach((input) => {
      pin += input.value
    })
    if (pin.length !== 6) {
      document.getElementById("pin-error").textContent = "PIN ၆ လုံး ထည့်ပါ"
      document.getElementById("pin-error").style.display = "block"
      return
    }
    processTransfer(pin)
  })
}

// --- FORM SUBMISSIONS & LOGIC ---

function setupFormSubmissions() {
  // Login form
  document.getElementById("login-btn").addEventListener("click", async () => {
    const email = document.getElementById("login-email").value
    const password = document.getElementById("login-password").value
    const errorElement = document.getElementById("login-error")
    const successElement = document.getElementById("login-success")
    if (!email || !password) {
      errorElement.textContent = "အီးမေးလ်နှင့် စကားဝှက် ထည့်ပါ။"
      errorElement.style.display = "block"
      return
    }
    try {
      const { data: user, error } = await supabase.from("auth_users").select("*").eq("email", email).single()
      if (error || !user) {
        errorElement.textContent = "အကောင့်မတွေ့ရှိပါ။"
        errorElement.style.display = "block"
        return
      }
      if (user.password !== password) {
        errorElement.textContent = "စကားဝှက်မှားယွင်းနေပါသည်။"
        errorElement.style.display = "block"
        return
      }
      currentUser = user
      localStorage.setItem("opperSession", JSON.stringify({ email: user.email, user_id: user.user_id }))
      successElement.textContent = "အကောင့်ဝင်ရောက်နေပါသည်..."
      successElement.style.display = "block"
      await loadUserData()
      showAppContainer()
    } catch (error) {
      errorElement.textContent = "အကောင့်ဝင်ရာတွင် အမှားရှိနေပါသည်။"
      errorElement.style.display = "block"
    }
  })

  // Google login
  document.getElementById("google-login-btn").addEventListener("click", () => simulateGoogleLogin("login"))

  // Signup form
  document.getElementById("signup-btn").addEventListener("click", async () => {
    const email = document.getElementById("signup-email").value
    const phone = document.getElementById("signup-phone").value
    const password = document.getElementById("signup-password").value
    const confirmPassword = document.getElementById("signup-confirm-password").value
    const termsAgree = document.getElementById("terms-agree").checked
    const errorElement = document.getElementById("signup-error")
    const successElement = document.getElementById("signup-success")

    if (!email || !phone || !password || !confirmPassword) {
      errorElement.textContent = "အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။"
      errorElement.style.display = "block"
      return
    }
    if (password !== confirmPassword) {
      errorElement.textContent = "စကားဝှက်နှင့် အတည်ပြုစကားဝှက် မတူညီပါ။"
      errorElement.style.display = "block"
      return
    }
    if (!termsAgree) {
      errorElement.textContent = "စည်းမျဉ်းစည်းကမ်းများကို သဘောတူရန် လိုအပ်ပါသည်။"
      errorElement.style.display = "block"
      return
    }

    try {
      const { data: existingUser } = await supabase.from("auth_users").select("email").eq("email", email).single()
      if (existingUser) {
        errorElement.textContent = "ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
        errorElement.style.display = "block"
        return
      }
      const { data: existingPhone } = await supabase.from("users").select("phone").eq("phone", phone).single()
      if (existingPhone) {
        errorElement.textContent = "ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
        errorElement.style.display = "block"
        return
      }

      const userId = generateUserId(email)
      const { error: authError } = await supabase.from("auth_users").insert([{ email, password, user_id: userId }])
      if (authError) throw authError

      const { error: profileError } = await supabase
        .from("users")
        .insert([{ user_id: userId, phone, balance: 0, passport_status: "pending" }])
      if (profileError) throw profileError

      successElement.textContent = "အကောင့်ဖွင့်ပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။"
      successElement.style.display = "block"
      document.getElementById("signup-form").reset()
      setTimeout(() => document.querySelector('.auth-tab[data-tab="login"]').click(), 2000)
    } catch (error) {
      errorElement.textContent = "အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။"
      errorElement.style.display = "block"
    }
  })

  // Google signup
  document.getElementById("google-signup-btn").addEventListener("click", () => simulateGoogleLogin("signup"))

  // Transfer form - Recipient Check Logic
  const transferPhoneInput = document.getElementById("transfer-phone")
  const recipientInfoBox = document.getElementById("recipient-info")
  const transferBtn = document.getElementById("transfer-btn")

  const checkRecipient = async () => {
    const phone = transferPhoneInput.value
    if (phone.length < 9) {
      recipientInfoBox.style.display = "none"
      transferBtn.disabled = true
      return
    }

    recipientInfoBox.className = "recipient-info-box loading"
    recipientInfoBox.innerHTML = `<div class="spinner"></div> Loading...`
    recipientInfoBox.style.display = "flex"
    transferBtn.disabled = true

    try {
      // Fetch current user's phone number first
      const { data: currentUserData, error: currentUserError } = await supabase
        .from("users")
        .select("phone")
        .eq("user_id", currentUser.user_id)
        .single()

      if (currentUserError || !currentUserData) {
        throw new Error("Could not fetch current user's phone number.")
      }

      const currentUserPhone = currentUserData.phone

      // Check if the input phone is the user's own phone
      if (phone === currentUserPhone) {
        recipientInfoBox.className = "recipient-info-box error show"
        recipientInfoBox.innerHTML = `<i class="icon fas fa-exclamation-circle"></i> ကိုယ့်ကိုယ်ကို ငွေလွှဲ၍မရပါ။`
        transferBtn.disabled = true
        return
      }

      // Now, check the recipient's details
      const { data: recipient, error } = await supabase
        .from("users")
        .select("name, passport_status, phone")
        .eq("phone", phone)
        .single()

      if (error || !recipient) {
        recipientInfoBox.className = "recipient-info-box error show"
        recipientInfoBox.innerHTML = `<i class="icon fas fa-times-circle"></i> အကောင့်မတွေ့ရှိပါ။`
        transferBtn.disabled = true
        return
      }

      const kycStatusClass = recipient.passport_status === "approved" ? "approved" : "pending"
      const kycStatusText = recipient.passport_status === "approved" ? "KYC Verified" : "KYC Pending"

      recipientInfoBox.className = "recipient-info-box success show"
      recipientInfoBox.innerHTML = `
          <div>
              <i class="icon fas fa-user-check"></i> 
              <span>${recipient.name || "အမည်မသိ"}</span>
          </div>
          <span class="recipient-kyc-status ${kycStatusClass}">${kycStatusText}</span>
      `
      transferBtn.disabled = false
    } catch (e) {
      console.error("Recipient check error:", e)
      recipientInfoBox.className = "recipient-info-box error show"
      recipientInfoBox.innerHTML = `<i class="icon fas fa-exclamation-triangle"></i> စစ်ဆေးရာတွင် အမှားရှိနေပါသည်။`
      transferBtn.disabled = true
    }
  }

  transferPhoneInput.addEventListener("input", debounce(checkRecipient, 500))

  // Transfer button click
  transferBtn.addEventListener("click", async () => {
    const amount = Number.parseInt(document.getElementById("transfer-amount").value)
    const errorElement = document.getElementById("transfer-error")

    if (!amount || amount < 1000) {
      errorElement.textContent = "ငွေပမာဏ အနည်းဆုံး 1,000 Ks ဖြစ်ရပါမည်။"
      errorElement.style.display = "block"
      return
    }
    if (!transfersEnabled) {
      errorElement.textContent = "ငွေလွှဲခြင်းကို ယာယီပိတ်ထားပါသည်။"
      errorElement.style.display = "block"
      return
    }
    if (userKycStatus !== "approved") {
      errorElement.textContent = "ငွေလွှဲရန် KYC အတည်ပြုရန် လိုအပ်ပါသည်။"
      errorElement.style.display = "block"
      return
    }
    if (userBalance < amount) {
      errorElement.textContent = "လက်ကျန်ငွေ မလုံလောက်ပါ။"
      errorElement.style.display = "block"
      return
    }

    // Final validation: Prevent self-transfer
    const { data: currentUserData, error: currentUserError } = await supabase
      .from("users")
      .select("phone")
      .eq("user_id", currentUser.user_id)
      .single()

    if (currentUserError || !currentUserData) {
      errorElement.textContent = "အသုံးပြုသူ အချက်အလက် ရယူရာတွင် အမှားရှိနေပါသည်။"
      errorElement.style.display = "block"
      return
    }

    const recipientPhone = document.getElementById("transfer-phone").value
    if (recipientPhone === currentUserData.phone) {
      errorElement.textContent = "ကိုယ့်ကိုယ်ကို ငွေလွှဲ၍မရပါ။"
      errorElement.style.display = "block"
      return
    }

    errorElement.style.display = "none"
    showPinEntryModal()
  })

  // KYC form
  document.getElementById("kyc-submit-btn").addEventListener("click", async () => {
    const passportNumber = document.getElementById("kyc-passport").value
    const address = document.getElementById("kyc-address").value
    const pin = document.getElementById("kyc-pin").value
    const confirmPin = document.getElementById("kyc-confirm-pin").value
    const passportFile = document.getElementById("passport-upload").files[0]
    const selfieFile = document.getElementById("selfie-upload").files[0]
    const errorElement = document.getElementById("kyc-error")
    const successElement = document.getElementById("kyc-success")

    if (!passportNumber || !address || !pin || !confirmPin || !passportFile || !selfieFile) {
      errorElement.textContent = "အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။"
      errorElement.style.display = "block"
      return
    }
    if (pin !== confirmPin) {
      errorElement.textContent = "PIN နှင့် အတည်ပြု PIN မတူညီပါ။"
      errorElement.style.display = "block"
      return
    }
    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      errorElement.textContent = "PIN သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။"
      errorElement.style.display = "block"
      return
    }

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

      successElement.textContent = "KYC အချက်အလက်များ အောင်မြင်စွာ တင်သွင်းပြီးပါပြီ။"
      successElement.style.display = "block"
      userKycStatus = "pending"
      updateKycStatus()
      document.getElementById("kyc-form").reset()
      document.getElementById("passport-preview").innerHTML = ""
      document.getElementById("selfie-preview").innerHTML = ""
    } catch (error) {
      errorElement.textContent = "KYC တင်သွင်းရာတွင် အမှားရှိနေပါသည်။"
      errorElement.style.display = "block"
    }
  })

  // Change password form
  document.getElementById("save-password-btn").addEventListener("click", async () => {
    const currentPassword = document.getElementById("current-password").value
    const newPassword = document.getElementById("new-password").value
    const confirmNewPassword = document.getElementById("confirm-new-password").value
    const errorElement = document.getElementById("change-password-error")
    const successElement = document.getElementById("change-password-success")

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      errorElement.textContent = "အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။"
      errorElement.style.display = "block"
      return
    }
    if (newPassword !== confirmNewPassword) {
      errorElement.textContent = "စကားဝှက်အသစ်နှင့် အတည်ပြုစကားဝှက် မတူညီပါ။"
      errorElement.style.display = "block"
      return
    }

    try {
      const { data: user, error } = await supabase
        .from("auth_users")
        .select("password")
        .eq("user_id", currentUser.user_id)
        .single()
      if (error) throw error
      if (user.password !== currentPassword) {
        errorElement.textContent = "လက်ရှိစကားဝှက် မှားယွင်းနေပါသည်။"
        errorElement.style.display = "block"
        return
      }

      const { error: updateError } = await supabase
        .from("auth_users")
        .update({ password: newPassword })
        .eq("user_id", currentUser.user_id)
      if (updateError) throw updateError

      successElement.textContent = "စကားဝှက် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။"
      successElement.style.display = "block"
      document.getElementById("change-password-modal").querySelector("form").reset()
      setTimeout(() => document.getElementById("change-password-modal").classList.remove("active"), 2000)
    } catch (error) {
      errorElement.textContent = "စကားဝှက်ပြောင်းရာတွင် အမှားရှိနေပါသည်။"
      errorElement.style.display = "block"
    }
  })
}

function showPinEntryModal() {
  document.querySelectorAll(".pin-input").forEach((input) => {
    input.value = ""
  })
  document.getElementById("pin-error").style.display = "none"
  pinEntryModal.classList.add("active")
  document.querySelector(".pin-input").focus()
}

async function processTransfer(pin) {
  const phone = document.getElementById("transfer-phone").value
  const amount = Number.parseInt(document.getElementById("transfer-amount").value)
  const note = document.getElementById("transfer-note").value
  const errorElement = document.getElementById("transfer-error")
  const successElement = document.getElementById("transfer-success")

  pinEntryModal.classList.remove("active")
  processingOverlay.classList.add("active")

  try {
    const { data: sender, error: senderError } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", currentUser.user_id)
      .single()
    if (senderError) throw senderError

    if (sender.payment_pin !== pin) {
      processingOverlay.classList.remove("active")
      errorElement.textContent = "PIN မှားယွင်းနေပါသည်။"
      errorElement.style.display = "block"
      return
    }

    const { data: recipient, error: recipientError } = await supabase
      .from("users")
      .select("*")
      .eq("phone", phone)
      .single()
    if (recipientError) throw recipientError

    const transactionId = `OPPER${Math.floor(1000000 + Math.random() * 9000000)}`
    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .insert([
        {
          id: transactionId,
          from_phone: sender.phone,
          from_name: sender.name || sender.phone,
          to_phone: recipient.phone,
          to_name: recipient.name || recipient.phone,
          amount,
          note,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single()
    if (transactionError) throw transactionError

    await supabase
      .from("users")
      .update({ balance: sender.balance - amount })
      .eq("user_id", sender.user_id)
    await supabase
      .from("users")
      .update({ balance: recipient.balance + amount })
      .eq("user_id", recipient.user_id)

    const oldBalance = userBalance
    userBalance -= amount
    const balanceElements = [document.getElementById("user-balance"), document.getElementById("balance-amount")]
    animateBalance(balanceElements, oldBalance, userBalance, 1500)

    setTimeout(() => {
      processingOverlay.classList.remove("active")
      playSound("transfer-sent-sound")
      successElement.textContent = `${amount.toLocaleString()} Ks ကို ${phone} သို့ အောင်မြင်စွာ လွှဲပြောင်းပြီးပါပြီ။`
      successElement.style.display = "block"
      showTransactionReceipt(transaction)
      document.getElementById("transfer-form").reset()
      document.getElementById("recipient-info").style.display = "none"
      document.getElementById("transfer-btn").disabled = true
      loadTransactions()
    }, 2000)
  } catch (error) {
    console.error("Transfer error:", error)
    processingOverlay.classList.remove("active")
    errorElement.textContent = "ငွေလွှဲရာတွင် အမှားရှိနေပါသည်။"
    errorElement.style.display = "block"
  }
}

function showTransactionReceipt(transaction) {
  supabase
    .from("users")
    .select("phone")
    .eq("user_id", currentUser.user_id)
    .single()
    .then(({ data: userData }) => {
      if (!userData) return
      const userPhone = userData.phone
      const isSender = transaction.from_phone === userPhone
      // Use the direct raw link for the logo
      const logoUrl = "https://github.com/Opper125/opper-payment/raw/42da71c16cb8ee8f19310e9be230acd639efc48a/logo.png"

      const receiptHTML = `
          <div class="receipt" id="receipt-to-download">
              <div class="receipt-logo-area">
                  <div class="opper-logo-container">
                      <img src="${logoUrl}" alt="OPPER Logo" class="opper-logo-img" crossOrigin="anonymous">
                      <span class="opper-logo-text">OPPER Pay</span>
                  </div>
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
                  <div class="receipt-transaction-id-value-wrapper">
                      <span class="receipt-transaction-id-value">${transaction.id}</span>
                      <button class="copy-tx-id-btn clickable" onclick="copyTransactionId('${transaction.id}', this)">
                          <i class="far fa-copy"></i>
                          <span class="tooltip-text">Copied!</span>
                      </button>
                  </div>
              </div>
              <div class="receipt-footer">OPPER Payment ကိုအသုံးပြုသည့်အတွက် ကျေးဇူးတင်ပါသည်</div>
          </div>
      `
      document.getElementById("receipt-container").innerHTML = receiptHTML
      receiptModal.classList.add("active")
    })
}

function copyTransactionId(txId, element) {
  navigator.clipboard.writeText(txId).then(() => {
    element.classList.add("copied")
    setTimeout(() => {
      element.classList.remove("copied")
    }, 1500)
  })
}

function downloadReceipt() {
  const receiptElement = document.getElementById("receipt-to-download")
  if (!receiptElement) return
  html2canvas(receiptElement, {
    useCORS: true,
    backgroundColor: "#ffffff",
    scale: 2, // Increase scale for better quality
  }).then((canvas) => {
    const link = document.createElement("a")
    link.download = `OPPER-Receipt-${Date.now()}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  })
}

// --- HELPER & MISC FUNCTIONS ---

function simulateGoogleLogin(type) {
  const googleEmail = "user@gmail.com"
  const errorElement =
    type === "login" ? document.getElementById("login-error") : document.getElementById("signup-error")
  const successElement =
    type === "login" ? document.getElementById("login-success") : document.getElementById("signup-success")

  if (type === "login") {
    supabase
      .from("auth_users")
      .select("*")
      .eq("email", googleEmail)
      .single()
      .then(({ data: user, error }) => {
        if (error || !user) {
          errorElement.textContent = "Google အကောင့်ဖြင့် အကောင့်မတွေ့ရှိပါ။"
          errorElement.style.display = "block"
          return
        }
        currentUser = user
        localStorage.setItem("opperSession", JSON.stringify({ email: user.email, user_id: user.user_id }))
        successElement.textContent = "Google ဖြင့် အကောင့်ဝင်ရောက်နေပါသည်..."
        successElement.style.display = "block"
        loadUserData().then(showAppContainer)
      })
  } else if (type === "signup") {
    supabase
      .from("auth_users")
      .select("email")
      .eq("email", googleEmail)
      .single()
      .then(({ data: existingUser }) => {
        if (existingUser) {
          errorElement.textContent = "ဤ Google အကောင့်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
          errorElement.style.display = "block"
          return
        }
        const userId = generateUserId(googleEmail)
        supabase
          .from("auth_users")
          .insert([{ email: googleEmail, password: "google-auth", user_id: userId }])
          .then(({ error: authError }) => {
            if (authError) {
              errorElement.textContent = "Google ဖြင့် အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။"
              errorElement.style.display = "block"
              return
            }
            supabase
              .from("users")
              .insert([{ user_id: userId, balance: 0, passport_status: "pending" }])
              .then(({ error: profileError }) => {
                if (profileError) {
                  errorElement.textContent = "Google ဖြင့် အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။"
                  errorElement.style.display = "block"
                  return
                }
                successElement.textContent = "Google ဖြင့် အကောင့်ဖွင့်ပြီးပါပြီ။"
                successElement.style.display = "block"
                setTimeout(() => document.querySelector('.auth-tab[data-tab="login"]').click(), 2000)
              })
          })
      })
  }
}

function generateUserId(email) {
  const username = email.split("@")[0]
  const randomNum = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0")
  const timestamp = Date.now().toString().slice(-4)
  return `${username.slice(0, 4)}${randomNum}${timestamp}`
}

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

function logout() {
  localStorage.removeItem("opperSession")
  currentUser = null
  showAuthContainer()
}

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
