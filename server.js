const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cors = require('cors');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.sqlite');

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // Serve static files

// Session configuration
app.use(session({
    secret: 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT,
        email_verified INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating users table:', err.message);
        } else {
            console.log('Users table ready');
        }
    });

    // Calendar tasks table
    db.run(`CREATE TABLE IF NOT EXISTS calendar_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date_key TEXT NOT NULL,
        description TEXT NOT NULL,
        time TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, date_key, description, time)
    )`, (err) => {
        if (err) {
            console.error('Error creating calendar_tasks table:', err.message);
        } else {
            console.log('Calendar tasks table ready');
        }
    });

    // User points table
    db.run(`CREATE TABLE IF NOT EXISTS user_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        points INTEGER DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) {
            console.error('Error creating user_points table:', err.message);
        } else {
            console.log('User points table ready');
        }
    });

    // Shop purchases table
    db.run(`CREATE TABLE IF NOT EXISTS shop_purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        purchase_type TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) {
            console.error('Error creating shop_purchases table:', err.message);
        } else {
            console.log('Shop purchases table ready');
        }
    });

    // Game data table
    db.run(`CREATE TABLE IF NOT EXISTS game_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        data TEXT NOT NULL,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) {
            console.error('Error creating game_data table:', err.message);
        } else {
            console.log('Game data table ready');
        }
    });

    // Game settings table
    db.run(`CREATE TABLE IF NOT EXISTS game_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        auto_sell_threshold INTEGER DEFAULT 100,
        storage_sort TEXT DEFAULT 'Price',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) {
            console.error('Error creating game_settings table:', err.message);
        } else {
            console.log('Game settings table ready');
        }
    });

    // Email verification codes table
    db.run(`CREATE TABLE IF NOT EXISTS email_verification_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating email_verification_codes table:', err.message);
        } else {
            console.log('Email verification codes table ready');
        }
    });

    // Password reset codes table
    db.run(`CREATE TABLE IF NOT EXISTS password_reset_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) {
            console.error('Error creating password_reset_codes table:', err.message);
        } else {
            console.log('Password reset codes table ready');
        }
    });
}

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Authentication required' });
    }
}

// ==================== AUTHENTICATION ROUTES ====================

// Register new user
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    try {
        // Check if username already exists
        db.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (row) {
                return res.status(400).json({ error: 'Username already exists' });
            }

            // Hash password
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            // Insert new user
            db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', 
                [username, passwordHash], function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to create user' });
                    }

                    // Initialize user points
                    db.run('INSERT INTO user_points (user_id, points) VALUES (?, ?)', 
                        [this.lastID, 0]);

                    // Initialize game settings
                    db.run('INSERT INTO game_settings (user_id) VALUES (?)', 
                        [this.lastID]);

                    // Set session
                    req.session.userId = this.lastID;
                    req.session.username = username;

                    res.json({ 
                        success: true, 
                        message: 'Registration successful',
                        userId: this.lastID,
                        username: username
                    });
                });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    db.get('SELECT id, username, password_hash FROM users WHERE username = ?', 
        [username], async (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (!user) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            // Set session
            req.session.userId = user.id;
            req.session.username = user.username;

            res.json({ 
                success: true, 
                message: 'Login successful',
                userId: user.id,
                username: user.username
            });
        });
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Check authentication status
app.get('/api/auth/status', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({ 
            authenticated: true, 
            userId: req.session.userId,
            username: req.session.username
        });
    } else {
        res.json({ authenticated: false });
    }
});

// ==================== USER DATA ROUTES ====================

// Get user info
app.get('/api/user', requireAuth, (req, res) => {
    db.get('SELECT id, username, email, email_verified FROM users WHERE id = ?', 
        [req.session.userId], (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json(user);
        });
});

// Update user email
app.put('/api/user/email', requireAuth, (req, res) => {
    const { email, emailVerified } = req.body;
    
    db.run('UPDATE users SET email = ?, email_verified = ? WHERE id = ?',
        [email || null, emailVerified ? 1 : 0, req.session.userId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to update email' });
            }
            res.json({ success: true, message: 'Email updated' });
        });
});

// Delete user account
app.delete('/api/user', requireAuth, (req, res) => {
    db.run('DELETE FROM users WHERE id = ?', [req.session.userId], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete account' });
        }
        req.session.destroy();
        res.json({ success: true, message: 'Account deleted successfully' });
    });
});

// ==================== CALENDAR TASKS ROUTES ====================

// Get all tasks for a user
app.get('/api/calendar/tasks', requireAuth, (req, res) => {
    db.all('SELECT * FROM calendar_tasks WHERE user_id = ? ORDER BY date_key, time',
        [req.session.userId], (err, tasks) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(tasks);
        });
});

