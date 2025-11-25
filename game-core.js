// ============================================
// GAME CORE - Main Game Logic
// ============================================

const GAME_DATA_SCHEMA_VERSION = 1;

function getDefaultGameData() {
    const defaultThreshold = (typeof gameSettings !== 'undefined' && gameSettings && typeof gameSettings.auto_sell_threshold === 'number')
        ? gameSettings.auto_sell_threshold
        : 100;

    return {
        player: { level: 1, exp: 0, equipped: null },
        money: 0,
        item_storage: [],
        recycled_ids: [],
        mold_level: 1,
        luck_level: 1,
        level_exp: 0,
        item_id_counter: 0,
        sell_area: [],
        schema_version: GAME_DATA_SCHEMA_VERSION,
        auto_sell_threshold: defaultThreshold
    };
}

const RARITY_COST_EXPONENT = 1.25;
const RARITY_COST_DIVISOR = 160;

function getRarityCostScaling(rarityName) {
    if (!Array.isArray(RARITY_TIERS)) return 1;
    const tierIndex = RARITY_TIERS.findIndex(r => r[0] === rarityName);
    if (tierIndex < 0) return 1;
    const rank = RARITY_TIERS.length - tierIndex;
    const scale = 1 + Math.pow(rank, RARITY_COST_EXPONENT) / RARITY_COST_DIVISOR;
    return Math.min(scale, 1.85);
}

class GameCore {
    constructor(username) {
        this.username = username;
        this.player = {
            level: 1,
            exp: 0,
            equipped: null
        };
        this.money = 0;
        this.item_storage = [];
        this.recycled_ids = [];
        this.mold_level = 1;
        this.luck_level = 1;
        this.level_exp = 0;
        this.item_id_counter = 0;
        
        // Multipliers
        this.mold_mult = 1;
        this.luck_multiplier = 1;
        this.enemy_luck_multiplier = 1;
        this.player_luck_multiplier = 1;
        
        // Costs
        this.mold_cost = 3;
        this.luck_cost = 4;
        
        // Enemy system
        this.spawned_enemies = {};
        AREAS.forEach(area => {
            this.spawned_enemies[area[0]] = [];
        });
        
        // Sell area
        this.sell_area = [];
        
        // Intervals
        this.itemSpawnInterval = null;
        this.enemySpawnInterval = null;
        this.sellAreaInterval = null;
        
        // Initialize
        this.recalculate();
    }
    
    getLevelScale() {
        return 1 + (this.player.level * 0.01);
    }

    // Recalculate costs and multipliers
    recalculate() {
        this.mold_cost = Math.round(Math.pow(this.mold_level, 1.9)) + 3;
        this.luck_cost = Math.round(Math.pow(this.luck_level, 2.4)) + 5;
        this.updateLuckMult();
    }
    
    // Update luck multipliers
    updateLuckMult() {
        const levelMult = 1 + (this.player.level / 100);
        
        const PRE50_OFFSET = 1.05;
        const levelScale = this.getLevelScale();

        if (this.luck_level <= 50) {
            this.luck_multiplier = Math.round((1 + (Math.log1p(this.luck_level) - PRE50_OFFSET) * levelMult) * 100) / 100;
        } else {
            this.luck_multiplier = Math.round(Math.pow(this.luck_level, 1.01) * levelMult);
        }

        if (this.mold_level <= 50) {
            this.mold_mult = Math.round((1 + (Math.log1p(this.mold_level) - PRE50_OFFSET) * levelMult) * 100) / 100;
        } else {
            this.mold_mult = Math.round(Math.pow(this.mold_level, 1.015) * levelMult);
        }
        
        this.luck_multiplier = Number((Math.round(this.luck_multiplier * levelScale * 100) / 100).toFixed(2));
        this.mold_mult = Number((Math.round(this.mold_mult * levelScale * 100) / 100).toFixed(2));
        this.enemy_luck_multiplier = Math.round((Math.pow(levelMult, 2.5) - 1 + 1) * 100) / 100;
        this.player_luck_multiplier = levelMult;
    }
    
