// ═══════════════════════════════════════════════
//  middleware/auth.js — Vérification des permissions
// ═══════════════════════════════════════════════

// ── Vérifie que l'utilisateur est connecté ──
function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Connexion requise', redirect: '/login' });
  }
  next();
}

// ── Vérifie le rôle Admin ──
function requireAdmin(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Connexion requise' });
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux Admins' });
  }
  next();
}

// ── Vérifie le rôle Staff ou Admin ──
function requireStaff(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Connexion requise' });
  }
  if (!['admin', 'staff'].includes(req.session.role)) {
    return res.status(403).json({ error: 'Accès réservé aux Staff et Admins' });
  }
  next();
}

// ── Vérifie le rôle Coach, Staff ou Admin ──
function requireCoach(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Connexion requise' });
  }
  if (!['admin', 'staff', 'coach'].includes(req.session.role)) {
    return res.status(403).json({ error: 'Accès réservé aux Coachs' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireStaff, requireCoach };
