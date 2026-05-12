// ========== НАСТРОЙКИ ==========
const API_URL = "https://tst-production-c55e.up.railway.app/api/tg";
const BOT_USERNAME = "Minegpubot";

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let tg = window.Telegram.WebApp;
tg.requestFullscreen();
let user = tg.initDataUnsafe?.user;
let userId = user?.id || "test_" + Math.floor(Math.random() * 10000);

let playerData = {
  ton: 0,
  gpuTokens: 0,
  friends: 0,
  invitedFriends: [],
  transactions: []
};

let minerQuantities = {};
let accumulatedTon = 0;
let accumulatedGpu = 0;
let lastMiningTimestamp = Date.now();

let limitedEndTime = null;
let promoActive = false;

let selectedStakeDays = null;
let selectedStakePercent = null;
let userStakes = [];

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
  { id: "limited_silver", name: "🥈 Silver Limited", price: 10, priceCurrency: "ton", 
    tonPerDay: 0.2, gpuPerDay: 100, image: "silverminer.png", isReferral: false, limitedTime: true },
  { id: "limited_gold", name: "🥇 Gold Limited", price: 60, priceCurrency: "ton", 
    tonPerDay: 1.0, gpuPerDay: 380, image: "goldminer.png", isReferral: false, limitedTime: true },
  { id: "limited_diamond", name: "💎 Diamond Limited", price: 300, priceCurrency: "ton", 
    tonPerDay: 6.0, gpuPerDay: 2000, image: "diamondminer.png", isReferral: false, limitedTime: true }
];

const gpuTemplates = [...regularMiners, ...limitedMiners];
const EXCHANGE_RATE = 0.001;

// ========== УВЕДОМЛЕНИЯ ==========
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function initMinerQuantities() {
  for (const miner of gpuTemplates) {
    if (minerQuantities[miner.id] === undefined) minerQuantities[miner.id] = 0;
  }
  if (minerQuantities["basic"] === 0) minerQuantities["basic"] = 1;
}

function updateUI() {
  document.getElementById("ton").innerText = playerData.ton.toFixed(5);
  document.getElementById("gpuBalance").innerText = playerData.gpuTokens.toFixed(5);
  document.getElementById("friendCount").innerText = playerData.friends;
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
    return `<div class="history-item">
              <div class="history-info">
                <div class="history-amount" style="color:${amountColor}">
                  ${t.type === 'deposit' ? '+' : '-'} ${t.amount} <img src="ton.png" style="width: 12px; height: 12px;">
                </div>
                <div class="history-date">${formatDate(t.createdAt)}</div>
                <div style="font-size:9px;">${typeText}</div>
              </div>
              <div><span class="status-badge ${statusClass}">${statusText}</span></div>
            </div>`;
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
    const displayName = f.friendName || f.name || (f.friendId ? `User_${f.friendId.slice(-5)}` : 'Аноним');
    const earnedGpuFormatted = (f.earnedGpu || 0).toFixed(2);
    const incomeFromFriend = (f.earnedGpu || 0) * 0.02;
    const incomeFormatted = incomeFromFriend.toFixed(2);
    return `<div class="friend-item">
              <div class="friend-avatar">👤</div>
              <div class="friend-name">${displayName}</div>
              <div class="friend-earned">
                <span>${earnedGpuFormatted}</span>
                <img src="gpu.png" style="width: 14px; height: 14px;">
              </div>
              ${incomeFromFriend > 0 ? `<div class="friend-income">+${incomeFormatted} <img src="gpu.png" style="width: 10px; height: 10px;"></div>` : ''}
            </div>`;
  }).join('');
}

function updateRefLink() { 
  document.getElementById("refLink").innerText = `https://t.me/${BOT_USERNAME}?start=ref_${userId}`; 
}

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
    if (deltaSeconds <= 0 || deltaSeconds > 10) {
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
      document.getElementById("accumulatedGpu").innerText = accumulatedGpu.toFixed(5);
    }
    lastMiningTimestamp = now;
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
    updateUI();
    renderHistory();
    return true;
  }
  return false;
}

