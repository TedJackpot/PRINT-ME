# Diagnostic PRINT ME : aucune file supprimée, aucun pilote remplacé.
$ErrorActionPreference = 'Stop'
Write-Host 'PRINT ME — Diagnostic des imprimantes' -ForegroundColor Cyan
Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus | Format-Table -AutoSize
Write-Host ''
Write-Host '1. Vérifiez le modèle et le port USB de votre imprimante.'
Write-Host '2. Imprimez son auto-test pour connaître son langage (TSPL, ZPL…).'
Write-Host '3. Dans PRINT ME, choisissez explicitement la bonne file et le même langage.'
Write-Host '4. Testez une seule étiquette, puis vérifiez la file si rien ne sort.'
Write-Host ''
Write-Host 'Des commandes imprimées en clair peuvent signaler un langage incorrect.'
Write-Host 'Le nom du pilote seul ne permet pas de déterminer la cause.'
