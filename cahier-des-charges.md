# Cahier des charges — Site Galaxy Sinks (prochaine étape)

Document de travail : liste de ce qu'on peut ajouter et améliorer sur le site,
classé par priorité. À valider / ajuster ensemble avant de commencer.

État actuel : site en ligne sur Render (galaxy-sinks-2.onrender.com), thème
« galaxie minimaliste » (starfield, nébuleuse, logo GS lumineux, panneaux
glassmorphism, scroll inertiel). Contenu partiellement placeholder.

---

## 1. Contenu réel à compléter (prioritaire)

Le design est prêt ; il manque surtout tes vraies infos à la place des exemples.

- **Liens réseaux réels** : remplacer les `href="#"` (Twitch, Instagram, TikTok, YouTube) par les vraies URLs de la team.
- **Roster des joueurs** : pour chaque joueur → pseudo, rôle/poste, rang Rocket League, éventuellement un avatar ou une photo.
- **Staff** : vérifier/compléter les membres (INSANE, Shadow, etc.) et leurs liens.
- **Stats réelles** : nombre de membres, joueurs, victoires — chiffres à jour.
- **Historique / résultats de matchs** : vrais scores et adversaires au lieu de l'exemple.
- **Boutique** : brancher le vrai lien quand elle sera prête (sinon garder « Coming Soon »).

## 2. Nouvelles sections / fonctionnalités

- **Palmarès / Résultats** : section dédiée aux tournois joués et gagnés (dates, placements).
- **Prochains matchs** : petit calendrier des rencontres à venir.
- **Recrutement** : bouton « Postuler » qui renvoie vers le Discord (ou un formulaire Google Form / Typeform intégré) pour candidater à la team.
- **Clips & highlights** : galerie de vidéos (intégration YouTube) des plus beaux buts.
- **Live Twitch** : widget qui affiche automatiquement quand un membre est en live.

## 3. Améliorations techniques

- **Optimiser le chargement** : le bundle Three.js fait ~700 kB. On peut le charger en différé (lazy load) et alléger le premier affichage → site plus rapide, surtout sur mobile.
- **SEO** : titre + description par section, favicon complet, image de partage soignée (déjà en place partiellement), sitemap.
- **Domaine personnalisé** : brancher une vraie adresse (ex. `galaxysinks.com`) au lieu de l'URL `onrender.com` (Settings → Custom Domains sur Render).
- **Statistiques de visite** : outil simple et respectueux de la vie privée (Plausible / Umami) pour voir la fréquentation.
- **Performance mobile** : réduire automatiquement le nombre de particules sur petits appareils (déjà partiellement fait) et vérifier le rendu sur téléphone.

## 4. Design / finitions

- Peaufiner le hero (titre, tagline, animation d'entrée).
- Vérifier la lisibilité de tous les textes sur le fond galaxie.
- Page d'erreur 404 aux couleurs de la team.
- Cohérence des accents de couleur entre les sections.

## 5. Process de mise à jour

- Chaque `git push` redéploie automatiquement le site (déjà en place).
- Prévoir une façon simple pour toi de modifier les textes/liens sans casser le code (ex. regrouper toutes les infos éditables au même endroit).

---

## Priorités proposées

| Priorité | Éléments |
|----------|----------|
| 🔴 Indispensable | Liens réseaux réels, roster, stats réelles |
| 🟠 Important | Palmarès, recrutement Discord, optimisation chargement, domaine perso |
| 🟢 Bonus | Live Twitch, galerie clips, analytics, page 404 |

_À toi de me dire ce que tu veux garder, retirer ou ajouter — ensuite on attaque section par section._
