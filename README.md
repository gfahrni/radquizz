# RadQuizz

**En ligne : <https://gfahrni.github.io/radquizz/>** — dépôt : <https://github.com/gfahrni/radquizz>

Un quiz radiologique statique : on clique sur un lien, on fait défiler les coupes d'une série,
on donne son diagnostic en bas de page, et la réponse part dans un Google Sheet via un
Google Form intégré.

- **0 €**, 0 serveur, 0 base de données, 0 clé API.
- Une **série = un onglet = un dossier d'images JPG**.
- Les réponses sont **préremplies** (série + identifiant participant) : le participant ne saisit
  que son diagnostic et ses coordonnées.
- **Thème classique** et **thème de Noël** interchangeables (`?theme=noel`).

---

## 1. Tester en local

```bash
node tools/serve.mjs          # → http://localhost:8000
```

ou, sans Node :

```bash
python3 -m http.server 8000
```

> N'ouvrez pas `index.html` en double-clic : les navigateurs bloquent la lecture des
> fichiers JSON en `file://` et la page restera vide.

---

## 2. Mettre en ligne sur GitHub Pages

> C'est **déjà fait** pour ce dépôt : <https://gfahrni.github.io/radquizz/>.
> Cette section sert si vous repartez de zéro ou dupliquez le projet.

```bash
git init
git add .
git commit -m "RadQuizz : première version"
gh repo create radquizz --public --source=. --push
```

Puis, une seule fois, activer Pages :

```bash
gh api -X POST repos/<votre-compte>/radquizz/pages \
  -f 'source[branch]=main' -f 'source[path]=/'
```

Sans `gh` : Settings → Pages → Source « Deploy from a branch » → `main` / `/ (root)`.
Le site est en ligne au bout d'une minute sur `https://<votre-compte>.github.io/radquizz/`.

**Mises à jour** ensuite : `git add . && git commit -m "…" && git push`. C'est tout.

> ⚠️ Le dépôt est **public** : les images sont téléchargeables par n'importe qui.
> Anonymisez les DICOM avant export (nom, date, numéro de dossier, annotations incrustées,
> nom du fichier) et évitez les cas identifiants sans accord.

---

## 3. Créer le Google Form

