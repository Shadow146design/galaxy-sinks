// ═══════════════════════════════════════════════
//  routes/profile.js — Profil joueur + Tracker Network
// ═══════════════════════════════════════════════
const express  = require('express');
const axios    = require('axios');
const supabase = require('../db/supabase');
const { requireAuth } = require('../middleware/auth');
const router   = express.Router();

const TRACKER_BASE = 'https://public-api.tracker.gg/v2/rocket-league';
const TRACKER_KEY  = process.env.TRACKER_API_KEY;

// ── Convertit le rang Tracker en MMR approximatif ──
function rankToMMR(tierName, division) {
  const tiers = {
    'Bronze I':1,'Bronze II':50,'Bronze III':100,
    'Silver I':150,'Silver II':200,'Silver III':250,
    'Gold I':300,'Gold II':350,'Gold III':400,
    'Platinum I':450,'Platinum II':500,'Platinum III':550,
    'Diamond I':650,'Diamond II':720,'Diamond III':800,
    'Champion I':900,'Champion II':980,'Champion III':1080,
    'Grand Champion I':1180,'Grand Champion II':1320,'Grand Champion III':1460,
    'Supersonic Legend':1600,
  };
  const divBonus = { 'I':0,'II':25,'III':50,'IV':75 };
  const base = tiers[tierName] || 0;
  return base + (divBonus[division] || 0);
}

// ── GET /api/profile/me ── Mon profil complet
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { data: player, error } = await supabase
      .from('players').select('*').eq('id', req.session.userId).single();
    if (error) return res.status(404).json({ error: 'Profil introuvable' });
    res.json({ player });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST /api/profile/link-rl ── Lier un pseudo Rocket League + récupérer stats auto
router.post('/link-rl', requireAuth, async (req, res) => {
  const { pseudo, platform } = req.body;
  // platform: epic | steam | psn | xbox | switch

  if (!pseudo || !platform) {
    return res.status(400).json({ error: 'pseudo et platform requis' });
  }

  try {
    // Appel Tracker Network
    const encodedPseudo = encodeURIComponent(pseudo);
    const response = await axios.get(
      `${TRACKER_BASE}/standard/profile/${platform}/${encodedPseudo}`,
      {
        headers: {
          'TRN-Api-Key': TRACKER_KEY,
          'Accept': 'application/json',
        }
      }
    );

    const data = response.data.data;
    const segments = data.segments || [];

    // Chercher les stats en 3v3 (Playlist Standard)
    const standardSeg = segments.find(s =>
      s.type === 'playlist' && s.metadata?.name === 'Ranked Standard 3v3'
    ) || segments.find(s => s.type === 'playlist') || segments[0];

    let mmr = 0, rankName = 'Non classé', rankDiv = '';
    let wins = 0, goals = 0, assists = 0, saves = 0, shots = 0, mvp = 0;

    if (standardSeg) {
      const stats = standardSeg.stats;
      mmr      = stats?.rating?.value || 0;
      rankName = standardSeg.metadata?.tierName || 'Non classé';
      rankDiv  = standardSeg.metadata?.divisionName || '';
      wins     = stats?.wins?.value || 0;
      goals    = stats?.goals?.value || 0;
      assists  = stats?.assists?.value || 0;
      saves    = stats?.saves?.value || 0;
      shots    = stats?.shots?.value || 0;
      mvp      = stats?.mVPs?.value || 0;
    }

    // Récupérer les stats globales (tous modes)
    const overviewSeg = segments.find(s => s.type === 'overview');
    if (overviewSeg && !wins) {
      wins    = overviewSeg.stats?.wins?.value || wins;
      goals   = overviewSeg.stats?.goals?.value || goals;
      assists = overviewSeg.stats?.assists?.value || assists;
      saves   = overviewSeg.stats?.saves?.value || saves;
      shots   = overviewSeg.stats?.shots?.value || shots;
    }

    // Sauvegarder dans Supabase
    const weeklyScore = Math.round(mmr * 0.4 + wins * 2 + goals * 0.5);
    const { data: updated, error } = await supabase
      .from('players')
      .update({
        rl_pseudo:    pseudo,
        rl_platform:  platform,
        mmr:          Math.round(mmr),
        rank_name:    rankName,
        rank_division: rankDiv,
        wins, goals, assists, saves, shots,
        mvp_count:    mvp,
        weekly_score: weeklyScore,
        is_verified:  true,
        stats_manual: false,
        updated_at:   new Date().toISOString(),
      })
      .eq('id', req.session.userId)
      .select().single();

    if (error) throw error;
    res.json({ success: true, player: updated, source: 'tracker_network' });

  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({
        error: 'Joueur introuvable sur Tracker Network. Vérifie ton pseudo et ta plateforme.'
      });
    }
    if (err.response?.status === 429) {
      return res.status(429).json({ error: 'Limite API atteinte. Réessaie dans quelques minutes.' });
    }
    console.error('Tracker Network error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erreur lors de la récupération des stats RL' });
  }
});

