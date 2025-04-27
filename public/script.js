// Supabase Client Setup
const supabaseUrl = "https://vtsczzlnhsrgnbkfyizi.supabase.co"
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68"
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, { fetch: (...args) => fetch(...args) })
const imgurClientId = "5befa9dd970c7d0"
const logoUrl = "https://github.com/Opper125/opper-payment/raw/main/logo.png"

let currentUser = {
  id: null,
  user_id: null,
  email: null,
  balance: 0,
  passport_status: "pending",
  phone: null,
}
let allowTransfers = true
let currentTransactionId = null
let receiverData = null
let isAuthenticated = false

// Play Intro Sound
window.onload = () => {
  const introSound = document.getElementById("intro-sound")
  introSound.play().catch((err) => console.error("Intro sound error:", err))
  setTimeout(() => {
    document.getElementById("intro-container").style.display = "none"
    initializeApp()
  }, 8000)
}

// AUTH FUNCTIONS
async function initializeApp() {
  try {
    // Check for existing session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      console.error("Session Error:", sessionError.message)
      showNotification("Error checking session. Please try again.", "error")
      return
    }

    if (session) {
      await handleSuccessfulAuth(session.user)
    } else {
      showSection("auth")
      console.log("No active session. Please login or sign up.")
    }

    await checkTransferSettings()
  } catch (error) {
    console.error("Initialization Error:", error.message)
    showNotification(`An error occurred during initialization: ${error.message}`, "error")
  }
}

function switchTab(tab) {
  const loginTab = document.getElementById("login-tab")
  const signupTab = document.getElementById("signup-tab")
  const loginForm = document.getElementById("login-form")
  const signupForm = document.getElementById("signup-form")

  if (tab === "login") {
    loginTab.classList.add("active")
    signupTab.classList.remove("active")
    loginForm.classList.remove("hidden")
    signupForm.classList.add("hidden")
  } else {
    loginTab.classList.remove("active")
    signupTab.classList.add("active")
    loginForm.classList.add("hidden")
    signupForm.classList.remove("hidden")
  }
}

async function signupUser() {
  try {
    const email = document.getElementById("signup-email").value
    const password = document.getElementById("signup-password").value
    const confirmPassword = document.getElementById("confirm-password").value
    const messageElement = document.getElementById("signup-message")

    // Reset message
    messageElement.textContent = ""
    messageElement.classList.remove("error-message", "success-message")

    // Validate form
    if (!email || !password || !confirmPassword) {
      messageElement.textContent = "Please fill in all fields"
      messageElement.classList.add("error-message")
      playSound("error")
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      messageElement.textContent = "Please enter a valid email address"
      messageElement.classList.add("error-message")
      playSound("error")
      return
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      messageElement.textContent = "Passwords do not match"
      messageElement.classList.add("error-message")
      playSound("error")
      return
    }

    // Check if password meets minimum requirements
    if (password.length < 6) {
      messageElement.textContent = "Password must be at least 6 characters long"
      messageElement.classList.add("error-message")
      playSound("error")
      return
    }

    // Show loading state
    const signupBtn = document.getElementById("signup-btn")
    const originalText = signupBtn.textContent
    signupBtn.disabled = true
    signupBtn.textContent = "Creating Account..."

    // Generate a unique user ID (6-digit number)
    const userId = Math.floor(100000 + Math.random() * 900000).toString()

    // First create user record in users table with email and user_id
    // This is a change from the original flow - we create the user record first
    const { error: insertError } = await supabase.from("users").insert({
      user_id: userId,
      email: email,
      balance: 0,
      passport_status: "pending",
    })

    if (insertError) {
      console.error("User Record Creation Error:", insertError.message)
      messageElement.textContent = `Error creating user profile: ${insertError.message}`
      messageElement.classList.add("error-message")
      playSound("error")
      signupBtn.disabled = false
      signupBtn.textContent = originalText
      return
    }

    // Create user with Supabase Auth
    const {
      data: { user },
      error: signupError,
    } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signupError) {
      messageElement.textContent = `Signup Error: ${signupError.message}`
      messageElement.classList.add("error-message")
      playSound("error")

      // Clean up the user record we created if auth fails
      await supabase.from("users").delete().eq("email", email)

      signupBtn.disabled = false
      signupBtn.textContent = originalText
      return
    }

    if (!user) {
      messageElement.textContent = "An unknown error occurred. Please try again."
      messageElement.classList.add("error-message")
      playSound("error")

      // Clean up the user record we created if auth fails
      await supabase.from("users").delete().eq("email", email)

      signupBtn.disabled = false
      signupBtn.textContent = originalText
      return
    }

    // Update the user record with the auth_id
    const { error: updateError } = await supabase.from("users").update({ auth_id: user.id }).eq("email", email)

    if (updateError) {
      console.error("User Record Update Error:", updateError.message)
      messageElement.textContent = `Error updating user profile: ${updateError.message}`
      messageElement.classList.add("error-message")
      playSound("error")
      signupBtn.disabled = false
      signupBtn.textContent = originalText
      return
    }

    // Show success message and switch to login tab
    messageElement.textContent = "Account created successfully! Please log in."
    messageElement.classList.add("success-message")
    playSound("success")

    // Reset form
    document.getElementById("signup-email").value = ""
    document.getElementById("signup-password").value = ""
    document.getElementById("confirm-password").value = ""

    // Switch to login tab after a delay
    setTimeout(() => {
      switchTab("login")
    }, 2000)

    signupBtn.disabled = false
    signupBtn.textContent = originalText
  } catch (error) {
    console.error("Signup Error:", error.message)
    const messageElement = document.getElementById("signup-message")
    messageElement.textContent = `An unexpected error occurred: ${error.message}`
    messageElement.classList.add("error-message")
    playSound("error")

    const signupBtn = document.getElementById("signup-btn")
    signupBtn.disabled = false
    signupBtn.textContent = "Sign Up"
  }
}

