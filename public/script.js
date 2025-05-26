// Initialize Supabase Client
const supabaseUrl = "https://vtsczzlnhsrgnbkfyizi.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68"
const supabase = supabase.createClient(supabaseUrl, supabaseKey)

// Global Variables
let currentUser = null
let userBalance = 0
let userKycStatus = "pending" // pending, approved, rejected
let userTransferStatus = true
let isBalanceHidden = false
let currentTheme = localStorage.getItem("theme") || "dark"
let soundsEnabled = localStorage.getItem("sounds") !== "false"
let notificationsEnabled = localStorage.getItem("notifications") !== "false"
let currentAnnouncementId = null
let realtimeSubscription = null
const consoleLines = []
let transactions = []
let announcements = []
let media = []

// Audio Elements
const successSound = document.getElementById("success-sound")
const errorSound = document.getElementById("error-sound")
const notificationSound = document.getElementById("notification-sound")
const moneyReceivedSound = document.getElementById("money-received-sound")

// DOM Elements
const loader = document.getElementById("loader")
const authContainer = document.getElementById("auth-container")
const appContainer = document.getElementById("app-container")
const loginForm = document.getElementById("login-form")
const signupForm = document.getElementById("signup-form")
const authTabs = document.querySelectorAll(".auth-tab")
const authForms = document.querySelectorAll(".auth-form")
const sidebar = document.getElementById("sidebar")
const menuToggle = document.getElementById("menu-toggle")
const closeSidebar = document.getElementById("close-sidebar")
const profileDropdown = document.getElementById("profile-dropdown")
const profileDropdownTrigger = document.getElementById("profile-dropdown-trigger")
const notificationsPanel = document.getElementById("notifications-panel")
const notificationBell = document.getElementById("notification-bell")
const closeNotifications = document.getElementById("close-notifications")
const pages = document.querySelectorAll(".page")
const navLinks = document.querySelectorAll(".sidebar-nav a")
const logoutBtn = document.getElementById("logout-btn")
const dropdownLogout = document.getElementById("dropdown-logout")
const viewProfile = document.getElementById("view-profile")
const goToSettings = document.getElementById("go-to-settings")
const changePasswordBtn = document.getElementById("change-password-btn")
const changePinBtn = document.getElementById("change-pin-btn")
const deleteAccountBtn = document.getElementById("delete-account-btn")
const transferBtn = document.getElementById("transfer-btn")
const kycSubmitBtn = document.getElementById("kyc-submit-btn")
const modals = document.querySelectorAll(".modal")
const modalCloseButtons = document.querySelectorAll(".modal-close, .modal-cancel")
const changePasswordModal = document.getElementById("change-password-modal")
const changePinModal = document.getElementById("change-pin-modal")
const deleteAccountModal = document.getElementById("delete-account-modal")
const confirmationModal = document.getElementById("confirmation-modal")
const pinEntryModal = document.getElementById("pin-entry-modal")
const receiptModal = document.getElementById("receipt-modal")
const mediaViewerModal = document.getElementById("media-viewer-modal")
const announcementDetailModal = document.getElementById("announcement-detail-modal")
const commentsModal = document.getElementById("comments-modal")
const processingOverlay = document.getElementById("processing-overlay")
const pinInputs = document.querySelectorAll(".pin-input")
const togglePasswordButtons = document.querySelectorAll(".toggle-password")
const balanceAmount = document.getElementById("balance-amount")
const hideBalanceBtn = document.getElementById("hide-balance")
const refreshBalanceBtn = document.getElementById("refresh-balance")
const kycStatusElement = document.getElementById("kyc-status")
const transferStatusElement = document.getElementById("transfer-status")
const recentTransactionsList = document.getElementById("recent-transactions-list")
const historyTransactionsList = document.getElementById("history-transactions-list")
const historyTypeFilter = document.getElementById("history-type")
const historyDateFilter = document.getElementById("history-date")
const transferPhoneInput = document.getElementById("transfer-phone")
const transferAmountInput = document.getElementById("transfer-amount")
const transferNoteInput = document.getElementById("transfer-note")
const recipientInfoDiv = document.getElementById("recipient-info")
const transferErrorMsg = document.getElementById("transfer-error")
const transferSuccessMsg = document.getElementById("transfer-success")
const announcementsContainer = document.getElementById("announcements-container")
const dashboardAnnouncement = document.getElementById("dashboard-announcement")
const mediaGrid = document.getElementById("media-grid")
const mediaTypeFilter = document.getElementById("media-type")
const kycForm = document.getElementById("kyc-form")
const kycStatusCard = document.getElementById("kyc-status-card")
const kycStatusMessage = document.getElementById("kyc-status-message")
const passportUpload = document.getElementById("passport-upload")
const selfieUpload = document.getElementById("selfie-upload")
const passportPreview = document.getElementById("passport-preview")
const selfiePreview = document.getElementById("selfie-preview")
const kycErrorMsg = document.getElementById("kyc-error")
const kycSuccessMsg = document.getElementById("kyc-success")
const settingsPhone = document.getElementById("settings-phone")
const settingsEmail = document.getElementById("settings-email")
const themeOptions = document.querySelectorAll(".theme-option")
const enableSoundsCheckbox = document.getElementById("enable-sounds")
const enableNotificationsCheckbox = document.getElementById("enable-notifications")
const notificationsList = document.getElementById("notifications-list")
const notificationCount = document.getElementById("notification-count")
const downloadReceiptBtn = document.getElementById("download-receipt")
const receiptContainer = document.getElementById("receipt-container")
const likeBtn = document.getElementById("like-btn")
const commentBtn = document.getElementById("comment-btn")
const likeCount = document.getElementById("like-count")
const commentCount = document.getElementById("comment-count")
const commentsList = document.getElementById("comments-list")
const commentInput = document.getElementById("comment-input")
const submitCommentBtn = document.getElementById("submit-comment-btn")
const userNameElements = document.querySelectorAll("#user-name, #user-name-sidebar, #greeting-name")
const userIdElements = document.querySelectorAll("#user-id, #user-id-sidebar")
const userInitialElements = document.querySelectorAll("#user-initial, #user-initial-sidebar")
const userBalanceElement = document.getElementById("user-balance")

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  // Show loader
  showLoader()

  // Apply saved theme
  applyTheme(currentTheme)

  // Check if user is logged in
  checkSession()

  // Initialize event listeners
  initEventListeners()
})

// Initialize Event Listeners
function initEventListeners() {
  // Auth Tabs
  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabType = tab.getAttribute("data-tab")
      switchAuthTab(tabType)
    })
  })

  // Login Form
  document.getElementById("login-btn").addEventListener("click", handleLogin)
  document.getElementById("google-login-btn").addEventListener("click", handleGoogleLogin)

  // Signup Form
  document.getElementById("signup-btn").addEventListener("click", handleSignup)
  document.getElementById("google-signup-btn").addEventListener("click", handleGoogleSignup)

  // Toggle Password Visibility
  togglePasswordButtons.forEach((button) => {
    button.addEventListener("click", togglePasswordVisibility)
  })

  // Sidebar Toggle
  menuToggle.addEventListener("click", toggleSidebar)
  closeSidebar.addEventListener("click", toggleSidebar)

  // Profile Dropdown
  profileDropdownTrigger.addEventListener("click", toggleProfileDropdown)
  document.addEventListener("click", closeDropdownOnOutsideClick)

  // Notifications Panel
  notificationBell.addEventListener("click", toggleNotificationsPanel)
  closeNotifications.addEventListener("click", toggleNotificationsPanel)

  // Navigation
  navLinks.forEach((link) => {
    link.addEventListener("click", handleNavigation)
  })

  // Quick Action Cards
  document.querySelectorAll(".action-card").forEach((card) => {
    card.addEventListener("click", handleQuickAction)
  })

  // View All Links
  document.querySelectorAll(".view-all").forEach((link) => {
    link.addEventListener("click", handleNavigation)
  })

  // Logout
  logoutBtn.addEventListener("click", handleLogout)
  dropdownLogout.addEventListener("click", handleLogout)

  // Profile Actions
  viewProfile.addEventListener("click", () => {
    toggleProfileDropdown()
    navigateTo("settings")
  })

  goToSettings.addEventListener("click", () => {
    toggleProfileDropdown()
    navigateTo("settings")
  })

  // Settings Actions
  changePasswordBtn.addEventListener("click", () => openModal(changePasswordModal))
  changePinBtn.addEventListener("click", () => openModal(changePinModal))
  deleteAccountBtn.addEventListener("click", () => openModal(deleteAccountModal))

  // Modal Close Buttons
  modalCloseButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const modal = button.closest(".modal")
      closeModal(modal)
    })
  })

  // Close modals when clicking outside
  modals.forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal(modal)
      }
    })
  })

  // Save Password Button
  document.getElementById("save-password-btn").addEventListener("click", handleChangePassword)

  // Save PIN Button
  document.getElementById("save-pin-btn").addEventListener("click", handleChangePin)

  // Confirm Delete Account Button
  document.getElementById("confirm-delete-btn").addEventListener("click", handleDeleteAccount)

  // PIN Input Handling
  pinInputs.forEach((input) => {
    input.addEventListener("keyup", handlePinInput)
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value) {
        const index = Number.parseInt(input.getAttribute("data-index"))
        if (index > 0) {
          pinInputs[index - 1].focus()
        }
      }
    })
  })

  // Confirm PIN Button
  document.getElementById("confirm-pin-btn").addEventListener("click", confirmPin)

  // Balance Actions
  hideBalanceBtn.addEventListener("click", toggleBalanceVisibility)
  refreshBalanceBtn.addEventListener("click", refreshBalance)

  // Transfer Button
  transferBtn.addEventListener("click", handleTransfer)

  // Transfer Phone Input
  transferPhoneInput.addEventListener("blur", checkRecipient)

  // History Filters
  historyTypeFilter.addEventListener("change", filterTransactions)
  historyDateFilter.addEventListener("change", filterTransactions)

  // Media Filters
  mediaTypeFilter.addEventListener("change", filterMedia)

  // KYC Submit Button
  kycSubmitBtn.addEventListener("click", handleKycSubmission)

  // File Uploads
  passportUpload.addEventListener("change", handleFileUpload)
  selfieUpload.addEventListener("change", handleFileUpload)

  // Theme Options
  themeOptions.forEach((option) => {
    option.addEventListener("click", () => {
      const theme = option.getAttribute("data-theme")
      setTheme(theme)
    })
  })

  // Sound and Notification Settings
  enableSoundsCheckbox.addEventListener("change", toggleSounds)
  enableNotificationsCheckbox.addEventListener("change", toggleNotifications)

  // Download Receipt
  downloadReceiptBtn.addEventListener("click", downloadReceipt)

  // Announcement Reactions
  likeBtn.addEventListener("click", handleLike)
  commentBtn.addEventListener("click", () => openModal(commentsModal))

  // Submit Comment
  submitCommentBtn.addEventListener("click", submitComment)
}