Dans [forms.google.com](https://forms.google.com), créez un formulaire avec, dans cet ordre :

| # | Question | Type | Obligatoire |
|---|---|---|---|
| 1 | Diagnostic | **Paragraphe** (texte libre) | oui |
| 2 | Nom et prénom | Réponse courte | oui |
| 3 | Email | Réponse courte + validation « adresse e-mail » | oui |
| 4 | Statut | **Choix multiples** : Junior / Senior | oui |
| 5 | Série | Réponse courte — libellé « *(prérempli — ne pas modifier)* » | non |
| 6 | ID participant | Réponse courte — libellé « *(prérempli — ne pas modifier)* » | non |

Les questions 5 et 6 sont remplies automatiquement par la page : elles servent à savoir **qui**
a répondu à **quelle** série, même si la personne répond à plusieurs cas à des moments différents.

Google Forms n'a pas de champ caché : laissez-les visibles mais à la fin, ça ne gêne personne.

Ensuite, dans l'onglet **Réponses** : « Associer à une feuille de calcul » → créez le Sheet.
Vous y retrouverez une ligne par envoi.

Optionnel mais pratique : dans le Sheet, **Outils → Paramètres de notification → toute modification
→ notification immédiate** (vous êtes prévenu à chaque réponse, sans add-on).

---

## 4. Brancher le formulaire (5 minutes)

Deux informations à récupérer.

### a) L'identifiant du formulaire

Bouton **Envoyer → onglet `<>` (intégrer)** : l'URL ressemble à

```
https://docs.google.com/forms/d/e/1FAIpQLSdXXXXXXXXXXXXXXXXXXXXXXXXXXXX/viewform?embedded=true
```

L'identifiant est la partie entre `/d/e/` et `/viewform`.

### b) Les identifiants de champs (`entry.…`)

Menu **⋮ → Obtenir le lien prérempli**. Remplissez chaque champ avec une valeur bidon
(`test`, `test@test.ch`), cliquez **Obtenir le lien**, puis **Copier**.

L'URL copiée contient `?entry.123456789=test&entry.987654321=test@test.ch`. Chaque `entry.…`
correspond à une question. Associez-les de mémoire (remplissez un seul champ à la fois pour
être sûr de l'ordre), puis collez le résultat dans `content/form.json` :

```json
{
  "formId": "1FAIpQLSdXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "entries": {
    "serie": "entry.123456789",
    "participant": "entry.987654321"
  }
}
```

Rechargez la page : le formulaire apparaît en bas de chaque série, avec la série et l'ID déjà remplis.

> Un `entry.…` change si vous **supprimez puis recréez** une question. Le modifier (texte, ordre)
> ne le change pas.

---

## 5. Remplacer les images par vos cas

Un dossier = une série, et les images y sont nommées dans l'ordre de défilement :

```
images/
  serie-01/
    001.jpg
    002.jpg
    …
```

1. Supprimez les images de démonstration, déposez les vôtres.
2. Nommez-les `001.jpg`, `002.jpg`, … (ou n'importe quel nom dont le tri numérique donne
   le bon ordre : `IMG_1.jpg`, `IMG_2.jpg`, `IMG_10.jpg` fonctionne).
3. Régénérez les manifestes :

```bash
node tools/build.mjs
```

Le script liste chaque dossier, écrit `manifest.json` et affiche le poids. Le site ne peut pas
lister un dossier seul : **sans manifest, les images ne s'affichent pas.**

### Poids des images

Visez **1200–1600 px de large** et **~100–200 Ko** par coupe. Pour réduire en lot (macOS) :

```bash
sips -Z 1600 -s formatOptions 80 images/serie-01/*.jpg
```

Repères GitHub Pages : **1 Go** par site, **~100 Go** de trafic par mois. 80 coupes à 150 Ko
= 12 Mo par série, soit ~80 séries possibles. Si vous dépassez, passez sur Cloudflare Pages
(pas de quota de trafic, 20 000 fichiers) ou Cloudflare R2 pour les images.

### Ajouter une série

Ajoutez un dossier `images/serie-04/`, lancez `node tools/build.mjs`, puis une entrée dans
`content/series.json` :

```json
{
  "id": "serie-04",
  "tab": "Bassin",
  "title": "Traumatisme du bassin",
  "stem": "Homme, 42 ans, chute de hauteur…",
  "formLabel": "Série 4 — Bassin",
  "folder": "images/serie-04"
}
```

- `tab` : le texte court dans l'onglet.
- `formLabel` : la valeur envoyée dans le champ « Série » du formulaire (gardez-la stable,
  c'est votre clé de regroupement dans le Sheet).
- `id` : sert d'ancre partageable (`…/#/serie-04`). Ne le changez pas après diffusion.

---

## 6. Le thème de Noël

Trois façons de l'activer :

- **manuel** : bouton « Noël » en haut à droite (mémorisé dans le navigateur) ;
- **par lien** : `https://…/radquizz/?theme=noel` — idéal pour un post de décembre ;
- **automatique** : tout le mois de décembre, si le visiteur n'a jamais choisi de thème.

Tout le design tient dans des variables CSS au début de `assets/style.css`. Pour créer un
troisième thème, dupliquez le bloc `[data-theme="noel"]`, changez les couleurs, puis ajoutez
un bouton dans `index.html` :

```html
<button class="chip" type="button" data-set-theme="ete">Été</button>
```

et déclarez-le dans `assets/app.js` : `const THEMES = ['classic', 'noel', 'ete'];`.

**Le formulaire, lui, ne suit pas le thème** : c'est un iframe Google, impossible à styler
depuis la page. Pour éviter le contraste, changez aussi la palette du formulaire dans
Google Forms (icône palette en haut). Même formulaire, même Sheet.

---

## 7. Récupérer et noter les réponses

Tout est dans le Google Sheet associé au formulaire. Une ligne par envoi :

`horodatage | diagnostic | nom | email | statut | série | id participant`

Pour corriger, ajoutez une colonne « juste ? » à la main, ou une formule si vous normalisez
les réponses. Un tableau croisé dynamique (Données → Tableau croisé) donne le score par
statut (junior/senior) en deux clics.

Pour répondre au participant : le formulaire peut envoyer automatiquement une copie de ses
réponses (Paramètres → Réponses → « Envoyer une copie des réponses »). Ça marche aussi
comme preuve de participation.

---

## 8. Dépannage

| Symptôme | Cause probable |
|---|---|
| Page vide, spinner infini | Ouverture en `file://` → lancez `node tools/serve.mjs` |
| « Impossible de charger le quiz » | `content/series.json` absent ou JSON invalide (virgule en trop) |
| Aucune image, message « Aucune coupe » | `manifest.json` manquant → `node tools/build.mjs` |
| Formulaire blanc / vide | `formId` faux, formulaire restreint à votre organisation, ou bloqueur de cookies |
| Double barre de défilement dans le formulaire | Ajustez `height` de `.form-shell iframe` dans `assets/style.css` (1520 px desktop / 1760 px mobile) |
| Les réponses n'arrivent pas dans le Sheet | Onglet Réponses → vérifiez la feuille associée ; le formulaire doit être « Tout le monde disposant du lien » |
| Page 404 après activation de Pages | Attendez 1–2 min ; Settings → Pages doit indiquer `main` / `/ (root)` |
| Une mise à jour n'apparaît pas | Cache GitHub Pages (~10 min) ; testez en navigation privée |

---

## 9. Structure

```
index.html                  page unique
assets/style.css            design + thèmes (variables CSS)
assets/app.js               chargement des séries, pile d'images, formulaire
assets/og-image.png         aperçu du lien sur LinkedIn (1200×630)

content/series.json         ← à éditer : les cas
content/form.json           ← à éditer : identifiant du Google Form

images/<serie>/001.jpg…     les coupes
images/<serie>/manifest.json    généré par tools/build.mjs

tools/build.mjs             régénère les manifest
tools/serve.mjs             serveur local de test
tools/make-placeholders.py  régénère les images de démonstration
.nojekyll                   évite le traitement Jekyll par GitHub Pages
```

Le JavaScript est volontairement sans dépendance ni étape de build : ce que vous poussez
sur GitHub est exactement ce qui est servi.
