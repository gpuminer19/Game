// ============= ГЛАВНЫЙ ФАЙЛ - ОПТИМИЗИРОВАННЫЙ =============

let tg = null;
window.tgUser = null;

const BACKEND_URL = 'https://serv-production-56ad.up.railway.app';

let tempCoins = 0;
let isSaving = false;
let saveTimeout = null;
let pendingSave = false;

// Сохраняем НЕ чаще 1 раза в 30 секунд
const SAVE_DELAY = 30000;

function scheduleSave() {
    if (isSaving) {
        pendingSave = true;
        return;
    }
    
    if (saveTimeout) clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(async () => {
        saveTimeout = null;
        await performSave();
    }, SAVE_DELAY);
}

async function performSave() {
    if (isSaving) return;
    if (!window.gameAPI?.playerData) return;
    if (!window.tgUser?.id) return;
    
    isSaving = true;
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_id: window.tgUser.id.toString(),
                save_data: window.gameAPI.playerData
            })
        });
        
        if (response.ok) {
            console.log('💾 Сохранено');
        }
    } catch (e) {
        console.error('Save error:', e);
    } finally {
        isSaving = false;
        if (pendingSave) {
            pendingSave = false;
            scheduleSave();
        }
    }
}

function forceSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    performSave();
}

// ============= ОБНОВЛЕНИЕ ВСЕГО UI =============
function updateAllUI() {
    const playerData = window.gameAPI?.playerData;
    if (!playerData) return;
    
    // Монеты (целые числа)
    const coinsSpan = document.getElementById('uiCoins');
    if (coinsSpan) coinsSpan.innerText = Math.floor(playerData.coins) || '0';
    
    // Уровень
    const levelSpan = document.getElementById('playerLevel');
    if (levelSpan) levelSpan.innerText = playerData.playerLevel || 1;
    
    // Опыт
    const expPercent = ((playerData.playerExp || 0) / (playerData.expToNextLevel || 100)) * 100;
    const expFill = document.getElementById('expProgress');
    if (expFill) expFill.style.width = Math.min(100, expPercent) + '%';
    
    // БМ - ЕДИНАЯ ФОРМУЛА
    const damage = playerData.damage || 10;
    const attackSpeed = playerData.attackSpeed || 1.0;
    const critChance = playerData.critChance || 0;
    const critDamageBonus = ((playerData.critDamage || 1.5) - 1) * 100;
    const level = playerData.playerLevel || 1;
    
    const power = Math.floor(
        (damage * 10) +
        (attackSpeed * 100) +
        (critChance * 5) +
        (critDamageBonus * 2) +
        (level * 50)
    );
    
    const powerSpan = document.getElementById('playerPower');
    if (powerSpan) powerSpan.innerText = power.toLocaleString();
    
    // Этаж
    const currentFloor = playerData.currentFloor || 1;
    const floorInfo = document.getElementById('floorInfo');
    if (floorInfo) floorInfo.innerHTML = `🏢 ЭТАЖ ${currentFloor}`;
    
    const floorRequired = document.getElementById('floorRequired');
    const requiredBM = 500 * currentFloor;
    if (floorRequired) floorRequired.innerHTML = `🎯 ДЛЯ ПЕРЕХОДА НУЖНО: ${requiredBM} БМ`;
    
    // Синхронизация с gameState
    if (window.gameState) {
        window.gameState.coins = playerData.coins;
        window.gameState.damage = damage;
        window.gameState.attackSpeed = attackSpeed;
        window.gameState.critChance = critChance;
        window.gameState.critDamage = playerData.critDamage || 1.5;
    }
}

function updateCoinsDisplay() {
    const playerData = window.gameAPI?.playerData;
    if (playerData) {
        const coinsSpan = document.getElementById('uiCoins');
        if (coinsSpan) coinsSpan.innerText = Math.floor(playerData.coins) || '0';
        if (window.gameState) window.gameState.coins = playerData.coins;
    }
}
window.updateCoinsDisplay = updateCoinsDisplay;
window.updateAllUI = updateAllUI;

class GameAPI {
    constructor() {
        this.playerData = null;
        this.isLoading = false;
        this.listeners = [];
    }

    subscribe(callback) { this.listeners.push(callback); }
    notify() { this.listeners.forEach(cb => cb(this.playerData)); }

