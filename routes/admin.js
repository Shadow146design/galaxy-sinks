// ═══════════════════════════════════════════════
//  routes/admin.js — Administration & Gestion des rôles
// ═══════════════════════════════════════════════
const express  = require('express');
const axios    = require('axios');
const supabase = require('../db/supabase');
const { requireAuth, requireAdmin, requireStaff } = require('../middleware/auth');
const router   = express.Router();

const DISCORD_API = 'https://discord.com/api/v10';

// ── GET /api/admin/members ── Liste tous les membres
router.get('/members', requireAuth, requireStaff, async (req, res) => {
  try {
    const { data: members, error } = await supabase
      .from('players')
      .select('id, discord_id, username, avatar_url, role, rank_name, mmr, weekly_score, last_seen, joined_at, is_verified')
      .order('role', { ascending: true })
      .order('username', { ascending: true });

    if (error) throw error;
    res.json({ members, total: members.length });
  } catch (err) {
    res.status(500).json({ error: 'Erreur chargement membres' });
  }
});

// ── PUT /api/admin/members/:id/role ── Changer le rôle d'un membre (Admin seulement)
router.put('/members/:id/role', requireAuth, requireAdmin, async (req, res) => {
  const { role } = req.body;
  const validRoles = ['admin', 'staff', 'coach', 'membre'];

  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide. Valeurs acceptées : admin, staff, coach, membre' });
  }

  try {
    const { data: player, error } = await supabase
      .from('players').update({ role }).eq('id', req.params.id).select().single();

    if (error) throw error;

    // Si le rôle devient coach, créer le profil coach s'il n'existe pas
    if (role === 'coach') {
      const { data: existing } = await supabase
        .from('coaches').select('id').eq('player_id', req.params.id).single();
      if (!existing) {
        await supabase.from('coaches').insert({
          player_id:  req.params.id,
          speciality: 'Rocket League',
          bio:        'Coach Galaxy Sinks',
          is_active:  true,
        });
      }
    }

    res.json({ success: true, player });
  } catch (err) {
    res.status(500).json({ error: 'Erreur changement de rôle' });
  }
});

// ── POST /api/admin/sync-discord ── Synchroniser TOUS les rôles depuis Discord
router.post('/sync-discord', requireAuth, requireStaff, async (req, res) => {
  try {
    const { data: players } = await supabase
      .from('players').select('id, discord_id, role');

    let synced = 0, errors = 0;

    for (const player of players) {
      try {
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

        await supabase.from('players').update({ role: siteRole, discord_roles: discordRoles }).eq('id', player.id);
        synced++;

        // Pause pour éviter le rate limit Discord (50 requêtes/sec)
        await new Promise(r => setTimeout(r, 50));
      } catch (e) {
        errors++;
      }
    }

    res.json({ success: true, synced, errors, total: players.length });
  } catch (err) {
    res.status(500).json({ error: 'Erreur synchronisation Discord' });
  }
});

// ── GET /api/admin/stats ── Statistiques globales du serveur
router.get('/stats', requireAuth, requireStaff, async (req, res) => {
  try {
    const [
      { count: totalMembers },
      { count: verifiedMembers },
      { count: coaches },
      { count: bookingsThisWeek },
      { data: topPlayer },
    ] = await Promise.all([
      supabase.from('players').select('*', { count: 'exact', head: true }),
      supabase.from('players').select('*', { count: 'exact', head: true }).eq('is_verified', true),
      supabase.from('coaches').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('bookings').select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      supabase.from('players').select('username, mmr, rank_name').order('mmr', { ascending: false }).limit(1),
    ]);

    res.json({
      totalMembers,
      verifiedMembers,
      coaches,
      bookingsThisWeek,
      topPlayer: topPlayer?.[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur statistiques' });
  }
});

// ── DELETE /api/admin/members/:id ── Supprimer un membre (Admin seulement)
router.delete('/members/:id', requireAuth, requireAdmin, async (req, res) => {
  if (req.params.id === req.session.userId) {
    return res.status(400).json({ error: 'Impossible de se supprimer soi-même' });
  }
  try {
    await supabase.from('players').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur suppression membre' });
  }
});

module.exports = router;
