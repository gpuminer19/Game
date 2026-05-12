// ========== ЛОКАЛЬНАЯ ВЕРСИЯ (без API) ==========
// Все данные хранятся в localStorage

// ========== УВЕДОМЛЕНИЯ ==========
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ========== ДАННЫЕ МАЙНЕРОВ ==========
const regularMiners = [
  { id: "basic", name: "Basic Miner", price: 40, priceCurrency: "gpu", maxQuantity: 30,
    tonPerDay: 0.01, gpuPerDay: 15, image: "basicminer.png", isReferral: false },
  { id: "normal", name: "Normal Miner", price: 2, priceCurrency: "ton", maxQuantity: null,
    tonPerDay: 0.02, gpuPerDay: 15, image: "normalminer.png", isReferral: false },
  { id: "pro", name: "Pro Miner", price: 10, priceCurrency: "ton", maxQuantity: null,
    tonPerDay: 0.1, gpuPerDay: 75, image: "prominer.png", isReferral: false },
  { id: "ultra", name: "Ultra Miner", price: 50, priceCurrency: "ton", maxQuantity: null,
    tonPerDay: 0.6, gpuPerDay: 380, image: "ultraminer.png", isReferral: false },
  { id: "legendary", name: "Legendary Miner", price: 100, priceCurrency: "ton", maxQuantity: null,
    tonPerDay: 1.4, gpuPerDay: 780, image: "legendaryminer.png", isReferral: false },
  { id: "minex", name: "Minex", price: 500, priceCurrency: "ton", maxQuantity: null,
    tonPerDay: 7, gpuPerDay: 1800, image: "xminer.png", isReferral: false },
  { id: "friend", name: "Friend Miner", price: 0, priceCurrency: "ref", maxQuantity: null,
    tonPerDay: 0.1, gpuPerDay: 15, image: "friendminer.png", 
    isReferral: true, requiredActive: 10, requiredEarned: 30 },
  { id: "bro", name: "Bro Miner", price: 0, priceCurrency: "ref", maxQuantity: null,
    tonPerDay: 0.5, gpuPerDay: 75, image: "brominer.png", 
    isReferral: true, requiredActive: 50, requiredEarned: 30 },
  { id: "nexus", name: "Nexus Miner", price: 0, priceCurrency: "ref", maxQuantity: null,
    tonPerDay: 1.5, gpuPerDay: 200, image: "nexusminer.png", 
    isReferral: true, requiredActive: 150, requiredEarned: 30 }
];

const limitedMiners = [
  { id: "limited_silver", name: "🥈 Silver Limited", price: 10, priceCurrency: "ton", tonPerDay: 0.2, gpuPerDay: 100, image: "silverminer.png", isReferral: false, limitedTime: true },
  { id: "limited_gold", name: "🥇 Gold Limited", price: 60, priceCurrency: "ton", tonPerDay: 1.0, gpuPerDay: 380, image: "goldminer.png", isReferral: false, limitedTime: true },
  { id: "limited_diamond", name: "💎 Diamond Limited", price: 300, priceCurrency: "ton", tonPerDay: 6.0, gpuPerDay: 2000, image: "diamondminer.png", isReferral: false, limitedTime: true }
];

const gpuTemplates = [...regularMiners, ...limitedMiners];
const EXCHANGE_RATE = 0.001;

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let tg = { initData: "", initDataUnsafe: { user: { id: 12345, first_name: "Тестер" } }, ready: () => {}, expand: () => {}, requestFullscreen: () => {} };
try {
    if (window.Telegram?.WebApp) tg = window.Telegram.WebApp;
} catch(e) { console.log("Not in Telegram"); }

let user = tg.initDataUnsafe?.user || { id: "local_" + Math.floor(Math.random() * 10000), first_name: "Игрок" };
let userId = user?.id || "local_" + Math.floor(Math.random() * 10000);

let playerData = { ton: 100, gpuTokens: 5000, friends: 0, invitedFriends: [], transactions: [] };
let minerQuantities = {};
let accumulatedTon = 0;
let accumulatedGpu = 0;
let lastMiningTimestamp = Date.now();
let limitedEndTime = Date.now() + 7 * 24 * 60 * 60 * 1000;
let promoActive = true;

// Стейкинг
let selectedStakeDays = null;
let selectedStakePercent = null;
let userStakes = [];

// ========== API НАСТРОЙКИ ==========
const API_URL = "https://tst-production-c55e.up.railway.app/api/tg";

// ========== ЗАГРУЗКА/СОХРАНЕНИЕ В LOCALSTORAGE ==========
function saveGame() {
    const saveData = {
        playerData: { ton: playerData.ton, gpuTokens: playerData.gpuTokens, friends: playerData.friends, invitedFriends: playerData.invitedFriends, transactions: playerData.transactions },
        minerQuantities: minerQuantities,
        accumulatedTon: accumulatedTon,
        accumulatedGpu: accumulatedGpu,
        lastMiningTimestamp: lastMiningTimestamp,
        userStakes: userStakes
    };
    localStorage.setItem(`crypto_gpu_${userId}`, JSON.stringify(saveData));
}