async function loginUser() {
  try {
    const email = document.getElementById("login-email").value
    const password = document.getElementById("login-password").value
    const messageElement = document.getElementById("login-message")

    // Reset message
    messageElement.textContent = ""
    messageElement.classList.remove("error-message", "success-message")

    // Validate form
    if (!email || !password) {
      messageElement.textContent = "Please enter both email and password"
      messageElement.classList.add("error-message")
      playSound("error")
      return
    }

    // Show loading state
    const loginBtn = document.getElementById("login-btn")
    const originalText = loginBtn.textContent
    loginBtn.disabled = true
    loginBtn.textContent = "Logging In..."

    // Sign in with Supabase Auth
    const {
      data: { user },
      error: signInError,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      messageElement.textContent = `Login Error: ${signInError.message}`
      messageElement.classList.add("error-message")
      playSound("error")
      loginBtn.disabled = false
      loginBtn.textContent = originalText
      return
    }

    if (!user) {
      messageElement.textContent = "Invalid email or password"
      messageElement.classList.add("error-message")
      playSound("error")
      loginBtn.disabled = false
      loginBtn.textContent = originalText
      return
    }

    // Show success animation
    showLoginSuccessAnimation()

    // Handle successful authentication
    await handleSuccessfulAuth(user)

    // Reset form
    document.getElementById("login-email").value = ""
    document.getElementById("login-password").value = ""

    loginBtn.disabled = false
    loginBtn.textContent = originalText
  } catch (error) {
    console.error("Login Error:", error.message)
    const messageElement = document.getElementById("login-message")
    messageElement.textContent = `An unexpected error occurred: ${error.message}`
    messageElement.classList.add("error-message")
    playSound("error")

    const loginBtn = document.getElementById("login-btn")
    loginBtn.disabled = false
    loginBtn.textContent = "Login"
  }
}

