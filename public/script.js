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

      // Validate session with Supabase (optional but good practice)
      // This example assumes localStorage session is trusted if present.
      // For higher security, you'd re-verify with Supabase auth.
      // const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      // if (authError || !authUser || authUser.id !== sessionData.user_id) {
      //   console.warn("Session mismatch or Supabase auth error. Clearing local session.", authError);
      //   localStorage.removeItem("opperSession");
      //   return false;
      // }

      // Fetch user from our custom auth_users table
      const { data: user, error } = await supabase
        .from("auth_users")
        .select("*")
        .eq("email", sessionData.email)
        .eq("user_id", sessionData.user_id)
        .single()

      if (error || !user) {
        console.warn("User not found in auth_users or error:", error)
        localStorage.removeItem("opperSession")
        return false
      }

      currentUser = user
      console.log("Session valid. Current user set:", currentUser)
      return true
    } else {
      console.log("No session found in localStorage.")
      return false
    }
  } catch (error) {
    console.error("Session check error:", error)
    localStorage.removeItem("opperSession") // Clear potentially corrupted session
    return false
  }
}

// Load user data
async function loadUserData() {
  console.log("Loading user data for:", currentUser?.user_id)
  try {
    if (!currentUser || !currentUser.user_id) {
      console.warn("Cannot load user data: currentUser is not set.")
      return
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", currentUser.user_id)
      .single()

    if (userError) {
      console.error("Error fetching user profile data:", userError)
      // Potentially handle this by logging out the user or showing an error message
      // For now, we'll let the UI show default/empty states.
      throw userError // Re-throw to be caught by initializeApp
    }

    if (!userData) {
      console.warn("User profile data not found for user_id:", currentUser.user_id)
      // This could happen if a user exists in auth_users but not in users table.
      // Handle appropriately, e.g., prompt to create profile or logout.
      // For now, treat as an error state.
      throw new Error("User profile not found.")
    }

    userProfileData = userData
    userBalance = userData.balance || 0
    userKycStatus = userData.passport_status || "pending"
    console.log("User profile data loaded:", userProfileData)

    updateUserUI(userData) // Update UI elements that depend on userProfileData

    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("allow_transfers")
      .eq("id", 1)
      .single()

    if (settingsError) {
      console.warn("Error fetching settings:", settingsError)
    } else if (settings) {
      transfersEnabled = settings.allow_transfers
      console.log("Transfers enabled status:", transfersEnabled)
    }
    updateTransferStatus() // Update UI for transfer status

    setupRealtimeSubscriptions()
    await loadTransactions() // Ensure transactions are loaded after user data
  } catch (error) {
    console.error("Load user data failed:", error)
    // If loading user data fails, it's a significant issue.
    // Consider logging out the user or showing a persistent error.
    // For now, re-throw to be caught by initializeApp, which will show auth container.
    throw error
  }
}

// Update UI with user data
function updateUserUI(userData) {
  console.log("Updating UI with user data:", userData)
  if (!currentUser || !userData) {
    console.warn("Cannot update UI: currentUser or userData is missing.")
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
}

// Update KYC status in UI
function updateKycStatus() {
  if (!userProfileData) {
    console.warn("Cannot update KYC status: userProfileData is not set.")
    // Set to a default "pending" or "unknown" state if needed
    document.getElementById("kyc-status").textContent = "KYC: အခြေအနေမသိပါ"
    document.getElementById("kyc-status-message").textContent = "KYC အချက်အလက်များ ရယူ၍မရပါ"
    return
  }
  console.log("Updating KYC status. Current status:", userKycStatus)

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
    return
  }

  kycStatusIcon.classList.remove("pending", "approved", "rejected")
  kycDetailsApprovedDiv.style.display = "none"
  kycForm.style.display = "block"

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
    kycStatusElement.textContent = "KYC: စောင့်ဆိုင်းဆဲ"
    kycStatusMessage.textContent = "သင့် KYC စိစစ်နေဆဲဖြစ်ပါသည်။ (သို့မဟုတ်) တင်သွင်းရန်လိုအပ်သည်။"
    kycStatusIcon.classList.add("pending")
    kycStatusIcon.innerHTML = '<i class="fas fa-clock"></i>'
    if (userProfileData && userProfileData.passport_number && userProfileData.passport_image) {
      kycForm.style.display = "none"
    }
  }
}

