// Supabase Configuration
const supabaseUrl = "https://vtsczzlnhsrgnbkfyizi.supabase.co"
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68"
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
  fetch: (...args) => fetch(...args), // Required for some environments like Netlify Edge Functions
})

// Global Variables
let currentUser = null
let userProfileData = null // Store full user profile
let userBalance = 0
let userKycStatus = "pending"
let transfersEnabled = true
let currentTheme = localStorage.getItem("theme") || "light"
let transactions = []
let currentReceiptTransaction = null // For storing current transaction details for receipt download

// Asset URLs
const LOGO_URL = "https://github.com/Opper125/opper-payment/raw/main/logo.png"
const DEFAULT_AVATAR_URL = "https://via.placeholder.com/100?text=User"

// DOM Elements (cache them after DOM is loaded)
let loader, authContainer, appContainer, pinEntryModal, receiptModal, processingOverlay, confirmationModal
let transferSentSound, transferReceivedSound, clickSound

// Initialize App
document.addEventListener("DOMContentLoaded", initializeApp)

async function initializeApp() {
  console.log("DOM fully loaded and parsed. Initializing App...")

  // Cache DOM elements
  loader = document.getElementById("loader")
  authContainer = document.getElementById("auth-container")
  appContainer = document.getElementById("app-container")
  pinEntryModal = document.getElementById("pin-entry-modal")
  receiptModal = document.getElementById("receipt-modal")
  processingOverlay = document.getElementById("processing-overlay")
  confirmationModal = document.getElementById("confirmation-modal")
  transferSentSound = document.getElementById("transfer-sent-sound")
  transferReceivedSound = document.getElementById("transfer-received-sound")
  clickSound = document.getElementById("click-sound")

  showLoader() // Show loader immediately

  try {
    const sessionExists = await checkSession()
    if (sessionExists) {
      await loadUserData()
      showAppContainer()
    } else {
      showAuthContainer()
    }
    initializeUI() // Initialize UI elements and event listeners regardless of auth state
  } catch (error) {
    console.error("Error during app initialization:", error)
    logToConsole("App initialization error: " + error.message, "error", error)
    showAuthContainer() // Fallback to auth container on error
  } finally {
    // Hide intro animation after a delay, then hide main loader
    const introAnimation = document.getElementById("intro-animation")
    if (introAnimation && !introAnimation.classList.contains("hidden")) {
      console.log("Hiding intro animation...")
      setTimeout(() => {
        introAnimation.classList.add("hidden")
        console.log("Intro animation hidden. Hiding main loader...")
        hideLoader()
      }, 2200) // Ensure intro progress bar animation completes
    } else {
      console.log("Intro animation already hidden or not found. Hiding main loader directly.")
      hideLoader() // Hide loader if intro was already hidden
    }
  }
}

// Check if user is logged in
async function checkSession() {
  console.log("Checking session...")
  try {
    const session = localStorage.getItem("opperSession")
    if (session) {
      const sessionData = JSON.parse(session)
      console.log("Found session in localStorage:", sessionData)

      const { data: user, error } = await supabase
        .from("auth_users")
        .select("*")
        .eq("email", sessionData.email)
        .eq("user_id", sessionData.user_id)
        .single()

      if (error || !user) {
        console.warn("User not found in auth_users or error:", error)
        logToConsole("Session check: User not found or error. Clearing session.", "warn", error)
        localStorage.removeItem("opperSession")
        return false
      }

      currentUser = user
      console.log("Session valid. Current user set:", currentUser)
      logToConsole("Session valid. Current user: " + currentUser.email, "info")
      return true
    } else {
      console.log("No session found in localStorage.")
      logToConsole("No session found in localStorage.", "info")
      return false
    }
  } catch (error) {
    console.error("Session check error:", error)
    logToConsole("Session check error: " + error.message, "error", error)
    localStorage.removeItem("opperSession") // Clear potentially corrupted session
    return false
  }
}

