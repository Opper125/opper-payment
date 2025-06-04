// Supabase Configuration
const supabaseUrl = "https://vtsczzlnhsrgnbkfyizi.supabase.co"
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68"
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, { fetch: (...args) => fetch(...args) })

// Global Variables
let currentUser = null
let userBalance = 0
let userKycStatus = "pending" // 'pending', 'approved', 'rejected'
let transfersEnabled = true
let currentTheme = localStorage.getItem("theme") || "dark"
let transactions = []
let posts = []
let gifts = [] // Unclaimed gifts for the current user
let autoSaveReceipt = localStorage.getItem("autoSaveReceipt") === "true"
let realtimeChannels = [] // Store channels for cleanup

// DOM Elements
const loader = document.getElementById("loader")
const authContainer = document.getElementById("auth-container")
const appContainer = document.getElementById("app-container")
const pinEntryModal = document.getElementById("pin-entry-modal")
const receiptModal = document.getElementById("receipt-modal")
const processingOverlay = document.getElementById("processing-overlay")
const notificationDropdown = document.getElementById("notification-dropdown")
const notificationBadge = document.getElementById("notification-badge")
const postsContainer = document.getElementById("posts-container")
const notificationListContainer = document.getElementById("notification-list-container")

// Audio Elements
const transferSentSound = document.getElementById("transfer-sent-sound")
const transferReceivedSound = document.getElementById("transfer-received-sound")
const clickSound = document.getElementById("click-sound")
const notificationSound = document.getElementById("notification-sound")

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
  document.body.setAttribute("data-theme", currentTheme)
  showLoader()
  await checkSession()
  initializeUI()
  setTimeout(hideLoader, 1500) // Give a bit of time for initial rendering
})

function playClickSound() {
  if (clickSound && clickSound.readyState >= 2) {
    // Check if audio is ready
    clickSound.currentTime = 0
    clickSound.play().catch((error) => console.warn("Click sound play failed:", error))
  }
}

function playNotificationSound() {
  if (notificationSound && notificationSound.readyState >= 2) {
    notificationSound.currentTime = 0
    notificationSound.play().catch((error) => console.warn("Notification sound play failed:", error))
  }
}

