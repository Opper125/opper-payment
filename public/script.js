const supabaseUrl = 'https://vtsczzlnhsrgnbkfyizi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, { fetch: (...args) => fetch(...args) });
const imgurClientId = '5befa9dd970c7d0';
const logoUrl = 'https://github.com/Opper125/opper-payment/raw/main/logo.png';

let currentUser = { user_id: null, balance: 0, passport_status: 'pending', phone: null };
let allowTransfers = true;
let currentTransactionId = null;
let receiverData = null;

// Play Intro Sound
window.onload = () => {
    const introSound = document.getElementById('intro-sound');
    introSound.play().catch(err => console.error('Intro sound error:', err));
    setTimeout(() => {
        document.getElementById('intro-container').style.display = 'none';
        initializeUser();
    }, 8000);
};

function showSection(sectionId) {
    ['wallet', 'host', 'mi', 'game'].forEach(id => {
        document.getElementById(id).classList.toggle('active', id === sectionId);
        document.getElementById(`${id}-btn`).classList.toggle('active', id === sectionId);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openTelegram() {
    window.open('https://t.me/OPPERN', '_blank');
}

async function retryOperation(operation, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            console.warn(`Retry ${i + 1}/${maxRetries} failed: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

async function checkTransferSettings() {
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('allow_transfers')
            .single();
        if (error) throw new Error(`Fetch Settings Error: ${error.message}`);
        allowTransfers = data.allow_transfers;
    } catch (error) {
        console.error('Check Transfer Settings Error:', error.message);
        allowTransfers = false;
    }
}

async function initializeUser() {
    try {
        let userId = localStorage.getItem('userId');
        if (!userId) {
            userId = Math.floor(100000 + Math.random() * 900000).toString();
            await retryOperation(async () => {
                const { data: existingUser, error } = await supabase
                    .from('users')
                    .select('user_id')
                    .eq('user_id', userId)
                    .single();
                if (error && error.code !== 'PGRST116') throw new Error(`Check ID Error: ${error.message}`);
                if (existingUser) throw new Error('Duplicate ID');
            });

            await retryOperation(async () => {
                const { error: insertError } = await supabase
                    .from('users')
                    .insert({ user_id: userId, balance: 0, passport_status: 'pending' });
                if (insertError) throw new Error(`Insert User Error: ${insertError.message}`);
            });

            localStorage.setItem('userId', userId);
        }
        currentUser.user_id = userId;

        document.getElementById('id-badge').textContent = `ID: ${userId}`;
        document.getElementById('mi-id').textContent = userId;

        await retryOperation(async () => {
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('user_id', userId)
                .single();
            if (error && error.code !== 'PGRST116') throw new Error(`Fetch User Error: ${error.message}`);
            if (user) currentUser = user;
        });

        document.getElementById('balance').textContent = `${currentUser.balance} Ks`;
        updateStatus(currentUser.passport_status);

        await checkTransferSettings();

        supabase.channel('users-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `user_id=eq.${userId}` }, payload => {
                currentUser = { ...currentUser, ...payload.new };
                document.getElementById('balance').textContent = `${currentUser.balance} Ks`;
                updateStatus(currentUser.passport_status);
            })
            .subscribe();

        supabase.channel('transactions-channel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, async payload => {
                const transaction = payload.new;
                if (transaction.to_phone === currentUser.phone) {
                    const message = document.createElement('div');
                    message.className = 'receiver-message';
                    message.innerHTML = `Received ${transaction.amount} Ks<br>From: ${transaction.from_phone}`;
                    document.body.appendChild(message);
                    document.getElementById('transfer-received-sound').play().catch(err => console.error('Received sound error:', err));
                    setTimeout(() => message.remove(), 4000);
                }
                loadHistory();
            })
            .subscribe();

        supabase.channel('settings-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, payload => {
                allowTransfers = payload.new.allow_transfers;
            })
            .subscribe();

        loadHistory();
    } catch (error) {
        console.error('Initialization Error:', error.message);
        alert(`An error occurred: ${error.message}. Please try again.`);
    }
}

function showPhoneInput() {
    if (currentUser.passport_status !== 'approved') {
        alert('Passport must be approved to transfer money.');
        return;
    }
    if (!allowTransfers) {
        alert('Transfer functionality is currently disabled by the server.');
        return;
    }
    document.getElementById('transfer-phone-section').classList.remove('hidden');
    document.getElementById('transfer-details').classList.add('hidden');
    document.getElementById('pin-overlay').style.display = 'none';
}

async function checkPhone() {
    try {
        const phone = document.getElementById('transfer-phone').value;
        const receiverName = document.getElementById('receiver-name');
        const nextBtn = document.getElementById('next-btn');
        receiverName.textContent = '';
        nextBtn.disabled = true;
        if (phone.match(/^09\d{9}$/)) {
            if (phone === currentUser.phone) {
                receiverName.className = 'account-status not-found';
                receiverName.textContent = 'You cannot transfer money to your own phone number.';
                return;
            }

            const { data: receiver, error } = await supabase
                .from('users')
                .select('user_id, phone, passport_status')
                .eq('phone', phone)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            if (receiver && receiver.passport_status === 'approved') {
                receiverName.className = 'account-status found';
                receiverName.textContent = `Account Found: ${receiver.phone} (ID: ${receiver.user_id})`;
                nextBtn.disabled = false;
                receiverData = receiver;
            } else {
                receiverName.className = 'account-status not-found';
                receiverName.textContent = 'Account not found or passport not approved.';
            }
        }
    } catch (error) {
        console.error('Check Phone Error:', error.message);
        document.getElementById('receiver-name').textContent = 'An error occurred.';
    }
}

function showTransferDetails() {
    if (!receiverData) return;
    document.getElementById('transfer-phone-section').classList.add('hidden');
    document.getElementById('transfer-details').classList.remove('hidden');
    document.getElementById('transfer-receiver').textContent = `${receiverData.phone} (ID: ${receiverData.user_id})`;
}

function showPinOverlay() {
    const amount = parseInt(document.getElementById('transfer-amount').value);
    if (!amount || amount <= 0 || amount > 1000000) {
        document.getElementById('transfer-error').textContent = 'Invalid amount. Max 1,000,000 Ks.';
        document.getElementById('transfer-error').classList.remove('hidden');
        return;
    }
    document.getElementById('transfer-details').classList.add('hidden');
    document.getElementById('pin-overlay').style.display = 'flex';
    const pinBoxes = document.querySelectorAll('.pin-box');
    pinBoxes.forEach(box => {
        box.value = '';
        box.classList.remove('filled');
    });
    pinBoxes[0].focus();
    document.getElementById('pin-error').classList.add('hidden');
}

function closePinOverlay() {
    document.getElementById('pin-overlay').style.display = 'none';
    document.getElementById('transfer-details').classList.remove('hidden');
}

function handlePinInput(current, index) {
    const pinBoxes = document.querySelectorAll('.pin-box');
    if (current.value.length === 1) {
        current.classList.add('filled');
        if (index < 5) {
            pinBoxes[index + 1].focus();
        } else {
            pinBoxes[index].blur();
        }
    } else {
        current.classList.remove('filled');
    }
}

async function downloadReceipt() {
    try {
        const ticketContent = document.getElementById('ticket-content');
        const canvas = await html2canvas(ticketContent, {
            scale: 4,
            useCORS: true,
            backgroundColor: '#FFFFFF',
            logging: false,
            imageTimeout: 15000
        });
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `Transaction_${currentTransactionId}.png`;
        link.click();
    } catch (error) {
        console.error('Download Receipt Error:', error.message);
        alert(`Error downloading receipt: ${error.message}`);
    }
}

async function printReceipt() {
    try {
        window.print();
    } catch (error) {
        console.error('Print Receipt Error:', error.message);
        alert(`Error printing receipt: ${error.message}`);
    }
}

async function submitTransfer() {
    try {
        if (!allowTransfers) {
            document.getElementById('pin-error').textContent = 'Transfer functionality is currently disabled by the server.';
            document.getElementById('pin-error').classList.remove('hidden');
            return;
        }

        const pin = Array.from(document.querySelectorAll('.pin-box')).map(box => box.value).join('');
        const phone = receiverData.phone;
        const amount = parseInt(document.getElementById('transfer-amount').value);
        const note = document.getElementById('transfer-note').value;

        if (pin.length !== 6) {
            document.getElementById('pin-error').textContent = 'PIN must be 6 digits.';
            document.getElementById('pin-error').classList.remove('hidden');
            return;
        }

        console.log(`Entered PIN: ${pin}`);

        const animation = document.createElement('div');
        animation.className = 'transfer-animation';
        animation.textContent = 'Processing Transfer...';
        document.body.appendChild(animation);

        const isOnline = navigator.onLine;
        animation.style.animationDuration = isOnline ? '1s' : '3s';

        const { data: sender, error: senderError } = await supabase
            .from('users')
            .select('*')
            .eq('user_id', currentUser.user_id)
            .eq('payment_pin', pin)
            .single();
        if (senderError) throw new Error(`Sender Fetch Error: ${senderError.message}`);
        const { data: receiver, error: receiverError } = await supabase
            .from('users')
            .select('*')
            .eq('phone', phone)
            .single();
        if (receiverError) throw new Error(`Receiver Fetch Error: ${receiverError.message}`);

        if (!sender || !receiver || sender.balance < amount || receiver.passport_status !== 'approved') {
            document.getElementById('pin-error').textContent = !sender ? 'Incorrect PIN.' : !receiver ? 'Recipient account not found.' : sender.balance < amount ? 'Insufficient balance.' : 'Recipient passport not approved.';
            document.getElementById('pin-error').classList.remove('hidden');
            animation.remove();
            return;
        }

        const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Yangon' });

        await retryOperation(async () => {
            const { error: updateSenderError } = await supabase
                .from('users')
                .update({ balance: sender.balance - amount })
                .eq('user_id', sender.user_id);
            if (updateSenderError) throw new Error(`Update Sender Error: ${updateSenderError.message}`);
        });

        await retryOperation(async () => {
            const { error: updateReceiverError } = await supabase
                .from('users')
                .update({ balance: receiver.balance + amount })
                .eq('user_id', receiver.user_id);
            if (updateReceiverError) throw new Error(`Update Receiver Error: ${updateReceiverError.message}`);
        });

        let transactionId;
        await retryOperation(async () => {
            const { data, error: insertError } = await supabase
                .from('transactions')
                .insert({
                    from_phone: sender.phone,
                    to_phone: receiver.phone,
                    amount: amount,
                    note: note || null,
                    timestamp: now
                })
                .select('id')
                .single();
            if (insertError) throw new Error(`Insert Transaction Error: ${insertError.message}`);
            transactionId = data.id;
        });

        currentUser.balance = sender.balance - amount;
        document.getElementById('balance').textContent = `${currentUser.balance} Ks`;
        document.getElementById('pin-overlay').style.display = 'none';

        animation.remove();

        document.getElementById('transfer-sent-sound').play().catch(err => console.error('Sent sound error:', err));

        const successAnimation = document.createElement('div');
        successAnimation.className = 'success-animation';
        successAnimation.innerHTML = `
            <img src="${logoUrl}" alt="OPPER Logo">
            Transfer Successful
        `;
        document.body.appendChild(successAnimation);

        console.log(`Transfer Successful: ${amount} Ks to ${receiver.phone}`);

        setTimeout(async () => {
            successAnimation.remove();

            const ticketContent = document.getElementById('ticket-content');
            ticketContent.innerHTML = `
                <div class="header">
                    <img src="${logoUrl}" alt="OPPER Logo">
                    <h1>OPPER Payment</h1>
                </div>
                <div class="content">
                    <p><strong>Transaction Receipt</strong></p>
                    <p><strong>Amount:</strong> ${amount} Ks</p>
                    <p><strong>From:</strong> ${sender.phone}</p>
                    <p><strong>To:</strong> ${receiver.phone}</p>
                    <p><strong>To ID:</strong> ${receiver.user_id}</p>
                    <p><strong>Note:</strong> ${note || 'None'}</p>
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
            `;
            currentTransactionId = transactionId;
            document.getElementById('receipt-overlay').style.display = 'flex';
        }, 2500);

        loadHistory();
    } catch (error) {
        console.error('Transfer Error:', error.message);
        document.getElementById('pin-error').textContent = `An error occurred during transfer: ${error.message}`;
        document.getElementById('pin-error').classList.remove('hidden');
        const animation = document.querySelector('.transfer-animation');
        if (animation) animation.remove();
    }
}

async function loadHistory() {
    try {
        const month = document.getElementById('month-filter').value;
        const now = new Date();
        const year = now.getFullYear();
        const monthFilter = month === 'current' ? now.getMonth() : now.getMonth() - 1;
        const startDate = new Date(year, monthFilter, 1).toISOString();
        const endDate = new Date(year, monthFilter + 1, 0).toISOString();

        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .or(`from_phone.eq.${currentUser.phone},to_phone.eq.${currentUser.phone}`)
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('created_at', { ascending: false });
        if (error) throw error;

        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '';
        let totalIn = 0, totalOut = 0;

        (transactions || []).forEach(t => {
            const item = document.createElement('div');
            item.className = `history-item ${t.from_phone === currentUser.phone ? 'out' : 'in'}`;
            item.innerHTML = `
                ${t.from_phone === currentUser.phone ? '-' : '+'}${t.amount} Ks<br>
                Phone: ${t.from_phone === currentUser.phone ? t.to_phone : t.from_phone}<br>
                Note: ${t.note || 'None'}<br>
                Time: ${t.timestamp}<br>
                Status: ${t.from_phone === currentUser.phone ? 'Sent' : 'Received'}
                <button class="print-btn" onclick="showReceipt('${t.id}')"></button>
            `;
            historyList.appendChild(item);
            if (t.from_phone === currentUser.phone) totalOut += t.amount;
            else totalIn += t.amount;
        });

        document.getElementById('total-in').textContent = `${totalIn} Ks`;
        document.getElementById('total-out').textContent = `${totalOut} Ks`;
    } catch (error) {
        console.error('Load History Error:', error.message);
        alert(`Error loading transaction history: ${error.message}`);
    }
}

async function showReceipt(transactionId) {
    try {
        const { data: transaction, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', transactionId)
            .single();
        if (error) throw error;

        currentTransactionId = transactionId;
        const toUserId = transaction.to_phone === currentUser.phone 
            ? currentUser.user_id 
            : (await supabase.from('users').select('user_id').eq('phone', transaction.to_phone).single()).data.user_id;

        const ticketContent = document.getElementById('ticket-content');
        ticketContent.innerHTML = `
            <div class="header">
                <img src="${logoUrl}" alt="OPPER Logo">
                <h1>OPPER Payment</h1>
            </div>
            <div class="content">
                <p><strong>Transaction Receipt</strong></p>
                <p><strong>Amount:</strong> ${transaction.amount} Ks</p>
                <p><strong>From:</strong> ${transaction.from_phone}</p>
                <p><strong>To:</strong> ${transaction.to_phone}</p>
                <p><strong>To ID:</strong> ${toUserId}</p>
                <p><strong>Note:</strong> ${transaction.note || 'None'}</p>
                <p><strong>Time:</strong> ${transaction.timestamp}</p>
                <p><strong>Status:</strong> ${transaction.from_phone === currentUser.phone ? 'Sent' : 'Received'}</p>
                <div class="done-ui">
                    <img src="${logoUrl}" alt="Done Icon">
                    Transaction Completed
                </div>
                <div class="footer">
                    Powered by OPPER Payment
                </div>
            </div>
        `;
        
        document.getElementById('receipt-overlay').style.display = 'flex';
    } catch (error) {
        console.error('Show Receipt Error:', error.message);
        alert(`Error showing receipt: ${error.message}`);
    }
}

function closeReceipt() {
    document.getElementById('receipt-overlay').style.display = 'none';
    showSection('wallet');
}

function updateStatus(status) {
    const walletStatus = document.getElementById('wallet-status');
    const miStatus = document.getElementById('mi-status');
    walletStatus.className = `status ${status}`;
    miStatus.className = `status ${status}`;
    walletStatus.textContent = status === 'pending' ? 'Passport Verification Required' : status === 'approved' ? 'Approved' : 'Passport Rejected';
    miStatus.textContent = walletStatus.textContent;

    const passportForm = document.getElementById('passport-form');
    const passportSubmitted = document.getElementById('passport-submitted');

    if (status === 'approved') {
        document.getElementById('transfer-btn').disabled = false;
        passportForm.classList.add('hidden');
        passportSubmitted.classList.remove('hidden');
        document.getElementById('submitted-phone').textContent = currentUser.phone || 'N/A';
        document.getElementById('submitted-passport').textContent = currentUser.passport_number || 'N/A';
        document.getElementById('submitted-address').textContent = currentUser.address || 'N/A';
        document.getElementById('submitted-time').textContent = currentUser.submitted_at ? new Date(currentUser.submitted_at).toLocaleString() : 'N/A';
    } else if (status === 'pending' && currentUser.submitted_at) {
        passportForm.classList.add('hidden');
        passportSubmitted.classList.remove('hidden');
        document.getElementById('submitted-phone').textContent = currentUser.phone || 'N/A';
        document.getElementById('submitted-passport').textContent = currentUser.passport_number || 'N/A';
        document.getElementById('submitted-address').textContent = currentUser.address || 'N/A';
        document.getElementById('submitted-time').textContent = currentUser.submitted_at ? new Date(currentUser.submitted_at).toLocaleString() : 'N/A';
    } else {
        passportForm.classList.remove('hidden');
        passportSubmitted.classList.add('hidden');
    }
}

async function uploadToImgur(file) {
    try {
        const formData = new FormData();
        formData.append('image', file);
        const response = await fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: { Authorization: `Client-ID ${imgurClientId}` },
            body: formData,
            timeout: 10000
        });
        const data = await response.json();
        if (!data.success) throw new Error('Imgur Upload Failed');
        return data.data.link;
    } catch (error) {
        console.error('Imgur Upload Error:', error.message);
        throw error;
    }
}

document.getElementById('submit-passport-btn').addEventListener('click', async () => {
    try {
        const passportNumber = document.getElementById('passport-number').value;
        const address = document.getElementById('address').value;
        const phone = document.getElementById('phone').value;
        const paymentPin = document.getElementById('payment-pin').value;
        const passportImage = document.getElementById('passport-image').files[0];
        const selfieImage = document.getElementById('selfie-image').files[0];

        if (!passportNumber || !address || !phone.match(/^09\d{9}$/) || paymentPin.length !== 6 || !passportImage || !selfieImage) {
            alert('Please fill all fields correctly. PIN must be 6 digits.');
            return;
        }

        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('phone, passport_status')
            .eq('phone', phone)
            .single();
        if (checkError && checkError.code !== 'PGRST116') throw new Error(`Check Phone Error: ${checkError.message}`);
        if (existingUser && existingUser.passport_status === 'approved') {
            alert('This phone number is already registered and approved.');
            return;
        }

        const passportImageUrl = await uploadToImgur(passportImage);
        const selfieImageUrl = await uploadToImgur(selfieImage);

        await retryOperation(async () => {
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    passport_number: passportNumber,
                    address: address,
                    phone: phone,
                    payment_pin: paymentPin,
                    passport_image: passportImageUrl,
                    selfie_image: selfieImageUrl,
                    passport_status: 'pending',
                    submitted_at: new Date().toISOString()
                })
                .eq('user_id', currentUser.user_id);
            if (updateError) throw new Error(`Update User Error: ${updateError.message}`);
        });

        currentUser = {
            ...currentUser,
            passport_number: passportNumber,
            address: address,
            phone: phone,
            passport_status: 'pending',
            submitted_at: new Date().toISOString()
        };

        updateStatus('pending');
        alert('Passport details submitted successfully!');
    } catch (error) {
        console.error('Submit Passport Error:', error.message);
        alert(`Error submitting passport details: ${error.message}`);
    }
});

function downloadApk() {
    window.open('https://appsgeyser.io/18731061/OPPER-Payment', '_blank');
}

function hideDownloadBar() {
    document.getElementById('download-bar').style.display = 'none';
}