function loadGame() {
    const saved = localStorage.getItem(`crypto_gpu_${userId}`);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            playerData = { ton: 100, gpuTokens: 5000, friends: 0, invitedFriends: [], transactions: [], ...data.playerData };
            minerQuantities = data.minerQuantities || {};
            accumulatedTon = data.accumulatedTon || 0;
            accumulatedGpu = data.accumulatedGpu || 0;
            lastMiningTimestamp = data.lastMiningTimestamp || Date.now();
            userStakes = data.userStakes || [];
        } catch(e) { console.error(e); }
    }
    initMinerQuantities();
}

function initMinerQuantities() {
    for (const miner of gpuTemplates) {
        if (minerQuantities[miner.id] === undefined) minerQuantities[miner.id] = 0;
    }
    if (minerQuantities["basic"] === 0) minerQuantities["basic"] = 1;
}

// ========== ОБНОВЛЕНИЕ UI ==========
function updateUI() {
    document.getElementById("ton").innerText = playerData.ton.toFixed(5);
    document.getElementById("gpuBalance").innerText = playerData.gpuTokens.toFixed(5);
    document.getElementById("friendCount").innerText = playerData.friends;
    document.getElementById("accumulatedTon").innerText = accumulatedTon.toFixed(5);
    document.getElementById("accumulatedGpu").innerText = accumulatedGpu.toFixed(2);
    updateExchangeBalances();
}

function formatDate(date) { return new Date(date).toLocaleString(); }

function renderHistory() {
    const container = document.getElementById("historyList");
    if (!container) return;
    if (!playerData.transactions || playerData.transactions.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#6B7CA8;">📭 История транзакций пуста</div>';
        return;
    }
    container.innerHTML = playerData.transactions.map(t => {
        let statusText = '', statusClass = '';
        if (t.status === 'pending') { statusText = '⏳ Ожидает'; statusClass = 'status-pending'; }
        else if (t.status === 'completed') { statusText = '✅ Выполнено'; statusClass = 'status-completed'; }
        else { statusText = '❌ Отклонено'; statusClass = 'status-cancelled'; }
        const typeText = t.type === 'deposit' ? '💎 Пополнение' : '📤 Вывод';
        const amountColor = t.type === 'deposit' ? '#00A86B' : '#FF8C00';
        return `<div class="history-item"><div class="history-info"><div class="history-amount" style="color:${amountColor}">${t.type === 'deposit' ? '+' : '-'} ${t.amount} <img src="ton.png" style="width: 12px; height: 12px;"></div><div class="history-date">${formatDate(t.createdAt)}</div><div style="font-size:9px;">${typeText}</div></div><div><span class="status-badge ${statusClass}">${statusText}</span></div></div>`;
    }).join('');
}

function renderFriendsList() {
    const container = document.getElementById("friendsList");
    if (!container) return;
    if (!playerData.invitedFriends || playerData.invitedFriends.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#6B7CA8;">😢 У вас пока нет приглашённых друзей</div>';
        return;
    }
    container.innerHTML = playerData.invitedFriends.map(f => {
        const displayName = f.friendName || f.name || (f.friendId ? `User_${String(f.friendId).slice(-5)}` : 'Аноним');
        const earnedGpuFormatted = (f.earnedGpu || 0).toFixed(2);
        const incomeFromFriend = (f.earnedGpu || 0) * 0.02;
        return `<div class="friend-item"><div class="friend-avatar">👤</div><div class="friend-name">${displayName}</div><div class="friend-earned"><span>${earnedGpuFormatted}</span><img src="gpu.png" style="width: 14px; height: 14px;"></div>${incomeFromFriend > 0 ? `<div class="friend-income">+${incomeFromFriend.toFixed(2)} <img src="gpu.png" style="width: 10px; height: 10px;"></div>` : ''}</div>`;
    }).join('');
}

function updateRefLink() { 
    document.getElementById("refLink").innerText = `https://t.me/TestBot?start=ref_${userId}`; 
}

// ========== МАЙНИНГ ==========
function getTotalMiningRates() {
    let totalTonPerDay = 0, totalGpuPerDay = 0;
    for (const miner of gpuTemplates) {
        const qty = minerQuantities[miner.id] || 0;
        totalTonPerDay += miner.tonPerDay * qty;
        totalGpuPerDay += miner.gpuPerDay * qty;
    }
    return { totalTonPerDay, totalGpuPerDay };
}

function updateMiningRateDisplay() {
    const { totalTonPerDay, totalGpuPerDay } = getTotalMiningRates();
    document.getElementById("miningRateTon").innerHTML = `+${totalTonPerDay.toFixed(5)} TON/день`;
    document.getElementById("miningRateGpu").innerHTML = `+${totalGpuPerDay.toFixed(5)} GPU/день`;
}

function startClientMining() {
    setInterval(() => {
        const now = Date.now();
        const deltaSeconds = (now - lastMiningTimestamp) / 1000;
        if (deltaSeconds <= 0 || deltaSeconds > 60) {
            lastMiningTimestamp = now;
            return;
        }
        const { totalTonPerDay, totalGpuPerDay } = getTotalMiningRates();
        const deltaDays = deltaSeconds / (24 * 3600);
        const earnedTon = totalTonPerDay * deltaDays;
        const earnedGpu = totalGpuPerDay * deltaDays;
        if (earnedTon > 0 || earnedGpu > 0) {
            accumulatedTon += earnedTon;
            accumulatedGpu += earnedGpu;
            document.getElementById("accumulatedTon").innerText = accumulatedTon.toFixed(5);
            document.getElementById("accumulatedGpu").innerText = accumulatedGpu.toFixed(2);
        }
        lastMiningTimestamp = now;
        saveGame();
    }, 1000);
}

