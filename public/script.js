// Supabase Configuration
const supabaseUrl = "https://vtsczzlnhsrgnbkfyizi.supabase.co"
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68"
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey)

// Global Variables
let currentUser = null
let userProfileData = null // To store name, phone etc.
let userBalance = 0
let userKycStatus = "pending"
let transfersEnabled = true
let currentTheme =
  localStorage.getItem("theme") ||
  (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
let transactions = []
let announcements = []
let notifications = []
let myQRCode = null

// DOM Elements
const loader = document.getElementById("loader")
const authContainer = document.getElementById("auth-container")
const appContainer = document.getElementById("app-container")
const pinEntryModal = document.getElementById("pin-entry-modal")
const receiptModal = document.getElementById("receipt-modal")
const processingOverlay = document.getElementById("processing-overlay")
const consoleOutput = document.getElementById("console-output")
const consoleContainer = document.getElementById("console-container")
const toastNotification = document.getElementById("toast-notification")

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
  document.body.setAttribute("data-theme", currentTheme)
  showLoader()
  initConsole() // Initialize custom console early
  logToConsole("App initializing...")

  await checkSession()
  initializeUI()

  if (currentUser) {
    await loadInitialData()
    showAppContainer()
  } else {
    showAuthContainer()
  }

  setTimeout(hideLoader, 1500)
  logToConsole("App initialized.")
  document.getElementById("current-year").textContent = new Date().getFullYear()
})

// Custom Console Logging
function initConsole() {
  const consoleToggleBtn = document.getElementById("console-toggle-btn")
  if (consoleToggleBtn) {
    consoleToggleBtn.addEventListener("click", () => {
      consoleContainer.classList.toggle("active")
    })
  }
}

function logToConsole(message, type = "info") {
  if (!consoleOutput) return
  const line = document.createElement("div")
  line.classList.add("console-line", `console-${type}`)
  line.textContent = typeof message === "object" ? JSON.stringify(message, null, 2) : message
  consoleOutput.appendChild(line)
  consoleOutput.scrollTop = consoleOutput.scrollHeight
}

// Toast Notification
function showToast(message, type = "info", duration = 3000) {
  toastNotification.textContent = message
  toastNotification.className = "toast" // Reset classes
  toastNotification.classList.add(`toast-${type}`, "show")
  setTimeout(() => {
    toastNotification.classList.remove("show")
  }, duration)
}

async function checkSession() {
  logToConsole("Checking session...")
  try {
    const session = localStorage.getItem("opperSession")
    if (session) {
      const sessionData = JSON.parse(session)
      logToConsole(`Found session for user_id: ${sessionData.user_id}`)

      const { data: user, error } = await supabase
        .from("auth_users")
        .select("*")
        .eq("user_id", sessionData.user_id)
        .single()

      if (error || !user) {
        logToConsole("Session invalid or user not found in auth_users.", "error")
        localStorage.removeItem("opperSession")
        currentUser = null
        return
      }
      currentUser = user
      logToConsole(`Session valid for user: ${currentUser.email}`)
    } else {
      logToConsole("No active session found.")
      currentUser = null
    }
  } catch (error) {
    logToConsole(`Session check error: ${error.message}`, "error")
    currentUser = null
  }
}

async function loadInitialData() {
  if (!currentUser) return
  logToConsole("Loading initial data for user...")
  showProcessingOverlay("အချက်အလက်များရယူနေသည်...")
  try {
    await Promise.all([loadUserData(), loadTransactions(), loadAnnouncements(), loadNotifications()])
    updateUserUI()
    setupRealtimeSubscriptions()
    generateUserQRCode()
    logToConsole("Initial data loaded successfully.")
  } catch (error) {
    logToConsole(`Error loading initial data: ${error.message}`, "error")
    showToast("အချက်အလက်များ ရယူရာတွင် အမှားဖြစ်ပေါ်နေပါသည်။", "error")
    logout() // Logout if initial data fails to load
  } finally {
    hideProcessingOverlay()
  }
}

async function loadUserData() {
  if (!currentUser) return
  logToConsole(`Fetching user profile for ${currentUser.user_id}`)
  const { data, error } = await supabase.from("users").select("*").eq("user_id", currentUser.user_id).single()

  if (error) {
    logToConsole(`Error fetching user profile: ${error.message}`, "error")
    if (error.code === "PGRST116") {
      // "PGRST116: Single row not found"
      logToConsole("User profile not found. Creating one.")
      const { data: newProfile, error: createError } = await supabase
        .from("users")
        .insert([
          {
            user_id: currentUser.user_id,
            name: currentUser.email.split("@")[0],
            balance: 0,
            passport_status: "pending",
          },
        ])
        .select()
        .single()
      if (createError) {
        logToConsole(`Error creating user profile: ${createError.message}`, "error")
        throw createError
      }
      userProfileData = newProfile
    } else {
      throw error
    }
  } else {
    userProfileData = data
  }

  userBalance = userProfileData.balance || 0
  userKycStatus = userProfileData.passport_status || "pending"

  const { data: settings, error: settingsError } = await supabase
    .from("settings")
    .select("allow_transfers")
    .eq("id", 1)
    .single()
  if (!settingsError && settings) {
    transfersEnabled = settings.allow_transfers
  }
  logToConsole("User data and settings loaded.", userProfileData)
}

function updateUserUI() {
  if (!currentUser || !userProfileData) {
    logToConsole("Cannot update UI: currentUser or userProfileData is missing.", "warning")
    return
  }
  logToConsole("Updating UI with user data.")

  const userName = userProfileData.name || currentUser.email.split("@")[0]
  const userInitial = userName.charAt(0).toUpperCase()

  document.getElementById("user-initial").textContent = userInitial
  document.getElementById("user-initial-sidebar").textContent = userInitial
  document.getElementById("user-name").textContent = userName
  document.getElementById("user-name-sidebar").textContent = userName
  document.getElementById("user-id").textContent = `ID: ${currentUser.user_id}`
  document.getElementById("user-id-sidebar").textContent = `ID: ${currentUser.user_id}`
  document.getElementById("greeting-name").textContent = userName

  document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`
  document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`

  updateKycStatusDisplay()
  updateTransferStatusDisplay()

  document.getElementById("settings-name").value = userName
  document.getElementById("settings-phone").value = userProfileData.phone || ""
  document.getElementById("settings-email").value = currentUser.email || ""

  const qrUserPhoneEl = document.getElementById("qr-user-phone")
  if (qrUserPhoneEl) {
    qrUserPhoneEl.textContent = userProfileData.phone ? `ဖုန်း: ${userProfileData.phone}` : "ဖုန်းနံပါတ်မရှိသေးပါ"
  }
}

