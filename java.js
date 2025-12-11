document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Management (load immediately) ---
    const THEME_STORAGE_KEY = 'appTheme';
    
    function getTheme() {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        return saved || 'light'; // Default to light theme
    }
    
    function applyTheme(theme) {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark-theme');
        } else {
            root.classList.remove('dark-theme');
        }
    }
    
    // Load theme immediately on page load
    const initialTheme = getTheme();
    applyTheme(initialTheme);
    
    // --- Authentication State ---
    const CURRENT_USER_KEY = 'currentUser'; // Keep for frontend reference, but auth is handled by session

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

    // Check authentication status (async)
    async function checkAuthStatus() {
        try {
            if (typeof AuthAPI === 'undefined') {
                return false;
            }
            const response = await AuthAPI.checkAuth();
            if (response.authenticated) {
                localStorage.setItem(CURRENT_USER_KEY, response.username);
                return true;
            } else {
                localStorage.removeItem(CURRENT_USER_KEY);
                return false;
            }
        } catch (error) {
            console.error('Auth check error:', error);
            return false;
        }
    }

    function isAuthenticated() {
        // Synchronous check - returns cached value
        // For actual auth, use checkAuthStatus() which is async
        return !!localStorage.getItem(CURRENT_USER_KEY);
    }

    function setSession(username) {
        localStorage.setItem(CURRENT_USER_KEY, username);
    }

    async function clearSession() {
        try {
            if (typeof AuthAPI !== 'undefined') {
                await AuthAPI.logout();
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
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
    const passwordResetForm = document.getElementById('password-reset-form');
    const loginFormElement = document.getElementById('login-form-element');
    const registerFormElement = document.getElementById('register-form-element');
    const logoutBtn = document.getElementById('logout-btn');
    const forgotPasswordBtn = document.getElementById('forgot-password-btn');
    const passwordResetRequestForm = document.getElementById('password-reset-request-form');
    const passwordResetConfirmForm = document.getElementById('password-reset-confirm-form');
    
    // Verify all authentication elements exist
    if (!tabLogin || !tabRegister || !loginForm || !registerForm) {
        console.error('Critical authentication UI elements not found!');
        if (authContainer) {
            authContainer.innerHTML = '<div class="auth-box"><h1>Error</h1><p>Critical UI elements missing. Please refresh the page.</p></div>';
        }
    }

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
        if (!tabLogin || !tabRegister || !loginForm || !registerForm) {
            console.error('Cannot switch tabs: UI elements not found');
            return;
        }
        
        if (tab === 'login') {
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            loginForm.classList.add('active');
            registerForm.classList.remove('active');
            if (passwordResetForm) passwordResetForm.classList.remove('active');
        } else if (tab === 'register') {
            tabLogin.classList.remove('active');
            tabRegister.classList.add('active');
            loginForm.classList.remove('active');
            registerForm.classList.add('active');
            if (passwordResetForm) passwordResetForm.classList.remove('active');
        }
        // Clear error messages
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        document.querySelectorAll('.auth-message').forEach(el => el.textContent = '');
    }
    
    function showPasswordResetForm() {
        if (!passwordResetForm || !loginForm) return;
        
        loginForm.classList.remove('active');
        registerForm.classList.remove('active');
        passwordResetForm.classList.add('active');
        tabLogin.classList.remove('active');
        tabRegister.classList.remove('active');
        
        showPasswordResetStep1();
    }
    
    function showPasswordResetStep1() {
        const step1 = document.getElementById('password-reset-step-1');
        const step2 = document.getElementById('password-reset-step-2');
        if (step1) step1.style.display = 'block';
        if (step2) step2.style.display = 'none';
        
        // Clear form
        if (passwordResetRequestForm) passwordResetRequestForm.reset();
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        const resetRequestMessage = document.getElementById('reset-request-message');
        if (resetRequestMessage) resetRequestMessage.textContent = '';
    }
    
    function showPasswordResetStep2() {
        const step1 = document.getElementById('password-reset-step-1');
        const step2 = document.getElementById('password-reset-step-2');
        if (step1) step1.style.display = 'none';
        if (step2) step2.style.display = 'block';
        
        // Clear form
        if (passwordResetConfirmForm) passwordResetConfirmForm.reset();
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        const resetConfirmMessage = document.getElementById('reset-confirm-message');
        if (resetConfirmMessage) resetConfirmMessage.textContent = '';
    }
    
    async function handlePasswordResetRequest() {
        const emailInput = document.getElementById('reset-email');
        const emailError = document.getElementById('reset-email-error');
        const resetRequestMessage = document.getElementById('reset-request-message');
        
        if (!emailInput) return;
        
        const email = emailInput.value.trim().toLowerCase();
        
        // Clear previous errors
        if (emailError) {
            emailError.textContent = '';
            emailError.style.display = 'none';
        }
        if (resetRequestMessage) {
            resetRequestMessage.textContent = '';
            resetRequestMessage.className = 'auth-message';
        }
        
        // Validate email
        if (!email) {
            if (emailError) {
                emailError.textContent = 'Please enter your email address';
                emailError.style.display = 'block';
            }
            return;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            if (emailError) {
                emailError.textContent = 'Please enter a valid email address';
                emailError.style.display = 'block';
            }
            return;
        }
        
            // Request password reset
        try {
            if (typeof PasswordResetAPI === 'undefined') {
                throw new Error('API not loaded');
            }
            
            const response = await PasswordResetAPI.requestReset(email);
            
            if (response.success) {
                // Store email for next step
                emailInput.setAttribute('data-email', email);
                
                // Send email via EmailJS if code is provided
                if (response.code) {
                    try {
                        // Verify function exists before calling (safety check)
                        if (typeof sendPasswordResetEmail !== 'function') {
                            console.error('sendPasswordResetEmail is not a function. Type:', typeof sendPasswordResetEmail);
                            throw new Error('Password reset email function is not available. Please do a hard refresh (Ctrl+Shift+R) to clear cache.');
                        }
                        // Call the password reset email function
                        const emailResult = await sendPasswordResetEmail(email, response.code);
                        if (emailResult.success) {
                            // Email sent successfully
                            if (resetRequestMessage) {
                                resetRequestMessage.textContent = 'Password reset code sent to your email! Please check your inbox (and spam folder).';
                                resetRequestMessage.className = 'auth-message success';
                            }
                        } else {
                            // EmailJS failed, but code was generated
                            console.warn('EmailJS sending failed:', emailResult.error);
                            if (resetRequestMessage) {
                                resetRequestMessage.textContent = 'Reset code generated. Check server console for code: ' + response.code;
                                resetRequestMessage.className = 'auth-message error';
                            }
                        }
                    } catch (emailError) {
                        console.error('Error sending password reset email:', emailError);
                        // Code was generated, but email failed
                        if (resetRequestMessage) {
                            resetRequestMessage.textContent = 'Reset code generated. Check server console for code: ' + response.code;
                            resetRequestMessage.className = 'auth-message error';
                        }
                    }
                } else {
                    // No code returned (shouldn't happen, but handle gracefully)
                    if (resetRequestMessage) {
                        resetRequestMessage.textContent = response.message || 'Password reset code sent to your email! Please check your inbox (and spam folder).';
                        resetRequestMessage.className = 'auth-message success';
                    }
                }
                
                // Show step 2
                showPasswordResetStep2();
            } else {
                throw new Error(response.error || 'Failed to send reset code');
            }
        } catch (error) {
            console.error('Password reset request error:', error);
            if (resetRequestMessage) {
                resetRequestMessage.textContent = error.message || 'Failed to send reset code. Please try again.';
                resetRequestMessage.className = 'auth-message error';
            }
        }
    }
    
    async function handlePasswordResetConfirm() {
        const emailInput = document.getElementById('reset-email');
        const codeInput = document.getElementById('reset-code');
        const newPasswordInput = document.getElementById('reset-new-password');
        const confirmPasswordInput = document.getElementById('reset-confirm-password');
        const codeError = document.getElementById('reset-code-error');
        const newPasswordError = document.getElementById('reset-new-password-error');
        const confirmPasswordError = document.getElementById('reset-confirm-password-error');
        const resetConfirmMessage = document.getElementById('reset-confirm-message');
        
        if (!emailInput || !codeInput || !newPasswordInput || !confirmPasswordInput) return;
        
        const email = emailInput.getAttribute('data-email') || emailInput.value.trim().toLowerCase();
        const code = codeInput.value.trim();
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // Clear previous errors
        [codeError, newPasswordError, confirmPasswordError].forEach(el => {
            if (el) {
                el.textContent = '';
                el.style.display = 'none';
            }
        });
        if (resetConfirmMessage) {
            resetConfirmMessage.textContent = '';
            resetConfirmMessage.className = 'auth-message';
        }
        
        // Validate inputs
        if (!code) {
            if (codeError) {
                codeError.textContent = 'Please enter the verification code';
                codeError.style.display = 'block';
            }
            return;
        }
        
        if (!/^\d{6}$/.test(code)) {
            if (codeError) {
                codeError.textContent = 'Verification code must be 6 digits';
                codeError.style.display = 'block';
            }
            return;
        }
        
        if (!newPassword) {
            if (newPasswordError) {
                newPasswordError.textContent = 'Please enter a new password';
                newPasswordError.style.display = 'block';
            }
            return;
        }
        
        if (newPassword.length < 6) {
            if (newPasswordError) {
                newPasswordError.textContent = 'Password must be at least 6 characters long';
                newPasswordError.style.display = 'block';
            }
            return;
        }
        
        if (newPassword !== confirmPassword) {
            if (confirmPasswordError) {
                confirmPasswordError.textContent = 'Passwords do not match';
                confirmPasswordError.style.display = 'block';
            }
            return;
        }
        
        // Reset password
        try {
            if (typeof PasswordResetAPI === 'undefined') {
                throw new Error('API not loaded');
            }
            
            const response = await PasswordResetAPI.resetPassword(email, code, newPassword);
            
            if (response.success) {
                if (resetConfirmMessage) {
                    resetConfirmMessage.textContent = 'Password reset successfully! You can now login with your new password.';
                    resetConfirmMessage.className = 'auth-message success';
                }
                
                // Redirect to login after 2 seconds
                setTimeout(() => {
                    switchTab('login');
                    if (loginFormElement) loginFormElement.reset();
                }, 2000);
            } else {
                throw new Error(response.error || 'Failed to reset password');
            }
        } catch (error) {
            console.error('Password reset confirm error:', error);
            const errorMessage = error.message || 'Failed to reset password. Please check your code and try again.';
            
            if (errorMessage.includes('code') || errorMessage.includes('expired') || errorMessage.includes('Invalid')) {
                if (codeError) {
                    codeError.textContent = errorMessage;
                    codeError.style.display = 'block';
                }
            } else {
                if (resetConfirmMessage) {
                    resetConfirmMessage.textContent = errorMessage;
                    resetConfirmMessage.className = 'auth-message error';
                }
            }
        }
    }
    
    async function handleResendResetCode() {
        const emailInput = document.getElementById('reset-email');
        if (!emailInput) return;
        
        const email = emailInput.getAttribute('data-email') || emailInput.value.trim().toLowerCase();
        
        if (!email) {
            showAppNotification('Please enter your email address first', 'error');
            return;
        }
        
        try {
            if (typeof PasswordResetAPI === 'undefined') {
                throw new Error('API not loaded');
            }
            
            const response = await PasswordResetAPI.requestReset(email);
            if (response.success) {
                showAppNotification('New reset code sent to your email!', 'success');
            } else {
                throw new Error(response.error || 'Failed to resend code');
            }
        } catch (error) {
            showAppNotification(error.message || 'Failed to resend reset code. Please try again.', 'error');
        }
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

            // Register user via API
            try {
                if (typeof AuthAPI === 'undefined') {
                    throw new Error('API not loaded. Please refresh the page.');
                }

                const response = await AuthAPI.register(usernameValidation.value, password);
                
                if (response.success) {
                    setSession(response.username);
                    showMessage('register-message', 'Registration successful! Logging you in...', false);
                    setTimeout(() => {
                        showApp();
                        initializeApp();
                    }, 1000);
                } else {
                    throw new Error(response.error || 'Registration failed');
                }
            } catch (error) {
                console.error('Registration error:', error);
                const errorMessage = error.message || 'Registration failed. Please try again.';
                if (errorMessage.includes('already exists')) {
                    showError('register-username-error', 'Username already exists');
                } else {
                    showMessage('register-message', errorMessage, true);
                }
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

            // Login via API
            try {
                if (typeof AuthAPI === 'undefined') {
                    throw new Error('API not loaded. Please refresh the page.');
                }

                const response = await AuthAPI.login(usernameValidation.value, password);
                
                if (response.success) {
                    setSession(response.username);
                    showApp();
                    initializeApp();
                } else {
                    throw new Error(response.error || 'Login failed');
                }
            } catch (error) {
                console.error('Login error:', error);
                const errorMessage = error.message || 'Invalid username or password';
                showError('login-username-error', errorMessage);
                showError('login-password-error', errorMessage);
            }
        });
    }

    // --- Notification System for Calendar ---
    function showAppNotification(message, type = 'info') {
        // Always use the custom calendar notification system
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
        // Create custom confirmation modal
        let confirmModal = document.getElementById('app-confirmation-modal');
        if (!confirmModal) {
            confirmModal = document.createElement('div');
            confirmModal.id = 'app-confirmation-modal';
            confirmModal.className = 'task-input-modal';
            confirmModal.innerHTML = `
                <div class="modal-content">
                    <span class="close-modal">&times;</span>
                    <h3>Confirm</h3>
                    <p id="app-confirmation-message"></p>
                    <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                        <button id="app-confirmation-cancel" class="game-btn-small" style="background-color: #6c757d;">Cancel</button>
                        <button id="app-confirmation-confirm" class="game-btn-small" style="background-color: #007bff;">Confirm</button>
                    </div>
                </div>
            `;
            document.body.appendChild(confirmModal);
        }
        
        const messageEl = document.getElementById('app-confirmation-message');
        const confirmBtn = document.getElementById('app-confirmation-confirm');
        const cancelBtn = document.getElementById('app-confirmation-cancel');
        const closeBtn = confirmModal.querySelector('.close-modal');
        
        messageEl.textContent = message;
        confirmModal.style.display = 'block';
        
        // Remove old event listeners by cloning
        const newConfirmBtn = confirmBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        const newCloseBtn = closeBtn.cloneNode(true);
        
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        
        newConfirmBtn.onclick = () => {
            confirmModal.style.display = 'none';
            if (onConfirm) onConfirm();
        };
        
        newCancelBtn.onclick = () => {
            confirmModal.style.display = 'none';
            if (onCancel) onCancel();
        };
        
        newCloseBtn.onclick = () => {
            confirmModal.style.display = 'none';
            if (onCancel) onCancel();
        };
    }

    // --- Logout Handler ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            showAppConfirmation('Are you sure you want to logout?', async () => {
                await clearSession();
                showAuth();
                // Clear forms
                if (loginFormElement) loginFormElement.reset();
                if (registerFormElement) registerFormElement.reset();
            });
        });
    }

    // --- Tab Switching ---
    if (tabLogin && tabRegister && loginForm && registerForm) {
        tabLogin.addEventListener('click', function(e) {
            e.preventDefault();
            switchTab('login');
        });
        tabRegister.addEventListener('click', function(e) {
            e.preventDefault();
            switchTab('register');
        });
    } else {
        console.error('Tab switching elements not found:', {
            tabLogin: !!tabLogin,
            tabRegister: !!tabRegister,
            loginForm: !!loginForm,
            registerForm: !!registerForm
        });
    }
    
    // Handle "Create Account" button in login form
    const createAccountBtn = document.getElementById('create-account-btn');
    if (createAccountBtn) {
        createAccountBtn.addEventListener('click', function(e) {
            e.preventDefault();
            switchTab('register');
        });
    }
    
    // Handle "Back to Login" button in register form
    const backToLoginBtn = document.getElementById('back-to-login-btn');
    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            switchTab('login');
        });
    }
    
    // Handle "Forgot Password?" button in login form
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showPasswordResetForm();
        });
    }
    
    // Handle "Back to Login" button in password reset form
    const backToLoginFromResetBtn = document.getElementById('back-to-login-from-reset-btn');
    if (backToLoginFromResetBtn) {
        backToLoginFromResetBtn.addEventListener('click', function(e) {
            e.preventDefault();
            switchTab('login');
        });
    }
    
    // Handle "Change Email" button in password reset step 2
    const backToResetEmailBtn = document.getElementById('back-to-reset-email-btn');
    if (backToResetEmailBtn) {
        backToResetEmailBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showPasswordResetStep1();
        });
    }
    
    // Handle "Resend Code" button in password reset step 2
    const resendResetCodeBtn = document.getElementById('resend-reset-code-btn');
    if (resendResetCodeBtn) {
        resendResetCodeBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            await handleResendResetCode();
        });
    }
    
    // Handle password reset request form submission
    if (passwordResetRequestForm) {
        passwordResetRequestForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handlePasswordResetRequest();
        });
    }
    
    // Handle password reset confirm form submission
    if (passwordResetConfirmForm) {
        passwordResetConfirmForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handlePasswordResetConfirm();
        });
    }

    // --- App UI Elements (only accessible after authentication) ---
    let calendarPage, shopPage, gamePage, settingsPage, navCalendar, navShop, navGame, navSettings, backToCalendarBtn;
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
        settingsPage = document.getElementById('settings-page');
        navCalendar = document.getElementById('nav-calendar');
        navShop = document.getElementById('nav-shop');
        navGame = document.getElementById('nav-game');
        navSettings = document.getElementById('nav-settings');
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
        if (navSettings) {
            navSettings.addEventListener('click', (e) => {
                e.preventDefault();
                showPage('settings-page');
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
        const calendarHelpBtn = document.getElementById('calendar-help-btn');
        const calendarHelpModal = document.getElementById('calendar-help-modal');

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
        
        // Check past days for completion on page load
        checkPastDaysCompletion();
        
        // Set up interval to check past days completion every hour
        setInterval(() => {
            checkPastDaysCompletion();
        }, 60 * 60 * 1000); // Check every hour

        // Update points display on shop page
        function updatePointsDisplay() {
            const pointsDisplay = document.getElementById('points-display');
            if (pointsDisplay) {
                const pointsData = getPoints();
                pointsDisplay.textContent = pointsData.points;
            }
        }

        // Update shop display
        function updateShopDisplay() {
            const luckMultiplierLevel = getShopLuckMultiplierLevel();
            const luckMultiplierValue = getShopLuckMultiplierValue();
            const cost = getShopLuckMultiplierCost();
            
            const purchaseBtn = document.getElementById('purchase-luck-multiplier-btn');
            const multiplierDisplay = document.getElementById('luck-multiplier-display');
            const costDisplay = document.getElementById('luck-multiplier-cost');
            
            if (purchaseBtn) {
                purchaseBtn.textContent = `Upgrade (${cost} points)`;
            }
            if (multiplierDisplay) {
                multiplierDisplay.textContent = `${luckMultiplierValue}x`;
            }
            if (costDisplay) {
                costDisplay.textContent = `${cost} points`;
            }

            // Update spawn interval display
            const spawnIntervalValue = getSpawnIntervalValue();
            const spawnIntervalCost = getSpawnIntervalCost();
            const canUpgrade = canUpgradeSpawnInterval();
            
            const spawnPurchaseBtn = document.getElementById('purchase-spawn-interval-btn');
            const spawnIntervalDisplay = document.getElementById('spawn-interval-display');
            const spawnIntervalCostDisplay = document.getElementById('spawn-interval-cost');
            
            if (spawnPurchaseBtn) {
                if (canUpgrade) {
                    spawnPurchaseBtn.textContent = `Upgrade (${spawnIntervalCost} points)`;
                    spawnPurchaseBtn.disabled = false;
                } else {
                    spawnPurchaseBtn.textContent = 'Max Level';
                    spawnPurchaseBtn.disabled = true;
                }
            }
            if (spawnIntervalDisplay) {
                spawnIntervalDisplay.textContent = `${spawnIntervalValue.toFixed(1)} seconds`;
            }
            if (spawnIntervalCostDisplay) {
                spawnIntervalCostDisplay.textContent = `${spawnIntervalCost} points`;
            }
        }

        // Setup shop purchase handlers
        function setupShopHandlers() {
            const purchaseLuckBtn = document.getElementById('purchase-luck-multiplier-btn');
            if (purchaseLuckBtn) {
                purchaseLuckBtn.onclick = function() {
                    const cost = getShopLuckMultiplierCost();
                    const pointsData = getPoints();
                    
                    if (pointsData.points < cost) {
                        showAppNotification(`You do not have enough points to make this purchase. You need ${cost} points.`, 'error');
                        return;
                    }
                    
                    if (upgradeShopLuckMultiplier()) {
                        const newLevel = getShopLuckMultiplierLevel();
                        const newValue = getShopLuckMultiplierValue();
                        showAppNotification(`Luck Multiplier upgraded to Level ${newLevel} (${newValue}x)!`, 'success');
                        // Update game display if game is active
                        if (typeof gameCore !== 'undefined' && gameCore) {
                            gameCore.updateShopLuckMultiplier();
                            if (typeof updatePlayerStats === 'function') {
                                updatePlayerStats();
                            }
                            if (typeof showUpgrades === 'function') {
                                showUpgrades();
                            }
                        }
                    } else {
                        showAppNotification('You do not have enough points to make this purchase.', 'error');
                    }
                };
            }

            const purchaseSpawnIntervalBtn = document.getElementById('purchase-spawn-interval-btn');
            if (purchaseSpawnIntervalBtn) {
                purchaseSpawnIntervalBtn.onclick = function() {
                    const cost = getSpawnIntervalCost();
                    const pointsData = getPoints();
                    
                    if (pointsData.points < cost) {
                        showAppNotification(`You do not have enough points to make this purchase. You need ${cost} points.`, 'error');
                        return;
                    }
                    
                    if (!canUpgradeSpawnInterval()) {
                        showAppNotification('Item spawn speed is already at maximum level!', 'error');
                        return;
                    }
                    
                    if (upgradeSpawnInterval()) {
                        const newLevel = getSpawnIntervalLevel();
                        const newValue = getSpawnIntervalValue();
                        showAppNotification(`Item Spawn Speed upgraded to Level ${newLevel} (${newValue.toFixed(1)} seconds)!`, 'success');
                        // Update game display if game is active
                        if (typeof gameCore !== 'undefined' && gameCore) {
                            gameCore.updateSpawnInterval();
                        }
                    } else {
                        showAppNotification('You do not have enough points to make this purchase.', 'error');
                    }
                };
            }
        }

    // --- Theme Management (for settings page) ---
    function getTheme() {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        return saved || 'light'; // Default to light theme
    }
    
    function saveTheme(theme) {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
    
    function applyTheme(theme) {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark-theme');
        } else {
            root.classList.remove('dark-theme');
        }
    }
    
    // --- Email Verification Functions ---
    const VERIFICATION_CODE_STORAGE_KEY = 'emailVerificationCodes';
    const VERIFICATION_CODE_EXPIRY = 10 * 60 * 1000; // 10 minutes in milliseconds
    
    function generateVerificationCode() {
        // Generate a random 6-digit code
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    
    function storeVerificationCode(email, code) {
        const codes = JSON.parse(localStorage.getItem(VERIFICATION_CODE_STORAGE_KEY) || '{}');
        codes[email] = {
            code: code,
            timestamp: Date.now(),
            expiresAt: Date.now() + VERIFICATION_CODE_EXPIRY
        };
        localStorage.setItem(VERIFICATION_CODE_STORAGE_KEY, JSON.stringify(codes));
    }
    
    function getVerificationCode(email) {
        const codes = JSON.parse(localStorage.getItem(VERIFICATION_CODE_STORAGE_KEY) || '{}');
        const codeData = codes[email];
        if (!codeData) return null;
        
        // Check if code has expired
        if (Date.now() > codeData.expiresAt) {
            delete codes[email];
            localStorage.setItem(VERIFICATION_CODE_STORAGE_KEY, JSON.stringify(codes));
            return null;
        }
        
        return codeData.code;
    }
    
    function clearVerificationCode(email) {
        const codes = JSON.parse(localStorage.getItem(VERIFICATION_CODE_STORAGE_KEY) || '{}');
        delete codes[email];
        localStorage.setItem(VERIFICATION_CODE_STORAGE_KEY, JSON.stringify(codes));
    }
    
    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    // EmailJS Configuration
    // To set up EmailJS:
    // 1. Go to https://www.emailjs.com/ and create a free account
    // 2. Create an email service (Gmail, Outlook, etc.)
    // 3. Create an email template with variables: {{to_email}} and {{verification_code}}
    // 4. Get your Public Key from the Integration section
    // 5. Update the values below:
    const EMAILJS_CONFIG = {
        serviceId: 'service_80s1dny',      // Your EmailJS service ID
        templateId: 'template_eqp0j2e',   // Your EmailJS template ID (for email verification)
        publicKey: 'WVh8o7pHWLGBMVK_K'    // Your EmailJS public key
    };
    
    // Password Reset Email Template ID
    // Create a separate template in EmailJS for password reset emails
    // The template should include: {{to_email}} and {{reset_code}}
    const PASSWORD_RESET_TEMPLATE_ID = 'template_39qjb27'; // Your password reset template ID
    
    function isEmailJSConfigured() {
        return EMAILJS_CONFIG.serviceId !== 'YOUR_SERVICE_ID' &&
               EMAILJS_CONFIG.templateId !== 'YOUR_TEMPLATE_ID' &&
               EMAILJS_CONFIG.publicKey !== 'YOUR_PUBLIC_KEY';
    }
    
    // Define password reset email function - SAME SERVICE, DIFFERENT TEMPLATE
    // Uses the same EmailJS service (service_80s1dny) but different template (template_39qjb27)
    // Function declaration (hoisted) - defined here but available throughout the scope
    async function sendPasswordResetEmail(email, code) {
        // Exact same implementation as sendVerificationEmail, but using password reset template
        try {
            // Check if EmailJS is loaded
            if (typeof emailjs === 'undefined') {
                throw new Error('EmailJS library is not loaded. Please check that the EmailJS script is included in index.html');
            }
            
            // Check if EmailJS is configured
            if (!isEmailJSConfigured()) {
                throw new Error('EmailJS is not configured. Please update EMAILJS_CONFIG in java.js with your service ID, template ID, and public key.');
            }
            
            // Initialize EmailJS with public key (required for v4)
            emailjs.init(EMAILJS_CONFIG.publicKey);
            
            // Send email using EmailJS v4 API
            // Note: The variable names must match what you set in your EmailJS template
            // Common variable names: to_email, email, user_email, etc.
            const templateParams = {
                to_email: email,           // This should match your template's "To Email" field variable
                email: email,              // Also try this common variable name
                reset_code: code,          // This should match your template's reset code variable
                code: code,                // Also try this common variable name
                verification_code: code,   // Some templates use this name
                from_name: 'RNG Calendar'
            };
            
            console.log('Sending password reset email with EmailJS:', {
                serviceId: EMAILJS_CONFIG.serviceId,
                templateId: PASSWORD_RESET_TEMPLATE_ID,
                to_email: email,
                templateParams: templateParams
            });
            
            const response = await emailjs.send(
                EMAILJS_CONFIG.serviceId,
                PASSWORD_RESET_TEMPLATE_ID,
                templateParams
            );
            
            console.log('EmailJS response:', response);
            
            // Success - email sent
            return { success: true, method: 'email' };
        } catch (error) {
            console.error('Error sending password reset email:', error);
            console.error('Error details:', {
                message: error.message,
                text: error.text,
                status: error.status
            });
            
            // Provide more specific error messages
            let errorMessage = 'Failed to send password reset email. ';
            
            if (error.text) {
                errorMessage += `EmailJS error: ${error.text}`;
            } else if (error.message) {
                errorMessage += error.message;
            } else {
                errorMessage += 'Please check your EmailJS configuration and try again.';
            }
            
            // Return error so UI can show appropriate message
            return { 
                success: false, 
                method: 'error', 
                error: errorMessage
            };
        }
    }
    
    // Verify function is defined (for debugging)
    console.log('sendPasswordResetEmail defined:', typeof sendPasswordResetEmail);
    
    async function sendVerificationEmail(email, code) {
        try {
            // Check if EmailJS is loaded
            if (typeof emailjs === 'undefined') {
                throw new Error('EmailJS library is not loaded. Please check that the EmailJS script is included in index.html');
            }
            
            // Check if EmailJS is configured
            if (!isEmailJSConfigured()) {
                throw new Error('EmailJS is not configured. Please update EMAILJS_CONFIG in java.js with your service ID, template ID, and public key.');
            }
            
            // Initialize EmailJS with public key (required for v4)
            emailjs.init(EMAILJS_CONFIG.publicKey);
            
            // Send email using EmailJS v4 API
            // Note: The variable names must match what you set in your EmailJS template
            // Common variable names: to_email, email, user_email, etc.
            const templateParams = {
                to_email: email,           // This should match your template's "To Email" field variable
                email: email,              // Also try this common variable name
                verification_code: code,   // This should match your template's verification code variable
                code: code,                // Also try this common variable name
                from_name: 'RNG Calendar'
            };
            
            console.log('Sending email with EmailJS:', {
                serviceId: EMAILJS_CONFIG.serviceId,
                templateId: EMAILJS_CONFIG.templateId,
                to_email: email,
                templateParams: templateParams
            });
            
            const response = await emailjs.send(
                EMAILJS_CONFIG.serviceId,
                EMAILJS_CONFIG.templateId,
                templateParams
            );
            
            console.log('EmailJS response:', response);
            
            // Success - email sent
            return { success: true, method: 'email' };
        } catch (error) {
            console.error('Error sending verification email:', error);
            console.error('Error details:', {
                message: error.message,
                text: error.text,
                status: error.status
            });
            
            // Provide more specific error messages
            let errorMessage = 'Failed to send verification email. ';
            
            if (error.text) {
                errorMessage += `EmailJS error: ${error.text}`;
            } else if (error.message) {
                errorMessage += error.message;
            } else {
                errorMessage += 'Please check your EmailJS configuration and try again.';
            }
            
            // Return error so UI can show appropriate message
            return { 
                success: false, 
                method: 'error', 
                error: errorMessage
            };
        }
    }
    
    async function handleSendVerificationEmail() {
        const emailInput = document.getElementById('email-input');
        const emailError = document.getElementById('email-error');
        const emailMessage = document.getElementById('email-message');
        
        if (!emailInput) return;
        
        // Sanitize and trim email
        let email = sanitizeInput(emailInput.value);
        email = email.trim().toLowerCase();
        
        // Clear previous messages
        if (emailError) {
            emailError.textContent = '';
            emailError.style.display = 'none';
        }
        if (emailMessage) {
            emailMessage.textContent = '';
            emailMessage.className = 'email-message';
        }
        
        // Validate email
        if (!email) {
            if (emailError) {
                emailError.textContent = 'Please enter an email address';
                emailError.style.display = 'block';
            }
            return;
        }
        
        if (!validateEmail(email)) {
            if (emailError) {
                emailError.textContent = 'Please enter a valid email address';
                emailError.style.display = 'block';
            }
            return;
        }
        
        // Generate and store verification code
        const code = generateVerificationCode();
        
        // Store verification code via API
        try {
            if (typeof EmailAPI !== 'undefined') {
                await EmailAPI.storeVerificationCode(email, code);
            }
        } catch (error) {
            console.error('Error storing verification code:', error);
            // Continue anyway - code will be sent via email
        }
        
        // Send verification email first
        const sendBtn = document.getElementById('send-verification-btn');
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.textContent = 'Sending...';
        }
        
        try {
            const result = await sendVerificationEmail(email, code);
            
            if (result.success) {
        // Save email to user account (but not verified yet) so the verification input shows
        try {
            if (typeof UserAPI !== 'undefined') {
                await UserAPI.updateEmail(email, false);
            }
        } catch (error) {
            console.error('Error saving email:', error);
            // If authentication error, redirect to login
            if (error.message && error.message.includes('Authentication required')) {
                console.log('Session expired, redirecting to login');
                showAuth();
                return;
            }
            // Continue anyway - email will be saved after verification
        }
                
                // Show success message - NEVER show the code in the UI
                if (emailMessage) {
                    emailMessage.textContent = 'Verification code sent to your email! Please check your inbox (and spam folder) for the 6-digit code.';
                    emailMessage.className = 'email-message success';
                }
                
                // Rebuild settings page to show verification code input
                // Pass the email to preserve it even if API hasn't updated yet
                setTimeout(async () => {
                    await buildSettingsPage(email);
                    setupSettingsHandlers();
                }, 500);
            } else {
                // Show error message
                const errorMsg = result.error || 'Failed to send verification email. Please try again.';
                if (emailMessage) {
                    emailMessage.textContent = errorMsg;
                    emailMessage.className = 'email-message error';
                }
                showAppNotification(errorMsg, 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            if (emailMessage) {
                emailMessage.textContent = 'Error sending verification email. Please try again.';
                emailMessage.className = 'email-message error';
            }
            showAppNotification('Error sending verification email. Please try again.', 'error');
        } finally {
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Send Verification Email';
            }
        }
    }
    
    async function handleResendVerificationCode() {
        const emailInput = document.getElementById('email-input');
        if (!emailInput) return;
        
        const email = emailInput.value.trim();
        if (!email || !validateEmail(email)) {
            showAppNotification('Please enter a valid email address first', 'error');
            return;
        }
        
        // Generate new code
        const code = generateVerificationCode();
        storeVerificationCode(email, code);
        
        // Send email
        const resendBtn = document.getElementById('resend-code-btn');
        if (resendBtn) {
            resendBtn.disabled = true;
            resendBtn.textContent = 'Resending...';
        }
        
        try {
            const result = await sendVerificationEmail(email, code);
            if (result.success) {
                // NEVER show the code - only confirm email was sent
                showAppNotification('New verification code sent to your email!', 'success');
            } else {
                const errorMsg = result.error || 'Failed to resend verification code. Please try again.';
                showAppNotification(errorMsg, 'error');
            }
        } catch (error) {
            showAppNotification('Error resending verification code. Please try again.', 'error');
        } finally {
            if (resendBtn) {
                resendBtn.disabled = false;
                resendBtn.textContent = 'Resend Code';
            }
        }
    }
    
    async function handleVerifyCode() {
        const emailInput = document.getElementById('email-input');
        const codeInput = document.getElementById('verification-code-input');
        const codeError = document.getElementById('verification-code-error');
        const emailMessage = document.getElementById('email-message');
        
        if (!emailInput || !codeInput) return;
        
        const email = emailInput.value.trim();
        const enteredCode = codeInput.value.trim();
        
        // Clear previous messages
        if (codeError) {
            codeError.textContent = '';
            codeError.style.display = 'none';
        }
        if (emailMessage) {
            emailMessage.textContent = '';
            emailMessage.className = 'email-message';
        }
        
        // Validate code format
        if (!enteredCode) {
            if (codeError) {
                codeError.textContent = 'Please enter the verification code';
                codeError.style.display = 'block';
            }
            return;
        }
        
        if (!/^\d{6}$/.test(enteredCode)) {
            if (codeError) {
                codeError.textContent = 'Verification code must be 6 digits';
                codeError.style.display = 'block';
            }
            return;
        }
        
        // Verify code via API
        try {
            if (typeof EmailAPI === 'undefined' || typeof UserAPI === 'undefined') {
                throw new Error('API not loaded');
            }

            const verifyResponse = await EmailAPI.verifyCode(email, enteredCode);
            
            if (!verifyResponse.valid) {
                if (codeError) {
                    codeError.textContent = verifyResponse.error || 'Invalid or expired verification code. Please try again.';
                    codeError.style.display = 'block';
                }
                return;
            }

            // Update user email as verified
            await UserAPI.updateEmail(email, true);
            
        } catch (error) {
            console.error('Error verifying code:', error);
            // If authentication error, redirect to login
            if (error.message && error.message.includes('Authentication required')) {
                console.log('Session expired, redirecting to login');
                showAuth();
                return;
            }
            if (codeError) {
                codeError.textContent = 'Error verifying code. Please try again.';
                codeError.style.display = 'block';
            }
            return;
        }
        
        // Show success message
        if (emailMessage) {
            emailMessage.textContent = 'Email verified and associated with your account!';
            emailMessage.className = 'email-message success';
        }
        
        showAppNotification('Email verified successfully!', 'success');
        
        // Rebuild settings page to show verified status
        setTimeout(() => {
            buildSettingsPage();
            setupSettingsHandlers();
        }, 500);
    }
    
    async function handleChangeEmail() {
        const currentUser = getCurrentUser();
        if (!currentUser) return;
        
        try {
            // Clear email and verification status via API
            // This allows the user to enter a new email and verify it
            if (typeof UserAPI !== 'undefined') {
                await UserAPI.updateEmail('', false);
                
                // Rebuild settings page to show email input form
                await buildSettingsPage();
                setupSettingsHandlers();
                
                showAppNotification('Email cleared. You can now enter a new email address.', 'success');
            } else {
                throw new Error('API not loaded');
            }
        } catch (error) {
            console.error('Error changing email:', error);
            // If authentication error, redirect to login
            if (error.message && error.message.includes('Authentication required')) {
                console.log('Session expired, redirecting to login');
                showAuth();
                return;
            }
            showAppNotification('Failed to change email. Please try again.', 'error');
        }
    }
    
    // --- Build Settings Page ---
    async function buildSettingsPage(preservedEmail = null) {
        const settingsPage = document.getElementById('settings-page');
        if (!settingsPage) return;
        
        const currentTheme = getTheme();
        let userEmail = '';
        let emailVerified = false;
        
        // Check if there's an email in the input field (in case API hasn't updated yet)
        const emailInput = document.getElementById('email-input');
        const pendingEmail = emailInput ? emailInput.value.trim() : '';
        
        // Fetch user data from API
        try {
            if (typeof UserAPI !== 'undefined') {
                const user = await UserAPI.getUser();
                userEmail = user.email || '';
                emailVerified = user.email_verified === 1 || user.email_verified === true;
            }
        } catch (error) {
            console.error('Error fetching user data for settings:', error);
            // Continue with empty values if API fails
        }
        
        // Use preserved email (passed parameter) if provided, then pending email, then API email
        // This ensures the verification input shows immediately after sending email
        if (preservedEmail) {
            userEmail = preservedEmail;
        } else if (!userEmail && pendingEmail) {
            userEmail = pendingEmail;
        }
        
        settingsPage.innerHTML = `
            <div class="settings-container">
                <div class="settings-section">
                    <h3>Appearance</h3>
                    <div class="settings-item">
                        <h4>Theme</h4>
                        <p class="settings-description">Choose between light and dark theme for the application.</p>
                        <div class="theme-selector">
                            <label class="theme-option">
                                <input type="radio" name="theme" id="theme-light" value="light" ${currentTheme === 'light' ? 'checked' : ''}>
                                <span>Light</span>
                            </label>
                            <label class="theme-option">
                                <input type="radio" name="theme" id="theme-dark" value="dark" ${currentTheme === 'dark' ? 'checked' : ''}>
                                <span>Dark</span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h3>Email Verification</h3>
                    <div class="settings-item">
                        <h4>Associate Email with Account</h4>
                        <p class="settings-description">
                            Add an email address to your account. You'll receive a verification code to confirm your email.
                        </p>
                        ${emailVerified && userEmail ? `
                            <div class="email-status verified">
                                <span class="email-status-icon">✓</span>
                                <span class="email-status-text">Email verified: <strong>${userEmail}</strong></span>
                            </div>
                            <button id="change-email-btn" class="secondary-btn">Change Email</button>
                        ` : `
                            <div class="email-verification-container">
                                <div class="form-group">
                                    <label for="email-input">Email Address</label>
                                    <input type="email" id="email-input" placeholder="Enter your email address" value="${userEmail || ''}" ${emailVerified ? 'disabled' : ''}>
                                    <span class="error-message" id="email-error"></span>
                                </div>
                                ${!emailVerified && userEmail ? `
                                    <div class="form-group">
                                        <label for="verification-code-input">Verification Code</label>
                                        <input type="text" id="verification-code-input" placeholder="Enter 6-digit code" maxlength="6" pattern="[0-9]{6}">
                                        <span class="error-message" id="verification-code-error"></span>
                                        <small class="verification-hint">Check your email (and spam folder) for the 6-digit verification code</small>
                                    </div>
                                    <div class="verification-actions">
                                        <button id="verify-code-btn" class="primary-btn">Verify Code</button>
                                        <button id="resend-code-btn" class="secondary-btn">Resend Code</button>
                                    </div>
                                ` : `
                                    <button id="send-verification-btn" class="primary-btn">Send Verification Email</button>
                                `}
                            </div>
                        `}
                        <div id="email-message" class="email-message"></div>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h3>Account Management</h3>
                    <div class="settings-item">
                        <h4>Delete Account</h4>
                        <p class="settings-description">
                            Permanently delete your account and all associated data. This includes:
                        </p>
                        <ul style="color: var(--text-secondary, #6c757d); margin: 10px 0 20px 20px; line-height: 1.8;">
                            <li>Your username and password</li>
                            <li>All calendar tasks and events</li>
                            <li>All points and shop purchases</li>
                            <li>All game progress, items, and upgrades</li>
                            <li>All game settings</li>
                        </ul>
                        <p class="settings-description" style="color: var(--error-color, #dc3545); font-weight: bold;">
                            ⚠️ This action cannot be undone!
                        </p>
                        <button id="delete-account-btn" class="delete-account-btn">Delete Account</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // --- Settings Handlers ---
    function setupSettingsHandlers() {
        const deleteAccountBtn = document.getElementById('delete-account-btn');
        if (deleteAccountBtn) {
            deleteAccountBtn.onclick = function() {
                showAppConfirmation(
                    'Are you sure you want to delete your account? This will permanently remove ALL your data including:\n\n' +
                    '• Your username and password\n' +
                    '• All calendar tasks\n' +
                    '• All points and shop purchases\n' +
                    '• All game progress and items\n\n' +
                    'This action CANNOT be undone!',
                    () => {
                        deleteAccount();
                    }
                );
            };
        }
        
        // Email verification handlers
        const sendVerificationBtn = document.getElementById('send-verification-btn');
        if (sendVerificationBtn) {
            sendVerificationBtn.onclick = handleSendVerificationEmail;
        }
        
        const verifyCodeBtn = document.getElementById('verify-code-btn');
        if (verifyCodeBtn) {
            verifyCodeBtn.onclick = handleVerifyCode;
        }
        
        const resendCodeBtn = document.getElementById('resend-code-btn');
        if (resendCodeBtn) {
            resendCodeBtn.onclick = handleResendVerificationCode;
        }
        
        const changeEmailBtn = document.getElementById('change-email-btn');
        if (changeEmailBtn) {
            changeEmailBtn.onclick = handleChangeEmail;
        }
        
        // Allow Enter key to submit verification code and restrict to numbers only
        const verificationCodeInput = document.getElementById('verification-code-input');
        if (verificationCodeInput) {
            // Only allow numeric input
            verificationCodeInput.addEventListener('input', function(e) {
                this.value = this.value.replace(/[^0-9]/g, '');
            });
            
            // Allow Enter key to submit
            verificationCodeInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    handleVerifyCode();
                }
            });
        }
        
        // Restrict reset code input to numbers only
        const resetCodeInput = document.getElementById('reset-code');
        if (resetCodeInput) {
            resetCodeInput.addEventListener('input', function(e) {
                this.value = this.value.replace(/[^0-9]/g, '');
            });
        }
        
        // Theme selector handlers
        const themeLight = document.getElementById('theme-light');
        const themeDark = document.getElementById('theme-dark');
        
        if (themeLight && themeDark) {
            // Set current theme selection
            const currentTheme = getTheme();
            if (currentTheme === 'dark') {
                themeDark.checked = true;
            } else {
                themeLight.checked = true;
            }
            
            // Add change listeners
            themeLight.addEventListener('change', function() {
                if (this.checked) {
                    saveTheme('light');
                    applyTheme('light');
                }
            });
            
            themeDark.addEventListener('change', function() {
                if (this.checked) {
                    saveTheme('dark');
                    applyTheme('dark');
                }
            });
        }
    }

    async function deleteAccount() {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            showAppNotification('No user is currently logged in.', 'error');
            return;
        }

        try {
            // Delete account via API
            if (typeof UserAPI === 'undefined') {
                throw new Error('API not loaded');
            }

            await UserAPI.deleteAccount();

            // Clear session
            await clearSession();

            // Stop game loops if game is running
            if (typeof gameCore !== 'undefined' && gameCore && gameCore.stopGameLoops) {
                gameCore.stopGameLoops();
            }

            // Show auth page
            showAuth();
            
            // Clear forms
            if (loginFormElement) loginFormElement.reset();
            if (registerFormElement) registerFormElement.reset();

            showAppNotification('Your account has been permanently deleted.', 'success');
        } catch (error) {
            console.error('Error deleting account:', error);
            showAppNotification('An error occurred while deleting your account. Please try again.', 'error');
        }
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
            updatePointsDisplay();
            updateShopDisplay();
            setupShopHandlers();
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
        } else if (pageId === 'settings-page') {
            if (settingsPage) {
                settingsPage.classList.add('active');
                // buildSettingsPage is now async, so we need to await it
                buildSettingsPage().then(() => {
                    setupSettingsHandlers();
                }).catch(error => {
                    console.error('Error building settings page:', error);
                    setupSettingsHandlers();
                });
            }
            if (navSettings) {
                navSettings.classList.add('active');
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
            } else if (e.target.id === 'nav-settings') {
                e.preventDefault();
                e.stopPropagation();
                showPage('settings-page');
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
            } else if (e.target.id === 'nav-settings') {
                e.preventDefault();
                e.stopPropagation();
                const showPageFunc = window.showPage || (typeof showPage !== 'undefined' ? showPage : null);
                if (showPageFunc && typeof showPageFunc === 'function') {
                    showPageFunc('settings-page');
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

    function isToday(dateKey) {
        const today = new Date();
        const todayKey = formatDateKey(today);
        return dateKey === todayKey;
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
            // Use a more reliable API: AbstractAPI Holidays API (free tier available)
            // Alternative: Use date.nager.at but ensure correct date parsing
            // For now, using date.nager.at with proper date handling
            const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const holidaysData = await response.json();
            
            // Validate and fix dates - ensure dates are correct (no timezone issues)
            const validatedHolidays = holidaysData.map(holiday => {
                // Parse date string (YYYY-MM-DD) and create a new date object
                // This ensures we're using the correct date regardless of timezone
                const dateParts = holiday.date.split('-');
                const holidayDate = new Date(
                    parseInt(dateParts[0]), // year
                    parseInt(dateParts[1]) - 1, // month (0-indexed)
                    parseInt(dateParts[2]) // day
                );
                
                // Reconstruct date string to ensure it's correct
                const correctedDate = `${holidayDate.getFullYear()}-${String(holidayDate.getMonth() + 1).padStart(2, '0')}-${String(holidayDate.getDate()).padStart(2, '0')}`;
                
                return {
                    ...holiday,
                    date: correctedDate
                };
            });
            
            // Cache the validated holidays
            holidaysCache[cacheKey] = validatedHolidays;
            localStorage.setItem('holidaysCache', JSON.stringify(holidaysCache));
            
            return validatedHolidays;
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
            // Parse date string (YYYY-MM-DD) directly to avoid timezone issues
            const dateParts = holiday.date.split('-');
            const holidayYear = parseInt(dateParts[0]);
            const holidayMonth = parseInt(dateParts[1]) - 1; // Month is 0-indexed
            const holidayDay = parseInt(dateParts[2]);
            
            // Only include holidays for the current month and year
            if (holidayYear === year && holidayMonth === month) {
                // Create date key using the parsed values directly (no timezone conversion)
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(holidayDay).padStart(2, '0')}`;
                
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
                    const completedClass = task.completed ? 'completed' : '';
                    const checkmarkIcon = task.completed ? '✓' : '○';
                    return `<div class="task-preview-item ${completedClass}" data-task-id="${task.id}" data-date="${dateKey}">
                        <button class="complete-task-small" data-task-id="${task.id}" data-date="${dateKey}" title="${task.completed ? 'Mark incomplete' : 'Mark complete'}">${checkmarkIcon}</button>
                        <div class="task-preview-content">
                            ${timePart}<span class="task-desc-small">${task.description}</span>
                        </div>
                        <button class="delete-task-small" data-task-id="${task.id}" data-date="${dateKey}" title="Delete task">×</button>
                    </div>`;
                }).join('');
                if (dayTasks.length > 3) {
                    tasksPreview += `<div class="task-preview-more" data-date="${dateKey}" style="cursor: pointer; text-decoration: underline;">+${dayTasks.length - 3} more</div>`;
                }
            }

            dayCell.innerHTML = `
                <div class="day-number">${day}</div>
                <div class="day-tasks-preview">
                    ${holidaysPreview}
                    ${tasksPreview}
                </div>
            `;

            // Add click handler to open task modal (but not if clicking on delete button or checkmark)
            dayCell.addEventListener('click', (e) => {
                // Don't open modal if clicking on delete button or checkmark
                if (e.target.classList.contains('delete-task-small') || e.target.classList.contains('complete-task-small')) {
                    return;
                }
                // Don't open modal if clicking inside a task preview item (except the delete/checkmark buttons)
                if (e.target.closest('.task-preview-item') && !e.target.classList.contains('delete-task-small') && !e.target.classList.contains('complete-task-small')) {
                    return;
                }
                
                // Prevent adding tasks to past dates (but allow today and future dates)
                const taskDate = new Date(date);
                const today = new Date();
                const todayStart = new Date(today);
                todayStart.setHours(0, 0, 0, 0);
                const taskDateStart = new Date(taskDate);
                taskDateStart.setHours(0, 0, 0, 0);
                
                if (taskDateStart < todayStart) {
                    showAppNotification('You cannot add tasks to past dates.', 'error');
                    return;
                }
                // Allow today and future dates - time validation happens on form submit
                
                selectedDateInput.value = dateKey;
                selectedDateDisplay.textContent = formatDateDisplay(date);
                // Reset form to defaults
                document.getElementById('task-description').value = '';
                document.getElementById('task-hour').value = '';
                document.getElementById('task-minute').value = '';
                document.getElementById('task-ampm').value = 'AM';
                taskModal.style.display = 'block';
            });

            // Add delete and complete handlers for task preview items
            dayCell.addEventListener('click', (e) => {
                // Check if click is on delete button or inside it
                const deleteBtn = e.target.closest('.delete-task-small');
                if (deleteBtn) {
                    e.stopPropagation(); // Prevent opening the modal
                    e.preventDefault();
                    const taskId = parseInt(deleteBtn.getAttribute('data-task-id'));
                    const taskDateKey = deleteBtn.getAttribute('data-date');
                    
                    showAppConfirmation('Are you sure you want to delete this task?', () => {
                        tasks[taskDateKey] = tasks[taskDateKey].filter(t => t.id !== taskId);
                        if (tasks[taskDateKey].length === 0) {
                            delete tasks[taskDateKey];
                        }
                        saveTasks();
                        renderCalendar();
                    }, null);
                    return;
                }
                
                // Check if click is on complete button or inside it
                const completeBtn = e.target.closest('.complete-task-small');
                if (completeBtn) {
                    e.stopPropagation(); // Prevent opening the modal
                    e.preventDefault();
                    const taskId = parseInt(completeBtn.getAttribute('data-task-id'));
                    const taskDateKey = completeBtn.getAttribute('data-date');
                    
                    // Only allow completion of tasks from today
                    if (!isToday(taskDateKey)) {
                        showAppNotification('You can only complete tasks from today\'s date.', 'error');
                        return;
                    }
                    
                    const task = tasks[taskDateKey].find(t => t.id === taskId);
                    if (task) {
                        const wasCompleted = task.completed;
                        task.completed = !task.completed;
                        saveTasks();
                        renderCalendar();
                        
                        // Award 1 point for completing a task (only when marking as completed, not uncompleting)
                        if (task.completed && !wasCompleted) {
                            awardTaskCompletionPoint(taskId);
                        }
                        
                        // Check if all tasks for this day are completed (awards 5 points)
                        checkDayCompletion(taskDateKey);
                        // Also check if all tasks for the week are completed (only on Sunday, awards 25 points)
                        checkWeekCompletion();
                    }
                    return;
                }
            });

            // Add click handler for "+X more" to view tasks
            dayCell.addEventListener('click', (e) => {
                if (e.target.classList.contains('task-preview-more')) {
                    e.stopPropagation();
                    const taskDateKey = e.target.getAttribute('data-date');
                    if (taskDateKey) {
                        showTaskDetails(taskDateKey, new Date(taskDateKey));
                    }
                }
            });

            calendarGrid.appendChild(dayCell);
        }
    }

    // --- Points System ---
        function getPoints() {
            const currentUser = getCurrentUser();
            const saved = localStorage.getItem(`calendarPoints_${currentUser}`);
            const defaultData = { points: 0, completedWeeks: [], completedDays: [], completedTasks: [], shop_luck_multiplier_level: 1, spawn_interval_level: 1 };
            if (saved) {
                const parsed = JSON.parse(saved);
                // Ensure new fields exist for backward compatibility
                if (typeof parsed.spawn_interval_level === 'undefined') {
                    parsed.spawn_interval_level = 1;
                }
                return { ...defaultData, ...parsed };
            }
            return defaultData;
        }

        function savePoints(pointsData) {
            const currentUser = getCurrentUser();
            localStorage.setItem(`calendarPoints_${currentUser}`, JSON.stringify(pointsData));
        }

        function getShopLuckMultiplierLevel() {
            const pointsData = getPoints();
            return pointsData.shop_luck_multiplier_level || 1;
        }

        function getShopLuckMultiplierValue() {
            return getShopLuckMultiplierLevel(); // Level 1 = 1x, Level 2 = 2x, etc.
        }

        function getShopLuckMultiplierCost() {
            const level = getShopLuckMultiplierLevel();
            return 5 + (level - 1) * 10; // Level 1: 5, Level 2: 15, Level 3: 25, etc.
        }

        function upgradeShopLuckMultiplier() {
            const pointsData = getPoints();
            const cost = getShopLuckMultiplierCost();
            
            if (pointsData.points < cost) {
                return false; // Not enough points
            }
            
            pointsData.points -= cost;
            pointsData.shop_luck_multiplier_level = (pointsData.shop_luck_multiplier_level || 1) + 1;
            savePoints(pointsData);
            updatePointsDisplay();
            updateShopDisplay();
            
            // Notify game core to update multipliers
            if (typeof gameCore !== 'undefined' && gameCore) {
                gameCore.updateShopLuckMultiplier();
            }
            
            return true;
        }

        function getSpawnIntervalLevel() {
            const pointsData = getPoints();
            return pointsData.spawn_interval_level || 1;
        }

        function getSpawnIntervalValue() {
            const level = getSpawnIntervalLevel();
            // Level 1 = 5.0 seconds, each level reduces by 0.5, minimum 1.5
            const interval = 5.0 - (level - 1) * 0.5;
            return Math.max(interval, 1.5);
        }

        function getSpawnIntervalCost() {
            const level = getSpawnIntervalLevel();
            // Starts at 10, doubles each purchase: 10, 20, 40, 80, etc.
            return 10 * Math.pow(2, level - 1);
        }

        function canUpgradeSpawnInterval() {
            const interval = getSpawnIntervalValue();
            return interval > 1.5; // Can upgrade if not at minimum
        }

        function upgradeSpawnInterval() {
            const pointsData = getPoints();
            const cost = getSpawnIntervalCost();
            
            if (pointsData.points < cost) {
                return false; // Not enough points
            }
            
            if (!canUpgradeSpawnInterval()) {
                return false; // Already at minimum
            }
            
            pointsData.points -= cost;
            pointsData.spawn_interval_level = (pointsData.spawn_interval_level || 1) + 1;
            savePoints(pointsData);
            updatePointsDisplay();
            updateShopDisplay();
            
            // Notify game core to update spawn interval
            if (typeof gameCore !== 'undefined' && gameCore) {
                gameCore.updateSpawnInterval();
            }
            
            return true;
        }

        function addPoint() {
            const pointsData = getPoints();
            pointsData.points += 1;
            savePoints(pointsData);
            // Always update display when points are added
            updatePointsDisplay();
            return pointsData.points;
        }

        // Award 1 point for completing an individual task
        function awardTaskCompletionPoint(taskId) {
            const pointsData = getPoints();
            
            // Initialize completedTasks array if it doesn't exist
            if (!pointsData.completedTasks) {
                pointsData.completedTasks = [];
            }
            
            // Check if we've already awarded points for this task
            if (pointsData.completedTasks.includes(taskId)) {
                return false; // Already awarded
            }
            
            // Award 1 point and mark task as completed for points
            pointsData.completedTasks.push(taskId);
            pointsData.points += 1;
            savePoints(pointsData);
            updatePointsDisplay();
            showAppNotification(`Task completed! You've earned 1 point! (Total: ${pointsData.points} points)`, 'success');
            return true;
        }

        function spendPoint(amount = 1) {
            const pointsData = getPoints();
            if (pointsData.points < amount) {
                return false; // Not enough points
            }
            pointsData.points -= amount;
            savePoints(pointsData);
            updatePointsDisplay(); // Update the display when points are spent
            return true;
        }

        // Get Monday of the current week
        function getWeekStart(date) {
            const d = new Date(date);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
            return new Date(d.setDate(diff));
        }

        // Get week key (YYYY-MM-DD format for Monday)
        function getWeekKey(date) {
            const weekStart = getWeekStart(date);
            return `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
        }

        // Check if all tasks for a single day are completed (awards 5 points)
        function checkDayCompletion(taskDateKey) {
            const dateKey = taskDateKey || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
            const pointsData = getPoints();
            
            // Check if we've already awarded points for this day
            if (pointsData.completedDays && pointsData.completedDays.includes(dateKey)) {
                return false;
            }
            
            // Initialize completedDays array if it doesn't exist
            if (!pointsData.completedDays) {
                pointsData.completedDays = [];
            }

            // Get tasks for this day
            const dayTasks = tasks[dateKey] || [];
            
            // If there are no tasks for this day, don't award points
            if (dayTasks.length === 0) {
                return false;
            }
            
            // Check if all tasks for this day are completed
            const allCompleted = dayTasks.every(task => task.completed);
            
            if (allCompleted) {
                pointsData.completedDays.push(dateKey);
                // Award 5 points for daily completion
                pointsData.points += 5;
                savePoints(pointsData);
                updatePointsDisplay();
                showAppNotification(`You've completed all your tasks for ${dateKey}! You've earned 5 points! (Total: ${pointsData.points} points)`, 'success');
                return true;
            }

            return false;
        }
        
        // Check all past days for completion (called periodically or on page load)
        function checkPastDaysCompletion() {
            const today = new Date();
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            
            // Check all days in tasks that are before today
            for (const dateKey in tasks) {
                const [year, month, day] = dateKey.split('-').map(Number);
                const taskDate = new Date(year, month - 1, day);
                const taskDateStart = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
                
                // Only check days that have ended
                if (taskDateStart < todayStart) {
                    checkDayCompletion(dateKey);
                }
            }
        }

        // Check if all tasks for the week are completed (awards 10 points)
        function checkWeekCompletion() {
            const today = new Date();
            const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            
            // Only check on Sunday (day 0) to ensure the week is complete
            if (dayOfWeek !== 0) {
                return false;
            }
            
            const weekKey = getWeekKey(today);
            const pointsData = getPoints();
            
            // Check if we've already awarded points for this week
            if (pointsData.completedWeeks.includes(weekKey)) {
                return false;
            }

            // Get all days in the current week (Monday-Sunday)
            const weekStart = getWeekStart(today);
            const weekDays = [];
            for (let i = 0; i < 7; i++) {
                const day = new Date(weekStart);
                day.setDate(weekStart.getDate() + i);
                const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                weekDays.push({ date: day, dateKey: dateKey });
            }

            // Check if all tasks for all days in the week are completed
            // Only count tasks that were created during the week (Monday through Sunday)
            let allCompleted = true;
            let hasTasks = false;
            const weekEndTime = today.getTime(); // Sunday (today) - current time
            const weekStartTime = getWeekStart(today).getTime(); // Monday 00:00:00 - start of week

            for (const dayInfo of weekDays) {
                const dayTasks = tasks[dayInfo.dateKey] || [];
                // Filter tasks to only include those created during the week
                const validTasks = dayTasks.filter(task => {
                    // If task has a created_at timestamp, check it was created during the week
                    if (task.created_at) {
                        // Task must be created between Monday 00:00 and current time on Sunday
                        return task.created_at >= weekStartTime && task.created_at <= weekEndTime;
                    }
                    // For backward compatibility: tasks without timestamp
                    // Only count if the day is part of the current week (Monday-Sunday)
                    // Since we're checking on Sunday, all days Monday-Saturday are valid
                    // For Sunday, we need to be careful - but since we prevent adding to past dates,
                    // any Sunday task without a timestamp is likely old and shouldn't count
                    const dayTime = dayInfo.date.getTime();
                    const dayStart = new Date(dayInfo.date);
                    dayStart.setHours(0, 0, 0, 0);
                    // Only count tasks from days in the current week
                    return dayStart.getTime() >= weekStartTime && dayStart.getTime() <= weekEndTime;
                });
                
                if (validTasks.length > 0) {
                    hasTasks = true;
                    const allDayTasksCompleted = validTasks.every(task => task.completed);
                    if (!allDayTasksCompleted) {
                        allCompleted = false;
                        break;
                    }
                }
            }

            // Only award if there are tasks and all are completed
            // Note: Days with 0 tasks don't count against completion
            if (hasTasks && allCompleted) {
                pointsData.completedWeeks.push(weekKey);
                // Award 25 points for weekly completion
                pointsData.points += 25;
                savePoints(pointsData);
                updatePointsDisplay();
                showAppNotification(`You've completed all your tasks for this week! You've earned 25 points! (Total: ${pointsData.points} points)`, 'success');
                return true;
            }

            return false;
        }

    // --- Task Management ---
        function saveTasks() {
            const currentUser = getCurrentUser();
            localStorage.setItem(`calendarTasks_${currentUser}`, JSON.stringify(tasks));
        }

        function addTask(dateKey, description, time) {
            // Parse dateKey (format: YYYY-MM-DD) properly to avoid timezone issues
            const [year, month, day] = dateKey.split('-').map(Number);
            const taskDate = new Date(year, month - 1, day); // month is 0-indexed in JS Date
            
            const today = new Date();
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const taskDateStart = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
            
            // Check if task is for a past date (before today)
            if (taskDateStart < todayStart) {
                showAppNotification('You cannot add tasks to past dates.', 'error');
                return;
            }
            
            // If task is for today, check if the time is in the future
            if (taskDateStart.getTime() === todayStart.getTime() && time) {
                const [hours, minutes] = time.split(':').map(Number);
                const taskDateTime = new Date(taskDate);
                taskDateTime.setHours(hours, minutes, 0, 0);
                
                // Compare with current time - must be in the future
                if (taskDateTime <= today) {
                    showAppNotification('You cannot add tasks to past times. Please select a future time.', 'error');
                    return;
                }
            }
            
            // If task is for a future date, allow any time (no validation needed)
            
            if (!tasks[dateKey]) {
                tasks[dateKey] = [];
            }
            tasks[dateKey].push({
                id: Date.now(),
                description: description,
                time: time,
                completed: false,
                created_at: Date.now() // Store when task was created
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
        if (taskForm) {
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
                
                // Validate time if task is for today
                const [year, month, day] = dateKey.split('-').map(Number);
                const taskDate = new Date(year, month - 1, day); // month is 0-indexed
                const today = new Date();
                const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const taskDateStart = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
                
                // Only validate time if task is for today
                if (taskDateStart.getTime() === todayStart.getTime() && time24) {
                    const [hours, minutes] = time24.split(':').map(Number);
                    const taskDateTime = new Date(taskDate);
                    taskDateTime.setHours(hours, minutes, 0, 0);
                    
                    // Compare with current time - must be in the future
                    if (taskDateTime <= today) {
                        showAppNotification('You cannot add tasks to past times. Please select a future time.', 'error');
                        return;
                    }
                }
                
                // For future dates, no time validation needed - allow any time
                addTask(dateKey, description, time24);
                if (taskModal) taskModal.style.display = 'none';
                document.getElementById('task-description').value = '';
                document.getElementById('task-hour').value = '';
                document.getElementById('task-minute').value = '';
                document.getElementById('task-ampm').value = 'AM';
            });
        }

        // Handle task completion and deletion
        if (dateTasksList) {
            dateTasksList.addEventListener('click', function(event) {
                const taskId = parseInt(event.target.getAttribute('data-task-id'));
                const dateKey = event.target.getAttribute('data-date');

                if (event.target.classList.contains('complete-btn')) {
            // Only allow completion of tasks from today
            if (!isToday(dateKey)) {
                showAppNotification('You can only complete tasks from today\'s date.', 'error');
                return;
            }
            
            const task = tasks[dateKey].find(t => t.id === taskId);
            if (task) {
                const wasCompleted = task.completed;
                task.completed = !task.completed;
                saveTasks();
                showTaskDetails(dateKey, new Date(dateKey));
                
                // Award 1 point for completing a task (only when marking as completed, not uncompleting)
                if (task.completed && !wasCompleted) {
                    awardTaskCompletionPoint(taskId);
                }
                
                // Check if all tasks for this day are completed (awards 5 points)
                checkDayCompletion(dateKey);
                // Also check if all tasks for the week are completed (only on Sunday, awards 25 points)
                checkWeekCompletion();
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
    }

        // Month navigation
        if (prevMonthBtn) {
            prevMonthBtn.addEventListener('click', () => {
                currentDate.setMonth(currentDate.getMonth() - 1);
                renderCalendar();
            });
        }

        if (nextMonthBtn) {
            nextMonthBtn.addEventListener('click', () => {
                currentDate.setMonth(currentDate.getMonth() + 1);
                renderCalendar();
            });
        }

        // Help button handler
        if (calendarHelpBtn && calendarHelpModal) {
            calendarHelpBtn.addEventListener('click', () => {
                calendarHelpModal.style.display = 'block';
            });
        }

        // Close modals
        if (closeModalBtns && closeModalBtns.length > 0) {
            closeModalBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    if (taskModal) taskModal.style.display = 'none';
                    if (taskDetailsModal) taskDetailsModal.style.display = 'none';
                    if (calendarHelpModal) {
                        calendarHelpModal.style.display = 'none';
                    }
                });
            });
        }

        // Close modals when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === taskModal) {
                taskModal.style.display = 'none';
            }
            if (event.target === taskDetailsModal) {
                taskDetailsModal.style.display = 'none';
            }
            if (calendarHelpModal && event.target === calendarHelpModal) {
                calendarHelpModal.style.display = 'none';
            }
        });

        // Initialize calendar
        renderCalendar();
    }

    // --- Authentication Check on Load ---
    // Check authentication status with server on page load
    checkAuthStatus().then(authenticated => {
        if (authenticated) {
            showApp();
            initializeApp();
        } else {
            showAuth();
        }
    }).catch(error => {
        console.error('Error checking auth status:', error);
        showAuth();
    });
});
