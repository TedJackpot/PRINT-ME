# PRINT ME - helper d'impression directe (Windows, sans dependance)
# Demarrage : python printme_helper.py
# Expose : http://127.0.0.1:8765/printers  et  http://127.0.0.1:8765/print
import base64
import ctypes
import ctypes.wintypes as wt
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HOST = "127.0.0.1"
PORT = 8765

# Derniere liste connue : si l'enumeration Windows se bloque, on sert quand meme
# la derniere reponse validee au lieu de laisser le client attendre indefiniment.
_LAST_PRINTERS = []

winspool = ctypes.WinDLL("winspool.drv", use_last_error=True)


class PRINTER_INFO_1(ctypes.Structure):
    _fields_ = [
        ("Flags", wt.DWORD),
        ("pDescription", ctypes.c_wchar_p),
        ("pName", ctypes.c_wchar_p),
        ("pComment", ctypes.c_wchar_p),
    ]


class DOC_INFO_1(ctypes.Structure):
    _fields_ = [
        ("pDocName", ctypes.c_wchar_p),
        ("pOutputFile", ctypes.c_wchar_p),
        ("pDatatype", ctypes.c_wchar_p),
    ]


def _enum_printers():
    flags = 0x2 | 0x4  # PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS
    needed = wt.DWORD()
    count = wt.DWORD()
    winspool.EnumPrintersW(flags, None, 1, None, 0, ctypes.byref(needed), ctypes.byref(count))
    # ARRONDIR AU-DESSUS (division plafonnee) : une division entiere tronque
    # (1360/32 = 42 au lieu de 43) et EnumPrintersW ecrivait alors 16 octets
    # hors du tampon -> corruption de memoire -> processus qui meurt au hasard.
    item = ctypes.sizeof(PRINTER_INFO_1)
    slots = (needed.value + item - 1) // item
    buf = (PRINTER_INFO_1 * max(1, slots))()
    ok = winspool.EnumPrintersW(flags, None, 1, buf, needed.value, ctypes.byref(needed), ctypes.byref(count))
    if not ok:
        return []
    return [buf[i].pName for i in range(count.value)]


def list_printers(timeout=6.0):
    """Enumere les imprimantes, mais jamais plus de `timeout` secondes.

    EnumPrintersW peut se bloquer (pilote reseau injoignable, spooler qui
    redemarre). Sans ce garde-fou, le helper ne servait plus aucune requete.
    """
    import threading

    box = {}
    print("L1: enum lancee (fil dedie)", flush=True)

    def _run():
        try:
            box["ok"] = _enum_printers()
        except Exception as e:  # noqa: BLE001 - on veut surtout ne jamais bloquer
            box["err"] = str(e)

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    t.join(timeout)
    if "ok" in box:
        print("L2: enum ok (%d imprimantes)" % len(box["ok"]), flush=True)
        return box["ok"]
    print("L3: enum sans resultat (timeout ou erreur)", flush=True)
    if "err" in box:
        raise OSError(box["err"])
    raise OSError("Enumeration des imprimantes trop lente (pilote bloque ?)")


class PRINTER_INFO_2(ctypes.Structure):
    _fields_ = [
        ("pServerName", ctypes.c_wchar_p),
        ("pPrinterName", ctypes.c_wchar_p),
        ("pShareName", ctypes.c_wchar_p),
        ("pPortName", ctypes.c_wchar_p),
        ("pDriverName", ctypes.c_wchar_p),
        ("pComment", ctypes.c_wchar_p),
        ("pLocation", ctypes.c_wchar_p),
        ("pDevMode", ctypes.c_void_p),
        ("pSepFile", ctypes.c_wchar_p),
        ("pPrintProcessor", ctypes.c_wchar_p),
        ("pDatatype", ctypes.c_wchar_p),
        ("pParameters", ctypes.c_wchar_p),
        ("pSecurityDescriptor", ctypes.c_void_p),
        ("Attributes", wt.DWORD),
        ("Priority", wt.DWORD),
        ("DefaultPriority", wt.DWORD),
        ("StartTime", wt.DWORD),
        ("UntilTime", wt.DWORD),
        ("Status", wt.DWORD),
        ("cJobs", wt.DWORD),
        ("AveragePPM", wt.DWORD),
    ]