async function handleSuccessfulAuth(authUser) {
  try {
    // Get user profile from the users table
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("auth_id", authUser.id)
      .single()

    if (profileError) {
      console.error("User Profile Error:", profileError.message)
      showNotification("Error retrieving user profile. Please try again.", "error")
      return
    }

    if (!userProfile) {
      console.error("User profile not found")
      showNotification("User profile not found. Please contact support.", "error")
      return
    }

    // Set user data
    currentUser = {
      id: authUser.id,
      user_id: userProfile.user_id,
      email: authUser.email,
      balance: userProfile.balance,
      passport_status: userProfile.passport_status,
      phone: userProfile.phone,
    }

    isAuthenticated = true

    // Update UI
    document.getElementById("id-badge").textContent = `ID: ${currentUser.user_id}`
    document.getElementById("mi-id").textContent = currentUser.user_id
    document.getElementById("balance").textContent = `${currentUser.balance} Ks`
    updateStatus(currentUser.passport_status)

    // Show wallet section
    showSection("wallet")

    // Show welcome message
    showNotification(`Welcome back, ${currentUser.email}!`, "success")

    // Set up realtime subscriptions
    setupRealtimeSubscriptions()

    // Load transaction history
    loadHistory()

    console.log("Authentication successful:", currentUser)
  } catch (error) {
    console.error("Auth Handler Error:", error.message)
    showNotification(`An error occurred during authentication: ${error.message}`, "error")
  }
}

async function logoutUser() {
  try {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error("Logout Error:", error.message)
      showNotification(`Error during logout: ${error.message}`, "error")
      return
    }

    // Reset user data and UI
    currentUser = {
      id: null,
      user_id: null,
      email: null,
      balance: 0,
      passport_status: "pending",
      phone: null,
    }
    isAuthenticated = false

    // Show auth section
    showSection("auth")

    showNotification("You have been logged out", "success")
  } catch (error) {
    console.error("Logout Error:", error.message)
    showNotification(`An error occurred during logout: ${error.message}`, "error")
  }
}

// CORE APP FUNCTIONS
function showSection(sectionId) {
  // If trying to access a section other than auth while not authenticated
  if (sectionId !== "auth" && !isAuthenticated) {
    showNotification("Please log in to access this section", "error")
    sectionId = "auth"
  }
  ;["auth", "wallet", "host", "mi", "game"].forEach((id) => {
    document.getElementById(id).classList.toggle("active", id === sectionId)

    if (id !== "auth" && document.getElementById(`${id}-btn`)) {
      document.getElementById(`${id}-btn`).classList.toggle("active", id === sectionId)
    }
  })

  window.scrollTo({ top: 0, behavior: "smooth" })
}

function openTelegram() {
  window.open("https://t.me/OPPERN", "_blank")
}

function showNotification(message, type) {
  const notification = document.createElement("div")
  notification.className = `notification ${type}-notification`
  notification.textContent = message

  document.body.appendChild(notification)

  // Play sound based on notification type
  playSound(type)

  setTimeout(() => {
    notification.classList.add("show")
  }, 10)

  setTimeout(() => {
    notification.classList.remove("show")
    setTimeout(() => {
      notification.remove()
    }, 500)
  }, 3000)
}

function playSound(type) {
  try {
    if (type === "success") {
      document.getElementById("success-sound").play()
    } else if (type === "error") {
      document.getElementById("error-sound").play()
    }
  } catch (error) {
    console.error("Sound play error:", error)
  }
}

function showLoginSuccessAnimation() {
  const animation = document.createElement("div")
  animation.className = "login-success-animation"
  animation.innerHTML = `
        <img src="${logoUrl}" alt="OPPER Logo">
        <div class="success-message">Login Successful</div>
    `
  document.body.appendChild(animation)

  setTimeout(() => {
    animation.remove()
  }, 2500)
}