// Show Loader
function showLoader() {
  loader.classList.add("active")

  // Add console-like loading animation
  setTimeout(() => {
    addConsoleLog("system", "Initializing OPPER Payment System...")
  }, 300)

  setTimeout(() => {
    addConsoleLog("system", "Loading resources...")
  }, 800)

  setTimeout(() => {
    addConsoleLog("system", "Connecting to secure server...")
  }, 1500)

  setTimeout(() => {
    addConsoleLog("success", "Connection established!")
  }, 2200)

  setTimeout(() => {
    addConsoleLog("system", "Checking authentication status...")
  }, 2800)
}

// Hide Loader
function hideLoader() {
  setTimeout(() => {
    loader.classList.remove("active")
  }, 3500)
}

// Add Console Log
function addConsoleLog(type, message) {
  consoleLines.push({ type, message })

  // Create console display if it doesn't exist
  if (!document.querySelector(".console-display")) {
    const consoleDisplay = document.createElement("div")
    consoleDisplay.className = "console-display"
    loader.querySelector(".loader").insertAdjacentElement("afterend", consoleDisplay)
  }

  const consoleDisplay = document.querySelector(".console-display")
  const consoleLine = document.createElement("div")
  consoleLine.className = `console-line ${type}`

  // Create typing effect
  const messageSpan = document.createElement("span")
  messageSpan.className = "typing-effect"
  messageSpan.textContent = message

  consoleLine.appendChild(messageSpan)
  consoleDisplay.appendChild(consoleLine)
  consoleDisplay.scrollTop = consoleDisplay.scrollHeight
}

// Check Session
async function checkSession() {
  try {
    addConsoleLog("system", "Checking user session...")

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error) throw error

    if (session) {
      addConsoleLog("success", "User session found!")
      currentUser = session.user
      await fetchUserData()
      showApp()
    } else {
      addConsoleLog("system", "No active session found.")
      showAuth()
    }
  } catch (error) {
    addConsoleLog("error", "Session check failed: " + error.message)
    showAuth()
  }
}

// Fetch User Data
async function fetchUserData() {
  try {
    addConsoleLog("system", "Fetching user data...")

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", currentUser.id)
      .single()

    if (profileError) throw profileError

    if (profile) {
      // Update user data
      userBalance = profile.balance || 0
      userKycStatus = profile.kyc_status || "pending"
      userTransferStatus = profile.transfer_enabled !== false

      // Update UI with user data
      updateUserInfo(profile)

      // Fetch notifications
      await fetchNotifications()

      // Fetch transactions
      await fetchTransactions()

      // Fetch announcements
      await fetchAnnouncements()

      // Fetch media
      await fetchMedia()

      // Subscribe to realtime updates
      subscribeToRealtimeUpdates()

      addConsoleLog("success", "User data loaded successfully!")
    } else {
      // Create profile if it doesn't exist
      await createUserProfile()
    }
  } catch (error) {
    addConsoleLog("error", "Failed to fetch user data: " + error.message)
    showErrorNotification("ပရိုဖိုင်အချက်အလက်များ ရယူရာတွင် အမှားရှိနေပါသည်။")
  }
}

// Create User Profile
async function createUserProfile() {
  try {
    addConsoleLog("system", "Creating new user profile...")

    const { error } = await supabase.from("profiles").insert({
      user_id: currentUser.id,
      email: currentUser.email,
      phone: "",
      balance: 10000, // Starting balance for new users
      kyc_status: "pending",
      transfer_enabled: true,
      created_at: new Date(),
    })

    if (error) throw error

    addConsoleLog("success", "User profile created successfully!")
    await fetchUserData()
  } catch (error) {
    addConsoleLog("error", "Failed to create user profile: " + error.message)
    showErrorNotification("ပရိုဖိုင်ဖန်တီးရာတွင် အမှားရှိနေပါသည်။")
  }
}

// Update User Info in UI
function updateUserInfo(profile) {
  // Set user name
  const displayName = profile.full_name || profile.email || "အကောင့်"
  userNameElements.forEach((el) => {
    el.textContent = displayName
  })

  // Set user ID
  const userId = profile.user_id.substring(0, 8)
  userIdElements.forEach((el) => {
    el.textContent = `ID: ${userId}`
  })

  // Set user initial
  const initial = (profile.full_name || profile.email || "A").charAt(0).toUpperCase()
  userInitialElements.forEach((el) => {
    el.textContent = initial
  })

  // Set balance
  updateBalance(profile.balance || 0)

  // Set KYC status
  updateKycStatus(profile.kyc_status || "pending")

  // Set transfer status
  updateTransferStatus(profile.transfer_enabled !== false)

  // Set settings form values
  settingsPhone.value = profile.phone || ""
  settingsEmail.value = profile.email || ""
}

// Update Balance
function updateBalance(balance) {
  userBalance = balance
  const formattedBalance = isBalanceHidden ? "••••••" : formatCurrency(balance)
  balanceAmount.textContent = formattedBalance
  userBalanceElement.textContent = `လက်ကျန်ငွေ: ${formattedBalance}`
}

// Update KYC Status
function updateKycStatus(status) {
  userKycStatus = status
  let statusText = "စောင့်ဆိုင်းဆဲ"
  let statusClass = "pending"

  if (status === "approved") {
    statusText = "အတည်ပြုပြီး"
    statusClass = "approved"
  } else if (status === "rejected") {
    statusText = "ငြင်းပယ်ခဲ့သည်"
    statusClass = "rejected"
  }

  kycStatusElement.textContent = `KYC: ${statusText}`

  // Update KYC page if it exists
  if (kycStatusCard) {
    const statusIcon = kycStatusCard.querySelector(".kyc-status-icon")
    if (statusIcon) {
      statusIcon.className = `kyc-status-icon ${statusClass}`
      statusIcon.innerHTML =
        status === "approved"
          ? '<i class="fas fa-check-circle"></i>'
          : status === "rejected"
            ? '<i class="fas fa-times-circle"></i>'
            : '<i class="fas fa-clock"></i>'
    }

    kycStatusMessage.textContent = statusText

    // Show/hide KYC form based on status
    if (status === "approved") {
      kycForm.style.display = "none"
    } else {
      kycForm.style.display = "block"
    }
  }
}

// Update Transfer Status
function updateTransferStatus(enabled) {
  userTransferStatus = enabled
  transferStatusElement.textContent = `ငွေလွှဲခြင်း: ${enabled ? "ခွင့်ပြုထားသည်" : "ပိတ်ထားသည်"}`
}

// Show Auth Container
function showAuth() {
  hideLoader()
  authContainer.classList.remove("hidden")
  appContainer.classList.add("hidden")
}

// Show App Container
function showApp() {
  hideLoader()
  authContainer.classList.add("hidden")
  appContainer.classList.remove("hidden")

  // Show dashboard by default
  navigateTo("dashboard")
}

// Switch Auth Tab
function switchAuthTab(tabType) {
  // Update tabs
  authTabs.forEach((tab) => {
    if (tab.getAttribute("data-tab") === tabType) {
      tab.classList.add("active")
    } else {
      tab.classList.remove("active")
    }
  })

  // Update tab indicator
  document.querySelector(".auth-tabs").setAttribute("data-active", tabType)

  // Update forms
  authForms.forEach((form) => {
    if (form.id === `${tabType}-form`) {
      form.classList.add("active")
    } else {
      form.classList.remove("active")
    }
  })
}

