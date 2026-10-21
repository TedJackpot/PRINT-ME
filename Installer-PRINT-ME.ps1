# =====================================================================
#  PRINT ME - installation de la file d'impression
#  Clic droit > "Executer avec PowerShell" (ou terminal administrateur)
#
#  Il fait trois choses :
#    1. il supprime la file nommee "PRINT ME" si son pilote est
#       "Generic / Text Only" (ce pilote imprime les commandes TSPL en
#       clair : "TEXT 32,128,..." au lieu de l'etiquette) ;
#    2. il recree "PRINT ME" avec le pilote de l'imprimante (LABEL),
#       sur le meme port USB ;
#    3. il la met en imprimante par defaut.
#
#  Aucune installation de pilote : il reutilise celui deja present.
# =====================================================================
$ErrorActionPreference = 'Stop'

function Titre($t) { Write-Host ""; Write-Host "== $t" -ForegroundColor Cyan }

Titre "Files d'impression detectees"
$files = Get-Printer | Select-Object Name, DriverName, PortName
$files | Format-Table -AutoSize | Out-String -Width 200 | Write-Host

# --- 1. reperer la file a corriger -----------------------------------
$mauvaises = Get-Printer | Where-Object { $_.DriverName -match 'Generic\s*/\s*Text|Text Only' }
if (-not $mauvaises) {
    Write-Host "Aucune file << Generic / Text Only >> : rien a corriger." -ForegroundColor Green
} else {
    foreach ($f in $mauvaises) {
        Write-Host ("Suppression de la file << {0} >> (pilote {1})" -f $f.Name, $f.DriverName) -ForegroundColor Yellow
        try { Remove-Printer -Name $f.Name; Write-Host "   supprimee" -ForegroundColor Green }
        catch { Write-Host ("   echec : " + $_.Exception.Message) -ForegroundColor Red }
    }
}

# --- 2. retrouver le pilote de l'imprimante et son port -------------
$pilotes = Get-PrinterDriver | Where-Object { $_.Name -eq 'LABEL' }
if (-not $pilotes) {
    Write-Host ""
    Write-Host "Le pilote << LABEL >> n'est pas installe : installez d'abord le pilote" -ForegroundColor Red
    Write-Host "du constructeur, puis relancez ce script." -ForegroundColor Red
    exit 1
}

# port de l'appareil : celui qui a deja servi (USB001 le plus souvent)
$port = 'USB001'
$ancien = $files | Where-Object { $_.PortName -like 'USB*' } | Select-Object -First 1
if ($ancien) { $port = $ancien.PortName }
Write-Host ""
Write-Host "Pilote : LABEL   -   port : $port"

# --- 3. creer la file propre ----------------------------------------
$nom = 'PRINT ME'
if (Get-Printer -Name $nom -ErrorAction SilentlyContinue) {
    Write-Host "La file << $nom >> existe deja avec un bon pilote : rien a faire." -ForegroundColor Green
} else {
    Add-Printer -Name $nom -DriverName 'LABEL' -PortName $port
    Write-Host "File << $nom >> creee sur $port avec le pilote LABEL." -ForegroundColor Green
}

# --- 4. format d'etiquette 100 x 150 mm + imprimante par defaut -----
try {
    $formes = Get-PrinterProperty -PrinterName $nom | Where-Object { $_.PropertyName -match 'FormName' }
    if ($formes) { Write-Host ("Format actuel : " + ($formes | Select-Object -First 1).Value) }
} catch { }

try {
    (New-Object -ComObject WScript.Network).SetDefaultPrinter($nom)
    Write-Host "<< $nom >> est maintenant l'imprimante par defaut." -ForegroundColor Green
} catch { Write-Host "Impossible de definir l'imprimante par defaut." -ForegroundColor Yellow }

Titre "Termine"
Write-Host "Verifiez dans l'application : Imprimante > Envoi = Direct,"
Write-Host "puis << Imprimante > Tester ce langage >> pour une etiquette de controle."
Write-Host ""
Write-Host "Si l'etiquette sort encore en texte, notez le pilote affiche ci-dessus"
Write-Host "et transmettez-le : c'est que le pilote doit etre remplace par celui"
Write-Host "du constructeur (TOUSEI TS-M420)."
