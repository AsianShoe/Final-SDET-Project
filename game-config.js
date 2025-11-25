// ============================================
// GAME CONFIGURATION - Item Classification
// ============================================

const MAXIMUM_VALUE = Math.pow(10, 20);

// (Name, Threshold, Price Multiplier, Damage multiplier, EXP multiplier)
const RARITY_TIERS = [
    ["Zenith", Math.floor(MAXIMUM_VALUE / 20000000), 10000, 500, 100],
    ["Universal", Math.floor(MAXIMUM_VALUE / 950000), 4000, 200, 50],
    ["Cosmic", Math.floor(MAXIMUM_VALUE / 650000), 1000, 150, 20],
    ["Divine", Math.floor(MAXIMUM_VALUE / 400000), 750, 100, 13],
    ["Mythical+2", Math.floor(MAXIMUM_VALUE / 120000), 500, 80, 10],
    ["Mythical+1", Math.floor(MAXIMUM_VALUE / 70000), 550, 65, 7.75],
    ["Mythical", Math.floor(MAXIMUM_VALUE / 25000), 300, 40, 6],
    ["Legendary+2", Math.floor(MAXIMUM_VALUE / 10000), 100, 27.25, 4.5],
    ["Legendary+1", Math.floor(MAXIMUM_VALUE / 5000), 75, 20, 4],
    ["Legendary", Math.floor(MAXIMUM_VALUE / 1250), 50, 15, 3.25],
    ["Epic+2", Math.floor(MAXIMUM_VALUE / 700), 35, 26, 2.5],
    ["Epic+1", Math.floor(MAXIMUM_VALUE / 275), 25, 20.25, 2.25],
    ["Epic", Math.floor(MAXIMUM_VALUE / 150), 17.75, 15, 2.1],
    ["Rare+2", Math.floor(MAXIMUM_VALUE / 100), 10, 10, 1.8],
    ["Rare+1", Math.floor(MAXIMUM_VALUE / 50), 8.6, 6.5, 1.65],
    ["Rare", Math.floor(MAXIMUM_VALUE / 45), 7, 4, 1.5],
    ["Uncommon+2", Math.floor(MAXIMUM_VALUE / 20), 5.5, 2, 1.2],
    ["Uncommon+1", Math.floor(MAXIMUM_VALUE / 10), 4.2, 1.7, 1.15],
    ["Uncommon", Math.floor(MAXIMUM_VALUE / 6), 3.75, 1.5, 1.1],
    ["Common+2", Math.floor(MAXIMUM_VALUE / 2), 2, 1.25, 1.05],
    ["Common+1", Math.floor(MAXIMUM_VALUE / 1.5), 1.875, 1.1, 1.03],
    ["Common", Math.floor(MAXIMUM_VALUE / 1), 1.5, 1, 1],
];

const MOLD_TIERS = [
    ["Heavenly", Math.floor(MAXIMUM_VALUE / 1250000), 625, 350],
    ["Hallowed", Math.floor(MAXIMUM_VALUE / 500000), 200, 120],
    ["Onyx", Math.floor(MAXIMUM_VALUE / 90000), 90, 50],
    ["Diamond", Math.floor(MAXIMUM_VALUE / 25000), 50, 20],
    ["Amethyst", Math.floor(MAXIMUM_VALUE / 5000), 15, 9.5],
    ["Gold", Math.floor(MAXIMUM_VALUE / 750), 9, 6],
    ["Silver", Math.floor(MAXIMUM_VALUE / 100), 5, 3.5],
    ["Iron", Math.floor(MAXIMUM_VALUE / 20), 3, 2],
    ["Bronze", Math.floor(MAXIMUM_VALUE / 5), 1.75, 1.5],
    ["Copper", Math.floor(MAXIMUM_VALUE / 1), 1.2, 1.2],
];

// Weapon types: "Type", "ID", "Base Damage", "Base Defense", "Mold Level Required"
const WEAPON_TYPES = [
    ["Sword", 1, 4, 10, 0],
    ["Sniper", 2, 20, 5, 10],
    ["Bomb", 3, 10, 6, 20],
    ["Molotov", 4, 10, 6, 50],
    ["Car", 5, 10, 6, 50],
    ["Scythe", 6, 10, 6, 100],
    ["Train", 7, 10, 6, 100],
    ["Lance", 8, 10, 6, 250],
];

// Helper function to determine tier
function getTier(roll, tiers, luckMultiplier) {
    const totalRange = Math.floor(MAXIMUM_VALUE / (luckMultiplier > 0 ? luckMultiplier : 1));
    
    for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        const name = tier[0];
        const threshold = tier[1];
        const prev = i > 0 ? tiers[i - 1][1] : 0;
        const extras = tier.slice(2);
        
        if (prev < roll && roll <= threshold) {
            return {
                tier: name,
                rng_roll: roll,
                range_start: Math.floor(prev),
                range_end: Math.floor(threshold),
                values: extras
            };
        }
    }
    
    // Return lowest tier if no match
    const lastTier = tiers[tiers.length - 1];
    return {
        tier: lastTier[0],
        rng_roll: roll,
        range_start: tiers.length > 1 ? tiers[tiers.length - 2][1] : 0,
        range_end: lastTier[1],
        values: lastTier.slice(2)
    };
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RARITY_TIERS, MOLD_TIERS, WEAPON_TYPES, MAXIMUM_VALUE, getTier };
}