async function checkSession() {
  try {
    const session = localStorage.getItem("opperSession")
    if (session) {
      const sessionData = JSON.parse(session)
      // Validate session data structure
      if (!sessionData.email || !sessionData.user_id) {
        localStorage.removeItem("opperSession")
        showAuthContainer()
        return
      }
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
    localStorage.removeItem("opperSession") // Clear corrupted session
    showAuthContainer()
  }
}

async function loadUserData() {
  try {
    if (!currentUser || !currentUser.user_id) return

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*, auth_users(email)") // Join to get email if needed, or use currentUser.email
      .eq("user_id", currentUser.user_id)
      .single()

    if (userError) throw userError
    if (!userData) {
      // Handle case where user profile might not exist yet
      console.warn("User profile data not found for user_id:", currentUser.user_id)
      // Potentially create a default profile or log out
      logout() // Or handle more gracefully
      return
    }

    userBalance = userData.balance || 0
    userKycStatus = userData.passport_status || "pending"
    currentUser.phone = userData.phone
    currentUser.name = userData.name // Assuming 'name' field exists in 'users' table

    updateUserUI(userData)

    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("allow_transfers")
      .eq("id", 1) // Assuming settings table has a single row with id 1
      .single()

    if (settingsError) {
      console.warn("Could not load app settings:", settingsError.message)
      // Default to transfers enabled or handle as critical error
      transfersEnabled = true
    } else if (settings) {
      transfersEnabled = settings.allow_transfers
    }
    updateTransferStatus()

    await Promise.all([loadTransactions(), loadPosts(), loadGifts()])
    setupRealtimeSubscriptions()
  } catch (error) {
    console.error("Load user data error:", error)
    showToast("Error loading user data. Please try refreshing.", "error")
  }
}

function updateUserUI(userData) {
  const userInitial = (currentUser.name ? currentUser.name.charAt(0) : currentUser.email.charAt(0)).toUpperCase()
  const userName = currentUser.name || currentUser.email.split("@")[0]

  document.getElementById("user-initial").textContent = userInitial
  document.getElementById("user-initial-sidebar").textContent = userInitial
  document.getElementById("user-name").textContent = userName
  document.getElementById("user-name-sidebar").textContent = userName
  document.getElementById("user-id").textContent = `ID: ${currentUser.user_id}`
  document.getElementById("user-id-sidebar").textContent = `ID: ${currentUser.user_id}`
  document.getElementById("greeting-name").textContent = userName

  document.getElementById("user-balance").textContent = `လက်ကျန်ငွေ: ${userBalance.toLocaleString()} Ks`
  document.getElementById("balance-amount").textContent = `${userBalance.toLocaleString()} Ks`

  updateKycStatus(userData) // Pass userData to kyc status

  document.getElementById("settings-phone").value = userData.phone || ""
  document.getElementById("settings-email").value = currentUser.email || ""
  const settingsNameEl = document.getElementById("settings-name") // Assuming you have this element
  if (settingsNameEl) settingsNameEl.value = currentUser.name || ""

  const autoSaveToggle = document.getElementById("auto-save-receipt")
  if (autoSaveToggle) autoSaveToggle.checked = autoSaveReceipt
}

function updateKycStatus(userData) {
  // Accept userData
  const kycStatusElement = document.getElementById("kyc-status")
  const kycStatusCard = document.getElementById("kyc-status-card")
  const kycForm = document.getElementById("kyc-form")
  const kycStatusMessage = document.getElementById("kyc-status-message")
  const kycStatusIcon = document.querySelector("#kyc-status-card .kyc-status-icon")

  if (!kycStatusElement || !kycStatusCard || !kycStatusMessage || !kycStatusIcon) return

  kycStatusIcon.className = "kyc-status-icon" // Reset classes
  let iconHtml = ""
  let formDisplay = "block" // Default for pending/rejected

  if (userKycStatus === "approved") {
    kycStatusElement.textContent = "KYC: အတည်ပြုပြီး"
    kycStatusMessage.textContent = "သင့် KYC အတည်ပြုပြီးဖြစ်ပါသည်။"
    kycStatusIcon.classList.add("approved")
    iconHtml = '<i class="fas fa-check-circle"></i><div class="status-pulse"></div>'
    formDisplay = "none"
  } else if (userKycStatus === "rejected") {
    kycStatusElement.textContent = "KYC: ငြင်းပယ်ခံရသည်"
    kycStatusMessage.textContent = "သင့် KYC ငြင်းပယ်ခံရပါသည်။ ကျေးဇူးပြု၍ အချက်အလက်များ ပြန်လည်စစ်ဆေးပြီး ထပ်မံတင်သွင်းပါ။"
    kycStatusIcon.classList.add("rejected")
    iconHtml = '<i class="fas fa-times-circle"></i><div class="status-pulse"></div>'
  } else {
    // 'pending' or other states
    kycStatusElement.textContent = "KYC: စောင့်ဆိုင်းဆဲ"
    kycStatusMessage.textContent = "သင့် KYC အချက်အလက်များ စိစစ်နေဆဲဖြစ်ပါသည်။"
    kycStatusIcon.classList.add("pending")
    iconHtml = '<i class="fas fa-clock"></i><div class="status-pulse"></div>'
    // Hide form if already submitted and pending, using passed userData
    if (currentUser && kycForm && userData && userData.passport_number && userData.passport_image) {
      formDisplay = "none"
    }
  }
  kycStatusIcon.innerHTML = iconHtml
  if (kycForm) kycForm.style.display = formDisplay
}

function updateTransferStatus() {
  const transferStatusElement = document.getElementById("transfer-status")
  if (!transferStatusElement || !transferStatusElement.parentElement) return
  const parentElement = transferStatusElement.parentElement
  if (transfersEnabled) {
    transferStatusElement.textContent = "ငွေလွှဲခြင်း: ခွင့်ပြုထားသည်"
    parentElement.classList.remove("disabled")
    parentElement.classList.add("enabled")
  } else {
    transferStatusElement.textContent = "ငွေလွှဲခြင်း: ပိတ်ထားသည်"
    parentElement.classList.remove("enabled")
    parentElement.classList.add("disabled")
  }
}

function setupRealtimeSubscriptions() {
  if (!currentUser || !currentUser.user_id) return

  // Clean up existing channels
  realtimeChannels.forEach((channel) => {
    supabase.removeChannel(channel)
  })
  realtimeChannels = []

  // User data updates (balance, KYC, name)
  const userChannel = supabase
    .channel(`user-updates-${currentUser.user_id}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "users", filter: `user_id=eq.${currentUser.user_id}` },
      (payload) => {
        const oldBalance = userBalance
        if (payload.new.balance !== undefined) userBalance = payload.new.balance
        if (payload.new.passport_status !== undefined) userKycStatus = payload.new.passport_status
        if (payload.new.name !== undefined) currentUser.name = payload.new.name

        updateUserUI(payload.new) // Update general UI, passing the new payload

        if (payload.new.balance > oldBalance && !payload.new.is_gift_claim) {
          // Avoid double sound for gift claims
          const amountReceived = payload.new.balance - oldBalance
          if (transferReceivedSound) transferReceivedSound.play().catch((e) => console.warn("Received sound failed", e))
          speakAmountReceived(amountReceived)
          showToast(`${amountReceived.toLocaleString()} Ks လက်ခံရရှိပါသည်`, "success")
        }
      },
    )
    .subscribe()
  realtimeChannels.push(userChannel)

  // Settings updates (allow_transfers)
  const settingsChannel = supabase
    .channel("settings-updates")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, (payload) => {
      if (payload.new.allow_transfers !== undefined && payload.new.allow_transfers !== transfersEnabled) {
        transfersEnabled = payload.new.allow_transfers
        updateTransferStatus()
        showToast(`Transfer status updated: ${transfersEnabled ? "Enabled" : "Disabled"}`, "info")
      }
    })
    .subscribe()
  realtimeChannels.push(settingsChannel)

  // New transactions for the user
  const transactionsChannel = supabase
    .channel(`transactions-updates-${currentUser.user_id}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, (payload) => {
      if (
        currentUser.phone &&
        (payload.new.from_phone === currentUser.phone || payload.new.to_phone === currentUser.phone)
      ) {
        loadTransactions() // Reload and update UI
      }
    })
    .subscribe()
  realtimeChannels.push(transactionsChannel)

  // New posts (public)
  const postsChannel = supabase
    .channel("public-posts")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (payload) => {
      posts.unshift(payload.new) // Add to local cache
      if (document.getElementById("posts-page")?.classList.contains("active")) {
        renderPosts() // Re-render if on posts page
      }
      showToast("New post available!", "info")
      playNotificationSound()
    })
    .subscribe()
  realtimeChannels.push(postsChannel)

  // New gifts for the current user
  const giftsChannel = supabase
    .channel(`user-gifts-${currentUser.user_id}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "gifts", filter: `user_id=eq.${currentUser.user_id}` },
      (payload) => {
        gifts.unshift(payload.new) // Add to local cache
        updateNotificationUI() // Update notification bell
        playNotificationSound()
        showToast(
          `You received a new gift: ${payload.new.message || payload.new.amount.toLocaleString() + " Ks"}!`,
          "success",
        )
      },
    )
    .subscribe()
  realtimeChannels.push(giftsChannel)
}

function speakAmountReceived(amount) {
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(`Kyats ${amount.toLocaleString()} received.`)
    // utterance.lang = 'my-MM'; // Optional: Check browser support for Burmese
    speechSynthesis.speak(utterance)
  } else {
    console.warn("Speech synthesis not supported.")
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
      .limit(20) // Load more for history page

    if (error) throw error
    transactions = transactionsData || []
    updateTransactionsUI(transactions, currentUser.phone)
  } catch (error) {
    console.error("Load transactions error:", error)
    showToast("Error loading transactions.", "error")
  }
}

function updateTransactionsUI(transactionsData, userPhone) {
  const recentTransactionsList = document.getElementById("recent-transactions-list")
  const historyTransactionsList = document.getElementById("history-transactions-list")

  if (recentTransactionsList) recentTransactionsList.innerHTML = ""
  if (historyTransactionsList) historyTransactionsList.innerHTML = ""

  if (!transactionsData || transactionsData.length === 0) {
    const emptyState = `<div class="empty-state"><i class="fas fa-history"></i><p>လုပ်ဆောင်ချက်မှတ်တမ်းမရှိသေးပါ</p></div>`
    if (recentTransactionsList) recentTransactionsList.innerHTML = emptyState
    if (historyTransactionsList) historyTransactionsList.innerHTML = emptyState
    return
  }

  transactionsData.forEach((transaction, index) => {
    const isSender = transaction.from_phone === userPhone
    const otherPartyName = isSender ? transaction.to_name : transaction.from_name
    const otherPartyPhone = isSender ? transaction.to_phone : transaction.from_phone
    const transactionDate = new Date(transaction.created_at).toLocaleString("my-MM", {
      // Burmese locale
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

    const transactionItemHTML = `
      <div class="transaction-item ${isSender ? "sent" : "received"} clickable" data-transaction-id="${transaction.id}">
          <div class="transaction-icon"><i class="fas ${isSender ? "fa-paper-plane" : "fa-check-circle"}"></i></div>
          <div class="transaction-details">
              <div class="transaction-title">${isSender ? "ပို့ထားသော" : "လက်ခံရရှိသော"} - ${otherPartyName || otherPartyPhone}</div>
              <div class="transaction-subtitle">${transaction.note ? `"${transaction.note}"` : "No note"}</div>
              <div class="transaction-date">${transactionDate}</div>
          </div>
          <div class="transaction-actions">
              <div class="transaction-amount ${isSender ? "negative" : "positive"}">
                  ${isSender ? "-" : "+"} ${transaction.amount.toLocaleString()} Ks
              </div>
              <button class="transaction-view-btn clickable" data-transaction-id="${transaction.id}"><i class="fas fa-eye"></i></button>
          </div>
      </div>`
    if (recentTransactionsList && index < 5) recentTransactionsList.innerHTML += transactionItemHTML // Show 5 in recent
    if (historyTransactionsList) historyTransactionsList.innerHTML += transactionItemHTML
  })

  // Add event listeners after HTML is populated
  document.querySelectorAll(".transaction-view-btn, .transaction-item").forEach((element) => {
    // Remove old listener if any to prevent multiple bindings
    const newElement = element.cloneNode(true)
    element.parentNode.replaceChild(newElement, element)

    newElement.addEventListener("click", (e) => {
      e.stopPropagation() // Prevent multiple triggers if nested
      playClickSound()
      const transactionId =
        newElement.dataset.transactionId || newElement.closest(".transaction-item")?.dataset.transactionId
      const selectedTransaction = transactions.find((t) => t.id === transactionId)
      if (selectedTransaction) {
        showTransactionReceipt(selectedTransaction)
      }
    })
  })
}

async function loadPosts() {
  try {
    const { data, error } = await supabase.from("posts").select("*").order("created_at", { ascending: false })
    if (error) throw error
    posts = data || []
    renderPosts()
  } catch (error) {
    console.error("Error loading posts:", error)
    if (postsContainer)
      postsContainer.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>ပို့စ်များ တင်ရာတွင် အမှားဖြစ်ပွားပါသည်</p></div>`
    showToast("Error loading posts.", "error")
  }
}

