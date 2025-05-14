// Supabase Configuration
const supabaseUrl = 'https://vtsczzlnhsrgnbkfyizi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, { fetch: (...args) => fetch(...args) });

// Global variables
let pendingTransactions = [];
let currentTransactionId = null;
let transfersEnabled = true;

// DOM Elements
const loader = document.getElementById('loader');
const processingOverlay = document.getElementById('processing-overlay');
const transactionModal = document.getElementById('transaction-modal');
const confirmModal = document.getElementById('confirm-modal');
const tabButtons = document.querySelectorAll('.tab');
const tabPanes = document.querySelectorAll('.tab-pane');

// Stats Elements
const totalUsersEl = document.getElementById('total-users');
const approvedTransactionsEl = document.getElementById('approved-transactions');
const pendingTransactionsEl = document.getElementById('pending-transactions');
const rejectedTransactionsEl = document.getElementById('rejected-transactions');

// Transaction Lists
const allTransactionsList = document.getElementById('all-transactions');
const depositTransactionsList = document.getElementById('deposit-transactions');
const withdrawTransactionsList = document.getElementById('withdraw-transactions');

// Control Buttons
const enableTransfersBtn = document.getElementById('enable-transfers');
const disableTransfersBtn = document.getElementById('disable-transfers');
const transferStatusText = document.getElementById('transfer-status-text');
const transferIndicator = document.getElementById('transfer-indicator');

// Modal Buttons
const approveTransactionBtn = document.getElementById('approve-transaction');
const rejectTransactionBtn = document.getElementById('reject-transaction');
const cancelConfirmBtn = document.getElementById('cancel-confirm');
const okConfirmBtn = document.getElementById('ok-confirm');

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    // Show loader
    showLoader();
    
    // Initialize tabs
    initTabs();
    
    // Load data
    await loadStats();
    await loadPendingTransactions();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up realtime subscriptions
    setupRealtimeSubscriptions();
    
    // Hide loader
    hideLoader();
});

