const supabaseUrl = "https://vtsczzlnhsrgnbkfyizi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = {
    id: null,
    user_id: null,
    email: null,
    balance: 0,
    passport_status: "pending",
    phone: null,
};
let allowTransfers = true;
let currentTransactionId = null;
let receiverData = null;
let isAuthenticated = false;

const logoUrl = "https://github.com/Opper125/opper-payment/raw/main/logo.png";

// Play Intro Sound
window.onload = () => {
    const introSound = document.getElementById("intro-sound");
    introSound.play().catch((err) => console.error("Intro sound error:", err));
    setTimeout(() => {
        document.getElementById("intro-container").style.display = "none";
        initializeApp();
    }, 8000);
};

// AUTH FUNCTIONS
async function initializeApp() {
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw new Error(`Session Error: ${sessionError.message}`);
        if (session) {
            await handleSuccessfulAuth(session.user);
        } else {
            showSection("auth");
        }
        await checkTransferSettings();
    } catch (error) {
        console.error("Initialization Error:", error.message);
        showNotification(`စတင်ရန်အမှားဖြစ်ပေါ်ခဲ့သည်: ${error.message}`, "error");
    }
}

function switchTab(tab) {
    const loginTab = document.getElementById("login-tab");
    const signupTab = document.getElementById("signup-tab");
    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");

    if (tab === "login") {
        loginTab.classList.add("active");
        signupTab.classList.remove("active");
        loginForm.classList.remove("hidden");
        signupForm.classList.add("hidden");
    } else {
        loginTab.classList.remove("active");
        signupTab.classList.add("active");
        loginForm.classList.add("hidden");
        signupForm.classList.remove("hidden");
    }
}

async function signupUser() {
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    const messageElement = document.getElementById("signup-message");
    const signupBtn = document.getElementById("signup-btn");

    messageElement.textContent = "";
    messageElement.classList.remove("error-message", "success-message");
    signupBtn.disabled = true;
    const originalText = signupBtn.textContent;
    signupBtn.textContent = "အကောင့်ဖွင့်နေသည်...";

    try {
        // Validate form
        if (!email || !password || !confirmPassword) {
            throw new Error("ကျေးဇူးပြု၍ အကွက်အားလုံးဖြည့်ပါ။");
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error("ကျေးဇူးပြု၍ မမှန်ကန်သော အီးမေးလ်လိပ်စာထည့်ပါ။");
        }
        if (password !== confirmPassword) {
            throw new Error("စကားဝှက်များ မကိုက်ညီပါ။");
        }
        if (password.length < 6) {
            throw new Error("စကားဝှက်သည် အနည်းဆုံး ၆ လုံးရှိရမည်။");
        }

        console.log("Attempting to check if email exists:", email);
        // Check if email already exists
        const { data: existingUser, error: checkError } = await supabase
            .from("users")
            .select("email")
            .eq("email", email)
            .single();
        if (existingUser) {
            throw new Error("ဤအီးမေးလ်သည် မှတ်ပုံတင်ပြီးဖြစ်သည်။");
        }
        if (checkError && checkError.code !== "PGRST116") {
            console.error("Email check error:", checkError);
            throw new Error(`အီးမေးလ်စစ်ဆေးမှု မအောင်မြင်ပါ: ${checkError.message}`);
        }

        console.log("Attempting to sign up user with email:", email);
        // Sign up user with Supabase Auth
        const { data: { user }, error: signupError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: window.location.origin
            }
        });

        if (signupError) {
            console.error("Signup error:", signupError);
            throw new Error(`အကောင့်ဖွင့်မှု မအောင်မြင်ပါ: ${signupError.message}`);
        }
        if (!user) {
            throw new Error("အကောင့်ဖွင့်မှု မအောင်မြင်ပါ: အသုံးပြုသူဒေတာမရရှိပါ။");
        }

        console.log("User signed up successfully, user ID:", user.id);

        // Wait briefly to ensure trigger has inserted user
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Fetch user profile to verify insertion
        console.log("Fetching user profile for auth_id:", user.id);
        const { data: userProfile, error: profileError } = await supabase
            .from("users")
            .select("*")
            .eq("auth_id", user.id)
            .single();

        if (profileError || !userProfile) {
            console.error("Profile fetch error:", profileError);
            // Clean up auth user if profile fetch fails
            await supabase.auth.admin.deleteUser(user.id);
            throw new Error(`အသုံးပြုသူပရိုဖိုင်ထုတ်ယူမှု မအောင်မြင်ပါ: ${profileError ? profileError.message : 'အသုံးပြုသူဒေတာမတွေ့ပါ'}`);
        }

        console.log("User profile fetched successfully:", userProfile);
        // Automatically log in the user
        const { data: { session }, error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (loginError) {
            console.error("Login error after signup:", loginError);
            // Clean up user record and auth user
            await supabase.from("users").delete().eq("auth_id", user.id);
            await supabase.auth.admin.deleteUser(user.id);
            throw new Error(`အကောင့်ဝင်မှု မအောင်မြင်ပါ: ${loginError.message}`);
        }

        console.log("Login successful after signup");
        messageElement.textContent = "အကောင့်ဖွင့်ပြီးပါပြီ။ ဝယ်လဒ်သို့ ပြောင်းနေသည်...";
        messageElement.classList.add("success-message");
        playSound("success");

        // Reset form
        document.getElementById("signup-email").value = "";
        document.getElementById("signup-password").value = "";
        document.getElementById("confirm-password").value = "";

        await handleSuccessfulAuth(user);
    } catch (error) {
        console.error("Signup Error:", error.message, error.stack);
        messageElement.textContent = error.message;
        messageElement.classList.add("error-message");
        playSound("error");
    } finally {
        signupBtn.disabled = false;
        signupBtn.textContent = originalText;
    }
}

