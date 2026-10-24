const {app, BrowserWindow, ipcMain, dialog, shell} = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const {windowsPrint} = require('./windows-print.cjs');
let mainWindow;
const index = path.join(__dirname, '..', 'www', 'index.html');
function trusted(event) { return event.sender === mainWindow?.webContents && event.senderFrame === mainWindow.webContents.mainFrame; }
function createWindow() {
  mainWindow = new BrowserWindow({width: 1440, height: 940, minWidth: 380, minHeight: 640, backgroundColor: '#f4f7f6',
    webPreferences: {preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true}});
  mainWindow.loadFile(index);
  mainWindow.webContents.setWindowOpenHandler(({url}) => {if (/^https:\/\//.test(url)) shell.openExternal(url); return {action: 'deny'};});
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
}
app.whenReady().then(() => {
  ipcMain.handle('printme:helper', (event, {route, options}) => {
    if(!trusted(event)||process.platform!=='win32')throw Error('Impression RAW disponible sur Windows uniquement');
    return windowsPrint(route,options);
  });
  ipcMain.handle('printme:driver', async event => {
    if(!trusted(event)||process.platform!=='win32')throw Error('Pilote disponible sur Windows uniquement');
    const location=path.join(process.resourcesPath, 'label-driver', 'InstallTool.exe');
    const {response}=await dialog.showMessageBox(mainWindow,{type:'question',buttons:['Annuler','Ouvrir l’installateur du pilote'],defaultId:0,cancelId:0,title:'Pilote LABEL fourni',message:'Ouvrir le pilote LABEL TSPL fourni avec votre imprimante ?',detail:'Cette installation est distincte de PRINT ME. Elle peut demander les droits administrateur de Windows.'});
    if(response!==1)return;
    const error=await shell.openPath(location);if(error)throw Error(error);
  });
  ipcMain.handle('printme:print', async (event, {html, width, height}) => {
    if (!trusted(event)) throw Error('Source non autorisée');
    if (typeof html !== 'string' || html.length > 64e6 || !Number.isFinite(width) || !Number.isFinite(height) || width < 5 || height < 5 || width > 300 || height > 500) throw Error('Format invalide');
    const win = new BrowserWindow({show: false, parent: mainWindow, webPreferences: {sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false}});
    try {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      await new Promise((resolve, reject) => win.webContents.print({silent: false, printBackground: true, margins: {marginType: 'none'}, pageSize: {width: Math.round(width * 1000), height: Math.round(height * 1000)}},
        (ok, reason) => ok ? resolve() : reject(Error(reason || 'Impression annulée'))));
    } finally {win.destroy();}
  });
  ipcMain.handle('printme:save', async (event, {name, bytes}) => {
    if (!trusted(event) || !(bytes instanceof Uint8Array) || bytes.length > 64e6) throw Error('Export invalide');
    const {filePath, canceled} = await dialog.showSaveDialog(mainWindow, {defaultPath: path.basename(name)});
    if (!canceled) await fs.writeFile(filePath, bytes);
  });
  createWindow();
  app.on('activate', () => {if (!BrowserWindow.getAllWindows().length) createWindow();});
});
app.on('window-all-closed', () => {if (process.platform !== 'darwin') app.quit();});
