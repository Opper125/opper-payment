// Supabase Configuration
const supabaseUrl = "https://vtsczzlnhsrgnbkfyizi.supabase.co"
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68"
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, { fetch: (...args) => fetch(...args) })

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
const DEFAULT_AVATAR_URL = "https://via.placeholder.com/100?text=User" // Default avatar if none uploaded

// DOM Elements
const loader = document.getElementById("loader")
const authContainer = document.getElementById("auth-container")
const appContainer = document.getElementById("app-container")
const pinEntryModal = document.getElementById("pin-entry-modal")
const receiptModal = document.getElementById("receipt-modal")
const processingOverlay = document.getElementById("processing-overlay")
const confirmationModal = document.getElementById("confirmation-modal")

// Audio Elements
const transferSentSound = document.getElementById("transfer-sent-sound")
const transferReceivedSound = document.getElementById("transfer-received-sound")

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
  document.body.setAttribute("data-theme", currentTheme)
  showLoader()
  await checkSession()
  initializeUI()
  setTimeout(hideLoader, 1500)
})

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

    userProfileData = userData // Store full profile
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

  // Avatar display
  const avatarUrl = userData.avatar_url || ""
  const userAvatarImg = document.getElementById("user-avatar-img")
  const userAvatarImgSidebar = document.getElementById("user-avatar-img-sidebar")
  const userInitialSpan = document.getElementById("user-initial")
  const userInitialSidebarSpan = document.getElementById("user-initial-sidebar")

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
    userInitialSpan.style.display = "flex" // Assuming it's a flex container for centering

    userAvatarImgSidebar.style.display = "none"
    userInitialSidebarSpan.textContent = userInitial
    userInitialSidebarSpan.style.display = "flex"
  }

  document.getElementById("user-name").textContent = userData.name || userName
  document.getElementById("user-name-sidebar").textContent = userData.name || userName
  document.getElementById("user-id").textContent = `ID: ${currentUser.user_id}`
  document.getElementById("user-id-sidebar").textContent = `ID: ${currentUser.user_id}`
  document.getElementById("greeting-name").textContent = userData.name || userName

  document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`
  document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`

  updateKycStatus()

  document.getElementById("settings-phone").value = userData.phone || ""
  document.getElementById("settings-email").value = currentUser.email || ""
}

// Update KYC status in UI
function updateKycStatus() {
  const kycStatusElement = document.getElementById("kyc-status")
  const kycStatusCard = document.getElementById("kyc-status-card")
  const kycForm = document.getElementById("kyc-form")
  const kycStatusMessage = document.getElementById("kyc-status-message")
  const kycStatusIcon = document.querySelector(".kyc-status-icon")
  const kycDetailsApprovedDiv = document.getElementById("kyc-details-approved")

  kycStatusIcon.classList.remove("pending", "approved", "rejected")
  kycDetailsApprovedDiv.style.display = "none"
  kycForm.style.display = "block" // Default to show form

  if (userKycStatus === "approved") {
    kycStatusElement.textContent = "KYC: အတည်ပြုပြီး"
    kycStatusMessage.textContent = "သင့် KYC အတည်ပြုပြီးဖြစ်ပါသည်။"
    kycStatusIcon.classList.add("approved")
    kycStatusIcon.innerHTML = '<i class="fas fa-check-circle"></i>'
    kycForm.style.display = "none"
    displayApprovedKycData() // Display KYC data
  } else if (userKycStatus === "rejected") {
    kycStatusElement.textContent = "KYC: ငြင်းပယ်ခံရသည်"
    kycStatusMessage.textContent = "သင့် KYC ငြင်းပယ်ခံရပါသည်။ ပြန်လည်တင်သွင်းပါ။"
    kycStatusIcon.classList.add("rejected")
    kycStatusIcon.innerHTML = '<i class="fas fa-times-circle"></i>'
  } else {
    // pending or not submitted
    kycStatusElement.textContent = "KYC: စောင့်ဆိုင်းဆဲ"
    kycStatusMessage.textContent = "သင့် KYC စိစစ်နေဆဲဖြစ်ပါသည်။ (သို့မဟုတ်) တင်သွင်းရန်လိုအပ်သည်။"
    kycStatusIcon.classList.add("pending")
    kycStatusIcon.innerHTML = '<i class="fas fa-clock"></i>'

    // Check if KYC data was ever submitted to hide form if pending
    if (userProfileData && userProfileData.passport_number && userProfileData.passport_image) {
      kycForm.style.display = "none" // Hide form if submitted and pending
    }
  }
}

