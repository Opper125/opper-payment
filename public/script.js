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
let currentTheme = localStorage.getItem("theme") || "dark" // Default to dark
let transactions = []
let autoSaveReceipt = localStorage.getItem("autoSaveReceipt") === "true"

// DOM Elements
const loader = document.getElementById("loader")
const authContainer = document.getElementById("auth-container")
const appContainer = document.getElementById("app-container")
const pinEntryModal = document.getElementById("pin-entry-modal")
const receiptModal = document.getElementById("receipt-modal")
const processingOverlay = document.getElementById("processing-overlay")

// Audio Elements
const transferSentSound = document.getElementById("transfer-sent-sound")
const transferReceivedSound = document.getElementById("transfer-received-sound")
const clickSound = document.getElementById("click-sound")

// Import html2canvas
const html2canvas = window.html2canvas

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
  // Apply saved theme
  document.body.setAttribute("data-theme", currentTheme)

  // Show loader
  showLoader()

  // Check if user is logged in
  await checkSession()

  // Initialize UI elements
  initializeUI()

  // Hide loader after initialization
  setTimeout(hideLoader, 1500) // Keep intro for a bit
})

// Play click sound
function playClickSound() {
  if (clickSound) {
    clickSound.currentTime = 0 // Rewind to start
    clickSound.play().catch((error) => console.warn("Click sound play failed:", error))
  }
}

// Check if user is logged in
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

// Load user data
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

// Update UI with user data
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

  // Update auto-save receipt toggle
  const autoSaveToggle = document.getElementById("auto-save-receipt")
  if (autoSaveToggle) {
    autoSaveToggle.checked = autoSaveReceipt
  }
}

// Update KYC status in UI
function updateKycStatus() {
  const kycStatusElement = document.getElementById("kyc-status")
  const kycStatusCard = document.getElementById("kyc-status-card")
  const kycForm = document.getElementById("kyc-form")
  const kycStatusMessage = document.getElementById("kyc-status-message")
  const kycStatusIcon = document.querySelector("#kyc-status-card .kyc-status-icon")

  if (!kycStatusElement || !kycStatusCard || !kycStatusMessage || !kycStatusIcon) return

  kycStatusIcon.classList.remove("pending", "approved", "rejected")

  if (userKycStatus === "approved") {
    kycStatusElement.textContent = "KYC: အတည်ပြုပြီး"
    kycStatusMessage.textContent = "သင့် KYC အတည်ပြုပြီးဖြစ်ပါသည်။"
    kycStatusIcon.classList.add("approved")
    kycStatusIcon.innerHTML = '<i class="fas fa-check-circle"></i><div class="status-pulse"></div>'
    if (kycForm) kycForm.style.display = "none"
  } else if (userKycStatus === "rejected") {
    kycStatusElement.textContent = "KYC: ငြင်းပယ်ခံရသည်"
    kycStatusMessage.textContent = "သင့် KYC ငြင်းပယ်ခံရပါသည်။ ပြန်လည်တင်သွင်းပါ။"
    kycStatusIcon.classList.add("rejected")
    kycStatusIcon.innerHTML = '<i class="fas fa-times-circle"></i><div class="status-pulse"></div>'
    if (kycForm) kycForm.style.display = "block"
  } else {
    // 'pending' or any other status
    kycStatusElement.textContent = "KYC: စောင့်ဆိုင်းဆဲ"
    kycStatusMessage.textContent = "သင့် KYC စိစစ်နေဆဲဖြစ်ပါသည်။"
    kycStatusIcon.classList.add("pending")
    kycStatusIcon.innerHTML = '<i class="fas fa-clock"></i><div class="status-pulse"></div>'

    if (currentUser && kycForm) {
      supabase
        .from("users")
        .select("passport_number, passport_image")
        .eq("user_id", currentUser.user_id)
        .single()
        .then(({ data, error }) => {
          if (error && error.code !== "PGRST116") {
            // PGRST116 means no rows found, which is fine here
            console.error("Error fetching KYC submission status:", error)
            return
          }
          if (data && data.passport_number && data.passport_image) {
            kycForm.style.display = "none"
          } else {
            kycForm.style.display = "block"
          }
        })
    }
  }
}

// Update transfer status in UI
function updateTransferStatus() {
  const transferStatusElement = document.getElementById("transfer-status")
  if (!transferStatusElement || !transferStatusElement.parentElement) return

  if (transfersEnabled) {
    transferStatusElement.textContent = "ငွေလွှဲခြင်း: ခွင့်ပြုထားသည်"
    transferStatusElement.parentElement.classList.remove("disabled")
    transferStatusElement.parentElement.classList.add("enabled")
  } else {
    transferStatusElement.textContent = "ငွေလွှဲခြင်း: ပိတ်ထားသည်"
    transferStatusElement.parentElement.classList.remove("enabled")
    transferStatusElement.parentElement.classList.add("disabled")
  }
}

