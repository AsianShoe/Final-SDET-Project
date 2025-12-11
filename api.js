// API utility functions for communicating with the backend server
const API_BASE_URL = window.location.origin; // Use same origin as the page

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const defaultOptions = {
        credentials: 'include', // Include cookies for session
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const config = { ...defaultOptions, ...options };
    
    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
}

// Authentication API
const AuthAPI = {
    async register(username, password) {
        return await apiCall('/api/register', {
            method: 'POST',
            body: { username, password }
        });
    },

    async login(username, password) {
        return await apiCall('/api/login', {
            method: 'POST',
            body: { username, password }
        });
    },

    async logout() {
        return await apiCall('/api/logout', {
            method: 'POST'
        });
    },

    async checkAuth() {
        return await apiCall('/api/auth/status');
    }
};

// User API
const UserAPI = {
    async getUser() {
        return await apiCall('/api/user');
    },

    async updateEmail(email, emailVerified) {
        return await apiCall('/api/user/email', {
            method: 'PUT',
            body: { email, emailVerified }
        });
    },

    async deleteAccount() {
        return await apiCall('/api/user', {
            method: 'DELETE'
        });
    }
};

// Calendar API
const CalendarAPI = {
    async getTasks() {
        return await apiCall('/api/calendar/tasks');
    },

    async addTask(dateKey, description, time) {
        return await apiCall('/api/calendar/tasks', {
            method: 'POST',
            body: { dateKey, description, time }
        });
    },

    async updateTask(taskId, completed) {
        return await apiCall(`/api/calendar/tasks/${taskId}`, {
            method: 'PUT',
            body: { completed }
        });
    },

    async deleteTask(taskId) {
        return await apiCall(`/api/calendar/tasks/${taskId}`, {
            method: 'DELETE'
        });
    }
};

// Points API
const PointsAPI = {
    async getPoints() {
        return await apiCall('/api/points');
    },

    async updatePoints(points) {
        return await apiCall('/api/points', {
            method: 'PUT',
            body: { points }
        });
    }
};

// Shop API
const ShopAPI = {
    async getPurchases() {
        return await apiCall('/api/shop/purchases');
    },

    async addPurchase(purchaseType, level) {
        return await apiCall('/api/shop/purchases', {
            method: 'POST',
            body: { purchaseType, level }
        });
    }
};

// Game API
const GameAPI = {
    async getGameData() {
        return await apiCall('/api/game/data');
    },

    async saveGameData(gameData) {
        return await apiCall('/api/game/data', {
            method: 'PUT',
            body: gameData
        });
    },

    async getGameSettings() {
        return await apiCall('/api/game/settings');
    },

    async updateGameSettings(settings) {
        return await apiCall('/api/game/settings', {
            method: 'PUT',
            body: settings
        });
    }
};

// Email Verification API
const EmailAPI = {
    async storeVerificationCode(email, code) {
        return await apiCall('/api/email/verification-code', {
            method: 'POST',
            body: { email, code }
        });
    },

    async verifyCode(email, code) {
        return await apiCall('/api/email/verify', {
            method: 'POST',
            body: { email, code }
        });
    }
};

// Password Reset API
const PasswordResetAPI = {
    async requestReset(email) {
        return await apiCall('/api/password/reset-request', {
            method: 'POST',
            body: { email }
        });
    },

    async verifyResetCode(email, code) {
        return await apiCall('/api/password/verify-reset-code', {
            method: 'POST',
            body: { email, code }
        });
    },

    async resetPassword(email, code, newPassword) {
        return await apiCall('/api/password/reset', {
            method: 'POST',
            body: { email, code, newPassword }
        });
    }
};

// Export APIs
window.AuthAPI = AuthAPI;
window.UserAPI = UserAPI;
window.CalendarAPI = CalendarAPI;
window.PointsAPI = PointsAPI;
window.ShopAPI = ShopAPI;
window.GameAPI = GameAPI;
window.EmailAPI = EmailAPI;
window.PasswordResetAPI = PasswordResetAPI;