    // Check for level up
    checkLevelUp() {
        let levelsGained = 0;
        while (this.player.exp >= this.requiredExp(this.player.level)) {
            this.player.exp -= this.requiredExp(this.player.level);
            this.player.level += 1;
            levelsGained += 1;
        }
        if (levelsGained > 0) {
            this.updateLuckMult();
            return levelsGained;
        }
        return 0;
    }
    
    // Required EXP for level
    requiredExp(level) {
        const baseExp = 100;
        return Math.floor(baseExp * Math.pow(level, 1.05));
    }
    
    // Item generation
    rngGen() {
        const maxRarityRoll = Math.floor(MAXIMUM_VALUE / Math.max(1, this.luck_multiplier));
        const maxMoldRoll = Math.floor(MAXIMUM_VALUE / Math.max(1, this.mold_mult));
        
        const rarityRoll = Math.floor(Math.random() * Math.max(1, maxRarityRoll)) + 1;
        const moldRoll = Math.floor(Math.random() * Math.max(1, maxMoldRoll)) + 1;
        
        const rarityResult = getTier(rarityRoll, RARITY_TIERS, this.luck_multiplier);
        const moldResult = getTier(moldRoll, MOLD_TIERS, this.mold_mult);
        
        const rarityPriceMultiplier = rarityResult.values[0];
        const rarityDamageMultiplier = rarityResult.values[1];
        const moldPriceMultiplier = moldResult.values[0];
        
        const rarity = [rarityResult.range_end, rarityResult.tier, rarityPriceMultiplier, rarityDamageMultiplier];
        const moldInfo = [moldResult.range_end, moldResult.tier, moldPriceMultiplier];
        
        // Overall RNG calculation
        const overallRarity = maxRarityRoll / rarityRoll;
        const overallMold = maxMoldRoll / moldRoll;
        const combinedOverall = overallRarity * overallMold;
        
        const combinedActual = combinedOverall < 1000 ? Math.round(combinedOverall * 10) / 10 : Math.round(combinedOverall);
        
        return { rarityResult, moldResult, combinedActual, rarity, moldInfo };
    }
    
    // Get weapon
    getWeapon() {
        const availableWeapons = WEAPON_TYPES.filter(weapon => weapon[4] <= this.mold_level);
        return availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
    }
    
    // Generate item
    itemGen() {
        const weaponData = this.getWeapon();
        const weapon = weaponData[0];
        const weaponBaseDamage = weaponData[2];
        const weaponBaseDefense = weaponData[3];
        
        const { rarityResult, moldResult, combinedActual, rarity, moldInfo } = this.rngGen();
        
        const basePrice = 4.5;
        const rarityMult = rarity[2] * 0.95;
        const moldMultPrice = moldInfo[2];
        const costScale = getRarityCostScaling(rarity[1]);
        const price = basePrice * rarityMult * moldMultPrice * costScale;
        
        const damage = weaponBaseDamage * rarity[3];
        const defense = weaponBaseDefense * (rarity[3] * 0.5);
        
        let itemId;
        if (this.recycled_ids.length > 0) {
            itemId = this.recycled_ids.pop();
        } else {
            itemId = this.item_id_counter;
            this.item_id_counter += 1;
        }
        
        const itemInfo = {
            ID: itemId,
            RNG: combinedActual,
            Mold: String(moldInfo[1]),
            Rarity: String(rarity[1]),
            Price: price,
            Weapon: weapon,
            Damage: damage,
            Defense: defense,
        };
        
        if (combinedActual < gameSettings.auto_sell_threshold) {
            this.sell_area.push({
                item: itemInfo,
                time_added: Date.now() / 1000,
                timer: 30
            });
        } else {
            this.item_storage.push(itemInfo);
        }
        
        return { itemInfo, combinedActual, rarityResult, moldResult };
    }
    