// Set up realtime subscriptions
function setupRealtimeSubscriptions() {
  if (!currentUser || !currentUser.user_id) return

  const userChannel = supabase
    .channel(`user-updates-${currentUser.user_id}`)
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
          const isCredit = payload.new.balance > userBalance
          const amountChanged = Math.abs(payload.new.balance - userBalance)
          userBalance = payload.new.balance
          document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`
          document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`
          if (isCredit && amountChanged > 0) {
            if (transferReceivedSound)
              transferReceivedSound.play().catch((e) => console.warn("Received sound failed", e))
            speakAmountReceived(amountChanged)
          }
        }

        if (payload.new.passport_status !== userKycStatus) {
          userKycStatus = payload.new.passport_status
          updateKycStatus()
        }
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`Subscribed to user updates for ${currentUser.user_id}`)
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error(`Subscription error for user updates: ${status}`)
      }
    })

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
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`Subscribed to settings updates`)
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error(`Subscription error for settings updates: ${status}`)
      }
    })

  const transactionsChannel = supabase
    .channel(`transactions-updates-${currentUser.user_id}`) // Make channel name unique per user
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "transactions",
        // Filter on server-side if possible, or client-side as below
      },
      (payload) => {
        // Client-side check if the transaction involves the current user
        if (
          currentUser &&
          currentUser.phone && // Ensure currentUser.phone is available
          (payload.new.from_phone === currentUser.phone || payload.new.to_phone === currentUser.phone)
        ) {
          loadTransactions()
        }
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`Subscribed to transactions updates for ${currentUser.user_id}`)
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error(`Subscription error for transactions updates: ${status}`)
      }
    })
}

// AI Voice for Received Amount
function speakAmountReceived(amount) {
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(`Kyats ${amount.toLocaleString()} received.`)
    // utterance.lang = 'my-MM'; // Try to set Burmese language if supported
    // speechSynthesis.getVoices().forEach(voice => { // Optional: find a Burmese voice
    //   if (voice.lang === 'my-MM') utterance.voice = voice;
    // });
    speechSynthesis.speak(utterance)
  } else {
    console.warn("Speech synthesis not supported in this browser.")
  }
}