async function loadUserData(referrerId = null) {
  const result = await apiRequest("register", { referrer_id: referrerId });
  if (result?.success && result.data) {
    playerData = { 
      ton: result.data.ton, 
      gpuTokens: result.data.gpu, 
      friends: result.data.friends, 
      invitedFriends: result.data.invitedFriends || [],
      transactions: result.data.transactions || [] 
    };
    if (result.data.minerQuantities) minerQuantities = result.data.minerQuantities;
    else if (result.data.gameState?.minerQuantities) minerQuantities = result.data.gameState.minerQuantities;
    initMinerQuantities();
    accumulatedTon = result.data.accumulatedTon || 0;
    accumulatedGpu = result.data.accumulatedGpu || 0;
    document.getElementById("accumulatedTon").innerText = accumulatedTon.toFixed(4);
    document.getElementById("accumulatedGpu").innerText = accumulatedGpu.toFixed(2);
    updateUI();
    renderFriendsList();
    renderHistory();
    renderAllCards();
    updateMiningRateDisplay();
    lastMiningTimestamp = Date.now();
    return true;
  }
  return false;
}

async function loadReferrals() {
  const result = await apiRequest("getReferrals");
  if (result?.success && result.referrals) {
    playerData.invitedFriends = result.referrals;
    playerData.friends = result.referrals.length;
    renderFriendsList();
    renderAllCards();
    updateUI();
  }
}

// ========== РЕЙТИНГ ==========
async function loadRanking() {
    const result = await apiRequest("getStakingRanking", {});
    if (result?.success && result.ranking) {
        renderRankingModal(result.ranking, result.userRank);
    } else {
        const container = document.getElementById("rankingList");
        if (container) container.innerHTML = '<div style="text-align:center; padding:20px;">❌ Ошибка загрузки рейтинга</div>';
    }
}

function renderRankingModal(rankingData, userRankData) {
    const container = document.getElementById("rankingList");
    if (!container) return;
    
    if (!rankingData || rankingData.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px;">🏆 Пока нет участников в рейтинге</div>';
        return;
    }
    
    container.innerHTML = rankingData.map((user, index) => {
        const position = index + 1;
        let medalIcon = '';
        if (position === 1) medalIcon = '<i class="fa-solid fa-crown" style="color: #FFD700;"></i>';
        else if (position === 2) medalIcon = '<i class="fa-solid fa-medal" style="color: #C0C0C0;"></i>';
        else if (position === 3) medalIcon = '<i class="fa-solid fa-medal" style="color: #CD7F32;"></i>';
        else medalIcon = `<span class="rank-number">${position}</span>`;
        
        const displayName = user.name || user.userName || `User_${user.userId?.slice(-5) || 'anon'}`;
        const stakedAmount = user.totalStaked ? user.totalStaked.toFixed(2) : '0';
        
        return `<div class="ranking-item">
                    <div class="rank-position">${medalIcon}</div>
                    <div class="rank-user">
                        <div class="rank-name">${displayName}</div>
                        <div class="rank-stats">📦 ${stakedAmount} GPU в стейке</div>
                    </div>
                </div>`;
    }).join('');
    
    const myRankDiv = document.getElementById("myRankInfo");
    if (myRankDiv && userRankData) {
        if (userRankData.rank > 0) {
            const medalSymbol = userRankData.rank === 1 ? '🥇' : (userRankData.rank === 2 ? '🥈' : (userRankData.rank === 3 ? '🥉' : ''));
            myRankDiv.innerHTML = `<div class="my-rank-card">
                                        <div class="my-rank-title"><i class="fa-solid fa-user"></i> Моё место в рейтинге</div>
                                        <div class="my-rank-value">${medalSymbol} ${userRankData.rank} место</div>
                                        <div class="my-rank-stake">📦 ${userRankData.totalStaked?.toFixed(2) || '0'} GPU в стейке</div>
                                    </div>`;
        } else {
            myRankDiv.innerHTML = `<div class="my-rank-card">
                                        <div class="my-rank-title"><i class="fa-solid fa-user"></i> Моё место в рейтинге</div>
                                        <div class="my-rank-value">🔸 Не в топе</div>
                                        <div class="my-rank-stake">📦 ${userRankData.totalStaked?.toFixed(2) || '0'} GPU в стейке</div>
                                        <div class="rank-hint">Застейкайте больше GPU, чтобы попасть в топ!</div>
                                    </div>`;
        }
    }
}

