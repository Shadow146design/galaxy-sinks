function requireAuth(req, res, next) {
  try {
    const cookie = req.cookies?.gs_user;
    if (!cookie) return res.status(401).json({ error: 'Connexion requise', redirect: '/login' });
    const user = JSON.parse(cookie);
    if (!user.loggedIn) return res.status(401).json({ error: 'Connexion requise' });
    req.session = req.session || {};
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.username = user.username;
    next();
  } catch(e) {
    res.status(401).json({ error: 'Connexion requise' });
  }
}

function requireAdmin(req, res, next) {
  try {
    const cookie = req.cookies?.gs_user;
    if (!cookie) return res.status(401).json({ error: 'Non autorisé' });
    const user = JSON.parse(cookie);
    if (user.role !== 'admin') return res.status(403).json({ error: 'Accès Admin requis' });
    req.session = req.session || {};
    req.session.userId = user.id;
    req.session.role = user.role;
    next();
  } catch(e) {
    res.status(403).json({ error: 'Non autorisé' });
  }
}

function requireStaff(req, res, next) {
  try {
    const cookie = req.cookies?.gs_user;
    if (!cookie) return res.status(401).json({ error: 'Non autorisé' });
    const user = JSON.parse(cookie);
    if (!['admin','staff'].includes(user.role)) return res.status(403).json({ error: 'Accès Staff requis' });
    req.session = req.session || {};
    req.session.userId = user.id;
    req.session.role = user.role;
    next();
  } catch(e) {
    res.status(403).json({ error: 'Non autorisé' });
  }
}

function requireCoach(req, res, next) {
  try {
    const cookie = req.cookies?.gs_user;
    if (!cookie) return res.status(401).json({ error: 'Non autorisé' });
    const user = JSON.parse(cookie);
    if (!['admin','staff','coach'].includes(user.role)) return res.status(403).json({ error: 'Accès Coach requis' });
    req.session = req.session || {};
    req.session.userId = user.id;
    req.session.role = user.role;
    next();
  } catch(e) {
    res.status(403).json({ error: 'Non autorisé' });
  }
}

module.exports = { requireAuth, requireAdmin, requireStaff, requireCoach };