// Load user data
async function loadUserData() {
  console.log("Loading user data for:", currentUser?.user_id)
  logToConsole("Loading user data for: " + currentUser?.user_id, "info")
  try {
    if (!currentUser || !currentUser.user_id) {
      console.warn("Cannot load user data: currentUser is not set.")
      logToConsole("Cannot load user data: currentUser is not set.", "warn")
      return
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", currentUser.user_id)
      .single()

    if (userError) {
      console.error("Error fetching user profile data:", userError)
      logToConsole("Error fetching user profile data: " + userError.message, "error", userError)
      throw userError
    }

    if (!userData) {
      console.warn("User profile data not found for user_id:", currentUser.user_id)
      logToConsole("User profile data not found for user_id: " + currentUser.user_id, "warn")
      throw new Error("User profile not found.")
    }

    userProfileData = userData
    userBalance = userData.balance || 0
    userKycStatus = userData.passport_status || "pending"
    console.log("User profile data loaded:", userProfileData)
    logToConsole("User profile data loaded successfully.", "success", userProfileData)

    updateUserUI(userData)

    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("allow_transfers")
      .eq("id", 1) // Assuming settings table has a single row with id 1
      .single()

    if (settingsError) {
      console.warn("Error fetching settings:", settingsError)
      logToConsole("Error fetching settings: " + settingsError.message, "warn", settingsError)
    } else if (settings) {
      transfersEnabled = settings.allow_transfers
      console.log("Transfers enabled status:", transfersEnabled)
      logToConsole("Transfers enabled status: " + transfersEnabled, "info")
    }
    updateTransferStatus()

    setupRealtimeSubscriptions()
    await loadTransactions()
  } catch (error) {
    console.error("Load user data failed:", error)
    logToConsole("Load user data failed: " + error.message, "error", error)
    throw error
  }
}

// Update UI with user data
function updateUserUI(userData) {
  console.log("Updating UI with user data:", userData)
  if (!currentUser || !userData) {
    console.warn("Cannot update UI: currentUser or userData is missing.")
    logToConsole("Cannot update UI: currentUser or userData is missing.", "warn")
    return
  }

  const userInitial = currentUser.email ? currentUser.email.charAt(0).toUpperCase() : "U"
  const userName = userData.name || (currentUser.email ? currentUser.email.split("@")[0] : "User")

  const avatarUrl = userData.avatar_url || ""
  const userAvatarImg = document.getElementById("user-avatar-img")
  const userAvatarImgSidebar = document.getElementById("user-avatar-img-sidebar")
  const userInitialSpan = document.getElementById("user-initial")
  const userInitialSidebarSpan = document.getElementById("user-initial-sidebar")

  if (userAvatarImg && userInitialSpan && userAvatarImgSidebar && userInitialSidebarSpan) {
    if (avatarUrl) {
      userAvatarImg.src = avatarUrl
      userAvatarImg.style.display = "block"
      userInitialSpan.style.display = "none"

      userAvatarImgSidebar.src = avatarUrl
      userAvatarImgSidebar.style.display = "block"
      userInitialSidebarSpan.style.display = "none"
    } else {
      userAvatarImg.style.display = "none"
      userInitialSpan.textContent = userInitial
      userInitialSpan.style.display = "flex"

      userAvatarImgSidebar.style.display = "none"
      userInitialSidebarSpan.textContent = userInitial
      userInitialSidebarSpan.style.display = "flex"
    }
  } else {
    console.warn("Avatar elements not found in DOM for UI update.")
    logToConsole("Avatar elements not found in DOM for UI update.", "warn")
  }

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
  logToConsole("User UI updated.", "info")
}

// Update KYC status in UI
function updateKycStatus() {
  if (!userProfileData) {
    console.warn("Cannot update KYC status: userProfileData is not set.")
    logToConsole("Cannot update KYC status: userProfileData is not set.", "warn")
    document.getElementById("kyc-status").textContent = "KYC: အခြေအနေမသိပါ"
    document.getElementById("kyc-status-message").textContent = "KYC အချက်အလက်များ ရယူ၍မရပါ"
    return
  }
  console.log("Updating KYC status. Current status:", userKycStatus)
  logToConsole("Updating KYC status. Current status: " + userKycStatus, "info")

  const kycStatusElement = document.getElementById("kyc-status")
  const kycStatusCard = document.getElementById("kyc-status-card")
  const kycForm = document.getElementById("kyc-form")
  const kycStatusMessage = document.getElementById("kyc-status-message")
  const kycStatusIcon = kycStatusCard ? kycStatusCard.querySelector(".kyc-status-icon") : null
  const kycDetailsApprovedDiv = document.getElementById("kyc-details-approved")

  if (
    !kycStatusElement ||
    !kycStatusCard ||
    !kycForm ||
    !kycStatusMessage ||
    !kycStatusIcon ||
    !kycDetailsApprovedDiv
  ) {
    console.warn("One or more KYC UI elements not found.")
    logToConsole("One or more KYC UI elements not found for status update.", "warn")
    return
  }

  kycStatusIcon.classList.remove("pending", "approved", "rejected")
  kycDetailsApprovedDiv.style.display = "none"
  kycForm.style.display = "block" // Default to show form

  if (userKycStatus === "approved") {
    kycStatusElement.textContent = "KYC: အတည်ပြုပြီး"
    kycStatusMessage.textContent = "သင့် KYC အတည်ပြုပြီးဖြစ်ပါသည်။"
    kycStatusIcon.classList.add("approved")
    kycStatusIcon.innerHTML = '<i class="fas fa-check-circle"></i>'
    kycForm.style.display = "none"
    displayApprovedKycData()
  } else if (userKycStatus === "rejected") {
    kycStatusElement.textContent = "KYC: ငြင်းပယ်ခံရသည်"
    kycStatusMessage.textContent = "သင့် KYC ငြင်းပယ်ခံရပါသည်။ ပြန်လည်တင်သွင်းပါ။"
    kycStatusIcon.classList.add("rejected")
    kycStatusIcon.innerHTML = '<i class="fas fa-times-circle"></i>'
  } else {
    // 'pending' or any other status
    kycStatusElement.textContent = "KYC: စောင့်ဆိုင်းဆဲ"
    kycStatusMessage.textContent = "သင့် KYC စိစစ်နေဆဲဖြစ်ပါသည်။ (သို့မဟုတ်) တင်သွင်းရန်လိုအပ်သည်။"
    kycStatusIcon.classList.add("pending")
    kycStatusIcon.innerHTML = '<i class="fas fa-clock"></i>'
    // Hide form if KYC data (passport_number AND passport_image) is already submitted and pending
    if (userProfileData && userProfileData.passport_number && userProfileData.passport_image) {
      kycForm.style.display = "none"
      logToConsole("KYC form hidden as data is already submitted and pending.", "info")
    } else {
      kycForm.style.display = "block"
      logToConsole("KYC form shown for submission.", "info")
    }
  }
}

// Display approved KYC data
async function displayApprovedKycData() {
  if (!userProfileData) {
    console.warn("Cannot display approved KYC data: userProfileData is null.")
    logToConsole("Cannot display approved KYC data: userProfileData is null.", "warn")
    return
  }
  console.log("Displaying approved KYC data.")
  logToConsole("Displaying approved KYC data.", "info")

  document.getElementById("approved-kyc-passport").textContent = userProfileData.passport_number || "N/A"
  document.getElementById("approved-kyc-address").textContent = userProfileData.address || "N/A"

  const passportImg = document.getElementById("approved-kyc-passport-img")
  if (userProfileData.passport_image) {
    passportImg.src = userProfileData.passport_image
    passportImg.style.display = "block"
  } else {
    passportImg.style.display = "none"
  }

  const selfieImg = document.getElementById("approved-kyc-selfie-img")
  if (userProfileData.selfie_image) {
    selfieImg.src = userProfileData.selfie_image
    selfieImg.style.display = "block"
  } else {
    selfieImg.style.display = "none"
  }
  document.getElementById("kyc-details-approved").style.display = "block"
}

// Update transfer status in UI
function updateTransferStatus() {
  console.log("Updating transfer status. Enabled:", transfersEnabled)
  logToConsole("Updating transfer status. Enabled: " + transfersEnabled, "info")
  const transferStatusElement = document.getElementById("transfer-status")
  if (!transferStatusElement) {
    console.warn("Transfer status element not found.")
    logToConsole("Transfer status element not found.", "warn")
    return
  }
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

// Set up realtime subscriptions
function setupRealtimeSubscriptions() {
  if (!currentUser || !currentUser.user_id) {
    console.warn("Cannot set up realtime subscriptions: currentUser is not set.")
    logToConsole("Cannot set up realtime subscriptions: currentUser is not set.", "warn")
    return
  }
  console.log("Setting up realtime subscriptions for user:", currentUser.user_id)
  logToConsole("Setting up realtime subscriptions for user: " + currentUser.user_id, "info")

  // Remove existing channels before subscribing to prevent duplicates if initializeApp is called multiple times
  supabase.removeAllChannels()
  logToConsole("Removed all existing Supabase channels.", "info")

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
        console.log("Realtime user update received:", payload)
        logToConsole("Realtime user update received.", "info", payload)
        const oldProfileData = { ...userProfileData }
        userProfileData = payload.new
        if (payload.new.balance !== oldProfileData.balance) {
          userBalance = payload.new.balance
          document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`
          document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`
          logToConsole("Balance updated via realtime: " + userBalance, "info")
        }
        if (payload.new.passport_status !== oldProfileData.passport_status) {
          userKycStatus = payload.new.passport_status
          updateKycStatus()
          logToConsole("KYC status updated via realtime: " + userKycStatus, "info")
        }
        if (payload.new.avatar_url !== oldProfileData.avatar_url) {
          updateUserUI(payload.new)
          logToConsole("Avatar URL updated via realtime.", "info")
        }
      },
    )
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        console.log("Successfully subscribed to user updates channel!")
        logToConsole("Successfully subscribed to user updates channel!", "success")
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("Realtime user updates channel error:", err)
        logToConsole("Realtime user updates channel error.", "error", err)
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
        filter: "id=eq.1", // Assuming settings are in a single row with id=1
      },
      (payload) => {
        console.log("Realtime settings update received:", payload)
        logToConsole("Realtime settings update received.", "info", payload)
        if (payload.new.allow_transfers !== transfersEnabled) {
          transfersEnabled = payload.new.allow_transfers
          updateTransferStatus()
          logToConsole("Transfer enabled status updated via realtime: " + transfersEnabled, "info")
        }
      },
    )
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        console.log("Successfully subscribed to settings updates channel!")
        logToConsole("Successfully subscribed to settings updates channel!", "success")
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("Realtime settings updates channel error:", err)
        logToConsole("Realtime settings updates channel error.", "error", err)
      }
    })

  const transactionsChannel = supabase
    .channel("transactions-updates")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "transactions",
        // Filter for transactions involving the current user's phone
        // This requires userProfileData.phone to be available
        filter: userProfileData?.phone
          ? `or=(from_phone.eq.${userProfileData.phone},to_phone.eq.${userProfileData.phone})`
          : undefined,
      },
      (payload) => {
        console.log("Realtime transaction insert received:", payload)
        logToConsole("Realtime transaction insert received.", "info", payload)
        // Double check if the transaction involves the current user,
        // though the filter should handle this.
        if (
          currentUser &&
          userProfileData &&
          (payload.new.from_phone === userProfileData.phone || payload.new.to_phone === userProfileData.phone)
        ) {
          loadTransactions() // Reload all transactions to update the list
          if (payload.new.to_phone === userProfileData.phone && payload.new.from_phone !== userProfileData.phone) {
            if (transferReceivedSound) {
              transferReceivedSound.play().catch((e) => console.warn("Received sound play failed:", e))
            }
            logToConsole("Played transfer received sound.", "info")
          }
        }
      },
    )
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        console.log("Successfully subscribed to transactions updates channel!")
        logToConsole("Successfully subscribed to transactions updates channel!", "success")
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("Realtime transactions updates channel error:", err)
        logToConsole("Realtime transactions updates channel error.", "error", err)
      }
    })
}

// Load transactions
async function loadTransactions() {
  try {
    if (!userProfileData || !userProfileData.phone) {
      console.warn("Cannot load transactions: user profile or phone not available.")
      logToConsole("Cannot load transactions: user profile or phone not available.", "warn")
      updateTransactionsUI([], "")
      return
    }
    const userPhone = userProfileData.phone
    console.log("Loading transactions for phone:", userPhone)
    logToConsole("Loading transactions for phone: " + userPhone, "info")

    const { data: transactionsData, error } = await supabase
      .from("transactions")
      .select("*")
      .or(`from_phone.eq.${userPhone},to_phone.eq.${userPhone}`)
      .order("created_at", { ascending: false })
      .limit(10)

    if (error) {
      console.error("Error loading transactions:", error)
      logToConsole("Error loading transactions: " + error.message, "error", error)
      throw error
    }
    transactions = transactionsData || []
    console.log("Transactions loaded:", transactions.length)
    logToConsole("Transactions loaded: " + transactions.length, "success")
    updateTransactionsUI(transactions, userPhone)
  } catch (error) {
    console.error("Load transactions failed:", error)
    logToConsole("Load transactions failed: " + error.message, "error", error)
    const recentTransactionsList = document.getElementById("recent-transactions-list")
    const historyTransactionsList = document.getElementById("history-transactions-list")
    const errorHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>မှတ်တမ်းများ ရယူ၍မရပါ</p></div>`
    if (recentTransactionsList) recentTransactionsList.innerHTML = errorHTML
    if (historyTransactionsList) historyTransactionsList.innerHTML = errorHTML
  }
}

// Update transactions UI
function updateTransactionsUI(transactionsData, userPhone) {
  console.log("Updating transactions UI.")
  logToConsole("Updating transactions UI.", "info")
  const recentTransactionsList = document.getElementById("recent-transactions-list")
  const historyTransactionsList = document.getElementById("history-transactions-list")

  if (!recentTransactionsList || !historyTransactionsList) {
    console.warn("Transaction list UI elements not found.")
    logToConsole("Transaction list UI elements not found.", "warn")
    return
  }

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
    const otherPartyPhone = isSender ? transaction.to_phone : transaction.from_phone
    const otherPartyName = isSender ? transaction.to_name : transaction.from_name
    const transactionDate = new Date(transaction.created_at).toLocaleString("my-MM", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

    const transactionItem = `
            <div class="transaction-item ${isSender ? "sent" : "received"}">
                <div class="transaction-icon">
                    <i class="fas ${isSender ? "fa-arrow-up" : "fa-arrow-down"}"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-title">
                        ${isSender ? "ပို့ထားသော" : "လက်ခံရရှိသော"} (${otherPartyName || otherPartyPhone})
                    </div>
                    <div class="transaction-subtitle">
                       ${transaction.note ? `မှတ်ချက်: ${transaction.note}` : ""}
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
      const transactionIndex = Number.parseInt(button.getAttribute("data-transaction-index"), 10)
      if (transactionsData[transactionIndex]) {
        showTransactionReceipt(transactionsData[transactionIndex])
      } else {
        console.warn("Transaction data not found for index:", transactionIndex)
        logToConsole("Transaction data not found for index: " + transactionIndex, "warn")
      }
    })
  })
}