// Display approved KYC data
async function displayApprovedKycData() {
  if (!userProfileData) {
    console.warn("Cannot display approved KYC data: userProfileData is null.")
    return
  }
  console.log("Displaying approved KYC data.")

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
  const transferStatusElement = document.getElementById("transfer-status")
  if (!transferStatusElement) {
    console.warn("Transfer status element not found.")
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
    return
  }
  console.log("Setting up realtime subscriptions for user:", currentUser.user_id)

  const userChannel = supabase
    .channel(`user-updates-${currentUser.user_id}`) // Unique channel name per user
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
        const oldProfileData = { ...userProfileData } // Store old data for comparison
        userProfileData = payload.new
        if (payload.new.balance !== oldProfileData.balance) {
          userBalance = payload.new.balance
          document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`
          document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`
        }
        if (payload.new.passport_status !== oldProfileData.passport_status) {
          userKycStatus = payload.new.passport_status
          updateKycStatus()
        }
        if (payload.new.avatar_url !== oldProfileData.avatar_url) {
          updateUserUI(payload.new) // This will update avatar
        }
      },
    )
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        console.log("Successfully subscribed to user updates channel!")
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("Realtime user updates channel error:", err)
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
        console.log("Realtime settings update received:", payload)
        if (payload.new.allow_transfers !== transfersEnabled) {
          transfersEnabled = payload.new.allow_transfers
          updateTransferStatus()
        }
      },
    )
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        console.log("Successfully subscribed to settings updates channel!")
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("Realtime settings updates channel error:", err)
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
      },
      (payload) => {
        console.log("Realtime transaction insert received:", payload)
        if (
          currentUser &&
          userProfileData &&
          (payload.new.from_phone === userProfileData.phone || payload.new.to_phone === userProfileData.phone)
        ) {
          loadTransactions()
          if (payload.new.to_phone === userProfileData.phone && payload.new.from_phone !== userProfileData.phone) {
            transferReceivedSound.play().catch((e) => console.warn("Received sound play failed:", e))
          }
        }
      },
    )
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        console.log("Successfully subscribed to transactions updates channel!")
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("Realtime transactions updates channel error:", err)
      }
    })
}

// Load transactions
async function loadTransactions() {
  try {
    if (!userProfileData || !userProfileData.phone) {
      console.warn("Cannot load transactions: user profile or phone not available.")
      updateTransactionsUI([], "") // Clear UI or show empty state
      return
    }
    const userPhone = userProfileData.phone
    console.log("Loading transactions for phone:", userPhone)

    const { data: transactionsData, error } = await supabase
      .from("transactions")
      .select("*")
      .or(`from_phone.eq.${userPhone},to_phone.eq.${userPhone}`)
      .order("created_at", { ascending: false })
      .limit(10) // Consider pagination for full history

    if (error) {
      console.error("Error loading transactions:", error)
      throw error
    }
    transactions = transactionsData || []
    console.log("Transactions loaded:", transactions.length)
    updateTransactionsUI(transactions, userPhone)
  } catch (error) {
    console.error("Load transactions failed:", error)
    // Display an error message in the transaction list UI
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
  const recentTransactionsList = document.getElementById("recent-transactions-list")
  const historyTransactionsList = document.getElementById("history-transactions-list")

  if (!recentTransactionsList || !historyTransactionsList) {
    console.warn("Transaction list UI elements not found.")
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
      // Show only recent 5 in dashboard
      recentTransactionsList.innerHTML += transactionItem
    }
    historyTransactionsList.innerHTML += transactionItem // Show all in history page
  })

  document.querySelectorAll(".transaction-view-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const transactionIndex = Number.parseInt(button.getAttribute("data-transaction-index"), 10)
      if (transactionsData[transactionIndex]) {
        showTransactionReceipt(transactionsData[transactionIndex])
      } else {
        console.warn("Transaction data not found for index:", transactionIndex)
      }
    })
  })
}