// Initialize tabs
function initTabs() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Hide all tab panes
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Show the corresponding tab pane
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// Load stats
async function loadStats() {
    try {
        // Get total users
        const { count: userCount, error: userError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });
        
        if (!userError) {
            totalUsersEl.textContent = userCount || 0;
        }
        
        // Get transaction stats
        const { data: transactions, error: txError } = await supabase
            .from('transactions')
            .select('status');
        
        if (!txError && transactions) {
            const approved = transactions.filter(tx => tx.status === 'approved').length;
            const pending = transactions.filter(tx => tx.status === 'pending').length;
            const rejected = transactions.filter(tx => tx.status === 'rejected').length;
            
            approvedTransactionsEl.textContent = approved;
            pendingTransactionsEl.textContent = pending;
            rejectedTransactionsEl.textContent = rejected;
        }
        
        // Get settings
        const { data: settings, error: settingsError } = await supabase
            .from('settings')
            .select('allow_transfers')
            .eq('id', 1)
            .single();
        
        if (!settingsError && settings) {
            transfersEnabled = settings.allow_transfers;
            updateTransferStatus();
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load pending transactions
async function loadPendingTransactions() {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*, users(username, email)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        pendingTransactions = data || [];
        
        // Update UI
        updateTransactionLists();
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

// Update transaction lists
function updateTransactionLists() {
    // Filter transactions
    const deposits = pendingTransactions.filter(tx => tx.type === 'deposit');
    const withdrawals = pendingTransactions.filter(tx => tx.type === 'withdraw');
    
    // Update counters
    pendingTransactionsEl.textContent = pendingTransactions.length;
    
    // Clear lists
    allTransactionsList.innerHTML = '';
    depositTransactionsList.innerHTML = '';
    withdrawTransactionsList.innerHTML = '';
    
    // Show or hide empty messages
    if (pendingTransactions.length === 0) {
        allTransactionsList.innerHTML = '<div class="empty-message">စောင့်ဆိုင်းဆဲ ငွေလွှဲမှုများ မရှိပါ</div>';
    } else {
        pendingTransactions.forEach(transaction => {
            const transactionCard = createTransactionCard(transaction);
            allTransactionsList.appendChild(transactionCard);
        });
    }
    
    if (deposits.length === 0) {
        depositTransactionsList.innerHTML = '<div class="empty-message">စောင့်ဆိုင်းဆဲ ငွေသွင်းမှုများ မရှိပါ</div>';
    } else {
        deposits.forEach(transaction => {
            const transactionCard = createTransactionCard(transaction);
            depositTransactionsList.appendChild(transactionCard);
        });
    }
    
    if (withdrawals.length === 0) {
        withdrawTransactionsList.innerHTML = '<div class="empty-message">စောင့်ဆိုင်းဆဲ ငွေထုတ်မှုများ မရှိပါ</div>';
    } else {
        withdrawals.forEach(transaction => {
            const transactionCard = createTransactionCard(transaction);
            withdrawTransactionsList.appendChild(transactionCard);
        });
    }
}

// Create transaction card
function createTransactionCard(transaction) {
    const isDeposit = transaction.type === 'deposit';
    const amount = parseFloat(transaction.amount);
    const formattedAmount = new Intl.NumberFormat('en-US').format(amount);
    const createdDate = new Date(transaction.created_at).toLocaleString();
    
    const card = document.createElement('div');
    card.className = 'transaction-card';
    card.setAttribute('data-id', transaction.id);
    
    card.innerHTML = `
        <div class="transaction-header">
            <div class="transaction-type ${isDeposit ? 'deposit' : 'withdraw'}">
                <i class="fas ${isDeposit ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                <span>${isDeposit ? 'ငွေသွင်း' : 'ငွေထုတ်'}</span>
            </div>
            <div class="transaction-amount">${formattedAmount} Ks</div>
        </div>
        <div class="transaction-body">
            <div class="transaction-detail">
                <span class="detail-label">အိုင်ဒီ:</span>
                <span class="detail-value">#${transaction.id}</span>
            </div>
            <div class="transaction-detail">
                <span class="detail-label">ငွေလွှဲနည်း:</span>
                <span class="detail-value">${transaction.payment_method === 'kpay' ? 'KPay' : 'Wave'}</span>
            </div>
            <div class="transaction-detail">
                <span class="detail-label">သုံးစွဲသူ:</span>
                <span class="detail-value">${transaction.users?.username || 'Unknown'}</span>
            </div>
            <div class="transaction-detail">
                <span class="detail-label">ရက်စွဲ:</span>
                <span class="detail-value">${createdDate}</span>
            </div>
            ${isDeposit && transaction.receipt_image ? `
                <div class="transaction-detail">
                    <span class="detail-label">ဖြတ်ပိုင်း:</span>
                    <a href="${transaction.receipt_image}" target="_blank" class="receipt-link">
                        <i class="fas fa-image"></i> ကြည့်ရန်
                    </a>
                </div>
            ` : ''}
            ${!isDeposit ? `
                <div class="transaction-detail">
                    <span class="detail-label">ဖုန်းနံပါတ်:</span>
                    <span class="detail-value">${transaction.recipient_phone || 'N/A'}</span>
                </div>
                <div class="transaction-detail">
                    <span class="detail-label">အမည်:</span>
                    <span class="detail-value">${transaction.recipient_name || 'N/A'}</span>
                </div>
            ` : ''}
        </div>
        <div class="transaction-actions">
            <button class="btn btn-sm btn-danger reject-btn">
                <i class="fas fa-times"></i> ငြင်းပယ်မည်
            </button>
            <button class="btn btn-sm btn-success approve-btn">
                <i class="fas fa-check"></i> အတည်ပြုမည်
            </button>
            <button class="btn btn-sm btn-primary details-btn">
                <i class="fas fa-eye"></i> အသေးစိတ်
            </button>
        </div>
    `;
    
    // Add event listeners
    const detailsBtn = card.querySelector('.details-btn');
    const approveBtn = card.querySelector('.approve-btn');
    const rejectBtn = card.querySelector('.reject-btn');
    
    detailsBtn.addEventListener('click', () => showTransactionDetails(transaction));
    approveBtn.addEventListener('click', () => confirmAction('approve', transaction.id));
    rejectBtn.addEventListener('click', () => confirmAction('reject', transaction.id));
    
    return card;
}

// Show transaction details
function showTransactionDetails(transaction) {
    const isDeposit = transaction.type === 'deposit';
    const amount = parseFloat(transaction.amount);
    const formattedAmount = new Intl.NumberFormat('en-US').format(amount);
    const createdDate = new Date(transaction.created_at).toLocaleString();
    
    // Set current transaction ID
    currentTransactionId = transaction.id;
    
    // Populate modal content
    const detailsContainer = document.getElementById('transaction-details');
    
    detailsContainer.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <h3 class="detail-title">အမျိုးအစား</h3>
                <p class="detail-value ${isDeposit ? 'text-success' : 'text-danger'}">
                    <i class="fas ${isDeposit ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                    ${isDeposit ? 'ငွေသွင်း' : 'ငွေထုတ်'}
                </p>
            </div>
            <div class="detail-item">
                <h3 class="detail-title">အခြေအနေ</h3>
                <p class="detail-value">
                    <span class="status-badge pending">စောင့်ဆိုင်းဆဲ</span>
                </p>
            </div>
            <div class="detail-item">
                <h3 class="detail-title">ပမာဏ</h3>
                <p class="detail-value">${formattedAmount} Ks</p>
            </div>
            <div class="detail-item">
                <h3 class="detail-title">ငွေလွှဲနည်း</h3>
                <p class="detail-value">${transaction.payment_method === 'kpay' ? 'KPay' : 'Wave'}</p>
            </div>
            <div class="detail-item">
                <h3 class="detail-title">သုံးစွဲသူ</h3>
                <p class="detail-value">${transaction.users?.username || 'Unknown'}</p>
            </div>
            <div class="detail-item">
                <h3 class="detail-title">သုံးစွဲသူ အီးမေးလ်</h3>
                <p class="detail-value">${transaction.users?.email || 'Unknown'}</p>
            </div>
            <div class="detail-item">
                <h3 class="detail-title">ရက်စွဲ</h3>
                <p class="detail-value">${createdDate}</p>
            </div>
            <div class="detail-item">
                <h3 class="detail-title">အိုင်ဒီ</h3>
                <p class="detail-value">#${transaction.id}</p>
            </div>
            ${isDeposit ? `
                <div class="detail-item full-width">
                    <h3 class="detail-title">ငွေလွှဲပြီးသော ဖြတ်ပိုင်းပုံ</h3>
                    ${transaction.receipt_image ? `
                        <div class="receipt-preview">
                            <img src="${transaction.receipt_image}" alt="Receipt" class="receipt-image">
                            <a href="${transaction.receipt_image}" target="_blank" class="receipt-link">
                                <i class="fas fa-external-link-alt"></i> အပြည့်အစုံကြည့်ရန်
                            </a>
                        </div>
                    ` : '<p class="detail-value">ဖြတ်ပိုင်းပုံ မရှိပါ</p>'}
                </div>
            ` : `
                <div class="detail-item">
                    <h3 class="detail-title">လက်ခံမည့် ဖုန်းနံပါတ်</h3>
                    <p class="detail-value">${transaction.recipient_phone || 'N/A'}</p>
                </div>
                <div class="detail-item">
                    <h3 class="detail-title">လက်ခံမည့် အမည်</h3>
                    <p class="detail-value">${transaction.recipient_name || 'N/A'}</p>
                </div>
            `}
            ${transaction.note ? `
                <div class="detail-item full-width">
                    <h3 class="detail-title">မှတ်ချက်</h3>
                    <p class="detail-value">${transaction.note}</p>
                </div>
            ` : ''}
        </div>
    `;
    
    // Show modal
    transactionModal.classList.add('active');
}

// Process transaction (approve/reject)
async function processTransaction(action, id) {
    try {
        showProcessing();
        
        const transaction = pendingTransactions.find(tx => tx.id === id);
        if (!transaction) {
            throw new Error('Transaction not found');
        }
        
        // Update transaction status
        const { data: updatedTransaction, error: txError } = await supabase
            .from('transactions')
            .update({ status: action === 'approve' ? 'approved' : 'rejected' })
            .eq('id', id)
            .select()
            .single();
        
        if (txError) throw txError;
        
        // If deposit was approved, update user balance
        if (transaction.type === 'deposit' && action === 'approve') {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('balance')
                .eq('id', transaction.user_id)
                .single();
            
            if (userError) throw userError;
            
            const currentBalance = parseFloat(user.balance || 0);
            const amount = parseFloat(transaction.amount);
            const newBalance = currentBalance + amount;
            
            const { error: updateError } = await supabase
                .from('users')
                .update({ balance: newBalance.toString() })
                .eq('id', transaction.user_id);
            
            if (updateError) throw updateError;
        }
        
        // If withdrawal was rejected, return funds to user balance
        if (transaction.type === 'withdraw' && action === 'reject') {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('balance')
                .eq('id', transaction.user_id)
                .single();
            
            if (userError) throw userError;
            
            const currentBalance = parseFloat(user.balance || 0);
            const amount = parseFloat(transaction.amount);
            const newBalance = currentBalance + amount;
            
            const { error: updateError } = await supabase
                .from('users')
                .update({ balance: newBalance.toString() })
                .eq('id', transaction.user_id);
            
            if (updateError) throw updateError;
        }
        
        // Reload data
        await loadStats();
        await loadPendingTransactions();
        
        // Show success message
        alert(action === 'approve' ? 'ငွေလွှဲမှုကို အောင်မြင်စွာ အတည်ပြုပြီးပါပြီ' : 'ငွေလွှဲမှုကို ငြင်းပယ်ပြီးပါပြီ');
        
        // Close modals
        hideTransactionModal();
        hideConfirmModal();
    } catch (error) {
        console.error('Error processing transaction:', error);
        alert('ငွေလွှဲမှု လုပ်ဆောင်ရာတွင် အမှားတစ်ခု ဖြစ်ပေါ်ခဲ့သည်');
    } finally {
        hideProcessing();
    }
}

// Toggle transfers (enable/disable)
async function toggleTransfers(enable) {
    try {
        showProcessing();
        
        const { error } = await supabase
            .from('settings')
            .update({ allow_transfers: enable })
            .eq('id', 1);
        
        if (error) throw error;
        
        transfersEnabled = enable;
        updateTransferStatus();
        
        alert(enable ? 'ငွေလွှဲမှုများကို ခွင့်ပြုပြီးပါပြီ' : 'ငွေလွှဲမှုများကို ပိတ်ထားပြီးပါပြီ');
    } catch (error) {
        console.error('Error toggling transfers:', error);
        alert('ဆက်တင်များ ပြောင်းလဲရာတွင် အမှားတစ်ခု ဖြစ်ပေါ်ခဲ့သည်');
    } finally {
        hideProcessing();
    }
}

// Update transfer status UI
function updateTransferStatus() {
    if (transfersEnabled) {
        transferStatusText.textContent = 'ငွေလွှဲခြင်း: ခွင့်ပြုထားသည်';
        transferIndicator.classList.remove('off');
        transferIndicator.classList.add('on');
        enableTransfersBtn.disabled = true;
        disableTransfersBtn.disabled = false;
    } else {
        transferStatusText.textContent = 'ငွေလွှဲခြင်း: ပိတ်ထားသည်';
        transferIndicator.classList.remove('on');
        transferIndicator.classList.add('off');
        enableTransfersBtn.disabled = false;
        disableTransfersBtn.disabled = true;
    }
}

// Confirm action before proceeding
function confirmAction(action, id) {
    currentTransactionId = id;
    const confirmMessage = document.getElementById('confirm-message');
    
    if (action === 'approve') {
        confirmMessage.textContent = 'ဤငွေလွှဲမှုကို အတည်ပြုရန် သေချာပါသလား?';
        okConfirmBtn.onclick = () => processTransaction('approve', id);
    } else {
        confirmMessage.textContent = 'ဤငွေလွှဲမှုကို ငြင်းပယ်ရန် သေချာပါသလား?';
        okConfirmBtn.onclick = () => processTransaction('reject', id);
    }
    
    confirmModal.classList.add('active');
}

// Setup event listeners
function setupEventListeners() {
    // Close modal when clicking on close button or outside
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            hideTransactionModal();
            hideConfirmModal();
        });
    });
    
    window.addEventListener('click', event => {
        if (event.target === transactionModal) {
            hideTransactionModal();
        }
        if (event.target === confirmModal) {
            hideConfirmModal();
        }
    });
    
    // Transaction modal buttons
    approveTransactionBtn.addEventListener('click', () => {
        if (currentTransactionId) {
            confirmAction('approve', currentTransactionId);
        }
    });
    
    rejectTransactionBtn.addEventListener('click', () => {
        if (currentTransactionId) {
            confirmAction('reject', currentTransactionId);
        }
    });
    
    // Confirm modal buttons
    cancelConfirmBtn.addEventListener('click', hideConfirmModal);
    
    // Control panel buttons
    enableTransfersBtn.addEventListener('click', () => toggleTransfers(true));
    disableTransfersBtn.addEventListener('click', () => toggleTransfers(false));
    
    // Refresh buttons
    document.getElementById('refresh-transactions').addEventListener('click', loadPendingTransactions);
    document.getElementById('refresh-settings').addEventListener('click', loadStats);
    document.querySelector('.refresh-btn').addEventListener('click', async () => {
        showProcessing();
        await loadStats();
        await loadPendingTransactions();
        hideProcessing();
    });
    
    // Search form
    document.querySelector('.search-form').addEventListener('submit', event => {
        event.preventDefault();
        // Implement search functionality here
        alert('ရှာဖွေမှု လုပ်ဆောင်ချက် မကြာမီ ထည့်သွင်းပါမည်');
    });
}

// Set up realtime subscriptions
function setupRealtimeSubscriptions() {
    // Subscribe to transaction changes
    const transactionsChannel = supabase
        .channel('transactions-changes')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'transactions'
        }, () => {
            loadStats();
            loadPendingTransactions();
        })
        .subscribe();
    
    // Subscribe to settings changes
    const settingsChannel = supabase
        .channel('settings-changes')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'settings'
        }, payload => {
            if (payload.new && payload.new.allow_transfers !== undefined) {
                transfersEnabled = payload.new.allow_transfers;
                updateTransferStatus();
            }
        })
        .subscribe();
}

// Helper functions
function showLoader() {
    loader.classList.add('active');
}

function hideLoader() {
    loader.classList.remove('active');
}

function showProcessing() {
    processingOverlay.classList.add('active');
}

function hideProcessing() {
    processingOverlay.classList.remove('active');
}

function hideTransactionModal() {
    transactionModal.classList.remove('active');
    currentTransactionId = null;
}

function hideConfirmModal() {
    confirmModal.classList.remove('active');
}