// Initialize UI elements and event listeners
function initializeUI() {
  console.log("Initializing UI elements and event listeners...")
  logToConsole("Initializing UI elements and event listeners...", "info")
  document.body.setAttribute("data-theme", currentTheme)

  document.querySelectorAll(".clickable").forEach((el) => {
    el.addEventListener("click", () => {
      if (clickSound && clickSound.readyState >= 2) {
        clickSound.currentTime = 0
        clickSound.play().catch((e) => console.warn("Click sound play failed:", e))
      }
    })
  })

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
      const indicator = document.querySelector(".tab-indicator")
      if (indicator) {
        if (tabName === "signup") {
          indicator.style.transform = "translateX(calc(100% + 4px))"
        } else {
          indicator.style.transform = "translateX(0%)"
        }
      }
    })
  })

  const togglePasswordButtons = document.querySelectorAll(".toggle-password")
  togglePasswordButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.previousElementSibling
      if (input && input.type === "password") {
        input.type = "text"
        button.classList.remove("fa-eye-slash")
        button.classList.add("fa-eye")
      } else if (input) {
        input.type = "password"
        button.classList.remove("fa-eye")
        button.classList.add("fa-eye-slash")
      }
    })
  })

  const sidebarLinks = document.querySelectorAll(".sidebar-nav a")
  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault()
      const pageName = link.getAttribute("data-page")
      showPage(pageName)
    })
  })

  const actionCards = document.querySelectorAll(".action-card")
  actionCards.forEach((card) => {
    card.addEventListener("click", () => {
      const pageName = card.getAttribute("data-page")
      showPage(pageName)
    })
  })

  const menuToggle = document.getElementById("menu-toggle")
  const closeSidebar = document.getElementById("close-sidebar")
  const sidebar = document.getElementById("sidebar")
  if (menuToggle && sidebar) menuToggle.addEventListener("click", () => sidebar.classList.add("active"))
  if (closeSidebar && sidebar) closeSidebar.addEventListener("click", () => sidebar.classList.remove("active"))

  const profileDropdownTrigger = document.getElementById("profile-dropdown-trigger")
  const profileDropdown = document.getElementById("profile-dropdown")
  if (profileDropdownTrigger && profileDropdown) {
    profileDropdownTrigger.addEventListener("click", (e) => {
      e.stopPropagation()
      profileDropdown.classList.toggle("active")
      const rect = profileDropdownTrigger.getBoundingClientRect()
      profileDropdown.style.top = `${rect.bottom + 10}px`
      profileDropdown.style.right = `${window.innerWidth - rect.right}px`
    })
    document.addEventListener("click", (e) => {
      if (
        profileDropdown &&
        !profileDropdown.contains(e.target) &&
        profileDropdownTrigger &&
        !profileDropdownTrigger.contains(e.target)
      ) {
        profileDropdown.classList.remove("active")
      }
    })
  }

  document.getElementById("view-profile")?.addEventListener("click", () => showPage("settings"))
  document.getElementById("go-to-settings")?.addEventListener("click", () => showPage("settings"))
  document.getElementById("dropdown-logout")?.addEventListener("click", logout)
  document.getElementById("logout-btn")?.addEventListener("click", logout)

  document.getElementById("refresh-balance")?.addEventListener("click", async () => {
    showLoader()
    await loadUserData()
    hideLoader()
  })
  document.getElementById("hide-balance")?.addEventListener("click", () => {
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
      const previewElement = document.getElementById(previewId)
      if (previewElement) {
        const reader = new FileReader()
        reader.onload = (event) => {
          previewElement.innerHTML = `<img src="${event.target.result}" alt="Preview" style="max-width: 100%; height: auto; border-radius: var(--radius-md); object-fit: contain; max-height: 150px;">`
        }
        reader.readAsDataURL(file)
      }
    })
  })

  const themeOptions = document.querySelectorAll(".theme-option")
  themeOptions.forEach((option) => {
    if (option.getAttribute("data-theme") === currentTheme) {
      option.classList.add("active")
    }
    option.addEventListener("click", () => {
      const theme = option.getAttribute("data-theme")
      applyTheme(theme)
      themeOptions.forEach((o) => o.classList.remove("active"))
      option.classList.add("active")
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
        const modal = document.getElementById(modalId)
        if (modal) modal.classList.add("active")
      })
    }
  })
  const modalCloseButtons = document.querySelectorAll(".modal-close, .modal-cancel")
  modalCloseButtons.forEach((button) => {
    button.addEventListener("click", () => {
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
  document.getElementById("download-receipt")?.addEventListener("click", downloadReceipt)
  setupFormSubmissions()

  const transferPhoneInput = document.getElementById("transfer-phone")
  if (transferPhoneInput) transferPhoneInput.addEventListener("blur", checkRecipientInfo)

  document.getElementById("save-profile-picture-btn")?.addEventListener("click", uploadProfilePicture)
  document.getElementById("delete-kyc-btn")?.addEventListener("click", confirmDeleteKyc)

  const consoleToggle = document.getElementById("console-toggle")
  const consoleHeader = document.querySelector(".console-header")
  const consoleContainer = document.getElementById("console-container")

  if (consoleToggle && consoleHeader && consoleContainer) {
    const toggleConsole = () => consoleContainer.classList.toggle("active")
    consoleToggle.addEventListener("click", toggleConsole)
    consoleHeader.addEventListener("click", (e) => {
      if (e.target === consoleHeader || e.target === consoleHeader.querySelector("span")) {
        toggleConsole()
      }
    })
  }
  logToConsole("UI Initialized.", "success")
}

function applyTheme(themeName) {
  console.log("Applying theme:", themeName)
  logToConsole("Applying theme: " + themeName, "info")
  if (themeName === "system") {
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    document.body.setAttribute("data-theme", systemPrefersDark ? "dark" : "light")
    console.log("System preference:", systemPrefersDark ? "dark" : "light")
    logToConsole("System preference: " + (systemPrefersDark ? "dark" : "light"), "info")
  } else {
    document.body.setAttribute("data-theme", themeName)
  }
  currentTheme = themeName
  localStorage.setItem("theme", themeName)
}

async function checkRecipientInfo() {
  const phone = document.getElementById("transfer-phone").value
  const recipientInfoDiv = document.getElementById("recipient-info")
  const recipientAvatarImg = document.getElementById("recipient-avatar")
  const recipientNameP = document.getElementById("recipient-name")
  const recipientIdP = document.getElementById("recipient-id")

  if (!recipientInfoDiv || !recipientAvatarImg || !recipientNameP || !recipientIdP) {
    console.warn("Recipient info UI elements not found.")
    logToConsole("Recipient info UI elements not found.", "warn")
    return
  }

  if (!phone || phone.length < 7) {
    // Basic phone number length check
    recipientInfoDiv.style.display = "none"
    return
  }
  logToConsole(`Checking recipient info for phone: ${phone}`, "info")

  try {
    const { data: recipient, error } = await supabase
      .from("users")
      .select("user_id, name, avatar_url, phone")
      .eq("phone", phone)
      .single()

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching recipient:", error)
      logToConsole("Error fetching recipient: " + error.message, "error", error)
      recipientInfoDiv.style.display = "block"
      recipientAvatarImg.src = DEFAULT_AVATAR_URL
      recipientNameP.textContent = "အချက်အလက် ရယူ၍မရပါ"
      recipientIdP.textContent = ""
      return
    }

    if (!recipient) {
      logToConsole("Recipient not found.", "warn")
      recipientInfoDiv.style.display = "block"
      recipientAvatarImg.src = DEFAULT_AVATAR_URL
      recipientNameP.textContent = "အသုံးပြုသူ မတွေ့ရှိပါ"
      recipientIdP.textContent = ""
      return
    }

    logToConsole("Recipient found:", "success", recipient)
    if (userProfileData && recipient.phone === userProfileData.phone) {
      recipientNameP.textContent = (recipient.name || `User ${recipient.user_id.slice(-4)}`) + " (သင်ကိုယ်တိုင်)"
    } else {
      recipientNameP.textContent = recipient.name || `User ${recipient.user_id.slice(-4)}`
    }
    recipientAvatarImg.src = recipient.avatar_url || DEFAULT_AVATAR_URL
    recipientIdP.textContent = `ID: ${recipient.user_id}`
    recipientInfoDiv.style.display = "block"
  } catch (err) {
    console.error("Exception checking recipient:", err)
    logToConsole("Exception checking recipient: " + err.message, "error", err)
    recipientInfoDiv.style.display = "none"
  }
}

async function uploadProfilePicture() {
  const fileInput = document.getElementById("profile-picture-upload")
  const file = fileInput.files[0]
  const errorElement = document.getElementById("profile-picture-error")
  const successElement = document.getElementById("profile-picture-success")

  errorElement.style.display = "none"
  successElement.style.display = "none"

  if (!file) {
    errorElement.textContent = "ကျေးဇူးပြု၍ ပုံရွေးချယ်ပါ"
    errorElement.style.display = "block"
    return
  }

  if (!currentUser || !currentUser.user_id) {
    errorElement.textContent = "အသုံးပြုသူ အချက်အလက် မတွေ့ရှိပါ"
    errorElement.style.display = "block"
    logToConsole("Cannot upload profile picture: currentUser is not set.", "error")
    return
  }
  logToConsole("Uploading profile picture...", "info")

  const fileName = `avatar_${currentUser.user_id}_${Date.now()}.${file.name.split(".").pop()}`

  try {
    showLoader()

    if (userProfileData && userProfileData.avatar_url) {
      const oldFilePath = userProfileData.avatar_url.split("/avatars/")[1]
      if (oldFilePath) {
        logToConsole(`Removing old avatar: ${oldFilePath}`, "info")
        const { error: removeError } = await supabase.storage.from("avatars").remove([oldFilePath])
        if (removeError) {
          console.warn("Failed to remove old avatar:", removeError.message)
          logToConsole("Failed to remove old avatar: " + removeError.message, "warn", removeError)
        }
      }
    }

    const { data: uploadData, error: uploadError } = await supabase.storage.from("avatars").upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName)
    const avatarUrl = urlData.publicUrl
    logToConsole("Profile picture uploaded. URL: " + avatarUrl, "success")

    const { error: updateError } = await supabase
      .from("users")
      .update({ avatar_url: avatarUrl })
      .eq("user_id", currentUser.user_id)

    if (updateError) throw updateError

    if (userProfileData) userProfileData.avatar_url = avatarUrl
    updateUserUI(userProfileData)

    successElement.textContent = "ပရိုဖိုင်ပုံ အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။"
    successElement.style.display = "block"
    fileInput.value = "" // Clear the file input
    document.getElementById("profile-picture-preview").innerHTML = "" // Clear preview
  } catch (error) {
    console.error("Profile picture upload error:", error)
    logToConsole("Profile picture upload error: " + error.message, "error", error)
    errorElement.textContent = "ပရိုဖိုင်ပုံ တင်ရာတွင် အမှားဖြစ်ပေါ်နေပါသည်။ " + (error.message || error)
    errorElement.style.display = "block"
  } finally {
    hideLoader()
  }
}

function confirmDeleteKyc() {
  const modalTitle = document.getElementById("confirmation-title")
  const modalMessage = document.getElementById("confirmation-message")
  const pinSection = document.getElementById("pin-confirmation-section")
  const confirmActionBtn = document.getElementById("confirm-action-btn")
  const confirmationError = document.getElementById("confirmation-error")

  modalTitle.textContent = "KYC ဖျက်သိမ်းရန် အတည်ပြုပါ"
  modalMessage.textContent = "သင်၏ KYC အချက်အလက်များကို ဖျက်သိမ်းလိုကြောင်း သေချာပါသလား? ဤလုပ်ဆောင်ချက်ကို နောက်ပြန်လှည့်၍မရပါ။"
  pinSection.style.display = "block"
  document.getElementById("confirmation-pin").value = ""
  confirmationError.style.display = "none"

  confirmationModal.classList.add("active")

  // Re-bind event listener to avoid multiple executions if button is clicked multiple times
  const oldBtn = confirmActionBtn
  const newBtn = oldBtn.cloneNode(true) // Create a new button
  oldBtn.parentNode.replaceChild(newBtn, oldBtn) // Replace old with new
  newBtn.addEventListener("click", handleDeleteKyc) // Add listener to the new button
  logToConsole("KYC deletion confirmation modal shown.", "info")
}

async function handleDeleteKyc() {
  const pin = document.getElementById("confirmation-pin").value
  const confirmationError = document.getElementById("confirmation-error")
  const deleteKycError = document.getElementById("delete-kyc-error") // Error message on KYC page
  const deleteKycSuccess = document.getElementById("delete-kyc-success") // Success message on KYC page

  confirmationError.style.display = "none"
  deleteKycError.style.display = "none"
  deleteKycSuccess.style.display = "none"

  if (!pin || pin.length !== 6) {
    confirmationError.textContent = "ကျေးဇူးပြု၍ PIN ၆ လုံး ထည့်ပါ။"
    confirmationError.style.display = "block"
    return
  }

  if (!userProfileData || userProfileData.payment_pin !== pin) {
    confirmationError.textContent = "PIN မှားယွင်းနေပါသည်။"
    confirmationError.style.display = "block"
    return
  }
  logToConsole("Deleting KYC information...", "info")

  try {
    showLoader()
    const filesToDelete = []
    if (userProfileData.passport_image) {
      filesToDelete.push(userProfileData.passport_image.split("/kyc-documents/")[1])
    }
    if (userProfileData.selfie_image) {
      filesToDelete.push(userProfileData.selfie_image.split("/kyc-documents/")[1])
    }

    if (filesToDelete.length > 0) {
      logToConsole(
        "Removing KYC documents from storage:",
        "info",
        filesToDelete.filter((f) => f),
      )
      const { error: deleteStorageError } = await supabase.storage
        .from("kyc-documents")
        .remove(filesToDelete.filter((f) => f)) // Filter out undefined/null paths
      if (deleteStorageError) {
        console.warn("Error deleting KYC documents from storage:", deleteStorageError.message)
        logToConsole(
          "Error deleting KYC documents from storage: " + deleteStorageError.message,
          "warn",
          deleteStorageError,
        )
      }
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({
        passport_number: null,
        address: null,
        passport_image: null,
        selfie_image: null,
        passport_status: "pending", // Reset status
        submitted_at: null,
      })
      .eq("user_id", currentUser.user_id)

    if (updateError) throw updateError

    userKycStatus = "pending"
    if (userProfileData) {
      userProfileData.passport_number = null
      userProfileData.address = null
      userProfileData.passport_image = null
      userProfileData.selfie_image = null
      userProfileData.passport_status = "pending"
    }

    updateKycStatus() // Refresh UI
    confirmationModal.classList.remove("active")
    deleteKycSuccess.textContent = "KYC အချက်အလက်များ အောင်မြင်စွာ ဖျက်သိမ်းပြီးပါပြီ။"
    deleteKycSuccess.style.display = "block"
    logToConsole("KYC information deleted successfully.", "success")
  } catch (error) {
    console.error("KYC deletion error:", error)
    logToConsole("KYC deletion error: " + error.message, "error", error)
    confirmationModal.classList.remove("active")
    deleteKycError.textContent = "KYC ဖျက်သိမ်းရာတွင် အမှားဖြစ်ပေါ်နေပါသည်။ " + (error.message || error)
    deleteKycError.style.display = "block"
  } finally {
    hideLoader()
  }
}

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
  document.getElementById("confirm-pin-btn")?.addEventListener("click", () => {
    let pin = ""
    pinInputs.forEach((input) => (pin += input.value))
    const pinErrorElement = document.getElementById("pin-error")
    if (pin.length !== 6) {
      pinErrorElement.textContent = "PIN ၆ လုံး ထည့်ပါ"
      pinErrorElement.style.display = "block"
      return
    }
    pinErrorElement.style.display = "none"
    processTransferWithPin(pin)
  })
}

function setupFormSubmissions() {
  console.log("Setting up form submissions...")
  logToConsole("Setting up form submissions...", "info")

  const loginForm = document.getElementById("login-form")
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault() // Prevent default form submission
    const loginBtn = document.getElementById("login-btn") // Get button for potential disabling
    if (loginBtn) loginBtn.disabled = true

    const email = document.getElementById("login-email").value
    const password = document.getElementById("login-password").value
    const errorElement = document.getElementById("login-error")
    const successElement = document.getElementById("login-success")

    errorElement.style.display = "none"
    successElement.style.display = "none"

    if (!email || !password) {
      errorElement.textContent = "အီးမေးလ်နှင့် စကားဝှက် ထည့်ပါ။"
      errorElement.style.display = "block"
      if (loginBtn) loginBtn.disabled = false
      return
    }
    logToConsole(`Attempting login for: ${email}`, "info")
    showLoader()
    try {
      const { data: user, error } = await supabase.from("auth_users").select("*").eq("email", email).single()

      if (error && error.code !== "PGRST116") {
        // PGRST116 means no rows found, which is handled below
        logToConsole("Login DB error (not PGRST116): " + error.message, "error", error)
        throw error
      }
      if (!user) {
        errorElement.textContent = "အကောင့်မတွေ့ရှိပါ။"
        errorElement.style.display = "block"
        logToConsole("Login attempt: User not found for email " + email, "warn")
        hideLoader()
        if (loginBtn) loginBtn.disabled = false
        return
      }
      if (user.password !== password) {
        errorElement.textContent = "စကားဝှက်မှားယွင်းနေပါသည်။"
        errorElement.style.display = "block"
        logToConsole("Login attempt: Incorrect password for email " + email, "warn")
        hideLoader()
        if (loginBtn) loginBtn.disabled = false
        return
      }
      currentUser = user
      localStorage.setItem("opperSession", JSON.stringify({ email: user.email, user_id: user.user_id }))
      successElement.textContent = "အကောင့်ဝင်ရောက်နေပါသည်..."
      successElement.style.display = "block"
      logToConsole("Login successful. Loading user data...", "success")
      await loadUserData()
      showAppContainer()
      // initializeUI() // UI is already initialized once. Re-calling might duplicate listeners.
      // Specific UI updates are handled by loadUserData and showAppContainer.
    } catch (error) {
      console.error("Login error:", error)
      logToConsole("Login error: " + error.message, "error", error)
      errorElement.textContent = "အကောင့်ဝင်ရာတွင် အမှားရှိနေပါသည်။ " + (error.message || "Unknown error")
      errorElement.style.display = "block"
    } finally {
      if (loginBtn) loginBtn.disabled = false
      // Loader hiding is handled by initializeApp or here if it's not the initial load
      if (
        !document.getElementById("intro-animation") ||
        document.getElementById("intro-animation").classList.contains("hidden")
      ) {
        hideLoader()
      }
    }
  })

  const googleLoginBtn = document.getElementById("google-login-btn")
  if (googleLoginBtn)
    googleLoginBtn.addEventListener("click", () => {
      alert("Google Login is not implemented in this version.")
      logToConsole("Google Login button clicked (not implemented).", "warn")
    })

  const signupForm = document.getElementById("signup-form")
  signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault()
    const signupBtn = document.getElementById("signup-btn")
    if (signupBtn) signupBtn.disabled = true

    const email = document.getElementById("signup-email").value
    const phone = document.getElementById("signup-phone").value
    const password = document.getElementById("signup-password").value
    const confirmPassword = document.getElementById("signup-confirm-password").value
    const termsAgree = document.getElementById("terms-agree").checked
    const errorElement = document.getElementById("signup-error")
    const successElement = document.getElementById("signup-success")

    errorElement.style.display = "none"
    successElement.style.display = "none"

    if (!email || !phone || !password || !confirmPassword) {
      errorElement.textContent = "အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။"
      errorElement.style.display = "block"
      if (signupBtn) signupBtn.disabled = false
      return
    }
    if (password !== confirmPassword) {
      errorElement.textContent = "စကားဝှက်နှင့် အတည်ပြုစကားဝှက် မတူညီပါ။"
      errorElement.style.display = "block"
      if (signupBtn) signupBtn.disabled = false
      return
    }
    if (!termsAgree) {
      errorElement.textContent = "စည်းမျဉ်းစည်းကမ်းများကို သဘောတူရန် လိုအပ်ပါသည်။"
      errorElement.style.display = "block"
      if (signupBtn) signupBtn.disabled = false
      return
    }
    logToConsole(`Attempting signup for: ${email}, Phone: ${phone}`, "info")
    showLoader()
    try {
      const { data: existingUserByEmail } = await supabase
        .from("auth_users")
        .select("email")
        .eq("email", email)
        .single() // Expects one or zero. Error if multiple (due to lack of unique constraint before)
      if (existingUserByEmail) {
        errorElement.textContent = "ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
        errorElement.style.display = "block"
        logToConsole("Signup attempt: Email already exists - " + email, "warn")
        hideLoader()
        if (signupBtn) signupBtn.disabled = false
        return
      }
      const { data: existingUserByPhone } = await supabase.from("users").select("phone").eq("phone", phone).single()
      if (existingUserByPhone) {
        errorElement.textContent = "ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
        errorElement.style.display = "block"
        logToConsole("Signup attempt: Phone already exists - " + phone, "warn")
        hideLoader()
        if (signupBtn) signupBtn.disabled = false
        return
      }

      const userId = generateUserId(email)
      const { error: authError } = await supabase.from("auth_users").insert([{ user_id: userId, email, password }])
      if (authError) throw authError

      const defaultName = email.split("@")[0]
      const { error: profileError } = await supabase
        .from("users")
        .insert([{ user_id: userId, phone, name: defaultName, balance: 0, passport_status: "pending" }])
      if (profileError) {
        // Attempt to rollback auth_user creation if profile creation fails
        logToConsole("Profile creation failed, attempting to rollback auth_user: " + userId, "error", profileError)
        await supabase.from("auth_users").delete().eq("user_id", userId)
        throw profileError
      }

      successElement.textContent = "အကောင့်ဖွင့်ပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။"
      successElement.style.display = "block"
      if (signupForm && typeof signupForm.reset === "function") {
        signupForm.reset()
      }
      logToConsole("Signup successful for: " + email, "success")
      setTimeout(() => document.querySelector('.auth-tab[data-tab="login"]')?.click(), 2000)
    } catch (error) {
      console.error("Signup error:", error)
      logToConsole("Signup error: " + error.message, "error", error)
      errorElement.textContent = "အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။ " + (error.message || "Unknown error")
      errorElement.style.display = "block"
    } finally {
      if (signupBtn) signupBtn.disabled = false
      hideLoader()
    }
  })

  const googleSignupBtn = document.getElementById("google-signup-btn")
  if (googleSignupBtn)
    googleSignupBtn.addEventListener("click", () => {
      alert("Google Signup is not implemented in this version.")
      logToConsole("Google Signup button clicked (not implemented).", "warn")
    })

  const transferForm = document.getElementById("transfer-page")?.querySelector(".transfer-form")
  transferForm?.addEventListener("submit", async (e) => {
    e.preventDefault() // This is already handled by onsubmit="return false;" on the form, but good for explicitness
    const transferBtn = document.getElementById("transfer-btn")
    if (transferBtn) transferBtn.disabled = true

    // ... rest of the transfer logic from the click event ...
    const phone = document.getElementById("transfer-phone").value
    const amountInput = document.getElementById("transfer-amount").value
    const errorElement = document.getElementById("transfer-error")
    const successElement = document.getElementById("transfer-success")

    errorElement.style.display = "none"
    successElement.style.display = "none"

    const amount = Number.parseInt(amountInput)

    if (!phone || !amountInput || isNaN(amount)) {
      errorElement.textContent = "ဖုန်းနံပါတ်နှင့် ငွေပမာဏ မှန်ကန်စွာ ထည့်ပါ။"
      errorElement.style.display = "block"
      if (transferBtn) transferBtn.disabled = false
      return
    }
    // ... (all other validations) ...
    if (amount < 1000) {
      errorElement.textContent = "ငွေပမာဏ အနည်းဆုံး 1,000 Ks ဖြစ်ရပါမည်။"
      errorElement.style.display = "block"
      if (transferBtn) transferBtn.disabled = false
      return
    }
    if (!transfersEnabled) {
      errorElement.textContent = "ငွေလွှဲခြင်းကို ယာယီပိတ်ထားပါသည်။ နောက်မှ ပြန်လည်ကြိုးစားပါ။"
      errorElement.style.display = "block"
      if (transferBtn) transferBtn.disabled = false
      return
    }
    if (userKycStatus !== "approved") {
      errorElement.textContent = "ငွေလွှဲရန် KYC အတည်ပြုရန် လိုအပ်ပါသည်။"
      errorElement.style.display = "block"
      if (transferBtn) transferBtn.disabled = false
      return
    }
    if (userBalance < amount) {
      errorElement.textContent = "လက်ကျန်ငွေ မလုံလောက်ပါ။"
      errorElement.style.display = "block"
      if (transferBtn) transferBtn.disabled = false
      return
    }
    if (userProfileData && userProfileData.phone === phone) {
      errorElement.textContent = "ကိုယ့်ကိုယ်ကို ငွေလွှဲ၍မရပါ။"
      errorElement.style.display = "block"
      if (transferBtn) transferBtn.disabled = false
      return
    }

    try {
      const { data: recipient, error: recipientError } = await supabase
        .from("users")
        .select("user_id, phone")
        .eq("phone", phone)
        .single()

      if (recipientError && recipientError.code !== "PGRST116") {
        console.error("Error fetching recipient for transfer:", recipientError)
        logToConsole("Error fetching recipient for transfer: " + recipientError.message, "error", recipientError)
        errorElement.textContent = "လက်ခံမည့်သူ အချက်အလက် ရယူရာတွင် အမှားရှိနေပါသည်။"
        errorElement.style.display = "block"
        if (transferBtn) transferBtn.disabled = false
        return
      }
      if (!recipient) {
        errorElement.textContent = "လက်ခံမည့်သူ မတွေ့ရှိပါ။"
        errorElement.style.display = "block"
        logToConsole("Transfer attempt: Recipient not found for phone " + phone, "warn")
        if (transferBtn) transferBtn.disabled = false
        return
      }
      showPinEntryModal()
    } catch (err) {
      console.error("Error during transfer pre-check:", err)
      logToConsole("Error during transfer pre-check: " + err.message, "error", err)
      errorElement.textContent = "ငွေလွှဲရန် ပြင်ဆင်ရာတွင် အမှားရှိနေပါသည်။"
      errorElement.style.display = "block"
    } finally {
      if (transferBtn) transferBtn.disabled = false // Re-enable button if PIN modal isn't shown
    }
  })
  // Note: The actual transfer logic is in processTransferWithPin, called after PIN entry.
  // The transfer button itself (transfer-btn) should trigger the pre-checks and PIN modal.
  // So, the above event listener should be on the transfer-btn's click, not form submit,
  // unless the form submit is explicitly triggered by the button.
  // The original code had a click listener on transfer-btn, which is better.
  // I'll revert to that structure for clarity.

  const transferBtn = document.getElementById("transfer-btn")
  if (transferBtn) {
    transferBtn.addEventListener("click", async () => {
      // Logic from the transferForm.addEventListener('submit', ...) should be here
      if (transferBtn) transferBtn.disabled = true

      const phone = document.getElementById("transfer-phone").value
      const amountInput = document.getElementById("transfer-amount").value
      const errorElement = document.getElementById("transfer-error")
      const successElement = document.getElementById("transfer-success")

      errorElement.style.display = "none"
      successElement.style.display = "none"

      const amount = Number.parseInt(amountInput)

      if (!phone || !amountInput || isNaN(amount)) {
        errorElement.textContent = "ဖုန်းနံပါတ်နှင့် ငွေပမာဏ မှန်ကန်စွာ ထည့်ပါ။"
        errorElement.style.display = "block"
        if (transferBtn) transferBtn.disabled = false
        return
      }
      if (amount < 1000) {
        errorElement.textContent = "ငွေပမာဏ အနည်းဆုံး 1,000 Ks ဖြစ်ရပါမည်။"
        errorElement.style.display = "block"
        if (transferBtn) transferBtn.disabled = false
        return
      }
      if (!transfersEnabled) {
        errorElement.textContent = "ငွေလွှဲခြင်းကို ယာယီပိတ်ထားပါသည်။ နောက်မှ ပြန်လည်ကြိုးစားပါ။"
        errorElement.style.display = "block"
        if (transferBtn) transferBtn.disabled = false
        return
      }
      if (userKycStatus !== "approved") {
        errorElement.textContent = "ငွေလွှဲရန် KYC အတည်ပြုရန် လိုအပ်ပါသည်။"
        errorElement.style.display = "block"
        if (transferBtn) transferBtn.disabled = false
        return
      }
      if (userBalance < amount) {
        errorElement.textContent = "လက်ကျန်ငွေ မလုံလောက်ပါ။"
        errorElement.style.display = "block"
        if (transferBtn) transferBtn.disabled = false
        return
      }
      if (userProfileData && userProfileData.phone === phone) {
        errorElement.textContent = "ကိုယ့်ကိုယ်ကို ငွေလွှဲ၍မရပါ။"
        errorElement.style.display = "block"
        if (transferBtn) transferBtn.disabled = false
        return
      }

      try {
        const { data: recipient, error: recipientError } = await supabase
          .from("users")
          .select("user_id, phone")
          .eq("phone", phone)
          .single()

        if (recipientError && recipientError.code !== "PGRST116") {
          console.error("Error fetching recipient for transfer:", recipientError)
          logToConsole("Error fetching recipient for transfer: " + recipientError.message, "error", recipientError)
          errorElement.textContent = "လက်ခံမည့်သူ အချက်အလက် ရယူရာတွင် အမှားရှိနေပါသည်။"
          errorElement.style.display = "block"
          if (transferBtn) transferBtn.disabled = false
          return
        }
        if (!recipient) {
          errorElement.textContent = "လက်ခံမည့်သူ မတွေ့ရှိပါ။"
          errorElement.style.display = "block"
          logToConsole("Transfer attempt: Recipient not found for phone " + phone, "warn")
          if (transferBtn) transferBtn.disabled = false
          return
        }
        showPinEntryModal() // This will eventually call processTransferWithPin
      } catch (err) {
        console.error("Error during transfer pre-check:", err)
        logToConsole("Error during transfer pre-check: " + err.message, "error", err)
        errorElement.textContent = "ငွေလွှဲရန် ပြင်ဆင်ရာတွင် အမှားရှိနေပါသည်။"
        errorElement.style.display = "block"
      } finally {
        // Only re-enable if PIN modal isn't shown or an error occurred before it.
        // The PIN modal flow will handle button state.
        if (!pinEntryModal.classList.contains("active")) {
          if (transferBtn) transferBtn.disabled = false
        }
      }
    })
  }

  const kycFormElement = document.getElementById("kyc-form")
  kycFormElement?.addEventListener("submit", async (e) => {
    e.preventDefault()
    const kycSubmitBtn = document.getElementById("kyc-submit-btn")
    if (kycSubmitBtn) kycSubmitBtn.disabled = true

    const passportNumber = document.getElementById("kyc-passport-input").value
    const address = document.getElementById("kyc-address-input").value
    const pin = document.getElementById("kyc-pin-input").value
    const confirmPin = document.getElementById("kyc-confirm-pin-input").value
    const passportFile = document.getElementById("passport-upload").files[0]
    const selfieFile = document.getElementById("selfie-upload").files[0]
    const errorElement = document.getElementById("kyc-error")
    const successElement = document.getElementById("kyc-success")

    errorElement.style.display = "none"
    successElement.style.display = "none"

    if (!passportNumber || !address || !pin || !confirmPin || !passportFile || !selfieFile) {
      errorElement.textContent = "အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။"
      errorElement.style.display = "block"
      if (kycSubmitBtn) kycSubmitBtn.disabled = false
      return
    }
    // ... (other validations for KYC form) ...
    if (pin !== confirmPin) {
      errorElement.textContent = "PIN နှင့် အတည်ပြု PIN မတူညီပါ။"
      errorElement.style.display = "block"
      if (kycSubmitBtn) kycSubmitBtn.disabled = false
      return
    }
    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      errorElement.textContent = "PIN သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။"
      errorElement.style.display = "block"
      if (kycSubmitBtn) kycSubmitBtn.disabled = false
      return
    }

    logToConsole("Submitting KYC information...", "info")
    showLoader()
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
          payment_pin: pin,
          passport_image: passportUrlData.publicUrl,
          selfie_image: selfieUrlData.publicUrl,
          passport_status: "pending",
          submitted_at: new Date().toISOString(),
        })
        .eq("user_id", currentUser.user_id)
      if (updateError) throw updateError

      userKycStatus = "pending"
      if (userProfileData) {
        userProfileData.passport_number = passportNumber
        userProfileData.address = address
        userProfileData.payment_pin = pin
        userProfileData.passport_image = passportUrlData.publicUrl
        userProfileData.selfie_image = selfieUrlData.publicUrl
        userProfileData.passport_status = "pending"
      }
      updateKycStatus()

      successElement.textContent = "KYC အချက်အလက်များ အောင်မြင်စွာ တင်သွင်းပြီးပါပြီ။ စိစစ်နေပါပြီ။"
      successElement.style.display = "block"
      if (kycFormElement && typeof kycFormElement.reset === "function") {
        kycFormElement.reset()
      }
      document.getElementById("passport-preview").innerHTML = ""
      document.getElementById("selfie-preview").innerHTML = ""
      logToConsole("KYC submitted successfully.", "success")
    } catch (error) {
      console.error("KYC submission error:", error)
      logToConsole("KYC submission error: " + error.message, "error", error)
      errorElement.textContent = "KYC တင်သွင်းရာတွင် အမှားရှိနေပါသည်။ " + (error.message || "Unknown error")
      errorElement.style.display = "block"
    } finally {
      if (kycSubmitBtn) kycSubmitBtn.disabled = false
      hideLoader()
    }
  })

  const savePasswordBtn = document.getElementById("save-password-btn")
  if (savePasswordBtn)
    savePasswordBtn.addEventListener("click", async () => {
      // Changed from form submit to button click
      if (savePasswordBtn) savePasswordBtn.disabled = true

      const currentPassword = document.getElementById("current-password").value
      const newPassword = document.getElementById("new-password").value
      const confirmNewPassword = document.getElementById("confirm-new-password").value
      const errorElement = document.getElementById("change-password-error")
      const successElement = document.getElementById("change-password-success")

      errorElement.style.display = "none"
      successElement.style.display = "none"

      if (!currentPassword || !newPassword || !confirmNewPassword) {
        errorElement.textContent = "အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။"
        errorElement.style.display = "block"
        if (savePasswordBtn) savePasswordBtn.disabled = false
        return
      }
      // ... (other validations) ...
      if (newPassword !== confirmNewPassword) {
        errorElement.textContent = "စကားဝှက်အသစ်နှင့် အတည်ပြုစကားဝှက် မတူညီပါ။"
        errorElement.style.display = "block"
        if (savePasswordBtn) savePasswordBtn.disabled = false
        return
      }

      logToConsole("Changing password...", "info")
      showLoader()
      try {
        const { data: user, error: fetchError } = await supabase
          .from("auth_users")
          .select("password")
          .eq("user_id", currentUser.user_id)
          .single()
        if (fetchError) throw fetchError

        if (user.password !== currentPassword) {
          errorElement.textContent = "လက်ရှိစကားဝှက် မှားယွင်းနေပါသည်။"
          errorElement.style.display = "block"
          hideLoader()
          if (savePasswordBtn) savePasswordBtn.disabled = false
          return
        }
        const { error: updateError } = await supabase
          .from("auth_users")
          .update({ password: newPassword })
          .eq("user_id", currentUser.user_id)
        if (updateError) throw updateError

        successElement.textContent = "စကားဝှက် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။"
        successElement.style.display = "block"
        const changePasswordForm = document.getElementById("change-password-modal")?.querySelector("form")
        if (changePasswordForm && typeof changePasswordForm.reset === "function") {
          changePasswordForm.reset()
        }
        logToConsole("Password changed successfully.", "success")
        setTimeout(() => document.getElementById("change-password-modal")?.classList.remove("active"), 2000)
      } catch (error) {
        console.error("Change password error:", error)
        logToConsole("Change password error: " + error.message, "error", error)
        errorElement.textContent = "စကားဝှက်ပြောင်းရာတွင် အမှားရှိနေပါသည်။ " + (error.message || "Unknown error")
        errorElement.style.display = "block"
      } finally {
        if (savePasswordBtn) savePasswordBtn.disabled = false
        hideLoader()
      }
    })

  const savePinBtn = document.getElementById("save-pin-btn")
  if (savePinBtn)
    savePinBtn.addEventListener("click", async () => {
      // Changed from form submit to button click
      if (savePinBtn) savePinBtn.disabled = true

      const currentPin = document.getElementById("current-pin").value
      const newPin = document.getElementById("new-pin").value
      const confirmNewPin = document.getElementById("confirm-new-pin").value
      const errorElement = document.getElementById("change-pin-error")
      const successElement = document.getElementById("change-pin-success")

      errorElement.style.display = "none"
      successElement.style.display = "none"

      if (!currentPin || !newPin || !confirmNewPin) {
        errorElement.textContent = "အကွက်အားလုံးကို ဖြည့်ပါ။"
        errorElement.style.display = "block"
        if (savePinBtn) savePinBtn.disabled = false
        return
      }
      // ... (other validations) ...
      if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
        errorElement.textContent = "PIN နံပါတ်အသစ်သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။"
        errorElement.style.display = "block"
        if (savePinBtn) savePinBtn.disabled = false
        return
      }
      if (newPin !== confirmNewPin) {
        errorElement.textContent = "PIN နံပါတ်အသစ်နှင့် အတည်ပြု PIN နံပါတ် မတူညီပါ။"
        errorElement.style.display = "block"
        if (savePinBtn) savePinBtn.disabled = false
        return
      }
      if (!userProfileData || userProfileData.payment_pin !== currentPin) {
        errorElement.textContent = "လက်ရှိ PIN နံပါတ် မှားယွင်းနေပါသည်။"
        errorElement.style.display = "block"
        if (savePinBtn) savePinBtn.disabled = false
        return
      }

      logToConsole("Changing payment PIN...", "info")
      showLoader()
      try {
        const { error: updateError } = await supabase
          .from("users")
          .update({ payment_pin: newPin })
          .eq("user_id", currentUser.user_id)
        if (updateError) throw updateError

        if (userProfileData) userProfileData.payment_pin = newPin

        successElement.textContent = "PIN နံပါတ် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။"
        successElement.style.display = "block"
        const changePinForm = document.getElementById("change-pin-modal")?.querySelector("form")
        if (changePinForm && typeof changePinForm.reset === "function") {
          changePinForm.reset()
        }
        logToConsole("Payment PIN changed successfully.", "success")
        setTimeout(() => document.getElementById("change-pin-modal")?.classList.remove("active"), 2000)
      } catch (error) {
        console.error("Change PIN error:", error)
        logToConsole("Change PIN error: " + error.message, "error", error)
        errorElement.textContent = "PIN နံပါတ်ပြောင်းရာတွင် အမှားအယွင်း ဖြစ်ပေါ်နေပါသည်။ " + (error.message || "Unknown error")
        errorElement.style.display = "block"
      } finally {
        if (savePinBtn) savePinBtn.disabled = false
        hideLoader()
      }
    })

  const confirmDeleteAccountBtn = document.getElementById("confirm-delete-btn")
  if (confirmDeleteAccountBtn)
    confirmDeleteAccountBtn.addEventListener("click", async () => {
      // Changed from form submit to button click
      if (confirmDeleteAccountBtn) confirmDeleteAccountBtn.disabled = false

      const password = document.getElementById("delete-password").value
      const confirmCheckbox = document.getElementById("confirm-delete").checked
      const errorElement = document.getElementById("delete-account-error")
      errorElement.style.display = "none"

      if (!password) {
        errorElement.textContent = "စကားဝှက်ထည့်သွင်းပါ။"
        errorElement.style.display = "block"
        if (confirmDeleteAccountBtn) confirmDeleteAccountBtn.disabled = false
        return
      }
      // ... (other validations) ...
      if (!confirmCheckbox) {
        errorElement.textContent = "အကောင့်ဖျက်သိမ်းရန် အတည်ပြုပေးပါ။"
        errorElement.style.display = "block"
        if (confirmDeleteAccountBtn) confirmDeleteAccountBtn.disabled = false
        return
      }
      if (!currentUser || currentUser.password !== password) {
        errorElement.textContent = "စကားဝှက် မှားယွင်းနေပါသည်။"
        errorElement.style.display = "block"
        if (confirmDeleteAccountBtn) confirmDeleteAccountBtn.disabled = false
        return
      }

      logToConsole("Deleting account...", "warn")
      showLoader()
      try {
        // Ensure RLS allows user to delete their own records or use a service role / edge function for this.
        // The current setup relies on CASCADE delete from users to auth_users.
        const { error: deleteUserError } = await supabase.from("users").delete().eq("user_id", currentUser.user_id)
        if (deleteUserError) throw deleteUserError

        // Delete associated storage files
        if (userProfileData) {
          if (userProfileData.avatar_url) {
            const avatarPath = userProfileData.avatar_url.split("/avatars/")[1]
            if (avatarPath) await supabase.storage.from("avatars").remove([avatarPath])
          }
          const kycFilesToDelete = []
          if (userProfileData.passport_image)
            kycFilesToDelete.push(userProfileData.passport_image.split("/kyc-documents/")[1])
          if (userProfileData.selfie_image)
            kycFilesToDelete.push(userProfileData.selfie_image.split("/kyc-documents/")[1])
          if (kycFilesToDelete.length > 0) {
            await supabase.storage.from("kyc-documents").remove(kycFilesToDelete.filter((f) => f))
          }
        }

        logToConsole("Account deleted successfully.", "success")
        logout()
        alert("သင့်အကောင့်ကို အောင်မြင်စွာ ဖျက်သိမ်းပြီးပါပြီ။")
        document.getElementById("delete-account-modal")?.classList.remove("active")
      } catch (error) {
        console.error("Delete account error:", error)
        logToConsole("Delete account error: " + error.message, "error", error)
        errorElement.textContent = "အကောင့်ဖျက်သိမ်းရာတွင် အမှားအယွင်း ဖြစ်ပေါ်နေပါသည်။ " + (error.message || "Unknown error")
        errorElement.style.display = "block"
      } finally {
        if (confirmDeleteAccountBtn) confirmDeleteAccountBtn.disabled = false
        hideLoader()
      }
    })
}

