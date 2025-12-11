# RNG Calendar - Task Manager

A full-stack task management application with calendar, shop, and game features, now using SQLite database with Node.js/Express backend.

## Features

- User authentication (register/login)
- Calendar task management
- Points system and shop
- RNG Game with items and upgrades
- Email verification
- Dark/Light theme support

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```
   s
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

3. **Access the application:**
   - Open your browser and go to: `http://localhost:3000`
   - The server will automatically create the SQLite database file (`database.sqlite`) on first run

### Database

The application uses SQLite for data storage. The database file (`database.sqlite`) will be created automatically in the project root directory when you first start the server.

**Database Schema:**
- `users` - User accounts with authentication
- `calendar_tasks` - Calendar tasks for each user
- `user_points` - Points system data
- `shop_purchases` - Shop purchase history
- `game_data` - Game state and progress
- `game_settings` - Game configuration
- `email_verification_codes` - Email verification codes

### Email Configuration

To enable email verification, you need to configure EmailJS:

1. Sign up at https://www.emailjs.com/
2. Create an email service (Gmail, Outlook, etc.)
3. Create an email template with variables: `{{to_email}}` and `{{verification_code}}`
4. Get your Public Key from the Integration section
5. Update `EMAILJS_CONFIG` in `java.js` with your credentials:
   - `serviceId`
   - `templateId`
   - `publicKey`

### Production Deployment

For production:

1. **Change the session secret** in `server.js`:
   ```javascript
   secret: 'your-secret-key-change-this-in-production',
   ```

2. **Set secure cookies** (if using HTTPS):
   ```javascript
   cookie: {
       secure: true, // Set to true for HTTPS
       httpOnly: true,
       maxAge: 24 * 60 * 60 * 1000
   }
   ```

3. **Set environment variables:**
   ```bash
   PORT=3000
   NODE_ENV=production
   ```

4. **Use a process manager** like PM2:
   ```bash
   npm install -g pm2
   pm2 start server.js
   ```

## API Endpoints

### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - Login user
- `POST /api/logout` - Logout user
- `GET /api/auth/status` - Check authentication status

### User
- `GET /api/user` - Get user info
- `PUT /api/user/email` - Update user email
- `DELETE /api/user` - Delete user account

### Calendar
- `GET /api/calendar/tasks` - Get all tasks
- `POST /api/calendar/tasks` - Add task
- `PUT /api/calendar/tasks/:id` - Update task
- `DELETE /api/calendar/tasks/:id` - Delete task

### Points
- `GET /api/points` - Get user points
- `PUT /api/points` - Update user points

### Shop
- `GET /api/shop/purchases` - Get purchases
- `POST /api/shop/purchases` - Record purchase

### Game
- `GET /api/game/data` - Get game data
- `PUT /api/game/data` - Save game data
- `GET /api/game/settings` - Get game settings
- `PUT /api/game/settings` - Update game settings

### Email Verification
- `POST /api/email/verification-code` - Store verification code
- `POST /api/email/verify` - Verify code

## Project Structure

```
.
├── server.js              # Express backend server
├── api.js                 # Frontend API utility functions
├── package.json           # Node.js dependencies
├── database.sqlite        # SQLite database (created automatically)
├── index.html             # Main HTML file
├── java.js                # Frontend application logic
├── styles.css             # Styling
└── game-*.js              # Game-related JavaScript files
```

## Notes

- The application uses session-based authentication (cookies)
- All API calls require authentication (except register/login)
- Data is stored server-side in SQLite, not in browser localStorage
- The frontend makes API calls to the backend for all data operations