// Display approved KYC data
async function displayApprovedKycData() {
  if (!userProfileData) return

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
        userProfileData = payload.new // Update profile data
        if (payload.new.balance !== userBalance) {
          userBalance = payload.new.balance
          document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`
          document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`
        }
        if (payload.new.passport_status !== userKycStatus) {
          userKycStatus = payload.new.passport_status
          updateKycStatus()
        }
        if (payload.new.avatar_url !== (userProfileData ? userProfileData.avatar_url : "")) {
          updateUserUI(payload.new)
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
          (payload.new.from_phone === userProfileData.phone || payload.new.to_phone === userProfileData.phone)
        ) {
          loadTransactions() // Refresh transactions list
          if (payload.new.to_phone === userProfileData.phone && payload.new.from_phone !== userProfileData.phone) {
            // Only play if I'm receiver AND not sender (self-transfer)
            transferReceivedSound.play().catch((e) => console.warn("Audio play failed:", e))
          }
        }
      },
    )
    .subscribe()
}

// Load transactions
async function loadTransactions() {
  try {
    if (!userProfileData || !userProfileData.phone) return
    const userPhone = userProfileData.phone

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
    const otherPartyPhone = isSender ? transaction.to_phone : transaction.from_phone
    const otherPartyName = isSender ? transaction.to_name : transaction.from_name
    const transactionDate = new Date(transaction.created_at).toLocaleString()

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
                    <button class="transaction-view-btn" data-transaction-index="${index}">
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

// Initialize UI elements
function initializeUI() {
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
      // Update tab indicator position
      const indicator = document.querySelector(".tab-indicator")
      if (tabName === "signup") {
        indicator.style.transform = "translateX(calc(100% + 4px))"
      } else {
        indicator.style.transform = "translateX(0%)"
      }
    })
  })

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

  const sidebarLinks = document.querySelectorAll(".sidebar-nav a")
  const pages = document.querySelectorAll(".page")
  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault()
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
  menuToggle.addEventListener("click", () => sidebar.classList.add("active"))
  closeSidebar.addEventListener("click", () => sidebar.classList.remove("active"))

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

  document.getElementById("view-profile").addEventListener("click", () => showPage("settings"))
  document.getElementById("go-to-settings").addEventListener("click", () => showPage("settings"))
  document.getElementById("dropdown-logout").addEventListener("click", logout)
  document.getElementById("logout-btn").addEventListener("click", logout)

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

  // File input preview (generic for KYC and profile picture)
  const fileInputs = document.querySelectorAll('input[type="file"]')
  fileInputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      const file = e.target.files[0]
      if (!file) return

      const previewId = input.id.replace("-upload", "-preview") // passport-preview, selfie-preview, profile-picture-preview
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
      trigger.addEventListener("click", () => document.getElementById(modalId).classList.add("active"))
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
  document.getElementById("download-receipt").addEventListener("click", downloadReceipt)
  setupFormSubmissions()

  // Event listener for recipient phone input
  const transferPhoneInput = document.getElementById("transfer-phone")
  transferPhoneInput.addEventListener("blur", checkRecipientInfo) // Or 'input' with debounce

  // Event listener for profile picture save
  document.getElementById("save-profile-picture-btn").addEventListener("click", uploadProfilePicture)
  // Event listener for KYC delete button
  document.getElementById("delete-kyc-btn").addEventListener("click", confirmDeleteKyc)
}

