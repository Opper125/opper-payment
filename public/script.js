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
const imgurClientId = "5befa9dd970c7d0"

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

  // Check if user is logged in
  await checkSession()

  // Initialize UI elements
  initializeUI()

  // Hide loader after initialization
  setTimeout(hideLoader, 1500)
})

// Check if user is logged in
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
      showAppContainer()
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
      updateTransferStatus()
    }

    // Set up realtime subscriptions
    setupRealtimeSubscriptions()

    // Load transactions
    loadTransactions()
  } catch (error) {
    console.error("Load user data error:", error)
  }
}

// Update profile images in UI
function updateProfileImages(imageUrl) {
  const profileImages = document.querySelectorAll(".profile-image")
  profileImages.forEach((img) => {
    img.src = imageUrl
    img.style.display = "block"
  })

  // Hide initials when profile image is available
  const userInitials = document.querySelectorAll(".user-initial-container")
  userInitials.forEach((initial) => {
    initial.style.display = "none"
  })
}

// Update UI with user data
function updateUserUI(userData) {
  // Update user name and ID in header and sidebar
  const userInitial = currentUser.email.charAt(0).toUpperCase()
  const userName = currentUser.email.split("@")[0]

  document.getElementById("user-initial").textContent = userInitial
  document.getElementById("user-initial-sidebar").textContent = userInitial
  document.getElementById("user-name").textContent = userName
  document.getElementById("user-name-sidebar").textContent = userName
  document.getElementById("user-id").textContent = `ID: ${currentUser.user_id}`
  document.getElementById("user-id-sidebar").textContent = `ID: ${currentUser.user_id}`
  document.getElementById("greeting-name").textContent = userName

  // Update balance
  document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`
  document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`

  // Update KYC status
  updateKycStatus()

  // Update settings page
  document.getElementById("settings-phone").value = userData.phone || ""
  document.getElementById("settings-email").value = currentUser.email || ""

  // Update profile image if available
  if (userData.profile_image) {
    updateProfileImages(userData.profile_image)

    // Update profile picture preview in settings
    const profilePicturePreview = document.getElementById("profile-picture-preview")
    if (profilePicturePreview) {
      profilePicturePreview.innerHTML = `<img src="${userData.profile_image}" alt="Profile Picture">`
    }
  }
}

// Update KYC status in UI
function updateKycStatus() {
  const kycStatusElement = document.getElementById("kyc-status")
  const kycStatusCard = document.getElementById("kyc-status-card")
  const kycForm = document.getElementById("kyc-form")
  const kycStatusMessage = document.getElementById("kyc-status-message")
  const kycStatusIcon = document.querySelector(".kyc-status-icon")

  // Remove all status classes
  kycStatusIcon.classList.remove("pending", "approved", "rejected")

  // Update based on status
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

    // Check if KYC data exists
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

// Update transfer status in UI
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

// Set up realtime subscriptions
function setupRealtimeSubscriptions() {
  // Subscribe to user balance changes
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
        // Update balance if changed
        if (payload.new.balance !== userBalance) {
          userBalance = payload.new.balance
          document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`
          document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`
        }

        // Update KYC status if changed
        if (payload.new.passport_status !== userKycStatus) {
          userKycStatus = payload.new.passport_status
          updateKycStatus()
        }
      },
    )
    .subscribe()

  // Subscribe to system settings changes
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

  // Subscribe to new transactions
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
        // Check if transaction involves current user
        if (
          currentUser &&
          (payload.new.from_phone === currentUser.phone || payload.new.to_phone === currentUser.phone)
        ) {
          // Refresh transactions list
          loadTransactions()
        }
      },
    )
    .subscribe()
}

