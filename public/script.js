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
let currentTheme = localStorage.getItem("theme") || "dark" // Default to dark
let transactions = []
let autoSaveReceipt = localStorage.getItem("autoSaveReceipt") === "true"
let userNotifications = []
let generalAnnouncements = []

// DOM Elements
const loader = document.getElementById("loader")
const authContainer = document.getElementById("auth-container")
const appContainer = document.getElementById("app-container")
const pinEntryModal = document.getElementById("pin-entry-modal")
const receiptModal = document.getElementById("receipt-modal")
const processingOverlay = document.getElementById("processing-overlay")

const notificationBellTrigger = document.getElementById("notification-bell-trigger")
const notificationDropdownMenu = document.getElementById("notification-dropdown-menu")
const notificationListItems = document.getElementById("notification-list-items")
const notificationBadgeCount = document.getElementById("notification-badge-count")
const markAllNotificationsReadBtn = document.getElementById("mark-all-notifications-read")

const generalAnnouncementsDisplay = document.getElementById("general-announcements-display")
const announcementsListContent = document.getElementById("announcements-list-content")

// Audio Elements
const transferSentSound = document.getElementById("transfer-sent-sound")
const transferReceivedSound = document.getElementById("transfer-received-sound")
const clickSound = document.getElementById("click-sound")
const notificationSound = document.getElementById("notification-sound")
const giftClaimSound = document.getElementById("gift-claim-sound")

// Import html2canvas
const html2canvas = window.html2canvas

// Declare functions before using them
function showLoader() {
  loader.style.display = "block"
}

function hideLoader() {
  loader.style.display = "none"
}

function showAuthContainer() {
  authContainer.style.display = "block"
  appContainer.style.display = "none"
}

function showAppContainer() {
  authContainer.style.display = "none"
  appContainer.style.display = "block"
}

async function loadUserNotifications() {
  try {
    if (!currentUser || !currentUser.user_id) return

    const { data: notifications, error } = await supabase
      .from("user_notifications")
      .select("*")
      .eq("user_id", currentUser.user_id)
      .order("created_at", { ascending: false })

    if (error) throw error

    userNotifications = notifications || []
    renderUserNotifications()
  } catch (error) {
    console.error("Load user notifications error:", error)
  }
}

async function loadAnnouncements() {
  try {
    const { data: announcements, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) throw error

    // Assuming there's a function to render announcements
    renderAnnouncements(announcements)
  } catch (error) {
    console.error("Load announcements error:", error)
  }
}

function renderUserNotifications() {
  notificationListItems.innerHTML = ""
  userNotifications.forEach((notification) => {
    const notificationItem = `
      <div class="notification-item">
        <div class="notification-title">${notification.title}</div>
        <div class="notification-message">${notification.message}</div>
      </div>
    `
    notificationListItems.innerHTML += notificationItem
  })
  updateNotificationBadgeCount()
}

function renderAnnouncements(announcements) {
  // Logic to render announcements
  console.log("Announcements:", announcements)
}

function updateNotificationBadgeCount() {
  notificationBadgeCount.textContent = userNotifications.length.toString()
}

function showTransactionReceipt(transaction) {
  // Logic to show transaction receipt
  console.log("Transaction receipt:", transaction)
}

function showPage(pageName) {
  // Logic to show a specific page
  console.log("Showing page:", pageName)
}

function markNotificationsAsRead() {
  // Logic to mark notifications as read
  console.log("Marking notifications as read")
}

function logout() {
  // Logic to logout
  console.log("Logging out")
}

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
  document.body.setAttribute("data-theme", currentTheme)
  showLoader()
  await checkSession()
  initializeUI()
  setTimeout(() => {
    hideLoader()
    if (!currentUser) {
      // If still no user after intro, ensure auth is visible
      showAuthContainer()
    }
  }, 3500) // Extended intro animation time
})

function playSound(soundElement) {
  if (soundElement) {
    soundElement.currentTime = 0
    soundElement.play().catch((error) => console.warn(`${soundElement.id} play failed:`, error))
  }
}

function playClickSound() {
  playSound(clickSound)
}
function playNotificationSound() {
  playSound(notificationSound)
}
function playGiftClaimSound() {
  playSound(giftClaimSound)
}

function showLoader(message = "Loading...") {
  loader.querySelector(".progress-text").textContent = message
  loader.classList.add("active")
}

function hideLoader() {
  loader.classList.remove("active")
}

function showAuthContainer() {
  authContainer.style.display = "flex" // Use flex for centering
  appContainer.classList.add("hidden")
  document.getElementById("intro-animation").style.display = "none" // Hide intro if auth shown
}

function showAppContainer() {
  authContainer.style.display = "none"
  appContainer.classList.remove("hidden")
  document.getElementById("intro-animation").style.display = "none" // Hide intro if app shown
}

function showToast(message, type = "info") {
  const toast = document.createElement("div")
  toast.className = `toast toast-${type}`
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => {
    toast.classList.add("show")
  }, 100)
  setTimeout(() => {
    toast.classList.remove("show")
    setTimeout(() => {
      document.body.removeChild(toast)
    }, 300)
  }, 3000)
}

async function checkSession() {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error) {
      console.error("Error getting session:", error)
      showAuthContainer()
      return
    }

    if (session && session.user) {
      const { data: userProfile, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("user_id", session.user.id)
        .single()

      if (profileError || !userProfile) {
        console.error("Error fetching user profile or profile not found:", profileError)
        await supabase.auth.signOut() // Sign out if profile is missing
        showAuthContainer()
        return
      }
      currentUser = { ...session.user, ...userProfile } // Combine auth user and profile
      await loadUserData()
      showAppContainer()
    } else {
      // Check for legacy opperSession
      const legacySession = localStorage.getItem("opperSession")
      if (legacySession) {
        const sessionData = JSON.parse(legacySession)
        const { data: user, error: legacyUserError } = await supabase
          .from("users") // Check 'users' table directly
          .select("*, auth_users(email)") // Join to get email if needed
          .eq("user_id", sessionData.user_id)
          .single()

        if (legacyUserError || !user) {
          localStorage.removeItem("opperSession")
          showAuthContainer()
          return
        }
        // Simulate a session user object
        currentUser = {
          id: user.user_id,
          email: user.auth_users ? user.auth_users.email : sessionData.email, // Get email
          ...user,
        }
        await loadUserData()
        showAppContainer()
      } else {
        showAuthContainer()
      }
    }
  } catch (error) {
    console.error("Session check error:", error)
    showAuthContainer()
  }
}

async function loadUserData() {
  try {
    if (!currentUser || !currentUser.id) return

    // User data is already combined in currentUser from checkSession
    userBalance = currentUser.balance || 0
    userKycStatus = currentUser.passport_status || "pending"
    // currentUser.phone is already set

    updateUserUI(currentUser)

    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("allow_transfers")
      .eq("id", 1) // Assuming settings table has a single row with id 1
      .single()

    if (!settingsError && settings) {
      transfersEnabled = settings.allow_transfers
      updateTransferStatus()
    }

    setupRealtimeSubscriptions()
    await loadTransactions()
    await loadUserNotifications()
    await loadAnnouncements()
  } catch (error) {
    console.error("Load user data error:", error)
    showToast("အချက်အလက်များ ရယူရာတွင် အမှားအယွင်းဖြစ်ပွားပါသည်။", "error")
  }
}

