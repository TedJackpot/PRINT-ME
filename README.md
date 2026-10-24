# PRINT ME Studio

Éditeur d’étiquettes en français pour ordinateur, Android et iOS. La base existante est conservée : modèles, champs variables, CSV, QR codes, codes-barres, images et sauvegardes locales.

## Mise à jour Android 2.1.1 — Bluetooth classique

La version Android ajoute **Bluetooth Android (appareils appairés)**. Le pont natif utilise RFCOMM/SPP sur les appareils préalablement appairés dans les réglages Android. Il demande `BLUETOOTH_CONNECT` sur Android 12 ou plus récent ; il ne lance pas de découverte Bluetooth et ne demande pas la localisation. Les appareils identifiés comme BLE uniquement sont affichés mais ne peuvent pas être sélectionnés pour ce transport.

Dans Imprimante : choisir le mode Bluetooth Android, actualiser la liste, sélectionner explicitement l’imprimante, puis Connecter. Le nom `bluetoothprinter` ne prouve pas que le service SPP est pris en charge. Les délais de connexion et d’envoi sont limités et les opérations bloquantes sont exécutées hors du fil d’interface. Le format des commandes TSPL/ZPL/ESC-POS reste un réglage distinct du transport.

L’APK 2.1.1 doit être signé avec la **même clé** que la version 2.1.0 et utilise le code de version 20101. La clé n’est pas publiée dans GitHub. Les tests navigateur simulent les appareils et les erreurs ; ils ne remplacent pas un essai sur l’imprimante physique.