function showPinEntryModal() {
  document.querySelectorAll(".pin-input").forEach((input) => (input.value = ""))
  const pinErrorElement = document.getElementById("pin-error")
  if (pinErrorElement) pinErrorElement.style.display = "none"
  if (pinEntryModal) {
    pinEntryModal.classList.add("active")
    const firstPinInput = pinEntryModal.querySelector(".pin-input")
    if (firstPinInput) firstPinInput.focus()
    logToConsole("PIN entry modal shown.", "info")
  } else {
    logToConsole("PIN entry modal element not found.", "error")
  }
}

async function processTransferWithPin(pin) {
  const phone = document.getElementById("transfer-phone").value
  const amount = Number.parseInt(document.getElementById("transfer-amount").value)
  const note = document.getElementById("transfer-note").value
  const errorElement = document.getElementById("transfer-error") // Error on transfer page
  const successElement = document.getElementById("transfer-success") // Success on transfer page

  if (pinEntryModal) pinEntryModal.classList.remove("active")
  if (processingOverlay) processingOverlay.classList.add("active")
  logToConsole(`Processing transfer to ${phone} for amount ${amount} with PIN.`, "info")

  try {
    const { data: transferResult, error: functionError } = await supabase.functions.invoke("process-transfer", {
      body: {
        to_phone: phone,
        amount: amount,
        note: note,
        payment_pin: pin,
      },
    })

    if (functionError) {
      console.error("Supabase function invocation error:", functionError)
      logToConsole("Supabase function 'process-transfer' error: " + functionError.message, "error", functionError)
      throw new Error(functionError.message || "Function invocation failed")
    }

    if (!transferResult || !transferResult.success) {
      console.warn("Transfer function returned failure:", transferResult)
      logToConsole("Transfer function returned failure.", "warn", transferResult)
      throw new Error(transferResult.message || "ငွေလွှဲခြင်း မအောင်မြင်ပါ (function error)")
    }

    logToConsole("Transfer successful via function:", "success", transferResult)
    // Balance update should ideally come from realtime subscription or be re-fetched.
    // Optimistic update:
    // userBalance -= amount;
    // document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`;
    // document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`;
    // Forcing a reload of user data to get the latest balance from the server
    await loadUserData()

    if (transferSentSound) transferSentSound.play().catch((e) => console.warn("Sent sound play failed:", e))

    setTimeout(() => {
      if (processingOverlay) processingOverlay.classList.remove("active")
      if (errorElement) errorElement.style.display = "none"
      if (successElement) {
        successElement.textContent = `${amount.toLocaleString()} Ks ကို ${phone} သို့ အောင်မြင်စွာ လွှဲပြောင်းပြီးပါပြီ။`
        successElement.style.display = "block"
      }
      if (transferResult.transaction) {
        showTransactionReceipt(transferResult.transaction)
      } else {
        // If function doesn't return full transaction, create a mock one for receipt
        // This might be less accurate if the function generates the ID or timestamp differently.
        const mockTransaction = {
          id: transferResult.transaction_id || `TEMP-${Date.now()}`,
          from_phone: userProfileData.phone,
          from_name: userProfileData.name || userProfileData.phone,
          to_phone: phone,
          to_name: document.getElementById("recipient-name").textContent || phone,
          amount: amount,
          note: note,
          created_at: new Date().toISOString(),
        }
        showTransactionReceipt(mockTransaction)
      }
      document.getElementById("transfer-phone").value = ""
      document.getElementById("transfer-amount").value = ""
      document.getElementById("transfer-note").value = ""
      const recipientInfoDiv = document.getElementById("recipient-info")
      if (recipientInfoDiv) recipientInfoDiv.style.display = "none"
      // loadTransactions() // Transactions will be reloaded by realtime or loadUserData
    }, 1500)
  } catch (error) {
    console.error("Transfer processing error:", error)
    logToConsole("Transfer processing error: " + error.message, "error", error)
    if (processingOverlay) processingOverlay.classList.remove("active")
    if (errorElement) {
      errorElement.textContent = "ငွေလွှဲရာတွင် အမှားရှိနေပါသည်။ " + (error.message || "Unknown error")
      errorElement.style.display = "block"
    }
    if (successElement) successElement.style.display = "none"
  }
}