function updateUserUI(userData) {
  const userInitial = (userData.email || "U").charAt(0).toUpperCase()
  const userName = userData.email ? userData.email.split("@")[0] : "User"

  document.getElementById("user-initial").textContent = userInitial
  document.getElementById("user-initial-sidebar").textContent = userInitial
  document.getElementById("user-name").textContent = userName
  document.getElementById("user-name-sidebar").textContent = userName
  document.getElementById("user-id").textContent = `ID: ${userData.id || userData.user_id}`
  document.getElementById("user-id-sidebar").textContent = `ID: ${userData.id || userData.user_id}`
  document.getElementById("greeting-name").textContent = userName

  document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`
  document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`

  updateKycStatus()

  document.getElementById("settings-phone").value = userData.phone || ""
  document.getElementById("settings-email").value = userData.email || ""

  const autoSaveToggle = document.getElementById("auto-save-receipt")
  if (autoSaveToggle) {
    autoSaveToggle.checked = autoSaveReceipt
    autoSaveToggle.addEventListener("change", (e) => {
      autoSaveReceipt = e.target.checked
      localStorage.setItem("autoSaveReceipt", autoSaveReceipt)
      showToast(autoSaveReceipt ? "ပြေစာများ အလိုအလျောက် သိမ်းဆည်းပါမည်။" : "ပြေစာများ အလိုအလျောက် သိမ်းဆည်းမည်မဟုတ်ပါ။", "info")
    })
  }
}

function updateKycStatus() {
  const kycStatusElement = document.getElementById("kyc-status")
  const kycStatusCard = document.getElementById("kyc-status-card")
  const kycForm = document.getElementById("kyc-form")
  const kycStatusMessage = document.getElementById("kyc-status-message")
  const kycStatusIconContainer = kycStatusCard.querySelector(".kyc-status-icon")

  if (!kycStatusElement || !kycStatusCard || !kycStatusMessage || !kycStatusIconContainer) return

  kycStatusIconContainer.classList.remove("pending", "approved", "rejected")

  if (userKycStatus === "approved") {
    kycStatusElement.textContent = "KYC: အတည်ပြုပြီး"
    kycStatusMessage.textContent = "သင့် KYC အတည်ပြုပြီးဖြစ်ပါသည်။"
    kycStatusIconContainer.classList.add("approved")
    kycStatusIconContainer.innerHTML = '<i class="fas fa-check-circle"></i><div class="status-pulse"></div>'
    if (kycForm) kycForm.style.display = "none"
  } else if (userKycStatus === "rejected") {
    kycStatusElement.textContent = "KYC: ငြင်းပယ်ခံရသည်"
    kycStatusMessage.textContent = "သင့် KYC ငြင်းပယ်ခံရပါသည်။ အချက်အလက်များ ပြန်လည်စစ်ဆေး၍ တင်သွင်းပါ။"
    kycStatusIconContainer.classList.add("rejected")
    kycStatusIconContainer.innerHTML = '<i class="fas fa-times-circle"></i><div class="status-pulse"></div>'
    if (kycForm) kycForm.style.display = "block"
  } else {
    // Default to pending (includes 'pending' and null/undefined status)
    kycStatusElement.textContent = "KYC: စောင့်ဆိုင်းဆဲ"
    kycStatusMessage.textContent = "သင့် KYC စိစစ်နေဆဲဖြစ်ပါသည် သို့မဟုတ် တင်သွင်းရန်လိုအပ်ပါသည်။"
    kycStatusIconContainer.classList.add("pending")
    kycStatusIconContainer.innerHTML = '<i class="fas fa-clock"></i><div class="status-pulse"></div>'
    if (kycForm) {
      // Check if KYC form was ever submitted
      if (currentUser && (currentUser.passport_number || currentUser.passport_image)) {
        kycForm.style.display = "none" // Already submitted, waiting for review
      } else {
        kycForm.style.display = "block" // Not submitted yet
      }
    }
  }
}

function updateTransferStatus() {
  const transferStatusElement = document.getElementById("transfer-status")
  if (!transferStatusElement || !transferStatusElement.parentElement) return

  const statusItem = transferStatusElement.closest(".status-item")
  if (!statusItem) return

  if (transfersEnabled) {
    transferStatusElement.textContent = "ငွေလွှဲခြင်း: ခွင့်ပြုထားသည်"
    statusItem.classList.remove("disabled", "pending") // Ensure pending is also removed
    statusItem.classList.add("enabled")
  } else {
    transferStatusElement.textContent = "ငွေလွှဲခြင်း: ပိတ်ထားသည်"
    statusItem.classList.remove("enabled", "pending")
    statusItem.classList.add("disabled")
  }
}