async function loginUser() {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const messageElement = document.getElementById("login-message");
    const loginBtn = document.getElementById("login-btn");

    messageElement.textContent = "";
    messageElement.classList.remove("error-message", "success-message");
    loginBtn.disabled = true;
    const originalText = loginBtn.textContent;
    loginBtn.textContent = "ဝင်ရောက်နေသည်...";

    try {
        if (!email || !password) {
            throw new Error("ကျေးဇူးပြု၍ အီးမေးလ်နှင့် စကားဝှက်ထည့်ပါ။");
        }

        const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (signInError) {
            throw new Error(`ဝင်ရောက်မှု မအောင်မြင်ပါ: ${signInError.message}`);
        }
        if (!user) {
            throw new Error("မမှန်ကန်သော အီးမေးလ် သို့မဟုတ် စကားဝှက်။");
        }

        showLoginSuccessAnimation();
        await handleSuccessfulAuth(user);

        document.getElementById("login-email").value = "";
        document.getElementById("login-password").value = "";
    } catch (error) {
        console.error("Login Error:", error.message);
        messageElement.textContent = error.message;
        messageElement.classList.add("error-message");
        playSound("error");
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = originalText;
    }
}

async function handleSuccessfulAuth(authUser) {
    try {
        console.log("Fetching user profile for auth_id:", authUser.id);
        const { data: userProfile, error: profileError } = await supabase
            .from("users")
            .select("*")
            .eq("auth_id", authUser.id)
            .single();

        if (profileError) {
            console.error("Profile fetch error:", profileError);
            throw new Error(`အသုံးပြုသူပရိုဖိုင်ထုတ်ယူမှု မအောင်မြင်ပါ: ${profileError.message}`);
        }
        if (!userProfile) {
            throw new Error("အသုံးပြုသူပရိုဖိုင်မတွေ့ပါ။");
        }

        currentUser = {
            id: authUser.id,
            user_id: userProfile.user_id,
            email: authUser.email,
            balance: userProfile.balance,
            passport_status: userProfile.passport_status,
            phone: userProfile.phone,
            passport_number: userProfile.passport_number,
            address: userProfile.address,
            submitted_at: userProfile.submitted_at
        };
        isAuthenticated = true;

        document.getElementById("id-badge").textContent = `ID: ${currentUser.user_id}`;
        document.getElementById("mi-id").textContent = currentUser.user_id;
        document.getElementById("balance").textContent = `${currentUser.balance} Ks`;
        updateStatus(currentUser.passport_status);

        showSection("wallet");
        showNotification(`ပြန်လည်ကြိုဆိုပါသည်၊ ${currentUser.email}!`, "success");

        setupRealtimeSubscriptions();
        loadHistory();
    } catch (error) {
        console.error("Auth Handler Error:", error.message);
        showNotification(error.message, "error");
    }
}