function maskPhoneNumber(phone) {
  if (!phone || phone.length <= 4) return phone
  return "••••" + phone.slice(-4)
}

function showTransactionReceipt(transaction) {
  if (!userProfileData || !transaction) {
    console.warn("Cannot show receipt: missing userProfileData or transaction data.")
    logToConsole("Cannot show receipt: missing userProfileData or transaction data.", "warn")
    return
  }
  currentReceiptTransaction = transaction
  logToConsole("Showing transaction receipt for ID: " + transaction.id, "info")
  const userPhone = userProfileData.phone
  const isSender = transaction.from_phone === userPhone

  const senderPhoneDisplay = isSender ? maskPhoneNumber(transaction.from_phone) : transaction.from_phone
  const recipientPhoneDisplay =
    !isSender && transaction.to_phone === userPhone ? maskPhoneNumber(transaction.to_phone) : transaction.to_phone

  const receiptHTML = `
        <div class="receipt" id="printable-receipt">
            <div class="receipt-logo-area">
                <img src="${LOGO_URL}" alt="OPPER Logo" crossOrigin="anonymous">
                <span>OPPER Pay</span>
            </div>
            <div class="receipt-status">
                <div class="receipt-status-icon ${isSender ? "sent" : "received"}">
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
                    <div class="receipt-detail-value">${transaction.from_name || "N/A"} (${senderPhoneDisplay})</div>
                </div>
                <div class="receipt-detail-row">
                    <div class="receipt-detail-label">To</div>
                    <div class="receipt-detail-value">${transaction.to_name || "N/A"} (${isSender ? transaction.to_phone : recipientPhoneDisplay})</div>
                </div>
                ${
                  transaction.note
                    ? `
                <div class="receipt-detail-row">
                    <div class="receipt-detail-label">Note</div>
                    <div class="receipt-detail-value">${transaction.note}</div>
                </div>`
                    : ""
                }
                <div class="receipt-detail-row">
                    <div class="receipt-detail-label">Date</div>
                    <div class="receipt-detail-value">${new Date(transaction.created_at).toLocaleString("my-MM", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}</div>
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
  const receiptContainer = document.getElementById("receipt-container")
  if (receiptContainer) receiptContainer.innerHTML = receiptHTML
  if (receiptModal) receiptModal.classList.add("active")
}

function downloadReceipt() {
  logToConsole("Attempting to download receipt...", "info")
  const receiptElement = document.getElementById("printable-receipt")
  if (!receiptElement) {
    console.warn("Printable receipt element not found.")
    logToConsole("Printable receipt element not found for download.", "warn")
    return
  }
  if (!currentReceiptTransaction || !currentReceiptTransaction.id) {
    console.warn("No current transaction data available for naming receipt.")
    logToConsole("No current transaction data for naming receipt.", "warn")
    alert("ပြေစာဒေတာ မတွေ့ရှိပါ၊ ဖိုင်အမည်ကို ယေဘုယျအမည်ဖြင့် သတ်မှတ်ပါမည်။")
  }

  const images = receiptElement.getElementsByTagName("img")
  const promises = []
  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    // Ensure crossOrigin is set for external images if not already
    if (img.src.startsWith("http") && !img.crossOrigin) {
      img.crossOrigin = "anonymous"
    }
    if (!img.complete || img.naturalWidth === 0) {
      promises.push(
        new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = () => {
            console.warn("Image failed to load for receipt:", img.src)
            logToConsole("Image failed to load for receipt: " + img.src, "warn")
            resolve()
          }
        }),
      )
    }
  }

  Promise.all(promises)
    .then(() => {
      html2canvas(receiptElement, {
        useCORS: true, // Important for external images
        allowTaint: true, // May help with some CORS issues but can taint canvas
        backgroundColor: getComputedStyle(document.body).getPropertyValue("--bg-secondary").trim() || "#ffffff",
        scale: 2,
        logging: true,
        onclone: (clonedDoc) => {
          const clonedReceipt = clonedDoc.getElementById("printable-receipt")
          if (clonedReceipt) {
            clonedReceipt.style.fontFamily = getComputedStyle(receiptElement).fontFamily
            clonedReceipt.style.color = getComputedStyle(receiptElement).color
          }
        },
      })
        .then((canvas) => {
          const link = document.createElement("a")
          link.download = `OPPER-Receipt-${currentReceiptTransaction?.id || Date.now()}.png`
          link.href = canvas.toDataURL("image/png")
          link.click()
          logToConsole("Receipt downloaded successfully.", "success")
        })
        .catch((err) => {
          console.error("Error generating receipt image with html2canvas:", err)
          logToConsole("Error generating receipt image with html2canvas: " + err.message, "error", err)
          alert("ပြေစာပုံထုတ်ရာတွင် အမှားဖြစ်ပေါ်နေပါသည်။ Console ကိုစစ်ဆေးပါ။")
        })
    })
    .catch((err) => {
      console.error("Error loading images for receipt:", err)
      logToConsole("Error loading images for receipt: " + err.message, "error", err)
      alert("ပြေစာအတွက် ပုံများတင်ရာတွင် အမှားဖြစ်ပေါ်နေပါသည်။")
    })
}

function generateUserId(email) {
  const username = email
    .split("@")[0]
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
  const randomNum = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0")
  return `${username}${randomNum}`.toUpperCase()
}

function showPage(pageName) {
  console.log("Showing page:", pageName)
  logToConsole("Showing page: " + pageName, "info")
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
  const profileDropdown = document.getElementById("profile-dropdown")
  if (profileDropdown) profileDropdown.classList.remove("active")
  const sidebar = document.getElementById("sidebar")
  if (window.innerWidth < 992 && sidebar) {
    // Only close sidebar on mobile
    sidebar.classList.remove("active")
  }
}

function logout() {
  logToConsole("Logging out...", "info")
  localStorage.removeItem("opperSession")
  currentUser = null
  userProfileData = null
  supabase.removeAllChannels()
  logToConsole("All Supabase channels removed on logout.", "info")
  showAuthContainer()

  const loginForm = document.getElementById("login-form")
  if (loginForm && typeof loginForm.reset === "function") {
    loginForm.reset()
  }
  const signupForm = document.getElementById("signup-form")
  if (signupForm && typeof signupForm.reset === "function") {
    signupForm.reset()
  }
  // Clear sensitive UI fields if any are still populated
  document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: 0 Ks`
  document.getElementById("balance-amount").textContent = `0 Ks`
  // etc.
}

