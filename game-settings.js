// ============================================
// GAME SETTINGS - User Settings Management
// ============================================

class GameSettings {
    constructor() {
        this.auto_sell_threshold = 100;
        this.storage_sort = "Price"; // Options: "Rarity", "Price", "Damage", "Defense", "RNG"
    }
    
    // Load settings from localStorage
    loadSettings(username) {
        const saved = localStorage.getItem(`gameSettings_${username}`);
        if (saved) {
            const settings = JSON.parse(saved);
            this.auto_sell_threshold = settings.auto_sell_threshold || 100;
            this.storage_sort = settings.storage_sort || "Price";
        }
    }
    
    // Save settings to localStorage
    saveSettings(username) {
        const settings = {
            auto_sell_threshold: this.auto_sell_threshold,
            storage_sort: this.storage_sort
        };
        localStorage.setItem(`gameSettings_${username}`, JSON.stringify(settings));
    }
    
    // Get settings object
    getSettings() {
        return {
            auto_sell_threshold: this.auto_sell_threshold,
            storage_sort: this.storage_sort
        };
    }
    
    // Update auto sell threshold
    setAutoSellThreshold(threshold) {
        if (typeof threshold === 'number' && threshold > 0) {
            this.auto_sell_threshold = threshold;
            return true;
        }
        return false;
    }
    
    // Update storage sort
    setStorageSort(sortType) {
        const validSorts = ["Rarity", "Price", "Damage", "Defense", "RNG"];
        if (validSorts.includes(sortType)) {
            this.storage_sort = sortType;
            return true;
        }
        return false;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameSettings };
}

// Ensure GameSettings is globally accessible
if (typeof window !== 'undefined') {
    window.GameSettings = GameSettings;
    console.log('GameSettings class loaded successfully');
}