function openRankingModal() {
    const modal = document.getElementById("rankingModal");
    if (modal) {
        modal.style.display = "flex";
        loadRanking();
    }
}

function closeRankingModal() {
    const modal = document.getElementById("rankingModal");
    if (modal) {
        modal.style.display = "none";
    }
}

// ========== ПОКУПКА МАЙНЕРОВ ==========
async function buyMiner(minerId) {
  const miner = gpuTemplates.find(m => m.id === minerId);
  if (!miner) return;
  if (miner.limitedTime && !promoActive) {
    showToast(`❌ Акция на ${miner.name} закончилась!`, 'error');
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
    if (result?.error === 'LIMIT_REACHED') showToast(`❌ Лимит достигнут!`, 'error');
    else if (result?.error === 'INSUFFICIENT_TON') showToast(`❌ Не хватает TON. Нужно: ${miner.price} TON`, 'error');
    else if (result?.error === 'INSUFFICIENT_GPU') showToast(`❌ Не хватает GPU.`, 'error');
    else if (result?.error === 'PROMO_EXPIRED') showToast(`❌ Акция на ${miner.name} закончилась!`, 'error');
    else if (result?.error === 'TOO_FAST') showToast("⚠️ Слишком часто! Подождите секунду.", 'error');
    else showToast("❌ Ошибка при покупке", 'error');
  }
}

// ========== РЕКЛАМА ==========
function showAdsgramAd() {
  return new Promise((resolve, reject) => {
    if (typeof window.Adsgram === 'undefined') {
      console.warn('❌ AdsGram SDK не загружен');
      reject('SDK not loaded');
      return;
    }
    window.Adsgram.init({ blockId: '29842' })
      .show()
      .then(() => { console.log('✅ AdsGram реклама показана'); resolve(); })
      .catch((error) => { console.error('❌ AdsGram ошибка:', error); reject(error); });
  });
}

