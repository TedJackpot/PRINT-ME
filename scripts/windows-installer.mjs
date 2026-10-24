/* Fabrique un installateur NSIS sur Linux sans exécuter de code Windows. */
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),app=path.join(root,'release/win-unpacked');
const {version}=JSON.parse(await readFile('package.json','utf8'));
async function walk(dir){let files=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);files.push(...(e.isDirectory()?await walk(p):[p]))}return files}
const cache=path.join(os.homedir(),'.cache/electron-builder');
const makensis=process.env.PRINTME_MAKENSIS || (await walk(cache)).find(p=>p.endsWith('/linux/makensis'));
if(!makensis)throw Error('Compilateur NSIS introuvable. Lancez electron-builder --win une fois pour télécharger NSIS ou définissez PRINTME_MAKENSIS.');
const nsisRoot=path.dirname(path.dirname(makensis));
const files=await walk(app),directories=new Set();
const escape=s=>s.replace(/\$/g,'$$').replace(/"/g,'$\\"');
const deleteCommands=files.map(p=>{const relative=path.relative(app,p).replaceAll('/','\\');let d=path.dirname(path.relative(app,p));while(d!=='.'){directories.add(d);d=path.dirname(d)}return '  Delete "$INSTDIR\\'+escape(relative)+'"'}).join('\n');
const deleteDirs=[...directories].sort((a,b)=>b.length-a.length).map(d=>'  RMDir "$INSTDIR\\'+escape(d.replaceAll('/','\\'))+'"').join('\n');
const output=path.join(root,'release',`PRINT-ME-Setup-${version}-Windows-x64.exe`);
const script=`Unicode true
!include "MUI2.nsh"
Name "PRINT ME Studio"
OutFile "${escape(output)}"
InstallDir "$LOCALAPPDATA\\Programs\\PRINT ME"
InstallDirRegKey HKCU "Software\\PrintMeStudio" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID zlib
!define MUI_ICON "${escape(path.join(root,'assets/app.ico'))}"
!define MUI_UNICON "${escape(path.join(root,'assets/app.ico'))}"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\\PRINT ME.exe"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "French"
Section "PRINT ME"
  SetOutPath "$INSTDIR"
  File /r "${escape(app)}/*"
  WriteUninstaller "$INSTDIR\\Desinstaller.exe"
  CreateDirectory "$SMPROGRAMS\\PRINT ME"
  CreateShortcut "$SMPROGRAMS\\PRINT ME\\PRINT ME.lnk" "$INSTDIR\\PRINT ME.exe"
  CreateShortcut "$DESKTOP\\PRINT ME.lnk" "$INSTDIR\\PRINT ME.exe"
  WriteRegStr HKCU "Software\\PrintMeStudio" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PrintMeStudio" "DisplayName" "PRINT ME Studio"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PrintMeStudio" "DisplayVersion" "${version}"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PrintMeStudio" "UninstallString" '$\\"$INSTDIR\\Desinstaller.exe$\\"'
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PrintMeStudio" "NoModify" 1
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PrintMeStudio" "NoRepair" 1
SectionEnd
Section "Uninstall"
${deleteCommands}
${deleteDirs}
  Delete "$INSTDIR\\Desinstaller.exe"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\\PRINT ME.lnk"
  Delete "$SMPROGRAMS\\PRINT ME\\PRINT ME.lnk"
  RMDir "$SMPROGRAMS\\PRINT ME"
  DeleteRegKey HKCU "Software\\PrintMeStudio"
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PrintMeStudio"
SectionEnd
`;
await mkdir('release',{recursive:true});await writeFile('release/installer.nsi',script);
const result=spawnSync(makensis,['-V2','release/installer.nsi'],{stdio:'inherit',env:{...process.env,NSISDIR:nsisRoot}});
if(result.status!==0)throw Error('Échec NSIS : '+result.status);
console.log(output);