function updateKycStatusDisplay() {
  const kycStatusEl = document.getElementById("kyc-status-display")
  const kycStatusTextEl = document.getElementById("kyc-status-text")
  const kycPageStatusCard = document.getElementById("kyc-status-card")
  const kycPageStatusMessage = document.getElementById("kyc-status-message")
  const kycPageStatusIcon = kycPageStatusCard ? kycPageStatusCard.querySelector(".kyc-status-icon") : null
  const kycForm = document.getElementById("kyc-form")

  let statusText = "KYC: စောင့်ဆိုင်းဆဲ"
  let statusClass = "pending"
  let iconClass = "fa-clock"
  let showForm = true

  if (userKycStatus === "approved") {
    statusText = "KYC: အတည်ပြုပြီး"
    statusClass = "approved"
    iconClass = "fa-check-circle"
    showForm = false
  } else if (userKycStatus === "rejected") {
    statusText = "KYC: ငြင်းပယ်ခံရသည်"
    statusClass = "rejected"
    iconClass = "fa-times-circle"
  }

  if (kycStatusTextEl) kycStatusTextEl.textContent = statusText
  if (kycStatusEl) kycStatusEl.className = `status-item ${statusClass}`

  if (kycPageStatusMessage) kycPageStatusMessage.textContent = statusText.replace("KYC: ", "")
  if (kycPageStatusIcon) {
    kycPageStatusIcon.className = `kyc-status-icon ${statusClass}`
    kycPageStatusIcon.innerHTML = `<i class="fas ${iconClass}"></i><div class="status-pulse"></div>`
  }
  if (kycForm) {
    kycForm.style.display = showForm ? "block" : "none"
    if (!showForm && userProfileData.passport_number) {
      document.getElementById("kyc-passport").value = userProfileData.passport_number
      document.getElementById("kyc-address").value = userProfileData.address
    }
  }
}

function updateTransferStatusDisplay() {
  const transferStatusEl = document.getElementById("transfer-status-display")
  const transferStatusTextEl = document.getElementById("transfer-status-text")
  if (!transferStatusEl || !transferStatusTextEl) return

  if (transfersEnabled) {
    transferStatusTextEl.textContent = "ငွေလွှဲခြင်း: ခွင့်ပြုထားသည်"
    transferStatusEl.className = "status-item enabled"
  } else {
    transferStatusTextEl.textContent = "ငွေလွှဲခြင်း: ပိတ်ထားသည်"
    transferStatusEl.className = "status-item disabled"
  }
}

function setupRealtimeSubscriptions() {
  logToConsole("Setting up realtime subscriptions...")
  supabase
    .channel("public-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "users", filter: `user_id=eq.${currentUser.user_id}` },
      (payload) => {
        logToConsole("Realtime user update received:", payload.new)
        userProfileData = payload.new
        userBalance = payload.new.balance
        userKycStatus = payload.new.passport_status
        updateUserUI()
      },
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "settings", filter: `id=eq.1` }, (payload) => {
      logToConsole("Realtime settings update received:", payload.new)
      transfersEnabled = payload.new.allow_transfers
      updateTransferStatusDisplay()
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, (payload) => {
      if (payload.new.from_phone === userProfileData.phone || payload.new.to_phone === userProfileData.phone) {
        logToConsole("Realtime transaction update received:", payload.new)
        loadTransactions()
        const message =
          payload.new.to_phone === userProfileData.phone
            ? `${payload.new.from_name || payload.new.from_phone} ဆီမှ ${payload.new.amount} Ks လက်ခံရရှိသည်`
            : `${payload.new.to_name || payload.new.to_phone} သို့ ${payload.new.amount} Ks ပေးပို့ပြီးပါပြီ`
        showToast(message, "info")
        addNotification(message, "transaction")

        if (payload.new.to_phone === userProfileData.phone) {
          speak(`ငွေ ${payload.new.amount} ကျပ် လက်ခံရရှိပါသည်။`)
        }
      }
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, (payload) => {
      logToConsole("Realtime announcement update received:", payload)
      loadAnnouncements()
      if (payload.eventType === "INSERT") {
        showToast("ကြေညာချက်အသစ်တစ်ခုရှိပါသည်!", "info")
        addNotification(`ကြေညာချက်အသစ်: ${payload.new.title}`, "announcement", payload.new.id)
      }
    })
    .subscribe()
}

async function loadTransactions() {
  if (!currentUser || !userProfileData || !userProfileData.phone) return
  logToConsole("Loading transactions...")
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .or(`from_phone.eq.${userProfileData.phone},to_phone.eq.${userProfileData.phone}`)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    logToConsole(`Error loading transactions: ${error.message}`, "error")
    return
  }
  transactions = data || []
  updateTransactionsUI()
  logToConsole(`${transactions.length} transactions loaded.`)
}

