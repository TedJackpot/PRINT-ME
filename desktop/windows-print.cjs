const {spawn} = require('node:child_process');
const path = require('node:path');
function requestFor(route, options = {}) {
  const url = new URL(route, 'http://localhost');
  const action = url.pathname.slice(1);
  if (!['printers', 'print', 'jobs', 'unblock'].includes(action)) throw Error('Commande d’impression inconnue');
  const request = options.body ? JSON.parse(options.body) : {};
  if (action === 'jobs') request.printer = url.searchParams.get('printer');
  if (action !== 'printers' && (typeof request.printer !== 'string' || !request.printer || request.printer.length > 512)) throw Error('Nom d’imprimante invalide');
  if (action === 'print' && (typeof request.data !== 'string' || request.data.length > 16 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(request.data))) throw Error('Données d’impression invalides');
  return {action, request};
}
function windowsPrint(route, options, executable = 'powershell.exe') {
  const {action, request} = requestFor(route, options);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'windows-print.ps1'), '-Action', action], {windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']});
    let output='', error='';
    const timer=setTimeout(()=>{child.kill();reject(Error('L’imprimante met trop de temps à répondre. Vérifiez la file Windows avant de renvoyer le document.'));},30000);
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk=>{output+=chunk;if(output.length>2e6)child.kill()});
    child.stderr.on('data', chunk=>{error+=chunk});
    child.on('error',err=>{clearTimeout(timer);reject(err)});
    child.stdin.on('error',()=>{});
    child.on('close',code=>{clearTimeout(timer);try{const result=JSON.parse(output.replace(/^\uFEFF/,''));if(result.error)throw Error(result.error);if(code!==0)throw Error(error||'Envoi Windows interrompu');resolve(result)}catch(err){reject(Error(err.message||error||'Réponse Windows invalide'))}});
    child.stdin.end(JSON.stringify(request));
  });
}
module.exports={windowsPrint,requestFor};
