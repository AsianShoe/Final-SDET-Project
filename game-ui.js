// ============================================
// GAME UI - User Interface Components
// ============================================

// Get color for rarity tier
function getRarityColor(rarityName) {
    // Extract base rarity name (handle +1, +2 variants)
    const baseRarity = rarityName.replace(/\+[0-9]+$/, '').trim();
    
    const colorMap = {
        'Common': '#808080',      // Gray
        'Uncommon': '#32CD32',    // Lime Green
        'Rare': '#1E90FF',        // Dodger Blue
        'Epic': '#9370DB',        // Medium Purple
        'Legendary': '#FFD700',   // Gold
        'Mythical': '#DC143C',    // Crimson
        'Divine': '#F0F8FF',      // Alice Blue (whitish/divine)
        'Cosmic': '#4B0082',      // Indigo
        'Universal': '#FF1493',   // Deep Pink
        'Zenith': '#FFD700'       // Gold (highest tier)
    };
    
    // Return color if found, otherwise default to gray
    return colorMap[baseRarity] || '#808080';
}

// Initialize game UI
function initializeGameUI(username) {
    if (!username) {
        console.error("No username provided for game initialization");
        return;
    }
    
    try {
        console.log('Initializing game for user:', username);
        console.log('Checking for classes and dependencies...');
        console.log('GameSettings:', typeof GameSettings);
        console.log('GameCore:', typeof GameCore);
        console.log('RARITY_TIERS:', typeof RARITY_TIERS !== 'undefined' ? 'loaded' : 'NOT FOUND');
        console.log('MOLD_TIERS:', typeof MOLD_TIERS !== 'undefined' ? 'loaded' : 'NOT FOUND');
        console.log('WEAPON_TYPES:', typeof WEAPON_TYPES !== 'undefined' ? 'loaded' : 'NOT FOUND');
        console.log('AREAS:', typeof AREAS !== 'undefined' ? 'loaded' : 'NOT FOUND');
        console.log('generateEnemy:', typeof generateEnemy !== 'undefined' ? 'loaded' : 'NOT FOUND');
        console.log('getTier:', typeof getTier !== 'undefined' ? 'loaded' : 'NOT FOUND');
        
        // Initialize settings and game core
        if (typeof GameSettings === 'undefined') {
            throw new Error('GameSettings class not found. Make sure game-settings.js is loaded.');
        }
        gameSettings = new GameSettings();
        gameSettings.loadSettings(username);
        
        if (typeof GameCore === 'undefined') {
            throw new Error('GameCore class not found. Make sure game-core.js is loaded.');
        }
        gameCore = new GameCore(username);
        gameCore.loadGame();
        
        // Build UI
        buildGameUI();
        
        // Set up event handlers
        setupEventHandlers();
        
        // Start game loops
        gameCore.startGameLoops();
        
        // Initial display update
        updateAllDisplays();
        
        // Auto-save every 30 seconds
        setInterval(() => {
            if (gameCore) {
                gameCore.saveGame();
            }
        }, 30000);
        
        console.log('Game initialized successfully');
    } catch (error) {
        console.error('Error initializing game:', error);
        const gamePage = document.getElementById('game-page');
        if (gamePage) {
            gamePage.innerHTML = `
                <div class="game-container">
                    <h2>RNG Game</h2>
                    <p style="color: red;">Error initializing game: ${error.message}</p>
                    <p>Please check the browser console for more details.</p>
                    <button class="game-btn" onclick="location.reload()">Reload Page</button>
                </div>
            `;
        }
    }
}