function renderPosts() {
  if (!postsContainer) return
  if (posts.length === 0) {
    postsContainer.innerHTML = `<div class="empty-state"><i class="fas fa-newspaper"></i><p>ပို့စ်များ မရှိသေးပါ</p></div>`
    return
  }

  postsContainer.innerHTML = posts
    .map((post) => {
      const postDate = new Date(post.created_at).toLocaleString("my-MM", { dateStyle: "medium", timeStyle: "short" })
      let contentHTML = ""

      switch (post.type) {
        case "text":
          contentHTML = `<div class="post-item-content-text">${post.content_text || ""}</div>`
          break
        case "image":
          contentHTML = `
          <div class="post-item-image-container">
              <img src="${post.file_url}" alt="${post.title || "Post Image"}" class="post-item-image">
          </div>
          ${post.content_text ? `<div class="post-item-content-text">${post.content_text}</div>` : ""}`
          break
        case "video_url":
          let videoEmbedUrl = post.file_url
          if (post.file_url.includes("youtube.com/watch?v=")) {
            videoEmbedUrl = post.file_url.replace("watch?v=", "embed/")
          } else if (post.file_url.includes("youtu.be/")) {
            videoEmbedUrl = post.file_url.replace("youtu.be/", "youtube.com/embed/")
          } // Add more providers if needed (Vimeo, etc.)
          contentHTML = `
          <div class="post-item-video-container">
              <iframe src="${videoEmbedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
          </div>
           ${post.content_text ? `<div class="post-item-content-text">${post.content_text}</div>` : ""}`
          break
        case "audio_file":
          contentHTML = `
          <div class="post-item-audio-container">
              <audio controls src="${post.file_url}"></audio>
          </div>
          ${post.content_text ? `<div class="post-item-content-text">${post.content_text}</div>` : ""}`
          break
        case "apk_file":
        case "file":
          contentHTML = `
          ${post.content_text ? `<div class="post-item-content-text">${post.content_text}</div>` : ""}
          <div class="post-item-file-download">
              <a href="${post.file_url}" download="${post.file_name || "download"}" class="btn btn-primary clickable">
                  <i class="fas fa-download"></i> ${post.file_name || post.title || "Download File"}
                  ${post.file_size ? `(${(post.file_size / 1024 / 1024).toFixed(2)} MB)` : ""}
              </a>
          </div>`
          break
        default:
          contentHTML = `<div class="post-item-content-text">Unsupported post type.</div>`
      }

      return `
      <div class="post-item">
          <div class="post-item-header">
              <h3 class="post-item-title">${post.title}</h3>
              <p class="post-item-meta">Posted on: ${postDate}</p>
          </div>
          ${contentHTML}
      </div>
    `
    })
    .join("")
}

async function loadGifts() {
  try {
    if (!currentUser || !currentUser.user_id) return
    const { data, error } = await supabase
      .from("gifts")
      .select("*")
      .eq("user_id", currentUser.user_id)
      .eq("is_claimed", false) // Only load unclaimed gifts
      .order("created_at", { ascending: false })

    if (error) throw error
    gifts = data || [] // Update global gifts array
    updateNotificationUI()
  } catch (error) {
    console.error("Error loading gifts:", error)
    showToast("Error loading gift notifications.", "error")
  }
}