// Handle Login
async function handleLogin(e) {
  e.preventDefault()

  const email = document.getElementById("login-email").value
  const password = document.getElementById("login-password").value
  const errorMsg = document.getElementById("login-error")
  const successMsg = document.getElementById("login-success")

  // Validate inputs
  if (!email || !password) {
    showMessage(errorMsg, "အီးမေးလ်နှင့် စကားဝှက် ထည့်သွင်းပါ။")
    return
  }

  try {
    // Show processing
    showProcessing("အကောင့်ဝင်ရောက်နေသည်...")

    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    // Success
    showMessage(successMsg, "အကောင့်ဝင်ရောက်ခြင်း အောင်မြင်ပါသည်!")
    currentUser = data.user

    // Fetch user data and show app
    await fetchUserData()
    hideProcessing()
    showApp()

    // Play success sound
    playSound(successSound)
  } catch (error) {
    hideProcessing()
    showMessage(errorMsg, `အကောင့်ဝင်ရောက်ခြင်း မအောင်မြင်ပါ: ${error.message}`)
    playSound(errorSound)
  }
}

// Handle Google Login
async function handleGoogleLogin() {
  try {
    showProcessing("Google ဖြင့် အကောင့်ဝင်ရောက်နေသည်...")

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (error) throw error
  } catch (error) {
    hideProcessing()
    showMessage(document.getElementById("login-error"), `Google ဖြင့် အကောင့်ဝင်ရောက်ခြင်း မအောင်မြင်ပါ: ${error.message}`)
    playSound(errorSound)
  }
}

// Handle Signup
async function handleSignup(e) {
  e.preventDefault()

  const email = document.getElementById("signup-email").value
  const phone = document.getElementById("signup-phone").value
  const password = document.getElementById("signup-password").value
  const confirmPassword = document.getElementById("signup-confirm-password").value
  const termsAgree = document.getElementById("terms-agree").checked
  const errorMsg = document.getElementById("signup-error")
  const successMsg = document.getElementById("signup-success")

  // Validate inputs
  if (!email || !phone || !password || !confirmPassword) {
    showMessage(errorMsg, "ကွက်လပ်အားလုံး ဖြည့်စွက်ပါ။")
    return
  }

  if (password !== confirmPassword) {
    showMessage(errorMsg, "စကားဝှက်များ မတူညီပါ။")
    return
  }

  if (!termsAgree) {
    showMessage(errorMsg, "စည်းမျဉ်းစည်းကမ်းများကို သဘောတူရန် လိုအပ်ပါသည်။")
    return
  }

  try {
    // Show processing
    showProcessing("အကောင့်ဖွင့်နေသည်...")

    // Sign up with Supabase
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          phone,
        },
      },
    })

    if (error) throw error

    // Success
    showMessage(successMsg, "အကောင့်ဖွင့်ခြင်း အောင်မြင်ပါသည်! အီးမေးလ်တွင် အတည်ပြုချက်ကို စစ်ဆေးပါ။")

    // If auto-confirm is enabled in Supabase
    if (data.session) {
      currentUser = data.user
      await fetchUserData()
      hideProcessing()
      showApp()
    } else {
      hideProcessing()
      // Switch to login tab after 2 seconds
      setTimeout(() => {
        switchAuthTab("login")
      }, 2000)
    }

    // Play success sound
    playSound(successSound)
  } catch (error) {
    hideProcessing()
    showMessage(errorMsg, `အကောင့်ဖွင့်ခြင်း မအောင်မြင်ပါ: ${error.message}`)
    playSound(errorSound)
  }
}

// Handle Google Signup
async function handleGoogleSignup() {
  // Same as Google Login for Supabase
  handleGoogleLogin()
}

// Toggle Password Visibility
function togglePasswordVisibility(e) {
  const button = e.currentTarget
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
}

// Toggle Sidebar
function toggleSidebar() {
  sidebar.classList.toggle("active")
}

// Toggle Profile Dropdown
function toggleProfileDropdown() {
  profileDropdown.classList.toggle("active")
}

// Close Dropdown on Outside Click
function closeDropdownOnOutsideClick(e) {
  if (
    profileDropdown.classList.contains("active") &&
    !profileDropdownTrigger.contains(e.target) &&
    !profileDropdown.contains(e.target)
  ) {
    profileDropdown.classList.remove("active")
  }
}

// Toggle Notifications Panel
function toggleNotificationsPanel() {
  notificationsPanel.classList.toggle("active")

  // Mark notifications as read when panel is opened
  if (notificationsPanel.classList.contains("active")) {
    markNotificationsAsRead()
  }
}

// Handle Navigation
function handleNavigation(e) {
  e.preventDefault()
  const target = e.currentTarget.getAttribute("data-page") || e.currentTarget.getAttribute("href").substring(1)
  navigateTo(target)
}

// Navigate To Page
function navigateTo(pageId) {
  // Hide all pages
  pages.forEach((page) => {
    page.classList.remove("active")
  })

  // Show target page
  const targetPage = document.getElementById(`${pageId}-page`)
  if (targetPage) {
    targetPage.classList.add("active")
  }

  // Update navigation
  navLinks.forEach((link) => {
    const linkPage = link.getAttribute("data-page")
    if (linkPage === pageId) {
      link.parentElement.classList.add("active")
    } else {
      link.parentElement.classList.remove("active")
    }
  })

  // Close sidebar on mobile
  if (window.innerWidth < 992) {
    sidebar.classList.remove("active")
  }

  // Specific page actions
  if (pageId === "dashboard") {
    refreshDashboard()
  } else if (pageId === "history") {
    refreshTransactions()
  } else if (pageId === "announcements") {
    refreshAnnouncements()
  } else if (pageId === "media") {
    refreshMedia()
  }
}

// Handle Quick Action
function handleQuickAction(e) {
  const pageId = e.currentTarget.getAttribute("data-page")
  navigateTo(pageId)
}

// Handle Logout
async function handleLogout() {
  try {
    showProcessing("အကောင့်ထွက်နေသည်...")

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut()

    if (error) throw error

    // Unsubscribe from realtime
    if (realtimeSubscription) {
      realtimeSubscription.unsubscribe()
    }

    // Reset user data
    currentUser = null
    userBalance = 0
    userKycStatus = "pending"
    userTransferStatus = true

    // Show auth screen
    hideProcessing()
    showAuth()
  } catch (error) {
    hideProcessing()
    showErrorNotification(`အကောင့်ထွက်ခြင်း မအောင်မြင်ပါ: ${error.message}`)
    playSound(errorSound)
  }
}

// Handle Change Password
async function handleChangePassword() {
  const currentPassword = document.getElementById("current-password").value
  const newPassword = document.getElementById("new-password").value
  const confirmNewPassword = document.getElementById("confirm-new-password").value
  const errorMsg = document.getElementById("change-password-error")
  const successMsg = document.getElementById("change-password-success")

  // Validate inputs
  if (!currentPassword || !newPassword || !confirmNewPassword) {
    showMessage(errorMsg, "ကွက်လပ်အားလုံး ဖြည့်စွက်ပါ။")
    return
  }

  if (newPassword !== confirmNewPassword) {
    showMessage(errorMsg, "စကားဝှက်အသစ်များ မတူညီပါ။")
    return
  }

  try {
    showProcessing("စကားဝှက်ပြောင်းနေသည်...")

    // First, verify current password by signing in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: currentPassword,
    })

    if (signInError) throw new Error("လက်ရှိစကားဝှက် မမှန်ကန်ပါ။")

    // Update password
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) throw error

    // Success
    hideProcessing()
    showMessage(successMsg, "စကားဝှက် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။")
    playSound(successSound)

    // Clear form and close modal after 2 seconds
    document.getElementById("current-password").value = ""
    document.getElementById("new-password").value = ""
    document.getElementById("confirm-new-password").value = ""

    setTimeout(() => {
      closeModal(changePasswordModal)
    }, 2000)
  } catch (error) {
    hideProcessing()
    showMessage(errorMsg, `စကားဝှက်ပြောင်းခြင်း မအောင်မြင်ပါ: ${error.message}`)
    playSound(errorSound)
  }
}

// Handle Change PIN
async function handleChangePin() {
  const currentPin = document.getElementById("current-pin").value
  const newPin = document.getElementById("new-pin").value
  const confirmNewPin = document.getElementById("confirm-new-pin").value
  const errorMsg = document.getElementById("change-pin-error")
  const successMsg = document.getElementById("change-pin-success")

  // Validate inputs
  if (!currentPin || !newPin || !confirmNewPin) {
    showMessage(errorMsg, "ကွက်လပ်အားလုံး ဖြည့်စွက်ပါ။")
    return
  }

  if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
    showMessage(errorMsg, "PIN သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။")
    return
  }

  if (newPin !== confirmNewPin) {
    showMessage(errorMsg, "PIN အသစ်များ မတူညီပါ။")
    return
  }

  try {
    showProcessing("PIN ပြောင်းနေသည်...")

    // Verify current PIN
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("payment_pin")
      .eq("user_id", currentUser.id)
      .single()

    if (profileError) throw profileError

    if (profile.payment_pin !== currentPin) {
      throw new Error("လက်ရှိ PIN မမှန်ကန်ပါ။")
    }

    // Update PIN
    const { error } = await supabase.from("profiles").update({ payment_pin: newPin }).eq("user_id", currentUser.id)

    if (error) throw error

    // Success
    hideProcessing()
    showMessage(successMsg, "PIN အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။")
    playSound(successSound)

    // Clear form and close modal after 2 seconds
    document.getElementById("current-pin").value = ""
    document.getElementById("new-pin").value = ""
    document.getElementById("confirm-new-pin").value = ""

    setTimeout(() => {
      closeModal(changePinModal)
    }, 2000)
  } catch (error) {
    hideProcessing()
    showMessage(errorMsg, `PIN ပြောင်းခြင်း မအောင်မြင်ပါ: ${error.message}`)
    playSound(errorSound)
  }
}