// Build game UI structure
function buildGameUI() {
    const gamePage = document.getElementById('game-page');
    if (!gamePage) {
        console.error('Game page element not found');
        return;
    }
    
    console.log('Building game UI...');
    
    // Clear any existing content (including placeholder)
    gamePage.innerHTML = '';
    
    // Build the game UI
    const gameHTML = `
        <div class="game-container">
            <div class="game-header">
                <h2>RNG Game</h2>
            </div>
            
            <div class="game-main-simple">
                <div class="game-stats-panel-simple">
                    <h3>Player Stats</h3>
                    <div id="player-stats-display"></div>
                </div>
                
                <div class="game-menu-buttons">
                    <button id="btn-storage" class="game-menu-btn">Storage</button>
                    <button id="btn-sell-area" class="game-menu-btn">Sell Area</button>
                    <button id="btn-upgrades" class="game-menu-btn">Upgrades</button>
                    <button id="btn-areas" class="game-menu-btn">Areas</button>
                    <button id="btn-equip" class="game-menu-btn">Equip Weapon</button>
                    <button id="btn-settings" class="game-menu-btn">Settings</button>
                </div>
                
                <div class="game-content-simple">
                    <div id="game-main-display">
                        <div class="welcome-message">
                            <h3>Welcome to the RNG Game!</h3>
                            <p>Items are being generated every 5 seconds.</p>
                            <p>Enemies spawn in areas every 5 seconds.</p>
                            <p>Click the buttons above to access different menus.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Modals -->
        <div id="storage-modal" class="game-modal">
            <div class="game-modal-content">
                <span class="game-modal-close">&times;</span>
                <h3>Storage</h3>
                <div id="storage-display"></div>
            </div>
        </div>
        
        <div id="sell-area-modal" class="game-modal">
            <div class="game-modal-content">
                <span class="game-modal-close">&times;</span>
                <h3>Sell Area</h3>
                <div id="sell-area-display"></div>
            </div>
        </div>
        
        <div id="upgrades-modal" class="game-modal">
            <div class="game-modal-content">
                <span class="game-modal-close">&times;</span>
                <h3>Upgrades</h3>
                <div id="upgrades-display"></div>
            </div>
        </div>
        
        <div id="areas-modal" class="game-modal">
            <div class="game-modal-content">
                <span class="game-modal-close">&times;</span>
                <h3>Areas</h3>
                <div id="areas-display"></div>
            </div>
        </div>
        
        <div id="equip-modal" class="game-modal">
            <div class="game-modal-content">
                <span class="game-modal-close">&times;</span>
                <h3>Equip Weapon</h3>
                <div id="equip-display"></div>
            </div>
        </div>
        
        <div id="settings-modal" class="game-modal">
            <div class="game-modal-content">
                <span class="game-modal-close">&times;</span>
                <h3>Settings</h3>
                <div id="settings-display"></div>
            </div>
        </div>
        
        <div id="combat-modal" class="game-modal">
            <div class="game-modal-content">
                <span class="game-modal-close">&times;</span>
                <h3>Combat</h3>
                <div id="combat-display"></div>
            </div>
        </div>
        
        <!-- Custom Notification Modal -->
        <div id="notification-modal" class="game-modal">
            <div class="game-modal-content notification-content">
                <div id="notification-message"></div>
                <button id="notification-ok-btn" class="game-btn">OK</button>
            </div>
        </div>
        
        <!-- Custom Confirmation Modal -->
        <div id="confirmation-modal" class="game-modal">
            <div class="game-modal-content confirmation-content">
                <div id="confirmation-message"></div>
                <div class="confirmation-buttons">
                    <button id="confirmation-yes-btn" class="game-btn">Yes</button>
                    <button id="confirmation-no-btn" class="game-btn game-btn-secondary">No</button>
                </div>
            </div>
        </div>
    `;
    
    gamePage.innerHTML = gameHTML;
    console.log('Game UI HTML assigned successfully');
}