async function setupRealtimeSubscriptions() {
  // Listen for changes to the current user's profile
  supabase
    .channel("users-channel")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "users",
        filter: `user_id=eq.${currentUser.user_id}`,
      },
      (payload) => {
        currentUser = { ...currentUser, ...payload.new }
        document.getElementById("balance").textContent = `${currentUser.balance} Ks`
        updateStatus(currentUser.passport_status)
      },
    )
    .subscribe()

  // Listen for new transactions
  supabase
    .channel("transactions-channel")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "transactions",
      },
      async (payload) => {
        const transaction = payload.new
        if (transaction.to_phone === currentUser.phone) {
          const message = document.createElement("div")
          message.className = "receiver-message"
          message.innerHTML = `Received ${transaction.amount} Ks<br>From: ${transaction.from_phone}`
          document.body.appendChild(message)
          document
            .getElementById("transfer-received-sound")
            .play()
            .catch((err) => console.error("Received sound error:", err))
          setTimeout(() => message.remove(), 4000)
        }
        loadHistory()
      },
    )
    .subscribe()

  // Listen for settings changes
  supabase
    .channel("settings-channel")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "settings",
      },
      (payload) => {
        allowTransfers = payload.new.allow_transfers
      },
    )
    .subscribe()
}

async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      console.warn(`Retry ${i + 1}/${maxRetries} failed: ${error.message}`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

async function checkTransferSettings() {
  try {
    const { data, error } = await supabase.from("settings").select("allow_transfers").single()
    if (error) throw new Error(`Fetch Settings Error: ${error.message}`)
    allowTransfers = data.allow_transfers
  } catch (error) {
    console.error("Check Transfer Settings Error:", error.message)
    allowTransfers = false
  }
}

function showPhoneInput() {
  if (!isAuthenticated) {
    showNotification("Please log in to access this feature", "error")
    showSection("auth")
    return
  }

  if (currentUser.passport_status !== "approved") {
    showNotification("Passport must be approved to transfer money.", "error")
    return
  }
  if (!allowTransfers) {
    showNotification("Transfer functionality is currently disabled by the server.", "error")
    return
  }
  document.getElementById("transfer-phone-section").classList.remove("hidden")
  document.getElementById("transfer-details").classList.add("hidden")
  document.getElementById("pin-overlay").style.display = "none"
}

async function checkPhone() {
  try {
    const phone = document.getElementById("transfer-phone").value
    const receiverName = document.getElementById("receiver-name")
    const nextBtn = document.getElementById("next-btn")
    receiverName.textContent = ""
    nextBtn.disabled = true
    if (phone.match(/^09\d{9}$/)) {
      if (phone === currentUser.phone) {
        receiverName.className = "account-status not-found"
        receiverName.textContent = "You cannot transfer money to your own phone number."
        return
      }

      const { data: receiver, error } = await supabase
        .from("users")
        .select("user_id, phone, passport_status")
        .eq("phone", phone)
        .single()
      if (error && error.code !== "PGRST116") throw error
      if (receiver && receiver.passport_status === "approved") {
        receiverName.className = "account-status found"
        receiverName.textContent = `Account Found: ${receiver.phone} (ID: ${receiver.user_id})`
        nextBtn.disabled = false
        receiverData = receiver
      } else {
        receiverName.className = "account-status not-found"
        receiverName.textContent = "Account not found or passport not approved."
      }
    }
  } catch (error) {
    console.error("Check Phone Error:", error.message)
    document.getElementById("receiver-name").textContent = "An error occurred."
  }
}

function showTransferDetails() {
  if (!receiverData) return
  document.getElementById("transfer-phone-section").classList.add("hidden")
  document.getElementById("transfer-details").classList.remove("hidden")
  document.getElementById("transfer-receiver").textContent = `${receiverData.phone} (ID: ${receiverData.user_id})`
}

function showPinOverlay() {
  const amount = Number.parseInt(document.getElementById("transfer-amount").value)
  if (!amount || amount <= 0 || amount > 1000000) {
    document.getElementById("transfer-error").textContent = "Invalid amount. Max 1,000,000 Ks."
    document.getElementById("transfer-error").classList.remove("hidden")
    return
  }
  document.getElementById("transfer-details").classList.add("hidden")
  document.getElementById("pin-overlay").style.display = "flex"
  const pinBoxes = document.querySelectorAll(".pin-box")
  pinBoxes.forEach((box) => {
    box.value = ""
    box.classList.remove("filled")
  })
  pinBoxes[0].focus()
  document.getElementById("pin-error").classList.add("hidden")
}

function closePinOverlay() {
  document.getElementById("pin-overlay").style.display = "none"
  document.getElementById("transfer-details").classList.remove("hidden")
}

function handlePinInput(current, index) {
  const pinBoxes = document.querySelectorAll(".pin-box")
  if (current.value.length === 1) {
    current.classList.add("filled")
    if (index < 5) {
      pinBoxes[index + 1].focus()
    } else {
      pinBoxes[index].blur()
    }
  } else {
    current.classList.remove("filled")
  }
}

async function downloadReceipt() {
  try {
    // Import html2canvas here
    const html2canvas = (await import("html2canvas")).default
    const ticketContent = document.getElementById("ticket-content")
    const canvas = await html2canvas(ticketContent, {
      scale: 4,
      useCORS: true,
      backgroundColor: "#FFFFFF",
      logging: false,
      imageTimeout: 15000,
    })
    const link = document.createElement("a")
    link.href = canvas.toDataURL("image/png")
    link.download = `Transaction_${currentTransactionId}.png`
    link.click()
  } catch (error) {
    console.error("Download Receipt Error:", error.message)
    showNotification(`Error downloading receipt: ${error.message}`, "error")
  }
}

async function printReceipt() {
  try {
    window.print()
  } catch (error) {
    console.error("Print Receipt Error:", error.message)
    showNotification(`Error printing receipt: ${error.message}`, "error")
  }
}

async function submitTransfer() {
  try {
    if (!allowTransfers) {
      document.getElementById("pin-error").textContent = "Transfer functionality is currently disabled by the server."
      document.getElementById("pin-error").classList.remove("hidden")
      return
    }

    const pin = Array.from(document.querySelectorAll(".pin-box"))
      .map((box) => box.value)
      .join("")
    const phone = receiverData.phone
    const amount = Number.parseInt(document.getElementById("transfer-amount").value)
    const note = document.getElementById("transfer-note").value

    if (pin.length !== 6) {
      document.getElementById("pin-error").textContent = "PIN must be 6 digits."
      document.getElementById("pin-error").classList.remove("hidden")
      return
    }

    console.log(`Entered PIN: ${pin}`)

    const animation = document.createElement("div")
    animation.className = "transfer-animation"
    animation.textContent = "Processing Transfer..."
    document.body.appendChild(animation)

    const isOnline = navigator.onLine
    animation.style.animationDuration = isOnline ? "1s" : "3s"

    // Generate a unique transaction ID
    const transactionId = `TXN${Date.now().toString().slice(-10)}${Math.floor(Math.random() * 1000)}`

    const { data: sender, error: senderError } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", currentUser.user_id)
      .eq("payment_pin", pin)
      .single()
    if (senderError) throw new Error(`Sender Fetch Error: ${senderError.message}`)
    const { data: receiver, error: receiverError } = await supabase
      .from("users")
      .select("*")
      .eq("phone", phone)
      .single()
    if (receiverError) throw new Error(`Receiver Fetch Error: ${receiverError.message}`)

    if (!sender || !receiver || sender.balance < amount || receiver.passport_status !== "approved") {
      document.getElementById("pin-error").textContent = !sender
        ? "Incorrect PIN."
        : !receiver
          ? "Recipient account not found."
          : sender.balance < amount
            ? "Insufficient balance."
            : "Recipient passport not approved."
      document.getElementById("pin-error").classList.remove("hidden")
      animation.remove()
      return
    }

    const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Yangon" })

    await retryOperation(async () => {
      const { error: updateSenderError } = await supabase
        .from("users")
        .update({ balance: sender.balance - amount })
        .eq("user_id", sender.user_id)
      if (updateSenderError) throw new Error(`Update Sender Error: ${updateSenderError.message}`)
    })

    await retryOperation(async () => {
      const { error: updateReceiverError } = await supabase
        .from("users")
        .update({ balance: receiver.balance + amount })
        .eq("user_id", receiver.user_id)
      if (updateReceiverError) throw new Error(`Update Receiver Error: ${updateReceiverError.message}`)
    })

    await retryOperation(async () => {
      const { error: insertError } = await supabase.from("transactions").insert({
        id: transactionId,
        from_phone: sender.phone,
        to_phone: receiver.phone,
        amount: amount,
        note: note || null,
        timestamp: now,
        status: "completed",
      })
      if (insertError) throw new Error(`Insert Transaction Error: ${insertError.message}`)
    })

    currentUser.balance = sender.balance - amount
    document.getElementById("balance").textContent = `${currentUser.balance} Ks`
    document.getElementById("pin-overlay").style.display = "none"

    animation.remove()

    document
      .getElementById("transfer-sent-sound")
      .play()
      .catch((err) => console.error("Sent sound error:", err))

    const successAnimation = document.createElement("div")
    successAnimation.className = "success-animation"
    successAnimation.innerHTML = `
            <img src="${logoUrl}" alt="OPPER Logo">
            Transfer Successful
        `
    document.body.appendChild(successAnimation)

    console.log(`Transfer Successful: ${amount} Ks to ${receiver.phone}`)

    setTimeout(async () => {
      successAnimation.remove()

      const ticketContent = document.getElementById("ticket-content")
      ticketContent.innerHTML = `
                <div class="header">
                    <img src="${logoUrl}" alt="OPPER Logo">
                    <h1>OPPER Payment</h1>
                </div>
                <div class="content">
                    <p><strong>Transaction Receipt</strong></p>
                    <p><strong>Transaction ID:</strong> ${transactionId}</p>
                    <p><strong>Amount:</strong> ${amount} Ks</p>
                    <p><strong>From:</strong> ${sender.phone}</p>
                    <p><strong>To:</strong> ${receiver.phone}</p>
                    <p><strong>To ID:</strong> ${receiver.user_id}</p>
                    <p><strong>Note:</strong> ${note || "None"}</p>
                    <p><strong>Time:</strong> ${now}</p>
                    <p><strong>Status:</strong> Sent</p>
                    <div class="done-ui">
                        <img src="${logoUrl}" alt="Done Icon">
                        Transaction Completed
                    </div>
                    <div class="footer">
                        Powered by OPPER Payment
                    </div>
                </div>
            `
      currentTransactionId = transactionId
      document.getElementById("receipt-overlay").style.display = "flex"
    }, 2500)

    loadHistory()
  } catch (error) {
    console.error("Transfer Error:", error.message)
    document.getElementById("pin-error").textContent = `An error occurred during transfer: ${error.message}`
    document.getElementById("pin-error").classList.remove("hidden")
    const animation = document.querySelector(".transfer-animation")
    if (animation) animation.remove()
  }
}

async function loadHistory() {
  try {
    if (!isAuthenticated) return

    const month = document.getElementById("month-filter").value
    const now = new Date()
    const year = now.getFullYear()
    const monthFilter = month === "current" ? now.getMonth() : now.getMonth() - 1
    const startDate = new Date(year, monthFilter, 1).toISOString()
    const endDate = new Date(year, monthFilter + 1, 0).toISOString()

    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("*")
      .or(`from_phone.eq.${currentUser.phone},to_phone.eq.${currentUser.phone}`)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: false })
    if (error) throw error

    const historyList = document.getElementById("history-list")
    historyList.innerHTML = ""
    let totalIn = 0,
      totalOut = 0

    if (!transactions || transactions.length === 0) {
      historyList.innerHTML = '<p class="no-transactions">No transactions found for this period.</p>'
      document.getElementById("total-in").textContent = "0 Ks"
      document.getElementById("total-out").textContent = "0 Ks"
      return
    }

    transactions.forEach((t) => {
      const item = document.createElement("div")
      item.className = `history-item ${t.from_phone === currentUser.phone ? "out" : "in"}`
      item.innerHTML = `
                ${t.from_phone === currentUser.phone ? "-" : "+"}${t.amount} Ks<br>
                Transaction ID: ${t.id}<br>
                Phone: ${t.from_phone === currentUser.phone ? t.to_phone : t.from_phone}<br>
                Note: ${t.note || "None"}<br>
                Time: ${t.timestamp}<br>
                Status: ${t.from_phone === currentUser.phone ? "Sent" : "Received"}
                <button class="print-btn" onclick="showReceipt('${t.id}')"></button>
            `
      historyList.appendChild(item)
      if (t.from_phone === currentUser.phone) totalOut += t.amount
      else totalIn += t.amount
    })

    document.getElementById("total-in").textContent = `${totalIn} Ks`
    document.getElementById("total-out").textContent = `${totalOut} Ks`
  } catch (error) {
    console.error("Load History Error:", error.message)
    showNotification(`Error loading transaction history: ${error.message}`, "error")
  }
}