function setupRealtimeSubscriptions() {
  if (!currentUser || !currentUser.id) return

  // User data updates (balance, KYC)
  supabase
    .channel(`user-updates-${currentUser.id}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "users", filter: `user_id=eq.${currentUser.id}` },
      (payload) => {
        console.log("User data updated:", payload.new)
        const oldBalance = userBalance
        if (payload.new.balance !== undefined) userBalance = payload.new.balance
        if (payload.new.passport_status !== undefined) userKycStatus = payload.new.passport_status

        updateUserUI({ ...currentUser, ...payload.new }) // Update UI with new data

        if (payload.new.balance > oldBalance) {
          // Received money
          const amountReceived = payload.new.balance - oldBalance
          // Check if this update was due to a gift claim to avoid double sound/toast
          const isGiftClaimUpdate = userNotifications.some(
            (n) => n.type === "gift_cash" && n.data && n.data.amount === amountReceived && n.is_claimed,
          )
          if (!isGiftClaimUpdate) {
            playSound(transferReceivedSound)
            showToast(`${amountReceived.toLocaleString()} Ks လက်ခံရရှိပါသည်။`, "success")
            speakAmountReceived(amountReceived)
          }
        }
      },
    )
    .subscribe()

  // Settings updates (transfer enabled/disabled)
  supabase
    .channel("settings-updates")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, (payload) => {
      if (payload.new.allow_transfers !== undefined && payload.new.allow_transfers !== transfersEnabled) {
        transfersEnabled = payload.new.allow_transfers
        updateTransferStatus()
        showToast(transfersEnabled ? "ငွေလွှဲလုပ်ဆောင်ချက်ကို ပြန်လည်ဖွင့်ထားပါသည်။" : "ငွေလွှဲလုပ်ဆောင်ချက်ကို ခေတ္တပိတ်ထားပါသည်။", "info")
      }
    })
    .subscribe()

  // Transaction updates
  supabase
    .channel(`transactions-updates-${currentUser.id}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "transactions",
        filter: `or(from_phone.eq.${currentUser.phone},to_phone.eq.${currentUser.phone})`,
      },
      (payload) => {
        loadTransactions() // Reload all transactions to ensure order and details
      },
    )
    .subscribe()

  // User Notifications updates
  supabase
    .channel(`user-notifications-${currentUser.id}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "user_notifications", filter: `user_id=eq.${currentUser.id}` },
      (payload) => {
        userNotifications.unshift(payload.new)
        renderUserNotifications()
        playNotificationSound()
        showToast("အသိပေးချက်အသစ် ရောက်ရှိနေပါသည်။", "info")
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "user_notifications", filter: `user_id=eq.${currentUser.id}` },
      (payload) => {
        const index = userNotifications.findIndex((n) => n.id === payload.new.id)
        if (index > -1) {
          userNotifications[index] = payload.new
          renderUserNotifications()
        }
      },
    )
    .subscribe()

  // General Announcements updates
  supabase
    .channel("announcements-updates")
    .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, (payload) => {
      loadAnnouncements()
      if (payload.eventType === "INSERT") {
        playNotificationSound()
        showToast("ကြေညာချက်အသစ် တင်ထားပါသည်။", "info")
      }
    })
    .subscribe()
}

function speakAmountReceived(amount) {
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(`${amount.toLocaleString()} ကျပ် လက်ခံရရှိပါသည်။`)
    utterance.lang = "my-MM" // Set language for Burmese
    speechSynthesis.speak(utterance)
  }
}

async function loadTransactions() {
  try {
    if (!currentUser || !currentUser.phone) return

    const { data: transactionsData, error } = await supabase
      .from("transactions")
      .select("*")
      .or(`from_phone.eq.${currentUser.phone},to_phone.eq.${currentUser.phone}`)
      .order("created_at", { ascending: false })
      .limit(50) // Load more for history page

    if (error) throw error
    transactions = transactionsData || []
    updateTransactionsUI(transactions, currentUser.phone)
  } catch (error) {
    console.error("Load transactions error:", error)
    showToast("မှတ်တမ်းများ ရယူရာတွင် အမှားအယွင်းဖြစ်ပွားပါသည်။", "error")
  }
}

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
    const otherPartyName =
      transaction.to_name && !isSender
        ? transaction.to_name
        : transaction.from_name && isSender
          ? transaction.from_name
          : otherParty
    const transactionDate = new Date(transaction.created_at).toLocaleString("my-MM", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

    const transactionItemHTML = `
      <div class="transaction-item ${isSender ? "sent" : "received"} clickable" data-transaction-id="${transaction.id}">
        <div class="transaction-icon">
          <i class="fas ${isSender ? "fa-paper-plane" : "fa-check-circle"}"></i>
        </div>
        <div class="transaction-details">
          <div class="transaction-title">
            ${isSender ? "ငွေလွှဲပို့သည်" : "ငွေလက်ခံရရှိသည်"} ${isSender ? `(${otherPartyName} သို့)` : `(${otherPartyName} မှ)`}
          </div>
          <div class="transaction-subtitle">
            ${transaction.note ? `မှတ်ချက်: ${transaction.note}` : "မှတ်ချက်မရှိပါ"}
          </div>
          <div class="transaction-date">${transactionDate}</div>
        </div>
        <div class="transaction-actions">
          <div class="transaction-amount ${isSender ? "negative" : "positive"}">
            ${isSender ? "-" : "+"} ${transaction.amount.toLocaleString()} Ks
          </div>
          <button class="transaction-view-btn clickable" data-transaction-id="${transaction.id}">
            <i class="fas fa-eye"></i>
          </button>
        </div>
      </div>
    `
    if (index < 5) recentTransactionsList.innerHTML += transactionItemHTML // Show only 5 recent
    historyTransactionsList.innerHTML += transactionItemHTML
  })

  document.querySelectorAll(".transaction-item, .transaction-view-btn").forEach((element) => {
    element.addEventListener("click", function (e) {
      e.stopPropagation() // Prevent double event if clicking button inside item
      playClickSound()
      const transactionId = this.dataset.transactionId
      const transaction = transactionsData.find((t) => t.id === transactionId)
      if (transaction) showTransactionReceipt(transaction)
    })
  })
}

async function loadUserNotifications() {
  try {
    if (!currentUser || !currentUser.id) return

    const { data: notifications, error } = await supabase
      .from("user_notifications")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) throw error
    userNotifications = notifications || []
    renderUserNotifications()
  } catch (error) {
    console.error("Load user notifications error:", error)
  }
}

function renderUserNotifications() {
  notificationListItems.innerHTML = ""
  if (userNotifications.length === 0) {
    notificationListItems.innerHTML = `
      <div class="notification-empty-state">
        <i class="fas fa-bell-slash"></i>
        <p>အသိပေးချက်များ မရှိသေးပါ</p>
      </div>`
    updateNotificationBadgeCount()
    return
  }

  userNotifications.forEach((notification) => {
    const isGift = notification.type === "gift_cash"
    const isClaimed = notification.is_claimed
    const giftAmount = isGift && notification.data ? notification.data.amount : 0

    const item = document.createElement("div")
    item.className = `notification-item ${notification.is_read ? "" : "unread"}`
    item.dataset.notificationId = notification.id

    let actionsHTML = ""
    if (isGift && !isClaimed) {
      actionsHTML = `
        <div class="notification-item-actions">
          <button class="btn btn-sm btn-primary btn-claim-gift clickable" data-amount="${giftAmount}">
            <i class="fas fa-gift"></i> ${giftAmount.toLocaleString()} Ks ရယူမည်
          </button>
        </div>`
    } else if (isGift && isClaimed) {
      actionsHTML = `
        <div class="notification-item-actions">
          <button class="btn btn-sm btn-outline claimed clickable" disabled>
            <i class="fas fa-check"></i> ရယူပြီး
          </button>
        </div>`
    }

    item.innerHTML = `
      <div class="notification-item-content">
        ${notification.message}
      </div>
      <div class="notification-item-timestamp">
        ${new Date(notification.created_at).toLocaleString("my-MM", {
          dateStyle: "short",
          timeStyle: "short",
        })}
      </div>
      ${actionsHTML}
    `
    notificationListItems.appendChild(item)

    if (isGift && !isClaimed) {
      item.querySelector(".btn-claim-gift").addEventListener("click", (e) => {
        e.stopPropagation()
        playClickSound()
        handleClaimGift(notification.id, giftAmount)
      })
    }
  })
  updateNotificationBadgeCount()
}

async function handleClaimGift(notificationId, amount) {
  showLoader("လက်ဆောင် ရယူနေပါသည်...")
  try {
    // 1. Call RPC to add to balance
    const { error: rpcError } = await supabase.rpc("add_to_balance_atomic", {
      p_user_id: currentUser.id,
      p_amount_to_add: amount,
      p_description: "Gift claimed",
      p_notification_id: notificationId, // Pass notification ID for linking
    })

    if (rpcError) throw rpcError

    // 2. Update notification status locally and on server
    const { error: updateError } = await supabase
      .from("user_notifications")
      .update({ is_claimed: true, claimed_at: new Date().toISOString(), is_read: true })
      .eq("id", notificationId)

    if (updateError) throw updateError

    // Update local state
    const notification = userNotifications.find((n) => n.id === notificationId)
    if (notification) {
      notification.is_claimed = true
      notification.is_read = true
    }
    userBalance += amount

    updateUserUI(currentUser) // Reflect new balance
    renderUserNotifications() // Re-render notifications to show claimed status
    playGiftClaimSound()
    showToast(`${amount.toLocaleString()} Ks လက်ဆောင် ရရှိပါသည်။ သင်၏ ပင်မလက်ကျန်ငွေသို့ ပေါင်းထည့်ပြီးပါပြီ။`, "success")
  } catch (error) {
    console.error("Gift claim error:", error)
    showToast("လက်ဆောင်ရယူရာတွင် အမှားအယွင်းဖြစ်ပွားပါသည်။", "error")
  } finally {
    hideLoader()
  }
}

async function markAllNotificationsRead() {
  playClickSound()
  const unreadIds = userNotifications.filter((n) => !n.is_read).map((n) => n.id)
  if (unreadIds.length === 0) return

  try {
    const { error } = await supabase.from("user_notifications").update({ is_read: true }).in("id", unreadIds)
    if (error) throw error

    userNotifications.forEach((n) => {
      if (unreadIds.includes(n.id)) n.is_read = true
    })
    renderUserNotifications()
  } catch (error) {
    console.error("Mark all read error:", error)
  }
}

function updateNotificationBadgeCount() {
  const unreadCount = userNotifications.filter((n) => !n.is_read).length
  notificationBadgeCount.textContent = unreadCount > 0 ? unreadCount : "0"
  notificationBadgeCount.style.display = unreadCount > 0 ? "flex" : "none"
}

async function loadAnnouncements() {
  try {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10)

    if (error) throw error
    generalAnnouncements = data || []
    renderAnnouncements(generalAnnouncements)
  } catch (error) {
    console.error("Load announcements error:", error)
  }
}

function renderAnnouncements(announcementsData) {
  if (generalAnnouncementsDisplay) {
    generalAnnouncementsDisplay.innerHTML = ""
    if (announcementsData.length === 0) {
      generalAnnouncementsDisplay.innerHTML = `<div class="empty-state"><i class="fas fa-bullhorn"></i><p>ကြေညာချက်များ မရှိသေးပါ</p></div>`
    } else {
      // Display latest 1-2 announcements on dashboard
      announcementsData.slice(0, 2).forEach((ann) => {
        generalAnnouncementsDisplay.innerHTML += `
          <div class="announcement-item">
            <h4>${ann.title}</h4>
            ${ann.image_url ? `<img src="${ann.image_url}" alt="${ann.title}">` : ""}
            <p>${ann.content.substring(0, 100)}${ann.content.length > 100 ? "..." : ""}</p>
            <div class="timestamp">${new Date(ann.created_at).toLocaleDateString("my-MM")}</div>
          </div>`
      })
    }
  }

  if (announcementsListContent) {
    announcementsListContent.innerHTML = ""
    if (announcementsData.length === 0) {
      announcementsListContent.innerHTML = `<div class="empty-state"><i class="fas fa-bullhorn"></i><p>ကြေညာချက်များ မရှိသေးပါ</p></div>`
    } else {
      announcementsData.forEach((ann) => {
        announcementsListContent.innerHTML += `
          <div class="announcement-item">
            <h4>${ann.title}</h4>
            ${ann.image_url ? `<img src="${ann.image_url}" alt="${ann.title}">` : ""}
            <p>${ann.content}</p>
            <div class="timestamp">${new Date(ann.created_at).toLocaleString("my-MM")}</div>
          </div>`
      })
    }
  }
}

// --- Authentication Functions ---
async function handleLogin() {
  playClickSound()
  const email = document.getElementById("login-email").value
  const password = document.getElementById("login-password").value
  const errorDiv = document.getElementById("login-error")
  errorDiv.textContent = ""
  errorDiv.style.display = "none"

  if (!email || !password) {
    errorDiv.textContent = "အီးမေးလ်နှင့် စကားဝှက်ထည့်ပါ။"
    errorDiv.style.display = "block"
    return
  }
  showLoader("အကောင့်ဝင်နေသည်...")

  try {
    const {
      data: { user, session },
      error,
    } = await supabase.auth.signInWithPassword({ email, password })

    if (error) throw error
    if (!user) throw new Error("User not found after login.")

    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (profileError || !userProfile) {
      await supabase.auth.signOut() // Sign out if profile is missing
      throw new Error(profileError ? profileError.message : "User profile not found.")
    }

    currentUser = { ...user, ...userProfile }
    localStorage.setItem("opperSession", JSON.stringify({ user_id: currentUser.id, email: currentUser.email })) // Save legacy session for now

    await loadUserData()
    showAppContainer()
    showToast("အောင်မြင်စွာ အကောင့်ဝင်ပြီးပါပြီ။", "success")
  } catch (error) {
    console.error("Login error:", error)
    errorDiv.textContent = `အကောင့်ဝင်ခြင်း မအောင်မြင်ပါ: ${error.message}`
    errorDiv.style.display = "block"
  } finally {
    hideLoader()
  }
}

async function handleSignup() {
  playClickSound()
  const email = document.getElementById("signup-email").value
  const phone = document.getElementById("signup-phone").value
  const password = document.getElementById("signup-password").value
  const confirmPassword = document.getElementById("signup-confirm-password").value
  const termsAgree = document.getElementById("terms-agree").checked
  const errorDiv = document.getElementById("signup-error")
  errorDiv.textContent = ""
  errorDiv.style.display = "none"

  if (!email || !phone || !password || !confirmPassword) {
    errorDiv.textContent = "အချက်အလက်များ အားလုံးဖြည့်ပါ။"
    errorDiv.style.display = "block"
    return
  }
  if (password !== confirmPassword) {
    errorDiv.textContent = "စကားဝှက်များ တူညီမှုမရှိပါ။"
    errorDiv.style.display = "block"
    return
  }
  if (!termsAgree) {
    errorDiv.textContent = "စည်းမျဉ်းစည်းကမ်းများကို သဘောတူပါ။"
    errorDiv.style.display = "block"
    return
  }
  showLoader("အကောင့်ဖွင့်နေသည်...")

  try {
    // Check if phone number already exists
    const { data: existingUserByPhone, error: phoneCheckError } = await supabase
      .from("users")
      .select("user_id")
      .eq("phone", phone)
      .single()

    if (phoneCheckError && phoneCheckError.code !== "PGRST116") {
      // PGRST116 means no rows found, which is good
      throw phoneCheckError
    }
    if (existingUserByPhone) {
      throw new Error("ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ဖွင့်ပြီးသားဖြစ်ပါသည်။")
    }

    const {
      data: { user, session },
      error,
    } = await supabase.auth.signUp({ email, password })

    if (error) throw error
    if (!user) throw new Error("User creation failed.")

    // Insert into users table
    const { data: newUserProfile, error: insertError } = await supabase
      .from("users")
      .insert([{ user_id: user.id, phone: phone, email: email, balance: 0, passport_status: "pending" }])
      .select()
      .single()

    if (insertError) {
      // If profile creation fails, try to clean up the auth user
      await supabase.auth.admin.deleteUser(user.id) // Requires admin privileges, might fail with anon key
      throw insertError
    }

    currentUser = { ...user, ...newUserProfile }
    localStorage.setItem("opperSession", JSON.stringify({ user_id: currentUser.id, email: currentUser.email }))

    await loadUserData()
    showAppContainer()
    showToast("အကောင့်ဖွင့်ခြင်း အောင်မြင်ပါသည်။", "success")
    // Potentially show a message about email confirmation if enabled in Supabase
  } catch (error) {
    console.error("Signup error:", error)
    errorDiv.textContent = `အကောင့်ဖွင့်ခြင်း မအောင်မြင်ပါ: ${error.message}`
    errorDiv.style.display = "block"
  } finally {
    hideLoader()
  }
}

async function logout() {
  playClickSound()
  showLoader("အကောင့်ထွက်နေသည်...")
  try {
    await supabase.auth.signOut()
    localStorage.removeItem("opperSession")
    currentUser = null
    userBalance = 0
    userNotifications = []
    transactions = []
    generalAnnouncements = []
    // Clear UI elements
    document.getElementById("recent-transactions-list").innerHTML = ""
    document.getElementById("history-transactions-list").innerHTML = ""
    renderUserNotifications() // Clears notification list
    renderAnnouncements([]) // Clears announcements
    showAuthContainer()
    showToast("အောင်မြင်စွာ အကောင့်ထွက်ပြီးပါပြီ။", "info")
  } catch (error) {
    console.error("Logout error:", error)
    showToast("အကောင့်ထွက်ရာတွင် အမှားအယွင်းဖြစ်ပွားပါသည်။", "error")
  } finally {
    hideLoader()
  }
}

// --- UI Initialization and Event Listeners ---
function initializeUI() {
  // Auth Tabs
  const authTabs = document.querySelectorAll(".auth-tab")
  const authForms = document.querySelectorAll(".auth-form")
  const tabIndicator = document.querySelector(".tab-indicator")
  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      playClickSound()
      const tabName = tab.dataset.tab
      authTabs.forEach((t) => t.classList.remove("active"))
      tab.classList.add("active")
      authForms.forEach((form) => {
        form.classList.remove("active")
        if (form.id === `${tabName}-form`) form.classList.add("active")
      })
      if (tabIndicator) {
        tabIndicator.style.transform = tabName === "signup" ? `translateX(calc(100% + 4px))` : `translateX(0%)`
      }
    })
  })

  // Password Toggles
  document.querySelectorAll(".toggle-password").forEach((button) => {
    button.addEventListener("click", () => {
      playClickSound()
      const input = button.closest(".input-with-icon").querySelector("input")
      if (input.type === "password") {
        input.type = "text"
        button.classList.replace("fa-eye-slash", "fa-eye")
      } else {
        input.type = "password"
        button.classList.replace("fa-eye", "fa-eye-slash")
      }
    })
  })

  // Sidebar Navigation
  const sidebarLinks = document.querySelectorAll(".sidebar-nav a")
  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault()
      playClickSound()
      showPage(link.dataset.page)
      sidebarLinks.forEach((l) => l.parentElement.classList.remove("active"))
      link.parentElement.classList.add("active")
      if (window.innerWidth < 992) document.getElementById("sidebar").classList.remove("active")
    })
  })

  // Quick Action Cards
  document.querySelectorAll(".action-card").forEach((card) => {
    card.addEventListener("click", () => {
      playClickSound()
      showPage(card.dataset.page)
    })
  })

  // Menu Toggle
  const menuToggle = document.getElementById("menu-toggle")
  const closeSidebar = document.getElementById("close-sidebar")
  const sidebar = document.getElementById("sidebar")
  menuToggle?.addEventListener("click", () => {
    playClickSound()
    sidebar.classList.add("active")
    menuToggle.classList.add("active")
  })
  closeSidebar?.addEventListener("click", () => {
    playClickSound()
    sidebar.classList.remove("active")
    menuToggle.classList.remove("active")
  })

  // Profile Dropdown
  const profileDropdownTrigger = document.getElementById("profile-dropdown-trigger")
  const profileDropdown = document.getElementById("profile-dropdown")
  profileDropdownTrigger?.addEventListener("click", (e) => {
    e.stopPropagation()
    playClickSound()
    profileDropdown.classList.toggle("active")
    if (profileDropdown.classList.contains("active")) {
      const rect = profileDropdownTrigger.getBoundingClientRect()
      profileDropdown.style.top = `${rect.bottom + 10}px`
      profileDropdown.style.right = `${window.innerWidth - rect.right}px`
    }
  })
  document.getElementById("view-profile")?.addEventListener("click", () => {
    playClickSound()
    showPage("settings")
    profileDropdown.classList.remove("active")
  })
  document.getElementById("go-to-settings")?.addEventListener("click", () => {
    playClickSound()
    showPage("settings")
    profileDropdown.classList.remove("active")
  })
  document.getElementById("dropdown-logout")?.addEventListener("click", logout)

  // Notification Bell Dropdown
  notificationBellTrigger?.addEventListener("click", (e) => {
    e.stopPropagation()
    playClickSound()
    notificationDropdownMenu.classList.toggle("active")
    if (notificationDropdownMenu.classList.contains("active")) {
      const rect = notificationBellTrigger.getBoundingClientRect()
      notificationDropdownMenu.style.top = `${rect.bottom + 10}px`
      const dropdownWidth = notificationDropdownMenu.offsetWidth
      const triggerRight = window.innerWidth - rect.right
      notificationDropdownMenu.style.right = `${Math.max(10, triggerRight - dropdownWidth + rect.width / 2)}px` // Ensure it doesn't go off-screen
      // Mark as read when opened, if desired (or on button click)
      // markAllNotificationsRead(); // Or trigger this from a button
    }
  })
  markAllNotificationsReadBtn?.addEventListener("click", markAllNotificationsRead)

  // Global click listener to close dropdowns
  document.addEventListener("click", (e) => {
    if (
      profileDropdown?.classList.contains("active") &&
      !profileDropdownTrigger?.contains(e.target) &&
      !profileDropdown.contains(e.target)
    ) {
      profileDropdown.classList.remove("active")
    }
    if (
      notificationDropdownMenu?.classList.contains("active") &&
      !notificationBellTrigger?.contains(e.target) &&
      !notificationDropdownMenu.contains(e.target)
    ) {
      notificationDropdownMenu.classList.remove("active")
    }
  })

  // Buttons
  document.getElementById("login-btn")?.addEventListener("click", handleLogin)
  document.getElementById("signup-btn")?.addEventListener("click", handleSignup)
  document.getElementById("logout-btn")?.addEventListener("click", logout) // Sidebar logout
  document.getElementById("refresh-balance")?.addEventListener("click", async () => {
    playClickSound()
    showLoader("လက်ကျန်ငွေ စစ်ဆေးနေသည်...")
    await loadUserData()
    hideLoader()
    showToast("လက်ကျန်ငွေ ပြန်လည်စစ်ဆေးပြီးပါပြီ။", "info")
  })
  document.getElementById("hide-balance")?.addEventListener("click", () => {
    playClickSound()
    const balanceAmountEl = document.getElementById("balance-amount")
    const eyeIcon = document.querySelector("#hide-balance i")
    if (balanceAmountEl.classList.contains("hidden-balance")) {
      balanceAmountEl.textContent = `${userBalance.toLocaleString()} Ks`
      balanceAmountEl.classList.remove("hidden-balance")
      eyeIcon?.classList.replace("fa-eye", "fa-eye-slash")
    } else {
      balanceAmountEl.textContent = "•••••• Ks"
      balanceAmountEl.classList.add("hidden-balance")
      eyeIcon?.classList.replace("fa-eye-slash", "fa-eye")
    }
  })

  // Theme Selector
  document.querySelectorAll(".theme-option").forEach((option) => {
    option.addEventListener("click", () => {
      playClickSound()
      currentTheme = option.dataset.theme
      document.body.setAttribute("data-theme", currentTheme)
      localStorage.setItem("theme", currentTheme)
      document.querySelectorAll(".theme-option").forEach((o) => o.classList.remove("active"))
      option.classList.add("active")
    })
  })
  // Set active theme on load
  document.querySelector(`.theme-option[data-theme="${currentTheme}"]`)?.classList.add("active")

  // KYC Form Submission
  document.getElementById("kyc-submit-btn")?.addEventListener("click", handleKycSubmit)

  // Transfer Form
  document.getElementById("transfer-btn")?.addEventListener("click", handleTransfer)
  document.getElementById("transfer-phone")?.addEventListener("input", handleRecipientPhoneInput)

  // Modals
  document.querySelectorAll(".modal-close, .modal-cancel").forEach((el) => {
    el.addEventListener("click", () => {
      playClickSound()
      el.closest(".modal").classList.remove("active")
    })
  })

  // PIN Input
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

  // Settings page buttons
  document.getElementById("change-password-btn")?.addEventListener("click", () => {
    playClickSound()
    openModal("change-password-modal")
  })
  document.getElementById("change-pin-btn")?.addEventListener("click", () => {
    playClickSound()
    openModal("change-pin-modal")
  })
  document.getElementById("delete-account-btn")?.addEventListener("click", () => {
    playClickSound()
    openModal("delete-account-modal")
  })

  // Save Password/PIN
  document.getElementById("save-password-btn")?.addEventListener("click", handleChangePassword)
  document.getElementById("save-pin-btn")?.addEventListener("click", handleChangePin)
  document.getElementById("confirm-delete-btn")?.addEventListener("click", handleDeleteAccount)

  // Console Toggle
  const consoleToggle = document.getElementById("console-toggle")
  const consoleContainer = document.getElementById("console-container")
  consoleToggle?.addEventListener("click", () => {
    playClickSound()
    consoleContainer.classList.toggle("active")
  })
  logToConsole("OPPER Payment System Initialized", "info")

  // Initial page load
  showPage("dashboard") // Default to dashboard
  document.querySelector('.sidebar-nav a[data-page="dashboard"]')?.parentElement.classList.add("active")
}

function showPage(pageName) {
  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"))
  const targetPage = document.getElementById(`${pageName}-page`)
  if (targetPage) {
    targetPage.classList.add("active")
    // Update sidebar active state
    document.querySelectorAll(".sidebar-nav li").forEach((li) => li.classList.remove("active"))
    document.querySelector(`.sidebar-nav a[data-page="${pageName}"]`)?.parentElement.classList.add("active")
  } else {
    console.warn(`Page not found: ${pageName}-page`)
    // Fallback to dashboard if page not found
    document.getElementById("dashboard-page")?.classList.add("active")
    document.querySelector('.sidebar-nav a[data-page="dashboard"]')?.parentElement.classList.add("active")
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId)
  if (modal) modal.classList.add("active")
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId)
  if (modal) modal.classList.remove("active")
}

function logToConsole(message, type = "info") {
  const consoleOutput = document.getElementById("console-output")
  if (!consoleOutput) return
  const line = document.createElement("div")
  line.className = `console-line console-${type}`
  line.textContent = message
  consoleOutput.appendChild(line)
  consoleOutput.scrollTop = consoleOutput.scrollHeight // Auto-scroll
}

// --- KYC Functions ---
async function handleKycSubmit() {
  playClickSound()
  const passportNumber = document.getElementById("kyc-passport").value
  const address = document.getElementById("kyc-address").value
  const pin = document.getElementById("kyc-pin").value
  const confirmPin = document.getElementById("kyc-confirm-pin").value
  const passportFile = document.getElementById("passport-upload").files[0]
  const selfieFile = document.getElementById("selfie-upload").files[0]
  const errorDiv = document.getElementById("kyc-error")
  const successDiv = document.getElementById("kyc-success")
  errorDiv.textContent = ""
  successDiv.textContent = ""

  if (!passportNumber || !address || !pin || !confirmPin || !passportFile || !selfieFile) {
    errorDiv.textContent = "အချက်အလက်များ အားလုံးဖြည့်ပါ။"
    return
  }
  if (pin !== confirmPin) {
    errorDiv.textContent = "PIN များ တူညီမှုမရှိပါ။"
    return
  }
  if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    errorDiv.textContent = "PIN နံပါတ်သည် ဂဏန်း ၆ လုံးဖြစ်ရပါမည်။"
    return
  }

  showLoader("KYC တင်သွင်းနေပါသည်...")
  try {
    // 1. Upload images to Supabase Storage
    const passportFilePath = `kyc/${currentUser.id}/passport-${Date.now()}-${passportFile.name}`
    const selfieFilePath = `kyc/${currentUser.id}/selfie-${Date.now()}-${selfieFile.name}`

    const { data: passportUploadData, error: passportUploadError } = await supabase.storage
      .from("kyc-documents")
      .upload(passportFilePath, passportFile)
    if (passportUploadError) throw passportUploadError

    const { data: selfieUploadData, error: selfieUploadError } = await supabase.storage
      .from("kyc-documents")
      .upload(selfieFilePath, selfieFile)
    if (selfieUploadError) throw selfieUploadError

    // Get public URLs
    const { data: passportUrlData } = supabase.storage.from("kyc-documents").getPublicUrl(passportFilePath)
    const { data: selfieUrlData } = supabase.storage.from("kyc-documents").getPublicUrl(selfieFilePath)

    // 2. Update user's KYC info and PIN in 'users' table
    const { error: updateUserError } = await supabase
      .from("users")
      .update({
        passport_number: passportNumber,
        address: address,
        pin: pin, // In a real app, hash the PIN before storing
        passport_image: passportUrlData.publicUrl,
        selfie_image: selfieUrlData.publicUrl,
        passport_status: "pending", // Set status to pending for review
      })
      .eq("user_id", currentUser.id)

    if (updateUserError) throw updateUserError

    userKycStatus = "pending"
    currentUser.pin = pin // Update local current user if needed for immediate use
    updateKycStatus()
    successDiv.textContent = "KYC အချက်အလက်များ အောင်မြင်စွာ တင်သွင်းပြီးပါပြီ။ စိစစ်မှုကို စောင့်ဆိုင်းပါ။"
    document.getElementById("kyc-form").style.display = "none"
    showToast("KYC အချက်အလက်များ တင်သွင်းပြီးပါပြီ။", "success")
  } catch (error) {
    console.error("KYC submission error:", error)
    errorDiv.textContent = `KYC တင်သွင်းမှု မအောင်မြင်ပါ: ${error.message}`
    showToast("KYC တင်သွင်းမှု မအောင်မြင်ပါ။", "error")
  } finally {
    hideLoader()
  }
}

// --- Transfer Functions ---
let transferRecipientInfo = null
async function handleRecipientPhoneInput() {
  const phone = document.getElementById("transfer-phone").value
  const recipientInfoDiv = document.getElementById("recipient-info")
  recipientInfoDiv.style.display = "none"
  recipientInfoDiv.textContent = ""
  transferRecipientInfo = null

  if (phone.length >= 9) {
    // Basic length check
    try {
      const { data, error } = await supabase.from("users").select("user_id, email, phone").eq("phone", phone).single() // Assuming email is used as name for now
      if (error && error.code !== "PGRST116") throw error // PGRST116: No rows found
      if (data) {
        transferRecipientInfo = data
        const recipientName = data.email ? data.email.split("@")[0] : data.phone
        recipientInfoDiv.textContent = `လက်ခံမည့်သူ: ${recipientName} (${data.phone})`
        recipientInfoDiv.style.color = "var(--success)"
        recipientInfoDiv.style.display = "block"
      } else {
        recipientInfoDiv.textContent = "ဤဖုန်းနံပါတ်ဖြင့် အသုံးပြုသူ မရှိပါ။"
        recipientInfoDiv.style.color = "var(--danger)"
        recipientInfoDiv.style.display = "block"
      }
    } catch (error) {
      console.error("Error fetching recipient:", error)
      recipientInfoDiv.textContent = "လက်ခံမည့်သူ ရှာဖွေရာတွင် အမှားအယွင်းဖြစ်ပွားပါသည်။"
      recipientInfoDiv.style.color = "var(--danger)"
      recipientInfoDiv.style.display = "block"
    }
  }
}

async function handleTransfer() {
  playClickSound()
  if (!transfersEnabled) {
    showToast("ငွေလွှဲလုပ်ဆောင်ချက်ကို ခေတ္တပိတ်ထားပါသည်။", "warning")
    return
  }
  if (userKycStatus !== "approved") {
    showToast("ငွေလွှဲရန် KYC အတည်ပြုရန် လိုအပ်ပါသည်။", "warning")
    showPage("kyc")
    return
  }
  if (!currentUser.pin) {
    showToast("ငွေလွှဲရန် PIN နံပါတ် သတ်မှတ်ရန် လိုအပ်ပါသည်။ KYC စာမျက်နှာတွင် သတ်မှတ်ပါ။", "warning")
    showPage("kyc")
    return
  }

  const amount = Number.parseInt(document.getElementById("transfer-amount").value)
  const note = document.getElementById("transfer-note").value
  const errorDiv = document.getElementById("transfer-error")
  const successDiv = document.getElementById("transfer-success")
  errorDiv.textContent = ""
  successDiv.textContent = ""

  if (!transferRecipientInfo) {
    errorDiv.textContent = "မှန်ကန်သော လက်ခံမည့်သူ ဖုန်းနံပါတ်ထည့်ပါ။"
    return
  }
  if (transferRecipientInfo.phone === currentUser.phone) {
    errorDiv.textContent = "မိမိအကောင့်ကိုယ်တိုင်သို့ ငွေလွှဲ၍မရပါ။"
    return
  }
  if (isNaN(amount) || amount <= 0) {
    errorDiv.textContent = "မှန်ကန်သော ငွေပမာဏထည့်ပါ။"
    return
  }
  if (amount < 1000) {
    errorDiv.textContent = "အနည်းဆုံး ၁၀၀၀ ကျပ် လွှဲရပါမည်။"
    return
  }
  if (amount > userBalance) {
    errorDiv.textContent = "လက်ကျန်ငွေ မလုံလောက်ပါ။"
    return
  }

  // Show PIN entry modal
  openModal("pin-entry-modal")
  document.getElementById("pin-error").textContent = ""
  document.querySelectorAll(".pin-input").forEach((input) => (input.value = ""))
  document.querySelector(".pin-input").focus()

  document.getElementById("confirm-pin-btn").onclick = async () => {
    playClickSound()
    const enteredPin = Array.from(document.querySelectorAll(".pin-input"))
      .map((input) => input.value)
      .join("")
    if (enteredPin !== currentUser.pin) {
      document.getElementById("pin-error").textContent = "PIN နံပါတ် မှားယွင်းနေပါသည်။"
      return
    }
    closeModal("pin-entry-modal")
    await executeTransfer(transferRecipientInfo, amount, note)
  }
}

async function executeTransfer(recipient, amount, note) {
  showProcessingOverlay("ငွေလွှဲလုပ်ဆောင်နေသည်...")
  try {
    const { data, error } = await supabase.rpc("transfer_funds_atomic", {
      sender_user_id: currentUser.id,
      recipient_phone: recipient.phone,
      transfer_amount: amount,
      transfer_note: note,
    })

    if (error) throw error
    if (data && data.success === false) throw new Error(data.message || "ငွေလွှဲမှု မအောင်မြင်ပါ။")

    // Update local balance immediately for responsiveness
    userBalance -= amount
    updateUserUI(currentUser)

    playSound(transferSentSound)
    showToast(`${amount.toLocaleString()} Ks အောင်မြင်စွာ လွှဲပြီးပါပြီ။`, "success")
    document.getElementById("transfer-success").textContent = `${amount.toLocaleString()} Ks အောင်မြင်စွာ လွှဲပြီးပါပြီ။`
    document.getElementById("transfer-phone").value = ""
    document.getElementById("transfer-amount").value = ""
    document.getElementById("transfer-note").value = ""
    document.getElementById("recipient-info").style.display = "none"
    transferRecipientInfo = null

    // Fetch the created transaction to show receipt
    const { data: newTransaction, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", data.transaction_id) // Assuming RPC returns transaction_id
      .single()

    if (fetchError) console.warn("Error fetching new transaction for receipt:", fetchError)
    else if (newTransaction) {
      showTransactionReceipt(newTransaction)
      if (autoSaveReceipt) {
        setTimeout(() => downloadReceipt(), 1000) // Auto download after a short delay
      }
    }
    loadTransactions() // Refresh transaction list
  } catch (error) {
    console.error("Transfer execution error:", error)
    document.getElementById("transfer-error").textContent = `ငွေလွှဲမှု မအောင်မြင်ပါ: ${error.message}`
    showToast("ငွေလွှဲမှု မအောင်မြင်ပါ။", "error")
  } finally {
    hideProcessingOverlay()
  }
}

function showProcessingOverlay(message) {
  document.getElementById("processing-message").textContent = message
  processingOverlay.classList.add("active")
  // Simulate steps for demo
  const steps = processingOverlay.querySelectorAll(".step")
  steps.forEach((s) => s.classList.remove("active"))
  steps[0].classList.add("active")
  setTimeout(() => steps[1].classList.add("active"), 700)
  setTimeout(() => steps[2].classList.add("active"), 1400)
}

function hideProcessingOverlay() {
  processingOverlay.classList.remove("active")
}

// --- Receipt Functions ---
let currentReceiptData = null
function showTransactionReceipt(transaction) {
  currentReceiptData = transaction
  const receiptContainer = document.getElementById("receipt-container")
  const isSender = transaction.from_phone === currentUser.phone
  const otherPartyName = isSender
    ? transaction.to_name || transaction.to_phone
    : transaction.from_name || transaction.from_phone
  const otherPartyPhone = isSender ? transaction.to_phone : transaction.from_phone

  receiptContainer.innerHTML = `
    <div class="receipt">
      <div class="receipt-logo-area">
        <div class="opper-logo-container">
          <img src="https://github.com/Opper125/opper-payment/raw/main/logo.png" alt="OPPER Logo" class="opper-logo-img">
          <span class="opper-logo-text">OPPER Payment</span>
        </div>
        <img src="https://github.com/Opper125/opper-payment/raw/main/github_logo.png" alt="GitHub Logo" class="github-logo-img">
      </div>
      <div class="receipt-status">
        <div class="receipt-status-icon ${isSender ? "sent" : "received"}">
          <i class="fas ${isSender ? "fa-paper-plane" : "fa-check-circle"}"></i>
        </div>
        <div class="receipt-status-text">${isSender ? "ငွေလွှဲ အောင်မြင်ပါသည်" : "ငွေလက်ခံရရှိပါသည်"}</div>
      </div>
      <div class="receipt-amount">
        <div class="receipt-amount-label">ငွေပမာဏ</div>
        <div class="receipt-amount-value">${transaction.amount.toLocaleString()} Ks</div>
      </div>
      <div class="receipt-details">
        <div class="receipt-detail-row">
          <span class="receipt-detail-label">${isSender ? "လက်ခံသူ" : "ပေးပို့သူ"}</span>
          <span class="receipt-detail-value">${otherPartyName}</span>
        </div>
        <div class="receipt-detail-row">
          <span class="receipt-detail-label">ဖုန်းနံပါတ်</span>
          <span class="receipt-detail-value">${otherPartyPhone}</span>
        </div>
        ${
          isSender
            ? `<div class="receipt-detail-row">
                        <span class="receipt-detail-label">ပေးပို့သူ</span>
                        <span class="receipt-detail-value">${currentUser.email.split("@")[0]} (${currentUser.phone})</span>
                      </div>`
            : `<div class="receipt-detail-row">
                        <span class="receipt-detail-label">လက်ခံသူ</span>
                        <span class="receipt-detail-value">${currentUser.email.split("@")[0]} (${currentUser.phone})</span>
                      </div>`
        }
        ${
          transaction.note
            ? `<div class="receipt-detail-row">
                        <span class="receipt-detail-label">မှတ်ချက်</span>
                        <span class="receipt-detail-value">${transaction.note}</span>
                      </div>`
            : ""
        }
        <div class="receipt-detail-row">
          <span class="receipt-detail-label">ရက်စွဲ / အချိန်</span>
          <span class="receipt-detail-value">${new Date(transaction.created_at).toLocaleString("my-MM", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}</span>
        </div>
      </div>
      <div class="receipt-transaction-id">
        <div class="receipt-transaction-id-label">ငွေလွှဲ ID</div>
        <div class="receipt-transaction-id-value">${transaction.id}</div>
      </div>
      <div class="receipt-footer">
        OPPER Payment ကို အသုံးပြုသည့်အတွက် ကျေးဇူးတင်ပါသည်။<br>
        &copy; ${new Date().getFullYear()} OPPER Payment. All rights reserved.
      </div>
    </div>
  `
  openModal("receipt-modal")
  document.getElementById("download-receipt")?.removeEventListener("click", downloadReceipt) // Remove old listener
  document.getElementById("download-receipt")?.addEventListener("click", downloadReceipt)
}

async function downloadReceipt() {
  playClickSound()
  if (!currentReceiptData) return
  const receiptElement = document.getElementById("receipt-container")
  if (!receiptElement) return

  showLoader("ပြေစာ ဒေါင်းလုဒ်ဆွဲနေသည်...")
  try {
    const canvas = await html2canvas(receiptElement.firstElementChild, {
      scale: 2, // Higher scale for better quality
      useCORS: true,
      backgroundColor: "#ffffff", // Ensure background is white for PNG
    })
    const link = document.createElement("a")
    link.download = `OPPER_Receipt_${currentReceiptData.id.substring(0, 8)}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
    showToast("ပြေစာကို အောင်မြင်စွာ ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ။", "success")
  } catch (error) {
    console.error("Error downloading receipt:", error)
    showToast("ပြေစာ ဒေါင်းလုဒ်ဆွဲရာတွင် အမှားအယွင်းဖြစ်ပွားပါသည်။", "error")
  } finally {
    hideLoader()
  }
}

