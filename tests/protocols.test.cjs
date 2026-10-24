const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
function extract(name){const start=html.indexOf(`function ${name}(`);const end=html.indexOf('\n}',start)+2;return html.slice(start,end)}
const scope={TextEncoder,Uint8Array,S:{label:{w:40,h:60,dpi:203,paper:'gap',gap:2},prefs:{direction:1,density:8,speed:4,invert:false}}};
vm.createContext(scope);
vm.runInContext('const ENC=new TextEncoder();'+['cat','buildTSPL','buildESCPOS','buildZPLRaster','encL1'].map(extract).join('\n'),scope);
test('TSPL : largeur en octets, polarité et copies',()=>{
  const data=scope.buildTSPL({wb:1,h:2,bits:Uint8Array.from([128,1])},3);
  const str=Buffer.from(data).toString('latin1');
  assert.match(str,/SIZE 40 mm,60 mm\r\nGAP 2 mm,0 mm/);
  const start=str.indexOf('BITMAP 0,0,1,2,0,')+'BITMAP 0,0,1,2,0,'.length;
  assert.deepEqual([...data.slice(start,start+2)],[127,254]);
  assert.ok(str.endsWith('\r\nPRINT 3,1\r\n'));
});
test('ZPL raster : dimensions et longueur exactes',()=>{
  const str=Buffer.from(scope.buildZPLRaster({w:9,h:2,wb:2,bits:Uint8Array.from([128,0,1,0])},2)).toString();
  assert.match(str,/\^PW9\^LL2/);assert.match(str,/\^GFA,4,4,2,80000100\^FS\^PQ2/);
});
test('ESC/POS : en-tête little endian et polarité',()=>{
  const bytes=scope.buildESCPOS({wb:2,h:1,bits:Uint8Array.from([128,0])},1);
  assert.deepEqual([...bytes],[27,64,29,118,48,0,2,0,1,0,128,0,10,10]);
});
test('Windows-1252 conserve les accents français et le symbole euro',()=>{
  assert.deepEqual([...scope.encL1('Été € œ —')],[201,116,233,32,128,32,156,32,151]);
});
test('Syntaxe de tous les scripts embarqués',()=>{
  for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
});