// Load transactions
async function loadTransactions() {
  try {
    if (!currentUser || !currentUser.user_id) return

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("phone")
      .eq("user_id", currentUser.user_id)
      .single()

    if (userError || !userData || !userData.phone) {
      if (userError) console.error("Error fetching user phone for transactions:", userError)
      else console.warn("User phone not available for loading transactions.")
      return
    }
    currentUser.phone = userData.phone // Store phone on currentUser for realtime filter

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

// Update transactions UI
function updateTransactionsUI(transactionsData, userPhone) {
  const recentTransactionsList = document.getElementById("recent-transactions-list")
  const historyTransactionsList = document.getElementById("history-transactions-list")

  if (!recentTransactionsList || !historyTransactionsList) return

  recentTransactionsList.innerHTML = ""
  historyTransactionsList.innerHTML = ""

  if (!transactionsData || transactionsData.length === 0) {
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

  transactionsData.forEach((transaction, index) => {
    const isSender = transaction.from_phone === userPhone
    const otherParty = isSender ? transaction.to_phone : transaction.from_phone
    const transactionDate = new Date(transaction.created_at).toLocaleString("my-MM", {
      // Burmese locale
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

    const transactionItem = `
            <div class="transaction-item ${isSender ? "sent" : "received"} clickable">
                <div class="transaction-icon">
                    <i class="fas ${isSender ? "fa-paper-plane" : "fa-check-circle"}"></i>
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
    button.addEventListener("click", (e) => {
      e.stopPropagation()
      playClickSound()
      const transactionIndex = button.getAttribute("data-transaction-index")
      showTransactionReceipt(transactionsData[transactionIndex])
    })
  })
  document.querySelectorAll(".transaction-item").forEach((item) => {
    item.addEventListener("click", function () {
      playClickSound()
      const viewBtn = this.querySelector(".transaction-view-btn")
      if (viewBtn) {
        viewBtn.click()
      }
    })
  })
}

// Initialize UI elements
function initializeUI() {
  const authTabs = document.querySelectorAll(".auth-tab")
  const authForms = document.querySelectorAll(".auth-form")

  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      playClickSound()
      const tabName = tab.getAttribute("data-tab")
      authTabs.forEach((t) => t.classList.remove("active"))
      tab.classList.add("active")
      authForms.forEach((form) => {
        form.classList.remove("active")
        if (form.id === `${tabName}-form`) {
          form.classList.add("active")
        }
      })
      const indicator = document.querySelector(".tab-indicator")
      if (indicator) {
        if (tabName === "signup") {
          indicator.style.transform = `translateX(calc(100% + 4px))` // Adjust based on gap/padding
        } else {
          indicator.style.transform = `translateX(0%)`
        }
      }
    })
  })

  const togglePasswordButtons = document.querySelectorAll(".toggle-password")
  togglePasswordButtons.forEach((button) => {
    button.addEventListener("click", () => {
      playClickSound()
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

  const sidebarLinks = document.querySelectorAll(".sidebar-nav a")
  const pages = document.querySelectorAll(".page")

  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault()
      playClickSound()
      const pageName = link.getAttribute("data-page")
      sidebarLinks.forEach((l) => l.parentElement.classList.remove("active"))
      link.parentElement.classList.add("active")
      pages.forEach((page) => {
        page.classList.remove("active")
        if (page.id === `${pageName}-page`) {
          page.classList.add("active")
        }
      })
      if (window.innerWidth < 992) {
        document.getElementById("sidebar").classList.remove("active")
      }
    })
  })

  const actionCards = document.querySelectorAll(".action-card")
  actionCards.forEach((card) => {
    card.addEventListener("click", () => {
      playClickSound()
      const pageName = card.getAttribute("data-page")
      sidebarLinks.forEach((link) => {
        link.parentElement.classList.remove("active")
        if (link.getAttribute("data-page") === pageName) {
          link.parentElement.classList.add("active")
        }
      })
      pages.forEach((page) => {
        page.classList.remove("active")
        if (page.id === `${pageName}-page`) {
          page.classList.add("active")
        }
      })
    })
  })

  const menuToggle = document.getElementById("menu-toggle")
  const closeSidebar = document.getElementById("close-sidebar")
  const sidebar = document.getElementById("sidebar")

  if (menuToggle)
    menuToggle.addEventListener("click", () => {
      playClickSound()
      sidebar.classList.add("active")
    })
  if (closeSidebar)
    closeSidebar.addEventListener("click", () => {
      playClickSound()
      sidebar.classList.remove("active")
    })

  const profileDropdownTrigger = document.getElementById("profile-dropdown-trigger")
  const profileDropdown = document.getElementById("profile-dropdown")

  if (profileDropdownTrigger && profileDropdown) {
    profileDropdownTrigger.addEventListener("click", (e) => {
      e.stopPropagation()
      playClickSound()
      profileDropdown.classList.toggle("active")
      const rect = profileDropdownTrigger.getBoundingClientRect()
      profileDropdown.style.top = `${rect.bottom + 10}px`
      profileDropdown.style.right = `${window.innerWidth - rect.right}px`
    })
  }

  document.addEventListener("click", (e) => {
    if (
      profileDropdown &&
      profileDropdown.classList.contains("active") &&
      profileDropdownTrigger &&
      !profileDropdownTrigger.contains(e.target) &&
      !profileDropdown.contains(e.target)
    ) {
      profileDropdown.classList.remove("active")
    }
  })

  document.getElementById("view-profile")?.addEventListener("click", () => {
    playClickSound()
    showPage("settings")
  })
  document.getElementById("go-to-settings")?.addEventListener("click", () => {
    playClickSound()
    showPage("settings")
  })
  document.getElementById("dropdown-logout")?.addEventListener("click", () => {
    playClickSound()
    logout()
  })
  document.getElementById("logout-btn")?.addEventListener("click", () => {
    playClickSound()
    logout()
  })

  document.getElementById("refresh-balance")?.addEventListener("click", async () => {
    playClickSound()
    await loadUserData()
  })
  document.getElementById("hide-balance")?.addEventListener("click", () => {
    playClickSound()
    const balanceAmount = document.getElementById("balance-amount")
    const eyeIcon = document.querySelector("#hide-balance i")
    if (balanceAmount.classList.contains("hidden-balance")) {
      balanceAmount.textContent = `${userBalance.toLocaleString()} Ks`
      balanceAmount.classList.remove("hidden-balance")
      if (eyeIcon) eyeIcon.classList.replace("fa-eye", "fa-eye-slash")
    } else {
      balanceAmount.textContent = "•••••• Ks"
      balanceAmount.classList.add("hidden-balance")
      if (eyeIcon) eyeIcon.classList.replace("fa-eye-slash", "fa-eye")
    }
  })

  const fileInputs = document.querySelectorAll('input[type="file"]')
  fileInputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      const file = e.target.files[0]
      if (!file) return
      const previewId = input.id.replace("-upload", "-preview")
      const preview = document.getElementById(previewId)
      if (!preview) return
      const reader = new FileReader()
      reader.onload = (e_reader) => {
        preview.innerHTML = `<img src="${e_reader.target.result}" alt="Preview">`
      }
      reader.readAsDataURL(file)
    })
  })

  const themeOptions = document.querySelectorAll(".theme-option")
  themeOptions.forEach((option) => {
    if (option.getAttribute("data-theme") === currentTheme) {
      option.classList.add("active")
    }
    option.addEventListener("click", () => {
      playClickSound()
      const theme = option.getAttribute("data-theme")
      themeOptions.forEach((o) => o.classList.remove("active"))
      option.classList.add("active")
      document.body.setAttribute("data-theme", theme)
      localStorage.setItem("theme", theme)
      currentTheme = theme
    })
  })

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
      trigger.addEventListener("click", () => {
        playClickSound()
        const modal = document.getElementById(modalId)
        if (modal) modal.classList.add("active")
      })
    }
  })

  const modalCloseButtons = document.querySelectorAll(".modal-close, .modal-cancel")
  modalCloseButtons.forEach((button) => {
    button.addEventListener("click", () => {
      playClickSound()
      const modal = button.closest(".modal")
      if (modal) modal.classList.remove("active")
    })
  })

  modals.forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active")
      }
    })
  })

  setupPinInputs()
  document.getElementById("download-receipt")?.addEventListener("click", () => {
    playClickSound()
    downloadReceipt()
  })

  // Auto-save receipt toggle
  const autoSaveToggle = document.getElementById("auto-save-receipt")
  if (autoSaveToggle) {
    autoSaveToggle.checked = autoSaveReceipt
    autoSaveToggle.addEventListener("change", (e) => {
      playClickSound()
      autoSaveReceipt = e.target.checked
      localStorage.setItem("autoSaveReceipt", autoSaveReceipt.toString())
    })
  }

  // Add click sound to all clickable elements
  document
    .querySelectorAll(
      ".clickable, .btn, .auth-tab, .sidebar-nav a, .action-card, .toggle-password, .modal-close, .modal-cancel, .theme-option, .transaction-view-btn, #refresh-balance, #hide-balance, #download-receipt, #profile-dropdown-trigger, .dropdown-item, #menu-toggle, #close-sidebar",
    )
    .forEach((element) => {
      // Avoid double-binding if already handled by specific listeners
      if (!element.getAttribute("data-click-sound-bound")) {
        element.addEventListener("click", (e) => {
          // Some elements might have their own click sound logic, so check
          if (
            e.target.closest(".auth-tab") ||
            e.target.closest(".sidebar-nav a") ||
            e.target.closest(".action-card") ||
            e.target.closest(".toggle-password") ||
            e.target.closest(".modal-close") ||
            e.target.closest(".modal-cancel") ||
            e.target.closest(".theme-option") ||
            e.target.closest(".transaction-view-btn")
          ) {
            // These have specific handlers that call playClickSound
          } else {
            playClickSound()
          }
        })
        element.setAttribute("data-click-sound-bound", "true")
      }
    })

  setupFormSubmissions()
}

// Setup PIN inputs
function setupPinInputs() {
  const pinInputs = document.querySelectorAll(".pin-input")
  pinInputs.forEach((input, index) => {
    input.addEventListener("input", (e) => {
      if (e.target.value && pinInputs[index + 1]) {
        pinInputs[index + 1].focus()
      }
    })
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !e.target.value && pinInputs[index - 1]) {
        pinInputs[index - 1].focus()
      }
    })
  })

  document.getElementById("confirm-pin-btn")?.addEventListener("click", () => {
    playClickSound()
    let pin = ""
    pinInputs.forEach((input) => (pin += input.value))
    const pinError = document.getElementById("pin-error")
    if (pin.length !== 6) {
      pinError.textContent = "PIN ၆ လုံး ထည့်ပါ"
      pinError.style.display = "block"
      return
    }
    pinError.style.display = "none"
    processTransfer(pin)
  })
}

// Setup form submissions
function setupFormSubmissions() {
  const loginBtn = document.getElementById("login-btn")
  if (loginBtn)
    loginBtn.addEventListener("click", async () => {
      playClickSound()
      const email = document.getElementById("login-email").value
      const password = document.getElementById("login-password").value
      const errorElement = document.getElementById("login-error")
      const successElement = document.getElementById("login-success")

      if (!email || !password) {
        errorElement.textContent = "အီးမေးလ်နှင့် စကားဝှက် ထည့်ပါ။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }

      try {
        const { data: user, error } = await supabase.from("auth_users").select("*").eq("email", email).single()

        if (error || !user) {
          errorElement.textContent = "အကောင့်မတွေ့ရှိပါ။"
          errorElement.style.display = "block"
          successElement.style.display = "none"
          return
        }

        if (user.password !== password) {
          errorElement.textContent = "စကားဝှက်မှားယွင်းနေပါသည်။"
          errorElement.style.display = "block"
          successElement.style.display = "none"
          return
        }

        currentUser = user
        localStorage.setItem("opperSession", JSON.stringify({ email: user.email, user_id: user.user_id }))
        errorElement.style.display = "none"
        successElement.textContent = "အကောင့်ဝင်ရောက်နေပါသည်..."
        successElement.style.display = "block"

        await loadUserData()
        showAppContainer()
      } catch (error) {
        console.error("Login error:", error)
        errorElement.textContent = "အကောင့်ဝင်ရာတွင် အမှားရှိနေပါသည်။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
      }
    })

  document.getElementById("google-login-btn")?.addEventListener("click", () => {
    playClickSound()
    simulateGoogleLogin("login")
  })

  const signupBtn = document.getElementById("signup-btn")
  if (signupBtn)
    signupBtn.addEventListener("click", async () => {
      playClickSound()
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
        successElement.style.display = "none"
        return
      }
      if (password !== confirmPassword) {
        errorElement.textContent = "စကားဝှက်နှင့် အတည်ပြုစကားဝှက် မတူညီပါ။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }
      if (!termsAgree) {
        errorElement.textContent = "စည်းမျဉ်းစည်းကမ်းများကို သဘောတူရန် လိုအပ်ပါသည်။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }

      try {
        const { data: existingUserByEmail } = await supabase
          .from("auth_users")
          .select("email")
          .eq("email", email)
          .single()
        if (existingUserByEmail) {
          errorElement.textContent = "ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
          errorElement.style.display = "block"
          successElement.style.display = "none"
          return
        }
        const { data: existingUserByPhone } = await supabase.from("users").select("phone").eq("phone", phone).single()
        if (existingUserByPhone) {
          errorElement.textContent = "ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
          errorElement.style.display = "block"
          successElement.style.display = "none"
          return
        }

        const userId = generateUserId(email)
        const { data: authUser, error: authError } = await supabase
          .from("auth_users")
          .insert([{ email, password, user_id: userId }])
          .select()
          .single()
        if (authError) throw authError

        const { error: profileError } = await supabase
          .from("users")
          .insert([{ user_id: userId, phone, balance: 0, passport_status: "pending" }])
        if (profileError) throw profileError

        errorElement.style.display = "none"
        successElement.textContent = "အကောင့်ဖွင့်ပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။"
        successElement.style.display = "block"
        document.getElementById("signup-form").reset()
        setTimeout(() => {
          const loginTab = document.querySelector('.auth-tab[data-tab="login"]')
          if (loginTab) loginTab.click()
        }, 2000)
      } catch (error) {
        console.error("Signup error:", error)
        errorElement.textContent = "အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
      }
    })

  document.getElementById("google-signup-btn")?.addEventListener("click", () => {
    playClickSound()
    simulateGoogleLogin("signup")
  })

  const transferBtn = document.getElementById("transfer-btn")
  if (transferBtn)
    transferBtn.addEventListener("click", async () => {
      playClickSound()
      const phone = document.getElementById("transfer-phone").value
      const amount = Number.parseInt(document.getElementById("transfer-amount").value)
      const errorElement = document.getElementById("transfer-error")
      const successElement = document.getElementById("transfer-success")

      if (!phone || !amount) {
        errorElement.textContent = "ဖုန်းနံပါတ်နှင့် ငွေပမာဏ ထည့်ပါ။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }
      if (amount < 1000) {
        errorElement.textContent = "ငွေပမာဏ အနည်းဆုံး 1,000 Ks ဖြစ်ရပါမည်။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }
      if (!transfersEnabled) {
        errorElement.textContent = "ငွေလွှဲခြင်းကို ယာယီပိတ်ထားပါသည်။ နောက်မှ ပြန်လည်ကြိုးစားပါ။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }
      if (userKycStatus !== "approved") {
        errorElement.textContent = "ငွေလွှဲရန် KYC အတည်ပြုရန် လိုအပ်ပါသည်။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }
      if (userBalance < amount) {
        errorElement.textContent = "လက်ကျန်ငွေ မလုံလောက်ပါ။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }

      const { data: senderData } = await supabase
        .from("users")
        .select("phone")
        .eq("user_id", currentUser.user_id)
        .single()
      if (senderData && senderData.phone === phone) {
        errorElement.textContent = "ကိုယ့်ကိုယ်ကို ငွေလွှဲ၍မရပါ။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }

      const { data: recipient, error: recipientError } = await supabase
        .from("users")
        .select("*")
        .eq("phone", phone)
        .single()
      if (recipientError || !recipient) {
        errorElement.textContent = "လက်ခံမည့်သူ မတွေ့ရှိပါ။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }

      errorElement.style.display = "none"
      showPinEntryModal()
    })

  const kycSubmitBtn = document.getElementById("kyc-submit-btn")
  if (kycSubmitBtn)
    kycSubmitBtn.addEventListener("click", async () => {
      playClickSound()
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
        successElement.style.display = "none"
        return
      }
      if (pin !== confirmPin) {
        errorElement.textContent = "PIN နှင့် အတည်ပြု PIN မတူညီပါ။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }
      if (pin.length !== 6 || !/^\d+$/.test(pin)) {
        errorElement.textContent = "PIN သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }

      try {
        const passportFileName = `passport_${currentUser.user_id}_${Date.now()}.${passportFile.name.split(".").pop()}`
        const { error: passportError } = await supabase.storage
          .from("kyc-documents")
          .upload(passportFileName, passportFile)
        if (passportError) throw passportError
        const { data: passportUrlData } = supabase.storage.from("kyc-documents").getPublicUrl(passportFileName)

        const selfieFileName = `selfie_${currentUser.user_id}_${Date.now()}.${selfieFile.name.split(".").pop()}`
        const { error: selfieError } = await supabase.storage.from("kyc-documents").upload(selfieFileName, selfieFile)
        if (selfieError) throw selfieError
        const { data: selfieUrlData } = supabase.storage.from("kyc-documents").getPublicUrl(selfieFileName)

        const { error: updateError } = await supabase
          .from("users")
          .update({
            passport_number: passportNumber,
            address,
            payment_pin: pin, // Store hashed PIN in real app
            passport_image: passportUrlData.publicUrl,
            selfie_image: selfieUrlData.publicUrl,
            passport_status: "pending",
            submitted_at: new Date().toISOString(),
          })
          .eq("user_id", currentUser.user_id)
        if (updateError) throw updateError

        errorElement.style.display = "none"
        successElement.textContent = "KYC အချက်အလက်များ အောင်မြင်စွာ တင်သွင်းပြီးပါပြီ။ စိစစ်နေပါပြီ။"
        successElement.style.display = "block"
        userKycStatus = "pending"
        updateKycStatus()
        document.getElementById("kyc-form").reset()
        document.getElementById("passport-preview").innerHTML = ""
        document.getElementById("selfie-preview").innerHTML = ""
      } catch (error) {
        console.error("KYC submission error:", error)
        errorElement.textContent = "KYC တင်သွင်းရာတွင် အမှားရှိနေပါသည်။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
      }
    })

  const savePasswordBtn = document.getElementById("save-password-btn")
  if (savePasswordBtn)
    savePasswordBtn.addEventListener("click", async () => {
      playClickSound()
      const currentPassword = document.getElementById("current-password").value
      const newPassword = document.getElementById("new-password").value
      const confirmNewPassword = document.getElementById("confirm-new-password").value
      const errorElement = document.getElementById("change-password-error")
      const successElement = document.getElementById("change-password-success")

      if (!currentPassword || !newPassword || !confirmNewPassword) {
        errorElement.textContent = "အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }
      if (newPassword !== confirmNewPassword) {
        errorElement.textContent = "စကားဝှက်အသစ်နှင့် အတည်ပြုစကားဝှက် မတူညီပါ။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
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
          successElement.style.display = "none"
          return
        }

        const { error: updateError } = await supabase
          .from("auth_users")
          .update({ password: newPassword })
          .eq("user_id", currentUser.user_id)

        if (updateError) throw updateError

        errorElement.style.display = "none"
        successElement.textContent = "စကားဝှက် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။"
        successElement.style.display = "block"

        document.getElementById("current-password").value = ""
        document.getElementById("new-password").value = ""
        document.getElementById("confirm-new-password").value = ""

        setTimeout(() => {
          document.getElementById("change-password-modal").classList.remove("active")
        }, 2000)
      } catch (error) {
        console.error("Change password error:", error)
        errorElement.textContent = "စကားဝှက်ပြောင်းရာတွင် အမှားရှိနေပါသည်။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
      }
    })

  const savePinBtn = document.getElementById("save-pin-btn")
  if (savePinBtn)
    savePinBtn.addEventListener("click", async () => {
      playClickSound()
      const currentPin = document.getElementById("current-pin").value
      const newPin = document.getElementById("new-pin").value
      const confirmNewPin = document.getElementById("confirm-new-pin").value
      const errorElement = document.getElementById("change-pin-error")
      const successElement = document.getElementById("change-pin-success")

      if (!currentPin || !newPin || !confirmNewPin) {
        errorElement.textContent = "အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }
      if (newPin !== confirmNewPin) {
        errorElement.textContent = "PIN အသစ်နှင့် အတည်ပြု PIN မတူညီပါ။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }
      if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
        errorElement.textContent = "PIN သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }

      try {
        const { data: user, error } = await supabase
          .from("users")
          .select("payment_pin")
          .eq("user_id", currentUser.user_id)
          .single()

        if (error) throw error

        if (user.payment_pin !== currentPin) {
          errorElement.textContent = "လက်ရှိ PIN မှားယွင်းနေပါသည်။"
          errorElement.style.display = "block"
          successElement.style.display = "none"
          return
        }

        const { error: updateError } = await supabase
          .from("users")
          .update({ payment_pin: newPin })
          .eq("user_id", currentUser.user_id)

        if (updateError) throw updateError

        errorElement.style.display = "none"
        successElement.textContent = "PIN အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။"
        successElement.style.display = "block"

        document.getElementById("current-pin").value = ""
        document.getElementById("new-pin").value = ""
        document.getElementById("confirm-new-pin").value = ""

        setTimeout(() => {
          document.getElementById("change-pin-modal").classList.remove("active")
        }, 2000)
      } catch (error) {
        console.error("Change PIN error:", error)
        errorElement.textContent = "PIN ပြောင်းရာတွင် အမှားရှိနေပါသည်။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
      }
    })

  const confirmDeleteBtn = document.getElementById("confirm-delete-btn")
  if (confirmDeleteBtn)
    confirmDeleteBtn.addEventListener("click", async () => {
      playClickSound()
      const deletePassword = document.getElementById("delete-password").value
      const confirmDelete = document.getElementById("confirm-delete").checked
      const errorElement = document.getElementById("delete-account-error")

      if (!deletePassword || !confirmDelete) {
        errorElement.textContent = "စကားဝှက်ထည့်၍ အတည်ပြုပါ။"
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

        if (user.password !== deletePassword) {
          errorElement.textContent = "စကားဝှက် မှားယွင်းနေပါသည်။"
          errorElement.style.display = "block"
          return
        }

        // Delete user data
        await supabase.from("users").delete().eq("user_id", currentUser.user_id)
        await supabase.from("auth_users").delete().eq("user_id", currentUser.user_id)

        // Clear session and redirect
        localStorage.removeItem("opperSession")
        currentUser = null
        showAuthContainer()
        document.getElementById("delete-account-modal").classList.remove("active")

        // Show success message
        const loginSuccess = document.getElementById("login-success")
        loginSuccess.textContent = "အကောင့်ဖျက်ပြီးပါပြီ။"
        loginSuccess.style.display = "block"
      } catch (error) {
        console.error("Delete account error:", error)
        errorElement.textContent = "အကောင့်ဖျက်ရာတွင် အမှားရှိနေပါသည်။"
        errorElement.style.display = "block"
      }
    })
}

// Show PIN entry modal
function showPinEntryModal() {
  document.querySelectorAll(".pin-input").forEach((input) => (input.value = ""))
  document.getElementById("pin-error").style.display = "none"
  pinEntryModal.classList.add("active")
  const firstPinInput = document.querySelector(".pin-input")
  if (firstPinInput) firstPinInput.focus()
}

// Process transfer with PIN
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
      // Compare with stored PIN (should be hashed in real app)
      processingOverlay.classList.remove("active")
      errorElement.textContent = "PIN မှားယွင်းနေပါသည်။"
      errorElement.style.display = "block"
      successElement.style.display = "none"
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
          from_name: sender.name || sender.phone, // Use name if available
          to_phone: recipient.phone,
          to_name: recipient.name || recipient.phone, // Use name if available
          amount,
          note,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single()
    if (transactionError) throw transactionError

    // Update balances in a transaction if possible, or ensure atomicity
    const { error: updateSenderError } = await supabase
      .from("users")
      .update({ balance: sender.balance - amount })
      .eq("user_id", sender.user_id)
    if (updateSenderError) throw updateSenderError

    const { error: updateRecipientError } = await supabase
      .from("users")
      .update({ balance: recipient.balance + amount })
      .eq("user_id", recipient.user_id)
    if (updateRecipientError) {
      // Attempt to roll back sender's balance if recipient update fails
      await supabase.from("users").update({ balance: sender.balance }).eq("user_id", sender.user_id)
      throw updateRecipientError
    }

    userBalance -= amount
    document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`
    document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`

    if (transferSentSound) transferSentSound.play().catch((e) => console.warn("Sent sound failed", e))

    setTimeout(() => {
      processingOverlay.classList.remove("active")
      errorElement.style.display = "none"
      successElement.textContent = `${amount.toLocaleString()} Ks ကို ${phone} သို့ အောင်မြင်စွာ လွှဲပြောင်းပြီးပါပြီ။`
      successElement.style.display = "block"

      showTransactionReceipt(transaction)
      if (autoSaveReceipt) {
        setTimeout(downloadReceipt, 700) // Slight delay for modal animation and rendering
      }

      document.getElementById("transfer-phone").value = ""
      document.getElementById("transfer-amount").value = ""
      document.getElementById("transfer-note").value = ""
      loadTransactions()
    }, 2000)
  } catch (error) {
    console.error("Transfer error:", error)
    processingOverlay.classList.remove("active")
    errorElement.textContent = "ငွေလွှဲရာတွင် အမှားရှိနေပါသည်။"
    errorElement.style.display = "block"
    successElement.style.display = "none"
  }
}

// Show transaction receipt
function showTransactionReceipt(transaction) {
  supabase
    .from("users")
    .select("phone")
    .eq("user_id", currentUser.user_id)
    .single()
    .then(({ data: userData, error: userFetchError }) => {
      if (userFetchError || !userData) {
        console.error("Error fetching user data for receipt:", userFetchError)
        // Fallback or show error
        return
      }

      const userPhone = userData.phone
      const isSender = transaction.from_phone === userPhone
      const receiptContainer = document.getElementById("receipt-container")
      if (!receiptContainer) return

      const receiptHTML = `
            <div class="receipt">
                <div class="receipt-logo-area">
                    <div class="opper-logo-container">
                        <img src="https://github.com/Opper125/opper-payment/raw/main/logo.png" alt="OPPER Logo" class="opper-logo-img">
                        <span class="opper-logo-text">OPPER Pay</span>
                    </div>
                    <img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" alt="GitHub Logo" class="github-logo-img">
                </div>
                
                <div class="receipt-status">
                    <div class="receipt-status-icon ${isSender ? "sent animated" : "received animated"}">
                        <i class="fas ${isSender ? "fa-paper-plane" : "fa-check-circle"}"></i>
                    </div>
                    <div class="receipt-status-text">
                        ${isSender ? "ငွေပေးပို့ပြီးပါပြီ" : "ငွေလက်ခံရရှိပါပြီ"}
                    </div>
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
                    ${
                      transaction.note
                        ? `
                    <div class="receipt-detail-row">
                        <div class="receipt-detail-label">Note</div>
                        <div class="receipt-detail-value">${transaction.note}</div>
                    </div>
                    `
                        : ""
                    }
                    <div class="receipt-detail-row">
                        <div class="receipt-detail-label">Date</div>
                        <div class="receipt-detail-value">${new Date(transaction.created_at).toLocaleString("my-MM", { dateStyle: "medium", timeStyle: "short" })}</div>
                    </div>
                    <div class="receipt-detail-row">
                        <div class="receipt-detail-label">Payment Method</div>
                        <div class="receipt-detail-value">OPPER Pay</div>
                    </div>
                </div>
                
                <div class="receipt-transaction-id">
                    <div class="receipt-transaction-id-label">ငွေလွှဲလုပ်ဆောင်ချက်အမှတ်စဥ်</div>
                    <div class="receipt-transaction-id-value">${transaction.id}</div>
                </div>
                
                <div class="receipt-footer">
                    OPPER Payment ကိုအသုံးပြုသည့်အတွက် ကျေးဇူးတင်ပါသည်
                </div>
            </div>
        `

      receiptContainer.innerHTML = receiptHTML
      receiptModal.classList.add("active", "receipt-modal-animated") // Add animation class
      // Remove animation class after it finishes to allow re-triggering
      setTimeout(() => {
        receiptModal.classList.remove("receipt-modal-animated")
      }, 600) // Match CSS animation duration
    })
}

// Download receipt as PNG
function downloadReceipt() {
  const receiptElement = document.getElementById("receipt-container")?.querySelector(".receipt") // Target the .receipt div
  if (!receiptElement || typeof html2canvas === "undefined") {
    console.error("Receipt element or html2canvas not found for download.")
    return
  }

  html2canvas(receiptElement, {
    backgroundColor: "#ffffff",
    useCORS: true, // Important if logos are from different domains
    scale: 2, // Increase scale for better quality
  })
    .then((canvas) => {
      const link = document.createElement("a")
      link.download = `OPPER-Receipt-${Date.now()}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    })
    .catch((err) => {
      console.error("Error generating receipt image:", err)
    })
}

// Simulate Google login/signup
function simulateGoogleLogin(type) {
  // This is a placeholder. In a real app, use Supabase's Google Auth provider.
  console.warn("Simulating Google Login/Signup. Replace with actual Supabase Google Auth.")
  const mockEmail = "googleuser@example.com"
  const mockUserId = generateUserId(mockEmail)

  if (type === "login") {
    // Simulate finding an existing user
    currentUser = { email: mockEmail, user_id: mockUserId, password: "mockpassword" } // Add mock password
    localStorage.setItem("opperSession", JSON.stringify({ email: currentUser.email, user_id: currentUser.user_id }))
    loadUserData().then(showAppContainer)
    document.getElementById("login-success").textContent = "Google ဖြင့် အကောင့်ဝင်ရောက်နေပါသည်..."
    document.getElementById("login-success").style.display = "block"
  } else if (type === "signup") {
    // Simulate creating a new user
    currentUser = { email: mockEmail, user_id: mockUserId, password: "mockpassword" } // Add mock password
    localStorage.setItem("opperSession", JSON.stringify({ email: currentUser.email, user_id: currentUser.user_id }))
    // Simulate creating profile
    userBalance = 0
    userKycStatus = "pending"
    // Show success and switch to login (or directly to app)
    document.getElementById("signup-success").textContent = "Google ဖြင့် အကောင့်ဖွင့်ပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။"
    document.getElementById("signup-success").style.display = "block"
    setTimeout(() => {
      const loginTab = document.querySelector('.auth-tab[data-tab="login"]')
      if (loginTab) loginTab.click()
    }, 2000)
  }
}

// Generate user ID based on email
function generateUserId(email) {
  const username = email
    .split("@")[0]
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4) // Sanitize and shorten
  const randomNum = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0")
  const timestamp = Date.now().toString().slice(-4)
  return `${username}${randomNum}${timestamp}`.toUpperCase()
}

// Show specific page
function showPage(pageName) {
  document.querySelectorAll(".sidebar-nav a").forEach((link) => {
    link.parentElement.classList.remove("active")
    if (link.getAttribute("data-page") === pageName) {
      link.parentElement.classList.add("active")
    }
  })
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active")
    if (page.id === `${pageName}-page`) {
      page.classList.add("active")
    }
  })
  const profileDropdown = document.getElementById("profile-dropdown")
  if (profileDropdown) profileDropdown.classList.remove("active")

  if (window.innerWidth < 992) {
    const sidebar = document.getElementById("sidebar")
    if (sidebar) sidebar.classList.remove("active")
  }
}

// Logout function
function logout() {
  localStorage.removeItem("opperSession")
  currentUser = null
  userBalance = 0
  userKycStatus = "pending"
  transactions = []
  // Optionally clear other user-specific UI elements if not handled by showAuthContainer
  showAuthContainer()
}

// Loader, Auth, App container visibility functions
function showLoader() {
  if (loader) loader.classList.add("active")
}
function hideLoader() {
  if (loader) loader.classList.remove("active")
}
function showAuthContainer() {
  if (authContainer) authContainer.classList.remove("hidden")
  if (appContainer) appContainer.classList.add("hidden")
  // Reset forms in auth container
  document.getElementById("login-form")?.reset()
  document.getElementById("signup-form")?.reset()
  document.getElementById("login-error")?.style.setProperty("display", "none")
  document.getElementById("login-success")?.style.setProperty("display", "none")
  document.getElementById("signup-error")?.style.setProperty("display", "none")
  document.getElementById("signup-success")?.style.setProperty("display", "none")
}
function showAppContainer() {
  if (authContainer) authContainer.classList.add("hidden")
  if (appContainer) appContainer.classList.remove("hidden")
}

// Initial theme setup
document.body.setAttribute("data-theme", currentTheme)
const autoSaveToggle = document.getElementById("auto-save-receipt")
if (autoSaveToggle) autoSaveToggle.checked = autoSaveReceipt