def _enum_printer_details():
    flags = 0x2 | 0x4  # PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS
    needed = wt.DWORD()
    count = wt.DWORD()
    winspool.EnumPrintersW(flags, None, 2, None, 0, ctypes.byref(needed), ctypes.byref(count))
    item = ctypes.sizeof(PRINTER_INFO_2)
    slots = (needed.value + item - 1) // item
    buf = (PRINTER_INFO_2 * max(1, slots))()
    ok = winspool.EnumPrintersW(flags, None, 2, buf, needed.value, ctypes.byref(needed), ctypes.byref(count))
    if not ok:
        return []
    return [
        {
            "name": buf[i].pPrinterName,
            "driver": buf[i].pDriverName or "",
            "port": buf[i].pPortName or "",
        }
        for i in range(count.value)
    ]


def driver_detruit_les_commandes(driver):
    """Vrai pour les pilotes qui transforment les octets en texte.

    "Generic / Text Only" ne transmet pas les codes de commande : il les
    remplace par des caracteres. Une etiquette TSPL envoyee a cette file
    sort en clair ("TEXT 32,128,\"De : Pass\""), ce qui donne l'impression
    qu'aucun langage ne fonctionne. C'est la cause la plus frequente.
    """
    d = (driver or "").lower()
    return ("text only" in d) or ("generic / text" in d)


def list_printer_details(timeout=8.0):
    """Comme list_printers(), mais avec le PILOTE de chaque file."""
    import threading

    box = {}

    def _run():
        try:
            box["ok"] = _enum_printer_details()
        except Exception as e:  # noqa: BLE001
            box["err"] = str(e)

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    t.join(timeout)

    details = box.get("ok") or []
    if details:
        for d in details:
            d["textOnly"] = driver_detruit_les_commandes(d.get("driver"))
        return details

    # Repli : noms seuls, sans pilote (l'application reste utilisable).
    return [{"name": n, "driver": "", "port": "", "textOnly": False} for n in list_printers()]


class JOB_INFO_1(ctypes.Structure):
    _fields_ = [
        ("JobId", wt.DWORD),
        ("pPrinterName", ctypes.c_wchar_p),
        ("pMachineName", ctypes.c_wchar_p),
        ("pUserName", ctypes.c_wchar_p),
        ("pDocument", ctypes.c_wchar_p),
        ("pDatatype", ctypes.c_wchar_p),
        ("pStatus", ctypes.c_wchar_p),
        ("Status", wt.DWORD),
        ("Priority", wt.DWORD),
        ("Position", wt.DWORD),
        ("TotalPages", wt.DWORD),
        ("PagesPrinted", wt.DWORD),
    ]


# Une file d'impression peut rester BLOQUEE par un travail arrete en cours de
# route (statut "Retained") : le port USB reste alors occupe et plus rien ne
# sort, sans aucune erreur visible. Ces deux fonctions permettent de le voir
# et de le debloquer depuis l'application.
winspool.OpenPrinterW.argtypes = [ctypes.c_wchar_p, ctypes.POINTER(wt.HANDLE), ctypes.c_void_p]
winspool.OpenPrinterW.restype = wt.BOOL
winspool.StartDocPrinterW.argtypes = [wt.HANDLE, wt.DWORD, ctypes.c_void_p]
winspool.StartDocPrinterW.restype = wt.DWORD
winspool.WritePrinter.argtypes = [wt.HANDLE, ctypes.c_void_p, wt.DWORD, ctypes.POINTER(wt.DWORD)]
winspool.WritePrinter.restype = wt.BOOL


winspool.EnumJobsW.argtypes = [wt.HANDLE, wt.DWORD, wt.DWORD, wt.DWORD,
                               ctypes.c_void_p, wt.DWORD,
                               ctypes.POINTER(wt.DWORD), ctypes.POINTER(wt.DWORD)]
winspool.EnumJobsW.restype = wt.BOOL
winspool.SetJobW.argtypes = [wt.HANDLE, wt.DWORD, wt.DWORD, ctypes.c_void_p, wt.DWORD]
winspool.SetJobW.restype = wt.BOOL
winspool.SetPrinterW.argtypes = [wt.HANDLE, wt.DWORD, ctypes.c_void_p, wt.DWORD]
winspool.SetPrinterW.restype = wt.BOOL
winspool.ClosePrinter.argtypes = [wt.HANDLE]
winspool.ClosePrinter.restype = wt.BOOL

