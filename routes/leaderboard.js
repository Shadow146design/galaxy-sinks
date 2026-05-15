// ═══════════════════════════════════════════════
//  routes/leaderboard.js — Leaderboard hebdomadaire
// ═══════════════════════════════════════════════
const express  = require('express');
const supabase = require('../db/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router   = express.Router();

// ── GET /api/leaderboard ── Classement actuel
router.get('/', async (req, res) => {
  try {
    const { sortBy = 'weekly_score', limit = 50 } = req.query;

    const validSorts = ['weekly_score', 'mmr', 'wins', 'goals', 'site_activity'];
    const sort = validSorts.includes(sortBy) ? sortBy : 'weekly_score';

    const { data: players, error } = await supabase
      .from('players')
      .select(`
        id, discord_id, username, avatar_url, role,
        rank_name, rank_division, mmr, wins, losses, goals, assists,
        site_activity, weekly_score, weekly_rank, stats_manual
      `)
      .eq('is_verified', true)
      .gte('mmr', 451)                    // Platinum minimum
      .order(sort, { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    // Calculer win rate et rang en temps réel
    const ranked = players.map((p, i) => ({
      ...p,
      position: i + 1,
      win_rate: p.wins + p.losses > 0
        ? Math.round(p.wins / (p.wins + p.losses) * 100)
        : 0,
    }));

    // Calcul du prochain reset (lundi 00h00)
    const now = new Date();
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + (8 - now.getDay()) % 7 || 7);
    nextMonday.setHours(0, 0, 0, 0);
    const msUntilReset = nextMonday - now;

    res.json({
      players: ranked,
      nextReset: nextMonday.toISOString(),
      msUntilReset,
      total: ranked.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur leaderboard' });
  }
});

// ── GET /api/leaderboard/history ── Historique des semaines passées
router.get('/history', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('leaderboard_history')
      .select(`
        rank, week_start, week_end, mmr, wins, score,
        players (username, avatar_url, role)
      `)
      .order('week_start', { ascending: false })
      .order('rank', { ascending: true })
      .limit(100);

    if (error) throw error;
    res.json({ history: data });
  } catch (err) {
    res.status(500).json({ error: 'Erreur historique' });
  }
});

// ── POST /api/leaderboard/reset ── Reset manuel (Admin seulement)
router.post('/reset', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Appeler la fonction SQL de reset
    const { error } = await supabase.rpc('reset_weekly_leaderboard');
    if (error) throw error;
    res.json({ success: true, message: 'Leaderboard réinitialisé et historique sauvegardé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur reset leaderboard' });
  }
});

// ── POST /api/leaderboard/recalculate ── Recalculer tous les scores
router.post('/recalculate', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: players } = await supabase
      .from('players').select('id, mmr, wins, goals, site_activity');

    for (const p of players) {
      const score = Math.round(
        (p.mmr || 0) * 0.4 +
        (p.wins || 0) * 2 +
        (p.goals || 0) * 0.5 +
        (p.site_activity || 0) * 10
      );
      await supabase.from('players').update({ weekly_score: score }).eq('id', p.id);
    }
    res.json({ success: true, updated: players.length });
  } catch (err) {
    res.status(500).json({ error: 'Erreur recalcul' });
  }
});

module.exports = router;
