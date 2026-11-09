# RadQuizz

**En ligne : <https://gfahrni.github.io/radquizz/>** — dépôt : <https://github.com/gfahrni/radquizz>

Un quiz radiologique statique. **Un cas = une page**, avec un lien dédié à partager.
Sur la page, les onglets sont les **séries** de ce cas (axial médiastinal, coronal poumon, …) :
on fait défiler les coupes, puis on donne son diagnostic en bas de page. La réponse part
dans un Google Sheet via un Google Form intégré.

- **0 €**, 0 serveur, 0 base de données, 0 clé API.
- Une page par cas, avec son titre, sa description et son aperçu LinkedIn.
- Les réponses sont **préremplies** (cas + identifiant participant) : le participant ne saisit
  que son diagnostic et ses coordonnées.
- **Thème classique** et **thème de Noël** interchangeables (`?theme=noel`).

---

## 1. Comment c'est organisé

```
/images/<cas>/<série>/001.jpg      les coupes
/content/cases/<cas>.json          la fiche du cas (titre, histoire, séries)
/cas/<cas>/index.html              page générée, une par cas (ne pas éditer à la main)
/content/cases.json                index généré pour l'accueil
```

Un cas = un fichier JSON + un dossier d'images par série.

```json
{
  "id": "thorax-01",
  "title": "Douleur basithoracique droite",
  "exam": "TDM thoracique, sans injection",
  "stem": "Femme, 54 ans. Douleur brutale de l'hémithorax droit…",
  "formLabel": "Cas 1 — Douleur basithoracique droite",
  "series": [
    {
      "id": "axial",
      "tab": "Axial médiastinal",
      "note": "Coupes axiales · fenêtre médiastinale · 1 mm",
      "folder": "images/thorax-01/axial"
    },
    {
      "id": "coronal",
      "tab": "Coronal poumon",
      "note": "Reconstruction coronale · fenêtre parenchymateuse",
      "folder": "images/thorax-01/coronal"
    }
  ]
}
```

- `id` : slug du cas (a-z, 0-9, `-`). Il donne l'URL `…/cas/thorax-01/`. **Ne le changez pas
  après avoir diffusé le lien.**
- `formLabel` : la valeur envoyée dans le champ « Cas » du formulaire. C'est votre clé de
  regroupement dans le Sheet — gardez-la stable.
- `tab` : le texte court dans l'onglet. `note` : la ligne technique affichée au-dessus des images.
- Ordre des séries = ordre des onglets.

### Confort de lecture

Comportement « console » : le défilement est continu et **instantané**, sans animation
d'une coupe à l'autre.

- **Molette / trackpad** : une coupe par cran ; les petits mouvements s'accumulent, une
  geste rapide traverse la pile. En bout de pile, la molette rend la main à la page pour
  atteindre le formulaire.
- **Ascenseur à droite** de l'image : cliquer ou glisser pour se déplacer, ou lui donner
  le focus et utiliser les flèches.