async function logoutUser() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(`အကောင့်ထွက်ရန်အမှားဖြစ်ပေါ်ခဲ့သည်: ${error.message}`);

        currentUser = {
            id: null,
            user_id: null,
            email: null,
            balance: 0,
            passport_status: "pending",
            phone: null
        };
        isAuthenticated = false;

        showSection("auth");
        showNotification("အကောင့်မှ ထွက်ပြီးပါပြီ။", "success");
    } catch (error) {
        console.error("Logout Error:", error.message);
        showNotification(error.message, "error");
    }
}

// CORE APP FUNCTIONS
function showSection(sectionId) {
    if (sectionId !== "auth" && !isAuthenticated) {
        showNotification("ကျေးဇူးပြု၍ အကောင့်ဝင်ပါ။", "error");
        sectionId = "auth";
    }
    ["auth", "wallet", "host", "mi", "game"].forEach((id) => {
        document.getElementById(id).classList.toggle("active", id === sectionId);
        if (id !== "auth" && document.getElementById(`${id}-btn`)) {
            document.getElementById(`${id}-btn`).classList.toggle("active", id === sectionId);
        }
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function openTelegram() {
    window.open("https://t.me/OPPERN", "_blank");
}

function showNotification(message, type) {
    const notification = document.createElement("div");
    notification.className = `notification ${type}-notification`;
    notification.textContent = message;
    document.body.appendChild(notification);
    playSound(type);
    setTimeout(() => notification.classList.add("show"), 10);
    setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

function playSound(type) {
    try {
        if (type === "success") {
            document.getElementById("success-sound").play();
        } else if (type === "error") {
            document.getElementById("error-sound").play();
        }
    } catch (error) {
        console.error("Sound play error:", error);
    }
}

function showLoginSuccessAnimation() {
    const animation = document.createElement("div");
    animation.className = "login-success-animation";
    animation.innerHTML = `
        <img src="${logoUrl}" alt="OPPER Logo">
        <div class="success-message">ဝင်ရောက်မှု အောင်မြင်ပါသည်</div>
    `;
    document.body.appendChild(animation);
    setTimeout(() => animation.remove(), 2500);
}

async function setupRealtimeSubscriptions() {
    supabase
        .channel("users-channel")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "users",
                filter: `user_id=eq.${currentUser.user_id}`
            },
            (payload) => {
                currentUser = { ...currentUser, ...payload.new };
                document.getElementById("balance").textContent = `${currentUser.balance} Ks`;
                updateStatus(currentUser.passport_status);
            }
        )
        .subscribe();

    supabase
        .channel("transactions-channel")
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "transactions"
            },
            async (payload) => {
                const transaction = payload.new;
                if (transaction.to_phone === currentUser.phone) {
                    const message = document.createElement("div");
                    message.className = "receiver-message";
                    message.innerHTML = `လက်ခံရရှိသည် ${transaction.amount} Ks<br>မှ: ${transaction.from_phone}`;
                    document.body.appendChild(message);
                    document.getElementById("transfer-received-sound").play().catch((err) => console.error("Received sound error:", err));
                    setTimeout(() => message.remove(), 4000);
                }
                loadHistory();
            }
        )
        .subscribe();

    supabase
        .channel("settings-channel")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "settings"
            },
            (payload) => {
                allowTransfers = payload.new.allow_transfers;
            }
        )
        .subscribe();
}