// Handle Delete Account
async function handleDeleteAccount() {
  const password = document.getElementById("delete-password").value
  const confirmDelete = document.getElementById("confirm-delete").checked
  const errorMsg = document.getElementById("delete-account-error")

  // Validate inputs
  if (!password) {
    showMessage(errorMsg, "စကားဝှက်ထည့်ပါ။")
    return
  }

  if (!confirmDelete) {
    showMessage(errorMsg, "အကောင့်ဖျက်ရန် အတည်ပြုချက်ကို အမှန်ခြစ်ပါ။")
    return
  }

  try {
    showProcessing("အကောင့်ဖျက်နေသည်...")

    // Verify password by signing in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password,
    })

    if (signInError) throw new Error("စကားဝှက် မမှန်ကန်ပါ။")

    // Delete user profile first
    const { error: profileError } = await supabase.from("profiles").delete().eq("user_id", currentUser.id)

    if (profileError) throw profileError

    // Delete user account
    const { error } = await supabase.auth.admin.deleteUser(currentUser.id)

    if (error) throw error

    // Sign out
    await supabase.auth.signOut()

    // Reset user data
    currentUser = null

    // Show success message and redirect to auth
    hideProcessing()
    showSuccessNotification("အကောင့်ကို အောင်မြင်စွာ ဖျက်ပြီးပါပြီ။")

    setTimeout(() => {
      showAuth()
    }, 2000)
  } catch (error) {
    hideProcessing()
    showMessage(errorMsg, `အကောင့်ဖျက်ခြင်း မအောင်မြင်ပါ: ${error.message}`)
    playSound(errorSound)
  }
}

// Handle PIN Input
function handlePinInput(e) {
  const input = e.target
  const index = Number.parseInt(input.getAttribute("data-index"))

  if (input.value.length === 1 && index < 5) {
    pinInputs[index + 1].focus()
  }
}

// Confirm PIN
async function confirmPin() {
  const pinValues = Array.from(pinInputs).map((input) => input.value)
  const pin = pinValues.join("")
  const errorMsg = document.getElementById("pin-error")

  // Validate PIN
  if (pin.length !== 6) {
    showMessage(errorMsg, "PIN ကုဒ် ၆ လုံး ထည့်ပါ။")
    return
  }

  try {
    showProcessing("PIN စစ်ဆေးနေသည်...")

    // Verify PIN
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("payment_pin")
      .eq("user_id", currentUser.id)
      .single()

    if (profileError) throw profileError

    if (profile.payment_pin !== pin) {
      throw new Error("PIN မမှန်ကန်ပါ။")
    }

    // PIN is correct, proceed with transfer
    hideProcessing()
    closeModal(pinEntryModal)

    // Clear PIN inputs
    pinInputs.forEach((input) => {
      input.value = ""
    })

    // Process the transfer
    processTransfer()
  } catch (error) {
    hideProcessing()
    showMessage(errorMsg, `PIN စစ်ဆေးခြင်း မအောင်မြင်ပါ: ${error.message}`)
    playSound(errorSound)
  }
}

// Toggle Balance Visibility
function toggleBalanceVisibility() {
  isBalanceHidden = !isBalanceHidden

  // Update icon
  hideBalanceBtn.innerHTML = isBalanceHidden ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>'

  // Update balance display
  updateBalance(userBalance)
}

// Refresh Balance
async function refreshBalance() {
  try {
    // Add rotation animation to refresh button
    refreshBalanceBtn.classList.add("fa-spin")

    // Fetch latest balance
    const { data, error } = await supabase.from("profiles").select("balance").eq("user_id", currentUser.id).single()

    if (error) throw error

    // Update balance
    updateBalance(data.balance)

    // Show success notification
    showSuccessNotification("လက်ကျန်ငွေ အသစ်ဖြင့် ပြန်လည်ဖော်ပြပြီးပါပြီ။")

    // Remove rotation after 1 second
    setTimeout(() => {
      refreshBalanceBtn.classList.remove("fa-spin")
    }, 1000)
  } catch (error) {
    refreshBalanceBtn.classList.remove("fa-spin")
    showErrorNotification(`လက်ကျန်ငွေ ပြန်လည်ရယူရာတွင် အမှားရှိနေပါသည်: ${error.message}`)
  }
}

// Check Recipient
async function checkRecipient() {
  const phone = transferPhoneInput.value

  if (!phone) {
    recipientInfoDiv.style.display = "none"
    return
  }

  try {
    // Fetch recipient profile
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, phone")
      .eq("phone", phone)
      .single()

    if (error) throw error

    if (data) {
      // Show recipient info
      recipientInfoDiv.style.display = "block"
      recipientInfoDiv.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle alert-icon"></i>
                    <div>
                        <strong>လက်ခံမည့်သူ:</strong> ${data.full_name || data.email || "အကောင့်"}
                        <br>
                        <small>ဖုန်းနံပါတ်: ${data.phone}</small>
                    </div>
                </div>
            `
    } else {
      recipientInfoDiv.style.display = "block"
      recipientInfoDiv.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle alert-icon"></i>
                    <div>ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှာမတွေ့ပါ။</div>
                </div>
            `
    }
  } catch (error) {
    recipientInfoDiv.style.display = "block"
    recipientInfoDiv.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle alert-icon"></i>
                <div>လက်ခံမည့်သူ စစ်ဆေးရာတွင် အမှားရှိနေပါသည်။</div>
            </div>
        `
  }
}

// Handle Transfer
async function handleTransfer() {
  const phone = transferPhoneInput.value
  const amount = Number.parseFloat(transferAmountInput.value)
  const note = transferNoteInput.value

  // Validate inputs
  if (!phone) {
    showMessage(transferErrorMsg, "လက်ခံမည့်သူ၏ ဖုန်းနံပါတ် ထည့်ပါ။")
    return
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    showMessage(transferErrorMsg, "မှန်ကန်သော ငွေပမာဏ ထည့်ပါ။")
    return
  }

  if (amount < 1000) {
    showMessage(transferErrorMsg, "အနည်းဆုံး ငွေပမာဏမှာ 1,000 Ks ဖြစ်ရပါမည်။")
    return
  }

  if (amount > userBalance) {
    showMessage(transferErrorMsg, "လက်ကျန်ငွေ မလုံလောက်ပါ။")
    return
  }

  try {
    // Check if recipient exists
    const { data: recipient, error: recipientError } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, phone")
      .eq("phone", phone)
      .single()

    if (recipientError) throw new Error("လက်ခံမည့်သူ ရှာမတွေ့ပါ။")

    // Check if sending to self
    if (recipient.user_id === currentUser.id) {
      showMessage(transferErrorMsg, "မိမိကိုယ်တိုင်ထံသို့ ငွေလွှဲ၍မရပါ။")
      return
    }

    // Open PIN entry modal
    openModal(pinEntryModal)
    pinInputs[0].focus()
  } catch (error) {
    showMessage(transferErrorMsg, `ငွေလွှဲခြင်း မအောင်မြင်ပါ: ${error.message}`)
    playSound(errorSound)
  }
}

// Process Transfer
async function processTransfer() {
  const phone = transferPhoneInput.value
  const amount = Number.parseFloat(transferAmountInput.value)
  const note = transferNoteInput.value

  try {
    showProcessing("ငွေလွှဲနေသည်...")

    // Add robotic transfer animation to processing overlay
    const processingContent = document.querySelector(".processing-content")
    const robotAnimation = document.createElement("div")
    robotAnimation.className = "robot-transfer-animation"
    robotAnimation.innerHTML = `
            <div class="robot-head">
                <div class="robot-eye left"></div>
                <div class="robot-eye right"></div>
                <div class="robot-antenna"></div>
            </div>
            <div class="robot-body"></div>
            <div class="robot-arm left"></div>
            <div class="robot-arm right"></div>
            <div class="money-particle"></div>
            <div class="money-particle"></div>
            <div class="money-particle"></div>
            <div class="money-particle"></div>
            <div class="money-particle"></div>
        `
    processingContent.insertBefore(robotAnimation, processingContent.firstChild)

    // Get recipient
    const { data: recipient, error: recipientError } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, phone, balance")
      .eq("phone", phone)
      .single()

    if (recipientError) throw recipientError

    // Start a Supabase transaction
    const { data, error } = await supabase.rpc("transfer_money", {
      sender_id: currentUser.id,
      recipient_id: recipient.user_id,
      amount: amount,
      note: note || null,
    })

    if (error) throw error

    // Update local balance
    userBalance -= amount
    updateBalance(userBalance)

    // Show success message
    hideProcessing()
    showMessage(
      transferSuccessMsg,
      `${formatCurrency(amount)} ကို ${recipient.full_name || recipient.email || recipient.phone} ထံသို့ အောင်မြင်စွာ လွှဲပြောင်းပြီးပါပြီ။`,
    )
    playSound(successSound)

    // Clear form
    transferPhoneInput.value = ""
    transferAmountInput.value = ""
    transferNoteInput.value = ""
    recipientInfoDiv.style.display = "none"

    // Refresh transactions
    await fetchTransactions()

    // Show receipt
    showTransferReceipt({
      id: data.transaction_id,
      recipient: recipient.full_name || recipient.email || recipient.phone,
      recipient_phone: recipient.phone,
      amount: amount,
      note: note,
      date: new Date(),
      status: "success",
    })
  } catch (error) {
    hideProcessing()
    showMessage(transferErrorMsg, `ငွေလွှဲခြင်း မအောင်မြင်ပါ: ${error.message}`)
    playSound(errorSound)
  }
}

// Show Transfer Receipt
function showTransferReceipt(transaction) {
  // Generate receipt HTML
  const receiptHTML = `
        <div class="robotic-receipt" id="receipt-for-download">
            <div class="receipt-robot">
                <div class="receipt-robot-head">
                    <div class="receipt-robot-eye left"></div>
                    <div class="receipt-robot-eye right"></div>
                </div>
                <div class="receipt-robot-body"></div>
            </div>
            <div class="receipt-logo">
                <img src="https://github.com/Opper125/opper-payment/raw/main/logo.png" alt="OPPER Logo">
            </div>
            <div class="receipt-title">ငွေလွှဲပြေစာ</div>
            <div class="receipt-subtitle">OPPER Payment</div>
            
            <div class="receipt-info">
                <div class="receipt-row">
                    <div class="receipt-label">ငွေလွှဲအမှတ်</div>
                    <div class="receipt-value">${transaction.id.substring(0, 8)}</div>
                </div>
                <div class="receipt-row">
                    <div class="receipt-label">ရက်စွဲ</div>
                    <div class="receipt-value">${formatDate(transaction.date)}</div>
                </div>
                <div class="receipt-row">
                    <div class="receipt-label">အချိန်</div>
                    <div class="receipt-value">${formatTime(transaction.date)}</div>
                </div>
                <div class="receipt-row">
                    <div class="receipt-label">လက်ခံသူ</div>
                    <div class="receipt-value">${transaction.recipient}</div>
                </div>
                <div class="receipt-row">
                    <div class="receipt-label">ဖုန်းနံပါတ်</div>
                    <div class="receipt-value">${transaction.recipient_phone}</div>
                </div>
                ${
                  transaction.note
                    ? `
                <div class="receipt-row">
                    <div class="receipt-label">မှတ်ချက်</div>
                    <div class="receipt-value">${transaction.note}</div>
                </div>
                `
                    : ""
                }
            </div>
            
            <div class="receipt-divider"></div>
            
            <div class="receipt-total">
                <div>စုစုပေါင်း</div>
                <div>${formatCurrency(transaction.amount)}</div>
            </div>
            
            <div class="receipt-barcode"></div>
            <div class="receipt-serial">OPPER-${Date.now().toString().substring(5)}</div>
            
            <div class="receipt-footer">
                ဤပြေစာသည် OPPER Payment မှ ထုတ်ပေးသော တရားဝင်ပြေစာဖြစ်ပါသည်။
            </div>
        </div>
    `

  // Set receipt content
  receiptContainer.innerHTML = receiptHTML

  // Show receipt modal
  openModal(receiptModal)
}

// Download Receipt
function downloadReceipt() {
  const receiptElement = document.getElementById("receipt-for-download")

  if (!receiptElement) return

  // Use html2canvas to convert the receipt to an image
  html2canvas(receiptElement, {
    backgroundColor: "#ffffff",
  }).then((canvas) => {
    // Create a link to download the image
    const link = document.createElement("a")
    link.download = `OPPER-Receipt-${Date.now()}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  })
}