# Commandes SetJob (winspool.h)
JOB_CONTROL_CANCEL = 3
JOB_CONTROL_RESTART = 4
JOB_CONTROL_DELETE = 5

# Bits de JOB_INFO_1.Status (winspool.h)
JOB_ETATS = [
    (0x00000001, "En pause"),
    (0x00000002, "ERREUR"),
    (0x00000004, "Suppression"),
    (0x00000008, "Mise en file"),
    (0x00000010, "Impression"),
    (0x00000020, "Hors ligne"),
    (0x00000040, "PAPER OUT"),
    (0x00000080, "Imprime"),
    (0x00000100, "Supprime"),
    (0x00000200, "FILE BLOQUEE"),
    (0x00000400, "INTERVENTION"),
    (0x00000800, "Redemarrage"),
    (0x00001000, "Termine"),
    (0x00002000, "RETENU"),
    (0x00004000, "Rendu local"),
]


def _etat_lisible(bits, p_status):
    mots = [libelle for bit, libelle in JOB_ETATS if bits & bit]
    if not mots and p_status:
        return p_status.strip()
    return ", ".join(mots) or "Normal"


def list_jobs(printer_name):
    """Travaux presents dans la file (id, etat, pages)."""
    hndl = wt.HANDLE()
    if not winspool.OpenPrinterW(printer_name, ctypes.byref(hndl), None):
        raise OSError("Impossible d'ouvrir l'imprimante (erreur %d)" % ctypes.get_last_error())
    try:
        needed = wt.DWORD()
        returned = wt.DWORD()
        winspool.EnumJobsW(hndl, 0, 0xFFFFFFFF, 1, None, 0,
                           ctypes.byref(needed), ctypes.byref(returned))
        item = ctypes.sizeof(JOB_INFO_1)
        slots = (needed.value + item - 1) // item      # arrondi au-dessus
        if slots <= 0:
            return []
        buf = (JOB_INFO_1 * slots)()
        ok = winspool.EnumJobsW(hndl, 0, 0xFFFFFFFF, 1, buf, needed.value,
                                ctypes.byref(needed), ctypes.byref(returned))
        if not ok:
            return []
        jobs = []
        for i in range(returned.value):
            j = buf[i]
            bits = int(j.Status)
            jobs.append({
                "id": int(j.JobId),
                "document": j.pDocument or "",
                "status": _etat_lisible(bits, j.pStatus),
                "bits": bits,
                # un travail Retenu / en Erreur occupe le port : plus rien ne sort
                "bloque": bool(bits & (0x00000002 | 0x00002000 | 0x00000200 | 0x00000400)),
                "pages": int(j.TotalPages),
                "imprimees": int(j.PagesPrinted),
                "position": int(j.Position),
            })
        return jobs
    finally:
        winspool.ClosePrinter(hndl)


def resume_printer(printer_name):
    """Remet l'imprimante en ligne si elle a ete mise en pause/hors ligne."""
    PRINTER_CONTROL_RESUME = 2
    hndl = wt.HANDLE()
    if not winspool.OpenPrinterW(printer_name, ctypes.byref(hndl), None):
        raise OSError("Impossible d'ouvrir l'imprimante (erreur %d)" % ctypes.get_last_error())
    try:
        return bool(winspool.SetPrinterW(hndl, 0, None, PRINTER_CONTROL_RESUME))
    finally:
        winspool.ClosePrinter(hndl)


def cancel_jobs(printer_name, restart=False):
    """Debloque une file : relance les travaux bloques, ou annule tout.

    On renvoie la liste des travaux traites et de ceux qui ont resiste.
    """
    hndl = wt.HANDLE()
    if not winspool.OpenPrinterW(printer_name, ctypes.byref(hndl), None):
        raise OSError("Impossible d'ouvrir l'imprimante (erreur %d)" % ctypes.get_last_error())
    traites, restants = [], []
    try:
        for job in list_jobs(printer_name):
            jid = job["id"]
            ordres = (JOB_CONTROL_RESTART,) if restart else (JOB_CONTROL_CANCEL, JOB_CONTROL_DELETE)
            fait = False
            for ordre in ordres:
                if winspool.SetJobW(hndl, jid, 0, None, ordre):
                    fait = True
                    break
            (traites if fait else restants).append(jid)
    finally:
        winspool.ClosePrinter(hndl)
    return traites, restants


