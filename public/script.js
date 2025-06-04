// Supabase Configuration
const supabaseUrl = "https://vtsczzlnhsrgnbkfyizi.supabase.co"
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68"
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey)

// Global Variables
let currentUser = null
let userBalance = 0
let userKycStatus = "pending"
let transfersEnabled = true
let currentTheme = localStorage.getItem("theme") || "light"
let transactions = []
let announcements = []
let currentGiftBox = null

// DOM Elements
const loader = document.getElementById("loader")
const authContainer = document.getElementById("auth-container")
const appContainer = document.getElementById("app-container")
const pinEntryModal = document.getElementById("pin-entry-modal")
const receiptModal = document.getElementById("receipt-modal")
const processingOverlay = document.getElementById("processing-overlay")
const giftBoxModal = document.getElementById("gift-box-modal")

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[INFO] OPPER Payment System Initializing...")

  // Apply saved theme
  document.body.setAttribute("data-theme", currentTheme)

  // Show intro animation
  setTimeout(() => {
    document.getElementById("intro-animation").style.display = "none"
  }, 3000)

  // Show loader
  showLoader()

  // Check if user is logged in
  await checkSession()

  // Initialize UI elements
  initializeUI()

  // Hide loader after initialization
  setTimeout(hideLoader, 1500)

  console.log("[SUCCESS] OPPER Payment System Initialized")
})

// Check if user is logged in
async function checkSession() {
  try {
    console.log("[INFO] Checking user session...")

    // Check local storage for session
    const session = localStorage.getItem("opperSession")

    if (session) {
      const sessionData = JSON.parse(session)
      console.log("[INFO] Session found, validating...")

      const { data: user, error } = await supabase
        .from("auth_users")
        .select("*")
        .eq("email", sessionData.email)
        .eq("user_id", sessionData.user_id)
        .single()

      if (error || !user) {
        console.log("[WARNING] Invalid session, clearing...")
        localStorage.removeItem("opperSession")
        showAuthContainer()
        return
      }

      // Valid session, load user data
      currentUser = user
      console.log("[SUCCESS] Valid session found for user:", user.email)
      await loadUserData()
      showAppContainer()
    } else {
      console.log("[INFO] No session found, showing auth")
      showAuthContainer()
    }
  } catch (error) {
    console.error("[ERROR] Session check failed:", error)
    showAuthContainer()
  }
}

// Load user data
async function loadUserData() {
  try {
    if (!currentUser) return

    console.log("[INFO] Loading user data...")

    // Get user profile data
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", currentUser.user_id)
      .single()

    if (userError) {
      console.error("[ERROR] Failed to load user data:", userError)
      throw userError
    }

    // Update global variables
    userBalance = userData.balance || 0
    userKycStatus = userData.passport_status || "pending"

    console.log("[SUCCESS] User data loaded:", {
      balance: userBalance,
      kycStatus: userKycStatus,
    })

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

    // Load transactions and announcements
    await loadTransactions()
    await loadAnnouncements()
  } catch (error) {
    console.error("[ERROR] Load user data failed:", error)
    showToast("Failed to load user data", "error")
  }
}

// Load announcements
async function loadAnnouncements() {
  try {
    console.log("[INFO] Loading announcements...")

    const { data: announcementsData, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error) throw error

    announcements = announcementsData || []
    console.log("[SUCCESS] Loaded", announcements.length, "announcements")

    updateAnnouncementsUI()
    updateNotificationCount()
  } catch (error) {
    console.error("[ERROR] Load announcements failed:", error)
    showToast("Failed to load announcements", "error")
  }
}