function updateTransactionsUI() {
  const recentList = document.getElementById("recent-transactions-list")
  const historyList = document.getElementById("history-transactions-list")
  const typeFilter = document.getElementById("history-type").value
  const dateFilter = document.getElementById("history-date").value

  const renderList = (listElement, items) => {
    if (!listElement) return
    listElement.innerHTML = ""
    if (items.length === 0) {
      listElement.innerHTML = `<div class="empty-state"><i class="fas fa-history"></i><p>လုပ်ဆောင်ချက်မှတ်တမ်းမရှိသေးပါ</p></div>`
      return
    }
    items.forEach((tx) => {
      const isSender = tx.from_phone === userProfileData.phone
      const otherParty = isSender ? tx.to_name || tx.to_phone : tx.from_name || tx.from_phone
      const txDate = new Date(tx.created_at)

      const itemHTML = `
                <div class="transaction-item ${isSender ? "sent" : "received"}">
                    <div class="transaction-icon">
                        <i class="fas ${isSender ? "fa-arrow-up" : "fa-arrow-down"}"></i>
                    </div>
                    <div class="transaction-details">
                        <div class="transaction-title">
                            ${isSender ? "ပို့ထားသော" : "လက်ခံရရှိသော"} - ${otherParty}
                        </div>
                        <div class="transaction-subtitle">
                            ${tx.note || "မှတ်ချက်မရှိပါ"}
                        </div>
                        <div class="transaction-date">${txDate.toLocaleString("my-MM", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                    <div class="transaction-actions">
                        <div class="transaction-amount ${isSender ? "negative" : "positive"}">
                            ${isSender ? "-" : "+"} ${tx.amount.toLocaleString()} Ks
                        </div>
                        <button class="transaction-view-btn" data-transaction-id="${tx.id}" aria-label="View Receipt">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>`
      listElement.innerHTML += itemHTML
    })

    listElement.querySelectorAll(".transaction-view-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const txId = e.currentTarget.dataset.transactionId
        const transaction = transactions.find((t) => t.id === txId)
        if (transaction) showTransactionReceipt(transaction)
      })
    })
  }

  renderList(recentList, transactions.slice(0, 5))

  const filteredTransactions = transactions.filter((tx) => {
    const isSender = tx.from_phone === userProfileData.phone
    if (typeFilter === "sent" && !isSender) return false
    if (typeFilter === "received" && isSender) return false

    const txDate = new Date(tx.created_at)
    const today = new Date()
    if (dateFilter === "today" && txDate.toDateString() !== today.toDateString()) return false
    if (dateFilter === "week") {
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(today.getDate() - 7)
      if (txDate < oneWeekAgo) return false
    }
    if (
      dateFilter === "month" &&
      (txDate.getMonth() !== today.getMonth() || txDate.getFullYear() !== today.getFullYear())
    )
      return false

    return true
  })
  renderList(historyList, filteredTransactions)
}

async function loadAnnouncements() {
  logToConsole("Loading announcements...")
  const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false })

  if (error) {
    logToConsole(`Error loading announcements: ${error.message}`, "error")
    return
  }
  announcements = data || []
  displayAnnouncements(announcements.slice(0, 3), "dashboard-announcements-list")
  displayAnnouncements(announcements, "full-announcements-list")
  logToConsole(`${announcements.length} announcements loaded.`)
}

function displayAnnouncements(itemsToDisplay, containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  container.innerHTML = ""
  if (itemsToDisplay.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-bullhorn"></i><p>ကြေညာချက်များမရှိသေးပါ</p></div>`
    return
  }

  itemsToDisplay.forEach((ann) => {
    const item = document.createElement("div")
    item.classList.add("announcement-item")
    item.innerHTML = `
            <h4>${ann.title}</h4>
            ${ann.image_url ? `<div class="announcement-image-container"><img src="${ann.image_url}" alt="${ann.title}"></div>` : ""}
            <div class="announcement-content"><p>${ann.content.replace(/\n/g, "<br>")}</p></div>
            <div class="announcement-footer">
                <div class="announcement-actions">
                    <button class="like-btn" data-id="${ann.id}" aria-label="Like">
                        <i class="far fa-thumbs-up"></i> <span class="likes-count">${ann.likes || 0}</span>
                    </button>
                    <button class="comment-btn" data-id="${ann.id}" aria-label="Comment">
                        <i class="far fa-comment"></i> <span class="comments-count">${ann.comments_count || 0}</span>
                    </button>
                </div>
                <span class="timestamp">${new Date(ann.created_at).toLocaleDateString("my-MM")}</span>
            </div>
            <div class="announcement-comments-section hidden" id="comments-for-${ann.id}">
                <h5>မှတ်ချက်များ</h5>
                <div class="comments-list"></div>
                <div class="comment-input">
                    <input type="text" placeholder="မှတ်ချက်ရေးပါ..." class="comment-text-input">
                    <button class="btn btn-sm btn-primary submit-comment-btn">ပို့စ်တင်ရန်</button>
                </div>
            </div>
        `
    container.appendChild(item)
  })

  container.querySelectorAll(".like-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleLike(btn.dataset.id, btn))
  })
  container.querySelectorAll(".comment-btn").forEach((btn) => {
    btn.addEventListener("click", () => toggleCommentsSection(btn.dataset.id))
  })
  container.querySelectorAll(".submit-comment-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const announcementId = e.target.closest(".announcement-item").querySelector(".like-btn").dataset.id
      const commentInput = e.target.previousElementSibling
      handleComment(announcementId, commentInput.value, commentInput)
    })
  })
}

async function handleLike(announcementId, buttonElement) {
  if (!currentUser) {
    showToast("Like လုပ်ရန် အကောင့်ဝင်ပါ။", "warning")
    return
  }
  const { data, error } = await supabase.rpc("increment_like", { ann_id: Number.parseInt(announcementId) })

  if (error) {
    logToConsole(`Error liking announcement: ${error.message}`, "error")
    showToast("Like လုပ်ရာတွင် အမှားဖြစ်ပေါ်နေပါသည်။", "error")
  } else {
    const likesCountEl = buttonElement.querySelector(".likes-count")
    likesCountEl.textContent = Number.parseInt(likesCountEl.textContent) + 1
    buttonElement.classList.add("liked")
    buttonElement.querySelector("i").classList.replace("far", "fas")
  }
}

function toggleCommentsSection(announcementId) {
  const commentsSection = document.getElementById(`comments-for-${announcementId}`)
  if (commentsSection) {
    commentsSection.classList.toggle("hidden")
    if (!commentsSection.classList.contains("hidden")) {
      loadComments(announcementId)
    }
  }
}

async function loadComments(announcementId) {
  const commentsListEl = document.querySelector(`#comments-for-${announcementId} .comments-list`)
  if (!commentsListEl) return

  const { data: comments, error } = await supabase
    .from("announcement_comments")
    .select("*, users(name)")
    .eq("announcement_id", announcementId)
    .order("created_at", { ascending: false })

  if (error) {
    logToConsole(`Error loading comments: ${error.message}`, "error")
    commentsListEl.innerHTML = "<p>မှတ်ချက်များ ရယူ၍မရပါ</p>"
    return
  }

  if (comments.length === 0) {
    commentsListEl.innerHTML = "<p>မှတ်ချက်များမရှိသေးပါ</p>"
  } else {
    commentsListEl.innerHTML = comments
      .map(
        (comment) => `
            <div class="comment-item">
                <strong>${comment.users ? comment.users.name : "အမည်မသိ"}:</strong> ${comment.comment_text}
            </div>
        `,
      )
      .join("")
  }
}