def raw_print(printer_name, data):
    hndl = wt.HANDLE()
    ok = winspool.OpenPrinterW(printer_name, ctypes.byref(hndl), None)
    if not ok:
        raise OSError("Impossible d'ouvrir l'imprimante (erreur %d)" % ctypes.get_last_error())
    handle = hndl
    try:
        doc = DOC_INFO_1("PRINT ME - etiquette", None, "RAW")
        job_id = winspool.StartDocPrinterW(handle, 1, ctypes.byref(doc))
        if not job_id:
            raise OSError("StartDocPrinter a echoue (erreur %d)" % ctypes.get_last_error())
        try:
            winspool.StartPagePrinter(handle)
            written = wt.DWORD()
            if not winspool.WritePrinter(handle, data, len(data), ctypes.byref(written)):
                raise OSError("WritePrinter a echoue (erreur %d)" % ctypes.get_last_error())
            winspool.EndPagePrinter(handle)
        finally:
            winspool.EndDocPrinter(handle)
        return job_id
    finally:
        winspool.ClosePrinter(handle)


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        # Page servie en HTTPS (version en ligne) : Chrome demande cette
        # autorisation avant d'appeler une adresse locale (127.0.0.1).
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/printers":
            try:
                details = list_printer_details()
                names = [d["name"] for d in details]
                _LAST_PRINTERS.clear()
                _LAST_PRINTERS.extend(names)
                self._json({"printers": names, "details": details})
            except Exception as e:
                # On retombe sur la derniere liste connue plutot que d'echouer :
                # l'imprimante a deja ete utilisee avec succes.
                if _LAST_PRINTERS:
                    self._json({"printers": list(_LAST_PRINTERS),
                                "details": [{"name": n, "driver": "", "port": "",
                                             "textOnly": False} for n in _LAST_PRINTERS]})
                else:
                    self._json({"error": str(e)}, 500)
        elif url.path == "/jobs":
            nom = (parse_qs(url.query).get("printer") or [""])[0]
            if not nom:
                self._json({"error": "printer manquant"}, 400)
                return
            try:
                self._json({"printer": nom, "jobs": list_jobs(nom)})
            except Exception as e:
                self._json({"error": str(e)}, 500)
        else:
            self._json({"error": "inconnu"}, 404)

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        if self.path == "/printers":
            details = list_printer_details()
            self._json({"printers": [d["name"] for d in details], "details": details})
            return
        if self.path == "/print":
            try:
                payload = json.loads(raw.decode("utf-8"))
                name = payload.get("printer")
                data = base64.b64decode(payload.get("data", ""))
                if not name or not data:
                    self._json({"error": "printer ou data manquant"}, 400)
                    return
                job = raw_print(name, data)
                self._json({"ok": True, "job": job})
            except Exception as e:
                self._json({"error": str(e)}, 500)
            return
        if self.path == "/unblock":
            try:
                payload = json.loads(raw.decode("utf-8"))
                name = payload.get("printer")
                restart = payload.get("action") == "restart"
                if not name:
                    self._json({"error": "printer manquant"}, 400)
                    return
                traites, restants = cancel_jobs(name, restart=restart)
                remis_en_ligne = resume_printer(name) if not restart else False
                self._json({"ok": not restants, "action": "relance" if restart else "annule",
                            "traites": traites, "restants": restants,
                            "remis_en_ligne": remis_en_ligne,
                            "jobs": list_jobs(name)})
            except Exception as e:
                self._json({"error": str(e)}, 500)
            return
        self._json({"error": "inconnu"}, 404)

    def log_message(self, fmt, *args):
        sys.stdout.write((fmt % args) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("PRINT ME helper en ecoute sur http://%s:%d" % (HOST, PORT), flush=True)
    # Pas d'enumeration au demarrage : EnumPrintersW faillait tuer le processus
    # ici (meme appele dans un fil). On n'enumere plus qu'a la demande, dans
    # list_printers(), avec un delai maximum. Le serveur sert tout de suite.
    print("M1: serveur cree, mise a l'ecoute (enumeration lazy)", flush=True)
    server.serve_forever()
    print("M2: serve_forever rendu", flush=True)