// ========== API ЗАПРОСЫ ==========
async function apiRequest(action, additionalData = {}) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": tg.initData || ""
      },
      body: JSON.stringify({ action, user_id: userId.toString(), name: user?.first_name || "Игрок", ...additionalData })
    });
    const result = await response.json();
    if (result.error === 'BANNED') { showToast(result.message || "❌ Аккаунт заблокирован", 'error'); return null; }
    if (result.error === 'USER_ID_MISMATCH') { showToast("❌ Ошибка авторизации", 'error'); return null; }
    if (result.error === 'TOO_MANY_REQUESTS') { showToast("⚠️ Слишком много запросов. Подождите.", 'error'); return null; }
    if (result.error === 'CLAIM_COOLDOWN') { showToast("⚠️ Собирать награду можно не чаще 1 раза в 30 секунд", 'error'); return null; }
    return result;
  } catch (error) { console.error(error); return null; }
}

// ========== СИНХРОНИЗАЦИЯ ==========
async function syncWithServer() {
  const result = await apiRequest("register", {});
  if (result?.success && result.data) {
    playerData.ton = result.data.ton;
    playerData.gpuTokens = result.data.gpu;
    playerData.friends = result.data.friends;
    playerData.invitedFriends = result.data.invitedFriends || [];
    playerData.transactions = result.data.transactions || [];
    
    if (result.data.minerQuantities) {
      minerQuantities = result.data.minerQuantities;
      renderAllCards();
      updateMiningRateDisplay();
    }
    
    accumulatedTon = result.data.accumulatedTon || 0;
    accumulatedGpu = result.data.accumulatedGpu || 0;
    
    updateUI();
    renderHistory();
    return true;
  }
  return false;
}

// ========== КАСКАДНАЯ РЕКЛАМА ==========
function showAdsgramAd() {
    return new Promise((resolve, reject) => {
        if (typeof window.Adsgram === 'undefined') {
            console.warn('❌ AdsGram SDK не загружен');
            reject('SDK not loaded');
            return;
        }
        
        console.log('📢 Попытка показать AdsGram рекламу...');
        
        window.Adsgram.init({ blockId: '29842' })
            .show()
            .then(() => {
                console.log('✅ AdsGram реклама успешно показана и закрыта');
                resolve();
            })
            .catch((error) => {
                console.error('❌ AdsGram ошибка:', error);
                reject(error);
            });
    });
}

function showTadsAd() {
    return new Promise((resolve, reject) => {
        if (typeof window.Tads === 'undefined') {
            console.warn('TADS не загружен');
            reject('TADS not loaded');
            return;
        }
        
        try {
            window.Tads.init({
                widgetId: 9710,
                onReward: () => {
                    console.log('✅ TADS реклама просмотрена');
                    resolve();
                },
                onClose: () => {
                    console.log('❌ TADS реклама закрыта без просмотра');
                    reject('closed early');
                },
                onError: (error) => {
                    console.error('TADS ошибка:', error);
                    reject(error);
                }
            });
            
            window.Tads.show();
        } catch (error) {
            reject(error);
        }
    });
}

async function showAdWithCascade() {
    try {
        await showAdsgramAd();
        return true;
    } catch (error) {
        console.log('AdsGram не сработал, пробуем TADS:', error);
        try {
            await showTadsAd();
            return true;
        } catch (error2) {
            console.log('TADS тоже не сработал, выдаём награду без рекламы:', error2);
            showToast("Реклама временно недоступна. Награда выдана!", 'warning');
            return false;
        }
    }
}

// ========== СБОР НАКОПЛЕННОГО ==========
async function claimAccumulatedReward() {
    const result = await apiRequest("claim", {});
    
    if (result?.success) {
        if (result.data) {
            playerData.ton = result.data.ton;
            playerData.gpuTokens = result.data.gpu;
            accumulatedTon = result.data.accumulatedTon;
            accumulatedGpu = result.data.accumulatedGpu;
            document.getElementById("accumulatedTon").innerText = accumulatedTon.toFixed(4);
            document.getElementById("accumulatedGpu").innerText = accumulatedGpu.toFixed(2);
            updateUI();
            showToast("🎉 Награда собрана!", 'success');
        } else {
            await syncWithServer();
            showToast("🎉 Награда собрана!", 'success');
        }
        return;
    }
    
    if (result?.error === 'NEEDS_AD') {
        const adWatched = await showAdWithCascade();
        await claimAfterAd();
        return;
    }
    
    if (result?.error === 'NOTHING_TO_CLAIM') {
        showToast("Накоплений пока нет! Купите майнеры и подождите.", 'error');
    } else if (result?.error === 'TOO_FAST') {
        showToast("⚠️ Слишком часто! Подождите секунду.", 'error');
    } else {
        showToast("❌ Ошибка при сборе награды", 'error');
    }
}

