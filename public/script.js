// Supabase client setup
const supabaseUrl = "https://vtsczzlnhsrgnbkfyizi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68";
const supabase = supabase.createClient(supabaseUrl, supabaseKey);
const imgurClientId = "5befa9dd970c7d0";
const logoUrl = "https://github.com/Opper125/opper-payment/raw/main/logo.png";

// DOM Elements
const elements = {
    // Audio elements
    introSound: document.getElementById('intro-sound'),
    transferSentSound: document.getElementById('transfer-sent-sound'),
    transferReceivedSound: document.getElementById('transfer-received-sound'),
    clickSound: document.getElementById('click-sound'),
    
    // Intro elements
    introContainer: document.getElementById('intro-container'),
    playSoundBtn: document.getElementById('play-sound-btn'),
    
    // Download bar elements
    downloadBar: document.getElementById('download-bar'),
    downloadApkBtn: document.getElementById('download-apk-btn'),
    closeDownloadBarBtn: document.getElementById('close-download-bar'),
    
    // ID badge
    idBadge: document.getElementById('id-badge'),
    userId: document.getElementById('user-id'),
    
    // Container elements
    walletContainer: document.getElementById('wallet-container'),
    historyContainer: document.getElementById('history-container'),
    profileContainer: document.getElementById('profile-container'),
    gameContainer: document.getElementById('game-container'),
    
    // Wallet elements
    balanceDisplay: document.getElementById('balance-display'),
    transferMoneyBtn: document.getElementById('transfer-money-btn'),
    passportStatus: document.getElementById('passport-status'),
    transferPhoneSection: document.getElementById('transfer-phone-section'),
    transferPhone: document.getElementById('transfer-phone'),
    receiverStatus: document.getElementById('receiver-status'),
    transferNextBtn: document.getElementById('transfer-next-btn'),
    transferDetailsSection: document.getElementById('transfer-details-section'),
    recipientInfo: document.getElementById('recipient-info'),
    transferAmount: document.getElementById('transfer-amount'),
    transferNote: document.getElementById('transfer-note'),
    transferConfirmBtn: document.getElementById('transfer-confirm-btn'),
    transferError: document.getElementById('transfer-error'),
    
    // History elements
    historyFilter: document.getElementById('history-filter'),
    totalIn: document.getElementById('total-in'),
    totalOut: document.getElementById('total-out'),
    historyList: document.getElementById('history-list'),
    
    // Profile elements
    profileUserId: document.getElementById('profile-user-id'),
    profilePassportStatus: document.getElementById('profile-passport-status'),
    passportForm: document.getElementById('passport-form'),
    passportNumber: document.getElementById('passport-number'),
    address: document.getElementById('address'),
    phone: document.getElementById('phone'),
    paymentPin: document.getElementById('payment-pin'),
    passportImage: document.getElementById('passport-image'),
    selfieImage: document.getElementById('selfie-image'),
    submitPassportBtn: document.getElementById('submit-passport-btn'),
    passportSubmitted: document.getElementById('passport-submitted'),
    submittedPhone: document.getElementById('submitted-phone'),
    submittedPassport: document.getElementById('submitted-passport'),
    submittedAddress: document.getElementById('submitted-address'),
    submittedTime: document.getElementById('submitted-time'),
    
    // Game elements
    backToWalletBtn: document.getElementById('back-to-wallet-btn'),
    
    // PIN elements
    pinOverlay: document.getElementById('pin-overlay'),
    pinContainer: document.getElementById('pin-container'),
    pinBoxes: document.querySelectorAll('.pin-box'),
    submitPinBtn: document.getElementById('submit-pin-btn'),
    cancelPinBtn: document.getElementById('cancel-pin-btn'),
    pinError: document.getElementById('pin-error'),
    
    // Receipt elements
    receiptOverlay: document.getElementById('receipt-overlay'),
    ticketContent: document.getElementById('ticket-content'),
    downloadReceiptBtn: document.getElementById('download-receipt-btn'),
    printReceiptBtn: document.getElementById('print-receipt-btn'),
    closeReceiptBtn: document.getElementById('close-receipt-btn'),
    
    // Menu elements
    walletBtn: document.getElementById('wallet-btn'),
    historyBtn: document.getElementById('history-btn'),
    gameBtn: document.getElementById('game-btn'),
    telegramBtn: document.getElementById('telegram-btn'),
    profileBtn: document.getElementById('profile-btn'),
    
    // Photo content
    photoContent: document.getElementById('photo-content')
};