// Check recipient information
async function checkRecipientInfo() {
  const phone = document.getElementById("transfer-phone").value
  const recipientInfoDiv = document.getElementById("recipient-info")
  const recipientAvatarImg = document.getElementById("recipient-avatar")
  const recipientNameP = document.getElementById("recipient-name")
  const recipientIdP = document.getElementById("recipient-id")

  if (!phone || phone.length < 7) {
    // Basic validation
    recipientInfoDiv.style.display = "none"
    return
  }

  try {
    const { data: recipient, error } = await supabase
      .from("users")
      .select("user_id, name, avatar_url, phone") // Added phone to check if it's self
      .eq("phone", phone)
      .single()

    if (error || !recipient) {
      recipientInfoDiv.style.display = "block"
      recipientAvatarImg.src = DEFAULT_AVATAR_URL // Default/question mark avatar
      recipientNameP.textContent = "အသုံးပြုသူ မတွေ့ရှိပါ"
      recipientIdP.textContent = ""
      return
    }

    if (recipient.phone === userProfileData.phone) {
      recipientInfoDiv.style.display = "block"
      recipientAvatarImg.src = recipient.avatar_url || DEFAULT_AVATAR_URL
      recipientNameP.textContent = recipient.name || `User ${recipient.user_id.slice(-4)}`
      recipientIdP.textContent = `ID: ${recipient.user_id} (သင်ကိုယ်တိုင်)`
      return
    }

    recipientAvatarImg.src = recipient.avatar_url || DEFAULT_AVATAR_URL
    recipientNameP.textContent = recipient.name || `User ${recipient.user_id.slice(-4)}` // Use part of ID if name is null
    recipientIdP.textContent = `ID: ${recipient.user_id}`
    recipientInfoDiv.style.display = "block"
  } catch (err) {
    console.error("Error checking recipient:", err)
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

  if (!currentUser) {
    errorElement.textContent = "အသုံးပြုသူ အချက်အလက် မတွေ့ရှိပါ"
    errorElement.style.display = "block"
    return
  }

  const fileName = `avatar_${currentUser.user_id}_${Date.now()}.${file.name.split(".").pop()}`

  try {
    showLoader() // Show loader during upload

    // Delete old avatar if exists
    if (userProfileData && userProfileData.avatar_url) {
      const oldFileName = userProfileData.avatar_url.split("/").pop()
      if (oldFileName) {
        await supabase.storage.from("avatars").remove([oldFileName])
      }
    }

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("avatars") // Ensure 'avatars' bucket exists and has correct policies
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
      })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName)
    const avatarUrl = urlData.publicUrl

    const { error: updateError } = await supabase
      .from("users")
      .update({ avatar_url: avatarUrl })
      .eq("user_id", currentUser.user_id)

    if (updateError) throw updateError

    // Update local user data and UI
    if (userProfileData) userProfileData.avatar_url = avatarUrl
    updateUserUI(userProfileData)

    successElement.textContent = "ပရိုဖိုင်ပုံ အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။"
    successElement.style.display = "block"
    fileInput.value = "" // Clear file input
    document.getElementById("profile-picture-preview").innerHTML = ""
  } catch (error) {
    console.error("Profile picture upload error:", error)
    errorElement.textContent = "ပရိုဖိုင်ပုံ တင်ရာတွင် အမှားဖြစ်ပေါ်နေပါသည်။ " + error.message
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

  // Clone and replace button to remove old event listeners
  const oldBtn = confirmActionBtn
  const newBtn = oldBtn.cloneNode(true)
  oldBtn.parentNode.replaceChild(newBtn, oldBtn)

  newBtn.onclick = async () => {
    // Assign directly
    await handleDeleteKyc()
  }
}

