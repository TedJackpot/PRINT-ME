param([ValidateSet('printers','print','jobs','unblock')][string]$Action)
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
try {
  if ($Action -eq 'printers') {
    $details = @(Get-Printer | ForEach-Object { @{name=$_.Name;driver=$_.DriverName;port=$_.PortName;textOnly=$false} })
    @{printers=@($details | ForEach-Object {$_.name}); details=$details} | ConvertTo-Json -Depth 5 -Compress
    exit 0
  }
  if (-not $request.printer -or -not (Get-Printer -Name $request.printer -ErrorAction SilentlyContinue | Where-Object {$_.Name -ceq $request.printer})) { throw 'Choisissez une imprimante installée dans Windows.' }
  if ($Action -eq 'jobs') {
    $jobs = @(Get-PrintJob -PrinterName $request.printer | ForEach-Object { @{id=$_.ID;document=$_.DocumentName;status=[string]$_.JobStatus;bloque=([string]$_.JobStatus -match 'Error|Offline|PaperOut|Blocked|UserIntervention|Paused'); pages=$_.TotalPages} })
    @{jobs=$jobs} | ConvertTo-Json -Depth 5 -Compress
    exit 0
  }
  if ($Action -eq 'unblock') {
    $ids = @(Get-PrintJob -PrinterName $request.printer | ForEach-Object {Remove-PrintJob -PrinterName $request.printer -ID $_.ID; $_.ID})
    @{ok=$true;traites=$ids;jobs=@(Get-PrintJob -PrinterName $request.printer);remis_en_ligne=$false} | ConvertTo-Json -Depth 5 -Compress
    exit 0
  }
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PrintMeRaw {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct Doc { [MarshalAs(UnmanagedType.LPWStr)] public string name; [MarshalAs(UnmanagedType.LPWStr)] public string output; [MarshalAs(UnmanagedType.LPWStr)] public string datatype; }
 [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool OpenPrinter(string name,out IntPtr handle,IntPtr defaults);
 [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)] static extern uint StartDocPrinter(IntPtr h,uint level,ref Doc doc);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool StartPagePrinter(IntPtr h);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool WritePrinter(IntPtr h,IntPtr bytes,int count,out int written);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool EndPagePrinter(IntPtr h);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool EndDocPrinter(IntPtr h);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool AbortPrinter(IntPtr h);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool ClosePrinter(IntPtr h);
 static void Check(bool ok) {if(!ok)throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());}
 public static uint Send(string name,byte[] bytes) {
   IntPtr handle; Check(OpenPrinter(name,out handle,IntPtr.Zero));
   try {
     Doc doc=new Doc{name="PRINT ME — Étiquette",datatype="RAW"};
     uint id=StartDocPrinter(handle,1,ref doc); Check(id!=0);
     try {
       Check(StartPagePrinter(handle));
       var pin=GCHandle.Alloc(bytes,GCHandleType.Pinned);
       try {int offset=0;while(offset<bytes.Length){int written;Check(WritePrinter(handle,IntPtr.Add(pin.AddrOfPinnedObject(),offset),Math.Min(65536,bytes.Length-offset),out written));if(written<=0)throw new Exception("Envoi interrompu");offset+=written;}}
       finally {pin.Free();}
       Check(EndPagePrinter(handle));Check(EndDocPrinter(handle));return id;
     } catch {AbortPrinter(handle);throw;}
   } finally {ClosePrinter(handle);}
 }
}
'@
  $bytes=[Convert]::FromBase64String($request.data)
  if($bytes.Length -eq 0 -or $bytes.Length -gt 12582912){throw 'Taille du document invalide.'}
  $job=[PrintMeRaw]::Send($request.printer,$bytes)
  @{ok=$true;job=$job} | ConvertTo-Json -Compress
} catch {
  @{error=$_.Exception.Message} | ConvertTo-Json -Compress
  exit 1
}