async function showReceipt(transactionId) {
  try {
    const { data: transaction, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single()
    if (error) throw error

    currentTransactionId = transactionId
    const toUserId =
      transaction.to_phone === currentUser.phone
        ? currentUser.user_id
        : (await supabase.from("users").select("user_id").eq("phone", transaction.to_phone).single()).data.user_id

    const ticketContent = document.getElementById("ticket-content")
    ticketContent.innerHTML = `
            <div class="header">
                <img src="${logoUrl}" alt="OPPER Logo">
                <h1>OPPER Payment</h1>
            </div>
            <div class="content">
                <p><strong>Transaction Receipt</strong></p>
                <p><strong>Transaction ID:</strong> ${transaction.id}</p>
                <p><strong>Amount:</strong> ${transaction.amount} Ks</p>
                <p><strong>From:</strong> ${transaction.from_phone}</p>
                <p><strong>To:</strong> ${transaction.to_phone}</p>
                <p><strong>To ID:</strong> ${toUserId}</p>
                <p><strong>Note:</strong> ${transaction.note || "None"}</p>
                <p><strong>Time:</strong> ${transaction.timestamp}</p>
                <p><strong>Status:</strong> ${transaction.from_phone === currentUser.phone ? "Sent" : "Received"}</p>
                <div class="done-ui">
                    <img src="${logoUrl}" alt="Done Icon">
                    Transaction Completed
                </div>
                <div class="footer">
                    Powered by OPPER Payment
                </div>
            </div>
        `

    document.getElementById("receipt-overlay").style.display = "flex"
  } catch (error) {
    console.error("Show Receipt Error:", error.message)
    showNotification(`Error showing receipt: ${error.message}`, "error")
  }
}

function closeReceipt() {
  document.getElementById("receipt-overlay").style.display = "none"
  showSection("wallet")
}

function updateStatus(status) {
  const walletStatus = document.getElementById("wallet-status")
  const miStatus = document.getElementById("mi-status")
  walletStatus.className = `status ${status}`
  miStatus.className = `status ${status}`
  walletStatus.textContent =
    status === "pending" ? "Passport Verification Required" : status === "approved" ? "Approved" : "Passport Rejected"
  miStatus.textContent = walletStatus.textContent

  const passportForm = document.getElementById("passport-form")
  const passportSubmitted = document.getElementById("passport-submitted")

  if (status === "approved") {
    document.getElementById("transfer-btn").disabled = false
    passportForm.classList.add("hidden")
    passportSubmitted.classList.remove("hidden")
    document.getElementById("submitted-phone").textContent = currentUser.phone || "N/A"
    document.getElementById("submitted-passport").textContent = currentUser.passport_number || "N/A"
    document.getElementById("submitted-address").textContent = currentUser.address || "N/A"
    document.getElementById("submitted-time").textContent = currentUser.submitted_at
      ? new Date(currentUser.submitted_at).toLocaleString()
      : "N/A"
  } else if (status === "pending" && currentUser.submitted_at) {
    passportForm.classList.add("hidden")
    passportSubmitted.classList.remove("hidden")
    document.getElementById("submitted-phone").textContent = currentUser.phone || "N/A"
    document.getElementById("submitted-passport").textContent = currentUser.passport_number || "N/A"
    document.getElementById("submitted-address").textContent = currentUser.address || "N/A"
    document.getElementById("submitted-time").textContent = currentUser.submitted_at
      ? new Date(currentUser.submitted_at).toLocaleString()
      : "N/A"
  } else {
    passportForm.classList.remove("hidden")
    passportSubmitted.classList.add("hidden")
  }
}

async function uploadToImgur(file) {
  try {
    const formData = new FormData()
    formData.append("image", file)
    const response = await fetch("https://api.imgur.com/3/image", {
      method: "POST",
      headers: { Authorization: `Client-ID ${imgurClientId}` },
      body: formData,
      timeout: 10000,
    })
    const data = await response.json()
    if (!data.success) throw new Error("Imgur Upload Failed")
    return data.data.link
  } catch (error) {
    console.error("Imgur Upload Error:", error.message)
    throw error
  }
}

document.getElementById("submit-passport-btn").addEventListener("click", async () => {
  try {
    if (!isAuthenticated) {
      showNotification("Please log in to submit passport details", "error")
      showSection("auth")
      return
    }

    const passportNumber = document.getElementById("passport-number").value
    const address = document.getElementById("address").value
    const phone = document.getElementById("phone").value
    const paymentPin = document.getElementById("payment-pin").value
    const passportImage = document.getElementById("passport-image").files[0]
    const selfieImage = document.getElementById("selfie-image").files[0]

    if (
      !passportNumber ||
      !address ||
      !phone.match(/^09\d{9}$/) ||
      paymentPin.length !== 6 ||
      !passportImage ||
      !selfieImage
    ) {
      showNotification("Please fill all fields correctly. PIN must be 6 digits.", "error")
      return
    }

    // Show loading state
    const submitBtn = document.getElementById("submit-passport-btn")
    const originalText = submitBtn.textContent
    submitBtn.disabled = true
    submitBtn.textContent = "Uploading..."

    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("phone, passport_status")
      .eq("phone", phone)
      .neq("user_id", currentUser.user_id)
      .single()

    if (existingUser) {
      showNotification("This phone number is already registered with another account.", "error")
      submitBtn.disabled = false
      submitBtn.textContent = originalText
      return
    }

    // Upload images to Imgur
    const passportImageUrl = await uploadToImgur(passportImage)
    const selfieImageUrl = await uploadToImgur(selfieImage)

    submitBtn.textContent = "Submitting..."

    await retryOperation(async () => {
      const { error: updateError } = await supabase
        .from("users")
        .update({
          passport_number: passportNumber,
          address: address,
          phone: phone,
          payment_pin: paymentPin,
          passport_image: passportImageUrl,
          selfie_image: selfieImageUrl,
          passport_status: "pending",
          submitted_at: new Date().toISOString(),
        })
        .eq("user_id", currentUser.user_id)
      if (updateError) throw new Error(`Update User Error: ${updateError.message}`)
    })

    currentUser = {
      ...currentUser,
      passport_number: passportNumber,
      address: address,
      phone: phone,
      passport_status: "pending",
      submitted_at: new Date().toISOString(),
    }

    updateStatus("pending")
    showNotification("Passport details submitted successfully!", "success")
    submitBtn.disabled = false
    submitBtn.textContent = originalText
  } catch (error) {
    console.error("Submit Passport Error:", error.message)
    showNotification(`Error submitting passport details: ${error.message}`, "error")
    const submitBtn = document.getElementById("submit-passport-btn")
    submitBtn.disabled = false
    submitBtn.textContent = "Submit"
  }
})

function downloadApk() {
  window.open("https://appsgeyser.io/18731061/OPPER-Payment", "_blank")
}

function hideDownloadBar() {
  document.getElementById("download-bar").style.display = "none"
}

// Add logout button to the menu
document.addEventListener("DOMContentLoaded", () => {
  // Create logout button
  const logoutBtn = document.createElement("button")
  logoutBtn.innerHTML = '<img src="https://cdn-icons-png.flaticon.com/512/6001/6001778.png" alt="Logout">Logout'
  logoutBtn.id = "logout-btn"
  logoutBtn.onclick = logoutUser

  // Add to menu
  document.querySelector(".menu").appendChild(logoutBtn)
})
