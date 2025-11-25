document.addEventListener('DOMContentLoaded', () => {
    // --- Authentication State ---
    const AUTH_TOKEN_KEY = 'authToken';
    const CURRENT_USER_KEY = 'currentUser';
    const USERS_STORAGE_KEY = 'users';

    // --- Input Sanitization ---
    function sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        // Trim whitespace
        let sanitized = input.trim();
        // Remove HTML tags and potential XSS characters
        sanitized = sanitized.replace(/[<>]/g, ''); // Remove < and >
        sanitized = sanitized.replace(/[&"']/g, ''); // Remove &, ", '
        sanitized = sanitized.replace(/javascript:/gi, ''); // Remove javascript: protocol
        sanitized = sanitized.replace(/on\w+=/gi, ''); // Remove event handlers like onclick=
        return sanitized;
    }

    function validateUsername(username) {
        const sanitized = sanitizeInput(username);
        if (sanitized.length < 3 || sanitized.length > 20) {
            return { valid: false, error: 'Username must be between 3 and 20 characters' };
        }
        if (!/^[a-zA-Z0-9_]+$/.test(sanitized)) {
            return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
        }
        return { valid: true, value: sanitized };
    }

    function validatePassword(password) {
        if (password.length < 6) {
            return { valid: false, error: 'Password must be at least 6 characters long' };
        }
        return { valid: true, value: password };
    }

    // --- Authentication Functions ---
    function getUsers() {
        const usersJson = localStorage.getItem(USERS_STORAGE_KEY);
        return usersJson ? JSON.parse(usersJson) : {};
    }

    function saveUsers(users) {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    }

    // --- Password Hashing using Web Crypto API (PBKDF2) ---
    // PBKDF2 is a secure password hashing algorithm built into browsers
    
    async function hashPassword(password) {
        try {
            // Generate a random salt (16 bytes = 128 bits)
            const salt = crypto.getRandomValues(new Uint8Array(16));
            
            // Convert password to ArrayBuffer
            const encoder = new TextEncoder();
            const passwordData = encoder.encode(password);
            
            // Import password as key material
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                passwordData,
                { name: 'PBKDF2' },
                false,
                ['deriveBits']
            );
            
            // Derive key using PBKDF2 with 100,000 iterations (industry standard)
            const iterations = 100000;
            const hashBuffer = await crypto.subtle.deriveBits(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: iterations,
                    hash: 'SHA-256'
                },
                keyMaterial,
                256 // 256 bits = 32 bytes
            );
            
            // Convert salt and hash to base64 strings for storage
            const saltBase64 = btoa(String.fromCharCode(...salt));
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashBase64 = btoa(String.fromCharCode(...hashArray));
            
            // Return format: iterations:salt:hash
            return `${iterations}:${saltBase64}:${hashBase64}`;
        } catch (error) {
            console.error('Password hashing error:', error);
            throw new Error('Failed to hash password: ' + error.message);
        }
    }

    async function verifyPassword(password, storedHash) {
        try {
            // Parse stored hash: iterations:salt:hash
            const parts = storedHash.split(':');
            if (parts.length !== 3) {
                return false; // Invalid format
            }
            
            const iterations = parseInt(parts[0], 10);
            const saltBase64 = parts[1];
            const storedHashBase64 = parts[2];
            
            // Convert salt from base64
            const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
            
            // Convert password to ArrayBuffer
            const encoder = new TextEncoder();
            const passwordData = encoder.encode(password);
            
            // Import password as key material
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                passwordData,
                { name: 'PBKDF2' },
                false,
                ['deriveBits']
            );
            
            // Derive key using same parameters
            const hashBuffer = await crypto.subtle.deriveBits(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: iterations,
                    hash: 'SHA-256'
                },
                keyMaterial,
                256 // 256 bits = 32 bytes
            );
            
            // Convert computed hash to base64
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const computedHashBase64 = btoa(String.fromCharCode(...hashArray));
            
            // Compare hashes (timing-safe comparison)
            return computedHashBase64 === storedHashBase64;
        } catch (error) {
            console.error('Password verification error:', error);
            return false;
        }
    }

    function generateToken() {
        return 'token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function isAuthenticated() {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        const user = localStorage.getItem(CURRENT_USER_KEY);
        return !!(token && user);
    }

    function setSession(username, token) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.setItem(CURRENT_USER_KEY, username);
    }

    function clearSession() {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(CURRENT_USER_KEY);
    }

    function getCurrentUser() {
        return localStorage.getItem(CURRENT_USER_KEY);
    }

    // --- Authentication UI Elements ---
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginFormElement = document.getElementById('login-form-element');
    const registerFormElement = document.getElementById('register-form-element');
    const logoutBtn = document.getElementById('logout-btn');

    // --- Authentication UI Functions ---
    function showAuth() {
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }

    function updateWelcomeHeader() {
        const welcomeHeader = document.getElementById('welcome-header');
        const currentUser = getCurrentUser();
        if (welcomeHeader && currentUser) {
            welcomeHeader.textContent = `Welcome ${currentUser}`;
        }
    }

    function showApp() {
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        updateWelcomeHeader();
    }

    function switchTab(tab) {
        if (tab === 'login') {
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            loginForm.classList.add('active');
            registerForm.classList.remove('active');
        } else {
            tabLogin.classList.remove('active');
            tabRegister.classList.add('active');
            loginForm.classList.remove('active');
            registerForm.classList.add('active');
        }
        // Clear error messages
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        document.querySelectorAll('.auth-message').forEach(el => el.textContent = '');
    }

    function showError(elementId, message) {
        const errorEl = document.getElementById(elementId);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }

    function clearError(elementId) {
        const errorEl = document.getElementById(elementId);
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
    }

    function showMessage(elementId, message, isError = false) {
        const messageEl = document.getElementById(elementId);
        if (messageEl) {
            messageEl.textContent = message;
            messageEl.className = isError ? 'auth-message error' : 'auth-message success';
            messageEl.style.display = 'block';
        }
    }

    // --- Registration Handler ---
    if (registerFormElement) {
        registerFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Clear previous errors
            ['register-username-error', 'register-password-error', 'register-password-confirm-error'].forEach(clearError);
            const registerMessageEl = document.getElementById('register-message');
            if (registerMessageEl) {
                registerMessageEl.textContent = '';
            }

            const usernameInput = document.getElementById('register-username');
            const passwordInput = document.getElementById('register-password');
            const passwordConfirmInput = document.getElementById('register-password-confirm');

            if (!usernameInput || !passwordInput || !passwordConfirmInput) {
                showMessage('register-message', 'Form elements not found. Please refresh the page.', true);
                return;
            }

            const username = usernameInput.value;
            const password = passwordInput.value;
            const passwordConfirm = passwordConfirmInput.value;

            // Validate username
            const usernameValidation = validateUsername(username);
            if (!usernameValidation.valid) {
                showError('register-username-error', usernameValidation.error);
                return;
            }

            // Validate password
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.valid) {
                showError('register-password-error', passwordValidation.error);
                return;
            }

            // Check password confirmation
            if (password !== passwordConfirm) {
                showError('register-password-confirm-error', 'Passwords do not match');
                return;
            }

            // Check if user already exists
            const users = getUsers();
            if (users[usernameValidation.value]) {
                showError('register-username-error', 'Username already exists');
                return;
            }

            // Hash password and save user
            try {
                const hashedPassword = await hashPassword(password);
                if (!hashedPassword) {
                    throw new Error('Password hashing returned empty result');
                }
                
                users[usernameValidation.value] = {
                    username: usernameValidation.value,
                    passwordHash: hashedPassword,
                    createdAt: new Date().toISOString()
                };
                saveUsers(users);

                showMessage('register-message', 'Registration successful! Please login.', false);
                setTimeout(() => {
                    switchTab('login');
                    const loginUsernameInput = document.getElementById('login-username');
                    if (loginUsernameInput) {
                        loginUsernameInput.value = usernameValidation.value;
                    }
                }, 1500);
            } catch (error) {
                console.error('Registration error:', error);
                showMessage('register-message', 'Registration failed: ' + error.message, true);
            }
        });
    }

    // --- Login Handler ---
    if (loginFormElement) {
        loginFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Clear previous errors
            ['login-username-error', 'login-password-error'].forEach(clearError);
            const loginMessageEl = document.getElementById('login-message');
            if (loginMessageEl) {
                loginMessageEl.textContent = '';
            }

            const usernameInput = document.getElementById('login-username');
            const passwordInput = document.getElementById('login-password');

            if (!usernameInput || !passwordInput) {
                showMessage('login-message', 'Form elements not found. Please refresh the page.', true);
                return;
            }

            const username = usernameInput.value;
            const password = passwordInput.value;

            // Validate inputs
            const usernameValidation = validateUsername(username);
            if (!usernameValidation.valid) {
                showError('login-username-error', usernameValidation.error);
                return;
            }

            if (!password) {
                showError('login-password-error', 'Password is required');
                return;
            }

            // Check user exists and verify password
            const users = getUsers();
            const user = users[usernameValidation.value];

            if (!user) {
                showError('login-username-error', 'Invalid username or password');
                return;
            }

            const isValidPassword = await verifyPassword(password, user.passwordHash);
            if (!isValidPassword) {
                showError('login-password-error', 'Invalid username or password');
                return;
            }

            // Create session
            const token = generateToken();
            setSession(usernameValidation.value, token);
            showApp();
            initializeApp();
        });
    }

    // --- Notification System for Calendar ---
    function showAppNotification(message, type = 'info') {
        // Check if game notification system is available
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
            return;
        }
        
        // Fallback: create a simple notification
        let notification = document.getElementById('app-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'app-notification';
            notification.className = 'app-notification';
            document.body.appendChild(notification);
        }
        
        notification.textContent = message;
        notification.className = `app-notification app-notification-${type}`;
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
    
    function showAppConfirmation(message, onConfirm, onCancel = null) {
        // Check if game confirmation system is available
        if (typeof window.showConfirmation === 'function') {
            window.showConfirmation(message, onConfirm, onCancel);
            return;
        }
        
        // Fallback to browser confirm
        if (confirm(message)) {
            if (onConfirm) onConfirm();
        } else {
            if (onCancel) onCancel();
        }
    }

    // --- Logout Handler ---
    logoutBtn.addEventListener('click', () => {
        showAppConfirmation('Are you sure you want to logout?', () => {
            clearSession();
            showAuth();
            // Clear forms
            loginFormElement.reset();
            registerFormElement.reset();
        });
    });

    // --- Tab Switching ---
    tabLogin.addEventListener('click', () => switchTab('login'));
    tabRegister.addEventListener('click', () => switchTab('register'));

    // --- App UI Elements (only accessible after authentication) ---
    let calendarPage, shopPage, gamePage, navCalendar, navShop, navGame, backToCalendarBtn;
    let taskForm, taskModal, taskDetailsModal, calendarGrid, currentMonthYear;
    let prevMonthBtn, nextMonthBtn, selectedDateInput, selectedDateDisplay;
    let detailsDateDisplay, dateTasksList, closeModalBtns;

    // --- State Management ---
    let currentDate = new Date();
    let tasks = {}; // Store tasks by date string (YYYY-MM-DD)
    let holidays = {}; // Store holidays by date string (YYYY-MM-DD)
    let holidaysCache = {}; // Cache holidays by year-country
    const DEFAULT_COUNTRY = 'US'; // Default country code

    function initializeApp() {
        // Update welcome header
        updateWelcomeHeader();
        
        // Get UI Elements
        calendarPage = document.getElementById('calendar-page');
        shopPage = document.getElementById('shop-page');
        gamePage = document.getElementById('game-page');
        navCalendar = document.getElementById('nav-calendar');
        navShop = document.getElementById('nav-shop');
        navGame = document.getElementById('nav-game');
        backToCalendarBtn = document.getElementById('back-to-calendar');
        
        // Set up navigation listeners immediately
        if (navCalendar) {
            navCalendar.addEventListener('click', (e) => {
                e.preventDefault();
                showPage('calendar-page');
            });
        }
        if (navShop) {
            navShop.addEventListener('click', (e) => {
                e.preventDefault();
                showPage('shop-page');
            });
        }
        if (navGame) {
            navGame.addEventListener('click', (e) => {
                e.preventDefault();
                showPage('game-page');
            });
        }
        if (backToCalendarBtn) {
            backToCalendarBtn.addEventListener('click', (e) => {
                e.preventDefault();
                showPage('calendar-page');
            });
        }
        taskForm = document.getElementById('task-form');
        taskModal = document.getElementById('task-modal');
        taskDetailsModal = document.getElementById('task-details-modal');
        calendarGrid = document.getElementById('calendar-grid');
        currentMonthYear = document.getElementById('current-month-year');
        prevMonthBtn = document.getElementById('prev-month');
        nextMonthBtn = document.getElementById('next-month');
        selectedDateInput = document.getElementById('selected-date');
        selectedDateDisplay = document.getElementById('selected-date-display');
        detailsDateDisplay = document.getElementById('details-date-display');
        dateTasksList = document.getElementById('date-tasks-list');
        closeModalBtns = document.querySelectorAll('.close-modal');

        // Load tasks from localStorage (user-specific)
        const currentUser = getCurrentUser();
        const savedTasks = localStorage.getItem(`calendarTasks_${currentUser}`);
        if (savedTasks) {
            tasks = JSON.parse(savedTasks);
        }

        // Load holidays cache from localStorage
        const savedHolidaysCache = localStorage.getItem('holidaysCache');
        if (savedHolidaysCache) {
            holidaysCache = JSON.parse(savedHolidaysCache);
        }

    // --- Page Transition Logic ---
    function showPage(pageId) {
        // Make showPage globally accessible
        window.showPage = showPage;
        // Clean up game if navigating away from game page
        if (gamePage && gamePage.classList.contains('active') && pageId !== 'game-page') {
            if (typeof cleanupGame === 'function') {
                cleanupGame();
            }
        }
        
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.querySelectorAll('nav button').forEach(button => button.classList.remove('active'));

        if (pageId === 'calendar-page') {
            calendarPage.classList.add('active');
            navCalendar.classList.add('active');
        } else if (pageId === 'shop-page') {
            shopPage.classList.add('active');
            navShop.classList.add('active');
        } else if (pageId === 'game-page') {
            gamePage.classList.add('active');
            navGame.classList.add('active');
            
            // Initialize game if not already initialized
            const currentUser = getCurrentUser();
            if (!currentUser) {
                console.error('No user logged in');
                return;
            }
            
            // Initialize game immediately (scripts should be loaded by now)
            // Check for all required dependencies
            const missingDeps = [];
            if (typeof GameCore === 'undefined') missingDeps.push('GameCore');
            if (typeof GameSettings === 'undefined') missingDeps.push('GameSettings');
            if (typeof RARITY_TIERS === 'undefined') missingDeps.push('RARITY_TIERS');
            if (typeof AREAS === 'undefined') missingDeps.push('AREAS');
            if (typeof initializeGameUI === 'undefined') missingDeps.push('initializeGameUI');
            
            if (missingDeps.length > 0) {
                console.error('Missing dependencies:', missingDeps);
                console.error('Available globals:', {
                    GameCore: typeof GameCore,
                    GameSettings: typeof GameSettings,
                    RARITY_TIERS: typeof RARITY_TIERS,
                    AREAS: typeof AREAS,
                    initializeGameUI: typeof initializeGameUI,
                    window_GameCore: typeof window.GameCore,
                    window_GameSettings: typeof window.GameSettings
                });
                gamePage.innerHTML = `
                    <div class="game-container">
                        <h2>RNG Game</h2>
                        <p style="color: red;">Game scripts not loaded properly.</p>
                        <p>Missing: ${missingDeps.join(', ')}</p>
                        <p>Please check the browser console (F12) for detailed error messages.</p>
                        <p>Make sure all game script files are present and have no JavaScript errors.</p>
                        <button class="game-btn" onclick="location.reload()">Reload Page</button>
                    </div>
                `;
                return;
            }
            
            if (typeof initializeGameUI === 'function') {
                // Check if game UI is already built
                if (!document.getElementById('game-container')) {
                    try {
                        initializeGameUI(currentUser);
                    } catch (error) {
                        console.error('Error initializing game:', error);
                        gamePage.innerHTML = `
                            <div class="game-container">
                                <h2>RNG Game</h2>
                                <p style="color: red;">Error initializing game: ${error.message}</p>
                                <p>Please check the browser console (F12) for more details.</p>
                                <button class="game-btn" onclick="location.reload()">Reload Page</button>
                            </div>
                        `;
                    }
                } else {
                    // Just update displays if already initialized
                    if (typeof updateAllDisplays === 'function') {
                        updateAllDisplays();
                    }
                }
            } else {
                console.error('initializeGameUI function not found. Make sure all game scripts are loaded.');
                gamePage.innerHTML = `
                    <div class="game-container">
                        <h2>RNG Game</h2>
                        <p style="color: red;">Game UI script not loaded. Please refresh the page.</p>
                    </div>
                `;
            }
        }
    }

    // Navigation event listeners - use event delegation on the header/nav area
    const header = document.querySelector('header');
    if (header) {
        header.addEventListener('click', (e) => {
            if (e.target.id === 'nav-calendar') {
                e.preventDefault();
                e.stopPropagation();
                showPage('calendar-page');
            } else if (e.target.id === 'nav-shop') {
                e.preventDefault();
                e.stopPropagation();
                showPage('shop-page');
            } else if (e.target.id === 'nav-game') {
                e.preventDefault();
                e.stopPropagation();
                showPage('game-page');
            }
        });
    }
    
    // Set up navigation listeners on document (works everywhere)
    document.addEventListener('click', function(e) {
        // Check for navigation buttons
        if (e.target && e.target.id) {
            if (e.target.id === 'nav-calendar') {
                e.preventDefault();
                e.stopPropagation();
                const showPageFunc = window.showPage || (typeof showPage !== 'undefined' ? showPage : null);
                if (showPageFunc && typeof showPageFunc === 'function') {
                    showPageFunc('calendar-page');
                } else {
                    console.error('showPage function not available');
                }
            } else if (e.target.id === 'nav-shop') {
                e.preventDefault();
                e.stopPropagation();
                const showPageFunc = window.showPage || (typeof showPage !== 'undefined' ? showPage : null);
                if (showPageFunc && typeof showPageFunc === 'function') {
                    showPageFunc('shop-page');
                } else {
                    console.error('showPage function not available');
                }
            } else if (e.target.id === 'nav-game') {
                e.preventDefault();
                e.stopPropagation();
                const showPageFunc = window.showPage || (typeof showPage !== 'undefined' ? showPage : null);
                if (showPageFunc && typeof showPageFunc === 'function') {
                    showPageFunc('game-page');
                } else {
                    console.error('showPage function not available');
                }
            }
        }
    }, true); // Use capture phase to catch events early

        // --- Calendar Generation ---
        function formatDateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function formatDateDisplay(date) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    // --- Holidays API Integration ---
    async function fetchHolidays(year, countryCode = DEFAULT_COUNTRY) {
        const cacheKey = `${year}-${countryCode}`;
        
        // Check cache first
        if (holidaysCache[cacheKey]) {
            return holidaysCache[cacheKey];
        }

        try {
            const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const holidaysData = await response.json();
            
            // Cache the holidays
            holidaysCache[cacheKey] = holidaysData;
            localStorage.setItem('holidaysCache', JSON.stringify(holidaysCache));
            
            return holidaysData;
        } catch (error) {
            console.error('Error fetching holidays:', error);
            // Return empty array on error, but don't cache the error
            return [];
        }
    }

    function processHolidaysForMonth(holidaysData, year, month) {
        // Convert holidays array to object keyed by date (YYYY-MM-DD)
        const holidaysByDate = {};
        
        holidaysData.forEach(holiday => {
            const holidayDate = new Date(holiday.date);
            const holidayYear = holidayDate.getFullYear();
            const holidayMonth = holidayDate.getMonth();
            
            // Only include holidays for the current month and year
            if (holidayYear === year && holidayMonth === month) {
                const dateKey = formatDateKey(holidayDate);
                if (!holidaysByDate[dateKey]) {
                    holidaysByDate[dateKey] = [];
                }
                holidaysByDate[dateKey].push({
                    name: holiday.name,
                    localName: holiday.localName || holiday.name,
                    date: holiday.date,
                    countryCode: holiday.countryCode,
                    fixed: holiday.fixed || false,
                    global: holiday.global || false,
                    type: holiday.types ? holiday.types[0] : 'Public'
                });
            }
        });
        
        return holidaysByDate;
    }

    async function renderCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        // Update month/year display
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        currentMonthYear.textContent = `${monthNames[month]} ${year}`;

        // Fetch holidays for the current year
        const holidaysData = await fetchHolidays(year, DEFAULT_COUNTRY);
        holidays = processHolidaysForMonth(holidaysData, year, month);

        // Clear the grid
        calendarGrid.innerHTML = '';

        // Get first day of month and number of days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            calendarGrid.appendChild(emptyCell);
        }

        // Add cells for each day of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            
            const date = new Date(year, month, day);
            const dateKey = formatDateKey(date);
            const dayTasks = tasks[dateKey] || [];
            const dayHolidays = holidays[dateKey] || [];

            // Build holidays preview (show all holidays)
            let holidaysPreview = '';
            if (dayHolidays.length > 0) {
                holidaysPreview = dayHolidays.map(holiday => {
                    return `<div class="holiday-preview-item" title="${holiday.localName}">
                        <div class="holiday-preview-content">
                            <span class="holiday-icon">🎉</span>
                            <span class="holiday-name-small">${holiday.localName}</span>
                        </div>
                    </div>`;
                }).join('');
            }

            // Build task preview list
            let tasksPreview = '';
            if (dayTasks.length > 0) {
                // Show up to 3 tasks, or all if 3 or fewer
                const tasksToShow = dayTasks.slice(0, 3);
                tasksPreview = tasksToShow.map(task => {
                    const timeDisplay = task.time ? formatTime(task.time) : '';
                    const timePart = timeDisplay ? `<span class="task-time-small">${timeDisplay}</span>` : '';
                    return `<div class="task-preview-item" data-task-id="${task.id}" data-date="${dateKey}">
                        <div class="task-preview-content">
                            ${timePart}<span class="task-desc-small">${task.description}</span>
                        </div>
                        <button class="delete-task-small" data-task-id="${task.id}" data-date="${dateKey}" title="Delete task">×</button>
                    </div>`;
                }).join('');
                if (dayTasks.length > 3) {
                    tasksPreview += `<div class="task-preview-more">+${dayTasks.length - 3} more</div>`;
                }
            }

            dayCell.innerHTML = `
                <div class="day-number">${day}</div>
                <div class="day-tasks-preview">
                    ${holidaysPreview}
                    ${tasksPreview}
                </div>
            `;

            // Add click handler to open task modal (but not if clicking on delete button)
            dayCell.addEventListener('click', (e) => {
                // Don't open modal if clicking on delete button
                if (e.target.classList.contains('delete-task-small')) {
                    return;
                }
                // Don't open modal if clicking inside a task preview item (except the delete button)
                if (e.target.closest('.task-preview-item') && !e.target.classList.contains('delete-task-small')) {
                    return;
                }
                selectedDateInput.value = dateKey;
                selectedDateDisplay.textContent = formatDateDisplay(date);
                // Reset form to defaults
                document.getElementById('task-description').value = '';
                document.getElementById('task-hour').value = '';
                document.getElementById('task-minute').value = '';
                document.getElementById('task-ampm').value = 'AM';
                taskModal.style.display = 'block';
            });

            // Add delete handler for task preview items
            dayCell.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-task-small')) {
                    e.stopPropagation(); // Prevent opening the modal
                    const taskId = parseInt(e.target.getAttribute('data-task-id'));
                    const taskDateKey = e.target.getAttribute('data-date');
                    
                    showAppConfirmation('Are you sure you want to delete this task?', () => {
                        tasks[taskDateKey] = tasks[taskDateKey].filter(t => t.id !== taskId);
                        if (tasks[taskDateKey].length === 0) {
                            delete tasks[taskDateKey];
                        }
                        saveTasks();
                        renderCalendar();
                    });
                }
            });

            // Add double-click handler to view tasks
            dayCell.addEventListener('dblclick', () => {
                showTaskDetails(dateKey, date);
            });

            calendarGrid.appendChild(dayCell);
        }
        }

        // --- Task Management ---
        function saveTasks() {
            const currentUser = getCurrentUser();
            localStorage.setItem(`calendarTasks_${currentUser}`, JSON.stringify(tasks));
        }

        function addTask(dateKey, description, time) {
        if (!tasks[dateKey]) {
            tasks[dateKey] = [];
        }
        tasks[dateKey].push({
            id: Date.now(),
            description: description,
            time: time,
            completed: false
        });
        // Sort tasks by time
        tasks[dateKey].sort((a, b) => {
            if (!a.time) return 1;
            if (!b.time) return -1;
            return a.time.localeCompare(b.time);
        });
        saveTasks();
        renderCalendar();
    }

        function formatTime(timeString) {
            if (!timeString) return '';
            const [hours, minutes] = timeString.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            return `${displayHour}:${minutes} ${ampm}`;
        }

        function showTaskDetails(dateKey, date) {
        detailsDateDisplay.textContent = formatDateDisplay(date);
        dateTasksList.innerHTML = '';

        const dayTasks = tasks[dateKey] || [];
        const dayHolidays = holidays[dateKey] || [];
        
        // Show holidays first
        if (dayHolidays.length > 0) {
            dayHolidays.forEach(holiday => {
                const listItem = document.createElement('li');
                listItem.className = 'holiday-item';
                listItem.innerHTML = `
                    <div class="task-info">
                        <span class="holiday-icon">🎉</span>
                        <span class="task-description holiday-name">${holiday.localName}</span>
                    </div>
                    <div class="holiday-badge">Holiday</div>
                `;
                dateTasksList.appendChild(listItem);
            });
        }

        // Show tasks
        if (dayTasks.length === 0 && dayHolidays.length === 0) {
            dateTasksList.innerHTML = '<li class="no-tasks">No tasks or holidays for this day</li>';
        } else if (dayTasks.length > 0) {
            dayTasks.forEach(task => {
                const listItem = document.createElement('li');
                listItem.className = task.completed ? 'completed' : '';
                const timeDisplay = task.time ? `<span class="task-time">${formatTime(task.time)}</span>` : '';
                listItem.innerHTML = `
                    <div class="task-info">
                        ${timeDisplay}
                        <span class="task-description">${task.description}</span>
                    </div>
                    <div class="task-actions">
                        <button class="complete-btn" data-task-id="${task.id}" data-date="${dateKey}">
                            ${task.completed ? 'Undo' : 'Complete'}
                        </button>
                        <button class="delete-btn" data-task-id="${task.id}" data-date="${dateKey}">Delete</button>
                    </div>
                `;
                dateTasksList.appendChild(listItem);
            });
        }

        taskDetailsModal.style.display = 'block';
    }

        // Convert hour/minute/AMPM to 24-hour format (HH:MM)
        function convertTo24Hour(hour, minute, ampm) {
        let hour24 = parseInt(hour);
        if (ampm === 'PM' && hour24 !== 12) {
            hour24 += 12;
        } else if (ampm === 'AM' && hour24 === 12) {
            hour24 = 0;
        }
        return `${String(hour24).padStart(2, '0')}:${minute}`;
    }

        // --- Event Handlers ---
    taskForm.addEventListener('submit', function(event) {
        event.preventDefault();
        
        const description = document.getElementById('task-description').value.trim();
        const hour = document.getElementById('task-hour').value;
        const minute = document.getElementById('task-minute').value;
        const ampm = document.getElementById('task-ampm').value;
        const dateKey = selectedDateInput.value;

        if (description === "") {
            showAppNotification("Please enter a task description.", 'error');
            return;
        }

        if (!hour || !minute || !ampm) {
            showAppNotification("Please select a complete time (hour, minute, and AM/PM).", 'error');
            return;
        }

        if (!dateKey) {
            showAppNotification("Please select a date.", 'error');
            return;
        }

        const time24 = convertTo24Hour(hour, minute, ampm);
        addTask(dateKey, description, time24);
        taskModal.style.display = 'none';
        document.getElementById('task-description').value = '';
        document.getElementById('task-hour').value = '';
        document.getElementById('task-minute').value = '';
        document.getElementById('task-ampm').value = 'AM';
    });

        // Handle task completion and deletion
        dateTasksList.addEventListener('click', function(event) {
        const taskId = parseInt(event.target.getAttribute('data-task-id'));
        const dateKey = event.target.getAttribute('data-date');

        if (event.target.classList.contains('complete-btn')) {
            const task = tasks[dateKey].find(t => t.id === taskId);
            if (task) {
                task.completed = !task.completed;
                saveTasks();
                showTaskDetails(dateKey, new Date(dateKey));
            }
        } else if (event.target.classList.contains('delete-btn')) {
            tasks[dateKey] = tasks[dateKey].filter(t => t.id !== taskId);
            if (tasks[dateKey].length === 0) {
                delete tasks[dateKey];
            }
            saveTasks();
            renderCalendar();
            showTaskDetails(dateKey, new Date(dateKey));
        }
    });

        // Month navigation
        prevMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
        });

        nextMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
        });

        // Close modals
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                taskModal.style.display = 'none';
                taskDetailsModal.style.display = 'none';
            });
        });

        // Close modals when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === taskModal) {
                taskModal.style.display = 'none';
            }
            if (event.target === taskDetailsModal) {
                taskDetailsModal.style.display = 'none';
            }
        });

        // Initialize calendar
        renderCalendar();
    }

    // --- Authentication Check on Load ---
    if (isAuthenticated()) {
        showApp();
        initializeApp();
    } else {
        showAuth();
    }
});