function updateNotificationUI() {
  if (!notificationListContainer || !notificationBadge) return

  const unclaimedGifts = gifts.filter((gift) => !gift.is_claimed) // Use the global gifts array
  notificationBadge.textContent = unclaimedGifts.length
  notificationBadge.style.display = unclaimedGifts.length > 0 ? "flex" : "none"

  if (unclaimedGifts.length === 0) {
    notificationListContainer.innerHTML = `
      <div class="empty-state small">
          <i class="fas fa-bell-slash"></i>
          <p>အသိပေးချက်များ မရှိသေးပါ</p>
      </div>`
    return
  }

  notificationListContainer.innerHTML = unclaimedGifts
    .map((gift) => {
      const giftDate = new Date(gift.created_at).toLocaleString("my-MM", { dateStyle: "short", timeStyle: "short" })
      return `
      <div class="notification-item">
          <div class="notification-item-content">
              <h4 class="notification-title"><i class="fas fa-gift"></i> ${gift.message || "New Gift!"}</h4>
              <p class="notification-description">You received ${gift.amount.toLocaleString()} Ks.</p>
              <p class="notification-timestamp">${giftDate}</p>
          </div>
          <button class="btn btn-sm btn-success btn-claim-gift clickable" data-gift-id="${gift.id}" data-amount="${gift.amount}">
              <i class="fas fa-check-circle"></i> လက်ဆောင်ရယူမည် (${gift.amount.toLocaleString()} Ks)
          </button>
      </div>
    `
    })
    .join("")

  // Re-attach event listeners for new claim buttons
  notificationListContainer.querySelectorAll(".btn-claim-gift").forEach((button) => {
    button.addEventListener("click", async (e) => {
      e.stopPropagation()
      playClickSound()
      const giftId = e.currentTarget.dataset.giftId
      const amount = Number.parseFloat(e.currentTarget.dataset.amount)
      await claimGift(giftId, amount)
    })
  })
}

async function claimGift(giftId, amount) {
  if (!currentUser || !currentUser.user_id) return
  showProcessingOverlay("Claiming gift...")
  try {
    // Use the claim_gift function from the database
    const { data, error } = await supabase.rpc("claim_gift", {
      gift_uuid: giftId,
      claiming_user_id: currentUser.user_id,
    })

    if (error) throw new Error(`Gift claim error: ${error.message}`)

    if (!data || !data.success) {
      throw new Error(data?.message || "Failed to claim gift")
    }

    // Update local state
    userBalance += amount
    updateUserUI({ ...currentUser, balance: userBalance })

    showToast(
      `Gift of ${amount.toLocaleString()} Ks claimed! Your new balance is ${userBalance.toLocaleString()} Ks.`,
      "success",
    )
    if (transferReceivedSound) transferReceivedSound.play().catch((e) => console.warn("Received sound failed", e))
    speakAmountReceived(amount)

    // Remove the claimed gift from the local 'gifts' array and update UI
    gifts = gifts.filter((gift) => gift.id !== giftId)
    updateNotificationUI()
  } catch (error) {
    console.error("Error claiming gift:", error)
    showToast(`Error claiming gift: ${error.message}`, "error")
  } finally {
    hideProcessingOverlay()
  }
}