async function claimAfterAd() {
    const result = await apiRequest("claimAfterAd", {});
    
    if (result?.success) {
        if (result.data) {
            playerData.ton = result.data.ton;
            playerData.gpuTokens = result.data.gpu;
            accumulatedTon = result.data.accumulatedTon;
            accumulatedGpu = result.data.accumulatedGpu;
            document.getElementById("accumulatedTon").innerText = accumulatedTon.toFixed(4);
            document.getElementById("accumulatedGpu").innerText = accumulatedGpu.toFixed(2);
            updateUI();
            showToast("🎉 Накопления получены!", 'success');
        } else {
            await syncWithServer();
            showToast("🎉 Накопления получены!", 'success');
        }
    } else {
        showToast("❌ Ошибка при получении накоплений", 'error');
    }
}

// ========== ПОКУПКА МАЙНЕРОВ ==========
async function buyMiner(minerId) {
  console.log("🟢 [ПОКУПКА] Начало. Майнер:", minerId);
  
  const miner = gpuTemplates.find(m => m.id === minerId);
  if (!miner) {
    console.log("🔴 [ПОКУПКА] Майнер не найден:", minerId);
    return;
  }
  
  const result = await apiRequest("buy", { minerId, quantity: 1 });
  
  if (result?.success) {
    playerData.ton = result.ton;
    playerData.gpuTokens = result.gpu;
    minerQuantities = result.minerQuantities;
    
    renderAllCards();
    updateMiningRateDisplay();
    updateUI();
    showToast(`✅ +1 ${miner.name}!`, 'success');
  } else {
    if (result?.error === 'LIMIT_REACHED') {
      showToast(`❌ Лимит достигнут!`, 'error');
    } else if (result?.error === 'INSUFFICIENT_TON') {
      showToast(`❌ Не хватает TON. Нужно: ${miner.price} TON`, 'error');
    } else if (result?.error === 'INSUFFICIENT_GPU') {
      showToast(`❌ Не хватает GPU.`, 'error');
    } else if (result?.error === 'PROMO_EXPIRED') {
      showToast(`❌ Акция на ${miner.name} закончилась!`, 'error');
    } else if (result?.error === 'TOO_FAST') {
      showToast("⚠️ Слишком часто! Подождите секунду.", 'error');
    } else {
      showToast("❌ Ошибка при покупке", 'error');
    }
  }
}

// ========== РЕНДЕР МАЙНЕРОВ ==========
function renderLimitedMiners() {
    const container = document.getElementById("limitedGrid");
    if (!container) return;
    if (!promoActive) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#a0b0ff;">⏰ Акция завершена! Следите за новыми предложениями</div>';
        return;
    }
    container.innerHTML = "";
    for (const miner of limitedMiners) {
        const quantity = minerQuantities[miner.id] || 0;
        const card = document.createElement("div");
        card.className = "card-limited";
        card.innerHTML = `<img src="${miner.image}" class="gpu-img" onerror="this.src='basicminer.png'"><div class="card-info"><h3>${miner.name} <span class="quantity-badge">×${quantity}</span><span class="limited-badge">🔥 LIMITED</span></h3><div class="rewards-info"><span>💰 +${miner.tonPerDay} TON/день</span><span>⚡ +${miner.gpuPerDay} GPU/день</span></div><div class="button-group"><button class="exclusive-btn" onclick="buyMiner('${miner.id}')">💎 Купить за ${miner.price} TON</button></div>${quantity > 0 ? `<div class="mining-rate">⚡ ${quantity} шт. майнят</div>` : ''}</div></div>`;
        container.appendChild(card);
    }
}

function renderRegularMiners() {
    const container = document.getElementById("grid");
    if (!container) return;
    container.innerHTML = "";
    for (const miner of regularMiners) {
        const quantity = minerQuantities[miner.id] || 0;
        const isLimitReached = miner.maxQuantity !== null && quantity >= miner.maxQuantity;
        let priceText = '', buyButtonText = '', canBuy = true;
        
        if (miner.isReferral) {
            if (quantity > 0) { canBuy = false; buyButtonText = '✅ ПОЛУЧЕНО'; priceText = ''; }
            else {
                const activeCount = playerData.invitedFriends.filter(f => (f.earnedGpu || 0) >= 30).length;
                canBuy = activeCount >= miner.requiredActive;
                buyButtonText = canBuy ? '🎁 ПОЛУЧИТЬ' : `🔒 ${activeCount}/${miner.requiredActive} друзей`;
                priceText = '';
            }
        }
        else if (miner.id === 'basic') {
            const dynamicPrice = 40 * Math.pow(1.15, quantity);
            priceText = `${dynamicPrice.toFixed(2)} <img src="gpu.png" class="icon-img-small">`;
            buyButtonText = `Купить за ${dynamicPrice.toFixed(2)} GPU`;
        }
        else {
            priceText = `${miner.price} <img src="ton.png" class="icon-img-small">`;
            buyButtonText = `Купить за ${priceText}`;
        }
        
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `<img src="${miner.image}" class="gpu-img" onerror="this.src='basicminer.png'"><div class="card-info"><h3>${miner.name} <span class="quantity-badge">×${quantity}</span>${miner.isReferral ? '<span class="referral-badge">🎁 РЕФЕРАЛЬНЫЙ</span>' : ''}${miner.maxQuantity ? `<span class="limit-badge">Макс ${miner.maxQuantity}</span>` : ''}</h3><div class="rewards-info"><span>+${miner.tonPerDay} <img src="ton.png" class="icon-img-small">/день</span><span>+${miner.gpuPerDay} <img src="gpu.png" class="icon-img-small">/день</span></div><div class="button-group"><button class="buy-btn" ${(isLimitReached || (!canBuy && miner.isReferral)) ? 'disabled' : ''} onclick="buyMiner('${miner.id}')">${isLimitReached ? '📦 ЛИМИТ' : buyButtonText}</button></div>${quantity > 0 ? `<div class="mining-rate">⚡ ${quantity} шт. в работе</div>` : ''}</div></div>`;
        container.appendChild(card);
    }
}