async function handleComment(announcementId, commentText, inputElement) {
  if (!currentUser) {
    showToast("မှတ်ချက်ရေးရန် အကောင့်ဝင်ပါ။", "warning")
    return
  }
  if (!commentText.trim()) {
    showToast("မှတ်ချက်အလွတ်မဖြစ်ရပါ။", "warning")
    return
  }

  const { data, error } = await supabase
    .from("announcement_comments")
    .insert([{ announcement_id: announcementId, user_id: currentUser.user_id, comment_text: commentText }])
    .select()

  if (error) {
    logToConsole(`Error posting comment: ${error.message}`, "error")
    showToast("မှတ်ချက်ရေးရာတွင် အမှားဖြစ်ပေါ်နေပါသည်။", "error")
  } else {
    showToast("မှတ်ချက်ရေးသားပြီးပါပြီ။", "success")
    if (inputElement) inputElement.value = ""
    loadComments(announcementId)
    const commentBtn = document.querySelector(`.comment-btn[data-id="${announcementId}"] .comments-count`)
    if (commentBtn) commentBtn.textContent = Number.parseInt(commentBtn.textContent) + 1
  }
}

async function loadNotifications() {
  if (!currentUser) return
  logToConsole("Loading notifications...")
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", currentUser.user_id)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    logToConsole(`Error fetching notifications: ${error.message}`, "error")
  } else {
    notifications = data.map((n) => ({ ...n, unread: !n.is_read }))
  }

  updateNotificationUI()
}

async function addNotification(content, type, related_id = null) {
  if (!currentUser) return
  const newNotification = {
    user_id: currentUser.user_id,
    content: content,
    type: type,
    related_id: related_id,
    is_read: false,
  }

  const { error } = await supabase.from("notifications").insert(newNotification)
  if (error) {
    logToConsole(`Error adding notification: ${error.message}`, "error")
  } else {
    logToConsole("Notification added to DB")
    loadNotifications() // Reload to get the new notification
  }
}

function updateNotificationUI() {
  const listEl = document.getElementById("notification-list-items")
  const badgeEl = document.getElementById("notification-badge")
  if (!listEl || !badgeEl) return

  const unreadCount = notifications.filter((n) => n.unread).length
  badgeEl.textContent = unreadCount > 9 ? "9+" : unreadCount.toString()
  badgeEl.style.display = unreadCount > 0 ? "flex" : "none"

  if (notifications.length === 0) {
    listEl.innerHTML = `<div class="notification-empty-state"><i class="fas fa-bell-slash"></i><p>အသိပေးချက်များ မရှိသေးပါ</p></div>`
    return
  }

  listEl.innerHTML = notifications
    .map(
      (n) => `
        <div class="notification-item ${n.unread ? "unread" : ""}" data-id="${n.id}">
            <div class="notification-item-content">${n.content}</div>
            <div class="notification-item-timestamp">${new Date(n.created_at).toLocaleString("my-MM", { dateStyle: "short", timeStyle: "short" })}</div>
        </div>
    `,
    )
    .join("")

  listEl.querySelectorAll(".notification-item").forEach((item) => {
    item.addEventListener("click", () => handleNotificationClick(item.dataset.id))
  })
}

async function handleNotificationClick(notificationId) {
  const notification = notifications.find((n) => n.id.toString() === notificationId.toString())
  if (notification && notification.unread) {
    notification.unread = false
    await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id)
    updateNotificationUI()
  }
  if (notification.type === "announcement" && notification.related_id) {
    showPage("announcements")
    const announcementEl = document.querySelector(`.announcement-item .like-btn[data-id="${notification.related_id}"]`)
    if (announcementEl) announcementEl.closest(".announcement-item").scrollIntoView({ behavior: "smooth" })
  }
  document.getElementById("notification-dropdown").classList.remove("active")
}

async function markAllNotificationsRead() {
  if (!currentUser) return
  await supabase.from("notifications").update({ is_read: true }).eq("user_id", currentUser.user_id).eq("is_read", false)
  notifications.forEach((n) => (n.unread = false))
  updateNotificationUI()
}

function speak(text) {
  if ("speechSynthesis" in window) {
    logToConsole(`Attempting to speak: "${text}"`)
    const utterance = new SpeechSynthesisUtterance(text)
    speechSynthesis.speak(utterance)
  } else {
    logToConsole("Speech synthesis not supported in this browser.", "warning")
  }
}

async function checkRecipientAccount() {
  const phoneInput = document.getElementById("transfer-phone")
  const messageEl = document.getElementById("recipient-check-message")
  const phone = phoneInput.value.trim()

  if (phone.length < 7) {
    messageEl.textContent = ""
    messageEl.className = "recipient-status-message"
    return
  }

  messageEl.textContent = "အကောင့်စစ်ဆေးနေသည်..."
  messageEl.className = "recipient-status-message checking"

  try {
    const { data, error } = await supabase.from("users").select("name, user_id").eq("phone", phone).single()

    if (error && error.code !== "PGRST116") throw error

    if (data) {
      if (data.user_id === currentUser.user_id) {
        messageEl.textContent = "ကိုယ့်ကိုယ်ကို ငွေလွှဲ၍မရပါ။"
        messageEl.className = "recipient-status-message not-found"
      } else {
        messageEl.textContent = `အကောင့်တွေ့ရှိသည်: ${data.name || data.user_id}`
        messageEl.className = "recipient-status-message found"
      }
    } else {
      messageEl.textContent = "ဤဖုန်းနံပါတ်ဖြင့် အကောင့်မရှိပါ။"
      messageEl.className = "recipient-status-message not-found"
    }
  } catch (err) {
    logToConsole(`Error checking recipient account: ${err.message}`, "error")
    messageEl.textContent = "အကောင့်စစ်ဆေးရာတွင် အမှားဖြစ်ပေါ်နေပါသည်။"
    messageEl.className = "recipient-status-message not-found"
  }
}