// Filter Transactions
function filterTransactions() {
  const type = historyTypeFilter.value
  const dateRange = historyDateFilter.value

  refreshTransactions(type, dateRange)
}

// Filter Media
function filterMedia() {
  const type = mediaTypeFilter.value

  refreshMedia(type)
}

// Handle KYC Submission
async function handleKycSubmission() {
  const passport = document.getElementById("kyc-passport").value
  const address = document.getElementById("kyc-address").value
  const pin = document.getElementById("kyc-pin").value
  const confirmPin = document.getElementById("kyc-confirm-pin").value
  const passportFile = passportUpload.files[0]
  const selfieFile = selfieUpload.files[0]

  // Validate inputs
  if (!passport || !address || !pin || !confirmPin || !passportFile || !selfieFile) {
    showMessage(kycErrorMsg, "ကွက်လပ်အားလုံး ဖြည့်စွက်ပါ။")
    return
  }

  if (pin.length !== 6 || !/^\d+$/.test(pin)) {
    showMessage(kycErrorMsg, "PIN သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။")
    return
  }

  if (pin !== confirmPin) {
    showMessage(kycErrorMsg, "PIN များ မတူညီပါ။")
    return
  }

  try {
    showProcessing("KYC အချက်အလက်များ တင်သွင်းနေသည်...")

    // Upload passport image
    const passportPath = `kyc/${currentUser.id}/passport`
    const { data: passportData, error: passportError } = await supabase.storage
      .from("kyc_documents")
      .upload(passportPath, passportFile, {
        cacheControl: "3600",
        upsert: true,
      })

    if (passportError) throw passportError

    // Upload selfie image
    const selfiePath = `kyc/${currentUser.id}/selfie`
    const { data: selfieData, error: selfieError } = await supabase.storage
      .from("kyc_documents")
      .upload(selfiePath, selfieFile, {
        cacheControl: "3600",
        upsert: true,
      })

    if (selfieError) throw selfieError

    // Get public URLs
    const passportUrl = supabase.storage.from("kyc_documents").getPublicUrl(passportPath).data.publicUrl

    const selfieUrl = supabase.storage.from("kyc_documents").getPublicUrl(selfiePath).data.publicUrl

    // Update profile with KYC data
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        passport_number: passport,
        address: address,
        payment_pin: pin,
        passport_image_url: passportUrl,
        selfie_image_url: selfieUrl,
        kyc_status: "pending",
        kyc_submitted_at: new Date(),
      })
      .eq("user_id", currentUser.id)

    if (updateError) throw updateError

    // Success
    hideProcessing()
    showMessage(kycSuccessMsg, "KYC အချက်အလက်များ အောင်မြင်စွာ တင်သွင်းပြီးပါပြီ။ စစ်ဆေးပြီးပါက အကြောင်းကြားပါမည်။")
    playSound(successSound)

    // Update KYC status
    updateKycStatus("pending")

    // Clear form
    document.getElementById("kyc-passport").value = ""
    document.getElementById("kyc-address").value = ""
    document.getElementById("kyc-pin").value = ""
    document.getElementById("kyc-confirm-pin").value = ""
    passportUpload.value = ""
    selfieUpload.value = ""
    passportPreview.innerHTML = ""
    selfiePreview.innerHTML = ""
    passportPreview.style.display = "none"
    selfiePreview.style.display = "none"
  } catch (error) {
    hideProcessing()
    showMessage(kycErrorMsg, `KYC တင်သွင်းခြင်း မအောင်မြင်ပါ: ${error.message}`)
    playSound(errorSound)
  }
}