function renderAllCards() { renderLimitedMiners(); renderRegularMiners(); }

// ========== ОБМЕН ==========
function exchangeTonToGpu(tonAmount) {
    if (!tonAmount || tonAmount <= 0) { showToast("Введите корректную сумму TON", 'error'); return false; }
    if (playerData.ton < tonAmount) { showToast("❌ Недостаточно TON", 'error'); return false; }
    const gpuAmount = tonAmount / EXCHANGE_RATE;
    playerData.ton -= tonAmount;
    playerData.gpuTokens += gpuAmount;
    updateUI();
    saveGame();
    showToast(`✅ Куплено ${gpuAmount.toFixed(2)} GPU за ${tonAmount} TON`, 'success');
    return true;
}

function exchangeGpuToTon(gpuAmount) {
    if (!gpuAmount || gpuAmount <= 0) { showToast("Введите корректное количество GPU", 'error'); return false; }
    if (playerData.gpuTokens < gpuAmount) { showToast("❌ Недостаточно GPU", 'error'); return false; }
    const tonAmount = gpuAmount * EXCHANGE_RATE;
    playerData.gpuTokens -= gpuAmount;
    playerData.ton += tonAmount;
    updateUI();
    saveGame();
    showToast(`✅ Продано ${gpuAmount} GPU за ${tonAmount.toFixed(4)} TON`, 'success');
    return true;
}

function updateExchangeBalances() {
    const gpuSpan = document.getElementById('availableGpuForSell');
    const tonSpan = document.getElementById('availableTonForBuy');
    const stakeSpan = document.getElementById('availableGpuForStake');
    if (gpuSpan) gpuSpan.innerText = playerData.gpuTokens.toFixed(2);
    if (tonSpan) tonSpan.innerText = playerData.ton.toFixed(4);
    if (stakeSpan) stakeSpan.innerText = playerData.gpuTokens.toFixed(2);
}

// ========== СТЕЙКИНГ ==========
function selectStakingPlan(days, percent) {
    selectedStakeDays = days;
    selectedStakePercent = percent;
    document.querySelectorAll('.staking-plan').forEach(plan => plan.classList.remove('selected'));
    const selectedPlan = document.querySelector(`.staking-plan[data-days="${days}"]`);
    if (selectedPlan) selectedPlan.classList.add('selected');
    const form = document.getElementById('stakingCreateForm');
    const infoPanel = document.getElementById('selectedPlanInfo');
    if (form) form.style.display = 'block';
    if (infoPanel) infoPanel.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;"><span>📅 <strong>${days} дней</strong> | 🏆 <strong>+${percent}%</strong></span></div>`;
}

async function createStake(amount, days, rewardPercent) {
    if (!amount || amount < 2000) { showToast("Минимальная сумма стейкинга — 2000 GPU", 'error'); return false; }
    
    const result = await apiRequest("createStake", { amount, days });
    
    if (result?.success) {
        playerData.gpuTokens = result.newGpuBalance;
        updateUI();
        updateExchangeBalances();
        
        await loadUserStakes();
        
        showToast(`✅ ${amount} GPU застейкано на ${days} дней!`, 'success');
        
        document.getElementById('stakingCreateForm').style.display = 'none';
        document.getElementById('stakeAmount').value = '';
        selectedStakeDays = null;
        selectedStakePercent = null;
        
        return true;
    } else if (result?.error === 'MIN_AMOUNT_2000') {
        showToast("Минимальная сумма стейкинга — 2000 GPU", 'error');
    } else if (result?.error === 'INSUFFICIENT_GPU') {
        showToast("Недостаточно GPU", 'error');
    } else {
        showToast("Ошибка при создании стейка", 'error');
    }
    return false;
}

async function loadUserStakes() {
    const result = await apiRequest("getStakes", {});
    
    if (result?.success && result.stakes) {
        userStakes = result.stakes;
        renderActiveStakes();
        renderStakeHistory();
    }
}