function initializeUI() {
  // Auth Tabs
  const authTabs = document.querySelectorAll(".auth-tab")
  const authForms = document.querySelectorAll(".auth-form")
  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      playClickSound()
      const tabName = tab.dataset.tab
      authTabs.forEach((t) => t.classList.remove("active"))
      tab.classList.add("active")
      authForms.forEach((form) => form.classList.toggle("active", form.id === `${tabName}-form`))
      const indicator = document.querySelector(".tab-indicator")
      if (indicator)
        indicator.style.transform = tabName === "signup" ? `translateX(calc(100% + 4px))` : `translateX(0%)`
    })
  })

  // Toggle Password Visibility
  document.querySelectorAll(".toggle-password").forEach((button) => {
    button.addEventListener("click", () => {
      playClickSound()
      const input = button.previousElementSibling
      input.type = input.type === "password" ? "text" : "password"
      button.classList.toggle("fa-eye-slash")
      button.classList.toggle("fa-eye")
    })
  })

  // Sidebar Navigation
  const sidebarLinks = document.querySelectorAll(".sidebar-nav a")
  const pages = document.querySelectorAll(".page")
  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault()
      playClickSound()
      const pageName = link.dataset.page
      sidebarLinks.forEach((l) => l.parentElement.classList.remove("active"))
      link.parentElement.classList.add("active")
      pages.forEach((page) => page.classList.toggle("active", page.id === `${pageName}-page`))
      if (pageName === "posts" && document.getElementById("posts-page")?.classList.contains("active")) {
        loadPosts() // Load posts when navigating to the page
      }
      if (window.innerWidth < 992 && document.getElementById("sidebar").classList.contains("active")) {
        document.getElementById("sidebar").classList.remove("active") // Close sidebar on mobile
      }
    })
  })

  // Action Cards Navigation
  document.querySelectorAll(".action-card").forEach((card) => {
    card.addEventListener("click", () => {
      playClickSound()
      const pageName = card.dataset.page
      sidebarLinks.forEach((link) => link.parentElement.classList.toggle("active", link.dataset.page === pageName))
      pages.forEach((page) => page.classList.toggle("active", page.id === `${pageName}-page`))
      if (pageName === "posts" && document.getElementById("posts-page")?.classList.contains("active")) {
        loadPosts()
      }
    })
  })

  // Sidebar Toggle
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

  // Profile Dropdown
  const profileDropdownTrigger = document.getElementById("profile-dropdown-trigger")
  const profileDropdownMenu = document.getElementById("profile-dropdown")
  if (profileDropdownTrigger && profileDropdownMenu) {
    profileDropdownTrigger.addEventListener("click", (e) => {
      e.stopPropagation()
      playClickSound()
      const isActive = profileDropdownMenu.classList.toggle("active")
      if (isActive) {
        const rect = profileDropdownTrigger.getBoundingClientRect()
        profileDropdownMenu.style.top = `${rect.bottom + 10}px`
        profileDropdownMenu.style.right = `${window.innerWidth - rect.right}px`
      }
    })
  }

  // Notification Dropdown (notificationDropdown is global for content area)
  const notificationBellTrigger = document.getElementById("notification-bell-trigger")
  if (notificationBellTrigger && notificationDropdown) {
    notificationBellTrigger.addEventListener("click", (e) => {
      e.stopPropagation()
      playClickSound()
      const isActive = notificationDropdown.classList.toggle("active")
      if (isActive) {
        const rect = notificationBellTrigger.getBoundingClientRect()
        notificationDropdown.style.top = `${rect.bottom + 10}px`
        notificationDropdown.style.right = `${window.innerWidth - rect.right}px`
        loadGifts() // Refresh gifts when opening
      }
    })
  }

  // Close dropdowns on outside click
  document.addEventListener("click", (e) => {
    if (
      profileDropdownMenu &&
      profileDropdownMenu.classList.contains("active") &&
      profileDropdownTrigger && // Check if trigger exists
      !profileDropdownTrigger.contains(e.target) &&
      !profileDropdownMenu.contains(e.target)
    ) {
      profileDropdownMenu.classList.remove("active")
    }
    if (
      notificationDropdown &&
      notificationDropdown.classList.contains("active") &&
      notificationBellTrigger && // Check if trigger exists
      !notificationBellTrigger.contains(e.target) &&
      !notificationDropdown.contains(e.target)
    ) {
      notificationDropdown.classList.remove("active")
    }
  })

  // Profile Dropdown Actions & Logout
  document.getElementById("view-profile")?.addEventListener("click", () => {
    playClickSound()
    showPage("settings")
    if (profileDropdownMenu) profileDropdownMenu.classList.remove("active")
  })
  document.getElementById("go-to-settings")?.addEventListener("click", () => {
    playClickSound()
    showPage("settings")
    if (profileDropdownMenu) profileDropdownMenu.classList.remove("active")
  })
  document.getElementById("dropdown-logout")?.addEventListener("click", () => {
    playClickSound()
    logout()
  })
  document.getElementById("logout-btn")?.addEventListener("click", () => {
    playClickSound()
    logout()
  })

  // Balance Actions
  document.getElementById("refresh-balance")?.addEventListener("click", async () => {
    playClickSound()
    showProcessingOverlay("Refreshing...")
    await loadUserData()
    hideProcessingOverlay()
  })
  document.getElementById("hide-balance")?.addEventListener("click", () => {
    playClickSound()
    const balanceAmountEl = document.getElementById("balance-amount")
    const eyeIcon = document.querySelector("#hide-balance i")
    const isHidden = balanceAmountEl.classList.toggle("hidden-balance")
    balanceAmountEl.textContent = isHidden ? "•••••• Ks" : `${userBalance.toLocaleString()} Ks`
    if (eyeIcon) {
      eyeIcon.classList.toggle("fa-eye", isHidden)
      eyeIcon.classList.toggle("fa-eye-slash", !isHidden)
    }
  })

  // File Input Previews
  document.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      const file = e.target.files[0]
      if (!file) return
      const previewId = input.id.replace("-upload", "-preview")
      const previewElement = document.getElementById(previewId)
      if (!previewElement) return
      const reader = new FileReader()
      reader.onload = (event) => {
        previewElement.innerHTML = `<img src="${event.target.result}" alt="Preview" style="max-width:100%; max-height:150px; object-fit:cover;">`
      }
      reader.readAsDataURL(file)
    })
  })

  // Theme Switcher
  const themeOptions = document.querySelectorAll(".theme-option")
  themeOptions.forEach((option) => {
    if (option.dataset.theme === currentTheme) option.classList.add("active")
    option.addEventListener("click", () => {
      playClickSound()
      const theme = option.dataset.theme
      themeOptions.forEach((o) => o.classList.remove("active"))
      option.classList.add("active")
      document.body.setAttribute("data-theme", theme)
      localStorage.setItem("theme", theme)
      currentTheme = theme
    })
  })

  // Modals
  const modalTriggers = {
    "change-password-btn": "change-password-modal",
    "change-pin-btn": "change-pin-modal",
    "delete-account-btn": "delete-account-modal",
  }
  Object.entries(modalTriggers).forEach(([triggerId, modalId]) => {
    document.getElementById(triggerId)?.addEventListener("click", () => {
      playClickSound()
      document.getElementById(modalId)?.classList.add("active")
    })
  })
  document.querySelectorAll(".modal-close, .modal-cancel").forEach((button) => {
    button.addEventListener("click", () => {
      playClickSound()
      button.closest(".modal")?.classList.remove("active")
    })
  })
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        playClickSound()
        modal.classList.remove("active")
      }
    })
  })

  setupPinInputs()

  document.getElementById("download-receipt")?.addEventListener("click", () => {
    playClickSound()
    downloadReceipt()
  })

  const autoSaveToggle = document.getElementById("auto-save-receipt")
  if (autoSaveToggle) {
    autoSaveToggle.checked = autoSaveReceipt
    autoSaveToggle.addEventListener("change", (e) => {
      playClickSound()
      autoSaveReceipt = e.target.checked
      localStorage.setItem("autoSaveReceipt", autoSaveReceipt.toString())
      showToast(`Auto-save receipts ${autoSaveReceipt ? "enabled" : "disabled"}.`, "info")
    })
  }

  document.querySelectorAll(".clickable:not([data-click-sound-bound])").forEach((el) => {
    el.addEventListener("click", playClickSound)
    el.setAttribute("data-click-sound-bound", "true")
  })

  setupFormSubmissions()
}

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
  document.getElementById("cancel-pin-btn")?.addEventListener("click", () => {
    playClickSound()
    pinEntryModal.classList.remove("active")
  })
}