// State variables
const state = {
    currentUser: {
        user_id: null,
        balance: 0,
        passport_status: "pending",
        phone: null,
        passport_number: null,
        address: null,
        submitted_at: null
    },
    allowTransfers: true,
    currentTransactionId: null,
    receiverData: null,
    historyFilter: "current",
    historyData: [],
    totalIn: 0,
    totalOut: 0,
    pinValues: ["", "", "", "", "", ""],
    activeSection: "wallet"
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Add click sound to all buttons
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', playClickSound);
    });
    
    // Hide intro after 8 seconds
    setTimeout(() => {
        elements.introContainer.style.animation = 'fadeOut 1s ease forwards';
        setTimeout(() => {
            elements.introContainer.style.display = 'none';
            initializeUser();
        }, 1000);
    }, 8000);
    
    // Setup event listeners
    setupEventListeners();
    
    // Show wallet container by default
    showSection('wallet');
});

// Play click sound
function playClickSound() {
    if (elements.clickSound) {
        elements.clickSound.currentTime = 0;
        elements.clickSound.play().catch(err => console.error("Click sound error:", err));
    }
}

// Play intro sound with user interaction
function playIntroSound() {
    if (elements.introSound) {
        elements.introSound.play().catch(err => console.error("Intro sound error:", err));
    }
}

// Initialize user
async function initializeUser() {
    try {
        let userId = localStorage.getItem("userId");
        if (!userId) {
            userId = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Check if ID exists
            const { data: existingUser, error } = await supabase
                .from("users")
                .select("user_id")
                .eq("user_id", userId)
                .single();
            
            if (!error || (error && error.code !== "PGRST116")) {
                // Generate a new ID if this one exists
                userId = Math.floor(100000 + Math.random() * 900000).toString();
            }
            
            // Create new user
            await supabase.from("users").insert({ user_id: userId, balance: 0, passport_status: "pending" });
            
            localStorage.setItem("userId", userId);
        }
        
        // Fetch user data
        const { data: user, error } = await supabase.from("users").select("*").eq("user_id", userId).single();
        
        if (!error && user) {
            state.currentUser = user;
        } else {
            state.currentUser.user_id = userId;
        }
        
        // Update UI with user data
        updateUserUI();
        
        // Check transfer settings
        await checkTransferSettings();
        
        // Load transaction history
        loadHistory();
        
        // Set up real-time subscriptions
        setupRealtimeSubscriptions(userId);
    } catch (error) {
        console.error("Initialization Error:", error.message);
        alert(`An error occurred: ${error.message}. Please try again.`);
    }
}

// Update UI with user data
function updateUserUI() {
    // Update user ID
    elements.userId.textContent = state.currentUser.user_id;
    elements.profileUserId.textContent = state.currentUser.user_id;
    
    // Update balance
    elements.balanceDisplay.textContent = `${state.currentUser.balance} Ks`;
    
    // Update passport status
    updatePassportStatus();
    
    // Show submitted passport details if available
    if (state.currentUser.passport_status !== "pending" || state.currentUser.submitted_at) {
        elements.passportForm.classList.add('hidden');
        elements.passportSubmitted.classList.remove('hidden');
        
        elements.submittedPhone.textContent = state.currentUser.phone || "N/A";
        elements.submittedPassport.textContent = state.currentUser.passport_number || "N/A";
        elements.submittedAddress.textContent = state.currentUser.address || "N/A";
        elements.submittedTime.textContent = state.currentUser.submitted_at ? 
            new Date(state.currentUser.submitted_at).toLocaleString() : "N/A";
    }
}

// Update passport status UI
function updatePassportStatus() {
    const status = state.currentUser.passport_status;
    
    // Update wallet passport status
    elements.passportStatus.className = `status ${status}`;
    elements.passportStatus.textContent = status === "pending" ? 
        "Passport Verification Required" : 
        status === "approved" ? "Approved" : "Passport Rejected";
    
    // Update profile passport status
    elements.profilePassportStatus.className = `status ${status}`;
    elements.profilePassportStatus.textContent = status === "pending" ? 
        "Passport Verification Required" : 
        status === "approved" ? "Approved" : "Passport Rejected";
    
    // Enable/disable transfer button
    elements.transferMoneyBtn.disabled = status !== "approved";
}