// Load transactions
async function loadTransactions() {
  try {
    if (!currentUser) return

    // Get user phone number
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("phone")
      .eq("user_id", currentUser.user_id)
      .single()

    if (userError || !userData || !userData.phone) return

    const userPhone = userData.phone

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
                    <button class="transaction-view-btn" data-transaction-index="${index}">
                        <i class="fas fa-eye"></i>
                    </button>
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

  // Add event listeners to view buttons
  document.querySelectorAll(".transaction-view-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const transactionIndex = button.getAttribute("data-transaction-index")
      showTransactionReceipt(transactions[transactionIndex])
    })
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
  const pages = document.querySelectorAll(".page")

  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault()
      const pageName = link.getAttribute("data-page")

      // Update active link
      sidebarLinks.forEach((l) => l.parentElement.classList.remove("active"))
      link.parentElement.classList.add("active")

      // Show corresponding page
      pages.forEach((page) => {
        page.classList.remove("active")
        if (page.id === `${pageName}-page`) {
          page.classList.add("active")
        }
      })

      // Close sidebar on mobile
      if (window.innerWidth < 992) {
        document.getElementById("sidebar").classList.remove("active")
      }
    })
  })

  // Quick action cards
  const actionCards = document.querySelectorAll(".action-card")

  actionCards.forEach((card) => {
    card.addEventListener("click", () => {
      const pageName = card.getAttribute("data-page")

      // Update active link in sidebar
      sidebarLinks.forEach((link) => {
        link.parentElement.classList.remove("active")
        if (link.getAttribute("data-page") === pageName) {
          link.parentElement.classList.add("active")
        }
      })

      // Show corresponding page
      pages.forEach((page) => {
        page.classList.remove("active")
        if (page.id === `${pageName}-page`) {
          page.classList.add("active")
        }
      })
    })
  })

  // Mobile menu toggle
  const menuToggle = document.getElementById("menu-toggle")
  const closeSidebar = document.getElementById("close-sidebar")
  const sidebar = document.getElementById("sidebar")

  menuToggle.addEventListener("click", () => {
    sidebar.classList.add("active")
  })

  closeSidebar.addEventListener("click", () => {
    sidebar.classList.remove("active")
  })

  // Profile dropdown
  const profileDropdownTrigger = document.getElementById("profile-dropdown-trigger")
  const profileDropdown = document.getElementById("profile-dropdown")

  profileDropdownTrigger.addEventListener("click", (e) => {
    e.stopPropagation()
    profileDropdown.classList.toggle("active")

    // Position dropdown
    const rect = profileDropdownTrigger.getBoundingClientRect()
    profileDropdown.style.top = `${rect.bottom + 10}px`
    profileDropdown.style.right = `${window.innerWidth - rect.right}px`
  })

  // Close dropdown when clicking outside
  document.addEventListener("click", () => {
    profileDropdown.classList.remove("active")
  })

  // Dropdown actions
  document.getElementById("view-profile").addEventListener("click", () => {
    // Show profile page (settings for now)
    showPage("settings")
  })

  document.getElementById("go-to-settings").addEventListener("click", () => {
    showPage("settings")
  })

  document.getElementById("dropdown-logout").addEventListener("click", () => {
    logout()
  })

  // Logout button
  document.getElementById("logout-btn").addEventListener("click", () => {
    logout()
  })

  // Balance actions
  document.getElementById("refresh-balance").addEventListener("click", async () => {
    await loadUserData()
  })

  document.getElementById("hide-balance").addEventListener("click", () => {
    const balanceAmount = document.getElementById("balance-amount")
    if (balanceAmount.classList.contains("hidden-balance")) {
      balanceAmount.textContent = `${userBalance.toLocaleString()} Ks`
      balanceAmount.classList.remove("hidden-balance")
      document.querySelector("#hide-balance i").classList.remove("fa-eye")
      document.querySelector("#hide-balance i").classList.add("fa-eye-slash")
    } else {
      balanceAmount.textContent = "••••••"
      balanceAmount.classList.add("hidden-balance")
      document.querySelector("#hide-balance i").classList.remove("fa-eye-slash")
      document.querySelector("#hide-balance i").classList.add("fa-eye")
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

  // Profile picture upload
  const profilePictureUpload = document.getElementById("profile-picture-upload")
  if (profilePictureUpload) {
    profilePictureUpload.addEventListener("change", async (e) => {
      const file = e.target.files[0]
      if (!file) return

      const preview = document.getElementById("profile-picture-preview")
      if (preview) {
        // Show loading state
        preview.innerHTML = '<div class="loading-spinner"></div>'

        // Upload to Imgur
        const imageUrl = await uploadToImgur(file)

        if (imageUrl) {
          // Update preview
          preview.innerHTML = `<img src="${imageUrl}" alt="Profile Picture">`

          // Save to database
          if (currentUser) {
            const { error } = await supabase
              .from("users")
              .update({ profile_image: imageUrl })
              .eq("user_id", currentUser.user_id)

            if (error) {
              console.error("Profile image update error:", error)
            } else {
              // Update profile images in UI
              updateProfileImages(imageUrl)
            }
          }
        } else {
          preview.innerHTML = '<div class="upload-error">Upload failed</div>'
        }
      }
    })
  }

  // Theme selector
  const themeOptions = document.querySelectorAll(".theme-option")

  themeOptions.forEach((option) => {
    if (option.getAttribute("data-theme") === currentTheme) {
      option.classList.add("active")
    }

    option.addEventListener("click", () => {
      const theme = option.getAttribute("data-theme")

      // Update active option
      themeOptions.forEach((o) => o.classList.remove("active"))
      option.classList.add("active")

      // Apply theme
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

  // Open modals
  Object.keys(modalTriggers).forEach((triggerId) => {
    const trigger = document.getElementById(triggerId)
    const modalId = modalTriggers[triggerId]

    if (trigger) {
      trigger.addEventListener("click", () => {
        document.getElementById(modalId).classList.add("active")
      })
    }
  })

  // Close modals
  const modalCloseButtons = document.querySelectorAll(".modal-close, .modal-cancel")

  modalCloseButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const modal = button.closest(".modal")
      modal.classList.remove("active")
    })
  })

  // Close modal when clicking outside
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

// Setup PIN inputs
function setupPinInputs() {
  const pinInputs = document.querySelectorAll(".pin-input")

  pinInputs.forEach((input, index) => {
    // Focus next input when a digit is entered
    input.addEventListener("input", (e) => {
      if (e.target.value) {
        const nextInput = pinInputs[index + 1]
        if (nextInput) {
          nextInput.focus()
        }
      }
    })

    // Handle backspace
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !e.target.value) {
        const prevInput = pinInputs[index - 1]
        if (prevInput) {
          prevInput.focus()
        }
      }
    })
  })

  // Confirm PIN button
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

    // Process the transfer with the entered PIN
    processTransfer(pin)
  })
}

