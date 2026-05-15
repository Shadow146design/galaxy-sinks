// ═══════════════════════════════════════════════════
//  GALAXY SINKS ESPORT — Backend Principal
//  Node.js + Express + Discord OAuth + Supabase
// ═══════════════════════════════════════════════════

require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const cors       = require('cors');
const path       = require('path');

const authRoutes      = require('./routes/auth');
const profileRoutes   = require('./routes/profile');
const leaderboardRoutes = require('./routes/leaderboard');
const coachRoutes     = require('./routes/coach');
const adminRoutes     = require('./routes/admin');

const app = express();

// ── Middleware ──
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'galaxysinks_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
  }
}));

// ── Servir le frontend ──
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes API ──
app.use('/auth',        authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/coach',   coachRoutes);
app.use('/api/admin',   adminRoutes);

// ── Route catch-all (SPA) ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Galaxy Sinks Backend démarré sur le port ${PORT}`);
});