// Check transfer settings
async function checkTransferSettings() {
    try {
        const { data, error } = await supabase.from("settings").select("allow_transfers").single();
        
        if (!error && data) {
            state.allowTransfers = data.allow_transfers;
        } else {
            state.allowTransfers = false;
        }
    } catch (error) {
        console.error("Check Transfer Settings Error:", error.message);
        state.allowTransfers = false;
    }
}

// Set up realtime subscriptions
function setupRealtimeSubscriptions(userId) {
    // Users channel
    supabase
        .channel("users-channel")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "users", filter: `user_id=eq.${userId}` },
            (payload) => {
                state.currentUser = { ...state.currentUser, ...payload.new };
                updateUserUI();
            },
        )
        .subscribe();
    
    // Transactions channel
    supabase
        .channel("transactions-channel")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, async (payload) => {
            const transaction = payload.new;
            if (transaction.to_phone === state.currentUser.phone) {
                // Show notification for received money
                showReceivedNotification(transaction.amount, transaction.from_phone);
                
                // Play received sound
                if (elements.transferReceivedSound) {
                    elements.transferReceivedSound.play().catch(err => console.error("Received sound error:", err));
                }
                
                // Reload history
                loadHistory();
            }
        })
        .subscribe();
    
    // Settings channel
    supabase
        .channel("settings-channel")
        .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, (payload) => {
            state.allowTransfers = payload.new.allow_transfers;
        })
        .subscribe();
}

// Show received notification
function showReceivedNotification(amount, fromPhone) {
    const notification = document.createElement("div");
    notification.className = "receiver-message";
    notification.innerHTML = `Received ${amount} Ks<br>From: ${fromPhone}`;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 4000);
}

// Load transaction history
async function loadHistory() {
    try {
        const month = state.historyFilter;
        const now = new Date();
        const year = now.getFullYear();
        const monthFilter = month === "current" ? now.getMonth() : now.getMonth() - 1;
        const startDate = new Date(year, monthFilter, 1).toISOString();
        const endDate = new Date(year, monthFilter + 1, 0).toISOString();
        
        const { data: transactions, error } = await supabase
            .from("transactions")
            .select("*")
            .or(`from_phone.eq.${state.currentUser.phone},to_phone.eq.${state.currentUser.phone}`)
            .gte("created_at", startDate)
            .lte("created_at", endDate)
            .order("created_at", { ascending: false });
        
        if (!error && transactions) {
            state.historyData = transactions;
            
            // Calculate totals
            let inTotal = 0, outTotal = 0;
            transactions.forEach((t) => {
                if (t.from_phone === state.currentUser.phone) {
                    outTotal += t.amount;
                } else {
                    inTotal += t.amount;
                }
            });
            
            state.totalIn = inTotal;
            state.totalOut = outTotal;
            
            // Update UI
            updateHistoryUI();
        }
    } catch (error) {
        console.error("Load History Error:", error.message);
    }
}

// Update history UI
function updateHistoryUI() {
    elements.totalIn.textContent = state.totalIn;
    elements.totalOut.textContent = state.totalOut;
    
    // Clear history list
    elements.historyList.innerHTML = '';
    
    // Add history items
    if (state.historyData.length > 0) {
        state.historyData.forEach(transaction => {
            const isOutgoing = transaction.from_phone === state.currentUser.phone;
            const historyItem = document.createElement('div');
            historyItem.className = `history-item ${isOutgoing ? 'out' : 'in'}`;
            historyItem.innerHTML = `
                <p>${isOutgoing ? '-' : '+'}${transaction.amount} Ks</p>
                <p>Phone: ${isOutgoing ? transaction.to_phone : transaction.from_phone}</p>
                <p>Note: ${transaction.note || "None"}</p>
                <p>Time: ${transaction.timestamp || transaction.created_at}</p>
                <p>Status: ${isOutgoing ? "Sent" : "Received"}</p>
                <button class="print-btn" data-id="${transaction.id}"></button>
            `;
            
            // Add event listener to print button
            const printBtn = historyItem.querySelector('.print-btn');
            printBtn.addEventListener('click', () => {
                playClickSound();
                showReceipt(transaction.id);
            });
            
            elements.historyList.appendChild(historyItem);
        });
    } else {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'No transactions found';
        emptyMessage.className = 'text-center text-gray-400 py-8';
        elements.historyList.appendChild(emptyMessage);
    }
}