// Handle File Upload
function handleFileUpload(e) {
  const input = e.target
  const preview = input.id === "passport-upload" ? passportPreview : selfiePreview

  if (input.files && input.files[0]) {
    const reader = new FileReader()

    reader.onload = (e) => {
      preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`
      preview.style.display = "block"
    }

    reader.readAsDataURL(input.files[0])
  }
}

// Set Theme
function setTheme(theme) {
  // Update active theme option
  themeOptions.forEach((option) => {
    if (option.getAttribute("data-theme") === theme) {
      option.classList.add("active")
    } else {
      option.classList.remove("active")
    }
  })

  // Apply theme
  currentTheme = theme
  applyTheme(theme)

  // Save theme preference
  localStorage.setItem("theme", theme)
}

// Apply Theme
function applyTheme(theme) {
  if (theme === "system") {
    // Check system preference
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.setAttribute("data-theme", "dark")
    } else {
      document.documentElement.setAttribute("data-theme", "light")
    }

    // Listen for changes in system preference
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (currentTheme === "system") {
        document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light")
      }
    })
  } else {
    document.documentElement.setAttribute("data-theme", theme)
  }
}

// Toggle Sounds
function toggleSounds() {
  soundsEnabled = enableSoundsCheckbox.checked
  localStorage.setItem("sounds", soundsEnabled)
}

// Toggle Notifications
function toggleNotifications() {
  notificationsEnabled = enableNotificationsCheckbox.checked
  localStorage.setItem("notifications", notificationsEnabled)

  // Request notification permission if enabled
  if (notificationsEnabled && Notification.permission !== "granted") {
    Notification.requestPermission()
  }
}

// Play Sound
function playSound(sound) {
  if (soundsEnabled && sound) {
    sound.currentTime = 0
    sound.play().catch((error) => console.error("Sound play error:", error))
  }
}

// Show Message
function showMessage(element, message) {
  if (!element) return

  element.textContent = message
  element.style.display = "block"

  // Hide message after 5 seconds
  setTimeout(() => {
    element.style.display = "none"
  }, 5000)
}

// Show Success Notification
function showSuccessNotification(message) {
  // Create notification element
  const notification = document.createElement("div")
  notification.className = "notification-item"
  notification.innerHTML = `
        <div class="notification-title">
            <i class="fas fa-check-circle" style="color: var(--success);"></i> 
            အောင်မြင်မှု
        </div>
        <div class="notification-content">${message}</div>
        <div class="notification-time">ယခုအတွင်း</div>
    `

  // Add to notifications list
  notificationsList.insertBefore(notification, notificationsList.firstChild)

  // Remove empty state if it exists
  const emptyState = notificationsList.querySelector(".empty-state")
  if (emptyState) {
    emptyState.remove()
  }

  // Update notification count
  updateNotificationCount(1)

  // Play notification sound
  playSound(successSound)

  // Show browser notification if enabled
  if (notificationsEnabled && Notification.permission === "granted") {
    new Notification("OPPER Payment", {
      body: message,
      icon: "https://github.com/Opper125/opper-payment/raw/main/logo.png",
    })
  }

  // Save notification to database
  saveNotification("success", "အောင်မြင်မှု", message)
}

// Show Error Notification
function showErrorNotification(message) {
  // Create notification element
  const notification = document.createElement("div")
  notification.className = "notification-item"
  notification.innerHTML = `
        <div class="notification-title">
            <i class="fas fa-exclamation-circle" style="color: var(--danger);"></i> 
            အမှား
        </div>
        <div class="notification-content">${message}</div>
        <div class="notification-time">ယခုအတွင်း</div>
    `

  // Add to notifications list
  notificationsList.insertBefore(notification, notificationsList.firstChild)

  // Remove empty state if it exists
  const emptyState = notificationsList.querySelector(".empty-state")
  if (emptyState) {
    emptyState.remove()
  }

  // Update notification count
  updateNotificationCount(1)

  // Play notification sound
  playSound(errorSound)

  // Show browser notification if enabled
  if (notificationsEnabled && Notification.permission === "granted") {
    new Notification("OPPER Payment", {
      body: message,
      icon: "https://github.com/Opper125/opper-payment/raw/main/logo.png",
    })
  }

  // Save notification to database
  saveNotification("error", "အမှား", message)
}

// Update Notification Count
function updateNotificationCount(increment = 0) {
  let count = Number.parseInt(notificationCount.textContent) || 0

  if (increment) {
    count += increment
  }

  notificationCount.textContent = count

  if (count > 0) {
    notificationCount.style.display = "flex"
    notificationBell.classList.add("glow-effect")
  } else {
    notificationCount.style.display = "none"
    notificationBell.classList.remove("glow-effect")
  }
}

// Mark Notifications as Read
async function markNotificationsAsRead() {
  try {
    // Update notifications in database
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", currentUser.id)
      .eq("read", false)

    if (error) throw error

    // Update UI
    document.querySelectorAll(".notification-item.unread").forEach((item) => {
      item.classList.remove("unread")
    })

    // Reset notification count
    updateNotificationCount(0)
  } catch (error) {
    console.error("Error marking notifications as read:", error)
  }
}

// Save Notification
async function saveNotification(type, title, message) {
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: currentUser.id,
      type,
      title,
      message,
      read: false,
      created_at: new Date(),
    })

    if (error) throw error
  } catch (error) {
    console.error("Error saving notification:", error)
  }
}

// Fetch Notifications
async function fetchNotifications() {
  try {
    // Fetch notifications from database
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) throw error

    // Update notifications list
    renderNotifications(data)

    // Update notification count
    const unreadCount = data.filter((notification) => !notification.read).length
    updateNotificationCount(unreadCount)
  } catch (error) {
    console.error("Error fetching notifications:", error)
  }
}

// Render Notifications
function renderNotifications(notifications) {
  if (!notifications || notifications.length === 0) {
    notificationsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <p>အသိပေးချက်များ မရှိသေးပါ</p>
            </div>
        `
    return
  }

  notificationsList.innerHTML = ""

  notifications.forEach((notification) => {
    const notificationItem = document.createElement("div")
    notificationItem.className = `notification-item ${notification.read ? "" : "unread"}`

    let iconClass = "fas fa-info-circle"
    let iconColor = "var(--info)"

    if (notification.type === "success") {
      iconClass = "fas fa-check-circle"
      iconColor = "var(--success)"
    } else if (notification.type === "error") {
      iconClass = "fas fa-exclamation-circle"
      iconColor = "var(--danger)"
    } else if (notification.type === "warning") {
      iconClass = "fas fa-exclamation-triangle"
      iconColor = "var(--warning)"
    }

    notificationItem.innerHTML = `
            <div class="notification-title">
                <i class="${iconClass}" style="color: ${iconColor};"></i> 
                ${notification.title}
            </div>
            <div class="notification-content">${notification.message}</div>
            <div class="notification-time">${formatTimeAgo(new Date(notification.created_at))}</div>
        `

    notificationsList.appendChild(notificationItem)
  })
}

// Fetch Transactions
async function fetchTransactions() {
  try {
    // Fetch transactions from database
    const { data, error } = await supabase
      .from("transactions")
      .select(`
                *,
                sender:profiles!sender_id(full_name, email, phone),
                recipient:profiles!recipient_id(full_name, email, phone)
            `)
      .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) throw error

    // Store transactions
    transactions = data

    // Render transactions
    renderTransactions(data)
  } catch (error) {
    console.error("Error fetching transactions:", error)
    showErrorNotification("ငွေလွှဲမှတ်တမ်းများ ရယူရာတွင် အမှားရှိနေပါသည်။")
  }
}

// Render Transactions
function renderTransactions(transactions, container = "both", type = "all", dateRange = "all") {
  // Filter transactions based on type and date range
  let filteredTransactions = transactions

  if (type !== "all") {
    filteredTransactions = filteredTransactions.filter((transaction) => {
      if (type === "sent") {
        return transaction.sender_id === currentUser.id
      } else if (type === "received") {
        return transaction.recipient_id === currentUser.id
      }
      return true
    })
  }

  if (dateRange !== "all") {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    filteredTransactions = filteredTransactions.filter((transaction) => {
      const txDate = new Date(transaction.created_at)

      if (dateRange === "today") {
        return txDate >= today
      } else if (dateRange === "week") {
        return txDate >= weekStart
      } else if (dateRange === "month") {
        return txDate >= monthStart
      }

      return true
    })
  }

  // Render recent transactions on dashboard
  if (container === "both" || container === "recent") {
    const recentTransactions = filteredTransactions.slice(0, 5)

    if (recentTransactions.length === 0) {
      recentTransactionsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>လုပ်ဆောင်ချက်မှတ်တမ်းမရှိသေးပါ</p>
                </div>
            `
    } else {
      recentTransactionsList.innerHTML = ""

      recentTransactions.forEach((transaction) => {
        const isSender = transaction.sender_id === currentUser.id
        const otherParty = isSender
          ? transaction.recipient.full_name || transaction.recipient.email || transaction.recipient.phone
          : transaction.sender.full_name || transaction.sender.email || transaction.sender.phone

        const transactionItem = document.createElement("div")
        transactionItem.className = "transaction-item"
        transactionItem.innerHTML = `
                    <div class="transaction-icon ${isSender ? "sent" : "received"}">
                        <i class="fas ${isSender ? "fa-arrow-up" : "fa-arrow-down"}"></i>
                    </div>
                    <div class="transaction-details">
                        <div class="transaction-title">${isSender ? `${otherParty} သို့` : `${otherParty} မှ`}</div>
                        <div class="transaction-meta">
                            <div class="transaction-date">${formatDate(new Date(transaction.created_at))}</div>
                            <div class="transaction-id">ID: ${transaction.id.substring(0, 8)}</div>
                        </div>
                    </div>
                    <div class="transaction-amount ${isSender ? "sent" : "received"}">
                        ${isSender ? "-" : "+"} ${formatCurrency(transaction.amount)}
                    </div>
                `

        // Add click event to show receipt
        transactionItem.addEventListener("click", () => {
          showTransactionDetails(transaction)
        })

        recentTransactionsList.appendChild(transactionItem)
      })
    }
  }

  // Render all transactions on history page
  if (container === "both" || container === "history") {
    if (filteredTransactions.length === 0) {
      historyTransactionsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>လုပ်ဆောင်ချက်မှတ်တမ်းမရှိသေးပါ</p>
                </div>
            `
    } else {
      historyTransactionsList.innerHTML = ""

      filteredTransactions.forEach((transaction) => {
        const isSender = transaction.sender_id === currentUser.id
        const otherParty = isSender
          ? transaction.recipient.full_name || transaction.recipient.email || transaction.recipient.phone
          : transaction.sender.full_name || transaction.sender.email || transaction.sender.phone

        const transactionItem = document.createElement("div")
        transactionItem.className = "transaction-item"
        transactionItem.innerHTML = `
                    <div class="transaction-icon ${isSender ? "sent" : "received"}">
                        <i class="fas ${isSender ? "fa-arrow-up" : "fa-arrow-down"}"></i>
                    </div>
                    <div class="transaction-details">
                        <div class="transaction-title">${isSender ? `${otherParty} သို့` : `${otherParty} မှ`}</div>
                        <div class="transaction-meta">
                            <div class="transaction-date">${formatDate(new Date(transaction.created_at))}</div>
                            <div class="transaction-id">ID: ${transaction.id.substring(0, 8)}</div>
                        </div>
                    </div>
                    <div class="transaction-amount ${isSender ? "sent" : "received"}">
                        ${isSender ? "-" : "+"} ${formatCurrency(transaction.amount)}
                    </div>
                `

        // Add click event to show receipt
        transactionItem.addEventListener("click", () => {
          showTransactionDetails(transaction)
        })

        historyTransactionsList.appendChild(transactionItem)
      })
    }
  }
}