Sources : [permissions Android](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions), [appareils appairés](https://developer.android.com/develop/connectivity/bluetooth/find-bluetooth-devices), [connexion RFCOMM](https://developer.android.com/develop/connectivity/bluetooth/connect-bluetooth-devices).

## Livraison 2.1.0

Les fichiers Windows `.exe` et Android `.apk` ont été **fabriqués localement**. L’APK de distribution est signé avec une clé propre à PRINT ME et sa signature a été vérifiée. L’installeur Windows est un NSIS pour installation utilisateur, contrôlé par décompression ; il ne possède pas de signature commerciale d’éditeur. Les essais sur l’imprimante physique et sur les appareils de l’utilisateur restent nécessaires. Les ponts Windows et Android ont été exercés par les tests navigateur avec des transports simulés.

Le pilote transmis par l’utilisateur contient un INF « TSPL driver », le modèle `LABEL` et une résolution 203 dpi dans le GPD. Son outil d’installation est inclus **dans la livraison Windows**, avec un bouton explicite dans le dialogue Imprimante. Il n’est jamais exécuté automatiquement. La compatibilité physique TS-M420 reste à confirmer : ce modèle n’est pas nommé dans l’INF.

La livraison initiale a été fabriquée localement. Les sources sont proposées sur la branche `feat/print-me-studio-2-1`. Le projet iOS est synchronisé, mais **aucun IPA n’a été fabriqué** : il nécessite Xcode et une configuration de signature Apple. Le produit s’inspire des fonctions courantes d’un éditeur comme Labelnize ; il ne contient pas son code.

## Installer et développer

Node.js 22 ou ultérieur et npm sont nécessaires pour fabriquer les applications.

```sh
npm ci
npm test
npm run build
npm start
```

- `npm start` ouvre une fenêtre Electron indépendante.
- `npm run windows:installer` génère un installeur NSIS depuis Linux une fois le compilateur NSIS disponible dans le cache electron-builder. Le script n’exécute pas de code Windows.
- `npm run desktop:dist` crée l’installeur de la plateforme courante. La version Windows utilise directement PowerShell et le spooler, sans Python.
- `npm run android:init` crée le projet Android et installe le pont USB natif. Puis `npm run android:open` pour Android Studio (SDK et Java 21 nécessaires).
- `npm run ios:init` crée le projet iOS. Puis `npm run ios:open` sur un Mac avec Xcode. Une signature Apple est nécessaire pour installer sur un iPhone physique et distribuer via TestFlight/App Store.
- Après une modification web : `npm run mobile:sync`. Le code USB Android est recopié avec `node scripts/android-setup.mjs` si vous le modifiez.

Les dossiers `android/`, `ios/` et `www/` se régénèrent et ne sont pas versionnés. `package-lock.json` fixe les dépendances réellement installées.

### Sans outils de développement

L’éditeur fonctionne aussi avec les lanceurs Python existants ou comme application web installable depuis une origine HTTPS. Le bouton Installer apparaît dans les navigateurs qui proposent l’installation. Sur iPhone : Safari → Partager → Sur l’écran d’accueil. Le cache hors ligne conserve les ressources de base ; Inter, Montserrat et Roboto sont embarquées ; les autres polices indiquées « Internet » nécessitent une connexion.

Les données et modèles sont stockés localement **par application et par origine**. Exportez vos modèles JSON avant de changer d’application ou d’adresse : les données du navigateur ne sont pas transférées automatiquement vers Electron ou Capacitor.

## Impression et compatibilité

| Plateforme | Mode | Conditions |
|---|---|---|
| Windows, macOS, Linux | Impression système | Pilote installé ; choisir le papier, l’échelle 100 % et les marges nulles |
| Windows | Commandes RAW via assistant | File correcte et langage réellement compris par l’appareil |
| Android natif | Bluetooth classique SPP | Appareil appairé, autorisation Appareils à proximité sur Android 12+, service SPP compatible ; essais matériel requis |
| Android natif | USB OTG direct | Téléphone USB hôte, câble OTG, autorisation USB, sortie bulk et langage compatible ; essais matériel requis |
| Android natif | Impression système | Service d’impression compatible installé ; ne garantit pas la TS-M420 |
| iOS natif | Impression système | Imprimante compatible avec l’impression iOS/AirPrint ; TS-M420 non confirmée |
| Chrome/Edge compatibles | WebUSB, série ou BLE | API disponible et protocole matériel compatible ; BLE n’est pas Bluetooth classique |

Le README historique identifiait une **TOUSEI TS-M420, USB 0416:5011, auto-test TSPL**. Cette information vient du projet, pas d’une nouvelle détection matérielle. Vérifiez l’auto-test de votre appareil. Aucun profil de future imprimante n’est déclaré compatible sans connaître son langage et sa connexion.

Pour la TS-M420, commencer avec **TSPL — aperçu fidèle (image)**, 203 dpi seulement si l’auto-test confirme cette résolution, et une seule copie. Ce rendu préserve accents, polices, alignements, rotations et logos. Il faut choisir le bon format d’étiquette et le bon capteur. Le mode natif simplifié utilise désormais `BAR`, `BOX` et une syntaxe QR corrigée, mais garde les limites des polices embarquées ; l’interface prévient avant l’envoi. ZPL utilise un rendu raster `^GFA`. ESC/POS est destiné aux appareils qui annoncent explicitement ce langage.

**Des commandes imprimées en clair ne prouvent pas que le pilote est fautif.** Un langage incompatible ou un mauvais chemin d’envoi sont également possibles. Windows peut transmettre des données RAW sans conversion ; le nom « Generic / Text Only » n’entraîne donc plus un blocage arbitraire. Le script PowerShell ne supprime aucune file et ne change plus l’imprimante par défaut.

Les profils enregistrent connexion, langage, format et réglages. Ils ne détectent pas automatiquement le protocole d’une imprimante. Ne relancez pas un envoi partiellement interrompu sans vérifier la file et le papier pour éviter les doublons.

### Impression Windows

L’application Electron communique avec PowerShell par un pont IPC isolé, sans ouvrir de port HTTP. Les paramètres sont transmis en JSON sur l’entrée standard, jamais interpolés dans du code PowerShell. `desktop/windows-print.ps1` liste les imprimantes et transmet les octets au spooler avec `StartDocPrinter`/`WritePrinter` en RAW. Les écritures partielles et les erreurs d’envoi sont prises en charge. Le script est livré hors de l’archive ASAR pour être lu par PowerShell.

L’ancien assistant Python reste utilisable pour la version navigateur :

```sh
python helper/printme_helper.py
```

Il écoute uniquement sur `127.0.0.1:8765`, contrôle les origines HTTP et valide les requêtes. Il n’est pas nécessaire à la version Electron. Le pilote local se place dans `local-driver/` lors d’une fabrication qui l’inclut. La copie fournie par l’utilisateur figure dans sa sauvegarde privée ; elle n’est pas publiée dans ce dépôt. Les builds GitHub n’incluent donc pas ce pilote et une installation du pilote via Windows reste possible séparément. Le pilote reste un composant tiers distinct.

## Vérification et fabrication GitHub

```sh
npm test
npx playwright install chromium
npm run test:ui
python -m unittest discover -s tests -p 'test_*.py'
npm run build
```

Le workflow **Applications PRINT ME** prépare Windows `.exe`, macOS `.dmg`, Linux `.AppImage`, un **APK Android de test** et une application **iOS pour simulateur**. L’APK debug n’est pas une livraison Play Store. Les versions de distribution nécessitent une signature stable ; macOS nécessite signature/notarisation pour une distribution sans alerte. Le workflow ne publie pas automatiquement de release ni de version en boutique.

## Structure

- `index.html` : éditeur existant et logique d’impression.
- `assets/studio.css` : interface responsive PRINT ME Studio.
- `desktop/` : fenêtre Electron isolée et impression système.
- `scripts/` : construction web, ponts natifs et préparation Android.
- `native/android/` : transport USB OTG Android.
- `helper/` : assistant RAW Windows.
- `tests/` : tests de protocoles et du spooler simulé.
- `.github/workflows/build.yml` : vérifications et fabrication multiplateforme.

## Sources techniques

- [Microsoft : données RAW](https://learn.microsoft.com/en-us/windows-hardware/drivers/print/raw-data-type)
- [Electron : impression](https://www.electronjs.org/docs/latest/api/web-contents#contentsprintoptions-callback)
- [Capacitor : code Android natif](https://capacitorjs.com/docs/android/custom-code)
- [Capgo Printer : pont d’impression système Android/iOS](https://github.com/Cap-go/capacitor-printer)

## Licence

Code applicatif : usage interne Pass-Service, aucune licence open source accordée. Les bibliothèques tierces conservent leurs licences ; Electron inclut ses notices tierces, Capgo Printer est sous MPL-2.0. Conserver les mentions de licence dans toute redistribution.

## Signature Android et mises à jour

La clé de signature de cette livraison et ses paramètres sont conservés dans la sauvegarde de maintenance remise à l’utilisateur, séparément des sources publiques. Elle est nécessaire pour signer des mises à jour installables par-dessus cette version. Ne pas publier cette sauvegarde de signature dans un dépôt public. Le fichier APK n’est pas une publication Play Store.