- **Clavier** sur l'image : ↑ ↓, Page↑ Page↓, Début / Fin.
- Réglages en haut de `assets/app.js` : `SLICE_STEP` (pixels de molette par coupe, 100)
  et `PRELOAD` (coupes préchargées de part et d'autre, 4).

Sur écran tactile, on garde le défilement natif aimanté (une coupe à la fois).

---

## 2. Tester en local

```bash
npm start          # → http://localhost:8000
```

ou, sans Node : `python3 -m http.server 8000`.

> N'ouvrez pas `index.html` en double-clic : les navigateurs bloquent la lecture des
> fichiers JSON en `file://` et la page restera vide.

---

## 3. Construire le site

```bash
npm run build      # ou : node tools/build.mjs
```

Le script fait trois choses :

1. écrit `images/<cas>/<série>/manifest.json` — le navigateur ne peut pas lister un dossier,
   c'est donc cette liste qui permet d'afficher les coupes ;
2. génère `cas/<cas>/index.html` à partir de `_template.html` (titre, description, Open Graph) ;
3. génère `content/cases.json` pour l'accueil, et affiche le poids total.

**À relancer après chaque ajout d'images, de cas ou de série**, puis à committer
(`cas/` est versionné, c'est ce que GitHub Pages sert).

---

## 4. Créer le Google Form

Dans [forms.google.com](https://forms.google.com), créez un formulaire avec, dans cet ordre :

| # | Question | Type | Obligatoire |
|---|---|---|---|
| 1 | Diagnostic | **Paragraphe** (texte libre) | oui |
| 2 | Nom et prénom | Réponse courte | oui |
| 3 | Email | Réponse courte + validation « adresse e-mail » | oui |
| 4 | Statut | **Choix multiples** : Junior / Senior | oui |
| 5 | Cas | Réponse courte — libellé « *(prérempli — ne pas modifier)* » | non |
| 6 | ID participant | Réponse courte — libellé « *(prérempli — ne pas modifier)* » | non |

Les questions 5 et 6 sont remplies automatiquement par la page : elles servent à savoir **qui**
a répondu à **quel** cas.

Google Forms n'a pas de champ caché : laissez-les visibles mais à la fin, ça ne gêne personne.

Ensuite, onglet **Réponses** → « Associer à une feuille de calcul » → créez le Sheet
(une ligne par envoi).

Optionnel : dans le Sheet, **Outils → Paramètres de notification → toute modification →
notification immédiate** (vous êtes prévenu à chaque réponse, sans add-on).

---

## 5. Brancher le formulaire (5 minutes)

### a) L'identifiant du formulaire

Bouton **Envoyer → onglet `<>` (intégrer)** : l'URL ressemble à

```
https://docs.google.com/forms/d/e/1FAIpQLSdXXXXXXXXXXXXXXXXXXXXXXXXXXXX/viewform?embedded=true
```

L'identifiant est la partie entre `/d/e/` et `/viewform`.

### b) Les identifiants de champs (`entry.…`)

Menu **⋮ → Obtenir le lien prérempli**. Remplissez chaque champ avec une valeur bidon
(`test`), cliquez **Obtenir le lien**, puis **Copier**.

L'URL copiée contient `?entry.123456789=test&entry.987654321=test`. Chaque `entry.…`
correspond à une question (remplissez un seul champ à la fois pour être sûr de l'ordre),
puis collez le résultat dans `content/form.json` :

```json
{
  "formId": "1FAIpQLSdXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "entries": {
    "cas": "entry.123456789",
    "participant": "entry.987654321"
  }
}
```

Rechargez : le formulaire apparaît en bas de chaque cas, avec le cas et l'ID déjà remplis.

> Un `entry.…` change si vous **supprimez puis recréez** une question. Le modifier
> (texte, ordre) ne le change pas.

---

## 6. Remplacer les images par vos cas

Un dossier par série, images nommées dans l'ordre de défilement :

```
images/thorax-01/axial/001.jpg, 002.jpg, …
```

1. Supprimez les images de démonstration, déposez les vôtres.
2. Nommez-les `001.jpg`, `002.jpg`, … (n'importe quel nom dont le tri numérique donne le bon
   ordre fonctionne : `IMG_1.jpg`, `IMG_2.jpg`, `IMG_10.jpg`).
3. `npm run build`, puis commit + push.

### Poids des images

Visez **1200–1600 px** de large et **~100–200 Ko** par coupe. Réduction en lot (macOS) :

```bash
sips -Z 1600 -s formatOptions 80 images/thorax-01/axial/*.jpg
npm run build
```

Repères GitHub Pages : **1 Go** par site, **~100 Go** de trafic par mois. 40 coupes à 150 Ko
= 6 Mo par série. Si vous dépassez, passez sur Cloudflare Pages (pas de quota de trafic,
20 000 fichiers) ou Cloudflare R2 pour les images.

### Ajouter un cas

1. `content/cases/mon-cas.json` (copiez-en un et adaptez `id`, `title`, `stem`, `formLabel`).
2. Les dossiers `images/mon-cas/<série>/` avec les JPG.
3. `npm run build` → la page `cas/mon-cas/index.html` et l'entrée d'accueil sont créées.

### Ajouter une série à un cas existant

Ajoutez un dossier `images/thorax-01/sagittal/` et une entrée dans `series` du JSON du cas,
puis `npm run build`. L'onglet apparaît automatiquement.

---

## 7. Le thème de Noël

Trois façons de l'activer :

- **manuel** : bouton « Noël » en haut à droite (mémorisé dans le navigateur) ;
- **par lien** : `https://…/radquizz/?theme=noel` — idéal pour un post de décembre ;
- **automatique** : tout le mois de décembre, si le visiteur n'a jamais choisi de thème.

Tout le design tient dans des variables CSS au début de `assets/style.css`. Pour un troisième
thème, dupliquez le bloc `[data-theme="noel"]`, changez les couleurs, ajoutez un bouton dans
`index.html` et `_template.html` :

```html
<button class="chip" type="button" data-set-theme="ete">Été</button>
```

et déclarez-le dans `assets/theme.js` : `const THEMES = ['classic', 'noel', 'ete'];`.

**Le formulaire, lui, ne suit pas le thème** : c'est un iframe Google, impossible à styler
depuis la page. Pour éviter le contraste, changez aussi sa palette dans Google Forms
(icône palette). Même formulaire, même Sheet.

---

## 8. Déployer, mettre à jour, versionner

Première mise en ligne (déjà faite pour ce dépôt) :

```bash
git init && git add . && git commit -m "RadQuizz"
gh repo create radquizz --public --source=. --push
gh api -X POST repos/<compte>/radquizz/pages -f 'source[branch]=main' -f 'source[path]=/'
```

Mises à jour :

```bash
npm run build && git add . && git commit -m "Nouveau cas" && git push
```

La version vit dans `package.json` (`version`), est injectée dans les pages au build et
affichée en pied de page. Le build ajoute aussi `?v=<version>` aux fichiers CSS et JS :
à chaque nouveau numéro de version, leur cache navigateur est invalidé automatiquement. Pour publier une version :

```bash
npm version 0.2.0 --no-git-tag-version
npm run build
git add . && git commit -m "v0.2.0"
git tag v0.2.0 && git push && git push --tags
```

> ⚠️ Le dépôt est **public** : les images sont téléchargeables par n'importe qui.
> Anonymisez les DICOM avant export (nom, date, numéro de dossier, annotations incrustées,
> nom du fichier) et évitez les cas identifiants sans accord.

---

## 9. Dépannage

| Symptôme | Cause probable |
|---|---|
| Page vide, spinner infini | Ouverture en `file://` → lancez `npm start` |
| Accueil vide / « aucun cas » | `npm run build` pas lancé (génère `content/cases.json`) |
| 404 sur `/cas/mon-cas/` | `npm run build` pas relancé après création du JSON |
| Aucune image, message « Aucune coupe » | `manifest.json` absent → `npm run build` |
| Anciennes séries encore visibles | `cas/<vieux-cas>/` traîne : supprimez le dossier et rebuild |
| Formulaire blanc / vide | `formId` faux, formulaire restreint, ou bloqueur de cookies |
| Double barre de défilement dans le formulaire | Ajustez `height` de `.form-shell iframe` dans `assets/style.css` (1200 px desktop / 1560 px mobile) |
| Les réponses n'arrivent pas dans le Sheet | onglet Réponses → vérifiez la feuille ; formulaire « Tout le monde disposant du lien » |
| Une mise à jour n'apparaît pas | cache navigateur : GitHub Pages envoie `cache-control: max-age=600`. Rechargez avec `Cmd/Ctrl + Shift + R`, ou attendez 10 min. Vider les cookies ne sert à rien. |

---

## 10. Structure

```
index.html                  accueil : liste des cas
_template.html              gabarit d'une page de cas (édité par le build)
cas/<cas>/index.html        pages générées, une par cas

assets/style.css            design + thèmes (variables CSS)
assets/theme.js             thème partagé (bascule, mémorisation, décembre)
assets/app.js               page de cas : séries, pile d'images, formulaire
assets/home.js              accueil : grille des cas
assets/og-image.png         aperçu LinkedIn de l'accueil (1200×630)

content/cases/<cas>.json    ← à éditer : les cas
content/cases.json          généré : index de l'accueil
content/form.json           ← à éditer : identifiant du Google Form

images/<cas>/<série>/       les coupes + manifest.json généré

tools/build.mjs             manifest + pages + index
tools/serve.mjs             serveur local de test
tools/make-placeholders.py  régénère les images de démonstration
package.json                version du site + scripts
.nojekyll                   évite le traitement Jekyll par GitHub Pages
```

JavaScript sans dépendance ni étape de build : ce que vous poussez sur GitHub est
exactement ce qui est servi.