// Show Transaction Details
function showTransactionDetails(transaction) {
  const isSender = transaction.sender_id === currentUser.id
  const otherParty = isSender
    ? transaction.recipient.full_name || transaction.recipient.email || transaction.recipient.phone
    : transaction.sender.full_name || transaction.sender.email || transaction.sender.phone
  const otherPartyPhone = isSender ? transaction.recipient.phone : transaction.sender.phone

  // Generate receipt HTML
  const receiptHTML = `
        <div class="robotic-receipt" id="receipt-for-download">
            <div class="receipt-robot">
                <div class="receipt-robot-head">
                    <div class="receipt-robot-eye left"></div>
                    <div class="receipt-robot-eye right"></div>
                </div>
                <div class="receipt-robot-body"></div>
            </div>
            <div class="receipt-logo">
                <img src="https://github.com/Opper125/opper-payment/raw/main/logo.png" alt="OPPER Logo">
            </div>
            <div class="receipt-title">ငွေလွှဲပြေစာ</div>
            <div class="receipt-subtitle">OPPER Payment</div>
            
            <div class="receipt-info">
                <div class="receipt-row">
                    <div class="receipt-label">ငွေလွှဲအမှတ်</div>
                    <div class="receipt-value">${transaction.id.substring(0, 8)}</div>
                </div>
                <div class="receipt-row">
                    <div class="receipt-label">ရက်စွဲ</div>
                    <div class="receipt-value">${formatDate(new Date(transaction.created_at))}</div>
                </div>
                <div class="receipt-row">
                    <div class="receipt-label">အချိန်</div>
                    <div class="receipt-value">${formatTime(new Date(transaction.created_at))}</div>
                </div>
                <div class="receipt-row">
                    <div class="receipt-label">${isSender ? "လက်ခံသူ" : "ပေးပို့သူ"}</div>
                    <div class="receipt-value">${otherParty}</div>
                </div>
                <div class="receipt-row">
                    <div class="receipt-label">ဖုန်းနံပါတ်</div>
                    <div class="receipt-value">${otherPartyPhone}</div>
                </div>
                ${
                  transaction.note
                    ? `
                <div class="receipt-row">
                    <div class="receipt-label">မှတ်ချက်</div>
                    <div class="receipt-value">${transaction.note}</div>
                </div>
                `
                    : ""
                }
                <div class="receipt-row">
                    <div class="receipt-label">အခြေအနေ</div>
                    <div class="receipt-value" style="color: var(--success);">အောင်မြင်</div>
                </div>
            </div>
            
            <div class="receipt-divider"></div>
            
            <div class="receipt-total">
                <div>${isSender ? "ပေးပို့ငွေ" : "လက်ခံငွေ"}</div>
                <div>${formatCurrency(transaction.amount)}</div>
            </div>
            
            <div class="receipt-barcode"></div>
            <div class="receipt-serial">OPPER-${transaction.id.substring(0, 10)}</div>
            
            <div class="receipt-footer">
                ဤပြေစာသည် OPPER Payment မှ ထုတ်ပေးသော တရားဝင်ပြေစာဖြစ်ပါသည်။
            </div>
        </div>
    `

  // Set receipt content
  receiptContainer.innerHTML = receiptHTML

  // Show receipt modal
  openModal(receiptModal)
}

// Fetch Announcements
async function fetchAnnouncements() {
  try {
    // Fetch announcements from database
    const { data, error } = await supabase
      .from("announcements")
      .select(`
                *,
                likes:announcement_likes(user_id),
                comments:announcement_comments(*)
            `)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) throw error

    // Store announcements
    announcements = data

    // Render announcements
    renderAnnouncements(data)
  } catch (error) {
    console.error("Error fetching announcements:", error)
    showErrorNotification("ကြေညာချက်များ ရယူရာတွင် အမှားရှိနေပါသည်။")
  }
}

// Render Announcements
function renderAnnouncements(announcements) {
  // Render latest announcement on dashboard
  if (dashboardAnnouncement) {
    if (!announcements || announcements.length === 0) {
      dashboardAnnouncement.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bullhorn"></i>
                    <p>ကြေညာချက်များ မရှိသေးပါ</p>
                </div>
            `
    } else {
      const latestAnnouncement = announcements[0]

      dashboardAnnouncement.innerHTML = `
                <div class="announcement-header">
                    <div class="announcement-title">${latestAnnouncement.title}</div>
                    <div class="announcement-date">${formatDate(new Date(latestAnnouncement.created_at))}</div>
                </div>
                <div class="announcement-content">${latestAnnouncement.content.substring(0, 150)}${latestAnnouncement.content.length > 150 ? "..." : ""}</div>
                <div class="announcement-footer">
                    <div class="announcement-meta">
                        <div class="announcement-meta-item">
                            <i class="far fa-thumbs-up"></i>
                            <span>${latestAnnouncement.likes ? latestAnnouncement.likes.length : 0}</span>
                        </div>
                        <div class="announcement-meta-item">
                            <i class="far fa-comment"></i>
                            <span>${latestAnnouncement.comments ? latestAnnouncement.comments.length : 0}</span>
                        </div>
                    </div>
                    <a href="#" class="announcement-read-more" data-id="${latestAnnouncement.id}">
                        ဆက်လက်ဖတ်ရှုရန် <i class="fas fa-chevron-right"></i>
                    </a>
                </div>
            `

      // Add click event to read more
      dashboardAnnouncement.querySelector(".announcement-read-more").addEventListener("click", (e) => {
        e.preventDefault()
        const announcementId = e.currentTarget.getAttribute("data-id")
        showAnnouncementDetail(announcementId)
      })

      // Make the entire card clickable
      dashboardAnnouncement.addEventListener("click", (e) => {
        if (!e.target.closest(".announcement-read-more")) {
          showAnnouncementDetail(latestAnnouncement.id)
        }
      })
    }
  }

  // Render all announcements on announcements page
  if (announcementsContainer) {
    if (!announcements || announcements.length === 0) {
      announcementsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bullhorn"></i>
                    <p>ကြေညာချက်များ မရှိသေးပါ</p>
                </div>
            `
    } else {
      announcementsContainer.innerHTML = ""

      announcements.forEach((announcement) => {
        const announcementItem = document.createElement("div")
        announcementItem.className = "announcement-item"
        announcementItem.innerHTML = `
                    <div class="announcement-header">
                        <div class="announcement-title">${announcement.title}</div>
                        <div class="announcement-date">${formatDate(new Date(announcement.created_at))}</div>
                    </div>
                    <div class="announcement-content">${announcement.content.substring(0, 200)}${announcement.content.length > 200 ? "..." : ""}</div>
                    <div class="announcement-footer">
                        <div class="announcement-meta">
                            <div class="announcement-meta-item">
                                <i class="far fa-thumbs-up"></i>
                                <span>${announcement.likes ? announcement.likes.length : 0}</span>
                            </div>
                            <div class="announcement-meta-item">
                                <i class="far fa-comment"></i>
                                <span>${announcement.comments ? announcement.comments.length : 0}</span>
                            </div>
                        </div>
                        <a href="#" class="announcement-read-more" data-id="${announcement.id}">
                            ဆက်လက်ဖတ်ရှုရန် <i class="fas fa-chevron-right"></i>
                        </a>
                    </div>
                `

        // Add click event to read more
        announcementItem.querySelector(".announcement-read-more").addEventListener("click", (e) => {
          e.preventDefault()
          const announcementId = e.currentTarget.getAttribute("data-id")
          showAnnouncementDetail(announcementId)
        })

        // Make the entire card clickable
        announcementItem.addEventListener("click", (e) => {
          if (!e.target.closest(".announcement-read-more")) {
            showAnnouncementDetail(announcement.id)
          }
        })

        announcementsContainer.appendChild(announcementItem)
      })
    }
  }
}

// Show Announcement Detail
async function showAnnouncementDetail(announcementId) {
  try {
    // Fetch announcement details
    const { data, error } = await supabase
      .from("announcements")
      .select(`
                *,
                likes:announcement_likes(user_id),
                comments:announcement_comments(
                    *,
                    profile:profiles(full_name, email)
                )
            `)
      .eq("id", announcementId)
      .single()

    if (error) throw error

    // Store current announcement ID
    currentAnnouncementId = announcementId

    // Check if user has liked this announcement
    const userLiked = data.likes.some((like) => like.user_id === currentUser.id)

    // Update like button state
    likeBtn.classList.toggle("active", userLiked)
    likeBtn.innerHTML = `
            <i class="${userLiked ? "fas" : "far"} fa-thumbs-up"></i>
            <span id="like-count">${data.likes.length}</span>
        `

    // Update comment count
    commentCount.textContent = data.comments.length

    // Set announcement details
    document.getElementById("announcement-title").textContent = data.title

    document.getElementById("announcement-detail-container").innerHTML = `
            <div class="announcement-detail-header">
                <div class="announcement-detail-title">${data.title}</div>
                <div class="announcement-detail-meta">
                    <div>${formatDate(new Date(data.created_at))}</div>
                    <div>OPPER Admin</div>
                </div>
            </div>
            ${data.image_url ? `<img src="${data.image_url}" alt="${data.title}" class="announcement-detail-image">` : ""}
            <div class="announcement-detail-content">${data.content}</div>
        `

    // Render comments
    renderComments(data.comments)

    // Show announcement detail modal
    openModal(announcementDetailModal)
  } catch (error) {
    console.error("Error fetching announcement details:", error)
    showErrorNotification("ကြေညာချက်အသေးစိတ် ရယူရာတွင် အမှားရှိနေပါသည်။")
  }
}