// Handle KYC Deletion
async function handleDeleteKyc() {
  const pin = document.getElementById("confirmation-pin").value
  const confirmationError = document.getElementById("confirmation-error")
  const deleteKycError = document.getElementById("delete-kyc-error") // Error for main KYC page
  const deleteKycSuccess = document.getElementById("delete-kyc-success") // Success for main KYC page

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

  try {
    showLoader()
    // Delete images from storage
    const filesToDelete = []
    if (userProfileData.passport_image) {
      filesToDelete.push(userProfileData.passport_image.substring(userProfileData.passport_image.lastIndexOf("/") + 1))
    }
    if (userProfileData.selfie_image) {
      filesToDelete.push(userProfileData.selfie_image.substring(userProfileData.selfie_image.lastIndexOf("/") + 1))
    }

    if (filesToDelete.length > 0) {
      const { error: deleteStorageError } = await supabase.storage.from("kyc-documents").remove(filesToDelete)
      if (deleteStorageError) console.warn("Error deleting KYC documents from storage:", deleteStorageError.message)
    }

    // Clear KYC fields in user table
    const { error: updateError } = await supabase
      .from("users")
      .update({
        passport_number: null,
        address: null,
        passport_image: null,
        selfie_image: null,
        passport_status: "pending", // Or 'not_submitted'
        submitted_at: null,
      })
      .eq("user_id", currentUser.user_id)

    if (updateError) throw updateError

    // Update local state
    userKycStatus = "pending"
    userProfileData.passport_number = null
    userProfileData.address = null
    userProfileData.passport_image = null
    userProfileData.selfie_image = null
    userProfileData.passport_status = "pending"

    updateKycStatus() // This will hide approved details and show form
    confirmationModal.classList.remove("active")
    deleteKycSuccess.textContent = "KYC အချက်အလက်များ အောင်မြင်စွာ ဖျက်သိမ်းပြီးပါပြီ။"
    deleteKycSuccess.style.display = "block"
  } catch (error) {
    console.error("KYC deletion error:", error)
    confirmationModal.classList.remove("active")
    deleteKycError.textContent = "KYC ဖျက်သိမ်းရာတွင် အမှားဖြစ်ပေါ်နေပါသည်။ " + error.message
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
    pinInputs.forEach((input) => (pin += input.value))
    if (pin.length !== 6) {
      document.getElementById("pin-error").textContent = "PIN ၆ လုံး ထည့်ပါ"
      document.getElementById("pin-error").style.display = "block"
      return
    }
    processTransfer(pin)
  })
}