function showTadsAd() {
  return new Promise((resolve, reject) => {
    if (typeof window.Tads === 'undefined') {
      reject('TADS not loaded');
      return;
    }
    try {
      window.Tads.init({
        widgetId: 9710,
        onReward: () => { console.log('✅ TADS реклама просмотрена'); resolve(); },
        onClose: () => { reject('closed early'); },
        onError: (error) => { reject(error); }
      });
      window.Tads.show();
    } catch (error) { reject(error); }
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
      console.log('TADS тоже не сработал:', error2);
      showToast("Реклама временно недоступна. Награда выдана!", 'warning');
      return false;
    }
  }
}

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
    await showAdWithCascade();
    await claimAfterAd();
    return;
  }
  if (result?.error === 'NOTHING_TO_CLAIM') showToast("Накоплений пока нет! Купите майнеры и подождите.", 'error');
  else if (result?.error === 'TOO_FAST') showToast("⚠️ Слишком часто! Подождите секунду.", 'error');
  else showToast("❌ Ошибка при сборе награды", 'error');
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
  if (infoPanel) {
    const rewardAmount = 2000 * (percent / 100);
    infoPanel.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
      <span>📅 <strong>${days} дней</strong> | 🏆 <strong>+${percent}%</strong></span>
      <span style="color: #FFD700;">Пример: 2000 GPU → +${rewardAmount.toFixed(0)} GPU (${(2000 + rewardAmount).toFixed(0)})</span>
    </div>`;
  }
}

async function createStake(amount, days) {
  if (!amount || amount < 2000) {
    showToast("Минимальная сумма стейкинга — 2000 GPU", 'error');
    return false;
  }
  if (playerData.gpuTokens < amount) {
    showToast("❌ Недостаточно GPU на балансе", 'error');
    return false;
  }
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
  } else if (result?.error === 'MIN_AMOUNT_2000') showToast("Минимальная сумма стейкинга — 2000 GPU", 'error');
  else if (result?.error === 'INSUFFICIENT_GPU') showToast("Недостаточно GPU", 'error');
  else showToast("Ошибка при создании стейка", 'error');
  return false;
}

async function loadUserStakes() {
  const result = await apiRequest("getStakes", {});
  if (result?.success && result.stakes) {
    userStakes = result.stakes;
    renderActiveStakes();
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
    const isExpired = now >= endDate;
    const timeRemaining = Math.max(0, endDate - now);
    const daysRemaining = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
    const hoursRemaining = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    let statusHtml = '';
    if (isExpired) {
      statusHtml = `<button class="claim-stake-btn" onclick="claimStakeReward('${stake.id}')">🎁 Забрать награду (+${stake.rewardAmount.toFixed(2)} GPU)</button>`;
    } else {
      statusHtml = `<div class="stake-status"><span>⏳ Осталось: ${daysRemaining}д ${hoursRemaining}ч</span><span>🏆 Награда: +${stake.rewardAmount.toFixed(2)} GPU</span></div>`;
    }
    return `<div class="stake-item"><div class="stake-info-row"><span class="stake-amount">📦 ${stake.amount.toFixed(2)} GPU</span><span class="stake-reward">+${stake.rewardPercent}%</span></div>
      <div class="stake-info-row"><span>📅 ${stake.days} дней</span><span>📆 До ${endDate.toLocaleDateString()}</span></div>
      <div class="progress-container"><div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${progressPercent}%"></div></div></div>
      ${statusHtml}</div>`;
  }).join('');
}

async function claimStakeReward(stakeId) {
  const result = await apiRequest("claimStakeReward", { stakeId });
  if (result?.success) {
    playerData.gpuTokens = result.newGpuBalance;
    updateUI();
    updateExchangeBalances();
    await loadUserStakes();
    showToast(`🎉 Получено ${result.rewardAmount.toFixed(2)} GPU!`, 'success');
  } else if (result?.error === 'STAKE_NOT_EXPIRED') showToast("⏳ Стейк ещё не завершён", 'error');
  else if (result?.error === 'STAKE_NOT_FOUND') showToast("Стейк не найден", 'error');
  else showToast("Ошибка при получении награды", 'error');
}

async function loadStakeHistory() {
  const result = await apiRequest("getStakes", {});
  if (result?.success && result.stakes) {
    const claimedStakes = result.stakes.filter(s => s.claimed === true);
    const container = document.getElementById('stakeHistoryList');
    if (!container) return;
    if (claimedStakes.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:#6B7CA8;">📋 История стейков пуста</div>';
      return;
    }
    container.innerHTML = claimedStakes.map(stake => {
      const rewardAmount = stake.amount * (stake.rewardPercent / 100);
      return `<div class="stake-item" style="opacity: 0.7;">
        <div class="stake-info-row"><span class="stake-amount">📦 ${stake.amount.toFixed(2)} GPU</span><span class="completed-badge">✅ Завершён</span></div>
        <div class="stake-info-row"><span>📅 ${stake.days} дней / +${stake.rewardPercent}%</span><span>🏆 Получено: +${rewardAmount.toFixed(2)} GPU</span></div>
        <div class="stake-info-row"><span style="font-size: 10px; color: #6B7CA8;">📆 ${new Date(stake.endDate).toLocaleDateString()}</span></div>
      </div>`;
    }).join('');
  }
}

// ========== ОБМЕН ==========
function updateExchangeBalances() {
  const availableGpuSpan = document.getElementById('availableGpuForSell');
  const availableTonSpan = document.getElementById('availableTonForBuy');
  const availableStakeSpan = document.getElementById('availableGpuForStake');
  if (availableGpuSpan) availableGpuSpan.innerText = playerData.gpuTokens.toFixed(2);
  if (availableTonSpan) availableTonSpan.innerText = playerData.ton.toFixed(4);
  if (availableStakeSpan) availableStakeSpan.innerText = playerData.gpuTokens.toFixed(2);
}

async function exchangeTonToGpu(tonAmount) {
  if (!tonAmount || tonAmount <= 0) {
    showToast("Введите корректную сумму TON", 'error');
    return false;
  }
  const result = await apiRequest("exchangeTonToGpu", { tonAmount });
  if (result?.success) {
    playerData.ton = result.ton;
    playerData.gpuTokens = result.gpu;
    updateUI();
    updateExchangeBalances();
    showToast(`✅ Куплено ${(tonAmount / 0.001).toFixed(2)} GPU за ${tonAmount} TON`, 'success');
    return true;
  } else if (result?.error === 'INSUFFICIENT_BALANCE') showToast("❌ Недостаточно TON на балансе", 'error');
  else showToast("❌ Ошибка при покупке GPU", 'error');
  return false;
}

function initFullExchange() {
  const sellModeBtn = document.getElementById('sellModeBtn');
  const buyModeBtn = document.getElementById('buyModeBtn');
  const sellPanel = document.getElementById('sellModePanel');
  const buyPanel = document.getElementById('buyModePanel');

  if (sellModeBtn) {
    sellModeBtn.addEventListener('click', () => {
      sellModeBtn.classList.add('active');
      buyModeBtn.classList.remove('active');
      sellPanel.classList.add('active');
      buyPanel.classList.remove('active');
    });
  }
  if (buyModeBtn) {
    buyModeBtn.addEventListener('click', () => {
      buyModeBtn.classList.add('active');
      sellModeBtn.classList.remove('active');
      buyPanel.classList.add('active');
      sellPanel.classList.remove('active');
    });
  }
  
  const sellBtn = document.getElementById('sellGpuBtn');
  const sellInput = document.getElementById('sellGpuAmount');
  if (sellInput) {
    sellInput.addEventListener('input', function() {
      const amount = parseFloat(this.value) || 0;
      document.getElementById('sellEstimate').innerHTML = `Вы получите: ${(amount * 0.001).toFixed(4)} <img src="ton.png" class="icon-img-small">`;
    });
  }
  if (sellBtn) {
    sellBtn.onclick = async () => {
      const amount = parseFloat(sellInput?.value);
      if (isNaN(amount) || amount <= 0) {
        showToast("Введите корректное количество GPU", 'error');
        return;
      }
      sellBtn.disabled = true;
      sellBtn.textContent = "⏳ Продажа...";
      try {
        const response = await fetch(`https://tst-production-c55e.up.railway.app/api/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Telegram-Init-Data": tg.initData || "" },
          body: JSON.stringify({ user_id: userId.toString(), amount: amount })
        });
        const result = await response.json();
        if (result.success) {
          playerData.ton = result.data.ton;
          playerData.gpuTokens = result.data.gpu;
          updateUI();
          updateExchangeBalances();
          sellInput.value = "";
          document.getElementById('sellEstimate').innerHTML = `Вы получите: 0 <img src="ton.png" class="icon-img-small">`;
          showToast(`✅ Продано ${amount} GPU за ${result.data.tonReceived.toFixed(4)} TON`, 'success');
        } else {
          showToast(result.error || "Ошибка при продаже", 'error');
        }
      } catch (error) {
        console.error("Exchange error:", error);
        showToast("❌ Ошибка сервера", 'error');
      } finally {
        sellBtn.disabled = false;
        sellBtn.textContent = "Продать";
      }
    };
  }
  
  const buyBtn = document.getElementById('buyGpuBtn');
  const buyInput = document.getElementById('buyTonAmount');
  if (buyInput) {
    buyInput.addEventListener('input', function() {
      const amount = parseFloat(this.value) || 0;
      const gpuAmount = amount / 0.001;
      document.getElementById('buyEstimate').innerHTML = `Вы получите: ${gpuAmount.toFixed(2)} <img src="gpu.png" class="icon-img-small">`;
    });
  }
  if (buyBtn) {
    buyBtn.onclick = async () => {
      const amount = parseFloat(buyInput?.value);
      if (isNaN(amount) || amount <= 0) {
        showToast("Введите корректную сумму TON", 'error');
        return;
      }
      buyBtn.disabled = true;
      buyBtn.textContent = "⏳ Покупка...";
      await exchangeTonToGpu(amount);
      buyBtn.disabled = false;
      buyBtn.textContent = "Купить GPU";
    };
  }
  updateExchangeBalances();
}