    // Enemy loot generation
    enemyLoot(enemy) {
        const enemyRarityIndex = RARITY_TIERS.findIndex(r => r[0] === enemy.name);
        const rarityData = enemyRarityIndex >= 0 ? RARITY_TIERS[enemyRarityIndex] : RARITY_TIERS[RARITY_TIERS.length - 1];
        const [rarityName, enemyRng, priceMult, damageMult] = rarityData;
        
        const availableWeapons = WEAPON_TYPES.filter(w => w[4] <= this.mold_level);
        const weaponChoice = availableWeapons[Math.floor(Math.random() * availableWeapons.length)][0];
        
        const damageBase = WEAPON_TYPES.find(w => w[0] === weaponChoice)[2];
        const defenseBase = WEAPON_TYPES.find(w => w[0] === weaponChoice)[3];
        
        const maxMoldIndex = MAXIMUM_VALUE;
        const moldIndex = Math.floor(Math.random() * Math.max(1, Math.floor(maxMoldIndex / ((this.mold_mult > 0 ? this.mold_mult : 1) * this.player_luck_multiplier))));
        const moldResult = getTier(moldIndex, MOLD_TIERS, this.mold_mult);
        const moldMultPrice = moldResult.values[0];
        
        let itemId;
        if (this.recycled_ids.length > 0) {
            itemId = this.recycled_ids.pop();
        } else {
            itemId = this.item_id_counter;
            this.item_id_counter += 1;
        }
        
        const costScale = getRarityCostScaling(rarityName);
        return {
            ID: itemId,
            RNG: enemy.RNG,
            Mold: moldResult.tier,
            Rarity: rarityName,
            Price: 5 * priceMult * moldMultPrice * costScale,
            Weapon: weaponChoice,
            Damage: damageBase * damageMult,
            Defense: defenseBase * (damageMult * 0.5),
        };
    }
    
    // Combat system
    fightEnemy(areaName, enemy, dropItems) {
        let playerHealth = 100;
        let enemyHealth = enemy.health;
        const weapon = this.player.equipped;
        
        while (playerHealth > 0 && enemyHealth > 0) {
            const damageDealt = Math.floor(weapon.Damage);
            enemyHealth -= damageDealt;
            
            if (enemyHealth <= 0) {
                this.money += enemy.cash;
                this.player.exp += enemy.exp;
                const levelsGained = this.checkLevelUp();
                
                // Remove enemy
                const enemyIndex = this.spawned_enemies[areaName].findIndex(e => e === enemy);
                if (enemyIndex >= 0) {
                    this.spawned_enemies[areaName].splice(enemyIndex, 1);
                }
                
                // Drop item if elite or champions hall
                if (enemy.Elite || areaName === "Champions Hall") {
                    const drop = this.enemyLoot(enemy);
                    this.item_storage.push(drop);
                    return { 
                        victory: true, 
                        exp: enemy.exp, 
                        cash: enemy.cash, 
                        levelsGained,
                        drop: drop 
                    };
                }
                
                return { 
                    victory: true, 
                    exp: enemy.exp, 
                    cash: enemy.cash, 
                    levelsGained 
                };
            }
            
            const enemyAttack = enemy.damage;
            const damageTaken = Math.max(0, Math.floor(enemyAttack / weapon.Defense));
            playerHealth -= damageTaken;
            
            if (playerHealth <= 0) {
                return { victory: false, message: `You were defeated by the ${enemy.name}!` };
            }
        }
        
        return { victory: false, message: "Combat ended unexpectedly." };
    }
    