// Initialize UI elements and event listeners
function initializeUI() {
  console.log("Initializing UI elements and event listeners...")
  document.body.setAttribute("data-theme", currentTheme) // Apply theme

  // Play click sound for all elements with 'clickable' class
  document.querySelectorAll(".clickable").forEach((el) => {
    el.addEventListener("click", () => {
      if (clickSound && clickSound.readyState >= 2) {
        // Check if sound is loaded enough
        clickSound.currentTime = 0 // Rewind to start
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
  const pages = document.querySelectorAll(".page")
  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault()
      const pageName = link.getAttribute("data-page")
      showPage(pageName) // Use centralized showPage function
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
      if (!profileDropdown.contains(e.target) && !profileDropdownTrigger.contains(e.target)) {
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
      applyTheme(theme) // Use centralized theme function
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

  // Console toggle
  const consoleToggle = document.getElementById("console-toggle")
  const consoleHeader = document.querySelector(".console-header") // Target header for click
  const consoleContainer = document.getElementById("console-container")

  if (consoleToggle && consoleHeader && consoleContainer) {
    const toggleConsole = () => consoleContainer.classList.toggle("active")
    consoleToggle.addEventListener("click", toggleConsole)
    consoleHeader.addEventListener("click", (e) => {
      // Allow clicking header to toggle
      if (e.target === consoleHeader || e.target === consoleHeader.querySelector("span")) {
        toggleConsole()
      }
    })
  }
  logToConsole("UI Initialized.", "info")
}

function applyTheme(themeName) {
  console.log("Applying theme:", themeName)
  if (themeName === "system") {
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    document.body.setAttribute("data-theme", systemPrefersDark ? "dark" : "light")
    console.log("System preference:", systemPrefersDark ? "dark" : "light")
  } else {
    document.body.setAttribute("data-theme", themeName)
  }
  currentTheme = themeName // Update global variable
  localStorage.setItem("theme", themeName)
}

// Check recipient information
async function checkRecipientInfo() {
  const phone = document.getElementById("transfer-phone").value
  const recipientInfoDiv = document.getElementById("recipient-info")
  const recipientAvatarImg = document.getElementById("recipient-avatar")
  const recipientNameP = document.getElementById("recipient-name")
  const recipientIdP = document.getElementById("recipient-id")

  if (!recipientInfoDiv || !recipientAvatarImg || !recipientNameP || !recipientIdP) {
    console.warn("Recipient info UI elements not found.")
    return
  }

  if (!phone || phone.length < 7) {
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
      // PGRST116: "Fetched result not found" (expected if no user)
      console.error("Error fetching recipient:", error)
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
    recipientInfoDiv.style.display = "none"
  }
}

// Upload profile picture
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
    return
  }
  logToConsole("Uploading profile picture...", "info")

  const fileName = `avatar_${currentUser.user_id}_${Date.now()}.${file.name.split(".").pop()}`

  try {
    showLoader()

    if (userProfileData && userProfileData.avatar_url) {
      const oldFilePath = userProfileData.avatar_url.split("/avatars/")[1] // Get path after bucket name
      if (oldFilePath) {
        logToConsole(`Removing old avatar: ${oldFilePath}`, "info")
        const { error: removeError } = await supabase.storage.from("avatars").remove([oldFilePath])
        if (removeError) console.warn("Failed to remove old avatar:", removeError.message)
      }
    }

    const { data: uploadData, error: uploadError } = await supabase.storage.from("avatars").upload(fileName, file, {
      cacheControl: "3600",
      upsert: false, // Set to false to avoid overwriting if somehow name collides, though unlikely with timestamp
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

    if (userProfileData) userProfileData.avatar_url = avatarUrl // Update local cache
    updateUserUI(userProfileData) // Refresh UI

    successElement.textContent = "ပရိုဖိုင်ပုံ အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။"
    successElement.style.display = "block"
    fileInput.value = ""
    document.getElementById("profile-picture-preview").innerHTML = ""
  } catch (error) {
    console.error("Profile picture upload error:", error)
    errorElement.textContent = "ပရိုဖိုင်ပုံ တင်ရာတွင် အမှားဖြစ်ပေါ်နေပါသည်။ " + (error.message || error)
    errorElement.style.display = "block"
  } finally {
    hideLoader()
  }
}

// Confirm KYC Deletion
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

  const oldBtn = confirmActionBtn
  const newBtn = oldBtn.cloneNode(true)
  oldBtn.parentNode.replaceChild(newBtn, oldBtn)
  newBtn.addEventListener("click", handleDeleteKyc) // Add event listener to new button
}

// Handle KYC Deletion
async function handleDeleteKyc() {
  const pin = document.getElementById("confirmation-pin").value
  const confirmationError = document.getElementById("confirmation-error")
  const deleteKycError = document.getElementById("delete-kyc-error")
  const deleteKycSuccess = document.getElementById("delete-kyc-success")

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
      logToConsole("Removing KYC documents from storage:", "info", filesToDelete)
      const { error: deleteStorageError } = await supabase.storage
        .from("kyc-documents")
        .remove(filesToDelete.filter((f) => f)) // Filter out undefined paths
      if (deleteStorageError) console.warn("Error deleting KYC documents from storage:", deleteStorageError.message)
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({
        passport_number: null,
        address: null,
        passport_image: null,
        selfie_image: null,
        passport_status: "pending",
        submitted_at: null,
      })
      .eq("user_id", currentUser.user_id)

    if (updateError) throw updateError

    userKycStatus = "pending" // Update local state
    if (userProfileData) {
      userProfileData.passport_number = null
      userProfileData.address = null
      userProfileData.passport_image = null
      userProfileData.selfie_image = null
      userProfileData.passport_status = "pending"
    }

    updateKycStatus()
    confirmationModal.classList.remove("active")
    deleteKycSuccess.textContent = "KYC အချက်အလက်များ အောင်မြင်စွာ ဖျက်သိမ်းပြီးပါပြီ။"
    deleteKycSuccess.style.display = "block"
    logToConsole("KYC information deleted successfully.", "success")
  } catch (error) {
    console.error("KYC deletion error:", error)
    confirmationModal.classList.remove("active")
    deleteKycError.textContent = "KYC ဖျက်သိမ်းရာတွင် အမှားဖြစ်ပေါ်နေပါသည်။ " + (error.message || error)
    deleteKycError.style.display = "block"
  } finally {
    hideLoader()
  }
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
    processTransferWithPin(pin) // Renamed for clarity
  })
}

// Setup form submissions
function setupFormSubmissions() {
  console.log("Setting up form submissions...")
  const loginBtn = document.getElementById("login-btn")
  if (loginBtn)
    loginBtn.addEventListener("click", async () => {
      const email = document.getElementById("login-email").value
      const password = document.getElementById("login-password").value
      const errorElement = document.getElementById("login-error")
      const successElement = document.getElementById("login-success")

      errorElement.style.display = "none"
      successElement.style.display = "none"

      if (!email || !password) {
        errorElement.textContent = "အီးမေးလ်နှင့် စကားဝှက် ထည့်ပါ။"
        errorElement.style.display = "block"
        return
      }
      logToConsole(`Attempting login for: ${email}`, "info")
      showLoader()
      try {
        const { data: user, error } = await supabase.from("auth_users").select("*").eq("email", email).single()
        if (error && error.code !== "PGRST116") throw error // PGRST116 is "not found"
        if (!user) {
          errorElement.textContent = "အကောင့်မတွေ့ရှိပါ။"
          errorElement.style.display = "block"
          hideLoader()
          return
        }
        if (user.password !== password) {
          // Plain text password check (as per original logic)
          errorElement.textContent = "စကားဝှက်မှားယွင်းနေပါသည်။"
          errorElement.style.display = "block"
          hideLoader()
          return
        }
        currentUser = user
        localStorage.setItem("opperSession", JSON.stringify({ email: user.email, user_id: user.user_id }))
        successElement.textContent = "အကောင့်ဝင်ရောက်နေပါသည်..."
        successElement.style.display = "block"
        await loadUserData()
        showAppContainer()
        initializeUI() // Re-initialize UI parts that depend on auth state
        logToConsole("Login successful.", "success")
      } catch (error) {
        console.error("Login error:", error)
        errorElement.textContent = "အကောင့်ဝင်ရာတွင် အမှားရှိနေပါသည်။ " + (error.message || error)
        errorElement.style.display = "block"
      } finally {
        // Hide loader is handled by initializeApp's finally block if login is initial load
        // If login is after initial load, hide it here.
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

  const signupBtn = document.getElementById("signup-btn")
  if (signupBtn)
    signupBtn.addEventListener("click", async () => {
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
      logToConsole(`Attempting signup for: ${email}, Phone: ${phone}`, "info")
      showLoader()
      try {
        const { data: existingUserByEmail } = await supabase
          .from("auth_users")
          .select("email")
          .eq("email", email)
          .single()
        if (existingUserByEmail) {
          errorElement.textContent = "ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
          errorElement.style.display = "block"
          hideLoader()
          return
        }
        const { data: existingUserByPhone } = await supabase.from("users").select("phone").eq("phone", phone).single()
        if (existingUserByPhone) {
          errorElement.textContent = "ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
          errorElement.style.display = "block"
          hideLoader()
          return
        }

        const userId = generateUserId(email)
        const { error: authError } = await supabase.from("auth_users").insert([{ user_id: userId, email, password }]) // Plain text password
        if (authError) throw authError

        const defaultName = email.split("@")[0] // Use part of email as default name
        const { error: profileError } = await supabase
          .from("users")
          .insert([{ user_id: userId, phone, name: defaultName, balance: 0, passport_status: "pending" }])
        if (profileError) throw profileError

        successElement.textContent = "အကောင့်ဖွင့်ပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။"
        successElement.style.display = "block"
        document.getElementById("signup-form").reset() // Reset form
        logToConsole("Signup successful.", "success")
        setTimeout(() => document.querySelector('.auth-tab[data-tab="login"]')?.click(), 2000)
      } catch (error) {
        console.error("Signup error:", error)
        errorElement.textContent = "အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။ " + (error.message || error)
        errorElement.style.display = "block"
      } finally {
        hideLoader()
      }
    })

  const googleSignupBtn = document.getElementById("google-signup-btn")
  if (googleSignupBtn)
    googleSignupBtn.addEventListener("click", () => {
      alert("Google Signup is not implemented in this version.")
      logToConsole("Google Signup button clicked (not implemented).", "warn")
    })

  const transferBtn = document.getElementById("transfer-btn")
  if (transferBtn)
    transferBtn.addEventListener("click", async () => {
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
        return
      }
      if (amount < 1000) {
        errorElement.textContent = "ငွေပမာဏ အနည်းဆုံး 1,000 Ks ဖြစ်ရပါမည်။"
        errorElement.style.display = "block"
        return
      }
      if (!transfersEnabled) {
        errorElement.textContent = "ငွေလွှဲခြင်းကို ယာယီပိတ်ထားပါသည်။ နောက်မှ ပြန်လည်ကြိုးစားပါ။"
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
      if (userProfileData && userProfileData.phone === phone) {
        errorElement.textContent = "ကိုယ့်ကိုယ်ကို ငွေလွှဲ၍မရပါ။"
        errorElement.style.display = "block"
        return
      }

      const { data: recipient, error: recipientError } = await supabase
        .from("users")
        .select("user_id, phone") // Only select necessary fields
        .eq("phone", phone)
        .single()

      if (recipientError && recipientError.code !== "PGRST116") {
        console.error("Error fetching recipient for transfer:", recipientError)
        errorElement.textContent = "လက်ခံမည့်သူ အချက်အလက် ရယူရာတွင် အမှားရှိနေပါသည်။"
        errorElement.style.display = "block"
        return
      }
      if (!recipient) {
        errorElement.textContent = "လက်ခံမည့်သူ မတွေ့ရှိပါ။"
        errorElement.style.display = "block"
        return
      }
      showPinEntryModal()
    })

  const kycSubmitBtn = document.getElementById("kyc-submit-btn")
  if (kycSubmitBtn)
    kycSubmitBtn.addEventListener("click", async () => {
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
            payment_pin: pin, // Store/Update payment PIN
            passport_image: passportUrlData.publicUrl,
            selfie_image: selfieUrlData.publicUrl,
            passport_status: "pending",
            submitted_at: new Date().toISOString(),
          })
          .eq("user_id", currentUser.user_id)
        if (updateError) throw updateError

        userKycStatus = "pending" // Update local state
        if (userProfileData) {
          userProfileData.passport_number = passportNumber
          userProfileData.address = address
          userProfileData.payment_pin = pin
          userProfileData.passport_image = passportUrlData.publicUrl
          userProfileData.selfie_image = selfieUrlData.publicUrl
          userProfileData.passport_status = "pending"
        }
        updateKycStatus() // Refresh UI

        successElement.textContent = "KYC အချက်အလက်များ အောင်မြင်စွာ တင်သွင်းပြီးပါပြီ။ စိစစ်နေပါပြီ။"
        successElement.style.display = "block"
        document.getElementById("kyc-form").reset()
        document.getElementById("passport-preview").innerHTML = ""
        document.getElementById("selfie-preview").innerHTML = ""
        logToConsole("KYC submitted successfully.", "success")
      } catch (error) {
        console.error("KYC submission error:", error)
        errorElement.textContent = "KYC တင်သွင်းရာတွင် အမှားရှိနေပါသည်။ " + (error.message || error)
        errorElement.style.display = "block"
      } finally {
        hideLoader()
      }
    })

  const savePasswordBtn = document.getElementById("save-password-btn")
  if (savePasswordBtn)
    savePasswordBtn.addEventListener("click", async () => {
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
        return
      }
      if (newPassword !== confirmNewPassword) {
        errorElement.textContent = "စကားဝှက်အသစ်နှင့် အတည်ပြုစကားဝှက် မတူညီပါ။"
        errorElement.style.display = "block"
        return
      }
      logToConsole("Changing password...", "info")
      showLoader()
      try {
        // In a real app, you'd use supabase.auth.updateUser({ password: newPassword })
        // and verify currentPassword on the server or via a dedicated function.
        // This example continues with the direct table update as per original logic.
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
          return
        }
        const { error: updateError } = await supabase
          .from("auth_users")
          .update({ password: newPassword })
          .eq("user_id", currentUser.user_id)
        if (updateError) throw updateError

        successElement.textContent = "စကားဝှက် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။"
        successElement.style.display = "block"
        document.getElementById("change-password-modal").querySelector("form")?.reset()
        logToConsole("Password changed successfully.", "success")
        setTimeout(() => document.getElementById("change-password-modal")?.classList.remove("active"), 2000)
      } catch (error) {
        console.error("Change password error:", error)
        errorElement.textContent = "စကားဝှက်ပြောင်းရာတွင် အမှားရှိနေပါသည်။ " + (error.message || error)
        errorElement.style.display = "block"
      } finally {
        hideLoader()
      }
    })

  // Add event listener for change PIN button
  const savePinBtn = document.getElementById("save-pin-btn")
  if (savePinBtn)
    savePinBtn.addEventListener("click", async () => {
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
        return
      }
      if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
        errorElement.textContent = "PIN နံပါတ်အသစ်သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။"
        errorElement.style.display = "block"
        return
      }
      if (newPin !== confirmNewPin) {
        errorElement.textContent = "PIN နံပါတ်အသစ်နှင့် အတည်ပြု PIN နံပါတ် မတူညီပါ။"
        errorElement.style.display = "block"
        return
      }
      if (!userProfileData || userProfileData.payment_pin !== currentPin) {
        errorElement.textContent = "လက်ရှိ PIN နံပါတ် မှားယွင်းနေပါသည်။"
        errorElement.style.display = "block"
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

        if (userProfileData) userProfileData.payment_pin = newPin // Update local cache

        successElement.textContent = "PIN နံပါတ် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။"
        successElement.style.display = "block"
        document.getElementById("change-pin-modal").querySelector("form")?.reset() // Assuming form tag wraps inputs
        logToConsole("Payment PIN changed successfully.", "success")
        setTimeout(() => document.getElementById("change-pin-modal")?.classList.remove("active"), 2000)
      } catch (error) {
        console.error("Change PIN error:", error)
        errorElement.textContent = "PIN နံပါတ်ပြောင်းရာတွင် အမှားအယွင်း ဖြစ်ပေါ်နေပါသည်။ " + (error.message || error)
        errorElement.style.display = "block"
      } finally {
        hideLoader()
      }
    })

  // Add event listener for delete account button
  const confirmDeleteAccountBtn = document.getElementById("confirm-delete-btn")
  if (confirmDeleteAccountBtn)
    confirmDeleteAccountBtn.addEventListener("click", async () => {
      const password = document.getElementById("delete-password").value
      const confirmCheckbox = document.getElementById("confirm-delete").checked
      const errorElement = document.getElementById("delete-account-error")
      errorElement.style.display = "none"

      if (!password) {
        errorElement.textContent = "စကားဝှက်ထည့်သွင်းပါ။"
        errorElement.style.display = "block"
        return
      }
      if (!confirmCheckbox) {
        errorElement.textContent = "အကောင့်ဖျက်သိမ်းရန် အတည်ပြုပေးပါ။"
        errorElement.style.display = "block"
        return
      }

      // Verify password (using auth_users table as per current logic)
      if (!currentUser || currentUser.password !== password) {
        errorElement.textContent = "စကားဝှက် မှားယွင်းနေပါသည်။"
        errorElement.style.display = "block"
        return
      }

      logToConsole("Deleting account...", "warn")
      showLoader()
      try {
        // This is a simplified deletion. A real app would handle this more carefully,
        // possibly with server-side logic, archiving, or soft deletes.
        // Deleting from 'users' will cascade to 'auth_users' due to FOREIGN KEY ON DELETE CASCADE.
        // However, Supabase Auth users (if using supabase.auth.admin.deleteUser) are separate.
        // Here, we are deleting from our custom tables.

        // 1. Delete from 'users' table (will cascade to auth_users if FK is set up correctly)
        const { error: deleteUserError } = await supabase.from("users").delete().eq("user_id", currentUser.user_id)
        if (deleteUserError) throw deleteUserError

        // 2. If FK ON DELETE CASCADE is not on auth_users, delete manually
        // const { error: deleteAuthUserError } = await supabase
        //     .from("auth_users")
        //     .delete()
        //     .eq("user_id", currentUser.user_id);
        // if (deleteAuthUserError) throw deleteAuthUserError;

        // 3. Delete associated storage files (avatars, kyc-documents)
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
        logout() // Clear session and show auth screen
        alert("သင့်အကောင့်ကို အောင်မြင်စွာ ဖျက်သိမ်းပြီးပါပြီ။")
        document.getElementById("delete-account-modal")?.classList.remove("active")
      } catch (error) {
        console.error("Delete account error:", error)
        errorElement.textContent = "အကောင့်ဖျက်သိမ်းရာတွင် အမှားအယွင်း ဖြစ်ပေါ်နေပါသည်။ " + (error.message || error)
        errorElement.style.display = "block"
      } finally {
        hideLoader()
      }
    })
}