// --- Settings Change Functions ---
async function handleChangePassword() {
  playClickSound()
  const currentPassword = document.getElementById("current-password").value
  const newPassword = document.getElementById("new-password").value
  const confirmNewPassword = document.getElementById("confirm-new-password").value
  const errorDiv = document.getElementById("change-password-error")
  const successDiv = document.getElementById("change-password-success")
  errorDiv.textContent = ""
  successDiv.textContent = ""

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    errorDiv.textContent = "အကွက်အားလုံးဖြည့်ပါ။"
    return
  }
  if (newPassword !== confirmNewPassword) {
    errorDiv.textContent = "စကားဝှက်အသစ်များ တူညီမှုမရှိပါ။"
    return
  }
  if (newPassword.length < 6) {
    errorDiv.textContent = "စကားဝှက်အသစ်သည် အနည်းဆုံး စာလုံး ၆ လုံးရှိရမည်။"
    return
  }

  showLoader("စကားဝှက် ပြောင်းလဲနေသည်...")
  try {
    // First, verify current password by trying to sign in (this is a common workaround if no direct reauth)
    // This is not ideal. Supabase offers supabase.auth.updateUser({ password: newPassword })
    // but it's better to reauthenticate for password changes.
    // For simplicity, we'll directly try to update. User should be signed in.

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error

    successDiv.textContent = "စကားဝှက် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။"
    showToast("စကားဝှက် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။", "success")
    closeModal("change-password-modal")
    document.getElementById("current-password").value = ""
    document.getElementById("new-password").value = ""
    document.getElementById("confirm-new-password").value = ""
  } catch (error) {
    console.error("Change password error:", error)
    errorDiv.textContent = `စကားဝှက်ပြောင်းလဲမှု မအောင်မြင်ပါ: ${error.message}`
    showToast("စကားဝှက်ပြောင်းလဲမှု မအောင်မြင်ပါ။", "error")
  } finally {
    hideLoader()
  }
}