    async loadAllData() {
        if (!window.tgUser?.id) return false;
        if (this.isLoading) return false;
        this.isLoading = true;

        try {
            const response = await fetch(`${BACKEND_URL}/api/load`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegram_id: window.tgUser.id.toString() })
            });
            const result = await response.json();

            if (result.success && result.save_data) {
                this.playerData = result.save_data;
            } else {
                this.playerData = {
                    inventory: [], kills: 0, coins: 100, playerLevel: 1, playerExp: 0, expToNextLevel: 100,
                    damage: 10, attackSpeed: 1.0, critChance: 0, critDamage: 1.5, currentFloor: 1, floorMultiplier: 1,
                    equipped: { weapon: null, sight: null, laser: null, magazine: null, silencer: null }
                };
            }
            
            // Гарантия полей
            if (!this.playerData.inventory) this.playerData.inventory = [];
            if (!this.playerData.equipped) this.playerData.equipped = { weapon: null, sight: null, laser: null, magazine: null, silencer: null };
            if (this.playerData.coins === undefined) this.playerData.coins = 100;
            if (!this.playerData.playerLevel) this.playerData.playerLevel = 1;
            if (!this.playerData.damage) this.playerData.damage = 10;
            if (!this.playerData.attackSpeed) this.playerData.attackSpeed = 1.0;
            if (!this.playerData.currentFloor) this.playerData.currentFloor = 1;
            
            window.gameState = {
                coins: this.playerData.coins,
                damage: this.playerData.damage,
                attackSpeed: this.playerData.attackSpeed,
                fireDelay: Math.max(100, Math.floor(1000 / this.playerData.attackSpeed)),
                critChance: this.playerData.critChance || 0,
                critDamage: this.playerData.critDamage || 1.5,
                kills: this.playerData.kills || 0
            };
            
            updateAllUI();
            return true;
        } catch (e) {
            console.error('Load error:', e);
        } finally {
            this.isLoading = false;
        }
        return false;
    }

    async addCoins(amount) {
        if (!this.playerData) return;
        this.playerData.coins += amount;
        
        const coinsSpan = document.getElementById('uiCoins');
        if (coinsSpan) coinsSpan.innerText = Math.floor(this.playerData.coins) || '0';
        if (window.gameState) window.gameState.coins = this.playerData.coins;
        
        scheduleSave();
    }

    async addExp(amount) {
        if (!this.playerData) return;
        this.playerData.playerExp += amount;
        
        let leveledUp = false;
        while (this.playerData.playerExp >= this.playerData.expToNextLevel) {
            this.playerData.playerExp -= this.playerData.expToNextLevel;
            this.playerData.playerLevel++;
            this.playerData.expToNextLevel = Math.floor(this.playerData.expToNextLevel * 1.5);
            leveledUp = true;
            
            this.playerData.damage = 10 + (this.playerData.playerLevel - 1) * 2;
            this.playerData.attackSpeed = parseFloat((1.0 + (this.playerData.playerLevel - 1) * 0.2).toFixed(1));
            
            if (window.gameState) {
                window.gameState.damage = this.playerData.damage;
                window.gameState.attackSpeed = this.playerData.attackSpeed;
                window.gameState.fireDelay = Math.max(100, Math.floor(1000 / this.playerData.attackSpeed));
            }
            
            showToast(`🎉 УРОВЕНЬ ${this.playerData.playerLevel}! 🎉`);
            forceSave();
        }
        
        if (typeof window.applyEquipmentStats === 'function') window.applyEquipmentStats();
        
        updateAllUI();
        scheduleSave();
        
        if (leveledUp && typeof window.renderBossUI === 'function') window.renderBossUI();
    }

    async updateStats(damage, attackSpeed, critChance, critDamage) {
        if (!this.playerData) return;
        this.playerData.damage = damage;
        this.playerData.attackSpeed = attackSpeed;
        this.playerData.critChance = critChance;
        this.playerData.critDamage = critDamage;
        
        if (window.gameState) {
            window.gameState.damage = damage;
            window.gameState.attackSpeed = attackSpeed;
            window.gameState.critChance = critChance;
            window.gameState.critDamage = critDamage;
            window.gameState.fireDelay = Math.max(100, Math.floor(1000 / attackSpeed));
        }
        
        updateAllUI();
        scheduleSave();
    }

    async saveImportant() {
        forceSave();
    }

    getPlayerData() { return this.playerData; }
    getCurrentFloor() { return this.playerData?.currentFloor || 1; }
    getPlayerLevel() { return { level: this.playerData?.playerLevel || 1, exp: this.playerData?.playerExp || 0, nextExp: this.playerData?.expToNextLevel || 100 }; }
    getBaseStats() { const level = this.playerData?.playerLevel || 1; return { damage: 10 + (level - 1) * 2, attackSpeed: parseFloat((1.0 + (level - 1) * 0.2).toFixed(1)) }; }
    
    calculatePower() {
        if (!this.playerData) return 0;
        const damage = this.playerData.damage || 10;
        const attackSpeed = this.playerData.attackSpeed || 1.0;
        const critChance = this.playerData.critChance || 0;
        const critDamageBonus = ((this.playerData.critDamage || 1.5) - 1) * 100;
        const level = this.playerData.playerLevel || 1;
        return Math.floor(
            (damage * 10) +
            (attackSpeed * 100) +
            (critChance * 5) +
            (critDamageBonus * 2) +
            (level * 50)
        );
    }
    
    updatePowerDisplay() { updateAllUI(); }
    
    addTempCoins(amount) { 
        tempCoins += amount; 
        this.updateCollectButton(); 
    }
    
    async collectCoins() {
        if (tempCoins <= 0) { showToast('😅 Нет монет для сбора!'); return; }
        await this.addCoins(tempCoins);
        showToast(`💰 Вы собрали ${tempCoins.toFixed(3)} монет!`);
        tempCoins = 0;
        this.updateCollectButton();
    }

    updateCollectButton() {
        const btn = document.getElementById('collectCoinsBtn');
        const amountSpan = document.getElementById('collectCoinsAmount');
        if (btn && amountSpan) {
            amountSpan.innerText = tempCoins.toFixed(3);
            const currentTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (currentTab === 'game') {
                btn.style.display = 'flex';
                btn.disabled = tempCoins <= 0;
            } else { btn.style.display = 'none'; }
        }
    }

    clearAllMonsters() { const scene = window.gameInstance?.scene?.scenes?.[0]; if (scene?.clearAllMonsters) scene.clearAllMonsters(); }
    returnToFloor() { setTimeout(() => { const scene = window.gameInstance?.scene?.scenes?.[0]; if (scene?.spawnMonster && !window.isBossBattle) scene.spawnMonster(); }, 100); }
}

