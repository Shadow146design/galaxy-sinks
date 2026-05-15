# 🚀 GUIDE DE DÉPLOIEMENT — Galaxy Sinks Esport
## Temps estimé : 45 minutes — Tout est GRATUIT

---

## ÉTAPE 1 — Créer ton App Discord Developer (10 min)

1. Va sur https://discord.com/developers/applications
2. Clique **"New Application"** → Nom : `Galaxy Sinks Esport`
3. Va dans l'onglet **"OAuth2"** → note le **Client ID** et **Client Secret**
4. Dans **"Redirects"**, ajoute :
   - `http://localhost:3000/auth/discord/callback` (développement)
   - `https://TON-DOMAINE.railway.app/auth/discord/callback` (production)
5. Va dans l'onglet **"Bot"** → clique **"Add Bot"** → note le **Token**
6. Active dans Bot → "Privileged Gateway Intents" :
   - SERVER MEMBERS INTENT ✅
   - MESSAGE CONTENT INTENT ✅
7. Invite le bot sur ton serveur Discord :
   - OAuth2 → URL Generator → Scopes : `bot` → Bot Permissions : `Manage Roles`, `View Audit Log`
   - Copie l'URL générée et ouvre-la pour ajouter le bot à Galaxy Sinks Discord

### Récupérer les IDs des rôles Discord
1. Dans Discord, active le Mode Développeur : Paramètres → Avancé → Mode développeur ✅
2. Sur ton serveur Galaxy Sinks → Paramètres du serveur → Rôles
3. Clic droit sur chaque rôle → **"Copier l'identifiant"**
4. Note les IDs de : Admin, Staff, Coach, Membre

### Récupérer l'ID de ton serveur Discord
- Clic droit sur le nom du serveur Galaxy Sinks → **"Copier l'identifiant"**

---

## ÉTAPE 2 — Créer la base de données Supabase (5 min)

1. Va sur https://supabase.com → **"Start your project"**
2. Crée un compte (gratuit)
3. **"New Project"** → Nom : `galaxy-sinks` → Région : `West EU (Ireland)` → mot de passe fort
4. Attends 2 minutes que le projet se crée
5. Va dans **SQL Editor** → colle tout le contenu du fichier `db/schema.sql` → **"Run"**
6. Va dans **Settings → API** → note :
   - **Project URL** (ex: `https://abcdefgh.supabase.co`)
   - **anon public key** (longue clé JWT)

---

## ÉTAPE 3 — Clé Tracker Network (5 min)

1. Va sur https://tracker.gg/developers
2. Crée un compte → **"Create Application"**
3. Note ta **API Key** (gratuit, 100 req/min)

---

## ÉTAPE 4 — Configurer le projet (5 min)

1. Copie le fichier `.env.example` en `.env`
2. Remplis TOUTES les valeurs :

```
DISCORD_CLIENT_ID=     → depuis Discord Developer Portal → OAuth2
DISCORD_CLIENT_SECRET= → depuis Discord Developer Portal → OAuth2
DISCORD_BOT_TOKEN=     → depuis Discord Developer Portal → Bot
DISCORD_GUILD_ID=      → ID de ton serveur Discord Galaxy Sinks

SUPABASE_URL=          → depuis Supabase → Settings → API
SUPABASE_KEY=          → depuis Supabase → Settings → API (anon key)

TRACKER_API_KEY=       → depuis tracker.gg/developers

DISCORD_ROLE_ADMIN=    → ID du rôle Admin dans Discord
DISCORD_ROLE_STAFF=    → ID du rôle Staff dans Discord
DISCORD_ROLE_COACH=    → ID du rôle Coach dans Discord
DISCORD_ROLE_MEMBRE=   → ID du rôle Membre dans Discord

SESSION_SECRET=        → tape n'importe quelle longue phrase secrète

FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3000
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback
```

3. Copie le fichier `galaxy-sinks.html` dans un dossier `public/` et renomme-le `index.html`

---

## ÉTAPE 5 — Tester en local (5 min)

```bash
# Dans le dossier galaxy-sinks-backend
npm install
npm run dev
# → Ouvre http://localhost:3000
```

---

## ÉTAPE 6 — Déployer sur Railway (10 min)

1. Va sur https://railway.app → crée un compte (gratuit)
2. **"New Project"** → **"Deploy from GitHub repo"**
3. Connecte ton GitHub → crée un nouveau repo → pousse le code :
   ```bash
   git init
   git add .
   git commit -m "Galaxy Sinks Esport - Initial deploy"
   git remote add origin https://github.com/TON_USERNAME/galaxy-sinks
   git push -u origin main
   ```
4. Dans Railway → sélectionne le repo → **"Deploy Now"**
5. Va dans **Variables** → ajoute toutes les variables du `.env`
   (mais change les URLs vers ton domaine Railway)
6. Récupère ton URL Railway (ex: `galaxy-sinks.up.railway.app`)
7. Met à jour dans les variables :
   - `FRONTEND_URL=https://galaxy-sinks.up.railway.app`
   - `BACKEND_URL=https://galaxy-sinks.up.railway.app`
   - `DISCORD_REDIRECT_URI=https://galaxy-sinks.up.railway.app/auth/discord/callback`
8. Mets aussi à jour le **Redirect URI** dans Discord Developer Portal

---

## ÉTAPE 7 — Connecter le frontend au backend (5 min)

Dans le fichier `public/index.html`, cherche la section JavaScript et ajoute en haut :

```javascript
const API = ''; // Vide = même domaine, ou mets l'URL Railway en dev local

// Remplace la fonction simulateLogin() par :
async function realLogin() {
  window.location.href = API + '/auth/discord';
}

// Au chargement de la page, vérifie si connecté :
async function checkAuth() {
  const res = await fetch(API + '/auth/me', { credentials: 'include' });
  const { user } = await res.json();
  if (user) {
    currentUser = user;
    renderTopbarAuth();
    // Si URL contient ?login=success, afficher le profil
    if (window.location.search.includes('login=success')) {
      showPage('profil');
    }
  }
}
checkAuth();
```

---

## 🎉 C'EST EN LIGNE !

Ton site Galaxy Sinks est maintenant :
✅ Connecté à Discord (vraie auth OAuth2)
✅ Rôles Discord vérifiés en temps réel
✅ Stats Rocket League depuis Tracker Network
✅ Leaderboard avec vraies données
✅ Réservations coach stockées en base
✅ Admin panel fonctionnel

---

## ❓ Problèmes fréquents

**"Joueur introuvable sur Tracker Network"**
→ Vérifie que le pseudo est exact (sensible aux majuscules)
→ Vérifie la plateforme (epic/steam/psn/xbox)

**"Erreur synchronisation Discord"**
→ Vérifie que le bot est bien dans le serveur
→ Vérifie que SERVER MEMBERS INTENT est activé

**"Non connecté" après login Discord**
→ Vérifie que DISCORD_REDIRECT_URI est identique dans .env ET dans Discord Developer Portal

**Le site ne charge pas sur Railway**
→ Vérifie que le fichier est bien `public/index.html`
→ Vérifie les logs dans Railway Dashboard