async function retryOperation(operation, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            console.warn(`Retry ${i + 1}/${maxRetries} failed: ${error.message}`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
}

async function checkTransferSettings() {
    try {
        const { data, error } = await supabase.from("settings").select("allow_transfers").single();
        if (error) throw new Error(`ဆက်တင်ထုတ်ယူမှု မအောင်မြင်ပါ: ${error.message}`);
        allowTransfers = data.allow_transfers;
    } catch (error) {
        console.error("Check Transfer Settings Error:", error.message);
        allowTransfers = false;
    }
}

function showPhoneInput() {
    if (!isAuthenticated) {
        showNotification("ကျေးဇူးပြု၍ အကောင့်ဝင်ပါ။", "error");
        showSection("auth");
        return;
    }
    if (currentUser.passport_status !== "approved") {
        showNotification("ငွေလွှဲရန် နိုင်ငံကူးလက်မှတ်အတည်ပြုရန် လိုအပ်သည်။", "error");
        return;
    }
    if (!allowTransfers) {
        showNotification("ဆာဗာမှ ငွေလွှဲလုပ်ဆောင်မှုကို ပိတ်ထားသည်။", "error");
        return;
    }
    document.getElementById("transfer-phone-section").classList.remove("hidden");
    document.getElementById("transfer-details").classList.add("hidden");
    document.getElementById("pin-overlay").style.display = "none";
}

async function checkPhone() {
    try {
        const phone = document.getElementById("transfer-phone").value;
        const receiverName = document.getElementById("receiver-name");
        const nextBtn = document.getElementById("next-btn");
        receiverName.textContent = "";
        nextBtn.disabled = true;
        if (phone.match(/^09\d{9}$/)) {
            if (phone === currentUser.phone) {
                receiverName.className = "account-status not-found";
                receiverName.textContent = "သင့်ဖုန်းနံပါတ်သို့ ငွေလွှဲမရပါ။";
                return;
            }
            const { data: receiver, error } = await supabase
                .from("users")
                .select("user_id, phone, passport_status")
                .eq("phone", phone)
                .single();
            if (error && error.code !== "PGRST116") throw error;
            if (receiver && receiver.passport_status === "approved") {
                receiverName.className = "account-status found";
                receiverName.textContent = `အကောင့်တွေ့ရှိသည်: ${receiver.phone} (ID: ${receiver.user_id})`;
                nextBtn.disabled = false;
                receiverData = receiver;
            } else {
                receiverName.className = "account-status not-found";
                receiverName.textContent = "အကောင့်မတွေ့ပါ သို့မဟုတ် နိုင်ငံကူးလက်မှတ်အတည်မပြုရသေးပါ။";
            }
        }
    } catch (error) {
        console.error("Check Phone Error:", error.message);
        document.getElementById("receiver-name").textContent = "အမှားတစ်ခု ဖြစ်ပေါ်ခဲ့သည်။";
    }
}

function showTransferDetails() {
    if (!receiverData) return;
    document.getElementById("transfer-phone-section").classList.add("hidden");
    document.getElementById("transfer-details").classList.remove("hidden");
    document.getElementById("transfer-receiver").textContent = `${receiverData.phone} (ID: ${receiverData.user_id})`;
}

function showPinOverlay() {
    const amount = Number.parseInt(document.getElementById("transfer-amount").value);
    if (!amount || amount <= 0 || amount > 1000000) {
        document.getElementById("transfer-error").textContent = "မမှန်ကန်သော ပမာဏ။ အများဆုံး ၁,၀၀၀,၀၀၀ ကျပ်။";
        document.getElementById("transfer-error").classList.remove("hidden");
        return;
    }
    document.getElementById("transfer-details").classList.add("hidden");
    document.getElementById("pin-overlay").style.display = "flex";
    const pinBoxes = document.querySelectorAll(".pin-box");
    pinBoxes.forEach((box) => {
        box.value = "";
        box.classList.remove("filled");
    });
    pinBoxes[0].focus();
    document.getElementById("pin-error").classList.add("hidden");
}

function closePinOverlay() {
    document.getElementById("pin-overlay").style.display = "none";
    document.getElementById("transfer-details").classList.remove("hidden");
}

function handlePinInput(current, index) {
    const pinBoxes = document.querySelectorAll(".pin-box");
    if (current.value.length === 1) {
        current.classList.add("filled");
        if (index < 5) {
            pinBoxes[index + 1].focus();
        } else {
            pinBoxes[index].blur();
        }
    } else {
        current.classList.remove("filled");
    }
}

async function downloadReceipt() {
    try {
        const html2canvas = window.html2canvas;
        const ticketContent = document.getElementById("ticket-content");
        const canvas = await html2canvas(ticketContent, {
            scale: 4,
            useCORS: true,
            backgroundColor: "#FFFFFF",
            logging: false,
            imageTimeout: 15000
        });
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `Transaction_${currentTransactionId}.png`;
        link.click();
    } catch (error) {
        console.error("Download Receipt Error:", error.message);
        showNotification(`ပြေစာဒေါင်းလုဒ်လုပ်ရန် အမှားဖြစ်ပေါ်ခဲ့သည်: ${error.message}`, "error");
    }
}

async function printReceipt() {
    try {
        window.print();
    } catch (error) {
        console.error("Print Receipt Error:", error.message);
        showNotification(`ပြေစာပုံနှိပ်ရန် အမှားဖြစ်ပေါ်ခဲ့သည်: ${error.message}`, "error");
    }
}

async function submitTransfer() {
    try {
        if (!allowTransfers) {
            document.getElementById("pin-error").textContent = "ဆာဗာမှ ငွေလွှဲလုပ်ဆောင်မှုကို ပိတ်ထားသည်။";
            document.getElementById("pin-error").classList.remove("hidden");
            return;
        }

        const pin = Array.from(document.querySelectorAll(".pin-box")).map((box) => box.value).join("");
        const phone = receiverData.phone;
        const amount = Number.parseInt(document.getElementById("transfer-amount").value);
        const note = document.getElementById("transfer-note").value;

        if (pin.length !== 6) {
            document.getElementById("pin-error").textContent = "ပင်နံပါတ်သည် ၆ လုံးရှိရမည်။";
            document.getElementById("pin-error").classList.remove("hidden");
            return;
        }

        const animation = document.createElement("div");
        animation.className = "transfer-animation";
        animation.textContent = "ငွေလွှဲလုပ်ဆောင်နေသည်...";
        document.body.appendChild(animation);

        const isOnline = navigator.onLine;
        animation.style.animationDuration = isOnline ? "1s" : "3s";

        const transactionId = `TXN${Date.now().toString().slice(-10)}${Math.floor(Math.random() * 1000)}`;

        const { data: sender, error: senderError } = await supabase
            .from("users")
            .select("*")
            .eq("user_id", currentUser.user_id)
            .eq("payment_pin", pin)
            .single();
        if (senderError) throw new Error(`ပေးပို့သူထုတ်ယူမှု မအောင်မြင်ပါ: ${senderError.message}`);
        const { data: receiver, error: receiverError } = await supabase
            .from("users")
            .select("*")
            .eq("phone", phone)
            .single();
        if (receiverError) throw new Error(`လက်ခံသူထုတ်ယူမှု မအောင်မြင်ပါ: ${receiverError.message}`);

        if (!sender || !receiver || sender.balance < amount || receiver.passport_status !== "approved") {
            document.getElementById("pin-error").textContent = !sender
                ? "မမှန်ကန်သော ပင်နံပါတ်။"
                : !receiver
                    ? "လက်ခံသူအကောင့်မတွေ့ပါ။"
                    : sender.balance < amount
                        ? "လက်ကျန်ငွေ မလုံလောက်ပါ။"
                        : "လက်ခံသူ၏ နိုင်ငံကူးလက်မှတ်အတည်မပြုရသေးပါ။";
            document.getElementById("pin-error").classList.remove("hidden");
            animation.remove();
            return;
        }

        const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Yangon" });

        await retryOperation(async () => {
            const { error: updateSenderError } = await supabase
                .from("users")
                .update({ balance: sender.balance - amount })
                .eq("user_id", sender.user_id);
            if (updateSenderError) throw new Error(`ပေးပို့သူအပ်ဒိတ်မှု မအောင်မြင်ပါ: ${updateSenderError.message}`);
        });

        await retryOperation(async () => {
            const { error: updateReceiverError } = await supabase
                .from("users")
                .update({ balance: receiver.balance + amount })
                .eq("user_id", receiver.user_id);
            if (updateReceiverError) throw new Error(`လက်ခံသူအပ်ဒိတ်မှု မအောင်မြင်ပါ: ${updateReceiverError.message}`);
        });

        await retryOperation(async () => {
            const { error: insertError } = await supabase.from("transactions").insert({
                id: transactionId,
                from_phone: sender.phone,
                to_phone: receiver.phone,
                amount: amount,
                note: note || null,
                status: "completed",
                created_at: now
            });
            if (insertError) throw new Error(`လွှဲပြ HeavenlyPath
ောင်းမှုထည့်သွင်းမှု မအောင်မြင်ပါ: ${insertError.message}`);
        });

        currentUser.balance = sender.balance - amount;
        document.getElementById("balance").textContent = `${currentUser.balance} Ks`;
        document.getElementById("pin-overlay").style.display = "none";

        animation.remove();
        document.getElementById("transfer-sent-sound").play().catch((err) => console.error("Sent sound error:", err));

        const successAnimation = document.createElement("div");
        successAnimation.className = "success-animation";
        successAnimation.innerHTML = `
            <img src="${logoUrl}" alt="OPPER Logo">
            ငွေလွှဲမှု အောင်မြင်ပါသည်
        `;
        document.body.appendChild(successAnimation);

        setTimeout(async () => {
            successAnimation.remove();
            const ticketContent = document.getElementById("ticket-content");
            ticketContent.innerHTML = `
                <div class="header">
                    <img src="${logoUrl}" alt="OPPER Logo">
                    <h1>OPPER Payment</h1>
                </div>
                <div class="content">
                    <p><strong>လွှဲပြောင်းမှု ပြေစာ</strong></p>
                    <p><strong>လွှဲပြောင်းမှု ID:</strong> ${transactionId}</p>
                    <p><strong>ပမာဏ:</strong> ${amount} Ks</p>
                    <p><strong>မှ:</strong> ${sender.phone}</p>
                    <p><strong>သို့:</strong> ${receiver.phone}</p>
                    <p><strong>သို့ ID:</strong> ${receiver.user_id}</p>
                    <p><strong>မှတ်ချက်:</strong> ${note || "မရှိ"}</p>
                    <p><strong>အချိန်:</strong> ${now}</p>
                    <p><strong>အခြေအနေ:</strong> ပေးပို့ပြီး</p>
                    <div class="done-ui">
                        <img src="${logoUrl}" alt="Done Icon">
                        လွှဲပြောင်းမှု ပြီးစီးသည်
                    </div>
                    <div class="footer">
                        Powered by OPPER Payment
                    </div>
                </div>
            `;
            currentTransactionId = transactionId;
            document.getElementById("receipt-overlay").style.display = "flex";
        }, 2500);

        loadHistory();
    } catch (error) {
        console.error("Transfer Error:", error.message);
        document.getElementById("pin-error").textContent = `လွှဲပြောင်းမှုတွင် အမှားဖြစ်ပေါ်ခဲ့သည်: ${error.message}`;
        document.getElementById("pin-error").classList.remove("hidden");
        const animation = document.querySelector(".transfer-animation");
        if (animation) animation.remove();
    }
}

async function loadHistory() {
    try {
        if (!isAuthenticated) return;

        const month = document.getElementById("month-filter").value;
        const now = new Date();
        const year = now.getFullYear();
        const monthFilter = month === "current" ? now.getMonth() : now.getMonth() - 1;
        const startDate = new Date(year, monthFilter, 1).toISOString();
        const endDate = new Date(year, monthFilter + 1, 0).toISOString();

        const { data: transactions, error } = await supabase
            .from("transactions")
            .select("*")
            .or(`from_phone.eq.${currentUser.phone},to_phone.eq.${currentUser.phone}`)
            .gte("created_at", startDate)
            .lte("created_at", endDate)
            .order("created_at", { ascending: false });
        if (error) throw error;

        const historyList = document.getElementById("history-list");
        historyList.innerHTML = "";
        let totalIn = 0, totalOut = 0;

        if (!transactions || transactions.length === 0) {
            historyList.innerHTML = '<p class="no-transactions">ဤကာလအတွက် လွှဲပြောင်းမှုမတွေ့ပါ။</p>';
            document.getElementById("total-in").textContent = "0 Ks";
            document.getElementById("total-out").textContent = "0 Ks";
            return;
        }

        transactions.forEach((t) => {
            const item = document.createElement("div");
            item.className = `history-item ${t.from_phone === currentUser.phone ? "out" : "in"}`;
            item.innerHTML = `
                ${t.from_phone === currentUser.phone ? "-" : "+"}${t.amount} Ks<br>
                လွှဲပြောင်းမှု ID: ${t.id}<br>
                ဖုန်း: ${t.from_phone === currentUser.phone ? t.to_phone : t.from_phone}<br>
                မှတ်ချက်: ${t.note || "မရှိ"}<br>
                အချိန်: ${t.created_at}<br>
                အခြေအနေ: ${t.from_phone === currentUser.phone ? "ပေးပို့ပြီး" : "လက်ခံရရှိသည်"}
                <button class="print-btn" onclick="showReceipt('${t.id}')"></button>
            `;
            historyList.appendChild(item);
            if (t.from_phone === currentUser.phone) totalOut += t.amount;
            else totalIn += t.amount;
        });

        document.getElementById("total-in").textContent = `${totalIn} Ks`;
        document.getElementById("total-out").textContent = `${totalOut} Ks`;
    } catch (error) {
        console.error("Load History Error:", error.message);
        showNotification(`လွှဲပြောင်းမှုမှတ်တမ်းထုတ်ယူရန် အမှားဖြစ်ပေါ်ခဲ့သည်: ${error.message}`, "error");
    }
}

async function showReceipt(transactionId) {
    try {
        const { data: transaction, error } = await supabase
            .from("transactions")
            .select("*")
            .eq("id", transactionId)
            .single();
        if (error) throw error;

        currentTransactionId = transactionId;
        const toUserId = transaction.to_phone === currentUser.phone
            ? currentUser.user_id
            : (await supabase.from("users").select("user_id").eq("phone", transaction.to_phone).single()).data.user_id;

        const ticketContent = document.getElementById("ticket-content");
        ticketContent.innerHTML = `
            <div class="header">
                <img src="${logoUrl}" alt="OPPER Logo">
                <h1>OPPER Payment</h1>
            </div>
            <div class="content">
                <p><strong>လွှဲပြောင်းမှု ပြေစာ</strong></p>
                <p><strong>လွှဲပြောင်းမှု ID:</strong> ${transaction.id}</p>
                <p><strong>ပမာဏ:</strong> ${transaction.amount} Ks</p>
                <p><strong>မှ:</strong> ${transaction.from_phone}</p>
                <p><strong>သို့:</strong> ${transaction.to_phone}</p>
                <p><strong>သို့ ID:</strong> ${toUserId}</p>
                <p><strong>မှတ်ချက်:</strong> ${transaction.note || "မရှိ"}</p>
                <p><strong>အချိန်:</strong> ${transaction.created_at}</p>
                <p><strong>အခြေအနေ:</strong> ${transaction.from_phone === currentUser.phone ? "ပေးပို့ပြီး" : "လက်ခံရရှိသည်"}</p>
                <div class="done-ui">
                    <img src="${logoUrl}" alt="Done Icon">
                    လွှဲပြောင်းမှု ပြီးစီးသည်
                </div>
                <div class="footer">
                    Powered by OPPER Payment
                </div>
            </div>
        `;
        document.getElementById("receipt-overlay").style.display = "flex";
    } catch (error) {
        console.error("Show Receipt Error:", error.message);
        showNotification(`ပြေစာပြရန် အမှားဖြစ်ပေါ်ခဲ့သည်: ${error.message}`, "error");
    }
}

function closeReceipt() {
    document.getElementById("receipt-overlay").style.display = "none";
    showSection("wallet");
}

function updateStatus(status) {
    const walletStatus = document.getElementById("wallet-status");
    const miStatus = document.getElementById("mi-status");
    walletStatus.className = `status ${status}`;
    miStatus.className = `status ${status}`;
    walletStatus.textContent = status === "pending"
        ? "နိုင်ငံကူးလက်မှတ်အတည်ပြုရန် လိုအပ်သည်"
        : status === "approved"
            ? "အတည်ပြုပြီး"
            : "နိုင်ငံကူးလက်မှတ်ပယ်ဖျက်ခံရသည်";
    miStatus.textContent = walletStatus.textContent;

    const passportForm = document.getElementById("passport-form");
    const passportSubmitted = document.getElementById("passport-submitted");

    if (status === "approved") {
        document.getElementById("transfer-btn").disabled = false;
        passportForm.classList.add("hidden");
        passportSubmitted.classList.remove("hidden");
        document.getElementById("submitted-phone").textContent = currentUser.phone || "မရှိ";
        document.getElementById("submitted-passport").textContent = currentUser.passport_number || "မရှိ";
        document.getElementById("submitted-address").textContent = currentUser.address || "မရှိ";
        document.getElementById("submitted-time").textContent = currentUser.submitted_at
            ? new Date(currentUser.submitted_at).toLocaleString()
            : "မရှိ";
    } else if (status === "pending" && currentUser.submitted_at) {
        passportForm.classList.add("hidden");
        passportSubmitted.classList.remove("hidden");
        document.getElementById("submitted-phone").textContent = currentUser.phone || "မရှိ";
        document.getElementById("submitted-passport").textContent = currentUser.passport_number || "မရှိ";
        document.getElementById("submitted-address").textContent = currentUser.address || "မရှိ";
        document.getElementById("submitted-time").textContent = currentUser.submitted_at
            ? new Date(currentUser.submitted_at).toLocaleString()
            : "မရှိ";
    } else {
        passportForm.classList.remove("hidden");
        passportSubmitted.classList.add("hidden");
    }
}

async function uploadToImgur(file) {
    try {
        const formData = new FormData();
        formData.append("image", file);
        const response = await fetch("https://api.imgur.com/3/image", {
            method: "POST",
            headers: { Authorization: `Client-ID 5befa9dd970c7d0` },
            body: formData,
            timeout: 10000
        });
        const data = await response.json();
        if (!data.success) throw new Error("Imgur Upload Failed");
        return data.data.link;
    } catch (error) {
        console.error("Imgur Upload Error:", error.message);
        throw error;
    }
}

document.getElementById("submit-passport-btn").addEventListener("click", async () => {
    try {
        if (!isAuthenticated) {
            showNotification("နိုင်ငံကူးလက်မှတ်အချက်အလက်တင်သွင်းရန် အကောင့်ဝင်ပါ။", "error");
            showSection("auth");
            return;
        }

        const passportNumber = document.getElementById("passport-number").value;
        const address = document.getElementById("address").value;
        const phone = document.getElementById("phone").value;
        const paymentPin = document.getElementById("payment-pin").value;
        const passportImage = document.getElementById("passport-image").files[0];
        const selfieImage = document.getElementById("selfie-image").files[0];

        if (
            !passportNumber ||
            !address ||
            !phone.match(/^09\d{9}$/) ||
            paymentPin.length !== 6 ||
            !passportImage ||
            !selfieImage
        ) {
            showNotification("ကျေးဇူးပြု၍ အကွက်အားလုံးကို မှန်ကန်စွာဖြည့်ပါ။ ပင်နံပါတ်သည် ၆ လုံးရှိရမည်။", "error");
            return;
        }

        const submitBtn = document.getElementById("submit-passport-btn");
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = "တင်ပို့နေသည်...";

        const { data: existingUser, error: checkError } = await supabase
            .from("users")
            .select("phone, passport_status")
            .eq("phone", phone)
            .neq("user_id", currentUser.user_id)
            .single();

        if (existingUser) {
            showNotification("ဤဖုန်းနံပါတ်သည် အခြားအကောင့်တစ်ခုနှင့် မှတ်ပုံတင်ပြီးဖြစ်သည်။", "error");
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
        }

        const passportImageUrl = await uploadToImgur(passportImage);
        const selfieImageUrl = await uploadToImgur(selfieImage);

        submitBtn.textContent = "တင်သွင်းနေသည်...";

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
                    submitted_at: new Date().toISOString()
                })
                .eq("user_id", currentUser.user_id);
            if (updateError) throw new Error(`အသုံးပြုသူအပ်ဒိတ်မှု မအောင်မြင်ပါ: ${updateError.message}`);
        });

        currentUser = {
            ...currentUser,
            passport_number: passportNumber,
            address: address,
            phone: phone,
            passport_status: "pending",
            submitted_at: new Date().toISOString()
        };

        updateStatus("pending");
        showNotification("နိုင်ငံကူးလက်မှတ်အချက်အလက်များ တင်သွင်းပြီးပါပြီ!", "success");
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    } catch (error) {
        console.error("Submit Passport Error:", error.message);
        showNotification(`နိုင်ငံကူးလက်မှတ်အချက်အလက်တင်သွင်းရန် အမှားဖြစ်ပေါ်ခဲ့သည်: ${error.message}`, "error");
        const submitBtn = document.getElementById("submit-passport-btn");
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit";
    }
});

function downloadApk() {
    window.open("https://appsgeyser.io/18731061/OPPER-Payment", "_blank");
}

function hideDownloadBar() {
    document.getElementById("download-bar").style.display = "none";
}
