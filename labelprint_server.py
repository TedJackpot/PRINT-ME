#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PRINT ME — lanceur de l'application d'etiquettes.

Un seul fichier d'execution pour Windows, macOS, Linux et (via navigateur) Android.

  python labelprint_server.py

Ce que fait le lanceur :
  1. demarre le helper d'impression directe (Windows uniquement) sur le port 8765 ;
  2. sert l'application sur http://127.0.0.1:<port> (port libre choisi automatiquement) ;
  3. ouvre le navigateur par defaut sur l'application.

Aucune dependance : uniquement la bibliotheque standard de Python 3.8+.
Arreter : Ctrl+C dans cette fenetre.
"""
from __future__ import annotations

import http.server
import os
import platform
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from functools import partial

RACINE = os.path.dirname(os.path.abspath(__file__))
PORT_APP_PREFERE = 8080
PORT_HELPER = 8765
VERSION = "1.0"


def port_occupe(port: int) -> bool:
    """Vrai si quelque chose repond deja sur ce port deja utilise.

    Indispensable sous Windows : SO_REUSEADDR y autorise un second programme
    a s'emparer d'un port deja pris par un autre serveur. On teste donc la
    connexion avant de se declarer libre.
    """
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", port)) == 0


def port_libre(prefere: int) -> int:
    """Premier port libre a partir de `prefere`."""
    for p in range(prefere, prefere + 40):
        if port_occupe(p):
            continue
        try:
            with socket.socket() as s:
                s.bind(("127.0.0.1", p))
            return p
        except OSError:
            continue
    with socket.socket() as s:          # tout est pris : le systeme choisit
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def helper_en_ligne(timeout: float = 0.4) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", PORT_HELPER), timeout):
            return True
    except OSError:
        return False


def demarrer_helper():
    """Demarre helper/printme_helper.py (Windows). Renvoie le process ou None."""
    if platform.system() != "Windows":
        return None
    if helper_en_ligne():
        print("  Helper d'impression : deja actif sur http://127.0.0.1:%d" % PORT_HELPER)
        return None
    chemin = os.path.join(RACINE, "helper", "printme_helper.py")
    if not os.path.exists(chemin):
        print("  Helper d'impression : introuvable (%s)" % chemin)
        return None
    journal = open(os.path.join(RACINE, "helper.log"), "ab", buffering=0)
    creationflags = 0
    for nom in ("CREATE_NO_WINDOW", "CREATE_NEW_PROCESS_GROUP"):
        creationflags |= getattr(subprocess, nom, 0)
    proc = subprocess.Popen(
        [sys.executable, chemin],
        cwd=os.path.dirname(chemin),
        stdout=journal,
        stderr=journal,
        creationflags=creationflags,
    )
    for _ in range(30):                  # jusqu'a ~6 s
        if helper_en_ligne():
            print("  Helper d'impression : actif sur http://127.0.0.1:%d" % PORT_HELPER)
            return proc
        if proc.poll() is not None:
            print("  Helper d'impression : arret immediat (voir helper.log)")
            return None
        time.sleep(0.2)
    print("  Helper d'impression : demarrage lent (l'application reste utilisable)")
    return proc


class Handler(http.server.SimpleHTTPRequestHandler):
    """Sert les fichiers du dossier et interdit la mise en cache (mises a jour immediates)."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, *args):        # console silencieuse
        pass


def main() -> int:
    port = port_libre(PORT_APP_PREFERE)
    url = "http://127.0.0.1:%d/index.html" % port

    print()
    print("  PRINT ME %s - application d'etiquettes" % VERSION)
    print("  ------------------------------------------")
    print("  Systeme            : %s" % platform.system())
    print("  Application        : %s" % url)
    if platform.system() != "Windows":
        print("  Impression directe : disponible sur Windows (mode Navigateur ici)")
    helper = demarrer_helper()
    print("  ------------------------------------------")
    print("  Laissez cette fenetre ouverte. Ctrl+C pour arreter.")
    print()

    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=RACINE))
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Arret demande...")
    finally:
        httpd.server_close()
        if helper and helper.poll() is None:
            helper.terminate()
    print("  Application arretee.")
    return 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(line_buffering=True)   # messages visibles meme redirige
    except Exception:
        pass
    try:
        raise SystemExit(main())
    except OSError as e:
        print("  Erreur reseau : %s" % e)
        raise SystemExit(1)