// Show PIN entry modal
function showPinEntryModal() {
  document.querySelectorAll(".pin-input").forEach((input) => (input.value = ""))
  const pinErrorElement = document.getElementById("pin-error")
  if (pinErrorElement) pinErrorElement.style.display = "none"
  if (pinEntryModal) {
    pinEntryModal.classList.add("active")
    const firstPinInput = pinEntryModal.querySelector(".pin-input")
    if (firstPinInput) firstPinInput.focus()
  }
}

// Process transfer with PIN
async function processTransferWithPin(pin) {
  // Renamed from processTransfer
  const phone = document.getElementById("transfer-phone").value
  const amount = Number.parseInt(document.getElementById("transfer-amount").value)
  const note = document.getElementById("transfer-note").value
  const errorElement = document.getElementById("transfer-error")
  const successElement = document.getElementById("transfer-success")

  if (pinEntryModal) pinEntryModal.classList.remove("active")
  if (processingOverlay) processingOverlay.classList.add("active")
  logToConsole(`Processing transfer to ${phone} for amount ${amount} with PIN.`, "info")

  try {
    // Use the Supabase Edge Function for transfer
    const { data: transferResult, error: functionError } = await supabase.functions.invoke("process-transfer", {
      body: {
        // from_user_id is implicit from the authenticated user calling the function
        to_phone: phone,
        amount: amount,
        note: note,
        payment_pin: pin, // Send PIN to the function for verification
      },
    })

    if (functionError) {
      console.error("Supabase function invocation error:", functionError)
      throw new Error(functionError.message || "Function invocation failed")
    }

    if (!transferResult || !transferResult.success) {
      console.warn("Transfer function returned failure:", transferResult)
      throw new Error(transferResult.message || "ငွေလွှဲခြင်း မအောင်မြင်ပါ (function error)")
    }

    // If function handles balance updates and transaction logging, client-side updates might only be for UI refresh
    logToConsole("Transfer successful via function:", "success", transferResult)
    userBalance -= amount // Optimistically update, or rely on realtime update
    document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`
    document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`

    if (transferSentSound) transferSentSound.play().catch((e) => console.warn("Sent sound play failed:", e))

    setTimeout(() => {
      if (processingOverlay) processingOverlay.classList.remove("active")
      if (errorElement) errorElement.style.display = "none"
      if (successElement) {
        successElement.textContent = `${amount.toLocaleString()} Ks ကို ${phone} သို့ အောင်မြင်စွာ လွှဲပြောင်းပြီးပါပြီ။`
        successElement.style.display = "block"
      }
      if (transferResult.transaction) {
        // If function returns transaction details
        showTransactionReceipt(transferResult.transaction)
      } else {
        // Fallback if function doesn't return full transaction, create a mock one for receipt
        const mockTransaction = {
          id: transferResult.transaction_id || `TEMP-${Date.now()}`,
          from_phone: userProfileData.phone,
          from_name: userProfileData.name || userProfileData.phone,
          to_phone: phone,
          to_name: document.getElementById("recipient-name").textContent || phone, // Get from UI if available
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
      loadTransactions() // Refresh transaction list
    }, 1500) // Reduced delay as function should be faster
  } catch (error) {
    console.error("Transfer processing error:", error)
    if (processingOverlay) processingOverlay.classList.remove("active")
    if (errorElement) {
      errorElement.textContent = "ငွေလွှဲရာတွင် အမှားရှိနေပါသည်။ " + (error.message || error)
      errorElement.style.display = "block"
    }
    if (successElement) successElement.style.display = "none"
  }
}

// Mask phone number
function maskPhoneNumber(phone) {
  if (!phone || phone.length <= 4) return phone
  return "••••" + phone.slice(-4) // Show last 4, mask more
}

// Show transaction receipt
function showTransactionReceipt(transaction) {
  if (!userProfileData || !transaction) {
    console.warn("Cannot show receipt: missing userProfileData or transaction data.")
    return
  }
  logToConsole("Showing transaction receipt for ID: " + transaction.id, "info")
  const userPhone = userProfileData.phone
  const isSender = transaction.from_phone === userPhone

  const senderPhoneDisplay = isSender ? maskPhoneNumber(transaction.from_phone) : transaction.from_phone
  const recipientPhoneDisplay =
    !isSender && transaction.to_phone === userPhone ? maskPhoneNumber(transaction.to_phone) : transaction.to_phone

  const receiptHTML = `
        <div class="receipt" id="printable-receipt">
            <div class="receipt-logo-area">
                <img src="${LOGO_URL}" alt="OPPER Logo">
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

// Download receipt as PNG
function downloadReceipt() {
  logToConsole("Attempting to download receipt...", "info")
  const receiptElement = document.getElementById("printable-receipt")
  if (!receiptElement) {
    console.warn("Printable receipt element not found.")
    return
  }

  const images = receiptElement.getElementsByTagName("img")
  const promises = []
  for (let i = 0; i < images.length; i++) {
    if (!images[i].complete || images[i].naturalWidth === 0) {
      // Check if image is loaded
      promises.push(
        new Promise((resolve, reject) => {
          images[i].onload = resolve
          images[i].onerror = () => {
            console.warn("Image failed to load for receipt:", images[i].src)
            resolve() // Resolve anyway to not block download, placeholder might be used
          }
        }),
      )
    }
  }

  Promise.all(promises)
    .then(() => {
      html2canvas(receiptElement, {
        useCORS: true,
        backgroundColor: getComputedStyle(document.body).getPropertyValue("--bg-secondary").trim() || "#ffffff", // Use theme background
        scale: 2, // Increase scale for better quality
        logging: true, // Enable html2canvas logging
        onclone: (clonedDoc) => {
          // Ensure styles are applied in cloned document
          const clonedReceipt = clonedDoc.getElementById("printable-receipt")
          if (clonedReceipt) {
            // Re-apply some critical styles if needed, or ensure they are inherited
            clonedReceipt.style.fontFamily = getComputedStyle(receiptElement).fontFamily
            clonedReceipt.style.color = getComputedStyle(receiptElement).color
          }
        },
      })
        .then((canvas) => {
          const link = document.createElement("a")
          link.download = `OPPER-Receipt-${transaction.id || Date.now()}.png`
          link.href = canvas.toDataURL("image/png")
          link.click()
          logToConsole("Receipt downloaded successfully.", "success")
        })
        .catch((err) => {
          console.error("Error generating receipt image with html2canvas:", err)
          alert("ပြေစာပုံထုတ်ရာတွင် အမှားဖြစ်ပေါ်နေပါသည်။ Console ကိုစစ်ဆေးပါ။")
        })
    })
    .catch((err) => {
      console.error("Error loading images for receipt:", err)
      alert("ပြေစာအတွက် ပုံများတင်ရာတွင် အမှားဖြစ်ပေါ်နေပါသည်။")
    })
}

// Generate user ID (simple version)
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

// Show specific page
function showPage(pageName) {
  console.log("Showing page:", pageName)
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
    sidebar.classList.remove("active")
  }
}

// Logout function
function logout() {
  logToConsole("Logging out...", "info")
  localStorage.removeItem("opperSession")
  currentUser = null
  userProfileData = null
  // Clear any active Supabase subscriptions if necessary
  supabase.removeAllChannels()
  showAuthContainer()
  // Optionally reset parts of the UI to default state
  document.getElementById("login-form")?.reset()
  document.getElementById("signup-form")?.reset()
}

// Loader visibility functions
function showLoader() {
  if (loader) loader.classList.add("active")
}
function hideLoader() {
  if (loader) loader.classList.remove("active")
}

// Container visibility functions
function showAuthContainer() {
  console.log("Showing Auth Container")
  if (authContainer) authContainer.classList.remove("hidden")
  if (appContainer) appContainer.classList.add("hidden")
}
function showAppContainer() {
  console.log("Showing App Container")
  if (authContainer) authContainer.classList.add("hidden")
  if (appContainer) appContainer.classList.remove("hidden")
}

// Custom console logging function
function logToConsole(message, type = "info", data = null) {
  const consoleOutput = document.getElementById("console-output")
  if (!consoleOutput) return

  const line = document.createElement("div")
  line.classList.add("console-line", `console-${type}`)
  const timestamp = new Date().toLocaleTimeString()
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
  consoleOutput.scrollTop = consoleOutput.scrollHeight // Auto-scroll

  // Also log to browser console
  switch (type) {
    case "error":
      console.error(message, data || "")
      break
    case "warn":
      console.warn(message, data || "")
      break
    default:
      console.log(message, data || "")
      break
  }
}
