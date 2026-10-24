const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('printmeDesktop', {
  platform: process.platform,
  installDriver: () => ipcRenderer.invoke('printme:driver'),
  helper: (route, options) => ipcRenderer.invoke('printme:helper', {route, options}),
  print: (html, width, height) => ipcRenderer.invoke('printme:print', {html, width, height}),
  save: (name, bytes) => ipcRenderer.invoke('printme:save', {name, bytes})
});
