#!/bin/bash
# PRINT ME — lanceur macOS (double-clic dans le Finder)
cd "$(dirname "$0")" || exit 1

echo
echo "  PRINT ME — application d'etiquettes"
echo "  ------------------------------------------"

if command -v python3 >/dev/null 2>&1; then
  python3 labelprint_server.py
else
  echo "  Python 3 introuvable : ouverture directe dans le navigateur."
  echo "  (Le mode « Navigateur (fenetre d'impression) » reste disponible.)"
  open "index.html"
  echo
  read -n 1 -s -r -p "  Appuyez sur une touche pour fermer..."
fi