// Check phone number
async function checkPhone() {
    try {
        const phone = elements.transferPhone.value;
        
        // Reset status
        elements.receiverStatus.textContent = "";
        elements.receiverStatus.classList.add('hidden');
        elements.transferNextBtn.disabled = true;
        
        // Validate phone format
        if (phone.match(/^09\d{9}$/)) {
            // Check if it's the user's own phone
            if (phone === state.currentUser.phone) {
                elements.receiverStatus.textContent = "You cannot transfer money to your own phone number.";
                elements.receiverStatus.classList.remove('hidden');
                return;
            }
            
            // Check if receiver exists
            const { data: receiver, error } = await supabase
                .from("users")
                .select("user_id, phone, passport_status")
                .eq("phone", phone)
                .single();
            
            if (!error && receiver && receiver.passport_status === "approved") {
                elements.receiverStatus.textContent = `Account Found: ${receiver.phone} (ID: ${receiver.user_id})`;
                elements.receiverStatus.classList.remove('hidden');
                elements.receiverStatus.style.color = 'var(--success-color)';
                state.receiverData = receiver;
                elements.transferNextBtn.disabled = false;
            } else {
                elements.receiverStatus.textContent = "Account not found or passport not approved.";
                elements.receiverStatus.classList.remove('hidden');
                elements.receiverStatus.style.color = 'var(--error-color)';
                state.receiverData = null;
                elements.transferNextBtn.disabled = true;
            }
        }
    } catch (error) {
        console.error("Check Phone Error:", error.message);
        elements.receiverStatus.textContent = "An error occurred.";
        elements.receiverStatus.classList.remove('hidden');
        elements.receiverStatus.style.color = 'var(--error-color)';
        state.receiverData = null;
        elements.transferNextBtn.disabled = true;
    }
}

// Handle PIN input
function handlePinInput(event, index) {
    const value = event.target.value;
    state.pinValues[index] = value;
    
    // Add filled class if value is entered
    if (value) {
        event.target.classList.add('filled');
    } else {
        event.target.classList.remove('filled');
    }
    
    // Move to next input if value is entered
    if (value && index < 5) {
        elements.pinBoxes[index + 1].focus();
    }
}