// ── PUT /api/profile/stats-manual ── Mise à jour manuelle des stats
router.put('/stats-manual', requireAuth, async (req, res) => {
  const { mmr, rank_name, wins, goals, assists, saves, shots, rl_pseudo, rl_platform } = req.body;

  // Validation basique
  if (mmr !== undefined && (isNaN(mmr) || mmr < 0 || mmr > 2200)) {
    return res.status(400).json({ error: 'MMR invalide (0-2200)' });
  }

  const updates = {};
  if (mmr        !== undefined) updates.mmr        = parseInt(mmr);
  if (rank_name  !== undefined) updates.rank_name  = rank_name;
  if (wins       !== undefined) updates.wins       = parseInt(wins);
  if (goals      !== undefined) updates.goals      = parseInt(goals);
  if (assists    !== undefined) updates.assists     = parseInt(assists);
  if (saves      !== undefined) updates.saves      = parseInt(saves);
  if (shots      !== undefined) updates.shots      = parseInt(shots);
  if (rl_pseudo  !== undefined) updates.rl_pseudo  = rl_pseudo;
  if (rl_platform!== undefined) updates.rl_platform= rl_platform;
  updates.stats_manual = true;

  // Recalculer le score leaderboard
  if (updates.mmr || updates.wins || updates.goals) {
    const { data: current } = await supabase.from('players').select('mmr,wins,goals,site_activity').eq('id', req.session.userId).single();
    const m = updates.mmr   || current?.mmr   || 0;
    const w = updates.wins  || current?.wins  || 0;
    const g = updates.goals || current?.goals || 0;
    const a = current?.site_activity || 0;
    updates.weekly_score = Math.round(m * 0.4 + w * 2 + g * 0.5 + a * 10);
  }

  const { data: player, error } = await supabase
    .from('players').update(updates).eq('id', req.session.userId).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, player, source: 'manual' });
});

// ── GET /api/profile/refresh-rl ── Rafraîchir les stats depuis Tracker Network
router.get('/refresh-rl', requireAuth, async (req, res) => {
  try {
    const { data: player } = await supabase
      .from('players').select('rl_pseudo,rl_platform').eq('id', req.session.userId).single();

    if (!player?.rl_pseudo) {
      return res.status(400).json({ error: 'Aucun pseudo RL lié. Va dans Modifier le profil.' });
    }

    // Relancer la récupération Tracker Network
    req.body = { pseudo: player.rl_pseudo, platform: player.rl_platform || 'epic' };
    // Re-use link-rl logic
    const fakeReq = { ...req, body: { pseudo: player.rl_pseudo, platform: player.rl_platform || 'epic' } };

    // Appel direct Tracker Network
    const encodedPseudo = encodeURIComponent(player.rl_pseudo);
    const response = await axios.get(
      `${TRACKER_BASE}/standard/profile/${player.rl_platform || 'epic'}/${encodedPseudo}`,
      { headers: { 'TRN-Api-Key': TRACKER_KEY, 'Accept': 'application/json' } }
    );

    const segments = response.data.data?.segments || [];
    const standardSeg = segments.find(s => s.type === 'playlist' && s.metadata?.name === 'Ranked Standard 3v3') || segments[0];

    if (standardSeg) {
      const stats = standardSeg.stats;
      const mmr  = Math.round(stats?.rating?.value || 0);
      const wins = stats?.wins?.value || 0;
      const goals= stats?.goals?.value || 0;
      const { data: current } = await supabase.from('players').select('site_activity').eq('id', req.session.userId).single();
      const weeklyScore = Math.round(mmr * 0.4 + wins * 2 + goals * 0.5 + (current?.site_activity||0) * 10);
      await supabase.from('players').update({
        mmr, wins, goals,
        rank_name: standardSeg.metadata?.tierName || 'Non classé',
        weekly_score: weeklyScore,
        stats_manual: false,
        updated_at: new Date().toISOString(),
      }).eq('id', req.session.userId);
    }

    res.json({ success: true, message: 'Stats mises à jour depuis Tracker Network' });
  } catch (err) {
    res.status(500).json({ error: 'Impossible de rafraîchir les stats' });
  }
});

// ── GET /api/profile/:discordId ── Profil public d'un joueur
router.get('/:discordId', async (req, res) => {
  try {
    const { data: player, error } = await supabase
      .from('players')
      .select('id,username,avatar_url,role,rank_name,mmr,wins,goals,assists,weekly_score,weekly_rank,joined_at')
      .eq('discord_id', req.params.discordId)
      .single();
    if (error) return res.status(404).json({ error: 'Joueur introuvable' });
    res.json({ player });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