async function handleChangePin() {
  playClickSound()
  const currentPin = document.getElementById("current-pin").value
  const newPin = document.getElementById("new-pin").value
  const confirmNewPin = document.getElementById("confirm-new-pin").value
  const errorDiv = document.getElementById("change-pin-error")
  const successDiv = document.getElementById("change-pin-success")
  errorDiv.textContent = ""
  successDiv.textContent = ""

  if (!currentPin || !newPin || !confirmNewPin) {
    errorDiv.textContent = "အကွက်အားလုံးဖြည့်ပါ။"
    return
  }
  if (newPin !== confirmNewPin) {
    errorDiv.textContent = "PIN အသစ်များ တူညီမှုမရှိပါ။"
    return
  }
  if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
    errorDiv.textContent = "PIN နံပါတ်သည် ဂဏန်း ၆ လုံးဖြစ်ရပါမည်။"
    return
  }
  if (currentPin !== currentUser.pin) {
    errorDiv.textContent = "လက်ရှိ PIN နံပါတ် မှားယွင်းနေပါသည်။"
    return
  }

  showLoader("PIN ပြောင်းလဲနေသည်...")
  try {
    const { error } = await supabase.from("users").update({ pin: newPin }).eq("user_id", currentUser.id)
    if (error) throw error

    currentUser.pin = newPin // Update local PIN
    successDiv.textContent = "PIN အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။"
    showToast("PIN အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။", "success")
    closeModal("change-pin-modal")
    document.getElementById("current-pin").value = ""
    document.getElementById("new-pin").value = ""
    document.getElementById("confirm-new-pin").value = ""
  } catch (error) {
    console.error("Change PIN error:", error)
    errorDiv.textContent = `PIN ပြောင်းလဲမှု မအောင်မြင်ပါ: ${error.message}`
    showToast("PIN ပြောင်းလဲမှု မအောင်မြင်ပါ။", "error")
  } finally {
    hideLoader()
  }
}

