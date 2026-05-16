// ═══════════════════════════════════════════════
//  routes/auth.js — Discord OAuth2
// ═══════════════════════════════════════════════
const express = require('express');
const axios   = require('axios');
const supabase = require('../db/supabase');
const router  = express.Router();

const DISCORD_API    = 'https://discord.com/api/v10';
const DISCORD_SCOPES = 'identify guilds.members.read';

// ── GET /auth/discord ── Redirige vers Discord
router.get('/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id:     process.env.DISCORD_CLIENT_ID,
    redirect_uri:  process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope:         DISCORD_SCOPES,
  });
  res.redirect(`${DISCORD_API}/oauth2/authorize?${params}`);
});

// ── GET /auth/discord/callback ──
router.get('/discord/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/?error=no_code');

  try {
    // 1. Échanger le code contre un access_token
    const tokenRes = await axios.post(`${DISCORD_API}/oauth2/token`,
      new URLSearchParams({
        client_id:     process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  process.env.DISCORD_REDIRECT_URI,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const { access_token } = tokenRes.data;

    // 2. Récupérer les infos utilisateur Discord
    const userRes = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const discordUser = userRes.data;

    // 3. Récupérer les rôles Discord (optionnel)
    let discordRoles = [];
    let siteRole = 'membre';
    try {
      const memberRes = await axios.get(
        `${DISCORD_API}/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUser.id}`,
        { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
      );
      discordRoles = memberRes.data.roles || [];
      for (const roleId of discordRoles) {
        if (roleId === process.env.DISCORD_ROLE_ADMIN)  { siteRole = 'admin';  break; }
        if (roleId === process.env.DISCORD_ROLE_STAFF)  { siteRole = 'staff';  break; }
        if (roleId === process.env.DISCORD_ROLE_COACH)  { siteRole = 'coach';  break; }
        if (roleId === process.env.DISCORD_ROLE_MEMBRE) { siteRole = 'membre'; break; }
      }
    } catch (e) {
      console.warn(`Rôles Discord non récupérés pour ${discordUser.username} - rôle par défaut: membre`);
    }

    // 4. Avatar
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/0.png`;

    // 5. Essayer Supabase (optionnel)
    try {
      await supabase.from('players').upsert({
        discord_id:    discordUser.id,
        username:      discordUser.username,
        avatar_url:    avatarUrl,
        role:          siteRole,
        discord_roles: discordRoles,
        last_seen:     new Date().toISOString(),
      }, { onConflict: 'discord_id' });
    } catch (e) {
      console.warn('Supabase indisponible, session uniquement');
    }

    // 6. Stocker en session
    req.session.userId     = discordUser.id;
    req.session.discordId  = discordUser.id;
    req.session.role       = siteRole;
    req.session.username   = discordUser.username;
    req.session.avatar     = avatarUrl;
    req.session.loggedIn   = true;

    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
      res.redirect('/?login=success');
    });

  } catch (err) {
    console.error('Erreur OAuth Discord:', err.response?.data || err.message);
    res.redirect('/?error=auth_failed');
  }
});

// ── GET /auth/me ──
router.get('/me', (req, res) => {
  if (!req.session.loggedIn || !req.session.userId) {
    return res.json({ user: null });
  }
  res.json({
    user: {
      id:          req.session.userId,
      discord_id:  req.session.discordId,
      username:    req.session.username,
      avatar_url:  req.session.avatar,
      role:        req.session.role || 'membre',
      mmr:         0,
      wins:        0,
      goals:       0,
      assists:     0,
      rank_name:   'Non classé',
      weekly_score: 0,
      site_activity: 0,
      is_verified: false,
    }
  });
});

// ── POST /auth/logout ──
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ── GET /auth/sync-discord ──
router.get('/sync-discord', async (req, res) => {
  if (!req.session.loggedIn) return res.status(401).json({ error: 'Non connecté' });
  res.json({ success: true, role: req.session.role });
});

module.exports = router;