// Submit transfer
async function submitTransfer() {
    try {
        // Check if transfers are allowed
        if (!state.allowTransfers) {
            elements.pinError.textContent = "Transfer functionality is currently disabled by the server.";
            elements.pinError.classList.remove('hidden');
            return;
        }
        
        // Get PIN, amount, and note
        const pin = state.pinValues.join("");
        const phone = state.receiverData.phone;
        const amount = Number.parseInt(elements.transferAmount.value);
        const note = elements.transferNote.value;
        
        // Validate PIN
        if (pin.length !== 6) {
            elements.pinError.textContent = "PIN must be 6 digits.";
            elements.pinError.classList.remove('hidden');
            return;
        }
        
        // Show processing animation
        const animation = document.createElement("div");
        animation.className = "transfer-animation";
        animation.textContent = "Processing Transfer...";
        document.body.appendChild(animation);
        
        // Fetch sender data
        const { data: sender, error: senderError } = await supabase
            .from("users")
            .select("*")
            .eq("user_id", state.currentUser.user_id)
            .eq("payment_pin", pin)
            .single();
        
        // Fetch receiver data
        const { data: receiver, error: receiverError } = await supabase
            .from("users")
            .select("*")
            .eq("phone", phone)
            .single();
        
        // Validate sender, receiver, balance, and status
        if (!sender || !receiver || sender.balance < amount || receiver.passport_status !== "approved") {
            elements.pinError.textContent = !sender
                ? "Incorrect PIN."
                : !receiver
                    ? "Recipient account not found."
                    : sender.balance < amount
                        ? "Insufficient balance."
                        : "Recipient passport not approved.";
            elements.pinError.classList.remove('hidden');
            animation.remove();
            return;
        }
        
        // Get current time
        const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Yangon" });
        
        // Update sender balance
        await supabase
            .from("users")
            .update({ balance: sender.balance - amount })
            .eq("user_id", sender.user_id);
        
        // Update receiver balance
        await supabase
            .from("users")
            .update({ balance: receiver.balance + amount })
            .eq("user_id", receiver.user_id);
        
        // Create transaction record
        const { data, error: insertError } = await supabase
            .from("transactions")
            .insert({
                from_phone: sender.phone,
                to_phone: receiver.phone,
                amount: amount,
                note: note || null,
                timestamp: now,
            })
            .select("id")
            .single();
        
        if (insertError) throw new Error(`Insert Transaction Error: ${insertError.message}`);
        
        // Update current user balance
        state.currentUser.balance = sender.balance - amount;
        elements.balanceDisplay.textContent = `${state.currentUser.balance} Ks`;
        
        // Close PIN overlay
        elements.pinOverlay.style.display = 'none';
        
        // Remove animation
        animation.remove();
        
        // Play success sound
        if (elements.transferSentSound) {
            elements.transferSentSound.play().catch(err => console.error("Sent sound error:", err));
        }
        
        // Show success animation
        const successAnimation = document.createElement("div");
        successAnimation.className = "success-animation";
        successAnimation.innerHTML = `
            <img src="${logoUrl}" alt="OPPER Logo" />
            Transfer Successful
        `;
        document.body.appendChild(successAnimation);
        
        // Set transaction ID
        state.currentTransactionId = data.id;
        
        // Remove success animation after delay
        setTimeout(() => {
            successAnimation.remove();
            
            // Show receipt
            elements.ticketContent.innerHTML = `
                <div class="header">
                    <img src="${logoUrl}" alt="OPPER Logo" />
                    <h1>OPPER Payment</h1>
                </div>
                <div class="content">
                    <p class="font-bold">Transaction Receipt</p>
                    <p><strong>Amount:</strong> ${amount} Ks</p>
                    <p><strong>From:</strong> ${sender.phone}</p>
                    <p><strong>To:</strong> ${receiver.phone}</p>
                    <p><strong>To ID:</strong> ${receiver.user_id}</p>
                    <p><strong>Note:</strong> ${note || "None"}</p>
                    <p><strong>Time:</strong> ${now}</p>
                    <p><strong>Status:</strong> Sent</p>
                    <div class="done-ui">
                        <img src="${logoUrl}" alt="Done Icon" />
                        Transaction Completed
                    </div>
                    <div class="footer">
                        Powered by OPPER Payment
                    </div>
                </div>
            `;
            elements.receiptOverlay.style.display = 'flex';
        }, 2500);
        
        // Reset form
        state.pinValues = ["", "", "", "", "", ""];
        elements.pinBoxes.forEach(box => {
            box.value = "";
            box.classList.remove('filled');
        });
        elements.transferPhone.value = "";
        elements.transferAmount.value = "";
        elements.transferNote.value = "";
        elements.transferPhoneSection.classList.add('hidden');
        elements.transferDetailsSection.classList.add('hidden');
        elements.pinError.classList.add('hidden');
        elements.transferError.classList.add('hidden');
        
        // Reload history
        loadHistory();
    } catch (error) {
        console.error("Transfer Error:", error.message);
        elements.pinError.textContent = `An error occurred during transfer: ${error.message}`;
        elements.pinError.classList.remove('hidden');
        
        // Remove animation if exists
        const animation = document.querySelector(".transfer-animation");
        if (animation) animation.remove();
    }
}

// Download receipt
async function downloadReceipt() {
    try {
        const canvas = await html2canvas(elements.ticketContent, {
            scale: 4,
            useCORS: true,
            backgroundColor: "#FFFFFF",
            logging: false,
            imageTimeout: 15000,
        });
        
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `Transaction_${state.currentTransactionId}.png`;
        link.click();
    } catch (error) {
        console.error("Download Receipt Error:", error.message);
        alert(`Error downloading receipt: ${error.message}`);
    }
}

// Print receipt
function printReceipt() {
    try {
        window.print();
    } catch (error) {
        console.error("Print Receipt Error:", error.message);
        alert(`Error printing receipt: ${error.message}`);
    }
}