function showLoader() {
  if (loader) loader.classList.add("active")
}
function hideLoader() {
  if (loader) loader.classList.remove("active")
}

function showAuthContainer() {
  console.log("Showing Auth Container")
  logToConsole("Showing Auth Container", "info")
  if (authContainer) authContainer.classList.remove("hidden")
  if (appContainer) appContainer.classList.add("hidden")
}
function showAppContainer() {
  console.log("Showing App Container")
  logToConsole("Showing App Container", "info")
  if (authContainer) authContainer.classList.add("hidden")
  if (appContainer) appContainer.classList.remove("hidden")
  showPage("dashboard") // Default to dashboard page when app container is shown
}

function logToConsole(message, type = "info", data = null) {
  const consoleOutput = document.getElementById("console-output")
  if (!consoleOutput) return

  const line = document.createElement("div")
  line.classList.add("console-line", `console-${type}`)
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  line.textContent = `[${timestamp}] [${type.toUpperCase()}] ${message}`
  if (data) {
    try {
      const dataString = JSON.stringify(data, null, 2)
      const dataPre = document.createElement("pre")
      dataPre.textContent = dataString
      line.appendChild(dataPre)
    } catch (e) {
      // If data can't be stringified, just log the message
    }
  }
  consoleOutput.appendChild(line)
  consoleOutput.scrollTop = consoleOutput.scrollHeight

  // Also log to browser console for better debugging
  switch (type) {
    case "error":
      console.error(`[OPPER] ${message}`, data || "")
      break
    case "warn":
      console.warn(`[OPPER] ${message}`, data || "")
      break
    default:
      console.log(`[OPPER] ${message}`, data || "")
      break
  }
}