// ========== ПОПОЛНЕНИЕ И ВЫВОД ==========
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
  } else {
    showToast("⚠️ Для этого задания нет ссылки.", 'error');
  }
  const result = await apiRequest("tasks/complete", { taskId });
  if (result?.success) showToast("✅ Задание отмечено как выполненное! Ожидайте проверки", 'success');
  else showToast("❌ Ошибка при выполнении задания", 'error');
  await loadTasksGame();
  await syncWithServer();
}

// ========== РЕНДЕР МАЙНЕРОВ ==========
function fetchPromoStatus() {
  return new Promise((resolve) => {
    fetch(`${API_URL.replace('/api/tg', '')}/api/promo/status`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          promoActive = result.isActive;
          limitedEndTime = result.endTime;
          resolve(true);
        } else resolve(false);
      })
      .catch(() => resolve(false));
  });
}

function updateLimitedTimer() {
  const timerElement = document.getElementById('timerText');
  if (!timerElement) return;
  if (!limitedEndTime || Date.now() >= limitedEndTime || !promoActive) {
    timerElement.textContent = "АКЦИЯ ЗАВЕРШЕНА";
    const section = document.getElementById('limitedSection');
    if (section) section.style.display = 'none';
    return;
  }
  const remaining = limitedEndTime - Date.now();
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
  timerElement.textContent = `${days}д ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

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
    card.innerHTML = `
      <img src="${miner.image}" class="gpu-img" onerror="this.src='basicminer.png'">
      <div class="card-info">
        <h3>${miner.name} <span class="quantity-badge">×${quantity}</span><span class="limited-badge">🔥 7 DAYS ONLY</span><span class="time-badge"><i class="fa-regular fa-hourglass-half"></i> LIMITED</span></h3>
        <div class="rewards-info"><span>💰 +${miner.tonPerDay} TON/день</span><span>⚡ +${miner.gpuPerDay} GPU/день</span></div>
        <div class="button-group"><button class="exclusive-btn" onclick="buyMiner('${miner.id}')">💎 Купить за ${miner.price} TON</button></div>
        ${quantity > 0 ? `<div class="mining-rate">⚡ ${quantity} шт. майнят</div>` : ''}
      </div>
    `;
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
      if (quantity > 0) { canBuy = false; buyButtonText = '✅ ПОЛУЧЕНО'; }
      else {
        const activeCount = playerData.invitedFriends ? playerData.invitedFriends.filter(f => (f.earnedGpu || 0) >= 30).length : 0;
        canBuy = activeCount >= miner.requiredActive;
        buyButtonText = canBuy ? '🎁 ПОЛУЧИТЬ' : `🔒 ${activeCount}/${miner.requiredActive} друзей`;
      }
    } else if (miner.id === 'basic') {
      const dynamicPrice = 40 * Math.pow(1.15, quantity);
      priceText = `${dynamicPrice.toFixed(2)} <img src="gpu.png" class="icon-img-small">`;
      buyButtonText = `Купить за ${priceText}`;
    } else if (miner.priceCurrency === 'gpu') {
      priceText = `${miner.price} <img src="gpu.png" class="icon-img-small">`;
      buyButtonText = `Купить за ${priceText}`;
    } else {
      priceText = `${miner.price} <img src="ton.png" class="icon-img-small">`;
      buyButtonText = `Купить за ${priceText}`;
    }
    let conditionHtml = '';
    if (miner.isReferral) {
      conditionHtml = `<div style="font-size: 8px; color: #FFB347; margin-top: 4px;">⭐ Требуется: ${miner.requiredActive} приглашённых друзей (каждый должен заработать 30 GPU)</div>`;
    }
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${miner.image}" class="gpu-img" onerror="this.src='basicminer.png'">
      <div class="card-info">
        <h3>${miner.name} <span class="quantity-badge">×${quantity}</span>${miner.isReferral ? '<span class="referral-badge">🎁 РЕФЕРАЛЬНЫЙ</span>' : ''}${miner.maxQuantity ? `<span class="limit-badge">Макс ${miner.maxQuantity}</span>` : ''}</h3>
        <div class="rewards-info"><span>+${miner.tonPerDay} <img src="ton.png" class="icon-img-small">/день</span><span>+${miner.gpuPerDay} <img src="gpu.png" class="icon-img-small">/день</span></div>
        ${conditionHtml}
        <div class="button-group"><button class="buy-btn" ${(isLimitReached || (!canBuy && miner.isReferral)) ? 'disabled' : ''} onclick="buyMiner('${miner.id}')">${isLimitReached ? '📦 ЛИМИТ' : buyButtonText}</button></div>
        ${quantity > 0 ? `<div class="mining-rate">⚡ ${quantity} шт. в работе</div>` : ''}
      </div>
    `;
    container.appendChild(card);
  }
}