// Add a task
app.post('/api/calendar/tasks', requireAuth, (req, res) => {
    const { dateKey, description, time } = req.body;

    if (!dateKey || !description || !time) {
        return res.status(400).json({ error: 'Date, description, and time are required' });
    }

    db.run('INSERT INTO calendar_tasks (user_id, date_key, description, time) VALUES (?, ?, ?, ?)',
        [req.session.userId, dateKey, description, time], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to add task' });
            }
            res.json({ success: true, taskId: this.lastID });
        });
});

// Update task (mark complete/incomplete)
app.put('/api/calendar/tasks/:id', requireAuth, (req, res) => {
    const { completed } = req.body;
    const taskId = req.params.id;

    db.run('UPDATE calendar_tasks SET completed = ? WHERE id = ? AND user_id = ?',
        [completed ? 1 : 0, taskId, req.session.userId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to update task' });
            }
            res.json({ success: true });
        });
});

// Delete a task
app.delete('/api/calendar/tasks/:id', requireAuth, (req, res) => {
    const taskId = req.params.id;

    db.run('DELETE FROM calendar_tasks WHERE id = ? AND user_id = ?',
        [taskId, req.session.userId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to delete task' });
            }
            res.json({ success: true });
        });
});

// ==================== POINTS ROUTES ====================

// Get user points
app.get('/api/points', requireAuth, (req, res) => {
    db.get('SELECT points FROM user_points WHERE user_id = ?',
        [req.session.userId], (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ points: row ? row.points : 0 });
        });
});

// Update user points
app.put('/api/points', requireAuth, (req, res) => {
    const { points } = req.body;

    db.run('UPDATE user_points SET points = ?, last_updated = CURRENT_TIMESTAMP WHERE user_id = ?',
        [points, req.session.userId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to update points' });
            }
            res.json({ success: true });
        });
});

// ==================== SHOP ROUTES ====================

// Get shop purchases
app.get('/api/shop/purchases', requireAuth, (req, res) => {
    db.all('SELECT * FROM shop_purchases WHERE user_id = ?',
        [req.session.userId], (err, purchases) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(purchases);
        });
});

// Add shop purchase
app.post('/api/shop/purchases', requireAuth, (req, res) => {
    const { purchaseType, level } = req.body;

    db.run('INSERT INTO shop_purchases (user_id, purchase_type, level) VALUES (?, ?, ?)',
        [req.session.userId, purchaseType, level || 1], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to record purchase' });
            }
            res.json({ success: true, purchaseId: this.lastID });
        });
});

// ==================== GAME DATA ROUTES ====================

// Get game data
app.get('/api/game/data', requireAuth, (req, res) => {
    db.get('SELECT data FROM game_data WHERE user_id = ?',
        [req.session.userId], (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (row) {
                res.json(JSON.parse(row.data));
            } else {
                res.json(null);
            }
        });
});

// Save game data
app.put('/api/game/data', requireAuth, (req, res) => {
    const gameData = JSON.stringify(req.body);

    db.run('INSERT OR REPLACE INTO game_data (user_id, data, last_updated) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [req.session.userId, gameData], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to save game data' });
            }
            res.json({ success: true });
        });
});

// ==================== GAME SETTINGS ROUTES ====================

// Get game settings
app.get('/api/game/settings', requireAuth, (req, res) => {
    db.get('SELECT auto_sell_threshold, storage_sort FROM game_settings WHERE user_id = ?',
        [req.session.userId], (err, settings) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(settings || { auto_sell_threshold: 100, storage_sort: 'Price' });
        });
});

// Update game settings
app.put('/api/game/settings', requireAuth, (req, res) => {
    const { auto_sell_threshold, storage_sort } = req.body;

    db.run('UPDATE game_settings SET auto_sell_threshold = ?, storage_sort = ? WHERE user_id = ?',
        [auto_sell_threshold, storage_sort, req.session.userId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to update settings' });
            }
            res.json({ success: true });
        });
});

// ==================== EMAIL VERIFICATION ROUTES ====================

// Store verification code
app.post('/api/email/verification-code', (req, res) => {
    const { email, code } = req.body;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    db.run('INSERT INTO email_verification_codes (email, code, expires_at) VALUES (?, ?, ?)',
        [email, code, expiresAt.toISOString()], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to store verification code' });
            }
            res.json({ success: true });
        });
});