function generateUserQRCode() {
  if (!currentUser || !userProfileData || !userProfileData.phone) {
    logToConsole("Cannot generate QR code: User data or phone missing.", "warning")
    return
  }
  const qrData = `OPPERPAYMENT://USER?phone=${userProfileData.phone}&id=${currentUser.user_id}`
  const qrDisplay = document.getElementById("my-qr-code-display")

  if (qrDisplay) {
    qrDisplay.innerHTML = ""
  } else {
    return
  }

  qrDisplay.innerHTML =
    '<img src="https://github.com/Opper125/opper-payment/raw/main/logo.png" alt="OPPER Logo" class="qr-logo-overlay">'

  try {
    myQRCode = new QRCode(qrDisplay, {
      text: qrData,
      width: 246,
      height: 246,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H,
    })
    logToConsole("User QR code generated.")
  } catch (e) {
    logToConsole(`Error generating QR code: ${e.message}`, "error")
  }
}

function saveQRCode() {
  const qrDisplay = document.getElementById("my-qr-code-display")
  if (!qrDisplay) return

  html2canvas(qrDisplay, { backgroundColor: null, scale: 3 })
    .then((canvas) => {
      const link = document.createElement("a")
      link.download = `opper-payment-qr-${currentUser.user_id}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
      logToConsole("QR code download initiated.")
      showToast("QR Code ကို ဒေါင်းလုဒ်လုပ်ပြီးပါပြီ။", "success")
    })
    .catch((err) => {
      logToConsole(`Error saving QR code: ${err.message}`, "error")
      showToast("QR Code သိမ်းဆည်းရာတွင် အမှားဖြစ်ပေါ်နေပါသည်။", "error")
    })
}

// Initialize UI elements (event listeners, etc.)
function initializeUI() {
  logToConsole("Initializing UI elements...")
  const authTabs = document.querySelectorAll(".auth-tab")
  const authForms = document.querySelectorAll(".auth-form")
  const tabIndicator = document.querySelector(".tab-indicator")

  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.tab
      authTabs.forEach((t) => t.classList.remove("active"))
      tab.classList.add("active")
      authForms.forEach((form) => form.classList.remove("active"))
      document.getElementById(`${tabName}-form`).classList.add("active")
      if (tabIndicator) {
        tabIndicator.style.transform = tabName === "signup" ? "translateX(calc(100% + 4px))" : "translateX(0)"
      }
    })
  })

  document.querySelectorAll(".toggle-password").forEach((button) => {
    button.addEventListener("click", (e) => {
      const input = e.currentTarget.previousElementSibling
      if (input.type === "password") {
        input.type = "text"
        e.currentTarget.classList.remove("fa-eye-slash")
        e.currentTarget.classList.add("fa-eye")
      } else {
        input.type = "password"
        e.currentTarget.classList.remove("fa-eye")
        e.currentTarget.classList.add("fa-eye-slash")
      }
    })
  })

  document.querySelectorAll(".sidebar-nav a").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault()
      showPage(link.dataset.page)
    })
  })

  document.querySelectorAll(".action-card").forEach((card) => {
    card.addEventListener("click", () => showPage(card.dataset.page))
  })

  const menuToggle = document.getElementById("menu-toggle")
  const closeSidebarBtn = document.getElementById("close-sidebar")
  const sidebar = document.getElementById("sidebar")
  menuToggle.addEventListener("click", () => sidebar.classList.add("active"))
  closeSidebarBtn.addEventListener("click", () => sidebar.classList.remove("active"))

  const profileDropdownTrigger = document.getElementById("profile-dropdown-trigger")
  const profileDropdown = document.getElementById("profile-dropdown")
  profileDropdownTrigger.addEventListener("click", (e) => {
    e.stopPropagation()
    const isActive = profileDropdown.classList.toggle("active")
    if (isActive) {
      const rect = profileDropdownTrigger.getBoundingClientRect()
      profileDropdown.style.top = `${rect.bottom + 10}px`
      profileDropdown.style.right = `${window.innerWidth - rect.right}px`
    }
  })
  document.addEventListener("click", (e) => {
    if (!profileDropdown.contains(e.target) && !profileDropdownTrigger.contains(e.target)) {
      profileDropdown.classList.remove("active")
    }
  })
  document.getElementById("view-profile").addEventListener("click", () => showPage("settings"))
  document.getElementById("go-to-settings").addEventListener("click", () => showPage("settings"))
  document.getElementById("dropdown-logout").addEventListener("click", logout)
  document.getElementById("logout-btn").addEventListener("click", logout)

  const notificationBellTrigger = document.getElementById("notification-bell-trigger")
  const notificationDropdown = document.getElementById("notification-dropdown")
  notificationBellTrigger.addEventListener("click", (e) => {
    e.stopPropagation()
    const isActive = notificationDropdown.classList.toggle("active")
    if (isActive) {
      const rect = notificationBellTrigger.getBoundingClientRect()
      notificationDropdown.style.top = `${rect.bottom + 10}px`
      notificationDropdown.style.right = `${window.innerWidth - rect.right}px`
    }
  })
  document.addEventListener("click", (e) => {
    if (!notificationDropdown.contains(e.target) && !notificationBellTrigger.contains(e.target)) {
      notificationDropdown.classList.remove("active")
    }
  })
  document.getElementById("mark-all-read-btn").addEventListener("click", markAllNotificationsRead)

  document.getElementById("refresh-balance").addEventListener("click", loadUserData)
  document.getElementById("hide-balance").addEventListener("click", () => {
    const balanceAmount = document.getElementById("balance-amount")
    const icon = document.querySelector("#hide-balance i")
    if (balanceAmount.classList.toggle("hidden-balance")) {
      balanceAmount.textContent = "•••••• Ks"
      icon.classList.replace("fa-eye-slash", "fa-eye")
    } else {
      balanceAmount.textContent = `${userBalance.toLocaleString()} Ks`
      icon.classList.replace("fa-eye", "fa-eye-slash")
    }
  })

  document.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      const file = e.target.files[0]
      if (!file) return
      const previewEl = document.getElementById(input.id.replace("-upload", "-preview"))
      if (previewEl) {
        const reader = new FileReader()
        reader.onload = (re) => {
          previewEl.innerHTML = `<img src="${re.target.result}" alt="Preview">`
        }
        reader.readAsDataURL(file)
      }
    })
  })

  const themeOptions = document.querySelectorAll(".theme-option")
  themeOptions.forEach((option) => {
    if (option.dataset.theme === currentTheme) option.classList.add("active")
    option.addEventListener("click", () => {
      currentTheme = option.dataset.theme
      document.body.setAttribute("data-theme", currentTheme)
      localStorage.setItem("theme", currentTheme)
      themeOptions.forEach((o) => o.classList.remove("active"))
      option.classList.add("active")
    })
  })

  const modalTriggers = {
    "change-password-btn": "change-password-modal",
    "change-pin-btn": "change-pin-modal",
    "delete-account-btn": "delete-account-modal",
  }
  Object.entries(modalTriggers).forEach(([triggerId, modalId]) => {
    const trigger = document.getElementById(triggerId)
    if (trigger) trigger.addEventListener("click", () => document.getElementById(modalId).classList.add("active"))
  })
  document.querySelectorAll(".modal-close, .modal-cancel").forEach((button) => {
    button.addEventListener("click", () => button.closest(".modal").classList.remove("active"))
  })
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("active")
    })
  })

  setupPinInputs()
  document.getElementById("download-receipt").addEventListener("click", downloadReceipt)
  document.getElementById("save-qr-btn").addEventListener("click", saveQRCode)

  const transferPhoneInput = document.getElementById("transfer-phone")
  if (transferPhoneInput) {
    let debounceTimer
    transferPhoneInput.addEventListener("input", () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(checkRecipientAccount, 500)
    })
  }

  document.getElementById("history-type")?.addEventListener("change", updateTransactionsUI)
  document.getElementById("history-date")?.addEventListener("change", updateTransactionsUI)

  setupFormSubmissions()
  logToConsole("UI initialized.")
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
  document.getElementById("confirm-pin-btn").addEventListener("click", () => {
    const pin = Array.from(pinInputs)
      .map((input) => input.value)
      .join("")
    const pinErrorEl = document.getElementById("pin-error")
    if (pin.length !== 6) {
      pinErrorEl.textContent = "PIN ၆ လုံး ထည့်ပါ"
      pinErrorEl.style.display = "block"
      return
    }
    pinErrorEl.style.display = "none"
    processTransfer(pin)
  })
}

function setupFormSubmissions() {
  document.getElementById("login-btn").addEventListener("click", handleLogin)
  document.getElementById("google-login-btn").addEventListener("click", () => simulateGoogleAuth("login"))
  document.getElementById("signup-btn").addEventListener("click", handleSignup)
  document.getElementById("google-signup-btn").addEventListener("click", () => simulateGoogleAuth("signup"))
  document.getElementById("transfer-btn").addEventListener("click", handleTransferInitiation)
  document.getElementById("kyc-submit-btn").addEventListener("click", handleKycSubmit)
  document.getElementById("save-password-btn").addEventListener("click", handleChangePassword)
  document.getElementById("save-pin-btn").addEventListener("click", handleChangePin)
  document.getElementById("confirm-delete-btn").addEventListener("click", handleDeleteAccount)
}

async function handleLogin() {
  const email = document.getElementById("login-email").value
  const password = document.getElementById("login-password").value
  const errorEl = document.getElementById("login-error")
  const successEl = document.getElementById("login-success")

  if (!email || !password) {
    errorEl.textContent = "အီးမေးလ်နှင့် စကားဝှက် ထည့်ပါ။"
    errorEl.style.display = "block"
    successEl.style.display = "none"
    return
  }
  showProcessingOverlay("အကောင့်ဝင်နေသည်...")
  try {
    const { data: user, error } = await supabase.from("auth_users").select("*").eq("email", email).single()

    if (error || !user || user.password !== password) {
      errorEl.textContent = "အီးမေးလ် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်။"
      errorEl.style.display = "block"
      successEl.style.display = "none"
      hideProcessingOverlay()
      return
    }

    currentUser = user
    localStorage.setItem("opperSession", JSON.stringify({ user_id: user.user_id, email: user.email }))
    errorEl.style.display = "none"
    successEl.textContent = "အကောင့်ဝင်ရောက်ပြီးပါပြီ။"
    successEl.style.display = "block"

    await loadInitialData()
    showAppContainer()
  } catch (err) {
    logToConsole(`Login error: ${err.message}`, "error")
    errorEl.textContent = "အကောင့်ဝင်ရာတွင် အမှားရှိနေပါသည်။"
    errorEl.style.display = "block"
    successEl.style.display = "none"
  } finally {
    hideProcessingOverlay()
  }
}

async function handleSignup() {
  const name = document.getElementById("signup-name").value
  const email = document.getElementById("signup-email").value
  const phone = document.getElementById("signup-phone").value
  const password = document.getElementById("signup-password").value
  const confirmPassword = document.getElementById("signup-confirm-password").value
  const termsAgree = document.getElementById("terms-agree").checked
  const errorEl = document.getElementById("signup-error")
  const successEl = document.getElementById("signup-success")

  if (!name || !email || !phone || !password || !confirmPassword) {
    errorEl.textContent = "အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။"
    errorEl.style.display = "block"
    successEl.style.display = "none"
    return
  }
  if (password !== confirmPassword) {
    errorEl.textContent = "စကားဝှက်နှင့် အတည်ပြုစကားဝှက် မတူညီပါ။"
    errorEl.style.display = "block"
    successEl.style.display = "none"
    return
  }
  if (!termsAgree) {
    errorEl.textContent = "စည်းမျဉ်းစည်းကမ်းများကို သဘောတူရန် လိုအပ်ပါသည်။"
    errorEl.style.display = "block"
    successEl.style.display = "none"
    return
  }
  showProcessingOverlay("အကောင့်ဖွင့်နေသည်...")
  try {
    const { data: existingUser } = await supabase.from("auth_users").select("email").eq("email", email).maybeSingle()
    if (existingUser) {
      errorEl.textContent = "ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
      errorEl.style.display = "block"
      hideProcessingOverlay()
      return
    }

    const { data: existingPhoneUser } = await supabase.from("users").select("phone").eq("phone", phone).maybeSingle()
    if (existingPhoneUser) {
      errorEl.textContent = "ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
      errorEl.style.display = "block"
      hideProcessingOverlay()
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
      .insert([{ user_id: userId, name, phone, balance: 0, passport_status: "pending" }])
    if (profileError) throw profileError

    errorEl.style.display = "none"
    successEl.textContent = "အကောင့်ဖွင့်ပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။"
    successEl.style.display = "block"
    document.getElementById("signup-form").reset()
    setTimeout(() => {
      document.querySelector('.auth-tab[data-tab="login"]').click()
      successEl.style.display = "none"
    }, 2000)
  } catch (err) {
    logToConsole(`Signup error: ${err.message}`, "error")
    errorEl.textContent = "အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။"
    errorEl.style.display = "block"
    successEl.style.display = "none"
  } finally {
    hideProcessingOverlay()
  }
}

async function handleTransferInitiation() {
  const phone = document.getElementById("transfer-phone").value
  const amount = Number.parseInt(document.getElementById("transfer-amount").value)
  const errorEl = document.getElementById("transfer-error")
  const successEl = document.getElementById("transfer-success")
  errorEl.style.display = "none"
  successEl.style.display = "none"

  if (!phone || !amount) {
    errorEl.textContent = "ဖုန်းနံပါတ်နှင့် ငွေပမာဏ ထည့်ပါ။"
    errorEl.style.display = "block"
    return
  }
  if (amount < 1000) {
    errorEl.textContent = "ငွေပမာဏ အနည်းဆုံး 1,000 Ks ဖြစ်ရပါမည်။"
    errorEl.style.display = "block"
    return
  }
  if (!transfersEnabled) {
    errorEl.textContent = "ငွေလွှဲခြင်းကို ယာယီပိတ်ထားပါသည်။"
    errorEl.style.display = "block"
    return
  }
  if (userKycStatus !== "approved") {
    errorEl.textContent = "ငွေလွှဲရန် KYC အတည်ပြုရန် လိုအပ်ပါသည်။"
    errorEl.style.display = "block"
    return
  }
  if (userBalance < amount) {
    errorEl.textContent = "လက်ကျန်ငွေ မလုံလောက်ပါ။"
    errorEl.style.display = "block"
    return
  }
  if (userProfileData.phone === phone) {
    errorEl.textContent = "ကိုယ့်ကိုယ်ကို ငွေလွှဲ၍မရပါ။"
    errorEl.style.display = "block"
    return
  }

  showProcessingOverlay("လက်ခံသူအား စစ်ဆေးနေသည်...")
  try {
    const { data: recipient, error: recipientError } = await supabase
      .from("users")
      .select("user_id, name, phone")
      .eq("phone", phone)
      .single()

    if (recipientError || !recipient) {
      errorEl.textContent = "လက်ခံမည့်သူ မတွေ့ရှိပါ။ ဖုန်းနံပါတ်စစ်ဆေးပါ။"
      errorEl.style.display = "block"
      hideProcessingOverlay()
      return
    }

    sessionStorage.setItem("transferRecipient", JSON.stringify(recipient))
    hideProcessingOverlay()
    showPinEntryModal()
  } catch (err) {
    logToConsole(`Transfer initiation error: ${err.message}`, "error")
    errorEl.textContent = "ငွေလွှဲရန် ပြင်ဆင်ရာတွင် အမှားရှိနေပါသည်။"
    errorEl.style.display = "block"
    hideProcessingOverlay()
  }
}

async function processTransfer(pin) {
  const recipientData = JSON.parse(sessionStorage.getItem("transferRecipient"))
  if (!recipientData) {
    showToast("လက်ခံသူ အချက်အလက် မတွေ့ရှိပါ။", "error")
    pinEntryModal.classList.remove("active")
    return
  }

  const amount = Number.parseInt(document.getElementById("transfer-amount").value)
  const note = document.getElementById("transfer-note").value
  const errorEl = document.getElementById("transfer-error")
  const successEl = document.getElementById("transfer-success")

  pinEntryModal.classList.remove("active")
  showProcessingOverlay("ငွေလွှဲလုပ်ဆောင်နေသည်...")
  updateProcessingStep("step-validate", true)

  try {
    if (userProfileData.payment_pin !== pin) {
      errorEl.textContent = "PIN မှားယွင်းနေပါသည်။"
      errorEl.style.display = "block"
      hideProcessingOverlay()
      return
    }
    updateProcessingStep("step-process", true)

    const { data: transaction, error } = await supabase.rpc("process_transfer", {
      sender_id: currentUser.user_id,
      receiver_id: recipientData.user_id,
      transfer_amount: amount,
      transfer_note: note,
    })

    if (error) throw error

    updateProcessingStep("step-confirm", true)

    userBalance -= amount
    updateUserUI()

    setTimeout(() => {
      hideProcessingOverlay()
      successEl.textContent = `${amount.toLocaleString()} Ks ကို ${recipientData.name || recipientData.phone} သို့ အောင်မြင်စွာ လွှဲပြောင်းပြီးပါပြီ။`
      successEl.style.display = "block"
      showTransactionReceipt(transaction)
      document.getElementById("transfer-form").reset()
      document.getElementById("recipient-check-message").textContent = ""
      sessionStorage.removeItem("transferRecipient")
      speak(`ငွေ ${amount} ကျပ် ${recipientData.name || recipientData.phone} သို့ လွှဲပြောင်းပြီးပါပြီ။`)
    }, 1500)
  } catch (err) {
    logToConsole(`Transfer processing error: ${err.message}`, "error")
    errorEl.textContent = `ငွေလွှဲရာတွင် အမှားရှိနေပါသည်။: ${err.message}`
    errorEl.style.display = "block"
    hideProcessingOverlay()
  }
}

async function handleKycSubmit() {
  const passportNumber = document.getElementById("kyc-passport").value
  const address = document.getElementById("kyc-address").value
  const pin = document.getElementById("kyc-pin").value
  const confirmPin = document.getElementById("kyc-confirm-pin").value
  const passportFile = document.getElementById("passport-upload").files[0]
  const selfieFile = document.getElementById("selfie-upload").files[0]
  const errorEl = document.getElementById("kyc-error")
  const successEl = document.getElementById("kyc-success")

  if (!passportNumber || !address || !pin || !confirmPin || !passportFile || !selfieFile) {
    errorEl.textContent = "အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။"
    errorEl.style.display = "block"
    return
  }
  if (pin !== confirmPin) {
    errorEl.textContent = "PIN နှင့် အတည်ပြု PIN မတူညီပါ။"
    errorEl.style.display = "block"
    return
  }
  if (pin.length !== 6 || !/^\d+$/.test(pin)) {
    errorEl.textContent = "PIN သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။"
    errorEl.style.display = "block"
    return
  }
  showProcessingOverlay("KYC အချက်အလက်များ တင်သွင်းနေသည်...")
  try {
    const uploadFile = async (file, type) => {
      const fileName = `${type}_${currentUser.user_id}_${Date.now()}.${file.name.split(".").pop()}`
      const { data, error } = await supabase.storage.from("kyc-documents").upload(fileName, file)
      if (error) throw error
      const { data: urlData } = supabase.storage.from("kyc-documents").getPublicUrl(fileName)
      return urlData.publicUrl
    }

    const passportUrl = await uploadFile(passportFile, "passport")
    const selfieUrl = await uploadFile(selfieFile, "selfie")

    const { error: updateError } = await supabase
      .from("users")
      .update({
        passport_number: passportNumber,
        address,
        payment_pin: pin,
        passport_image: passportUrl,
        selfie_image: selfieUrl,
        passport_status: "pending",
        submitted_at: new Date().toISOString(),
      })
      .eq("user_id", currentUser.user_id)
    if (updateError) throw updateError

    userKycStatus = "pending"
    updateKycStatusDisplay()
    errorEl.style.display = "none"
    successEl.textContent = "KYC အချက်အလက်များ အောင်မြင်စွာ တင်သွင်းပြီးပါပြီ။ စိစစ်နေပါပြီ။"
    successEl.style.display = "block"
    document.getElementById("kyc-form").reset()
    document.getElementById("passport-preview").innerHTML = ""
    document.getElementById("selfie-preview").innerHTML = ""
  } catch (err) {
    logToConsole(`KYC submission error: ${err.message}`, "error")
    errorEl.textContent = "KYC တင်သွင်းရာတွင် အမှားရှိနေပါသည်။"
    errorEl.style.display = "block"
  } finally {
    hideProcessingOverlay()
  }
}

async function handleChangePassword() {
  /* ... implementation ... */
}
async function handleChangePin() {
  /* ... implementation ... */
}
async function handleDeleteAccount() {
  /* ... implementation ... */
}

function showTransactionReceipt(transaction) {
  const receiptContainer = document.getElementById("receipt-container")
  const isSender = transaction.from_phone === userProfileData.phone
  const logoUrl = "https://github.com/Opper125/opper-payment/raw/main/logo.png"

  receiptContainer.innerHTML = `
        <div class="receipt">
            <div class="receipt-logo-area">
                <div class="opper-logo-container">
                    <img src="${logoUrl}" alt="OPPER Logo" class="opper-logo-img">
                    <span class="opper-logo-text">OPPER Pay</span>
                </div>
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
                    <div class="receipt-detail-value">${transaction.from_name || transaction.from_phone}</div>
                </div>
                <div class="receipt-detail-row">
                    <div class="receipt-detail-label">To</div>
                    <div class="receipt-detail-value">${transaction.to_name || transaction.to_phone}</div>
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
                    <div class="receipt-detail-value">${new Date(transaction.created_at).toLocaleString("my-MM")}</div>
                </div>
            </div>
            <div class="receipt-transaction-id">
                <div class="receipt-transaction-id-label">ငွေလွှဲလုပ်ဆောင်ချက်အမှတ်စဥ်</div>
                <div class="receipt-transaction-id-value">${transaction.id}</div>
            </div>
            <div class="receipt-footer">
                OPPER Payment ကိုအသုံးပြုသည့်အတွက် ကျေးဇူးတင်ပါသည်။
            </div>
        </div>`
  receiptModal.classList.add("active")
}

function downloadReceipt() {
  const receiptElement = document.getElementById("receipt-container")
  if (!receiptElement) return
  html2canvas(receiptElement, { scale: 2, backgroundColor: "#ffffff" })
    .then((canvas) => {
      const link = document.createElement("a")
      link.download = `OPPER-Receipt-${Date.now()}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
      showToast("ပြေစာကို ဒေါင်းလုဒ်လုပ်ပြီးပါပြီ။", "success")
    })
    .catch((err) => {
      logToConsole(`Error downloading receipt: ${err.message}`, "error")
      showToast("ပြေစာ ဒေါင်းလုဒ်လုပ်ရာတွင် အမှားဖြစ်ပေါ်နေပါသည်။", "error")
    })
}

