// ============================================
// GAME ENEMIES - Enemy System
// ============================================

// Enemy base stats
const ENEMY_BASE_HEALTH = 50;
const ENEMY_BASE_EXP = 20;
const ENEMY_BASE_CASH = 50;
const ENEMY_BASE_DAMAGE = 5;

// Stores: name, chance threshold, health multiplier, damage multiplier, EXP mult, Cash mult
const ENEMY_RARITIES = [
    ["Zenith", Math.floor(MAXIMUM_VALUE / 20000000), 10000, 500, 100, 120],
    ["Universal", Math.floor(MAXIMUM_VALUE / 950000), 4000, 200, 50, 60],
    ["Cosmic", Math.floor(MAXIMUM_VALUE / 650000), 1000, 150, 20, 25],
    ["Divine", Math.floor(MAXIMUM_VALUE / 400000), 750, 100, 13, 16],
    ["Mythical+2", Math.floor(MAXIMUM_VALUE / 120000), 500, 80, 10, 12],
    ["Mythical+1", Math.floor(MAXIMUM_VALUE / 70000), 550, 65, 7.75, 9],
    ["Mythical", Math.floor(MAXIMUM_VALUE / 25000), 300, 40, 6, 7],
    ["Legendary+2", Math.floor(MAXIMUM_VALUE / 10000), 100, 27.25, 4.5, 6],
    ["Legendary+1", Math.floor(MAXIMUM_VALUE / 5000), 75, 20, 4, 5],
    ["Legendary", Math.floor(MAXIMUM_VALUE / 1250), 50, 15, 3.25, 4.5],
    ["Epic+2", Math.floor(MAXIMUM_VALUE / 700), 35, 9, 2.5, 3.5],
    ["Epic+1", Math.floor(MAXIMUM_VALUE / 275), 25, 6.75, 2.25, 3],
    ["Epic", Math.floor(MAXIMUM_VALUE / 150), 17.75, 5, 2.1, 2.5],
    ["Rare+2", Math.floor(MAXIMUM_VALUE / 100), 10, 4, 1.8, 2.2],
    ["Rare+1", Math.floor(MAXIMUM_VALUE / 50), 8.6, 3.25, 1.65, 2],
    ["Rare", Math.floor(MAXIMUM_VALUE / 45), 7, 2.5, 1.5, 1.8],
    ["Uncommon+2", Math.floor(MAXIMUM_VALUE / 20), 5.5, 2, 1.2, 1.5],
    ["Uncommon+1", Math.floor(MAXIMUM_VALUE / 10), 4.2, 1.7, 1.15, 1.3],
    ["Uncommon", Math.floor(MAXIMUM_VALUE / 6), 3.75, 1.5, 1.1, 1.2],
    ["Common+2", Math.floor(MAXIMUM_VALUE / 2), 2, 1.25, 1.05, 1.1],
    ["Common+1", Math.floor(MAXIMUM_VALUE / 1.5), 1.875, 1.1, 1.03, 1.05],
    ["Common", Math.floor(MAXIMUM_VALUE / 1), 1.5, 1, 1, 1.0],
];

// Stores: name, luck multiplier, elite multiplier, level requirement, drop items on death
const AREAS = [
    ["Champions Hall", 10000, 1, 100, true],
    ["Elite Hall", 400, 1000, 60, true],
    ["Adept Hall", 40, 500, 25, false],
    ["Beginner Hall", 5, 10, 1, false],
];

// Enemy generation function
function generateEnemy(areaChoice, enemyLuckMultiplier) {
    const [areaName, areaLuckMultiplier, areaEliteMultiplier, areaLevelRequirement, areaDropItems] = areaChoice;
    
    const luck = enemyLuckMultiplier * areaLuckMultiplier;
    const maxRoll = Math.floor(MAXIMUM_VALUE / Math.max(1, luck));
    const eliteMaxRoll = 1000;
    
    const roll = Math.floor(Math.random() * Math.max(1, maxRoll)) + 1;
    const rng = maxRoll / roll;
    
    const eliteRoll = Math.floor(Math.random() * Math.max(1, Math.floor(eliteMaxRoll / Math.max(1, areaEliteMultiplier)))) + 1;
    
    const enemyRarity = getTier(roll, ENEMY_RARITIES, luck);
    const name = enemyRarity.tier;
    const [healthMultiplier, damageMultiplier, expMultiplier, cashMultiplier] = enemyRarity.values;
    
    let isElite = eliteRoll === 1;
    let finalHealthMult = healthMultiplier;
    let finalDamageMult = damageMultiplier;
    let finalExpMult = expMultiplier;
    let finalCashMult = cashMultiplier;
    
    if (isElite) {
        finalHealthMult *= 20;
        finalDamageMult *= 10;
        finalExpMult *= 20;
        finalCashMult *= 35;
    }
    
    if (areaName === "Champions Hall") {
        finalHealthMult *= 200;
        finalDamageMult *= 200;
        finalExpMult *= 750;
        finalCashMult *= 1500;
    }
    
    // Despawn timer calculation
    const rarityIndex = ENEMY_RARITIES.findIndex(r => r[0] === name);
    const rarityScale = ENEMY_RARITIES.length - rarityIndex;
    const despawnTimer = Math.floor(120 * Math.log(rarityScale + 5) / Math.log(1.2));
    
    const enemyInfo = {
        name: name,
        Elite: isElite,
        health: Math.floor(ENEMY_BASE_HEALTH * finalHealthMult),
        damage: Math.floor(ENEMY_BASE_DAMAGE * finalDamageMult),
        exp: Math.floor(ENEMY_BASE_EXP * finalExpMult),
        cash: Math.floor(ENEMY_BASE_CASH * finalCashMult),
        RNG: rng,
        spawn_time: Date.now() / 1000,
        despawn_timer: despawnTimer
    };
    
    if (rng >= 10000 && areaName !== "Champions Hall") {
        console.log(`An Elite ${name} enemy spawned in ${areaName}! RNG: 1 in ${rng * (eliteMaxRoll / areaEliteMultiplier)}`);
    } else if (rng >= 10000 && areaName === "Champions Hall") {
        console.log(`A ${name} Champion spawned in ${areaName}! RNG: 1 in ${rng}`);
    }
    
    return enemyInfo;
}

// Remove expired enemies
function removeExpiredEnemies(spawnedEnemies) {
    const currentTime = Date.now() / 1000;
    
    for (const area in spawnedEnemies) {
        spawnedEnemies[area] = spawnedEnemies[area].filter(enemy => {
            return (currentTime - enemy.spawn_time) <= enemy.despawn_timer;
        });
    }
    
    return spawnedEnemies;
}

// Sort enemies by rarity
function sortEnemiesByRarity(enemies) {
    const rarityOrder = {};
    ENEMY_RARITIES.forEach((rarity, index) => {
        rarityOrder[rarity[0]] = index;
    });
    
    return enemies.sort((a, b) => rarityOrder[a.name] - rarityOrder[b.name]);
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        ENEMY_RARITIES, 
        AREAS, 
        ENEMY_BASE_HEALTH, 
        ENEMY_BASE_EXP, 
        ENEMY_BASE_CASH, 
        ENEMY_BASE_DAMAGE,
        generateEnemy,
        removeExpiredEnemies,
        sortEnemiesByRarity
    };
}