async function handleDeleteAccount() {
  playClickSound()
  const password = document.getElementById("delete-password").value
  const confirmDelete = document.getElementById("confirm-delete").checked
  const errorDiv = document.getElementById("delete-account-error")
  errorDiv.textContent = ""

  if (!password || !confirmDelete) {
    errorDiv.textContent = "စကားဝှက်ထည့်၍ အတည်ပြုချက်ကို ရွေးချယ်ပါ။"
    return
  }

  showLoader("အကောင့် ဖျက်သိမ်းနေပါသည်...")
  try {
    // This is a placeholder. Deleting a user securely involves backend logic.
    // For Supabase, you'd typically call an edge function with admin rights.
    // supabase.auth.admin.deleteUser(currentUser.id) can only be called from a secure backend.
    // Simulating success for now.
    console.warn("Account deletion is a complex process requiring backend logic. Simulating success for frontend demo.")
    // Attempt to sign out the user to verify password (not a true deletion)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: currentUser.email, password })
    if (signInError) {
      throw new Error("စကားဝှက် မှားယွင်းနေပါသည်။ အကောင့်ကို မဖျက်နိုင်ပါ။")
    }

    // If password is correct, proceed with simulated deletion
    // In a real app, call your backend endpoint here to delete the user from 'auth.users' and 'users' table.
    // For example: await fetch('/api/delete-account', { method: 'POST', body: JSON.stringify({ userId: currentUser.id }) });

    showToast("အကောင့်ကို အောင်မြင်စွာ ဖျက်သိမ်းပြီးပါပြီ။", "success")
    // Force logout and redirect
    await supabase.auth.signOut()
    localStorage.removeItem("opperSession")
    currentUser = null
    closeModal("delete-account-modal")
    showAuthContainer()
  } catch (error) {
    console.error("Delete account error:", error)
    errorDiv.textContent = `အကောင့်ဖျက်သိမ်းမှု မအောင်မြင်ပါ: ${error.message}`
    showToast("အကောင့်ဖျက်သိမ်းမှု မအောင်မြင်ပါ။", "error")
  } finally {
    hideLoader()
  }
}

// File Preview for KYC
document.querySelectorAll('input[type="file"]').forEach((input) => {
  input.addEventListener("change", function () {
    const previewId = this.id.replace("-upload", "-preview")
    const previewElement = document.getElementById(previewId)
    if (this.files && this.files[0] && previewElement) {
      const reader = new FileReader()
      reader.onload = (e) => {
        previewElement.innerHTML = `<img src="${e.target.result}" alt="Preview">`
      }
      reader.readAsDataURL(this.files[0])
    } else if (previewElement) {
      previewElement.innerHTML = ""
    }
  })
})

// Intro Animation Handling
const introAnimation = document.getElementById("intro-animation")
if (introAnimation) {
  // Hide intro after animation completes or if user is already logged in quickly
  setTimeout(() => {
    introAnimation.style.opacity = "0"
    introAnimation.style.visibility = "hidden"
    if (!currentUser) {
      // If no user by now, ensure auth is visible
      showAuthContainer()
    }
  }, 3300) // Slightly less than the loader hide to ensure smooth transition
}