function simulateGoogleAuth(type) {
  // This is a simplified simulation.
  showToast("Google အကောင့်ဖြင့် ချိတ်ဆက်ခြင်းကို မကြာမီရရှိနိုင်ပါမည်။", "info")
}

function generateUserId(email) {
  const namePart = email
    .split("@")[0]
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 5)
  const randomPart = Math.random().toString(36).substring(2, 7)
  return `${namePart}${randomPart}`.toUpperCase()
}

function showPage(pageName) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"))
  document.getElementById(`${pageName}-page`).classList.add("active")
  document.querySelectorAll(".sidebar-nav li").forEach((li) => li.classList.remove("active"))
  const activeLink = document.querySelector(`.sidebar-nav a[data-page="${pageName}"]`)
  if (activeLink) {
    activeLink.parentElement.classList.add("active")
  }
  if (window.innerWidth < 992) document.getElementById("sidebar").classList.remove("active")

  if (pageName === "receive") generateUserQRCode()
  if (pageName === "announcements") displayAnnouncements(announcements, "full-announcements-list")
}

function logout() {
  currentUser = null
  userProfileData = null
  localStorage.removeItem("opperSession")
  showAuthContainer()
  logToConsole("User logged out.")
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
function showPinEntryModal() {
  pinEntryModal.classList.add("active")
}

function showProcessingOverlay(message) {
  document.getElementById("processing-message").textContent = message
  processingOverlay.classList.add("active")
  document.querySelectorAll(".processing-steps .step").forEach((s) => s.classList.remove("active"))
}
function updateProcessingStep(stepId, isActive) {
  const stepEl = document.getElementById(stepId)
  if (stepEl) {
    if (isActive) stepEl.classList.add("active")
    else stepEl.classList.remove("active")
  }
}
function hideProcessingOverlay() {
  processingOverlay.classList.remove("active")
}

document.getElementById("scan-qr-btn")?.addEventListener("click", () => {
  showToast("QR Code စကင်ဖတ်ခြင်း လုပ်ဆောင်ချက်ကို မကြာမီထည့်သွင်းပါမည်။", "info")
  logToConsole("QR Scan button clicked - feature not yet implemented.")
})
