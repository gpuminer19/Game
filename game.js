// ============= GAME.JS - ПОЛНАЯ ВЕРСИЯ =============

function showDebugError(message) {
    console.error(message);
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255,0,0,0.95);
        color: white;
        padding: 20px;
        border-radius: 15px;
        z-index: 10000;
        font-size: 14px;
        text-align: center;
        max-width: 85%;
        word-wrap: break-word;
        font-family: monospace;
        box-shadow: 0 0 20px black;
        border: 2px solid yellow;
    `;
    errorDiv.innerHTML = `⚠️ ОШИБКА ИГРЫ ⚠️<br><br>${message}<br><br><small>Нажмите для продолжения</small>`;
    errorDiv.onclick = () => errorDiv.remove();
    document.body.appendChild(errorDiv);
    setTimeout(() => { if (errorDiv.parentNode) errorDiv.remove(); }, 8000);
}

window.addEventListener('error', (e) => {
    showDebugError(e.message + ' в ' + (e.filename || 'игре'));
});

const config = {
  type: Phaser.AUTO,
  parent: "game",
  width: window.innerWidth,
  height: window.innerHeight - 60,
  backgroundColor: '#111',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { y: 0 }
    }
  },
  scene: { preload, create, update }
};

window.gameInstance = new Phaser.Game(config);

let player, arrows, monsters;
let floorMultiplier = 1.0;
let currentFloor = 1;
let requiredBMForNextFloor = 500;
let bgImage = null;

let playerLevel = 1;
let playerExp = 0;
let expToNextLevel = 100;

const BASE_MONSTER_HP = 80;
const BASE_MONSTER_DAMAGE = 10;
const BASE_MONSTER_SPEED = 200;
const MONSTER_ATTACK_DELAY = 600;
const BOSS_ATTACK_DELAY = 450;
const MAX_MONSTERS = 1;

let isBossBattle = false;
let currentBoss = null;
let bossMonster = null;
let playerShadow = null;
let laneY;
let shootingEnabled = true;
let isPlayerDead = false;

function preload() {
    this.load.spritesheet('idle', 'idle.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('shot', 'shot.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('monster', 'mon.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('monster_attack', 'monatk.png', { frameWidth: 96, frameHeight: 95 });
    this.load.spritesheet('monster2', 'mon2.png', { frameWidth: 96, frameHeight: 95 });
    this.load.spritesheet('monster_attack2', 'monatk2.png', { frameWidth: 96, frameHeight: 95 });
    this.load.spritesheet('boss_idle', 'bosss.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('boss_attack', 'bosssatk.png', { frameWidth: 128, frameHeight: 127 });
    this.load.image('arrow', 'https://labs.phaser.io/assets/sprites/bullets/bullet7.png');
    this.load.image('fon', 'fon.png');
}

function create() {
    if (!window.gameState) {
        window.gameState = {
            coins: 100,
            damage: 10,
            attackSpeed: 1.0,
            fireDelay: 1000,
            critChance: 0,
            critDamage: 1.5,
            kills: 0
        };
    }
    
    laneY = this.scale.height - 40;
    isPlayerDead = false;
    loadServerProgress();

    bgImage = this.add.image(0, 0, 'fon');
    bgImage.setOrigin(0.5, 0.5);
    bgImage.setDepth(-999);
    
    const resizeBgImage = () => {
        if (!bgImage) return;
        const scaleX = this.scale.width / bgImage.width;
        const scaleY = this.scale.height / bgImage.height;
        const scale = Math.max(scaleX, scaleY);
        bgImage.setScale(scale);
        bgImage.x = this.scale.width / 2;
        bgImage.y = this.scale.height / 2;
    };
    
    setTimeout(resizeBgImage, 100);
    resizeBgImage();
    
    this.scale.on('resize', () => {
        resizeBgImage();
        laneY = this.scale.height - 40;
        if (player) player.y = laneY;
        if (playerShadow) playerShadow.y = laneY + 5;
        if (monsters) monsters.getChildren().forEach(m => { 
            m.y = laneY;
            if (m.shadow) m.shadow.y = laneY + 5;
        });
        if (bossMonster && bossMonster.active) {
            bossMonster.y = laneY;
            if (bossMonster.shadow) bossMonster.shadow.y = laneY + 8;
        }
    });

    this.anims.create({
        key: 'idle_anim',
        frames: this.anims.generateFrameNumbers('idle', { start: 0, end: 8 }),
        frameRate: 8,
        repeat: -1
    });
    this.anims.create({
        key: 'shot_anim',
        frames: this.anims.generateFrameNumbers('shot', { start: 0, end: 3 }),
        frameRate: 12
    });
    this.anims.create({
        key: 'monster_walk',
        frames: this.anims.generateFrameNumbers('monster', { start: 0, end: 7 }),
        frameRate: 10,
        repeat: -1
    });
    this.anims.create({
        key: 'monster_attack_anim',
        frames: this.anims.generateFrameNumbers('monster_attack', { start: 0, end: 3 }),
        frameRate: 15,
        repeat: 0
    });
    this.anims.create({
        key: 'monster_walk2',
        frames: this.anims.generateFrameNumbers('monster2', { start: 0, end: 6 }),
        frameRate: 10,
        repeat: -1
    });
    this.anims.create({
        key: 'monster_attack_anim2',
        frames: this.anims.generateFrameNumbers('monster_attack2', { start: 0, end: 3 }),
        frameRate: 15,
        repeat: 0
    });
    this.anims.create({
        key: 'boss_walk',
        frames: this.anims.generateFrameNumbers('boss_idle', { start: 0, end: 9 }),
        frameRate: 8,
        repeat: -1
    });
    this.anims.create({
        key: 'boss_attack_anim',
        frames: this.anims.generateFrameNumbers('boss_attack', { start: 0, end: 3 }),
        frameRate: 12,
        repeat: 0
    });

    player = this.physics.add.sprite(80, laneY, 'idle');
    player.setOrigin(0.5, 1);
    player.setScale(1);
    player.play('idle_anim');
    player.setImmovable(true);
    player.body.setSize(60, 80);
    player.body.setOffset(34, 48);
    player.setDepth(10);
    
    playerShadow = this.add.ellipse(80, laneY + 5, 60, 18, 0x000000, 0.5);
    playerShadow.setDepth(9);

    arrows = this.physics.add.group();
    monsters = this.physics.add.group();

    startShooting.call(this);
    spawnMonster.call(this);

    this.physics.add.overlap(arrows, monsters, (arrow, monster) => hitMonster(arrow, monster), null, this);
    this.physics.add.overlap(player, monsters, (p, m) => monsterAttackPlayer(p, m), null, this);
    this.physics.add.collider(monsters, monsters, null, null, this);

    if (window.onGameReady) window.onGameReady();
    updateStatsUI();
    updateLevelUI();
}

function loadServerProgress() {
    const playerData = window.gameAPI?.getPlayerData();
    if (playerData) {
        currentFloor = playerData.currentFloor || 1;
        floorMultiplier = playerData.floorMultiplier || Math.pow(1.1, currentFloor - 1);
        playerLevel = playerData.playerLevel || 1;
        playerExp = playerData.playerExp || 0;
        expToNextLevel = playerData.expToNextLevel || 100;
        
        window.playerLevel = playerLevel;
        
        if (window.gameState) {
            window.gameState.damage = playerData.damage || 10;
            window.gameState.attackSpeed = playerData.attackSpeed || 1.0;
            window.gameState.critChance = playerData.critChance || 0;
            window.gameState.critDamage = playerData.critDamage || 1.5;
            window.gameState.coins = playerData.coins || 100;
            window.gameState.fireDelay = Math.max(100, Math.floor(1000 / window.gameState.attackSpeed));
        }
    }
    updateRequiredBM();
    updateFloorUI();
}

function updateFireDelay() {
    if (!window.gameState || window.gameState.attackSpeed === undefined) return;
    const delay = Math.max(100, Math.floor(1000 / window.gameState.attackSpeed));
    window.gameState.fireDelay = delay;
}

function getMonsterType() {
    return currentFloor >= 5 ? 2 : 1;
}

function clearAllMonsters() {
    if (monsters) {
        const allMonsters = monsters.getChildren();
        for (let i = allMonsters.length - 1; i >= 0; i--) {
            const m = allMonsters[i];
            if (m.hpBar) m.hpBar.destroy();
            if (m.hpBarBg) m.hpBarBg.destroy();
            if (m.shadow) m.shadow.destroy();
            if (m.nameText) m.nameText.destroy();
            m.destroy();
        }
        monsters.clear(true, true);
    }
}

function updateRequiredBM() {
    requiredBMForNextFloor = 500 * currentFloor;
    updateFloorUI();
}

function updateFloorUI() {
    const floorInfo = document.getElementById('floorInfo');
    const floorRequired = document.getElementById('floorRequired');
    
    if (floorInfo) floorInfo.innerHTML = `🏢 ЭТАЖ ${currentFloor}`;
    if (floorRequired) floorRequired.innerHTML = `🎯 ДЛЯ ПЕРЕХОДА НУЖНО: ${requiredBMForNextFloor} БМ`;
}

function updateLevelUI() {
    const expPercent = (playerExp / expToNextLevel) * 100;
    const expFill = document.getElementById('expProgress');
    if (expFill) expFill.style.width = Math.min(100, expPercent) + '%';
    const levelSpan = document.getElementById('playerLevel');
    if (levelSpan) levelSpan.innerText = playerLevel;
}

function updateStatsUI() {
    if (!window.gameState) return;
    const damageSpan = document.getElementById('statDamageValue');
    if (damageSpan) damageSpan.innerText = window.gameState.damage;
    const speedSpan = document.getElementById('statSpeedValue');
    if (speedSpan) speedSpan.innerText = window.gameState.attackSpeed.toFixed(1);
    const critChanceSpan = document.getElementById('statCritChanceValue');
    if (critChanceSpan) critChanceSpan.innerText = Math.round(window.gameState.critChance * 10) / 10 + '%';
    const critDamageSpan = document.getElementById('statCritDamageValue');
    if (critDamageSpan) critDamageSpan.innerText = '+' + Math.round((window.gameState.critDamage - 1) * 1000) / 10 + '%';
    if (window.gameAPI) window.gameAPI.updatePowerDisplay();
    updateFloorUI();
}

function calculatePower() {
    if (!window.gameState) return 0;
    const damage = window.gameState.damage || 10;
    const attackSpeed = window.gameState.attackSpeed || 1.0;
    const critChance = window.gameState.critChance || 0;
    const critDamageBonus = ((window.gameState.critDamage || 1.5) - 1) * 100;
    const level = playerLevel || 1;
    
    const result = Math.floor(
        (damage * 10) +
        (attackSpeed * 100) +
        (critChance * 5) +
        (critDamageBonus * 2) +
        (level * 50)
    );
    
    return result;
}

async function nextFloor() {
    const playerBM = calculatePower();
    const required = requiredBMForNextFloor;
    
    if (playerBM < required) {
        const needed = required - playerBM;
        showToast(`⚠️ НУЖНО НАБРАТЬ ЕЩЁ ${needed} БМ ДЛЯ ПЕРЕХОДА НА ${currentFloor + 1} ЭТАЖ! ⚠️`, true);
        return;
    }
    
    currentFloor++;
    floorMultiplier = Math.pow(1.1, currentFloor - 1);
    updateRequiredBM();
    
    if (window.gameAPI) {
        const data = window.gameAPI.getPlayerData();
        if (data) {
            data.currentFloor = currentFloor;
            data.floorMultiplier = floorMultiplier;
            await window.gameAPI.saveImportant();
        }
    }
    
    clearAllMonsters();
    updateFloorUI();
    
    showToast(`🏢 ЭТАЖ ${currentFloor} | Требуется БМ: ${requiredBMForNextFloor}`);
    
    setTimeout(() => {
        if (!isBossBattle && !isPlayerDead && monsters.getChildren().length === 0) {
            const scene = window.gameInstance.scene.scenes[0];
            if (scene) spawnMonster.call(scene);
        }
    }, 100);
}

async function prevFloor() {
    if (currentFloor <= 1) {
        showToast(`❌ НЕЛЬЗЯ СПУСТИТЬСЯ НИЖЕ 1 ЭТАЖА!`, true);
        return;
    }
    
    currentFloor--;
    floorMultiplier = Math.pow(1.1, currentFloor - 1);
    updateRequiredBM();
    
    if (window.gameAPI) {
        const data = window.gameAPI.getPlayerData();
        if (data) {
            data.currentFloor = currentFloor;
            data.floorMultiplier = floorMultiplier;
            await window.gameAPI.saveImportant();
        }
    }
    
    clearAllMonsters();
    updateFloorUI();
    
    showToast(`🏢 ЭТАЖ ${currentFloor} | Требуется БМ: ${requiredBMForNextFloor}`);
    
    setTimeout(() => {
        if (!isBossBattle && !isPlayerDead && monsters.getChildren().length === 0) {
            const scene = window.gameInstance.scene.scenes[0];
            if (scene) spawnMonster.call(scene);
        }
    }, 100);
}

function checkAndSpawnNextMonster(scene) {
    if (!isPlayerDead && !isBossBattle && monsters.getChildren().length === 0) {
        setTimeout(() => {
            if (!isPlayerDead && !isBossBattle && monsters.getChildren().length === 0) {
                if (scene) spawnMonster.call(scene);
            }
        }, 50);
    }
}

function update() {
    if (isPlayerDead) return;
    
    const w = this.scale.width;
    if (player && player.y !== laneY) player.y = laneY;

    if (arrows) arrows.getChildren().forEach(a => { if (a.x > w) a.destroy(); });

    if (playerShadow) {
        playerShadow.x = player.x;
        playerShadow.y = player.y + 5;
    }

    if (isBossBattle && bossMonster && bossMonster.active) {
        if (bossMonster.x < -200) {
            if (bossMonster.hpBar) bossMonster.hpBar.destroy();
            if (bossMonster.hpBarBg) bossMonster.hpBarBg.destroy();
            if (bossMonster.nameText) bossMonster.nameText.destroy();
            if (bossMonster.shadow) bossMonster.shadow.destroy();
            monsters.remove(bossMonster, true, true);
            bossMonster = null;
            isBossBattle = false;
            if (typeof window.recordBossAttempt === 'function') window.recordBossAttempt(currentBoss?.level);
            showToast(`❌ Босс ушёл! Вы проиграли! Попытка засчитана.`, true);
            currentBoss = null;
            if (typeof renderBossUI === 'function') setTimeout(() => renderBossUI(), 500);
            return;
        }
        
        if (bossMonster.hpBar) {
            bossMonster.hpBarBg.x = bossMonster.x;
            bossMonster.hpBarBg.y = bossMonster.y - 100;
            bossMonster.hpBar.x = bossMonster.x;
            bossMonster.hpBar.y = bossMonster.y - 100;
            bossMonster.hpBar.width = 200 * (bossMonster.hp / bossMonster.maxHp);
        }
        if (bossMonster.nameText) {
            bossMonster.nameText.x = bossMonster.x;
            bossMonster.nameText.y = bossMonster.y - 120;
        }
        if (bossMonster.shadow) {
            bossMonster.shadow.x = bossMonster.x;
            bossMonster.shadow.y = bossMonster.y + 8;
        }
        
        if (!bossMonster.isWaiting) {
            if (bossMonster.x < player.x + 70) {
                bossMonster.setVelocityX(0);
                bossMonster.isWaiting = true;
            } else {
                bossMonster.setVelocityX(-currentBoss?.speed || 30);
                bossMonster.isWaiting = false;
            }
        } else {
            if (bossMonster.x > player.x + 70) {
                bossMonster.isWaiting = false;
                bossMonster.setVelocityX(-currentBoss?.speed || 30);
            }
        }
    }

    if (monsters && !isBossBattle) {
        monsters.getChildren().forEach(m => {
            if (!m.isBoss && m.x < -100) {
                if (m.hpBar) m.hpBar.destroy();
                if (m.hpBarBg) m.hpBarBg.destroy();
                if (m.shadow) m.shadow.destroy();
                m.destroy();
                checkAndSpawnNextMonster(this);
                return;
            }

            if (!m.isBoss && m.active && m.hpBar) {
                m.hpBarBg.x = m.x;
                m.hpBarBg.y = m.y - 90;
                m.hpBar.x = m.x;
                m.hpBar.y = m.y - 90;
                m.hpBar.width = 60 * (m.hp / m.maxHp);
            }
            
            if (m.shadow) {
                m.shadow.x = m.x;
                m.shadow.y = m.y + 5;
            }
            
            if (!m.isBoss && !m.isWaiting) {
                const monsterAhead = monsters.getChildren().some(other => 
                    other !== m && Math.abs(other.x - m.x) < 45 && other.x < m.x && other.x > player.x
                );
                
                if (m.x < player.x + 45 || monsterAhead) {
                    m.setVelocityX(0);
                    m.isWaiting = true;
                } else {
                    m.setVelocityX(-BASE_MONSTER_SPEED);
                    m.isWaiting = false;
                }
            } else if (!m.isBoss) {
                const monsterAhead = monsters.getChildren().some(other => 
                    other !== m && Math.abs(other.x - m.x) < 45 && other.x < m.x && other.x > player.x
                );
                const tooClose = m.x < player.x + 45;
                
                if (!monsterAhead && !tooClose) {
                    m.isWaiting = false;
                    m.setVelocityX(-BASE_MONSTER_SPEED);
                }
            }
        });
    }
}

function startShooting() { shoot.call(this); }

function shoot() {
    if (!window.gameState || window.gameState.fireDelay === undefined) {
        if (this && this.time) this.time.delayedCall(100, () => shoot.call(this));
        return;
    }
    
    if (isPlayerDead || !shootingEnabled) return;
    
    let hasTarget = false;
    if (isBossBattle) {
        hasTarget = bossMonster && bossMonster.active;
    } else {
        hasTarget = monsters && monsters.getChildren().some(m => m.active && !m.isBoss && m.x > player.x);
    }
    
    if (!hasTarget) {
        this.time.delayedCall(200, () => shoot.call(this));
        return;
    }

    shootingEnabled = false;
    player.play('shot_anim');

    const scene = this;
    this.time.delayedCall(80, () => fireArrow.call(scene));

    player.once('animationcomplete', () => {
        player.play('idle_anim');
        scene.time.delayedCall(window.gameState.fireDelay, () => {
            shootingEnabled = true;
            shoot.call(scene);
        });
    });
}

function fireArrow() {
    if (!window.gameState) return;
    
    const scene = this;
    if (!scene) return;
    
    let hasTarget = false;
    if (isBossBattle) {
        hasTarget = bossMonster && bossMonster.active;
    } else {
        hasTarget = monsters && monsters.getChildren().some(m => m.active && !m.isBoss && m.x > player.x);
    }
    
    if (isPlayerDead || !hasTarget) return;
    
    const arrow = arrows.create(player.x + 50, player.y - 50, 'arrow');
    if (!arrow) return;
    
    arrow.setVelocityX(600);
    arrow.body.setSize(16, 16);
    arrow.setScale(0.5);
    arrow.setDepth(5);
    
    const trail = scene.add.circle(arrow.x, arrow.y, 3, 0xffdd66);
    trail.setDepth(4);
    scene.tweens.add({
        targets: trail,
        alpha: 0,
        scale: 0.5,
        duration: 200,
        onComplete: () => trail.destroy()
    });
}

function hitMonster(arrow, monster) {
    try {
        if (!window.gameState || window.gameState.damage === undefined) {
            if (arrow) arrow.destroy();
            return;
        }
        
        const scene = window.gameInstance?.scene?.scenes?.[0];
        if (!scene) {
            if (arrow) arrow.destroy();
            return;
        }
        
        if (!monster || !monster.active) {
            if (arrow) arrow.destroy();
            return;
        }
        
        if (arrow) arrow.destroy();
        
        let isCrit = false;
        let finalDamage = window.gameState.damage;
        if (Math.random() * 100 < window.gameState.critChance) {
            finalDamage *= window.gameState.critDamage;
            isCrit = true;
        }
        finalDamage = Math.floor(finalDamage);
        
        monster.hp -= finalDamage;
        
        try {
            monster.setTint(0xff4444);
            scene.time.delayedCall(100, () => { if (monster.active) monster.clearTint(); });
            scene.tweens.add({ targets: monster, x: monster.x - 10, duration: 50, yoyo: true, repeat: 2 });
        } catch(e) {}
        
        try {
            const text = scene.add.text(monster.x, monster.y - 40, finalDamage.toString(), {
                fontSize: '20px', fontWeight: 'bold', fill: isCrit ? '#ffaa00' : '#ffffff'
            });
            text.setDepth(15);
            if (isCrit) {
                text.setFontSize('32px');
                text.setText('CRITICAL!');
                if (scene.cameras) scene.cameras.main.shake(100, 0.003);
            }
            scene.tweens.add({ targets: text, y: monster.y - 100, alpha: 0, duration: 600, onComplete: () => text.destroy() });
        } catch(e) {}

        if (monster.hp <= 0) {
            if (monster.hpBar) monster.hpBar.destroy();
            if (monster.hpBarBg) monster.hpBarBg.destroy();
            if (monster.nameText) monster.nameText.destroy();
            if (monster.shadow) monster.shadow.destroy();
            monster.destroy();
            
            if (monster.isBoss) {
                isBossBattle = false;
                bossMonster = null;
                hideBossExitBtn();
                if (typeof window.claimBossReward === 'function') {
                    window.claimBossReward(currentBoss?.level);
                }
                if (typeof showToast === 'function') {
                    showToast(`🎉 ПОБЕДА НАД БОССОМ ${currentBoss?.name}! 🎉`);
                }
                currentBoss = null;
                if (typeof renderBossUI === 'function') {
                    setTimeout(() => renderBossUI(), 500);
                }
            } else {
                if (window.gameState) window.gameState.kills++;
                if (window.gameAPI && typeof window.gameAPI.addExp === 'function') {
                    window.gameAPI.addExp(10);
                }
                const floorTier = Math.ceil(currentFloor / 5);
                const reward = floorTier * 0.001;
                if (typeof window.addTempCoins === 'function') {
                    window.addTempCoins(reward);
                }
                
                try {
                    for(let i = 0; i < 8; i++) {
                        const particle = scene.add.circle(monster.x, monster.y, 3, 0xff4444);
                        scene.tweens.add({
                            targets: particle,
                            x: monster.x + (Math.random() - 0.5) * 80,
                            y: monster.y + (Math.random() - 0.5) * 80,
                            alpha: 0,
                            scale: 0,
                            duration: 500,
                            onComplete: () => particle.destroy()
                        });
                    }
                } catch(e) {}
                
                if (!isPlayerDead && !isBossBattle && monsters.getChildren().length === 0) {
                    setTimeout(() => {
                        if (!isPlayerDead && !isBossBattle && monsters.getChildren().length === 0) {
                            if (scene && typeof spawnMonster === 'function') {
                                spawnMonster.call(scene);
                            }
                        }
                    }, 50);
                }
            }
        }
    } catch(e) {
        showDebugError('hitMonster: ' + e.message);
    }
}

function monsterAttackPlayer(player, monster) {
    if (isPlayerDead) return;
    
    const attackDelay = monster.isBoss ? BOSS_ATTACK_DELAY : MONSTER_ATTACK_DELAY;
    const currentTime = Date.now();
    
    if (currentTime - monster.lastAttackTime >= attackDelay) {
        monster.lastAttackTime = currentTime;
        
        try {
            const scene = window.gameInstance?.scene?.scenes?.[0];
            if (monster.isBoss) {
                monster.play('boss_attack_anim');
            } else {
                const attackAnim = monster.monsterType === 2 ? 'monster_attack_anim2' : 'monster_attack_anim';
                monster.play(attackAnim);
            }
            
            player.setTint(0xff8888);
            if (scene) {
                scene.time.delayedCall(150, () => { 
                    if (player.active) player.clearTint(); 
                });
            }
        } catch(e) {}
    }
}

function spawnMonster() {
    if (isPlayerDead || isBossBattle) return;
    if (monsters.getChildren().length >= MAX_MONSTERS) return;
    
    const scene = this;
    const monsterType = getMonsterType();
    const isMonster2 = monsterType === 2;
    
    const textureKey = isMonster2 ? 'monster2' : 'monster';
    const walkAnim = isMonster2 ? 'monster_walk2' : 'monster_walk';
    
    const monster = monsters.create(scene.scale.width, laneY, textureKey);
    monster.setOrigin(0.5, 1);
    monster.setVelocityX(-BASE_MONSTER_SPEED);
    monster.play(walkAnim);
    
    const multipliedHp = Math.floor(BASE_MONSTER_HP * floorMultiplier);
    const multipliedDamage = Math.floor(BASE_MONSTER_DAMAGE * floorMultiplier);
    
    monster.hp = multipliedHp;
    monster.maxHp = multipliedHp;
    monster.damage = multipliedDamage;
    monster.lastAttackTime = 0;
    monster.isWaiting = false;
    monster.isBoss = false;
    monster.monsterType = monsterType;
    monster.setScale(1);
    monster.body.setSize(50, 60);
    monster.body.setOffset(23, 36);
    monster.setImmovable(true);
    monster.setDepth(5);
    
    monster.shadow = scene.add.ellipse(monster.x, monster.y + 5, 50, 15, 0x000000, 0.45);
    monster.shadow.setDepth(4);
    
    monster.hpBarBg = scene.add.rectangle(monster.x, monster.y - 90, 60, 6, 0x000000);
    monster.hpBar = scene.add.rectangle(monster.x, monster.y - 90, 60, 6, 0xff0000);
    monster.hpBarBg.setDepth(6);
    monster.hpBar.setDepth(6);
    
    monster.setScale(0);
    scene.tweens.add({
        targets: monster,
        scale: 1,
        duration: 200,
        ease: 'Back.out',
        onUpdate: (tween, target) => {
            if (monster.shadow) monster.shadow.setScale(target.scaleX, 0.5);
        }
    });
}

function spawnBoss(boss) {
    console.log("spawnBoss вызван", boss);
    
    if (bossMonster) {
        if (bossMonster.hpBar) bossMonster.hpBar.destroy();
        if (bossMonster.hpBarBg) bossMonster.hpBarBg.destroy();
        if (bossMonster.nameText) bossMonster.nameText.destroy();
        if (bossMonster.shadow) bossMonster.shadow.destroy();
        if (monsters) monsters.remove(bossMonster, true, true);
        bossMonster = null;
    }
    
    const scene = this;
    const laneY = scene.scale.height - 40;
    
    bossMonster = monsters.create(scene.scale.width, laneY, 'boss_idle');
    bossMonster.setOrigin(0.5, 1);
    bossMonster.setVelocityX(-boss.speed);
    bossMonster.play('boss_walk');
    bossMonster.setScale(1.2);
    
    bossMonster.hp = boss.hp;
    bossMonster.maxHp = boss.hp;
    bossMonster.damage = boss.damage;
    bossMonster.isBoss = true;
    bossMonster.body.setSize(70, 80);
    bossMonster.body.setOffset(29, 48);
    bossMonster.setImmovable(true);
    bossMonster.setDepth(5);
    bossMonster.isWaiting = false;
    bossMonster.lastAttackTime = 0;
    
    bossMonster.shadow = scene.add.ellipse(bossMonster.x, laneY + 8, 80, 20, 0x000000, 0.55);
    bossMonster.shadow.setDepth(4);
    
    bossMonster.hpBarBg = scene.add.rectangle(bossMonster.x, bossMonster.y - 100, 200, 12, 0x000000);
    bossMonster.hpBar = scene.add.rectangle(bossMonster.x, bossMonster.y - 100, 200, 12, 0xff0000);
    bossMonster.hpBarBg.setDepth(6);
    bossMonster.hpBar.setDepth(6);
    
    bossMonster.nameText = scene.add.text(bossMonster.x, bossMonster.y - 120, boss.name, {
        fontSize: '14px',
        color: '#ffaa44',
        fontWeight: 'bold',
        stroke: '#000000',
        strokeThickness: 2
    });
    bossMonster.nameText.setDepth(6);
    
    console.log("Босс создан");
}

function showBossExitBtn() {
    const btn = document.getElementById('bossExitBtn');
    if (btn) btn.style.display = 'flex';
}

function hideBossExitBtn() {
    const btn = document.getElementById('bossExitBtn');
    if (btn) btn.style.display = 'none';
}

function exitBossFight() {
    if (!isBossBattle && !currentBoss) return;
    
    const modal = document.getElementById('confirmModal');
    const message = document.getElementById('confirmMessage');
    
    if (modal && message) {
        message.innerHTML = `
            <div style="margin-bottom: 10px;">⚠️ ВНИМАНИЕ!</div>
            <div>Вы покидаете бой с боссом <span style="color: #ff5252; font-weight: bold;">${currentBoss?.name}</span></div>
            <div style="margin-top: 10px;">Попытка будет засчитана!</div>
            <div style="color: #ffaa44;">Босс исчезнет на 24 часа.</div>
        `;
        
        modal.style.display = 'flex';
        
        const yesBtn = document.getElementById('confirmYesBtn');
        const noBtn = document.getElementById('confirmNoBtn');
        const overlay = modal.querySelector('.confirm-overlay');
        
        const onYes = () => {
            modal.style.display = 'none';
            
            if (typeof window.recordBossAttempt === 'function') {
                window.recordBossAttempt(currentBoss?.level);
            }
            
            if (bossMonster) {
                if (bossMonster.hpBar) bossMonster.hpBar.destroy();
                if (bossMonster.hpBarBg) bossMonster.hpBarBg.destroy();
                if (bossMonster.nameText) bossMonster.nameText.destroy();
                if (bossMonster.shadow) bossMonster.shadow.destroy();
                monsters.remove(bossMonster, true, true);
                bossMonster = null;
            }
            
            isBossBattle = false;
            currentBoss = null;
            hideBossExitBtn();
            
            showToast(`❌ Вы вышли из боя! Попытка засчитана.`, true);
            
            setTimeout(() => {
                if (!isPlayerDead && !isBossBattle && monsters.getChildren().length === 0) {
                    const scene = window.gameInstance.scene.scenes[0];
                    if (scene) spawnMonster.call(scene);
                }
            }, 500);
            
            if (typeof renderBossUI === 'function') {
                setTimeout(() => renderBossUI(), 500);
            }
            
            cleanup();
        };
        
        const onNo = () => {
            modal.style.display = 'none';
            cleanup();
        };
        
        const cleanup = () => {
            yesBtn.removeEventListener('click', onYes);
            noBtn.removeEventListener('click', onNo);
            if (overlay) overlay.removeEventListener('click', onNo);
        };
        
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
        if (overlay) overlay.removeEventListener('click', onNo);
        
        yesBtn.addEventListener('click', onYes);
        noBtn.addEventListener('click', onNo);
        if (overlay) overlay.addEventListener('click', onNo);
    }
}

function updateGameStats(damage, attackSpeed, critChance, critDamage) {
    if (!window.gameState) return;
    window.gameState.damage = damage;
    window.gameState.attackSpeed = attackSpeed;
    window.gameState.critChance = critChance;
    window.gameState.critDamage = critDamage;
    updateFireDelay();
    updateStatsUI();
}

if (window.gameAPI) {
    window.gameAPI.updateGameStats = updateGameStats;
    window.gameAPI.getCurrentFloor = () => currentFloor;
    window.gameAPI.getPlayerLevel = () => ({ level: playerLevel, exp: playerExp, nextExp: expToNextLevel });
    window.gameAPI.getPower = () => calculatePower();
    window.gameAPI.clearAllMonsters = () => clearAllMonsters();
    window.gameAPI.returnToFloor = () => {
        setTimeout(() => {
            if (!isBossBattle && !isPlayerDead && monsters.getChildren().length === 0) {
                const scene = window.gameInstance?.scene?.scenes?.[0];
                if (scene) spawnMonster.call(scene);
            }
        }, 100);
    };
    window.gameAPI.startBossBattle = (boss) => {
        isBossBattle = true;
        currentBoss = boss;
        showBossExitBtn();
        clearAllMonsters();
        const scene = window.gameInstance?.scene?.scenes?.[0];
        if (scene) spawnBoss.call(scene, boss);
        showToast(`⚔️ БОСС: ${boss.name}! ⚔️`, false);
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const prevBtn = document.getElementById('prevFloorBtn');
    const nextBtn = document.getElementById('nextFloorBtn');
    if (prevBtn) prevBtn.addEventListener('click', () => prevFloor());
    if (nextBtn) nextBtn.addEventListener('click', () => nextFloor());
});

console.log('✅ game.js загружен');