// Update announcements UI
function updateAnnouncementsUI() {
  const announcementsContainer = document.getElementById("announcements-container")

  if (!announcements || announcements.length === 0) {
    announcementsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bullhorn"></i>
                <p>ကြေငြာများမရှိသေးပါ</p>
            </div>
        `
    return
  }

  let announcementsHTML = ""

  announcements.forEach((announcement) => {
    if (announcement.type === "text") {
      announcementsHTML += createTextAnnouncement(announcement)
    } else if (announcement.type === "image") {
      announcementsHTML += createImageAnnouncement(announcement)
    } else if (announcement.type === "gift_box") {
      announcementsHTML += createGiftBoxAnnouncement(announcement)
    }
  })

  announcementsContainer.innerHTML = announcementsHTML

  // Add event listeners for gift boxes
  document.querySelectorAll(".gift-box-card").forEach((card) => {
    card.addEventListener("click", () => {
      const announcementId = card.getAttribute("data-announcement-id")
      const announcement = announcements.find((a) => a.id == announcementId)
      if (announcement) {
        showGiftBoxModal(announcement)
      }
    })
  })
}

// Create text announcement HTML
function createTextAnnouncement(announcement) {
  const date = new Date(announcement.created_at).toLocaleDateString()

  return `
        <div class="announcement-card text-announcement">
            <div class="announcement-header">
                <div class="announcement-icon">
                    <i class="fas fa-bullhorn"></i>
                </div>
                <div class="announcement-meta">
                    <h3>${announcement.title}</h3>
                    <span class="announcement-date">${date}</span>
                </div>
            </div>
            <div class="announcement-content">
                <p>${announcement.content}</p>
            </div>
        </div>
    `
}

// Create image announcement HTML
function createImageAnnouncement(announcement) {
  const date = new Date(announcement.created_at).toLocaleDateString()

  return `
        <div class="announcement-card image-announcement">
            <div class="announcement-header">
                <div class="announcement-icon">
                    <i class="fas fa-image"></i>
                </div>
                <div class="announcement-meta">
                    <h3>${announcement.title}</h3>
                    <span class="announcement-date">${date}</span>
                </div>
            </div>
            <div class="announcement-content">
                <p>${announcement.content}</p>
                ${announcement.image_url ? `<img src="${announcement.image_url}" alt="${announcement.title}" class="announcement-image">` : ""}
            </div>
        </div>
    `
}

// Create gift box announcement HTML
function createGiftBoxAnnouncement(announcement) {
  const date = new Date(announcement.created_at).toLocaleDateString()
  const progress = (announcement.gift_claimed_count / announcement.gift_user_limit) * 100
  const isFullyClaimed = announcement.gift_claimed_count >= announcement.gift_user_limit

  return `
        <div class="announcement-card gift-box-card ${isFullyClaimed ? "fully-claimed" : ""}" data-announcement-id="${announcement.id}">
            <div class="announcement-header">
                <div class="announcement-icon gift-box-icon">
                    <i class="fas fa-gift"></i>
                    ${!isFullyClaimed ? '<div class="gift-sparkle"></div><div class="gift-sparkle"></div><div class="gift-sparkle"></div>' : ""}
                </div>
                <div class="announcement-meta">
                    <h3>${announcement.title}</h3>
                    <span class="announcement-date">${date}</span>
                </div>
                <div class="gift-status">
                    ${isFullyClaimed ? '<span class="status-closed">ပိတ်ပြီး</span>' : '<span class="status-active">ဖွင့်နေသည်</span>'}
                </div>
            </div>
            <div class="announcement-content">
                <p>${announcement.content}</p>
                <div class="gift-details">
                    <div class="gift-amount-display">
                        <i class="fas fa-coins"></i>
                        <span>${announcement.gift_amount.toLocaleString()} Ks</span>
                    </div>
                    <div class="gift-progress-container">
                        <div class="gift-progress-bar">
                            <div class="gift-progress-fill" style="width: ${progress}%"></div>
                        </div>
                        <div class="gift-progress-text">
                            ${announcement.gift_claimed_count} / ${announcement.gift_user_limit} ယူထားပြီး
                        </div>
                    </div>
                </div>
                ${!isFullyClaimed ? '<div class="gift-claim-hint">နှိပ်၍ လက်ဆောင်ယူပါ!</div>' : ""}
            </div>
        </div>
    `
}

// Show gift box modal
async function showGiftBoxModal(announcement) {
  try {
    currentGiftBox = announcement

    console.log("[INFO] Opening gift box modal for:", announcement.title)

    // Update modal content
    document.getElementById("gift-box-title").textContent = announcement.title
    document.getElementById("gift-box-amount").textContent = `${announcement.gift_amount.toLocaleString()} Ks`
    document.getElementById("gift-claimed-count").textContent = announcement.gift_claimed_count
    document.getElementById("gift-total-limit").textContent = announcement.gift_user_limit

    // Update progress bar
    const progress = (announcement.gift_claimed_count / announcement.gift_user_limit) * 100
    document.getElementById("gift-progress-bar").style.width = `${progress}%`

    // Check if user already claimed
    const { data: existingClaim, error } = await supabase
      .from("gift_claims")
      .select("*")
      .eq("announcement_id", announcement.id)
      .eq("user_id", currentUser.user_id)
      .single()

    const claimBtn = document.getElementById("claim-gift-btn")
    const isFullyClaimed = announcement.gift_claimed_count >= announcement.gift_user_limit

    if (existingClaim) {
      claimBtn.innerHTML = '<i class="fas fa-check"></i><span>ယူပြီးပါပြီ</span>'
      claimBtn.disabled = true
      claimBtn.classList.add("claimed")
    } else if (isFullyClaimed) {
      claimBtn.innerHTML = '<i class="fas fa-times"></i><span>ပြည့်ပြီး</span>'
      claimBtn.disabled = true
      claimBtn.classList.add("disabled")
    } else {
      claimBtn.innerHTML = '<i class="fas fa-gift"></i><span>လက်ဆောင်ယူမည်</span>'
      claimBtn.disabled = false
      claimBtn.classList.remove("claimed", "disabled")
    }

    // Load leaderboard
    await loadGiftLeaderboard(announcement.id)

    // Show modal
    giftBoxModal.classList.add("active")
  } catch (error) {
    console.error("[ERROR] Failed to show gift box modal:", error)
    showToast("Failed to load gift box details", "error")
  }
}

// Load gift leaderboard
async function loadGiftLeaderboard(announcementId) {
  try {
    const { data: leaderboard, error } = await supabase
      .from("gift_claims")
      .select(`
                claimed_amount,
                claimed_at,
                users!inner(phone)
            `)
      .eq("announcement_id", announcementId)
      .order("claimed_at", { ascending: true })
      .limit(10)

    if (error) throw error

    const leaderboardContainer = document.getElementById("gift-leaderboard")

    if (!leaderboard || leaderboard.length === 0) {
      leaderboardContainer.innerHTML = '<p class="no-claims">မည်သူမျှ မယူသေးပါ</p>'
      return
    }

    let leaderboardHTML = '<h4>လက်ဆောင်ယူသူများ</h4><div class="leaderboard-list">'

    leaderboard.forEach((entry, index) => {
      const isKing = index === 0
      const maskedPhone = entry.users.phone
        ? entry.users.phone.replace(/(\d{2})\d{7}(\d{2})/, "$1*******$2")
        : "Unknown"

      leaderboardHTML += `
                <div class="leaderboard-item ${isKing ? "king" : ""}">
                    <div class="rank">
                        ${isKing ? '<i class="fas fa-crown"></i>' : `#${index + 1}`}
                    </div>
                    <div class="user-info">
                        <span class="user-phone">${maskedPhone}</span>
                    </div>
                    <div class="claimed-amount">
                        ${entry.claimed_amount.toLocaleString()} Ks
                    </div>
                </div>
            `
    })

    leaderboardHTML += "</div>"
    leaderboardContainer.innerHTML = leaderboardHTML
  } catch (error) {
    console.error("[ERROR] Load leaderboard failed:", error)
    document.getElementById("gift-leaderboard").innerHTML = '<p class="error">လီဒါဘ���တ် ရယူ၍မရပါ</p>'
  }
}

// Claim gift box
async function claimGiftBox() {
  if (!currentGiftBox || !currentUser) return

  const errorElement = document.getElementById("gift-box-error")
  const successElement = document.getElementById("gift-box-success")
  const claimBtn = document.getElementById("claim-gift-btn")

  console.log("[INFO] Claiming gift box:", currentGiftBox.id)

  // Clear previous messages
  errorElement.style.display = "none"
  successElement.style.display = "none"

  // Disable button and show loading
  claimBtn.disabled = true
  claimBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>ယူနေသည်...</span>'

  try {
    // Check if gift box is still available
    const { data: currentAnnouncement, error: checkError } = await supabase
      .from("announcements")
      .select("gift_claimed_count, gift_user_limit")
      .eq("id", currentGiftBox.id)
      .single()

    if (checkError) throw checkError

    if (currentAnnouncement.gift_claimed_count >= currentAnnouncement.gift_user_limit) {
      throw new Error("Gift box is already fully claimed")
    }

    // Check if user already claimed
    const { data: existingClaim, error: existingError } = await supabase
      .from("gift_claims")
      .select("*")
      .eq("announcement_id", currentGiftBox.id)
      .eq("user_id", currentUser.user_id)
      .single()

    if (existingClaim) {
      throw new Error("You have already claimed this gift")
    }

    // Calculate claim amount (equal distribution)
    const claimAmount = Math.floor(currentGiftBox.gift_amount / currentGiftBox.gift_user_limit)

    // Start transaction
    const { data: userUpdate, error: userError } = await supabase
      .from("users")
      .update({ balance: userBalance + claimAmount })
      .eq("user_id", currentUser.user_id)
      .select()
      .single()

    if (userError) throw userError

    // Create gift claim record
    const { data: claimRecord, error: claimError } = await supabase
      .from("gift_claims")
      .insert([
        {
          announcement_id: currentGiftBox.id,
          user_id: currentUser.user_id,
          claimed_amount: claimAmount,
        },
      ])
      .select()
      .single()

    if (claimError) throw claimError

    // Update announcement claimed count
    const { error: announcementError } = await supabase
      .from("announcements")
      .update({ gift_claimed_count: currentAnnouncement.gift_claimed_count + 1 })
      .eq("id", currentGiftBox.id)

    if (announcementError) throw announcementError

    // Update user balance
    userBalance = userUpdate.balance
    document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`
    document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`

    // Show success message
    successElement.textContent = `လက်ဆောင် ${claimAmount.toLocaleString()} Ks ရရှိပါပြီ!`
    successElement.style.display = "block"

    // Update button
    claimBtn.innerHTML = '<i class="fas fa-check"></i><span>ယူပြီးပါပြီ</span>'
    claimBtn.classList.add("claimed")

    // Trigger claim animation
    const giftBoxModalContent = document.querySelector(".gift-box-modal-content")
    giftBoxModalContent.classList.add("gift-claimed-animation")

    // Add sparkle animations with random positions
    const sparkles = giftBoxModalContent.querySelectorAll(".gift-sparkles .sparkle")
    sparkles.forEach((sparkle) => {
      sparkle.style.setProperty("--x", (Math.random() - 0.5) * 2)
      sparkle.style.setProperty("--y", (Math.random() - 0.5) * 2)
    })

    // Remove animation class after delay
    setTimeout(() => {
      giftBoxModalContent.classList.remove("gift-claimed-animation")
    }, 2000)

    // Play sound
    const giftSound = document.getElementById("gift-claim-sound")
    if (giftSound) {
      giftSound.play().catch(() => {})
    }

    console.log("[SUCCESS] Gift claimed successfully:", claimAmount, "Ks")

    // Reload announcements and leaderboard
    setTimeout(() => {
      loadAnnouncements()
      loadGiftLeaderboard(currentGiftBox.id)
    }, 1000)
  } catch (error) {
    console.error("[ERROR] Claim gift failed:", error)
    errorElement.textContent = error.message || "လက်ဆောင်ယူရာတွင် အမှားရှိနေပါသည်။"
    errorElement.style.display = "block"

    // Reset button
    claimBtn.disabled = false
    claimBtn.innerHTML = '<i class="fas fa-gift"></i><span>လက်ဆောင်ယူမည်</span>'
  }
}

// Update notification count
function updateNotificationCount() {
  const notificationCount = document.querySelector(".notification-badge")
  const activeGiftBoxes = announcements.filter(
    (a) => a.type === "gift_box" && a.gift_claimed_count < a.gift_user_limit,
  ).length

  notificationCount.textContent = activeGiftBoxes

  if (activeGiftBoxes > 0) {
    notificationCount.style.display = "flex"
  } else {
    notificationCount.style.display = "none"
  }
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
  console.log("[INFO] Setting up realtime subscriptions...")

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
        console.log("[INFO] User data updated:", payload.new)

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
        console.log("[INFO] Settings updated:", payload.new)
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
        console.log("[INFO] New transaction:", payload.new)
        // Refresh transactions list
        loadTransactions()
      },
    )
    .subscribe()

  // Subscribe to announcements changes
  const announcementsChannel = supabase
    .channel("announcements-updates")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "announcements",
      },
      (payload) => {
        console.log("[INFO] Announcements updated:", payload)
        // Refresh announcements
        loadAnnouncements()
      },
    )
    .subscribe()

  console.log("[SUCCESS] Realtime subscriptions set up")
}

// Load transactions
async function loadTransactions() {
  try {
    if (!currentUser) return

    console.log("[INFO] Loading transactions...")

    // Get user phone number
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("phone")
      .eq("user_id", currentUser.user_id)
      .single()

    if (userError || !userData || !userData.phone) {
      console.log("[WARNING] User phone not found")
      return
    }

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

    console.log("[SUCCESS] Loaded", transactions.length, "transactions")

    // Update UI with transactions
    updateTransactionsUI(transactions, userPhone)
  } catch (error) {
    console.error("[ERROR] Load transactions failed:", error)
    showToast("Failed to load transactions", "error")
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

  // Gift box claim button
  if (document.getElementById("claim-gift-btn")) {
    document.getElementById("claim-gift-btn").addEventListener("click", claimGiftBox)
  }

  // PIN Input handling
  setupPinInputs()

  // Download receipt button
  if (document.getElementById("download-receipt")) {
    document.getElementById("download-receipt").addEventListener("click", downloadReceipt)
  }

  // Form submissions
  setupFormSubmissions()

  // Notification bell
  const notificationBell = document.querySelector(".notification-bell")
  if (notificationBell) {
    notificationBell.addEventListener("click", () => {
      // Show announcements page
      showPage("announcements")
    })
  }
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
          to_phone: phone,
          amount: amount,
          note: note,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single()

    if (transactionError) throw transactionError

    // Update sender balance
    const { data: updatedSender, error: updateSenderError } = await supabase
      .from("users")
      .update({ balance: sender.balance - amount })
      .eq("user_id", currentUser.user_id)
      .select()
      .single()

    if (updateSenderError) throw updateSenderError

    // Update recipient balance
    const { data: updatedRecipient, error: updateRecipientError } = await supabase
      .from("users")
      .update({ balance: recipient.balance + amount })
      .eq("phone", phone)
      .select()
      .single()

    if (updateRecipientError) throw updateRecipientError

    // Update global balance
    userBalance = updatedSender.balance
    document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`
    document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`

    // Hide processing overlay
    processingOverlay.classList.remove("active")

    // Show success message
    successElement.textContent = "ငွေလွှဲခြင်း အောင်မြင်ပါသည်။"
    successElement.style.display = "block"
    errorElement.style.display = "none"

    // Show receipt
    showTransactionReceipt(transaction)

    // Clear form
    document.getElementById("transfer-phone").value = ""
    document.getElementById("transfer-amount").value = ""
    document.getElementById("transfer-note").value = ""

    // Reload transactions
    loadTransactions()
  } catch (error) {
    console.error("Transfer error:", error)
    processingOverlay.classList.remove("active")
    errorElement.textContent = "ငွေလွှဲရာတွင် အမှားရှိနေပါသည်��"
    errorElement.style.display = "block"
    successElement.style.display = "none"
  }
}

// Show transaction receipt
function showTransactionReceipt(transaction) {
  // Update receipt modal content
  document.getElementById("receipt-id").textContent = transaction.id
  document.getElementById("receipt-date").textContent = new Date(transaction.created_at).toLocaleString()
  document.getElementById("receipt-from").textContent = transaction.from_phone
  document.getElementById("receipt-to").textContent = transaction.to_phone
  document.getElementById("receipt-amount").textContent = `${transaction.amount.toLocaleString()} Ks`
  document.getElementById("receipt-note").textContent = transaction.note || "မှတ်ချက်မရှိပါ"

  // Show receipt modal
  receiptModal.classList.add("active")
}

// Download receipt
function downloadReceipt() {
  const element = document.getElementById("receipt-modal")

  // Generate name of the file
  const filename = "receipt-" + document.getElementById("receipt-id").textContent + ".pdf"

  // Setting up PDF generation
  var opt = {
    margin: 1,
    filename: filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  }

  // Convert HTML to PDF
  html2pdf().from(element).set(opt).save()
}

// Simulate Google login
async function simulateGoogleLogin(type) {
  const email = prompt("Enter your email:")

  if (!email) return

  try {
    // Check if user exists
    const { data: user, error } = await supabase.from("auth_users").select("*").eq("email", email).single()

    if (type === "login") {
      if (error || !user) {
        alert("Account not found. Please sign up.")
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

      // Load user data and show app
      await loadUserData()
      showAppContainer()
    } else if (type === "signup") {
      if (user) {
        alert("Email already exists. Please log in.")
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
            password: "google_login",
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
            phone: "09999999999",
            balance: 0,
            passport_status: "pending",
          },
        ])
        .select()
        .single()

      if (profileError) throw profileError

      alert("Signup successful. Please log in.")
    }
  } catch (error) {
    console.error("Google login error:", error)
    alert("An error occurred. Please try again.")
  }
}

// Generate user ID
function generateUserId(email) {
  return `USER${email.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}`
}

// Show auth container
function showAuthContainer() {
  authContainer.style.display = "flex"
  appContainer.style.display = "none"
}

// Show app container
function showAppContainer() {
  authContainer.style.display = "none"
  appContainer.style.display = "block"
}

// Show loader
function showLoader() {
  loader.style.display = "flex"
}

// Hide loader
function hideLoader() {
  loader.style.display = "none"
}

// Show page
function showPage(pageName) {
  const sidebarLinks = document.querySelectorAll(".sidebar-nav a")
  const pages = document.querySelectorAll(".page")

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
}

// Logout
async function logout() {
  // Clear session
  localStorage.removeItem("opperSession")

  // Reset current user
  currentUser = null

  // Show auth container
  showAuthContainer()
}

// Show toast message
function showToast(message, type = "success") {
  const toastContainer = document.getElementById("toast-container")

  // Create toast element
  const toast = document.createElement("div")
  toast.classList.add("toast", type)
  toast.textContent = message

  // Add to container
  toastContainer.appendChild(toast)

  // Show toast
  setTimeout(() => {
    toast.classList.add("show")
  }, 100)

  // Hide toast after delay
  setTimeout(() => {
    toast.classList.remove("show")
    setTimeout(() => {
      toast.remove()
    }, 300)
  }, 3000)
}

//declare html2pdf
const { jsPDF } = window.jspdf