// Render Comments
function renderComments(comments) {
  if (!comments || comments.length === 0) {
    commentsList.innerHTML = `
            <div class="empty-state">
                <i class="far fa-comment"></i>
                <p>မှတ်ချက်များ မရှိသေးပါ</p>
            </div>
        `
    return
  }

  commentsList.innerHTML = ""

  // Sort comments by date (newest first)
  comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  comments.forEach((comment) => {
    const commentItem = document.createElement("div")
    commentItem.className = "comment-item"

    const userName = comment.profile.full_name || comment.profile.email || "အကောင့်"
    const userInitial = userName.charAt(0).toUpperCase()

    commentItem.innerHTML = `
            <div class="comment-avatar">${userInitial}</div>
            <div class="comment-content">
                <div class="comment-header">
                    <div class="comment-author">${userName}</div>
                    <div class="comment-time">${formatTimeAgo(new Date(comment.created_at))}</div>
                </div>
                <div class="comment-text">${comment.content}</div>
            </div>
        `

    commentsList.appendChild(commentItem)
  })
}

// Handle Like
async function handleLike() {
  if (!currentAnnouncementId) return

  try {
    const isLiked = likeBtn.classList.contains("active")

    if (isLiked) {
      // Unlike
      const { error } = await supabase
        .from("announcement_likes")
        .delete()
        .eq("announcement_id", currentAnnouncementId)
        .eq("user_id", currentUser.id)

      if (error) throw error

      likeBtn.classList.remove("active")
      likeBtn.querySelector("i").className = "far fa-thumbs-up"

      // Decrement like count
      const currentLikes = Number.parseInt(likeCount.textContent) || 0
      likeCount.textContent = Math.max(0, currentLikes - 1)
    } else {
      // Like
      const { error } = await supabase.from("announcement_likes").insert({
        announcement_id: currentAnnouncementId,
        user_id: currentUser.id,
      })

      if (error) throw error

      likeBtn.classList.add("active")
      likeBtn.querySelector("i").className = "fas fa-thumbs-up"

      // Increment like count
      const currentLikes = Number.parseInt(likeCount.textContent) || 0
      likeCount.textContent = currentLikes + 1
    }
  } catch (error) {
    console.error("Error handling like:", error)
    showErrorNotification("Like လုပ်ဆောင်ရာတွင် အမှားရှိနေပါသည်။")
  }
}

// Submit Comment
async function submitComment() {
  if (!currentAnnouncementId) return

  const content = commentInput.value.trim()

  if (!content) return

  try {
    // Add comment to database
    const { data, error } = await supabase
      .from("announcement_comments")
      .insert({
        announcement_id: currentAnnouncementId,
        user_id: currentUser.id,
        content,
      })
      .select(`
                *,
                profile:profiles(full_name, email)
            `)
      .single()

    if (error) throw error

    // Clear input
    commentInput.value = ""

    // Add comment to list
    const commentItem = document.createElement("div")
    commentItem.className = "comment-item"

    const userName = data.profile.full_name || data.profile.email || "အကောင့်"
    const userInitial = userName.charAt(0).toUpperCase()

    commentItem.innerHTML = `
            <div class="comment-avatar">${userInitial}</div>
            <div class="comment-content">
                <div class="comment-header">
                    <div class="comment-author">${userName}</div>
                    <div class="comment-time">ယခုအတွင်း</div>
                </div>
                <div class="comment-text">${data.content}</div>
            </div>
        `

    // Remove empty state if it exists
    const emptyState = commentsList.querySelector(".empty-state")
    if (emptyState) {
      emptyState.remove()
    }

    commentsList.insertBefore(commentItem, commentsList.firstChild)

    // Increment comment count
    const currentComments = Number.parseInt(commentCount.textContent) || 0
    commentCount.textContent = currentComments + 1
  } catch (error) {
    console.error("Error submitting comment:", error)
    showErrorNotification("မှတ်ချက်ပေးရာတွင် အမှားရှိနေပါသည်။")
  }
}

// Fetch Media
async function fetchMedia() {
  try {
    // Fetch media from database
    const { data, error } = await supabase.from("media").select("*").order("created_at", { ascending: false }).limit(20)

    if (error) throw error

    // Store media
    media = data

    // Render media
    renderMedia(data)
  } catch (error) {
    console.error("Error fetching media:", error)
    showErrorNotification("မီဒီယာများ ရယူရာတွင် အမှားရှိနေပါသည်။")
  }
}

// Render Media
function renderMedia(mediaItems, type = "all") {
  if (!mediaGrid) return

  // Filter media by type if specified
  let filteredMedia = mediaItems
  if (type !== "all") {
    filteredMedia = mediaItems.filter((item) => item.type === type)
  }

  if (!filteredMedia || filteredMedia.length === 0) {
    mediaGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-photo-video"></i>
                <p>မီဒီယာများ မရှိသေးပါ</p>
            </div>
        `
    return
  }

  mediaGrid.innerHTML = ""

  filteredMedia.forEach((item) => {
    const mediaItem = document.createElement("div")
    mediaItem.className = "media-item"

    const isVideo = item.type === "video"

    mediaItem.innerHTML = `
            <div class="media-thumbnail">
                <img src="${item.thumbnail_url || item.url}" alt="${item.title}">
                <div class="media-type-badge">${isVideo ? "ဗီဒီယို" : "ဓာတ်ပုံ"}</div>
                ${
                  isVideo
                    ? `
                <div class="media-play-button">
                    <i class="fas fa-play"></i>
                </div>
                `
                    : ""
                }
            </div>
            <div class="media-info">
                <div class="media-title">${item.title}</div>
                <div class="media-date">${formatDate(new Date(item.created_at))}</div>
            </div>
        `

    // Add click event to show media
    mediaItem.addEventListener("click", () => {
      showMediaViewer(item)
    })

    mediaGrid.appendChild(mediaItem)
  })
}

// Show Media Viewer
function showMediaViewer(media) {
  document.getElementById("media-title").textContent = media.title

  const viewerContainer = document.getElementById("media-viewer-container")

  if (media.type === "video") {
    viewerContainer.innerHTML = `
            <video controls autoplay>
                <source src="${media.url}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `
  } else {
    viewerContainer.innerHTML = `
            <img src="${media.url}" alt="${media.title}">
        `
  }

  openModal(mediaViewerModal)
}

// Refresh Dashboard
function refreshDashboard() {
  refreshBalance()
  fetchTransactions()
  fetchAnnouncements()
}

// Refresh Transactions
function refreshTransactions(type = "all", dateRange = "all") {
  if (transactions) {
    renderTransactions(transactions, "history", type, dateRange)
  } else {
    fetchTransactions()
  }
}

// Refresh Announcements
function refreshAnnouncements() {
  fetchAnnouncements()
}

// Refresh Media
function refreshMedia(type = "all") {
  if (media) {
    renderMedia(media, type)
  } else {
    fetchMedia()
  }
}

// Subscribe to Realtime Updates
function subscribeToRealtimeUpdates() {
    // Unsubscribe from any existing subscription
    if (realtimeSubscription) {
        realtimeSubscription.unsubscribe();
    }
    
    // Subscribe to profiles table for balance updates
    realtimeSubscription = supabase
        .channel('schema-db-changes')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `user_id=eq.${currentUser.id}`
        }, payload => {
            // Update balance if changed
            if (payload.new.balance !== userBalance) {
                const oldBalance = userBalance;
                updateBalance(payload.new.balance);
                
                // Show notification for balance change
                const difference = payload.new.balance - oldBalance;
                if (difference > 0) {
                    showSuccessNotification(`${formatCurrency(difference)} ရရှိပါသည်။`);
                    playSound(moneyReceivedSound);
                }
            }
            
            // Update KYC status if changed
            if (payload.new.kyc_status !== userKycStatus) {
                updateKycStatus(payload.new.kyc_status);
                
                // Show notification for KYC status change
                if (payload.new.kyc_status === "approved") {
                    showSuccessNotification("သင့် KYC အတည်ပြုချက် အောင်မြင်ပါသည်။");
                } else if (payload.new.kyc_status === "rejected") {
                    showErrorNotification("သင့် KYC အတည်ပြုချက် ငြင်းပယ်ခံရပါသည်။");
                }
            }
            
            // Update transfer status if changed
            if (payload.new.transfer_enabled !== userTransferStatus) {
                updateTransferStatus(payload.new.transfer_enabled);
                
                // Show notification for transfer status change
                if (payload.new.transfer_enabled) {
                    showSuccessNotification("သင့်ငွေလွှဲခြင်း လုပ်ဆောင်ချက် ပြန်လည်ဖွင့်ပြီးပါပြီ။");
                } else {
                    showErrorNotification("သင့်ငွေလွှဲခြင်း လုပ်ဆောင်ချက် ယာယီပိတ်ထားပါသည်။");
                }
            }
        })
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions',
            filter: `recipient_id=eq.${currentUser.id}`
        }, payload => {