// Show receipt for a transaction
async function showReceipt(transactionId) {
    try {
        const { data: transaction, error } = await supabase
            .from("transactions")
            .select("*")
            .eq("id", transactionId)
            .single();
        
        if (error) throw error;
        
        state.currentTransactionId = transactionId;
        
        // Get receiver user ID
        let toUserId;
        if (transaction.to_phone === state.currentUser.phone) {
            toUserId = state.currentUser.user_id;
        } else {
            const { data } = await supabase.from("users").select("user_id").eq("phone", transaction.to_phone).single();
            toUserId = data?.user_id;
        }
        
        // Update receipt content
        elements.ticketContent.innerHTML = `
            <div class="header">
                <img src="${logoUrl}" alt="OPPER Logo" />
                <h1>OPPER Payment</h1>
            </div>
            <div class="content">
                <p class="font-bold">Transaction Receipt</p>
                <p><strong>Amount:</strong> ${transaction.amount} Ks</p>
                <p><strong>From:</strong> ${transaction.from_phone}</p>
                <p><strong>To:</strong> ${transaction.to_phone}</p>
                <p><strong>To ID:</strong> ${toUserId || "N/A"}</p>
                <p><strong>Note:</strong> ${transaction.note || "None"}</p>
                <p><strong>Time:</strong> ${transaction.timestamp || transaction.created_at}</p>
                <p><strong>Status:</strong> ${transaction.from_phone === state.currentUser.phone ? "Sent" : "Received"}</p>
                <div class="done-ui">
                    <img src="${logoUrl}" alt="Done Icon" />
                    Transaction Completed
                </div>
                <div class="footer">
                    Powered by OPPER Payment
                </div>
            </div>
        `;
        elements.receiptOverlay.style.display = 'flex';
    } catch (error) {
        console.error("Show Receipt Error:", error.message);
        alert(`Error showing receipt: ${error.message}`);
    }
}

// Submit passport details
async function submitPassport() {
    try {
        const passportNumber = elements.passportNumber.value;
        const address = elements.address.value;
        const phone = elements.phone.value;
        const paymentPin = elements.paymentPin.value;
        const passportImage = elements.passportImage.files[0];
        const selfieImage = elements.selfieImage.files[0];
        
        // Validate inputs
        if (
            !passportNumber ||
            !address ||
            !phone.match(/^09\d{9}$/) ||
            paymentPin.length !== 6 ||
            !passportImage ||
            !selfieImage
        ) {
            alert("Please fill all fields correctly. PIN must be 6 digits.");
            return;
        }
        
        // Check if phone is already registered
        const { data: existingUser, error: checkError } = await supabase
            .from("users")
            .select("phone, passport_status")
            .eq("phone", phone)
            .single();
        
        if (!checkError && existingUser && existingUser.passport_status === "approved") {
            alert("This phone number is already registered and approved.");
            return;
        }
        
        // Upload passport image to Imgur
        const passportImageUrl = await uploadToImgur(passportImage);
        
        // Upload selfie image to Imgur
        const selfieImageUrl = await uploadToImgur(selfieImage);
        
        // Update user data
        await supabase
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
            .eq("user_id", state.currentUser.user_id);
        
        // Update current user
        state.currentUser = {
            ...state.currentUser,
            passport_number: passportNumber,
            address: address,
            phone: phone,
            passport_status: "pending",
            submitted_at: new Date().toISOString(),
        };
        
        // Update UI
        updateUserUI();
        
        alert("Passport details submitted successfully!");
    } catch (error) {
        console.error("Submit Passport Error:", error.message);
        alert(`Error submitting passport details: ${error.message}`);
    }
}

// Upload to Imgur
async function uploadToImgur(file) {
    try {
        const formData = new FormData();
        formData.append("image", file);
        
        const response = await fetch("https://api.imgur.com/3/image", {
            method: "POST",
            headers: { Authorization: `Client-ID ${imgurClientId}` },
            body: formData,
        });
        
        const data = await response.json();
        if (!data.success) throw new Error("Imgur Upload Failed");
        
        return data.data.link;
    } catch (error) {
        console.error("Imgur Upload Error:", error.message);
        throw error;
    }
}

// Show section
function showSection(section) {
    // Hide all containers
    elements.walletContainer.classList.remove('active');
    elements.historyContainer.classList.remove('active');
    elements.profileContainer.classList.remove('active');
    elements.gameContainer.classList.remove('active');
    
    // Remove active class from all menu buttons
    elements.walletBtn.classList.remove('active');
    elements.historyBtn.classList.remove('active');
    elements.profileBtn.classList.remove('active');
    elements.gameBtn.classList.remove('active');
    
    // Show selected container
    switch (section) {
        case 'wallet':
            elements.walletContainer.classList.add('active');
            elements.walletBtn.classList.add('active');
            break;
        case 'history':
            elements.historyContainer.classList.add('active');
            elements.historyBtn.classList.add('active');
            loadHistory();
            break;
        case 'profile':
            elements.profileContainer.classList.add('active');
            elements.profileBtn.classList.add('active');
            break;
        case 'game':
            elements.gameContainer.classList.add('active');
            elements.gameBtn.classList.add('active');
            break;
    }
    
    state.activeSection = section;
}