function renderActiveStakes() {
    const container = document.getElementById('activeStakesList');
    if (!container) return;
    
    if (!userStakes || userStakes.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#6B7CA8;">🔒 Нет активных стейков</div>';
        return;
    }
    
    container.innerHTML = userStakes.map(stake => {
        const now = new Date();
        const endDate = new Date(stake.endDate);
        const startDate = new Date(stake.startDate);
        const totalDuration = stake.days * 24 * 60 * 60 * 1000;
        const elapsed = Math.max(0, Math.min(totalDuration, now - startDate));
        const progressPercent = (elapsed / totalDuration) * 100;
        const timeRemaining = Math.max(0, endDate - now);
        const daysRemaining = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
        const hoursRemaining = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        
        return `
            <div class="stake-item">
                <div class="stake-info-row">
                    <span class="stake-amount">📦 ${stake.amount.toFixed(2)} GPU</span>
                    <span class="stake-reward">+${stake.rewardPercent}%</span>
                </div>
                <div class="stake-info-row">
                    <span>📅 ${stake.days} дней</span>
                    <span>⏳ Осталось: ${daysRemaining}д ${hoursRemaining}ч</span>
                </div>
                <div class="progress-container">
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function renderStakeHistory() {
    const container = document.getElementById('stakeHistoryList');
    if (!container) return;
    
    // Получаем завершённые стейки
    const result = await apiRequest("getStakes", {});
    if (result?.success && result.stakes) {
        const completedStakes = result.stakes.filter(s => s.claimed === true);
        if (completedStakes.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#6B7CA8;">📋 История стейков пуста</div>';
        } else {
            container.innerHTML = completedStakes.slice(-10).map(stake => `
                <div class="stake-item" style="opacity: 0.7;">
                    <div class="stake-info-row">
                        <span class="stake-amount">📦 ${stake.amount.toFixed(2)} GPU</span>
                        <span class="completed-badge">✅ Завершён</span>
                    </div>
                    <div class="stake-info-row">
                        <span>📅 ${stake.days} дней / +${stake.rewardPercent}%</span>
                        <span>🏆 Награда: +${(stake.amount * stake.rewardPercent / 100).toFixed(2)} GPU</span>
                    </div>
                </div>
            `).join('');
        }
    }
}

// ========== ЗАДАНИЯ ==========
async function loadTasksGame() {
    const container = document.getElementById("tasksListGame");
    if (!container) return;
    const result = await apiRequest("tasks/list", {});
    if (result?.success && result.tasks) {
        if (result.tasks.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#6B7CA8;">📭 Нет активных заданий</div>';
            return;
        }
        container.innerHTML = result.tasks.map(task => {
            let statusHtml = '', buttonHtml = '';
            if (task.completed) statusHtml = '<div class="task-completed">✅ Выполнено</div>';
            else if (task.pending) statusHtml = '<div class="task-pending">⏳ Проверка</div>';
            else buttonHtml = `<button class="task-btn" onclick="completeTask('${task.id}', '${task.taskUrl}')">✅ Выполнить</button>`;
            return `<div class="card task-card"><div class="card-info"><h3>${task.title}</h3><div class="task-desc">${task.description}</div><div class="rewards-info">+${task.rewardTon} TON | +${task.rewardGpu} GPU</div>${statusHtml}${buttonHtml}</div></div>`;
        }).join('');
    } else {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#6B7CA8;">📭 Нет заданий</div>';
    }
}

async function completeTask(taskId, taskUrl) {
    if (taskUrl && taskUrl.trim() !== "") {
        window.open(taskUrl, '_blank');
        showToast("🔗 Задание открыто! После выполнения нажмите кнопку ещё раз для подтверждения", 'success');
    }
    
    const result = await apiRequest("tasks/complete", { taskId });
    
    if (result?.success) {
        showToast("✅ Задание отмечено как выполненное! Ожидайте проверки", 'success');
    } else {
        showToast("❌ Ошибка при выполнении задания", 'error');
    }
    
    await loadTasksGame();
    await syncWithServer();
}

// ========== КОШЕЛЁК ==========
async function createDeposit(amount) {
    const result = await apiRequest("createDeposit", { amount });
    if (result?.success) return result.deposit;
    return null;
}

async function createWithdraw(amount, wallet) {
    if (amount < 1) { showToast("Минимум 1 TON", 'error'); return false; }
    if (!wallet || wallet.length < 10) { showToast("Неверный кошелёк", 'error'); return false; }
    if (playerData.ton < amount) { showToast("Недостаточно TON", 'error'); return false; }
    const result = await apiRequest("createWithdraw", { amount, tonWallet: wallet });
    if (result?.success) {
        document.getElementById("withdrawAmount").value = "";
        document.getElementById("withdrawWallet").value = "";
        await syncWithServer();
        showToast("Заявка на вывод создана!", 'success');
        return true;
    }
    showToast(result?.error || "Ошибка", 'error');
    return false;
}

// ========== ТАЙМЕР АКЦИИ ==========
async function fetchPromoStatus() {
    try {
        const response = await fetch(`https://tst-production-c55e.up.railway.app/api/promo/status`);
        const result = await response.json();
        if (result.success) {
            promoActive = result.isActive;
            limitedEndTime = result.endTime;
            return true;
        }
    } catch (error) {
        console.error("Ошибка получения статуса акции:", error);
    }
    return false;
}

function updateLimitedTimer() {
    const timerElement = document.getElementById('timerText');
    if (!timerElement) return;
    
    if (!promoActive || Date.now() >= limitedEndTime) {
        timerElement.textContent = "АКЦИЯ ЗАВЕРШЕНА";
        return;
    }
    
    const remaining = limitedEndTime - Date.now();
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
    timerElement.textContent = `${days}д ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ========== РЕЙТИНГ (С РЕАЛЬНЫМИ ДАННЫМИ С БЭКЕНДА) ==========
async function openRatingModal() {
    const modal = document.getElementById('ratingModal');
    const ratingList = document.getElementById('ratingList');
    
    // Показываем загрузку
    ratingList.innerHTML = '<div class="rating-placeholder">📊 Загрузка рейтинга...</div>';
    modal.classList.add('show');
    
    try {
        // Запрос к бэкенду
        const response = await fetch('https://tst-production-c55e.up.railway.app/api/staking/rankings', {
            headers: {
                'X-Telegram-Init-Data': tg.initData || ''
            }
        });
        
        const result = await response.json();
        
        if (result.success && result.rankings && result.rankings.length > 0) {
            // Формируем список топ-10
            const top10 = result.rankings.slice(0, 10);
            
            ratingList.innerHTML = top10.map(item => `
                <div class="rating-item">
                    <span class="rank">${item.rank}</span>
                    <span class="name">${escapeHtml(item.name)}</span>
                    <span class="amount">${item.totalStakedGpu.toFixed(0)} GPU</span>
                </div>
            `).join('');
            
            // Если меньше 10 человек
            if (top10.length < 10) {
                ratingList.innerHTML += '<div class="rating-placeholder" style="margin-top:10px;">🏆 Станьте первым в рейтинге!</div>';
            }
        } else {
            ratingList.innerHTML = '<div class="rating-placeholder">🏆 Пока нет активных стейков. Будьте первым!</div>';
        }
        
    } catch (error) {
        console.error('Rating error:', error);
        ratingList.innerHTML = '<div class="rating-placeholder">❌ Ошибка загрузки рейтинга. Попробуйте позже.</div>';
    }
}

function closeRatingModal() {
    const modal = document.getElementById('ratingModal');
    modal.classList.remove('show');
}

// Вспомогательная функция для безопасности
function escapeHtml(text) {
    if (!text) return 'Аноним';
    return text.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ========== НАВИГАЦИЯ ==========
function openTab(id, btn) {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    document.querySelectorAll(".tg-nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    if (id === "referral") { renderFriendsList(); updateRefLink(); }
    if (id === "wallet") { renderHistory(); }
    if (id === "tasks") { loadTasksGame(); }
    if (id === "staking") { updateExchangeBalances(); loadUserStakes(); }
}

function copyText(text) { navigator.clipboard.writeText(text); showToast("Скопировано!", 'success'); }

// ========== СИМУЛЯЦИЯ ЗАГРУЗКИ ==========
async function simulateLoading() {
    const steps = [{ text: 'Подключение', progress: 30 }, { text: 'Авторизация', progress: 60 }, { text: 'Загрузка профиля', progress: 85 }, { text: 'Вход в игру', progress: 100 }];
    for (const step of steps) {
        document.getElementById('loadingStatusText').textContent = step.text;
        const currentProgress = parseInt(document.getElementById('loadingPercentage').textContent) || 0;
        const targetProgress = step.progress;
        const diff = targetProgress - currentProgress;
        const stepsCount = 8;
        const increment = diff / stepsCount;
        for (let i = 0; i <= stepsCount; i++) {
            let newProgress = currentProgress + increment * i;
            if (newProgress > targetProgress) newProgress = targetProgress;
            document.getElementById('loadingPercentage').textContent = `${Math.floor(newProgress)}%`;
            document.getElementById('loaderFill').style.width = `${newProgress}%`;
            await new Promise(r => setTimeout(r, 12));
        }
        if (step.progress < 100) await new Promise(r => setTimeout(r, 150));
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
async function init() {
    if (tg.ready) tg.ready();
    if (tg.expand) tg.expand();
    
    if (user) {
        document.getElementById("userFirstName").innerText = user.first_name || "Игрок";
        if (user.username) document.getElementById("userStatus").innerHTML = `@${user.username}`;
        document.getElementById("avatar").innerText = user.first_name ? user.first_name[0] : (user.username ? user.username[0].toUpperCase() : "👤");
        document.getElementById("userIdShort").innerText = `#${String(userId).slice(-5)}`;
    }
    
    // Получаем статус акции
    await fetchPromoStatus();
    
    // Загружаем данные с сервера
    await syncWithServer();
    
    initMinerQuantities();
    renderAllCards();
    updateMiningRateDisplay();
    updateUI();
    renderFriendsList();
    updateRefLink();
    renderHistory();
    await loadUserStakes();
    
    lastMiningTimestamp = Date.now();
    startClientMining();
    
    setInterval(() => updateLimitedTimer(), 1000);
    setInterval(() => syncWithServer(), 60000);
    
    document.getElementById("claimAllBtn").onclick = claimAccumulatedReward;
    
    // Обмен
    document.getElementById("sellGpuBtn").onclick = () => {
        const amount = parseFloat(document.getElementById("sellGpuAmount").value);
        if (isNaN(amount) || amount <= 0) { showToast("Введите корректное количество GPU", 'error'); return; }
        
        // Используем API обмена
        fetch('https://tst-production-c55e.up.railway.app/api/exchange', {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Telegram-Init-Data": tg.initData || "" },
            body: JSON.stringify({ user_id: userId.toString(), amount: amount })
        })
        .then(res => res.json())
        .then(result => {
            if (result.success) {
                playerData.ton = result.data.ton;
                playerData.gpuTokens = result.data.gpu;
                updateUI();
                updateExchangeBalances();
                document.getElementById("sellGpuAmount").value = "";
                document.getElementById("sellEstimate").innerHTML = `Вы получите: 0 <img src="ton.png" class="icon-img-small">`;
                showToast(`✅ Продано ${amount} GPU за ${result.data.tonReceived.toFixed(4)} TON`, 'success');
            } else {
                showToast(result.error || "Ошибка при продаже", 'error');
            }
        })
        .catch(error => { console.error("Exchange error:", error); showToast("❌ Ошибка сервера", 'error'); });
    };
    
    document.getElementById("buyGpuBtn").onclick = async () => {
        const amount = parseFloat(document.getElementById("buyTonAmount").value);
        if (isNaN(amount) || amount <= 0) { showToast("Введите корректную сумму TON", 'error'); return; }
        
        const result = await apiRequest("exchangeTonToGpu", { tonAmount: amount });
        if (result?.success) {
            playerData.ton = result.ton;
            playerData.gpuTokens = result.gpu;
            updateUI();
            updateExchangeBalances();
            document.getElementById("buyTonAmount").value = "";
            document.getElementById("buyEstimate").innerHTML = `Вы получите: 0 <img src="gpu.png" class="icon-img-small">`;
            showToast(`✅ Куплено ${(amount / 0.001).toFixed(2)} GPU за ${amount} TON`, 'success');
        } else {
            showToast(result?.error || "Ошибка при покупке", 'error');
        }
    };
    
    // Переключение режимов обмена
    document.getElementById("sellModeBtn").onclick = () => {
        document.getElementById("sellModeBtn").classList.add("active");
        document.getElementById("buyModeBtn").classList.remove("active");
        document.getElementById("sellModePanel").classList.add("active");
        document.getElementById("buyModePanel").classList.remove("active");
    };
    document.getElementById("buyModeBtn").onclick = () => {
        document.getElementById("buyModeBtn").classList.add("active");
        document.getElementById("sellModeBtn").classList.remove("active");
        document.getElementById("buyModePanel").classList.add("active");
        document.getElementById("sellModePanel").classList.remove("active");
    };
    
    // Прогрев полей
    document.getElementById("sellGpuAmount").addEventListener("input", function() {
        const amount = parseFloat(this.value) || 0;
        document.getElementById("sellEstimate").innerHTML = `Вы получите: ${(amount * 0.001).toFixed(4)} <img src="ton.png" class="icon-img-small">`;
    });
    document.getElementById("buyTonAmount").addEventListener("input", function() {
        const amount = parseFloat(this.value) || 0;
        document.getElementById("buyEstimate").innerHTML = `Вы получите: ${(amount / 0.001).toFixed(2)} <img src="gpu.png" class="icon-img-small">`;
    });
    
    // Стейкинг
    document.getElementById("createStakeBtn").onclick = () => {
        const amount = parseFloat(document.getElementById("stakeAmount").value);
        if (selectedStakeDays && selectedStakePercent) createStake(amount, selectedStakeDays, selectedStakePercent);
        else showToast("Сначала выберите план стейкинга", 'error');
    };
    
    // Кошелёк
    document.getElementById("payBtn").onclick = async () => {
        const amount = parseFloat(document.getElementById("depositAmount").value);
        if (isNaN(amount) || amount < 0.1) { showToast("Введите сумму от 0.1 TON", 'error'); return; }
        const depositData = await createDeposit(amount);
        if (depositData) {
            document.getElementById("paymentAmount").innerHTML = `${depositData.amount} <img src="ton.png" class="icon-img-small">`;
            document.getElementById("paymentWallet").innerText = depositData.wallet;
            document.getElementById("depositForm").style.display = "none";
            document.getElementById("depositConfirm").style.display = "block";
        }
    };
    document.getElementById("confirmPayBtn").onclick = async () => {
        document.getElementById("depositConfirm").style.display = "none";
        document.getElementById("depositForm").style.display = "block";
        document.getElementById("depositAmount").value = "";
        await syncWithServer();
        showToast("Спасибо! Ожидайте зачисления", 'success');
    };
    document.getElementById("cancelPayBtn").onclick = () => {
        document.getElementById("depositConfirm").style.display = "none";
        document.getElementById("depositForm").style.display = "block";
    };
    document.getElementById("withdrawBtn").onclick = () => {
        const amount = parseFloat(document.getElementById("withdrawAmount").value);
        const wallet = document.getElementById("withdrawWallet").value.trim();
        createWithdraw(amount, wallet);
    };
    document.getElementById("copyRefBtn").onclick = () => {
        navigator.clipboard.writeText(document.getElementById("refLink").innerText);
        showToast("Ссылка скопирована!", 'success');
    };
    
    // Рейтинг
    const ratingBtn = document.getElementById('ratingBtn');
    if (ratingBtn) {
        ratingBtn.addEventListener('click', openRatingModal);
    }
    const closeBtn = document.querySelector('.modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeRatingModal);
    }
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('ratingModal');
        if (e.target === modal) closeRatingModal();
    });
    
    await simulateLoading();
    const loadingElement = document.getElementById("loading");
    loadingElement.style.transition = "opacity 0.5s ease";
    loadingElement.style.opacity = "0";
    setTimeout(() => { loadingElement.style.display = "none"; document.getElementById("app").style.display = "block"; }, 500);
}

init();