function setupFormSubmissions() {
  // Login Form
  document.getElementById("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault()
    playClickSound()
    const email = document.getElementById("login-email").value
    const password = document.getElementById("login-password").value
    const errorElement = document.getElementById("login-error")
    const successElement = document.getElementById("login-success")

    if (!email || !password) {
      errorElement.textContent = "အီးမေးလ်နှင့် စကားဝှက် ထည့်ပါ။"
      errorElement.style.display = "block"
      if (successElement) successElement.style.display = "none"
      return
    }
    showProcessingOverlay("Logging in...")
    try {
      const { data: user, error } = await supabase.from("auth_users").select("*").eq("email", email).single()
      if (error || !user) {
        errorElement.textContent = "အကောင့်မတွေ့ရှိပါ။"
        throw new Error("User not found")
      }
      if (user.password !== password) {
        // Insecure: Compare hashed passwords in a real app
        errorElement.textContent = "စကားဝှက်မှားယွင်းနေပါသည်။"
        throw new Error("Invalid password")
      }

      currentUser = user
      localStorage.setItem("opperSession", JSON.stringify({ email: user.email, user_id: user.user_id }))
      errorElement.style.display = "none"
      if (successElement) {
        successElement.textContent = "အကောင့်ဝင်ရောက်နေပါသည်..."
        successElement.style.display = "block"
      }
      await loadUserData()
      showAppContainer()
    } catch (err) {
      console.error("Login error:", err)
      if (!errorElement.textContent) errorElement.textContent = "အကောင့်ဝင်ရာတွင် အမှားရှိနေပါသည်။" // Keep specific error if already set
      errorElement.style.display = "block"
      if (successElement) successElement.style.display = "none"
    } finally {
      hideProcessingOverlay()
    }
  })

  // Signup Form
  document.getElementById("signup-form")?.addEventListener("submit", async (e) => {
    e.preventDefault()
    playClickSound()
    const name = document.getElementById("signup-name").value
    const email = document.getElementById("signup-email").value
    const phone = document.getElementById("signup-phone").value
    const password = document.getElementById("signup-password").value
    const confirmPassword = document.getElementById("signup-confirm-password").value
    const termsAgree = document.getElementById("terms-agree").checked
    const errorElement = document.getElementById("signup-error")
    const successElement = document.getElementById("signup-success")

    if (!name || !email || !phone || !password || !confirmPassword) {
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

    showProcessingOverlay("Signing up...")
    try {
      const { data: existingUserByEmail } = await supabase
        .from("auth_users")
        .select("email")
        .eq("email", email)
        .maybeSingle()
      if (existingUserByEmail) {
        errorElement.textContent = "ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
        throw new Error("Email exists")
      }
      const { data: existingUserByPhone } = await supabase
        .from("users")
        .select("phone")
        .eq("phone", phone)
        .maybeSingle()
      if (existingUserByPhone) {
        errorElement.textContent = "ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်။"
        throw new Error("Phone exists")
      }

      const userId = generateUserId(email)
      const { error: authError } = await supabase
        .from("auth_users")
        .insert([{ user_id: userId, email, password /* HASH THIS! */ }])
        .select()
        .single()
      if (authError) throw authError
      const { error: profileError } = await supabase
        .from("users")
        .insert([{ user_id: userId, name, phone, balance: 0, passport_status: "pending" }])
      if (profileError) throw profileError

      errorElement.style.display = "none"
      successElement.textContent = "အကောင့်ဖွင့်ပြီးပါပြီ။ အကောင့်ဝင်နိုင်ပါပြီ။"
      successElement.style.display = "block"
      document.getElementById("signup-form").reset()
      setTimeout(() => document.querySelector('.auth-tab[data-tab="login"]')?.click(), 2000)
    } catch (err) {
      console.error("Signup error:", err)
      if (!errorElement.textContent) errorElement.textContent = "အကောင့်ဖွင့်ရာတွင် အမှားရှိနေပါသည်။"
      errorElement.style.display = "block"
      successElement.style.display = "none"
    } finally {
      hideProcessingOverlay()
    }
  })

  // Transfer Form (Button click leads to PIN modal)
  document.getElementById("transfer-btn")?.addEventListener("click", async () => {
    playClickSound()
    const phone = document.getElementById("transfer-phone").value
    const amount = Number.parseFloat(document.getElementById("transfer-amount").value)
    const errorElement = document.getElementById("transfer-error")
    const successElement = document.getElementById("transfer-success")

    if (successElement) successElement.style.display = "none" // Clear previous success

    if (!phone || !amount) {
      errorElement.textContent = "ဖုန်းနံပါတ်နှင့် ငွေပမာဏ ထည့်ပါ။"
      errorElement.style.display = "block"
      return
    }
    if (amount < 1000) {
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
    if (currentUser.phone === phone) {
      errorElement.textContent = "ကိုယ့်ကိုယ်ကို ငွေလွှဲ၍မရပါ။"
      errorElement.style.display = "block"
      return
    }

    try {
      const { data: recipient, error: recipientError } = await supabase
        .from("users")
        .select("user_id, name, phone")
        .eq("phone", phone)
        .single()
      if (recipientError || !recipient) {
        errorElement.textContent = "လက်ခံမည့်သူ မတွေ့ရှိပါ။"
        errorElement.style.display = "block"
        return
      }

      pinEntryModal.dataset.recipientName = recipient.name || recipient.phone
      pinEntryModal.dataset.recipientPhone = recipient.phone
      pinEntryModal.dataset.transferAmount = amount.toString()

      errorElement.style.display = "none"
      showPinEntryModal()
    } catch (err) {
      console.error("Recipient check error:", err)
      errorElement.textContent = "လက်ခံမည့်သူအား စစ်ဆေးရာတွင် အမှားဖြစ်ပွားပါသည်။"
      errorElement.style.display = "block"
    }
  })

  // KYC Form
  document.getElementById("kyc-form")?.addEventListener("submit", async (e) => {
    e.preventDefault()
    playClickSound()
    const passportNumber = document.getElementById("kyc-passport").value
    const address = document.getElementById("kyc-address").value
    const paymentPin = document.getElementById("kyc-pin").value
    const confirmPaymentPin = document.getElementById("kyc-confirm-pin").value
    const passportFile = document.getElementById("passport-upload").files[0]
    const selfieFile = document.getElementById("selfie-upload").files[0]
    const errorElement = document.getElementById("kyc-error")
    const successElement = document.getElementById("kyc-success")

    if (!passportNumber || !address || !paymentPin || !confirmPaymentPin || !passportFile || !selfieFile) {
      errorElement.textContent = "အချက်အလက်အားလုံး ဖြည့်စွက်ပါ။"
      errorElement.style.display = "block"
      successElement.style.display = "none"
      return
    }
    if (paymentPin !== confirmPaymentPin) {
      errorElement.textContent = "PIN နှင့် အတည်ပြု PIN မတူညီပါ။"
      errorElement.style.display = "block"
      successElement.style.display = "none"
      return
    }
    if (paymentPin.length !== 6 || !/^\d+$/.test(paymentPin)) {
      errorElement.textContent = "PIN သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။"
      errorElement.style.display = "block"
      successElement.style.display = "none"
      return
    }

    showProcessingOverlay("Submitting KYC...")
    try {
      const passportFileName = `passport_${currentUser.user_id}_${Date.now()}.${passportFile.name.split(".").pop()}`
      const { error: passportUploadError } = await supabase.storage
        .from("kyc-documents")
        .upload(passportFileName, passportFile)
      if (passportUploadError) throw passportUploadError
      const { data: passportUrlData } = supabase.storage.from("kyc-documents").getPublicUrl(passportFileName)

      const selfieFileName = `selfie_${currentUser.user_id}_${Date.now()}.${selfieFile.name.split(".").pop()}`
      const { error: selfieUploadError } = await supabase.storage
        .from("kyc-documents")
        .upload(selfieFileName, selfieFile)
      if (selfieUploadError) throw selfieUploadError
      const { data: selfieUrlData } = supabase.storage.from("kyc-documents").getPublicUrl(selfieFileName)

      const { error: updateError } = await supabase
        .from("users")
        .update({
          passport_number: passportNumber,
          address,
          payment_pin: paymentPin, // HASH PIN!
          passport_image: passportUrlData.publicUrl,
          selfie_image: selfieUrlData.publicUrl,
          passport_status: "pending",
          submitted_at: new Date().toISOString(),
        })
        .eq("user_id", currentUser.user_id)
      if (updateError) throw updateError

      errorElement.style.display = "none"
      successElement.textContent = "KYC အချက်အလက်များ တင်သွင်းပြီးပါပြီ။ စိစစ်မှုအတွက် စောင့်ဆိုင်းပေးပါ။"
      successElement.style.display = "block"
      userKycStatus = "pending"
      // Fetch updated user data to pass to updateKycStatus
      const { data: updatedUserData } = await supabase
        .from("users")
        .select("*")
        .eq("user_id", currentUser.user_id)
        .single()
      if (updatedUserData) updateKycStatus(updatedUserData)

      document.getElementById("kyc-form").reset()
      document.getElementById("passport-preview").innerHTML = ""
      document.getElementById("selfie-preview").innerHTML = ""
    } catch (err) {
      console.error("KYC submission error:", err)
      errorElement.textContent = `KYC တင်သွင်းရာတွင် အမှားရှိနေပါသည်။ ${err.message}`
      errorElement.style.display = "block"
      successElement.style.display = "none"
    } finally {
      hideProcessingOverlay()
    }
  })

  // Change Password, PIN, Delete Account Modals (Placeholders - Implement logic)
  document.getElementById("change-password-form")?.addEventListener("submit", async (e) => {
    e.preventDefault()
    showToast("Password change: Implement server-side logic.", "info")
  })
  document.getElementById("change-pin-form")?.addEventListener("submit", async (e) => {
    e.preventDefault()
    showToast("PIN change: Implement server-side logic with hashing.", "info")
  })
  document.getElementById("confirm-delete-account-btn")?.addEventListener("click", () => {
    showToast("Account deletion: Implement carefully with confirmations.", "warning")
  })

  // Google Login/Signup Buttons
  document.getElementById("google-login-btn")?.addEventListener("click", () => {
    playClickSound()
    simulateGoogleLogin("login")
  })
  document.getElementById("google-signup-btn")?.addEventListener("click", () => {
    playClickSound()
    simulateGoogleLogin("signup")
  })
}

function showPinEntryModal() {
  document.querySelectorAll(".pin-input").forEach((input) => (input.value = ""))
  document.getElementById("pin-error").style.display = "none"
  const recipientInfoEl = document.getElementById("pin-recipient-info") // Assuming this element exists in your PIN modal
  if (recipientInfoEl && pinEntryModal.dataset.recipientName) {
    recipientInfoEl.textContent = `Transferring ${Number(pinEntryModal.dataset.transferAmount).toLocaleString()} Ks to ${pinEntryModal.dataset.recipientName} (${pinEntryModal.dataset.recipientPhone})`
    recipientInfoEl.style.display = "block"
  } else if (recipientInfoEl) {
    recipientInfoEl.style.display = "none"
  }
  pinEntryModal.classList.add("active")
  document.querySelector(".pin-input")?.focus()
}

async function processTransfer(enteredPin) {
  const recipientPhone = document.getElementById("transfer-phone").value // Or from pinEntryModal.dataset
  const amount = Number.parseFloat(document.getElementById("transfer-amount").value) // Or from pinEntryModal.dataset
  const note = document.getElementById("transfer-note").value
  const errorElement = document.getElementById("transfer-error")
  const successElement = document.getElementById("transfer-success")

  pinEntryModal.classList.remove("active")
  showProcessingOverlay("ငွေလွှဲလုပ်ဆောင်နေသည်...")

  try {
    // Use the transfer_money function from the database for atomic operations
    const { data, error } = await supabase.rpc("transfer_money", {
      from_user_id: currentUser.user_id,
      to_phone: recipientPhone,
      amount: amount,
      note: note || null,
      user_pin: enteredPin,
    })

    if (error) throw new Error(`Transfer error: ${error.message}`)

    if (!data || !data.success) {
      throw new Error(data?.message || "Transfer failed")
    }

    // Update local balance
    userBalance -= amount
    updateUserUI({ ...currentUser, balance: userBalance, phone: currentUser.phone })

    if (transferSentSound) transferSentSound.play().catch((e) => console.warn("Sent sound failed", e))

    setTimeout(() => {
      hideProcessingOverlay()
      errorElement.style.display = "none"
      if (successElement) {
        successElement.textContent = `${amount.toLocaleString()} Ks ကို ${recipientPhone} သို့ အောင်မြင်စွာ လွှဲပြောင်းပြီးပါပြီ။ ID: ${data.transaction_id}`
        successElement.style.display = "block"
      }

      // Create transaction object for receipt
      const transactionForReceipt = {
        id: data.transaction_id,
        from_phone: currentUser.phone,
        from_name: currentUser.name || currentUser.email.split("@")[0],
        to_phone: recipientPhone,
        to_name: data.recipient_name || recipientPhone,
        amount: amount,
        note: note,
        created_at: new Date().toISOString(),
      }

      showTransactionReceipt(transactionForReceipt)
      if (autoSaveReceipt) setTimeout(downloadReceipt, 700)
      document.getElementById("transfer-form")?.reset()
      loadTransactions()
    }, 1500)
  } catch (error) {
    console.error("Transfer error:", error)
    hideProcessingOverlay()
    errorElement.textContent = `ငွေလွှဲရာတွင် အမှားရှိနေပါသည်။ ${error.message}`
    errorElement.style.display = "block"
    if (successElement) successElement.style.display = "none"
  }
}

function showTransactionReceipt(transaction) {
  const receiptContent = document.getElementById("receipt-content")
  if (!receiptContent || !currentUser) return

  const isSender = transaction.from_user_id === currentUser.user_id || transaction.from_phone === currentUser.phone
  const transactionDate = new Date(transaction.created_at).toLocaleString("my-MM", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const statusIconClass = isSender ? "fa-paper-plane sent-animation" : "fa-check-circle received-animation"
  const statusText = isSender ? "ငွေလွှဲပို့ခြင်း အောင်မြင်ပါသည်" : "ငွေလက်ခံရရှိခြင်း အောင်မြင်ပါသည်"

  receiptContent.innerHTML = `
    <div class="receipt-header">
      <img src="https://github.com/Opper125/opper-payment/raw/main/logo.png" alt="OPPER Pay Logo" class="receipt-logo">
      <h2>OPPER Payment</h2>
    </div>
    <div class="receipt-status">
      <i class="fas ${statusIconClass} receipt-status-icon"></i>
      <p>${statusText}</p>
    </div>
    <div class="receipt-details">
      <div class="receipt-detail-item"><span>Transaction ID:</span> <span>${transaction.id}</span></div>
      <div class="receipt-detail-item"><span>Date & Time:</span> <span>${transactionDate}</span></div>
      <hr>
      <div class="receipt-detail-item"><span>${isSender ? "To:" : "From:"}</span> <span>${isSender ? transaction.to_name || transaction.to_phone : transaction.from_name || transaction.from_phone}</span></div>
      <div class="receipt-detail-item"><span>${isSender ? "Receiver Phone:" : "Sender Phone:"}</span> <span>${isSender ? transaction.to_phone : transaction.from_phone}</span></div>
      <hr>
      <div class="receipt-detail-item"><span>Amount:</span> <span class="receipt-amount">${transaction.amount.toLocaleString()} Ks</span></div>
      ${transaction.note ? `<div class="receipt-detail-item"><span>Note:</span> <span>${transaction.note}</span></div>` : ""}
    </div>
    <div class="receipt-footer">
      <p>Thank you for using OPPER Payment!</p>
      <a href="https://github.com/Opper125/opper-payment" target="_blank" class="github-link clickable"><i class="fab fa-github"></i> View on GitHub</a>
    </div>
  `
  receiptModal.classList.add("active", "cool-media-style-animation")
}

function downloadReceipt() {
  const receiptContainer = document.getElementById("receipt-content")
  if (!receiptContainer || typeof html2canvas === "undefined") {
    showToast("Error preparing receipt for download. html2canvas not loaded.", "error")
    return
  }
  showProcessingOverlay("Downloading receipt...")
  html2canvas(receiptContainer, {
    scale: 2,
    useCORS: true,
    backgroundColor: getComputedStyle(document.body).getPropertyValue("--background-color") || "#ffffff",
  })
    .then((canvas) => {
      const link = document.createElement("a")
      link.download = `OPPER_Receipt_${Date.now()}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
      hideProcessingOverlay()
      showToast("Receipt downloaded!", "success")
    })
    .catch((err) => {
      console.error("Error downloading receipt:", err)
      hideProcessingOverlay()
      showToast("Failed to download receipt.", "error")
    })
}

// --- Utility Functions ---
function showLoader() {
  if (loader) loader.style.display = "flex"
}
function hideLoader() {
  if (loader) loader.style.display = "none"
}
function showAuthContainer() {
  if (authContainer) authContainer.style.display = "flex"
  if (appContainer) appContainer.style.display = "none"
  hideLoader()
}
function showAppContainer() {
  if (appContainer) appContainer.style.display = "block"
  if (authContainer) authContainer.style.display = "none"
  hideLoader()
}
function showProcessingOverlay(message = "Processing...") {
  if (processingOverlay) {
    processingOverlay.querySelector("p").textContent = message
    processingOverlay.style.display = "flex"
  }
}
function hideProcessingOverlay() {
  if (processingOverlay) processingOverlay.style.display = "none"
}

function showToast(message, type = "info", duration = 5000) {
  const toastContainer = document.getElementById("toast-container") // Ensure this exists in index.html
  if (!toastContainer) {
    console.warn("Toast container not found!")
    return
  }
  const toast = document.createElement("div")
  toast.className = `toast toast-${type}` // Ensure CSS for .toast, .toast-info, .toast-success etc.
  toast.innerHTML = `<p>${message}</p><button class="toast-close-btn" onclick="this.parentElement.remove()">&times;</button>`
  toastContainer.appendChild(toast)
  setTimeout(() => toast.remove(), duration)
}

function generateUserId(email) {
  return "user_" + email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "") + "_" + Math.random().toString(36).substring(2, 7)
}

function showPage(pageName) {
  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"))
  document.getElementById(`${pageName}-page`)?.classList.add("active")
  document.querySelectorAll(".sidebar-nav li").forEach((li) => li.classList.remove("active"))
  document.querySelector(`.sidebar-nav a[data-page="${pageName}"]`)?.parentElement.classList.add("active")
  if (pageName === "posts" && document.getElementById("posts-page")?.classList.contains("active")) {
    loadPosts()
  }
  if (window.innerWidth < 992 && document.getElementById("sidebar").classList.contains("active")) {
    document.getElementById("sidebar").classList.remove("active")
  }
}

async function logout() {
  showProcessingOverlay("Logging out...")

  // Clean up realtime channels
  realtimeChannels.forEach((channel) => {
    supabase.removeChannel(channel)
  })
  realtimeChannels = []

  localStorage.removeItem("opperSession")
  currentUser = null
  userBalance = 0
  userKycStatus = "pending"
  transactions = []
  posts = []
  gifts = []
  document.getElementById("login-form")?.reset()
  document.getElementById("signup-form")?.reset()
  setTimeout(() => {
    hideProcessingOverlay()
    showAuthContainer()
    showToast("Logged out successfully.", "success")
  }, 1000)
}

function simulateGoogleLogin(type) {
  // Placeholder
  showToast(`Simulating Google ${type}... This is a placeholder.`, "info")
  showProcessingOverlay(`Simulating Google ${type}...`)
  setTimeout(async () => {
    const simulatedEmail = `google.user${Math.floor(Math.random() * 1000)}@example.com`
    const userId = generateUserId(simulatedEmail)
    currentUser = { email: simulatedEmail, user_id: userId, password: "googlepassword" }

    try {
      let existingAuthUser = null
      const { data } = await supabase.from("auth_users").select("*").eq("email", simulatedEmail).single()
      existingAuthUser = data

      if (!existingAuthUser) {
        // If user doesn't exist, create them (signup simulation)
        await supabase
          .from("auth_users")
          .insert([{ user_id: userId, email: simulatedEmail, password: "googlepassword" }])
        await supabase.from("users").insert([
          {
            user_id: userId,
            phone: `09${Math.floor(100000000 + Math.random() * 900000000)}`,
            balance: 10000,
            passport_status: "approved",
            name: "Google User",
          },
        ])
      } else {
        currentUser = existingAuthUser // Use existing user data for login
      }

      localStorage.setItem("opperSession", JSON.stringify({ email: currentUser.email, user_id: currentUser.user_id }))
      await loadUserData()
      showAppContainer()
      showToast(
        `Successfully ${!existingAuthUser || type === "signup" ? "signed up" : "logged in"} with Google (simulated).`,
        "success",
      )
    } catch (error) {
      console.error(`Simulated Google ${type} error:`, error)
      showToast(`Simulated Google ${type} failed.`, "error")
    } finally {
      hideProcessingOverlay()
    }
  }, 2000)
}

// Ensure html2canvas is loaded
if (typeof html2canvas === "undefined") {
  console.warn(
    "html2canvas library is not loaded. Receipt download will not work. Include it via: <script src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'></script>",
  )
}
