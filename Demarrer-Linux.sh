#!/bin/bash
# PRINT ME — lanceur Linux  (chmod +x Demarrer-Linux.sh, puis ./Demarrer-Linux.sh)
cd "$(dirname "$0")" || exit 1

echo
echo "  PRINT ME — application d'etiquettes"
echo "  ------------------------------------------"

if command -v python3 >/dev/null 2>&1; then
  python3 labelprint_server.py
else
  echo "  Python 3 introuvable : ouverture directe dans le navigateur."
  echo "  (Le mode « Navigateur (fenetre d'impression) » reste disponible.)"
  (xdg-open "index.html" || sensible-browser "index.html" || echo "  Ouvrez index.html manuellement.")
  echo
  read -n 1 -s -r -p "  Appuyez sur une touche pour fermer..."
fi