// Setup form submissions
function setupFormSubmissions() {
  const loginBtn = document.getElementById("login-btn")
  loginBtn.addEventListener("click", async () => {
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

  const googleLoginBtn = document.getElementById("google-login-btn")
  googleLoginBtn.addEventListener("click", () => simulateGoogleLogin("login"))

  const signupBtn = document.getElementById("signup-btn")
  signupBtn.addEventListener("click", async () => {
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
      const { data: existingUser } = await supabase.from("auth_users").select("email").eq("email", email).single()
      if (existingUser) {
        errorElement.textContent = "ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }
      const { data: existingPhone } = await supabase.from("users").select("phone").eq("phone", phone).single()
      if (existingPhone) {
        errorElement.textContent = "ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
        errorElement.style.display = "block"
        successElement.style.display = "none"
        return
      }

      const userId = generateUserId(email)
      const { error: authError } = await supabase.from("auth_users").insert([{ email, password, user_id: userId }])
      if (authError) throw authError

      const { error: profileError } = await supabase
        .from("users")
        .insert([{ user_id: userId, phone, balance: 0, passport_status: "pending" }])
      if (profileError) throw profileError

      errorElement.style.display = "none"
      successElement.textContent = "အကောင့်ဖွင့်ပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။"
      successElement.style.display = "block"
      document.getElementById("signup-email").value = ""
      document.getElementById("signup-phone").value = ""
      document.getElementById("signup-password").value = ""
      document.getElementById("signup-confirm-password").value = ""
      document.getElementById("terms-agree").checked = false
      setTimeout(() => document.querySelector('.auth-tab[data-tab="login"]').click(), 2000)
    } catch (error) {
      console.error("Signup error:", error)
      errorElement.textContent = "အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။"
      errorElement.style.display = "block"
      successElement.style.display = "none"
    }
  })

  const googleSignupBtn = document.getElementById("google-signup-btn")
  googleSignupBtn.addEventListener("click", () => simulateGoogleLogin("signup"))

  const transferBtn = document.getElementById("transfer-btn")
  transferBtn.addEventListener("click", async () => {
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
    if (userProfileData.phone === phone) {
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
  kycSubmitBtn.addEventListener("click", async () => {
    const passportNumber = document.getElementById("kyc-passport-input").value
    const address = document.getElementById("kyc-address-input").value
    const pin = document.getElementById("kyc-pin-input").value
    const confirmPin = document.getElementById("kyc-confirm-pin-input").value
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
      showLoader()
      const passportFileName = `passport_${currentUser.user_id}_${Date.now()}`
      const { error: passportError } = await supabase.storage
        .from("kyc-documents")
        .upload(passportFileName, passportFile)
      if (passportError) throw passportError
      const { data: passportUrlData } = supabase.storage.from("kyc-documents").getPublicUrl(passportFileName)

      const selfieFileName = `selfie_${currentUser.user_id}_${Date.now()}`
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

      errorElement.style.display = "none"
      successElement.textContent = "KYC အချက်အလက်များ အောင်မြင်စွာ တင်သွင်းပြီးပါပြီ။ စိစစ်နေပါပြီ။"
      successElement.style.display = "block"
      userKycStatus = "pending"
      if (userProfileData) {
        // Update local cache
        userProfileData.passport_number = passportNumber
        userProfileData.passport_image = passportUrlData.publicUrl
        userProfileData.selfie_image = selfieUrlData.publicUrl
        userProfileData.passport_status = "pending"
      }
      updateKycStatus()
      document.getElementById("kyc-passport-input").value = ""
      document.getElementById("kyc-address-input").value = ""
      document.getElementById("kyc-pin-input").value = ""
      document.getElementById("kyc-confirm-pin-input").value = ""
      document.getElementById("passport-upload").value = ""
      document.getElementById("selfie-upload").value = ""
      document.getElementById("passport-preview").innerHTML = ""
      document.getElementById("selfie-preview").innerHTML = ""
    } catch (error) {
      console.error("KYC submission error:", error)
      errorElement.textContent = "KYC တင်သွင်းရာတွင် အမှားရှိနေပါသည်။"
      errorElement.style.display = "block"
      successElement.style.display = "none"
    } finally {
      hideLoader()
    }
  })

  const savePasswordBtn = document.getElementById("save-password-btn")
  savePasswordBtn.addEventListener("click", async () => {
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
      setTimeout(() => document.getElementById("change-password-modal").classList.remove("active"), 2000)
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
  document.querySelectorAll(".pin-input").forEach((input) => (input.value = ""))
  document.getElementById("pin-error").style.display = "none"
  pinEntryModal.classList.add("active")
  document.querySelector(".pin-input").focus()
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

    userBalance -= amount
    document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`
    document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`

    transferSentSound.play().catch((e) => console.warn("Audio play failed:", e))

    setTimeout(() => {
      processingOverlay.classList.remove("active")
      errorElement.style.display = "none"
      successElement.textContent = `${amount.toLocaleString()} Ks ကို ${phone} သို့ အောင်မြင်စွာ လွှဲပြောင်းပြီးပါပြီ။`
      successElement.style.display = "block"
      showTransactionReceipt(transaction)
      document.getElementById("transfer-phone").value = ""
      document.getElementById("transfer-amount").value = ""
      document.getElementById("transfer-note").value = ""
      document.getElementById("recipient-info").style.display = "none" // Hide recipient info
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

// Mask phone number (show last 4 digits)
function maskPhoneNumber(phone) {
  if (!phone || phone.length <= 4) return phone
  return "••••••" + phone.slice(-4)
}

// Show transaction receipt
function showTransactionReceipt(transaction) {
  if (!userProfileData) return
  const userPhone = userProfileData.phone
  const isSender = transaction.from_phone === userPhone

  const senderPhoneDisplay = isSender ? maskPhoneNumber(transaction.from_phone) : transaction.from_phone
  const recipientPhoneDisplay =
    !isSender && transaction.to_phone === userPhone ? maskPhoneNumber(transaction.to_phone) : transaction.to_phone

  const receiptHTML = `
        <div class="receipt" id="printable-receipt">
            <div class="receipt-logo-area" style="display: flex; justify-content: center; align-items: center; margin-bottom: 20px;">
                <img src="${LOGO_URL}" alt="OPPER Logo" style="width: 50px; height: 50px; object-fit: contain;">
                <span style="font-size: 20px; font-weight: bold; margin-left: 10px; color: var(--primary-solid);">OPPER Pay</span>
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
                    <div class="receipt-detail-value">${transaction.from_name} (${senderPhoneDisplay})</div>
                </div>
                <div class="receipt-detail-row">
                    <div class="receipt-detail-label">To</div>
                    <div class="receipt-detail-value">${transaction.to_name} (${isSender ? transaction.to_phone : recipientPhoneDisplay})</div>
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
  document.getElementById("receipt-container").innerHTML = receiptHTML
  receiptModal.classList.add("active")
}

// Download receipt as PNG
function downloadReceipt() {
  const receiptElement = document.getElementById("printable-receipt") // Target the specific receipt content
  if (!receiptElement) return

  // Ensure images are loaded before rendering canvas
  const images = receiptElement.getElementsByTagName("img")
  const promises = []
  for (let i = 0; i < images.length; i++) {
    if (!images[i].complete) {
      promises.push(
        new Promise((resolve, reject) => {
          images[i].onload = resolve
          images[i].onerror = reject
        }),
      )
    }
  }

  Promise.all(promises)
    .then(() => {
      html2canvas(receiptElement, {
        useCORS: true, // For external images like the logo
        backgroundColor: "#ffffff", // Ensure white background for PNG
      })
        .then((canvas) => {
          const link = document.createElement("a")
          link.download = `OPPER-Receipt-${Date.now()}.png`
          link.href = canvas.toDataURL("image/png")
          link.click()
        })
        .catch((err) => {
          console.error("Error generating receipt image:", err)
          alert("ပြေစာပုံထုတ်ရာတွင် အမှားဖြစ်ပေါ်နေပါသည်။")
        })
    })
    .catch((err) => {
      console.error("Error loading images for receipt:", err)
      alert("ပြေစာအတွက် ပုံများတင်ရာတွင် အမှားဖြစ်ပေါ်နေပါသည်။")
    })
}

// Simulate Google login/signup
function simulateGoogleLogin(type) {
  const googleEmail = "user@gmail.com"
  const googleName = "User"
  if (type === "login") {
    supabase
      .from("auth_users")
      .select("*")
      .eq("email", googleEmail)
      .single()
      .then(({ data: user, error }) => {
        if (error || !user) {
          const errorElement = document.getElementById("login-error")
          errorElement.textContent = "Google အကောင့်ဖြင့် အကောင့်မတွေ့ရှိပါ။ အကောင့်ဖွင့်ပါ။"
          errorElement.style.display = "block"
          return
        }
        currentUser = user
        localStorage.setItem("opperSession", JSON.stringify({ email: user.email, user_id: user.user_id }))
        const successElement = document.getElementById("login-success")
        successElement.textContent = "Google ဖြင့် အကောင့်ဝင်ရောက်နေပါသည်..."
        successElement.style.display = "block"
        loadUserData().then(() => showAppContainer())
      })
  } else if (type === "signup") {
    supabase
      .from("auth_users")
      .select("email")
      .eq("email", googleEmail)
      .single()
      .then(({ data: existingUser }) => {
        if (existingUser) {
          const errorElement = document.getElementById("signup-error")
          errorElement.textContent = "ဤ Google အကောင့်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
          errorElement.style.display = "block"
          return
        }
        const userId = generateUserId(googleEmail)
        supabase
          .from("auth_users")
          .insert([{ email: googleEmail, password: "google-auth", user_id: userId }])
          .select()
          .single()
          .then(({ error: authError }) => {
            if (authError) {
              console.error("Google signup error:", authError)
              const errorElement = document.getElementById("signup-error")
              errorElement.textContent = "Google ဖြင့် အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။"
              errorElement.style.display = "block"
              return
            }
            supabase
              .from("users")
              .insert([{ user_id: userId, balance: 0, passport_status: "pending" }])
              .then(({ error: profileError }) => {
                if (profileError) {
                  console.error("Google signup profile error:", profileError)
                  const errorElement = document.getElementById("signup-error")
                  errorElement.textContent = "Google ဖြင့် အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။"
                  errorElement.style.display = "block"
                  return
                }
                const successElement = document.getElementById("signup-success")
                successElement.textContent = "Google ဖြင့် အကောင့်ဖွင့်ပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။"
                successElement.style.display = "block"
                setTimeout(() => document.querySelector('.auth-tab[data-tab="login"]').click(), 2000)
              })
          })
      })
  }
}

// Generate user ID
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
  userProfileData = null
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
