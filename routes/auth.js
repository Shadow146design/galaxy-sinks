const express = require('express');
const axios   = require('axios');
const router  = express.Router();

const DISCORD_API = 'https://discord.com/api/v10';

router.get('/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id:     process.env.DISCORD_CLIENT_ID,
    redirect_uri:  process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope:         'identify guilds.members.read',
  });
  res.redirect(`${DISCORD_API}/oauth2/authorize?${params}`);
});

router.get('/discord/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/?error=no_code');
  try {
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
    const userRes = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const discordUser = userRes.data;
    let siteRole = 'membre';
    try {
      const memberRes = await axios.get(
        `${DISCORD_API}/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUser.id}`,
        { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
      );
      const roles = memberRes.data.roles || [];
      console.log('Roles Discord:', JSON.stringify(roles)); console.log('Admin ID:', process.env.DISCORD_ROLE_ADMIN); console.log('Match:', roles.includes(process.env.DISCORD_ROLE_ADMIN));
      for (const roleId of roles) {
        if (roleId === process.env.DISCORD_ROLE_CREATEUR || roleId === process.env.DISCORD_ROLE_ADMIN) { siteRole = 'admin'; break; }
        if (roleId === process.env.DISCORD_ROLE_STAFF)  { siteRole = 'staff';  break; }
        if (roleId === process.env.DISCORD_ROLE_COACH)  { siteRole = 'coach';  break; }
        if (roleId === process.env.DISCORD_ROLE_MEMBRE) { siteRole = 'membre'; break; }
      }
    } catch (e) {
      console.warn('Roles non recuperes:', e.message);
    }
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/0.png`;
    const userData = JSON.stringify({ id: discordUser.id, username: discordUser.username, avatar: avatarUrl, role: siteRole, loggedIn: true });
    res.cookie('gs_user', userData, { maxAge: 7*24*60*60*1000, httpOnly: false, secure: true, sameSite: 'lax' });
    console.log(`Connexion reussie: ${discordUser.username} (${siteRole})`);
    res.redirect('/?login=success');
  } catch (err) {
    console.error('Erreur OAuth:', err.response?.data || err.message);
    res.redirect('/?error=auth_failed');
  }
});

router.get('/me', (req, res) => {
  try {
    const cookie = req.cookies?.gs_user;
    if (!cookie) return res.json({ user: null });
    const user = JSON.parse(cookie);
    if (!user.loggedIn) return res.json({ user: null });
    res.json({ user: { id: user.id, discord_id: user.id, username: user.username, avatar_url: user.avatar, role: user.role || 'membre', mmr: 0, wins: 0, goals: 0, assists: 0, rank_name: 'Non classe', weekly_score: 0, site_activity: 0, is_verified: false } });
  } catch(e) { res.json({ user: null }); }
});

router.post('/logout', (req, res) => { res.clearCookie('gs_user'); res.json({ success: true }); });
router.get('/sync-discord', (req, res) => { res.json({ success: true }); });

module.exports = router;

