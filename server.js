require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const cookieParser = require('cookie-parser');

const authRoutes        = require('./routes/auth');
const profileRoutes     = require('./routes/profile');
const leaderboardRoutes = require('./routes/leaderboard');
const coachRoutes       = require('./routes/coach');
const adminRoutes       = require('./routes/admin');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));

app.use('/auth',            authRoutes);
app.use('/api/profile',     profileRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/coach',       coachRoutes);
app.use('/api/admin',       adminRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Galaxy Sinks Backend démarré sur le port ${PORT}`);
});