    // Upgrade system
    upgradeMold(amount) {
        if (amount <= 0) return { success: false, message: "Invalid amount." };
        
        let totalCost = 0;
        let tempLevel = this.mold_level;
        for (let i = 0; i < amount; i++) {
            totalCost += Math.round(Math.pow(tempLevel, 1.9)) + 3;
            tempLevel += 1;
        }
        
        if (this.money < totalCost) {
            return { success: false, message: "Not enough money!" };
        }
        
        for (let i = 0; i < amount; i++) {
            this.mold_level += 1;
            this.money -= this.mold_cost;
            this.mold_cost = Math.round(Math.pow(this.mold_level, 1.9)) + 3;
        }
        
        this.updateLuckMult();
        return { success: true, message: `Upgraded mold level ${amount} times!` };
    }
    
    upgradeLuck(amount) {
        if (amount <= 0) return { success: false, message: "Invalid amount." };
        
        let totalCost = 0;
        let tempLevel = this.luck_level;
        for (let i = 0; i < amount; i++) {
            totalCost += Math.round(Math.pow(tempLevel, 2.1)) + 4;
            tempLevel += 1;
        }
        
        if (this.money < totalCost) {
            return { success: false, message: "Not enough money!" };
        }
        
        for (let i = 0; i < amount; i++) {
            this.luck_level += 1;
            this.money -= this.luck_cost;
            this.luck_cost = Math.round(Math.pow(this.luck_level, 2.1)) + 4;
        }
        
        this.updateLuckMult();
        return { success: true, message: `Upgraded luck level ${amount} times!` };
    }
    
    // Process sell area
    processSellArea() {
        const currentTime = Date.now() / 1000;
        const soldItems = [];
        let soldSomething = false;
        
        for (let i = this.sell_area.length - 1; i >= 0; i--) {
            const entry = this.sell_area[i];
            if (currentTime >= entry.time_added + entry.timer) {
                const item = entry.item;
                const expMult = this.rarityExpMult(item.Rarity) * this.moldExpMult(item.Mold);
                this.money += item.Price;
                this.player.exp += item.Price * expMult;
                const levelsGained = this.checkLevelUp();
                soldItems.push({ item, levelsGained });
                this.recycled_ids.push(item.ID);
                this.sell_area.splice(i, 1);
                soldSomething = true;
            }
        }
        
        if (soldSomething) {
            this.saveGame();
        }
        
        return soldItems;
    }
    
    // EXP multipliers
    rarityExpMult(rarityName) {
        const rarity = RARITY_TIERS.find(r => r[0] === rarityName);
        return rarity ? rarity[4] : 1;
    }
    
    moldExpMult(moldName) {
        const mold = MOLD_TIERS.find(m => m[0] === moldName);
        return mold ? mold[3] : 1;
    }
    
    // Save game
    saveGame() {
        const key = `gameData_${this.username}`;
        let existingData = {};
        try {
            existingData = JSON.parse(localStorage.getItem(key)) || {};
        } catch (error) {
            console.warn('Existing game data is invalid JSON; starting with fresh data.', error);
        }

        const mergedData = {
            ...existingData,
            player: this.player,
            money: this.money,
            item_storage: this.item_storage,
            recycled_ids: this.recycled_ids,
            mold_level: this.mold_level,
            luck_level: this.luck_level,
            auto_sell_threshold: (typeof gameSettings !== 'undefined' && gameSettings) ? gameSettings.auto_sell_threshold : 100,
            level_exp: this.level_exp,
            item_id_counter: this.item_id_counter,
            sell_area: this.sell_area,
            schema_version: GAME_DATA_SCHEMA_VERSION
        };

        localStorage.setItem(key, JSON.stringify(mergedData));
        if (gameSettings) {
            gameSettings.saveSettings(this.username);
        }
        return true;
    }
    