// Setup form submissions
function setupFormSubmissions() {
  // Login form
  const loginBtn = document.getElementById("login-btn")

  loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("login-email").value
    const password = document.getElementById("login-password").value
    const errorElement = document.getElementById("login-error")
    const successElement = document.getElementById("login-success")

    // Validate inputs
    if (!email || !password) {
      errorElement.textContent = "အီးမေးလ်နှင့် စကားဝှက် ထည့်ပါ။"
      errorElement.style.display = "block"
      successElement.style.display = "none"
      return
    }

    try {
      // Check if user exists
      const { data: user, error } = await supabase.from("auth_users").select("*").eq("email", email).single()

      if (error || !user) {
        errorElement.textContent = "အကောင့်မတွေ့ရှိပါ။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }

      // Check password
      if (user.password !== password) {
        errorElement.textContent = "စကားဝှက်မှားယွင်းနေပါသည်။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }

      // Login successful
      currentUser = user

      // Save session
      const sessionData = {
        email: user.email,
        user_id: user.user_id,
      }
      localStorage.setItem("opperSession", JSON.stringify(sessionData))

      // Show success message
      errorElement.style.display = "none"
      successElement.textContent = "အကောင့်ဝင်ရောက်နေပါသည်..."
      successElement.style.display = "block"

      // Load user data and show app
      await loadUserData()
      showAppContainer()
    } catch (error) {
      console.error("Login error:", error)
      errorElement.textContent = "အကောင့်ဝင်ရာတွင် အမှားရှိနေပါသည်။"
      errorElement.style.display = "block"
      successElement.style.display = "none"
    }
  })

  // Google login
  const googleLoginBtn = document.getElementById("google-login-btn")

  googleLoginBtn.addEventListener("click", () => {
    // For demo purposes, we'll simulate Google login
    simulateGoogleLogin("login")
  })

  // Signup form
  const signupBtn = document.getElementById("signup-btn")

  signupBtn.addEventListener("click", async () => {
    const email = document.getElementById("signup-email").value
    const phone = document.getElementById("signup-phone").value
    const password = document.getElementById("signup-password").value
    const confirmPassword = document.getElementById("signup-confirm-password").value
    const termsAgree = document.getElementById("terms-agree").checked
    const errorElement = document.getElementById("signup-error")
    const successElement = document.getElementById("signup-success")

    // Validate inputs
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
      // Check if email already exists
      const { data: existingUser, error: checkError } = await supabase
        .from("auth_users")
        .select("email")
        .eq("email", email)
        .single()

      if (existingUser) {
        errorElement.textContent = "ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }

      // Check if phone already exists
      const { data: existingPhone, error: phoneError } = await supabase
        .from("users")
        .select("phone")
        .eq("phone", phone)
        .single()

      if (existingPhone) {
        errorElement.textContent = "ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }

      // Generate user ID (based on email)
      const userId = generateUserId(email)

      // Create auth user
      const { data: authUser, error: authError } = await supabase
        .from("auth_users")
        .insert([
          {
            email,
            password,
            user_id: userId,
          },
        ])
        .select()
        .single()

      if (authError) throw authError

      // Create user profile
      const { data: userProfile, error: profileError } = await supabase
        .from("users")
        .insert([
          {
            user_id: userId,
            phone,
            balance: 0,
            passport_status: "pending",
          },
        ])
        .select()
        .single()

      if (profileError) throw profileError

      // Signup successful
      errorElement.style.display = "none"
      successElement.textContent = "အကောင့်ဖွင့်ပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။"
      successElement.style.display = "block"

      // Clear form
      document.getElementById("signup-email").value = ""
      document.getElementById("signup-phone").value = ""
      document.getElementById("signup-password").value = ""
      document.getElementById("signup-confirm-password").value = ""
      document.getElementById("terms-agree").checked = false

      // Switch to login tab after a delay
      setTimeout(() => {
        document.querySelector('.auth-tab[data-tab="login"]').click()
      }, 2000)
    } catch (error) {
      console.error("Signup error:", error)
      errorElement.textContent = "အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။"
      errorElement.style.display = "block"
      successElement.style.display = "none"
    }
  })

  // Google signup
  const googleSignupBtn = document.getElementById("google-signup-btn")

  googleSignupBtn.addEventListener("click", () => {
    // For demo purposes, we'll simulate Google signup
    simulateGoogleLogin("signup")
  })

  // Transfer form
  const transferBtn = document.getElementById("transfer-btn")
  const transferPhoneInput = document.getElementById("transfer-phone")
  const recipientProfileContainer = document.getElementById("recipient-profile-container")

  // Add phone number lookup
  if (transferPhoneInput) {
    transferPhoneInput.addEventListener("input", async (e) => {
      const phone = e.target.value.trim()

      if (phone.length >= 9) {
        // Look up recipient
        try {
          const { data: recipient, error } = await supabase
            .from("users")
            .select("name, phone, profile_image")
            .eq("phone", phone)
            .single()

          if (recipient && recipientProfileContainer) {
            // Show recipient profile
            let profileHtml = ""

            if (recipient.profile_image) {
              profileHtml = `
                                <div class="recipient-profile approved">
                                    <img src="${recipient.profile_image}" alt="Recipient" class="recipient-image">
                                    <div class="recipient-info">
                                        <div class="recipient-name">${recipient.name || recipient.phone}</div>
                                        <div class="recipient-status">အတည်ပြုပြီးအကောင့်</div>
                                    </div>
                                </div>
                            `
            } else {
              // No profile image, show initials
              const initial = (recipient.name || recipient.phone).charAt(0).toUpperCase()
              profileHtml = `
                                <div class="recipient-profile approved">
                                    <div class="recipient-initial">${initial}</div>
                                    <div class="recipient-info">
                                        <div class="recipient-name">${recipient.name || recipient.phone}</div>
                                        <div class="recipient-status">အတည်ပြုပြီးအကောင့်</div>
                                    </div>
                                </div>
                            `
            }

            recipientProfileContainer.innerHTML = profileHtml
            recipientProfileContainer.style.display = "block"
          } else {
            // No recipient found
            if (recipientProfileContainer) {
              recipientProfileContainer.innerHTML = ""
              recipientProfileContainer.style.display = "none"
            }
          }
        } catch (error) {
          console.error("Recipient lookup error:", error)
          if (recipientProfileContainer) {
            recipientProfileContainer.innerHTML = ""
            recipientProfileContainer.style.display = "none"
          }
        }
      } else {
        // Clear recipient profile
        if (recipientProfileContainer) {
          recipientProfileContainer.innerHTML = ""
          recipientProfileContainer.style.display = "none"
        }
      }
    })
  }

  transferBtn.addEventListener("click", async () => {
    const phone = document.getElementById("transfer-phone").value
    const amount = Number.parseInt(document.getElementById("transfer-amount").value)
    const note = document.getElementById("transfer-note").value
    const errorElement = document.getElementById("transfer-error")
    const successElement = document.getElementById("transfer-success")

    // Validate inputs
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

    try {
      // Check if transfers are enabled
      if (!transfersEnabled) {
        errorElement.textContent = "ငွေလွှဲခြင်းကို ယာယီပိတ်ထားပါသည်။ နောက်မှ ပြန်လည်ကြိုးစားပါ။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }

      // Check if user has KYC approved
      if (userKycStatus !== "approved") {
        errorElement.textContent = "ငွေလွှဲရန် KYC အတည်ပြုရန် လိုအပ်ပါသည်။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }

      // Check balance
      if (userBalance < amount) {
        errorElement.textContent = "လက်ကျန်ငွေ မလုံလောက်ပါ။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }

      // Check if recipient exists
      const { data: userData } = await supabase
        .from("users")
        .select("phone")
        .eq("user_id", currentUser.user_id)
        .single()

      if (userData.phone === phone) {
        errorElement.textContent = "ကိုယ့်ကိုယ်ကို ငွေလွှဲ၍မရပါ။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }

      // Check if recipient account exists
      const { data: recipient, error: recipientError } = await supabase
        .from("users")
        .select("*")
        .eq("phone", phone)
        .single()

      if (recipientError || !recipient) {
        console.log("No account found for phone number:", phone)
        errorElement.textContent = "လက်ခံမည့်သူ မတွေ့ရှိပါ။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }

      console.log("Account found:", recipient)

      // Clear any previous errors
      errorElement.style.display = "none"

      // Show PIN entry modal
      showPinEntryModal()
    } catch (error) {
      console.error("Transfer validation error:", error)
      errorElement.textContent = "ငွေလွှဲရာတွင် အမှားရှိနေပါသည်။"
      errorElement.style.display = "block"
      successElement.style.display = "none"
    }
  })

  // KYC form
  const kycSubmitBtn = document.getElementById("kyc-submit-btn")

  kycSubmitBtn.addEventListener("click", async () => {
    const passportNumber = document.getElementById("kyc-passport").value
    const address = document.getElementById("kyc-address").value
    const pin = document.getElementById("kyc-pin").value
    const confirmPin = document.getElementById("kyc-confirm-pin").value
    const passportFile = document.getElementById("passport-upload").files[0]
    const selfieFile = document.getElementById("selfie-upload").files[0]
    const errorElement = document.getElementById("kyc-error")
    const successElement = document.getElementById("kyc-success")

    // Validate inputs
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
      // Upload passport image
      const passportFileName = `passport_${currentUser.user_id}_${Date.now()}`
      const { data: passportData, error: passportError } = await supabase.storage
        .from("kyc-documents")
        .upload(passportFileName, passportFile)

      if (passportError) throw passportError

      // Get passport URL
      const { data: passportUrl } = await supabase.storage.from("kyc-documents").getPublicUrl(passportFileName)

      // Upload selfie image
      const selfieFileName = `selfie_${currentUser.user_id}_${Date.now()}`
      const { data: selfieData, error: selfieError } = await supabase.storage
        .from("kyc-documents")
        .upload(selfieFileName, selfieFile)

      if (selfieError) throw selfieError

      // Get selfie URL
      const { data: selfieUrl } = await supabase.storage.from("kyc-documents").getPublicUrl(selfieFileName)

      // Update user profile
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

      // KYC submission successful
      errorElement.style.display = "none"
      successElement.textContent = "KYC အချက်အလက်များ အောင်မြင်စွာ တင်သွင်းပြီးပါပြီ။ စိစစ်နေပါပြီ။"
      successElement.style.display = "block"

      // Update KYC status
      userKycStatus = "pending"
      updateKycStatus()

      // Clear form
      document.getElementById("kyc-passport").value = ""
      document.getElementById("kyc-address").value = ""
      document.getElementById("kyc-pin").value = ""
      document.getElementById("kyc-confirm-pin").value = ""
      document.getElementById("passport-upload").value = ""
      document.getElementById("selfie-upload").value = ""
      document.getElementById("passport-preview").innerHTML = ""
      document.getElementById("selfie-preview").innerHTML = ""
    } catch (error) {
      console.error("KYC submission error:", error)
      errorElement.textContent = "KYC တင်သွင်းရာတွင် အမှားရှိနေပါသည်။"
      errorElement.style.display = "block"
      successElement.style.display = "none"
    }
  })

  // Change password form
  const savePasswordBtn = document.getElementById("save-password-btn")

  savePasswordBtn.addEventListener("click", async () => {
    const currentPassword = document.getElementById("current-password").value
    const newPassword = document.getElementById("new-password").value
    const confirmNewPassword = document.getElementById("confirm-new-password").value
    const errorElement = document.getElementById("change-password-error")
    const successElement = document.getElementById("change-password-success")

    // Validate inputs
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
      // Check current password
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

      // Update password
      const { error: updateError } = await supabase
        .from("auth_users")
        .update({ password: newPassword })
        .eq("user_id", currentUser.user_id)

      if (updateError) throw updateError

      // Password change successful
      errorElement.style.display = "none"
      successElement.textContent = "စကားဝှက် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။"
      successElement.style.display = "block"

      // Clear form
      document.getElementById("current-password").value = ""
      document.getElementById("new-password").value = ""
      document.getElementById("confirm-new-password").value = ""

      // Close modal after a delay
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
}

// Show PIN entry modal
function showPinEntryModal() {
  // Clear previous PIN inputs
  document.querySelectorAll(".pin-input").forEach((input) => {
    input.value = ""
  })

  // Clear error message
  document.getElementById("pin-error").style.display = "none"

  // Show modal
  pinEntryModal.classList.add("active")

  // Focus first input
  document.querySelector(".pin-input").focus()
}

// Process transfer with PIN
async function processTransfer(pin) {
  const phone = document.getElementById("transfer-phone").value
  const amount = Number.parseInt(document.getElementById("transfer-amount").value)
  const note = document.getElementById("transfer-note").value
  const errorElement = document.getElementById("transfer-error")
  const successElement = document.getElementById("transfer-success")

  // Hide PIN modal
  pinEntryModal.classList.remove("active")

  // Show processing overlay
  processingOverlay.classList.add("active")

  try {
    // Get sender's data
    const { data: sender, error: senderError } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", currentUser.user_id)
      .single()

    if (senderError) throw senderError

    // Check PIN
    if (sender.payment_pin !== pin) {
      processingOverlay.classList.remove("active")
      errorElement.textContent = "PIN မှားယွင်းနေပါသည်။"
      errorElement.style.display = "block"
      successElement.style.display = "none"
      return
    }

    // Get recipient data
    const { data: recipient, error: recipientError } = await supabase
      .from("users")
      .select("*")
      .eq("phone", phone)
      .single()

    if (recipientError) throw recipientError

    // Generate transaction ID
    const transactionId = `OPPER${Math.floor(1000000 + Math.random() * 9000000)}`

    // Create transaction
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

    // Update sender's balance
    const { error: updateSenderError } = await supabase
      .from("users")
      .update({ balance: sender.balance - amount })
      .eq("user_id", sender.user_id)

    if (updateSenderError) throw updateSenderError

    // Update recipient's balance
    const { error: updateRecipientError } = await supabase
      .from("users")
      .update({ balance: recipient.balance + amount })
      .eq("user_id", recipient.user_id)

    if (updateRecipientError) throw updateRecipientError

    // Update local balance
    userBalance -= amount
    document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`
    document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`

    // Simulate processing time
    setTimeout(() => {
      // Hide processing overlay
      processingOverlay.classList.remove("active")

      // Show success message
      errorElement.style.display = "none"
      successElement.textContent = `${amount.toLocaleString()} Ks ကို ${phone} သို့ အောင်မြင်စွာ လွှဲပြောင်းပြီးပါပြီ။`
      successElement.style.display = "block"

      // Show receipt
      showTransactionReceipt(transaction)

      // Clear form
      document.getElementById("transfer-phone").value = ""
      document.getElementById("transfer-amount").value = ""
      document.getElementById("transfer-note").value = ""

      // Refresh transactions
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
  // Get user phone
  supabase
    .from("users")
    .select("phone")
    .eq("user_id", currentUser.user_id)
    .single()
    .then(({ data: userData }) => {
      if (!userData) return

      const userPhone = userData.phone
      const isSender = transaction.from_phone === userPhone

      // Create receipt HTML
      const receiptHTML = `
                <div class="receipt">
                    <div class="receipt-logo">
                        <div class="receipt-logo-circle">
                            <span class="receipt-logo-text">OPPER</span>
                        </div>
                        <div class="receipt-logo-subtitle">OPPER Pay</div>
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
                            <div class="receipt-detail-value">${new Date(transaction.created_at).toLocaleString()}</div>
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

      // Set receipt content
      document.getElementById("receipt-container").innerHTML = receiptHTML

      // Show receipt modal
      receiptModal.classList.add("active")
    })
}

// Download receipt as PNG
function downloadReceipt() {
  const receiptElement = document.getElementById("receipt-container")

  if (!receiptElement) return

  // Use html2canvas to convert receipt to image
  html2canvas(receiptElement).then((canvas) => {
    // Create download link
    const link = document.createElement("a")
    link.download = `OPPER-Receipt-${Date.now()}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  })
}

// Upload image to Imgur
async function uploadToImgur(file) {
  try {
    const formData = new FormData()
    formData.append("image", file)

    const response = await fetch("https://api.imgur.com/3/image", {
      method: "POST",
      headers: {
        Authorization: `Client-ID ${imgurClientId}`,
      },
      body: formData,
    })

    const result = await response.json()

    if (result.success) {
      return result.data.link
    } else {
      throw new Error("Image upload failed")
    }
  } catch (error) {
    console.error("Imgur upload error:", error)
    return null
  }
}

// Simulate Google login/signup
function simulateGoogleLogin(type) {
  // For demo purposes, we'll use a mock Google account
  const googleEmail = "user@gmail.com"
  const googleName = "User"

  if (type === "login") {
    // Check if account exists
    supabase
      .from("auth_users")
      .select("*")
      .eq("email", googleEmail)
      .single()
      .then(({ data: user, error }) => {
        if (error || !user) {
          // No account found, show error
          const errorElement = document.getElementById("login-error")
          errorElement.textContent = "Google အကောင့်ဖြင့် အကောင့်မတွေ့ရှိပါ။ အကောင့်ဖွင့်ပါ။"
          errorElement.style.display = "block"
          return
        }

        // Login successful
        currentUser = user

        // Save session
        const sessionData = {
          email: user.email,
          user_id: user.user_id,
        }
        localStorage.setItem("opperSession", JSON.stringify(sessionData))

        // Show success message
        const successElement = document.getElementById("login-success")
        successElement.textContent = "Google ဖြင့် အကောင့်ဝင်ရောက်နေပါသည်..."
        successElement.style.display = "block"

        // Load user data and show app
        loadUserData().then(() => {
          showAppContainer()
        })
      })
  } else if (type === "signup") {
    // Check if account already exists
    supabase
      .from("auth_users")
      .select("email")
      .eq("email", googleEmail)
      .single()
      .then(({ data: existingUser, error: checkError }) => {
        if (existingUser) {
          // Account already exists
          const errorElement = document.getElementById("signup-error")
          errorElement.textContent = "ဤ Google အကောင့်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
          errorElement.style.display = "block"
          return
        }

        // Generate user ID
        const userId = generateUserId(googleEmail)

        // Create auth user
        supabase
          .from("auth_users")
          .insert([
            {
              email: googleEmail,
              password: "google-auth", // Special password for Google auth
              user_id: userId,
            },
          ])
          .select()
          .single()
          .then(({ data: authUser, error: authError }) => {
            if (authError) {
              console.error("Google signup error:", authError)
              const errorElement = document.getElementById("signup-error")
              errorElement.textContent = "Google ဖြင့် အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။"
              errorElement.style.display = "block"
              return
            }

            // Create user profile
            supabase
              .from("users")
              .insert([
                {
                  user_id: userId,
                  balance: 0,
                  passport_status: "pending",
                },
              ])
              .then(({ error: profileError }) => {
                if (profileError) {
                  console.error("Google signup profile error:", profileError)
                  const errorElement = document.getElementById("signup-error")
                  errorElement.textContent = "Google ဖြင့် အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။"
                  errorElement.style.display = "block"
                  return
                }

                // Signup successful
                const successElement = document.getElementById("signup-success")
                successElement.textContent = "Google ဖြင့် အကောင့်ဖွင့်ပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။"
                successElement.style.display = "block"

                // Switch to login tab after a delay
                setTimeout(() => {
                  document.querySelector('.auth-tab[data-tab="login"]').click()
                }, 2000)
              })
          })
      })
  }
}

// Generate user ID based on email
function generateUserId(email) {
  // Extract username from email
  const username = email.split("@")[0]

  // Generate random number
  const randomNum = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0")

  // Combine with timestamp
  const timestamp = Date.now().toString().slice(-4)

  // Create user ID
  return `${username.slice(0, 4)}${randomNum}${timestamp}`
}

// Show specific page
function showPage(pageName) {
  // Update active link in sidebar
  const sidebarLinks = document.querySelectorAll(".sidebar-nav a")
  sidebarLinks.forEach((link) => {
    link.parentElement.classList.remove("active")
    if (link.getAttribute("data-page") === pageName) {
      link.parentElement.classList.add("active")
    }
  })

  // Show corresponding page
  const pages = document.querySelectorAll(".page")
  pages.forEach((page) => {
    page.classList.remove("active")
    if (page.id === `${pageName}-page`) {
      page.classList.add("active")
    }
  })

  // Close dropdown
  document.getElementById("profile-dropdown").classList.remove("active")

  // Close sidebar on mobile
  if (window.innerWidth < 992) {
    document.getElementById("sidebar").classList.remove("active")
  }
}

// Logout function
function logout() {
  // Clear session
  localStorage.removeItem("opperSession")
  currentUser = null

  // Show auth container
  showAuthContainer()
}

// Show loader
function showLoader() {
  loader.classList.add("active")
}

// Hide loader
function hideLoader() {
  loader.classList.remove("active")
}

// Show auth container
function showAuthContainer() {
  authContainer.classList.remove("hidden")
  appContainer.classList.add("hidden")
}

// Show app container
function showAppContainer() {
  authContainer.classList.add("hidden")
  appContainer.classList.remove("hidden")
}