window.gameAPI = new GameAPI();
window.addTempCoins = (amount) => window.gameAPI?.addTempCoins(amount);
window.collectCoins = async () => await window.gameAPI?.collectCoins();

async function initTelegram() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) loadingScreen.style.display = 'flex';
    
    if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        if (tg.initDataUnsafe?.user) {
            window.tgUser = tg.initDataUnsafe.user;
            let playerName = await loadPlayerName();
            if (!playerName) {
                playerName = window.tgUser.first_name || window.tgUser.username || 'БОЕЦ';
                await savePlayerName(playerName);
            }
            document.getElementById('playerName').innerText = playerName;
            await window.gameAPI.loadAllData();
            
            await new Promise(resolve => {
                const checkScene = setInterval(() => {
                    if (window.gameInstance?.scene?.scenes?.[0]) {
                        clearInterval(checkScene);
                        resolve();
                    }
                }, 50);
                setTimeout(() => resolve(), 3000);
            });
            
            if (loadingScreen) {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }
        }
    }
    setTimeout(updateAvatars, 500);
}

async function savePlayerName(name) {
    if (!window.tgUser?.id) return;
    try { await fetch(`${BACKEND_URL}/api/player/name`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telegram_id: window.tgUser.id.toString(), name }) }); } catch(e) {}
}

async function loadPlayerName() {
    if (!window.tgUser?.id) return null;
    try { const res = await fetch(`${BACKEND_URL}/api/player/name/get`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telegram_id: window.tgUser.id.toString() }) }); const data = await res.json(); return data.success ? data.name : null; } catch(e) { return null; }
}

function updateAvatars() {
    const topAvatar = document.getElementById('tgAvatar');
    if (topAvatar) topAvatar.src = window.tgUser?.photo_url || 'avatar.png';
    const invAvatar = document.getElementById('playerAvatar');
    if (invAvatar) invAvatar.src = 'avatar.png';
}

document.addEventListener('DOMContentLoaded', () => {
    initTelegram();
    if (typeof window.initShop === 'function') window.initShop();
    if (typeof window.initMarket === 'function') setTimeout(() => window.initMarket(), 1000);
});

console.log('✅ main.js загружен');