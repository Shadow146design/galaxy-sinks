// ═══════════════════════════════════════════════
//  routes/auth.js — Discord OAuth2
// ═══════════════════════════════════════════════
const express = require('express');
const axios   = require('axios');
const supabase = require('../db/supabase');
const router  = express.Router();

const DISCORD_API    = 'https://discord.com/api/v10';
const DISCORD_SCOPES = 'identify guilds.members.read';

// IDs des rôles Discord → rôle sur le site
const ROLE_MAP = {
  [process.env.DISCORD_ROLE_ADMIN]:  'admin',
  [process.env.DISCORD_ROLE_STAFF]:  'staff',
  [process.env.DISCORD_ROLE_COACH]:  'coach',
  [process.env.DISCORD_ROLE_MEMBRE]: 'membre',
};

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

// ── GET /auth/discord/callback ── Reçoit le code Discord
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

    // 3. Récupérer les rôles du membre dans le serveur Galaxy Sinks
    let discordRoles = [];
    let siteRole = 'membre';
    try {
      const memberRes = await axios.get(
        `${DISCORD_API}/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUser.id}`,
        { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
      );
      discordRoles = memberRes.data.roles || [];

      // Déterminer le rôle sur le site selon les rôles Discord (priorité : admin > staff > coach > membre)
      for (const roleId of discordRoles) {
        if (roleId === process.env.DISCORD_ROLE_ADMIN)  { siteRole = 'admin';  break; }
        if (roleId === process.env.DISCORD_ROLE_STAFF)  { siteRole = 'staff';  break; }
        if (roleId === process.env.DISCORD_ROLE_COACH)  { siteRole = 'coach';  break; }
        if (roleId === process.env.DISCORD_ROLE_MEMBRE) { siteRole = 'membre'; break; }
      }
    } catch (e) {
      // Si le membre n'est pas dans le serveur Discord
      console.warn(`Membre ${discordUser.username} non trouvé dans le serveur Discord Galaxy Sinks`);
    }

    // 4. Avatar Discord
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator || '0') % 5}.png`;

    // 5. Upsert dans Supabase (créer ou mettre à jour le profil)
    const { data: player, error } = await supabase
      .from('players')
      .upsert({
        discord_id:    discordUser.id,
        username:      discordUser.username,
        discriminator: discordUser.discriminator || '0',
        avatar_url:    avatarUrl,
        role:          siteRole,
        discord_roles: discordRoles,
        last_seen:     new Date().toISOString(),
      }, { onConflict: 'discord_id' })
      .select()
      .single();

    if (error) console.error('Supabase error:', error);

    // 6. Stocker en session
    req.session.userId = player?.id || discordUser.id;
    req.session.discordId = discordUser.id;
    req.session.role = siteRole;
    req.session.username = discordUser.username;
    req.session.avatar = avatarUrl;

    // Sauvegarder la session explicitement
    await new Promise((resolve) => req.session.save(resolve));

    // 7. Mettre à jour l'activité du site
    if (player?.id) {
      await supabase
        .from('players')
        .update({
          sessions_count: (player.sessions_count || 0) + 1,
          site_activity: Math.min(100, (player.site_activity || 0) + 2),
        })
        .eq('id', player.id);
    }

    res.redirect('/?login=success');

  } catch (err) {
    console.error('Erreur OAuth Discord:', err.response?.data || err.message);
    res.redirect('/?error=auth_failed');
  }
});

// ── GET /auth/me ── Retourne l'utilisateur connecté
router.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.json({ user: null });
  }
  try {
    // Essayer Supabase d'abord
    const { data: player, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', req.session.userId)
      .single();

    if (!error && player) {
      await supabase.from('players').update({ last_seen: new Date().toISOString() }).eq('id', player.id);
      return res.json({ user: player });
    }

    // Fallback: utiliser les infos de session
    if (req.session.username) {
      return res.json({ user: {
        id: req.session.userId,
        discord_id: req.session.discordId,
        username: req.session.username,
        avatar_url: req.session.avatar,
        role: req.session.role || 'membre',
        mmr: 0, wins: 0, goals: 0, assists: 0,
        rank_name: 'Non classé', weekly_score: 0,
        site_activity: 0, is_verified: false
      }});
    }

    res.json({ user: null });
  } catch (err) {
    // Fallback session
    if (req.session.username) {
      return res.json({ user: {
        id: req.session.userId,
        discord_id: req.session.discordId,
        username: req.session.username,
        avatar_url: req.session.avatar,
        role: req.session.role || 'membre',
        mmr: 0, wins: 0, goals: 0, assists: 0,
        rank_name: 'Non classé', weekly_score: 0,
        site_activity: 0, is_verified: false
      }});
    }
    res.json({ user: null });
  }
});

// ── POST /auth/logout ──
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ── GET /auth/sync-discord ── Re-synchronise les rôles Discord
router.get('/sync-discord', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Non connecté' });

  try {
    const { data: player } = await supabase
      .from('players').select('discord_id').eq('id', req.session.userId).single();

    const memberRes = await axios.get(
      `${DISCORD_API}/guilds/${process.env.DISCORD_GUILD_ID}/members/${player.discord_id}`,
      { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
    );
    const discordRoles = memberRes.data.roles || [];
    let siteRole = 'membre';
    for (const roleId of discordRoles) {
      if (roleId === process.env.DISCORD_ROLE_ADMIN)  { siteRole = 'admin';  break; }
      if (roleId === process.env.DISCORD_ROLE_STAFF)  { siteRole = 'staff';  break; }
      if (roleId === process.env.DISCORD_ROLE_COACH)  { siteRole = 'coach';  break; }
      if (roleId === process.env.DISCORD_ROLE_MEMBRE) { siteRole = 'membre'; break; }
    }

    await supabase.from('players').update({ role: siteRole, discord_roles: discordRoles })
      .eq('id', req.session.userId);

    req.session.role = siteRole;
    res.json({ success: true, role: siteRole, discordRoles });
  } catch (err) {
    res.status(500).json({ error: 'Erreur synchronisation Discord' });
  }
});

module.exports = router;