// Verify code
app.post('/api/email/verify', (req, res) => {
    const { email, code } = req.body;

    db.get('SELECT * FROM email_verification_codes WHERE email = ? AND code = ? AND expires_at > datetime("now") ORDER BY created_at DESC LIMIT 1',
        [email, code], (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (row) {
                // Delete used code
                db.run('DELETE FROM email_verification_codes WHERE id = ?', [row.id]);
                res.json({ success: true, valid: true });
            } else {
                res.json({ success: false, valid: false, error: 'Invalid or expired code' });
            }
        });
});

// Clean up expired codes (can be called periodically)
app.post('/api/email/cleanup-codes', (req, res) => {
    db.run('DELETE FROM email_verification_codes WHERE expires_at < datetime("now")', (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to cleanup codes' });
        }
        res.json({ success: true });
    });
});

// ==================== PASSWORD RESET ROUTES ====================

// Request password reset
app.post('/api/password/reset-request', async (req, res) => {
    let { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    
    // Normalize email (lowercase and trim)
    email = email.trim().toLowerCase();

    // Find user by email (case-insensitive)
    db.get('SELECT id, email, email_verified FROM users WHERE LOWER(TRIM(email)) = ? AND email_verified = 1', 
        [email], async (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (!user) {
                // Don't reveal if email exists or not (security best practice)
                return res.json({ 
                    success: true, 
                    message: 'If that email is registered and verified, a password reset code has been sent.' 
                });
            }

            // Generate 6-digit reset code
            const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

            // Invalidate any existing reset codes for this user
            db.run('UPDATE password_reset_codes SET used = 1 WHERE user_id = ? AND used = 0', [user.id]);

            // Store new reset code (ensure email is normalized)
            db.run('INSERT INTO password_reset_codes (user_id, email, code, expires_at) VALUES (?, ?, ?, ?)',
                [user.id, email.toLowerCase().trim(), resetCode, expiresAt.toISOString()], (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to create reset code' });
                    }

                    // Password reset code generated and stored
                    // Email will be sent from client-side using EmailJS
                    // Return code so frontend can send it via EmailJS
                    console.log(`Password reset code for ${email}: ${resetCode}`);
                    console.log('Note: Email will be sent via EmailJS from the frontend');
                    
                    res.json({ 
                        success: true, 
                        message: 'Password reset code sent to your email! Please check your inbox (and spam folder).',
                        code: resetCode  // Return code so frontend can send email via EmailJS
                    });
                });
        });
});

// Verify reset code
app.post('/api/password/verify-reset-code', (req, res) => {
    let { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ error: 'Email and code are required' });
    }
    
    // Normalize email and code
    email = email.trim().toLowerCase();
    code = code.trim();

    db.get(`SELECT prc.*, u.id as user_id 
            FROM password_reset_codes prc
            JOIN users u ON prc.user_id = u.id
            WHERE prc.email = ? AND prc.code = ? AND prc.used = 0 AND prc.expires_at > datetime("now")
            ORDER BY prc.created_at DESC LIMIT 1`,
        [email, code], (err, row) => {
            if (err) {
                console.error('Database error verifying reset code:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            if (!row) {
                console.log(`Reset code verification failed for email: ${email}, code: ${code}`);
                return res.json({ valid: false, error: 'Invalid or expired reset code' });
            }
            
            console.log(`Reset code verified successfully for email: ${email}`);

            res.json({ valid: true, userId: row.user_id });
        });
});

// Reset password with code
app.post('/api/password/reset', async (req, res) => {
    let { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
        return res.status(400).json({ error: 'Email, code, and new password are required' });
    }
    
    // Normalize email and code
    email = email.trim().toLowerCase();
    code = code.trim();

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Verify code
    db.get(`SELECT prc.*, u.id as user_id 
            FROM password_reset_codes prc
            JOIN users u ON prc.user_id = u.id
            WHERE prc.email = ? AND prc.code = ? AND prc.used = 0 AND prc.expires_at > datetime("now")
            ORDER BY prc.created_at DESC LIMIT 1`,
        [email, code], async (err, row) => {
            if (err) {
                console.error('Database error during password reset:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            if (!row) {
                console.log(`Password reset failed - invalid code for email: ${email}, code: ${code}`);
                return res.status(400).json({ error: 'Invalid or expired reset code' });
            }
            
            console.log(`Password reset code verified for email: ${email}`);

            // Hash new password
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(newPassword, saltRounds);

            // Update password
            db.run('UPDATE users SET password_hash = ? WHERE id = ?',
                [passwordHash, row.user_id], (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to update password' });
                    }

                    // Mark reset code as used
                    db.run('UPDATE password_reset_codes SET used = 1 WHERE id = ?', [row.id]);

                    res.json({ success: true, message: 'Password reset successfully' });
                });
        });
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});