// Setup event handlers
function setupEventHandlers() {
    console.log('Setting up event handlers...');
    
    // Main action buttons - use event delegation for reliability
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
        gameContainer.addEventListener('click', (e) => {
            if (e.target.id === 'btn-storage' || e.target.closest('#btn-storage')) {
                e.preventDefault();
                showStorage();
            } else if (e.target.id === 'btn-sell-area' || e.target.closest('#btn-sell-area')) {
                e.preventDefault();
                showSellArea();
            } else if (e.target.id === 'btn-upgrades' || e.target.closest('#btn-upgrades')) {
                e.preventDefault();
                showUpgrades();
            } else if (e.target.id === 'btn-areas' || e.target.closest('#btn-areas')) {
                e.preventDefault();
                showAreas();
            } else if (e.target.id === 'btn-equip' || e.target.closest('#btn-equip')) {
                e.preventDefault();
                showEquip();
            } else if (e.target.id === 'btn-settings' || e.target.closest('#btn-settings')) {
                e.preventDefault();
                showSettings();
            }
        });
    }
    
    // Also set up direct listeners as backup
    const btnStorage = document.getElementById('btn-storage');
    const btnSellArea = document.getElementById('btn-sell-area');
    const btnUpgrades = document.getElementById('btn-upgrades');
    const btnAreas = document.getElementById('btn-areas');
    const btnEquip = document.getElementById('btn-equip');
    const btnSettings = document.getElementById('btn-settings');
    
    if (btnStorage) btnStorage.addEventListener('click', () => showStorage());
    if (btnSellArea) btnSellArea.addEventListener('click', () => showSellArea());
    if (btnUpgrades) btnUpgrades.addEventListener('click', () => showUpgrades());
    if (btnAreas) btnAreas.addEventListener('click', () => showAreas());
    if (btnEquip) btnEquip.addEventListener('click', () => showEquip());
    if (btnSettings) btnSettings.addEventListener('click', () => showSettings());
    
    // Close modals
    document.querySelectorAll('.game-modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.game-modal').style.display = 'none';
        });
    });
    
    // Close modals when clicking outside
    document.querySelectorAll('.game-modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

// Update all displays
function updateAllDisplays() {
    updatePlayerStats();
    updateItemDisplay();
    updateEnemyDisplay();
    updateSellAreaDisplay();
}

// Update player stats display
function updatePlayerStats() {
    const display = document.getElementById('player-stats-display');
    if (!display || !gameCore) return;
    
    const expNeeded = gameCore.requiredExp(gameCore.player.level);
    display.innerHTML = `
        <div class="stat-item"><strong>Level:</strong> ${gameCore.player.level}</div>
        <div class="stat-item"><strong>EXP:</strong> ${Math.round(gameCore.player.exp)} / ${expNeeded}</div>
        <div class="stat-item"><strong>Money:</strong> $${gameCore.money.toFixed(2)}</div>
        <div class="stat-item"><strong>Rarity Level:</strong> ${gameCore.luck_level}</div>
        <div class="stat-item"><strong>Rarity Multiplier:</strong> ${gameCore.luck_multiplier}</div>
        <div class="stat-item"><strong>Mold Level:</strong> ${gameCore.mold_level}</div>
        <div class="stat-item"><strong>Mold Multiplier:</strong> ${gameCore.mold_mult}</div>
        ${gameCore.player.equipped ? `<div class="stat-item"><strong>Equipped:</strong> ${gameCore.player.equipped.Rarity} ${gameCore.player.equipped.Mold} ${gameCore.player.equipped.Weapon}</div>` : '<div class="stat-item"><strong>Equipped:</strong> None</div>'}
    `;
}

// Update item display (called when new items are generated)
function updateItemDisplay() {
    // This can show recent items or notifications
    // For now, we'll just update stats
    updatePlayerStats();
}

// Update enemy display
function updateEnemyDisplay() {
    // This can show enemy counts per area
    // For now, we'll just update when areas are viewed
}

// Update sell area display
function updateSellAreaDisplay() {
    const modal = document.getElementById('sell-area-modal');
    if (modal && modal.style.display === 'block') {
        showSellArea();
    }
}

// Show storage
function showStorage() {
    const modal = document.getElementById('storage-modal');
    const display = document.getElementById('storage-display');
    if (!modal || !display || !gameCore) return;
    
    if (gameCore.item_storage.length === 0) {
        display.innerHTML = '<p>Storage is empty.</p>';
    } else {
        // Sort storage
        const sortedStorage = [...gameCore.item_storage];
        const sortType = gameSettings.storage_sort;
        const reverseSort = sortType !== "Rarity";
        
        if (sortType === "Rarity") {
            const rarityOrder = {};
            RARITY_TIERS.forEach((rarity, index) => {
                rarityOrder[rarity[0]] = index;
            });
            sortedStorage.sort((a, b) => {
                const aIndex = rarityOrder[a.Rarity] !== undefined ? rarityOrder[a.Rarity] : 999;
                const bIndex = rarityOrder[b.Rarity] !== undefined ? rarityOrder[b.Rarity] : 999;
                return aIndex - bIndex;
            });
        } else {
            sortedStorage.sort((a, b) => {
                if (reverseSort) return b[sortType] - a[sortType];
                return a[sortType] - b[sortType];
            });
        }
        
        let html = `
            <div class="storage-controls">
                <label>Sort by: </label>
                <select id="storage-sort-select">
                    <option value="Price" ${sortType === "Price" ? "selected" : ""}>Price</option>
                    <option value="Rarity" ${sortType === "Rarity" ? "selected" : ""}>Rarity</option>
                    <option value="Damage" ${sortType === "Damage" ? "selected" : ""}>Damage</option>
                    <option value="Defense" ${sortType === "Defense" ? "selected" : ""}>Defense</option>
                    <option value="RNG" ${sortType === "RNG" ? "selected" : ""}>RNG</option>
                </select>
            </div>
            <div class="storage-list">
        `;
        
        sortedStorage.forEach(item => {
            html += `
                <div class="storage-item">
                    <div class="item-info">
                        <strong>ID: ${item.ID}</strong> - ${item.Rarity} ${item.Mold} ${item.Weapon}<br>
                        RNG: 1 in ${item.RNG} | Price: $${item.Price.toFixed(2)} | Damage: ${item.Damage} | Defense: ${item.Defense}
                    </div>
                    <div class="item-actions">
                        <button class="game-btn-small" onclick="equipItem(${item.ID})">Equip</button>
                        <button class="game-btn-small" onclick="sellItem(${item.ID})">Sell</button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        display.innerHTML = html;
        
        // Add sort change handler
        document.getElementById('storage-sort-select')?.addEventListener('change', (e) => {
            gameSettings.setStorageSort(e.target.value);
            gameSettings.saveSettings(gameCore.username);
            showStorage();
        });
    }
    
    modal.style.display = 'block';
}

// Show sell area
function showSellArea() {
    const modal = document.getElementById('sell-area-modal');
    const display = document.getElementById('sell-area-display');
    if (!modal || !display || !gameCore) return;
    
    if (gameCore.sell_area.length === 0) {
        display.innerHTML = '<p>Sell area is empty.</p>';
    } else {
        let html = '<div class="sell-area-list">';
        const currentTime = Date.now() / 1000;
        
        gameCore.sell_area.forEach(entry => {
            const item = entry.item;
            const timeRemaining = Math.max(0, Math.ceil(entry.timer - (currentTime - entry.time_added)));
            const rarityColor = getRarityColor(item.Rarity);
            html += `
                <div class="sell-area-item" style="border-color: ${rarityColor}; border-width: 2px; border-style: solid;">
                    <div class="item-info">
                        <strong style="color: ${rarityColor};">ID: ${item.ID}</strong> - <span style="color: ${rarityColor};">${item.Rarity}</span> ${item.Mold} ${item.Weapon}<br>
                        RNG: 1 in ${item.RNG} | Price: $${item.Price.toFixed(2)} | Damage: ${item.Damage} | Defense: ${item.Defense}<br>
                        <span class="time-remaining">Time before sold: ${timeRemaining}s</span>
                    </div>
                    <button class="game-btn-small" onclick="removeFromSellArea(${item.ID})">Take Out</button>
                </div>
            `;
        });
        
        html += '</div>';
        display.innerHTML = html;
    }
    
    modal.style.display = 'block';
}

// Show upgrades
function showUpgrades() {
    const modal = document.getElementById('upgrades-modal');
    const display = document.getElementById('upgrades-display');
    if (!modal || !display || !gameCore) return;
    
    gameCore.recalculate();
    
    // Calculate max upgrades
    let maxMold = 0;
    let maxLuck = 0;
    let tempCost = gameCore.mold_cost;
    let tempLevel = gameCore.mold_level;
    while (tempCost <= gameCore.money) {
        maxMold += 1;
        tempLevel += 1;
        tempCost += Math.round(Math.pow(tempLevel, 1.9)) + 3;
    }
    
    tempCost = gameCore.luck_cost;
    tempLevel = gameCore.luck_level;
    while (tempCost <= gameCore.money) {
        maxLuck += 1;
        tempLevel += 1;
        tempCost += Math.round(Math.pow(tempLevel, 2.4)) + 5;
    }
    
    display.innerHTML = `
        <div class="upgrade-section">
            <h4>Mold Upgrades</h4>
            <p>Current Level: ${gameCore.mold_level}</p>
            <p>Current Multiplier: ${gameCore.mold_mult}</p>
            <p>Cost per upgrade: $${gameCore.mold_cost}</p>
            <p>Max upgrades available: ${maxMold}</p>
            <div class="upgrade-controls">
                <input type="number" id="mold-amount" min="1" max="${maxMold}" value="1" ${maxMold === 0 ? 'disabled' : ''}>
                <button class="game-btn" onclick="purchaseMoldUpgrades()" ${maxMold === 0 ? 'disabled' : ''}>Upgrade Mold</button>
            </div>
        </div>
        
        <div class="upgrade-section">
            <h4>Rarity Upgrades</h4>
            <p>Current Level: ${gameCore.luck_level}</p>
            <p>Current Multiplier: ${gameCore.luck_multiplier}</p>
            <p>Cost per upgrade: $${gameCore.luck_cost}</p>
            <p>Max upgrades available: ${maxLuck}</p>
            <div class="upgrade-controls">
                <input type="number" id="luck-amount" min="1" max="${maxLuck}" value="1" ${maxLuck === 0 ? 'disabled' : ''}>
                <button class="game-btn" onclick="purchaseLuckUpgrades()" ${maxLuck === 0 ? 'disabled' : ''}>Upgrade Rarity</button>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
}

// Show areas
function showAreas() {
    const modal = document.getElementById('areas-modal');
    const display = document.getElementById('areas-display');
    if (!modal || !display || !gameCore) return;
    
    let html = '<div class="areas-list">';
    
    AREAS.forEach((area, index) => {
        const [areaName, areaLuckMult, areaEliteMult, levelReq, dropItems] = area;
        const enemies = gameCore.spawned_enemies[areaName] || [];
        const canEnter = gameCore.player.level >= levelReq;
        
        html += `
            <div class="area-item ${canEnter ? '' : 'disabled'}">
                <h4>${areaName}</h4>
                <p>Level Requirement: ${levelReq}</p>
                <p>Enemies Available: ${enemies.length}</p>
                <p>Luck Multiplier: ${areaLuckMult}x</p>
                ${!canEnter ? `<p class="error-text">You need to be level ${levelReq} to enter.</p>` : ''}
                <button class="game-btn" onclick="enterArea(${index})" ${!canEnter ? 'disabled' : ''}>Enter Area</button>
            </div>
        `;
    });
    
    html += '</div>';
    display.innerHTML = html;
    
    modal.style.display = 'block';
}

// Show equip
function showEquip() {
    const modal = document.getElementById('equip-modal');
    const display = document.getElementById('equip-display');
    if (!modal || !display || !gameCore) return;
    
    let html = '';
    
    if (gameCore.player.equipped) {
        const equipped = gameCore.player.equipped;
        const rarityColor = getRarityColor(equipped.Rarity);
        html += `
            <div class="equipped-item" style="border-color: ${rarityColor}; border-width: 2px; border-style: solid;">
                <h4>Currently Equipped:</h4>
                <p><strong style="color: ${rarityColor};">${equipped.Rarity}</strong> ${equipped.Mold} ${equipped.Weapon}</p>
                <p>Damage: ${equipped.Damage} | Defense: ${equipped.Defense}</p>
                <button class="game-btn" onclick="unequipWeapon()">Unequip</button>
            </div>
        `;
    }
    
    if (gameCore.item_storage.length === 0) {
        html += '<p>No weapons in storage to equip.</p>';
    } else {
        html += '<h4>Available Weapons:</h4><div class="equip-list">';
        gameCore.item_storage.forEach(item => {
            const rarityColor = getRarityColor(item.Rarity);
            html += `
                <div class="equip-item" style="border-color: ${rarityColor}; border-width: 2px; border-style: solid;">
                    <p><strong style="color: ${rarityColor};">ID: ${item.ID}</strong> - <span style="color: ${rarityColor};">${item.Rarity}</span> ${item.Mold} ${item.Weapon}</p>
                    <p>Damage: ${item.Damage} | Defense: ${item.Defense}</p>
                    <div class="item-actions">
                        <button class="game-btn-small" onclick="equipItem(${item.ID})">Equip</button>
                        <button class="game-btn-small" onclick="sellItem(${item.ID})">Sell</button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    display.innerHTML = html;
    modal.style.display = 'block';
}

// Show settings
function showSettings() {
    const modal = document.getElementById('settings-modal');
    const display = document.getElementById('settings-display');
    if (!modal || !display || !gameCore) return;
    
    display.innerHTML = `
        <div class="settings-section">
            <h4>Auto Sell Threshold</h4>
            <p>Items with RNG below this threshold will be automatically sent to sell area.</p>
            <p>Current: 1 in ${gameSettings.auto_sell_threshold}</p>
            <input type="number" id="auto-sell-input" value="${gameSettings.auto_sell_threshold}" min="1">
            <button class="game-btn" onclick="updateAutoSellThreshold()">Update</button>
        </div>
        
        <div class="settings-section">
            <h4>Storage Sort</h4>
            <p>Current: ${gameSettings.storage_sort}</p>
            <select id="storage-sort-settings">
                <option value="Price" ${gameSettings.storage_sort === "Price" ? "selected" : ""}>Price</option>
                <option value="Rarity" ${gameSettings.storage_sort === "Rarity" ? "selected" : ""}>Rarity</option>
                <option value="Damage" ${gameSettings.storage_sort === "Damage" ? "selected" : ""}>Damage</option>
                <option value="Defense" ${gameSettings.storage_sort === "Defense" ? "selected" : ""}>Defense</option>
                <option value="RNG" ${gameSettings.storage_sort === "RNG" ? "selected" : ""}>RNG</option>
            </select>
            <button class="game-btn" onclick="updateStorageSort()">Update</button>
        </div>
    `;
    
    modal.style.display = 'block';
}

// Action functions (called from UI)
function equipItem(itemId) {
    const itemIndex = gameCore.item_storage.findIndex(i => i.ID === itemId);
    if (itemIndex < 0) return;
    
    const [item] = gameCore.item_storage.splice(itemIndex, 1);
    
    if (gameCore.player.equipped) {
        gameCore.item_storage.push(gameCore.player.equipped);
    }
    
    gameCore.player.equipped = item;
    gameCore.saveGame();
    
    updatePlayerStats();
    showEquip();
    showNotification(`Equipped ${item.Rarity} ${item.Mold} ${item.Weapon}!`, 'success');
}

function unequipWeapon() {
    if (!gameCore.player.equipped) return;
    
    gameCore.item_storage.push(gameCore.player.equipped);
    gameCore.player.equipped = null;
    gameCore.saveGame();
    
    updatePlayerStats();
    showEquip();
    showNotification('Weapon unequipped!', 'success');
}

function sellItem(itemId) {
    const item = gameCore.item_storage.find(i => i.ID === itemId);
    if (!item) return;
    
    showConfirmation(
        `Sell ${item.Rarity} ${item.Mold} ${item.Weapon} for $${item.Price.toFixed(2)}?`,
        () => {
            // User confirmed - sell the item
            gameCore.item_storage = gameCore.item_storage.filter(i => i.ID !== itemId);
            gameCore.sell_area.push({
                item: item,
                time_added: Date.now() / 1000,
                timer: 30
            });
            gameCore.saveGame();
            showStorage();
            showNotification(`Item sent to sell area. Will be sold in 30 seconds.`, 'success');
        }
    );
}

function removeFromSellArea(itemId) {
    const entryIndex = gameCore.sell_area.findIndex(e => e.item.ID === itemId);
    if (entryIndex < 0) return;
    
    const entry = gameCore.sell_area[entryIndex];
    gameCore.sell_area.splice(entryIndex, 1);
    gameCore.item_storage.push(entry.item);
    gameCore.saveGame();
    
    showSellArea();
    showNotification('Item removed from sell area!', 'success');
}

function purchaseMoldUpgrades() {
    const input = document.getElementById('mold-amount');
    const amount = parseInt(input.value) || 1;
    const result = gameCore.upgradeMold(amount);
    
    if (result.success) {
        gameCore.saveGame();
        updatePlayerStats();
        showUpgrades();
        showNotification(result.message, 'success');
    } else {
        showNotification(result.message, 'error');
    }
}

function purchaseLuckUpgrades() {
    const input = document.getElementById('luck-amount');
    const amount = parseInt(input.value) || 1;
    const result = gameCore.upgradeLuck(amount);
    
    if (result.success) {
        gameCore.saveGame();
        updatePlayerStats();
        showUpgrades();
        showNotification(result.message, 'success');
    } else {
        showNotification(result.message, 'error');
    }
}

function enterArea(areaIndex) {
    const area = AREAS[areaIndex];
    const [areaName, areaLuckMult, areaEliteMult, levelReq, dropItems] = area;
    
    if (gameCore.player.level < levelReq) {
        showNotification(`You must be at least level ${levelReq} to enter ${areaName}.`, 'error');
        return;
    }
    
    if (!gameCore.player.equipped) {
        showNotification('You cannot fight without a weapon. Please equip one first.', 'error');
        showEquip();
        return;
    }
    
    const enemies = gameCore.spawned_enemies[areaName] || [];
    if (enemies.length === 0) {
        showNotification(`There are no enemies in ${areaName}.`, 'info');
        return;
    }
    
    // Show enemy selection
    const modal = document.getElementById('combat-modal');
    const display = document.getElementById('combat-display');
    if (!modal || !display) return;
    
    let html = `<h4>Select an enemy to fight in ${areaName}:</h4><div class="enemy-list">`;
    
    enemies.forEach((enemy, index) => {
        const eliteText = enemy.Elite ? 'Elite ' : '';
        html += `
            <div class="enemy-item">
                <p><strong>${eliteText}${enemy.name}</strong></p>
                <p>Health: ${enemy.health} | Damage: ${enemy.damage} | RNG: 1 in ${enemy.RNG}</p>
                <button class="game-btn" onclick="fightEnemy(${areaIndex}, ${index})">Fight</button>
            </div>
        `;
    });
    
    html += '</div>';
    display.innerHTML = html;
    modal.style.display = 'block';
}

function fightEnemy(areaIndex, enemyIndex) {
    const area = AREAS[areaIndex];
    const areaName = area[0];
    const enemies = gameCore.spawned_enemies[areaName];
    const enemy = enemies[enemyIndex];
    
    if (!enemy) {
        showNotification('Enemy no longer exists!', 'error');
        document.getElementById('combat-modal').style.display = 'none';
        return;
    }
    
    const result = gameCore.fightEnemy(areaName, enemy, area[4]);
    
    if (result.victory) {
        let message = `You defeated the ${enemy.name}! `;
        message += `You earned ${result.exp} EXP and $${result.cash}! `;
        if (result.levelsGained > 0) {
            message += `You leveled up ${result.levelsGained} time(s)! `;
        }
        if (result.drop) {
            message += `You got a ${result.drop.Mold} ${result.drop.Rarity} ${result.drop.Weapon}!`;
        }
        showNotification(message, 'success');
    } else {
        showNotification(result.message || 'You were defeated!', 'error');
    }
    
    gameCore.saveGame();
    updatePlayerStats();
    document.getElementById('combat-modal').style.display = 'none';
    showAreas();
}

function updateAutoSellThreshold() {
    const input = document.getElementById('auto-sell-input');
    const value = parseInt(input.value);
    
    if (value > 0) {
        gameSettings.setAutoSellThreshold(value);
        gameSettings.saveSettings(gameCore.username);
        showNotification(`Auto sell threshold updated to 1 in ${value}`, 'success');
        showSettings();
    } else {
        showNotification('Invalid value!', 'error');
    }
}

function updateStorageSort() {
    const select = document.getElementById('storage-sort-settings');
    const value = select.value;
    
    gameSettings.setStorageSort(value);
    gameSettings.saveSettings(gameCore.username);
    showNotification(`Storage sort updated to ${value}`, 'success');
    showSettings();
}

// Cleanup function (called when navigating away from game page)
function cleanupGame() {
    if (gameCore) {
        gameCore.stopGameLoops();
        gameCore.saveGame();
    }
}

// Custom notification system
function showNotification(message, type = 'info') {
    const modal = document.getElementById('notification-modal');
    const messageEl = document.getElementById('notification-message');
    const okBtn = document.getElementById('notification-ok-btn');
    
    if (!modal || !messageEl || !okBtn) {
        // Fallback to alert if modal not ready
        alert(message);
        return;
    }
    
    messageEl.textContent = message;
    messageEl.className = `notification-message notification-${type}`;
    
    okBtn.onclick = () => {
        modal.style.display = 'none';
    };
    
    modal.style.display = 'block';
}

// Custom confirmation system
function showConfirmation(message, onConfirm, onCancel = null) {
    const modal = document.getElementById('confirmation-modal');
    const messageEl = document.getElementById('confirmation-message');
    const yesBtn = document.getElementById('confirmation-yes-btn');
    const noBtn = document.getElementById('confirmation-no-btn');
    
    if (!modal || !messageEl || !yesBtn || !noBtn) {
        // Fallback to confirm if modal not ready
        if (confirm(message)) {
            if (onConfirm) onConfirm();
        } else {
            if (onCancel) onCancel();
        }
        return;
    }
    
    messageEl.textContent = message;
    
    yesBtn.onclick = () => {
        modal.style.display = 'none';
        if (onConfirm) onConfirm();
    };
    
    noBtn.onclick = () => {
        modal.style.display = 'none';
        if (onCancel) onCancel();
    };
    
    // Close on X button
    const closeBtn = modal.querySelector('.game-modal-close');
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
            if (onCancel) onCancel();
        };
    }
    
    modal.style.display = 'block';
}

// Make functions globally accessible
if (typeof window !== 'undefined') {
    window.initializeGameUI = initializeGameUI;
    window.updateAllDisplays = updateAllDisplays;
    window.showNotification = showNotification;
    window.showConfirmation = showConfirmation;
    console.log('Game UI functions loaded successfully');
}

