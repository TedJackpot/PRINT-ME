# PRINT ME

Application d'impression d'étiquettes pour le Pass-Service : formulaire, aperçu fidèle, modèles prêts à l'emploi, import de lots (Vinted, Colissimo, bons de commande) et envoi direct vers une imprimante thermique.

L'application tient dans **un seul fichier `index.html`** : elle fonctionne hors ligne, sans compte, sans serveur obligatoire. Seule l'impression directe vers Windows utilise un petit helper Python local.

## Démarrage rapide

| Système | Commande |
|---|---|
| Windows | double-clic sur `Demarrer-Windows.bat` |
| macOS | double-clic sur `Demarrer-Mac.command` (clic droit → Ouvrir si macOS bloque) |
| Linux | `chmod +x Demarrer-Linux.sh && ./Demarrer-Linux.sh` |
| Sans Python | ouvrir `index.html` dans Chrome, Edge ou Firefox |

Le lanceur démarre un petit serveur local et ouvre le navigateur sur l'application. Sans Python, tout fonctionne sauf le mode d'impression **Direct (imprimante Windows)**.

## Impression

Trois modes disponibles dans **Imprimante** :

- **Direct (imprimante Windows)** — l'application envoie les octets bruts au spooler via `helper/printme_helper.py` (port `8765`). C'est le mode le plus fiable, et le seul qui donne accès au choix de la file d'impression.
- **Navigateur (fenêtre d'impression)** — passer par la boîte de dialogue système.
- **USB direct / Bluetooth (BLE)** — pour Android avec un câble OTG ou une imprimante BLE.

Le panneau **Imprimante** permet aussi de choisir la file d'impression, de lister les travaux en cours et de **débloquer la file** : un travail resté en « En pause / Retenu » bloque le port USB et empêche toute impression suivante. C'est la cause la plus fréquente du « rien ne sort ».

### Helper d'impression

```bash
python helper/printme_helper.py          # écoute sur http://127.0.0.1:8765
```

| Route | Rôle |
|---|---|
| `GET /printers` | liste des files d'impression Windows |
| `POST /print` | envoi brut des octets à la file choisie |
| `GET /jobs?printer=...` | travaux de la file, avec état décodé (erreur, pause, retenu) |
| `POST /unblock` | annule les travaux bloqués et remet la file en ligne |

Aucune dépendance externe : uniquement la bibliothèque standard Python (`ctypes`, `http.server`).

## Fonctionnalités

- Aperçu fidèle au millimètre, formats 100 × 150, 102 × 152, 89 × 36, 54 × 101, 25 × 54, 54 × 70 (DYMO), etc.
- Modèles fournis : Pass-Service / Colissimo, DYMO Expédition, DYMO Adresse, colis générique, bon de commande Vinted 40 × 60 et 60 × 80, courrier, étiquette produit, prix étagère.
- Champs dynamiques (`{{destinataire}}`, `{{suivi}}`, `{{commande}}`, `{{date}}`, `{{n}}`, `{{nb}}`…) et onglet **Données** pour les remplir d'un geste.
- Import de lots : collage d'un tableau Excel / CSV, une étiquette par ligne.
- Code-barres Code 128 et QR natifs (générateur embarqué, hors ligne).
- Annuler / rétablir, enregistrement des modèles, export et import de modèles en `.json`.
- Application installable (PWA) avec cache hors ligne.

## Contenu

```
index.html              l'application complète
Demarrer-Windows.bat    lanceur Windows
Demarrer-Mac.command    lanceur macOS
Demarrer-Linux.sh       lanceur Linux
labelprint_server.py    serveur local multiplateforme
Installer-PRINT-ME.ps1  remet la file d'impression d'aplomb
helper/printme_helper.py  envoi brut + gestion de la file Windows
vendor/qrcode.min.js    générateur de QR code (hors ligne)
vendor/icone.svg        icône de l'application
manifest.webmanifest    application installable
sw.js                   cache hors ligne
modeles/                partage de modèles
LISEZMOI.txt            mode d'emploi détaillé
```

## Dépannage : « l'étiquette sort avec du texte »

Si le papier sort avec les commandes en clair (`TEXT 32,128,...`, `SIZE 100 mm,150 mm`, `PRINT 1,1`), ce n'est pas l'imprimante qui est en cause mais le **pilote de la file d'impression**. Le pilote `Generic / Text Only` remplace les codes de commande par des caractères au lieu de les transmettre.

L'application affiche désormais le pilote de chaque file et marque les files fautives :

```
PRINT ME  (Generic / Text Only)  ⛔ texte
LABELPASS  (LABEL)
```

Une file marquée ⛔ est **refusée à l'impression** et n'est plus jamais choisie automatiquement. Pour la remplacer par une file saine, exécutez `Installer-PRINT-ME.ps1` (clic droit → Exécuter avec PowerShell) : il supprime la file fautive et la recrée avec le pilote de l'imprimante.

## Limites connues

- **Le langage de l'imprimante n'est pas deviné automatiquement.** L'appareil concerné est une TOUSEI TS-M420 (`USB 0416:5011`), dont l'auto-test annonce TSPL. Tant que la file d'impression n'utilise pas un pilote qui transmet les octets, aucun langage ne peut fonctionner.
- L'impression directe suppose que l'imprimante est **présente** dans Windows : une imprimante débranchée laisse la file hors ligne et bloque les envois.
- Le mode Bluetooth dépend du navigateur et de l'imprimante ; il n'est pas universel.

## Licence

Usage interne Pass-Service. Aucune licence open source n'est accordée pour l'instant.