function renderAllCards() {
  renderLimitedMiners();
  renderRegularMiners();
}

// ========== НАВИГАЦИЯ ==========
function openTab(id, btn) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.querySelectorAll(".tg-nav-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  if (id === "referral") { loadReferrals(); updateRefLink(); }
  if (id === "wallet") { renderHistory(); }
  if (id === "tasks") { loadTasksGame(); }
  if (id === "staking") { updateExchangeBalances(); loadUserStakes(); loadStakeHistory(); }
}

function copyText(text) {
  navigator.clipboard.writeText(text);
  showToast("Скопировано!", 'success');
}

// ========== СИМУЛЯЦИЯ ЗАГРУЗКИ ==========
async function simulateLoading() {
  const steps = [
    { text: 'Подключение', progress: 30 },
    { text: 'Авторизация', progress: 60 },
    { text: 'Загрузка профиля', progress: 85 },
    { text: 'Вход в игру', progress: 100 }
  ];
  for (const step of steps) {
    loadingStatusTextEl.textContent = step.text;
    const currentProgress = parseInt(loadingPercentageEl.textContent) || 0;
    const targetProgress = step.progress;
    const diff = targetProgress - currentProgress;
    const stepsCount = 8;
    const increment = diff / stepsCount;
    for (let i = 0; i <= stepsCount; i++) {
      let newProgress = currentProgress + increment * i;
      if (newProgress > targetProgress) newProgress = targetProgress;
      const roundedProgress = Math.floor(newProgress);
      loadingPercentageEl.textContent = `${roundedProgress}%`;
      loaderFillEl.style.width = `${newProgress}%`;
      await new Promise(r => setTimeout(r, 12));
    }
    if (step.progress < 100) await new Promise(r => setTimeout(r, 150));
  }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
const loadingPercentageEl = document.getElementById('loadingPercentage');
const loaderFillEl = document.getElementById('loaderFill');
const loadingStatusTextEl = document.getElementById('loadingStatusText');

window.openTab = openTab;
window.copyText = copyText;
window.selectStakingPlan = selectStakingPlan;
window.buyMiner = buyMiner;
window.claimStakeReward = claimStakeReward;
window.completeTask = completeTask;
window.openRankingModal = openRankingModal;
window.closeRankingModal = closeRankingModal;

async function init() {
  tg.ready();
  tg.expand();
  setTimeout(() => tg.expand(), 100);
  
  if (user) {
    document.getElementById("userFirstName").innerText = user.first_name || "Игрок";
    if (user.username) document.getElementById("userStatus").innerHTML = `@${user.username}`;
    document.getElementById("avatar").innerText = user.first_name ? user.first_name[0] : (user.username ? user.username[0].toUpperCase() : "👤");
    document.getElementById("userIdShort").innerText = `#${userId.toString().slice(-5)}`;
  }
  
  let referrerId = null;
  if (tg.initDataUnsafe?.start_param && tg.initDataUnsafe.start_param.startsWith('ref_')) {
    referrerId = tg.initDataUnsafe.start_param.replace('ref_', '');
  }
  if (!referrerId) {
    const urlParams = new URLSearchParams(window.location.search);
    let param = urlParams.get('startapp') || urlParams.get('start_param');
    if (param && param.startsWith('ref_')) referrerId = param.replace('ref_', '');
  }
  
  await fetchPromoStatus();
  initMinerQuantities();
  renderAllCards();
  await loadUserData(referrerId);
  updateRefLink();
  await loadReferrals();
  initFullExchange();
  loadUserStakes();
  loadStakeHistory();
  
  lastMiningTimestamp = Date.now();
  startClientMining();
  setInterval(syncWithServer, 60000);
  setInterval(() => { updateLimitedTimer(); if (!promoActive) renderLimitedMiners(); }, 1000);
  
  document.getElementById("claimAllBtn").onclick = claimAccumulatedReward;
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
  
  const rankingCard = document.getElementById("rankingButton");
  if (rankingCard) {
    rankingCard.addEventListener("click", openRankingModal);
  }
  
  await simulateLoading();
  const loadingElement = document.getElementById("loading");
  loadingElement.style.transition = "opacity 0.5s ease";
  loadingElement.style.opacity = "0";
  setTimeout(() => {
    loadingElement.style.display = "none";
    document.getElementById("app").style.display = "block";
  }, 500);
}

init();