// Setup event listeners
function setupEventListeners() {
    // Play sound button
    elements.playSoundBtn.addEventListener('click', playIntroSound);
    
    // Download bar
    elements.downloadApkBtn.addEventListener('click', downloadApk);
    elements.closeDownloadBarBtn.addEventListener('click', () => {
        elements.downloadBar.style.display = 'none';
    });
    
    // Menu buttons
    elements.walletBtn.addEventListener('click', () => showSection('wallet'));
    elements.historyBtn.addEventListener('click', () => showSection('history'));
    elements.profileBtn.addEventListener('click', () => showSection('profile'));
    elements.gameBtn.addEventListener('click', () => showSection('game'));
    elements.telegramBtn.addEventListener('click', openTelegram);
    
    // Wallet buttons
    elements.transferMoneyBtn.addEventListener('click', handleShowTransferPhone);
    elements.transferPhone.addEventListener('input', () => {
        if (elements.transferPhone.value.match(/^09\d{9}$/)) {
            checkPhone();
        } else {
            elements.receiverStatus.classList.add('hidden');
            elements.transferNextBtn.disabled = true;
        }
    });
    elements.transferNextBtn.addEventListener('click', handleShowTransferDetails);
    elements.transferConfirmBtn.addEventListener('click', handleShowPinOverlay);
    
    // PIN inputs
    elements.pinBoxes.forEach((box, index) => {
        box.addEventListener('input', (e) => handlePinInput(e, index));
        box.addEventListener('keydown', (e) => {
            // Handle backspace
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                elements.pinBoxes[index - 1].focus();
            }
        });
    });
    
    // PIN buttons
    elements.submitPinBtn.addEventListener('click', submitTransfer);
    elements.cancelPinBtn.addEventListener('click', () => {
        elements.pinOverlay.style.display = 'none';
        elements.transferDetailsSection.classList.remove('hidden');
    });
    
    // Receipt buttons
    elements.downloadReceiptBtn.addEventListener('click', downloadReceipt);
    elements.printReceiptBtn.addEventListener('click', printReceipt);
    elements.closeReceiptBtn.addEventListener('click', () => {
        elements.receiptOverlay.style.display = 'none';
    });
    
    // History filter
    elements.historyFilter.addEventListener('change', () => {
        state.historyFilter = elements.historyFilter.value;
        loadHistory();
    });
    
    // Passport form
    elements.submitPassportBtn.addEventListener('click', submitPassport);
    
    // Game back button
    elements.backToWalletBtn.addEventListener('click', () => showSection('wallet'));
}

// Show transfer phone input
function handleShowTransferPhone() {
    if (state.currentUser.passport_status !== "approved") {
        alert("Passport must be approved to transfer money.");
        return;
    }
    
    if (!state.allowTransfers) {
        alert("Transfer functionality is currently disabled by the server.");
        return;
    }
    
    elements.transferPhoneSection.classList.remove('hidden');
    elements.transferDetailsSection.classList.add('hidden');
}

// Show transfer details
function handleShowTransferDetails() {
    if (!state.receiverData) return;
    
    elements.transferPhoneSection.classList.add('hidden');
    elements.transferDetailsSection.classList.remove('hidden');
    elements.recipientInfo.textContent = `${state.receiverData.phone} (ID: ${state.receiverData.user_id})`;
}

// Show PIN overlay
function handleShowPinOverlay() {
    const amount = Number.parseInt(elements.transferAmount.value);
    if (!amount || amount <= 0 || amount > 1000000) {
        elements.transferError.textContent = "Invalid amount. Max 1,000,000 Ks.";
        elements.transferError.classList.remove('hidden');
        return;
    }
    
    elements.transferDetailsSection.classList.add('hidden');
    elements.pinOverlay.style.display = 'flex';
    state.pinValues = ["", "", "", "", "", ""];
    elements.pinBoxes.forEach(box => {
        box.value = "";
        box.classList.remove('filled');
    });
    elements.pinError.classList.add('hidden');
    
    // Focus first PIN input
    elements.pinBoxes[0].focus();
}

// Download APK
function downloadApk() {
    window.open("https://appsgeyser.io/18731061/OPPER-Payment", "_blank");
}

// Open Telegram
function openTelegram() {
    window.open("https://t.me/OPPERN", "_blank");
}
