// ═══════════════════════════════════════════════
//  routes/coach.js — Espace Coach & Réservations
// ═══════════════════════════════════════════════
const express  = require('express');
const axios    = require('axios');
const supabase = require('../db/supabase');
const { requireAuth, requireCoach } = require('../middleware/auth');
const router   = express.Router();

// ── GET /api/coach ── Liste des coachs actifs avec leurs créneaux
router.get('/', async (req, res) => {
  try {
    const { data: coaches, error } = await supabase
      .from('coaches')
      .select(`
        id, speciality, bio, price_per_hour, is_active,
        players (id, discord_id, username, avatar_url, role, rank_name, mmr)
      `)
      .eq('is_active', true);

    if (error) throw error;

    // Récupérer les créneaux disponibles pour chaque coach
    const today = new Date().toISOString().split('T')[0];
    const in14days = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    const coachesWithSlots = await Promise.all(coaches.map(async (coach) => {
      const { data: slots } = await supabase
        .from('coach_slots')
        .select('*')
        .eq('coach_id', coach.id)
        .gte('slot_date', today)
        .lte('slot_date', in14days)
        .order('slot_date', { ascending: true })
        .order('slot_time', { ascending: true });

      return { ...coach, slots: slots || [] };
    }));

    res.json({ coaches: coachesWithSlots });
  } catch (err) {
    res.status(500).json({ error: 'Erreur chargement coachs' });
  }
});

// ── POST /api/coach/book ── Réserver un créneau
router.post('/book', requireAuth, async (req, res) => {
  const { slot_id, rl_pseudo, current_rank, goal } = req.body;
  if (!slot_id || !rl_pseudo) {
    return res.status(400).json({ error: 'slot_id et rl_pseudo requis' });
  }

  try {
    // Vérifier que le créneau est disponible
    const { data: slot, error: slotErr } = await supabase
      .from('coach_slots').select('*').eq('id', slot_id).single();

    if (slotErr || !slot) return res.status(404).json({ error: 'Créneau introuvable' });
    if (slot.is_taken) return res.status(409).json({ error: 'Créneau déjà pris' });

    // Créer la réservation
    const { data: booking, error: bookErr } = await supabase
      .from('bookings')
      .insert({
        slot_id,
        player_id:   req.session.userId,
        coach_id:    slot.coach_id,
        rl_pseudo,
        current_rank: current_rank || '',
        goal:         goal || '',
        status:       'confirmed',
      })
      .select().single();

    if (bookErr) throw bookErr;

    // Marquer le créneau comme pris
    await supabase.from('coach_slots').update({ is_taken: true }).eq('id', slot_id);

    // Incrémenter l'activité du joueur
    const { data: player } = await supabase.from('players').select('site_activity').eq('id', req.session.userId).single();
    await supabase.from('players').update({
      site_activity: Math.min(100, (player?.site_activity || 0) + 5),
    }).eq('id', req.session.userId);

    // Notifier via Discord (webhook optionnel)
    await notifyDiscordBooking(booking, slot);

    res.json({ success: true, booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la réservation' });
  }
});

// ── DELETE /api/coach/book/:id ── Annuler une réservation
router.delete('/book/:id', requireAuth, async (req, res) => {
  try {
    const { data: booking } = await supabase
      .from('bookings').select('*').eq('id', req.params.id).single();

    if (!booking) return res.status(404).json({ error: 'Réservation introuvable' });
    if (booking.player_id !== req.session.userId && req.session.role !== 'admin') {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', req.params.id);
    await supabase.from('coach_slots').update({ is_taken: false }).eq('id', booking.slot_id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur annulation' });
  }
});

// ── GET /api/coach/my-bookings ── Mes réservations
router.get('/my-bookings', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, status, rl_pseudo, current_rank, goal, created_at,
        coach_slots (slot_date, slot_time),
        coaches (
          speciality,
          players (username, avatar_url)
        )
      `)
      .eq('player_id', req.session.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ bookings: data });
  } catch (err) {
    res.status(500).json({ error: 'Erreur chargement réservations' });
  }
});

// ── POST /api/coach/slots ── Coach ajoute des créneaux (Coach/Admin seulement)
router.post('/slots', requireAuth, requireCoach, async (req, res) => {
  const { slots } = req.body;
  // slots = [{ slot_date: '2026-05-15', slot_time: '14:00' }, ...]

  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({ error: 'slots[] requis' });
  }

  try {
    // Récupérer l'id coach
    const { data: coach } = await supabase
      .from('coaches').select('id').eq('player_id', req.session.userId).single();

    if (!coach) return res.status(404).json({ error: 'Profil coach introuvable' });

    const toInsert = slots.map(s => ({
      coach_id:  coach.id,
      slot_date: s.slot_date,
      slot_time: s.slot_time,
      is_taken:  false,
    }));

    const { data, error } = await supabase
      .from('coach_slots').upsert(toInsert, { onConflict: 'coach_id,slot_date,slot_time' }).select();

    if (error) throw error;
    res.json({ success: true, slots: data });
  } catch (err) {
    res.status(500).json({ error: 'Erreur ajout créneaux' });
  }
});

// ── DELETE /api/coach/slots/:id ── Supprimer un créneau
router.delete('/slots/:id', requireAuth, requireCoach, async (req, res) => {
  try {
    const { data: slot } = await supabase.from('coach_slots').select('is_taken').eq('id', req.params.id).single();
    if (slot?.is_taken) return res.status(409).json({ error: 'Créneau déjà réservé, annule d\'abord la réservation' });
    await supabase.from('coach_slots').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur suppression créneau' });
  }
});

// ── Notification Discord via webhook ──
async function notifyDiscordBooking(booking, slot) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_COACH;
  if (!webhookUrl) return;
  try {
    await axios.post(webhookUrl, {
      embeds: [{
        title: '🎯 Nouvelle réservation de coaching !',
        color: 0x00E5FF,
        fields: [
          { name: 'Joueur',         value: booking.rl_pseudo,         inline: true },
          { name: 'Rang actuel',    value: booking.current_rank || '?', inline: true },
          { name: 'Date',           value: `${slot.slot_date} à ${slot.slot_time}`, inline: true },
          { name: 'Objectif',       value: booking.goal || 'Non précisé', inline: false },
        ],
        footer: { text: 'Galaxy Sinks Esport' },
        timestamp: new Date().toISOString(),
      }]
    });
  } catch (e) {
    console.warn('Discord webhook coach failed:', e.message);
  }
}

module.exports = router;