    // Load game
    loadGame() {
        const key = `gameData_${this.username}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const defaultData = getDefaultGameData();
                const data = { ...defaultData, ...parsed };

                this.player = data.player || { level: 1, exp: 0, equipped: null };
                this.money = typeof data.money === 'number' ? data.money : defaultData.money;
                this.item_storage = Array.isArray(data.item_storage) ? data.item_storage : [];
                this.recycled_ids = Array.isArray(data.recycled_ids) ? data.recycled_ids : [];
                this.mold_level = typeof data.mold_level === 'number' ? data.mold_level : defaultData.mold_level;
                this.luck_level = typeof data.luck_level === 'number' ? data.luck_level : defaultData.luck_level;
                this.level_exp = typeof data.level_exp === 'number' ? data.level_exp : defaultData.level_exp;
                this.item_id_counter = typeof data.item_id_counter === 'number' ? data.item_id_counter : defaultData.item_id_counter;
                this.sell_area = Array.isArray(data.sell_area) ? data.sell_area : [];

                if (gameSettings && typeof data.auto_sell_threshold === 'number') {
                    gameSettings.auto_sell_threshold = data.auto_sell_threshold;
                }

                this.recalculate();
                return true;
            } catch (error) {
                console.error('Failed to load saved game data:', error);
            }
        }
        return false;
    }
    
    // Start game loops
    startGameLoops() {
        // Item spawn loop (every 5 seconds)
        this.itemSpawnInterval = setInterval(() => {
            this.itemGen();
            if (typeof updateItemDisplay === 'function') {
                updateItemDisplay();
            }
        }, 5000);
        
        // Enemy spawn loop (every 5 seconds)
        this.enemySpawnInterval = setInterval(() => {
            AREAS.forEach(area => {
                const enemy = generateEnemy(area, this.enemy_luck_multiplier);
                this.spawned_enemies[area[0]].push(enemy);
                this.spawned_enemies[area[0]] = sortEnemiesByRarity(this.spawned_enemies[area[0]]);
            });
            this.spawned_enemies = removeExpiredEnemies(this.spawned_enemies);
            if (typeof updateEnemyDisplay === 'function') {
                updateEnemyDisplay();
            }
        }, 5000);
        
        // Sell area processing (every 0.5 seconds)
        this.sellAreaInterval = setInterval(() => {
            const soldItems = this.processSellArea();
            if (soldItems.length > 0 && typeof updateSellAreaDisplay === 'function') {
                updateSellAreaDisplay();
            }
        }, 500);
        
        // Remove expired enemies periodically
        setInterval(() => {
            this.spawned_enemies = removeExpiredEnemies(this.spawned_enemies);
        }, 1000);
    }
    
    // Stop game loops
    stopGameLoops() {
        if (this.itemSpawnInterval) {
            clearInterval(this.itemSpawnInterval);
            this.itemSpawnInterval = null;
        }
        if (this.enemySpawnInterval) {
            clearInterval(this.enemySpawnInterval);
            this.enemySpawnInterval = null;
        }
        if (this.sellAreaInterval) {
            clearInterval(this.sellAreaInterval);
            this.sellAreaInterval = null;
        }
    }
}

// Global game instance (will be initialized in game-ui.js)
let gameCore = null;
let gameSettings = null;

// Verify dependencies are loaded
if (typeof RARITY_TIERS === 'undefined') {
    console.error('RARITY_TIERS not found! Make sure game-config.js is loaded before game-core.js');
}
if (typeof MOLD_TIERS === 'undefined') {
    console.error('MOLD_TIERS not found! Make sure game-config.js is loaded before game-core.js');
}
if (typeof WEAPON_TYPES === 'undefined') {
    console.error('WEAPON_TYPES not found! Make sure game-config.js is loaded before game-core.js');
}
if (typeof AREAS === 'undefined') {
    console.error('AREAS not found! Make sure game-enemies.js is loaded before game-core.js');
}
if (typeof generateEnemy === 'undefined') {
    console.error('generateEnemy function not found! Make sure game-enemies.js is loaded before game-core.js');
}

// Verify GameCore class is defined and make it globally accessible
if (typeof GameCore !== 'undefined') {
    console.log('GameCore class loaded successfully');
    // Ensure it's on window object for global access
    if (typeof window !== 'undefined') {
        window.GameCore = GameCore;
    }
} else {
    console.error('GameCore class failed to load! Check for JavaScript errors above.');
}

