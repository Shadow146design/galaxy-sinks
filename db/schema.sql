-- ═══════════════════════════════════════════════════
--  GALAXY SINKS — Schéma base de données Supabase
--  Colle ce SQL dans Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════

-- ── Table des joueurs ──
CREATE TABLE IF NOT EXISTS players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id      TEXT UNIQUE NOT NULL,
  username        TEXT NOT NULL,
  discriminator   TEXT,
  avatar_url      TEXT,
  role            TEXT NOT NULL DEFAULT 'membre' CHECK (role IN ('admin','staff','coach','membre')),
  discord_roles   TEXT[] DEFAULT '{}',

  -- Stats Rocket League
  rl_pseudo       TEXT,
  rl_platform     TEXT DEFAULT 'epic' CHECK (rl_platform IN ('epic','steam','psn','xbox','switch')),
  mmr             INTEGER DEFAULT 0,
  rank_name       TEXT DEFAULT 'Non classé',
  rank_division   TEXT DEFAULT '',
  wins            INTEGER DEFAULT 0,
  losses          INTEGER DEFAULT 0,
  goals           INTEGER DEFAULT 0,
  assists         INTEGER DEFAULT 0,
  saves           INTEGER DEFAULT 0,
  shots           INTEGER DEFAULT 0,
  mvp_count       INTEGER DEFAULT 0,

  -- Stats site
  site_activity   INTEGER DEFAULT 0,   -- score d'activité 0-100
  sessions_count  INTEGER DEFAULT 0,
  last_seen       TIMESTAMPTZ DEFAULT NOW(),

  -- Leaderboard
  weekly_score    INTEGER DEFAULT 0,
  weekly_rank     INTEGER DEFAULT 0,
  last_lb_reset   TIMESTAMPTZ DEFAULT NOW(),

  -- Métadonnées
  is_verified     BOOLEAN DEFAULT false,
  stats_manual    BOOLEAN DEFAULT false,  -- true si stats entrées manuellement
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Table leaderboard historique ──
CREATE TABLE IF NOT EXISTS leaderboard_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID REFERENCES players(id) ON DELETE CASCADE,
  week_start  DATE NOT NULL,
  week_end    DATE NOT NULL,
  rank        INTEGER NOT NULL,
  mmr         INTEGER NOT NULL,
  wins        INTEGER NOT NULL,
  score       INTEGER NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Table des coachs ──
CREATE TABLE IF NOT EXISTS coaches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID REFERENCES players(id) ON DELETE CASCADE,
  speciality      TEXT NOT NULL,
  bio             TEXT,
  is_active       BOOLEAN DEFAULT true,
  price_per_hour  INTEGER DEFAULT 0,  -- en centimes, 0 = gratuit
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Table des disponibilités coach ──
CREATE TABLE IF NOT EXISTS coach_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID REFERENCES coaches(id) ON DELETE CASCADE,
  slot_date   DATE NOT NULL,
  slot_time   TIME NOT NULL,
  is_taken    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coach_id, slot_date, slot_time)
);

-- ── Table des réservations ──
CREATE TABLE IF NOT EXISTS bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id         UUID REFERENCES coach_slots(id) ON DELETE CASCADE,
  player_id       UUID REFERENCES players(id) ON DELETE CASCADE,
  coach_id        UUID REFERENCES coaches(id) ON DELETE CASCADE,
  rl_pseudo       TEXT NOT NULL,
  current_rank    TEXT,
  goal            TEXT,
  status          TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled','completed')),
  discord_notified BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Table des sessions (auth) ──
CREATE TABLE IF NOT EXISTS user_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID REFERENCES players(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Index pour les performances ──
CREATE INDEX IF NOT EXISTS idx_players_discord_id ON players(discord_id);
CREATE INDEX IF NOT EXISTS idx_players_weekly_score ON players(weekly_score DESC);
CREATE INDEX IF NOT EXISTS idx_players_mmr ON players(mmr DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_player ON bookings(player_id);
CREATE INDEX IF NOT EXISTS idx_bookings_coach ON bookings(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_slots_coach ON coach_slots(coach_id);

-- ── Fonction : mise à jour auto de updated_at ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Vue : leaderboard actuel ──
CREATE OR REPLACE VIEW leaderboard_current AS
SELECT
  p.id,
  p.discord_id,
  p.username,
  p.avatar_url,
  p.role,
  p.rank_name,
  p.mmr,
  p.wins,
  p.losses,
  p.goals,
  p.assists,
  p.site_activity,
  p.weekly_score,
  p.weekly_rank,
  ROUND(p.wins::numeric / NULLIF(p.wins + p.losses, 0) * 100, 1) AS win_rate
FROM players p
WHERE p.mmr >= 651  -- Platinum minimum (651 MMR)
  AND p.is_verified = true
ORDER BY p.weekly_score DESC;

-- ── Fonction : calcul du score leaderboard ──
CREATE OR REPLACE FUNCTION calculate_weekly_score(
  p_mmr INTEGER,
  p_wins INTEGER,
  p_goals INTEGER,
  p_activity INTEGER
) RETURNS INTEGER AS $$
BEGIN
  RETURN (p_mmr * 0.4 + p_wins * 2 + p_goals * 0.5 + p_activity * 10)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- ── Fonction : reset hebdomadaire du leaderboard ──
CREATE OR REPLACE FUNCTION reset_weekly_leaderboard()
RETURNS void AS $$
DECLARE
  week_start DATE := date_trunc('week', NOW())::DATE;
  week_end   DATE := (date_trunc('week', NOW()) + INTERVAL '6 days')::DATE;
  r RECORD;
  rank_counter INTEGER := 1;
BEGIN
  -- Sauvegarder l'historique
  FOR r IN
    SELECT id, mmr, wins, weekly_score
    FROM players
    WHERE is_verified = true AND mmr >= 651
    ORDER BY weekly_score DESC
  LOOP
    INSERT INTO leaderboard_history (player_id, week_start, week_end, rank, mmr, wins, score)
    VALUES (r.id, week_start, week_end, rank_counter, r.mmr, r.wins, r.weekly_score);
    rank_counter := rank_counter + 1;
  END LOOP;

  -- Reset les scores hebdomadaires
  UPDATE players SET
    weekly_score = 0,
    weekly_rank = 0,
    last_lb_reset = NOW();

  RAISE NOTICE 'Leaderboard resetté pour la semaine du %', week_start;
END;
$$ LANGUAGE plpgsql;
