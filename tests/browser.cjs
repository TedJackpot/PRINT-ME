// npm run test:ui — Chromium doit être installé : npx playwright install chromium
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
(async()=>{
 const server=spawn('python',['-m','http.server','8088','--bind','127.0.0.1'],{stdio:'ignore'});
 let browser;
 try{
  await new Promise(resolve=>setTimeout(resolve,600));
  browser=await chromium.launch({headless:true,...(process.env.PRINTME_TEST_CHROMIUM?{executablePath:process.env.PRINTME_TEST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}: {})});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await page.route('https://fonts.gstatic.com/**',route=>route.abort());
  await page.goto('http://127.0.0.1:8088/');
  await page.locator('#homeClose').click();
  await page.locator('#btnPrinter').click();await page.locator('#lang').selectOption('zpl');
  await page.locator('#dlgClose').click();await page.reload();
  assert.equal(await page.locator('#lang').inputValue(),'zpl');
  const result=await page.evaluate(async()=>{const bytes=await jobBytes(0);return {length:bytes.length,start:new TextDecoder().decode(bytes.slice(0,4)),elements:S.els.length}});
  assert.ok(result.elements>0);assert.ok(result.length>100);assert.equal(result.start,'^XA^');
  await page.locator('#btnPrinter').click();await page.locator('#profileSave').click();
  await page.locator('#profileName').fill('TS-M420 USB');await page.locator('#nameDialog button[value=save]').click();
  await page.waitForFunction(()=>document.querySelector('#profile').value==='TS-M420 USB');
  await page.locator('#dlgClose').click();await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#tabs button[data-tab=add]').click();
  await page.waitForFunction(()=>document.body.dataset.tab==='add');
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  await page.context().setOffline(true);await page.reload();await page.waitForSelector('#cv');
  await page.locator('#btnHome').click();await page.waitForSelector('.template-card');
  assert.ok(await page.locator('.template-card').count()>5);
  await page.locator('#homeClose').click();
  await page.locator('#btnPrinter').click();await page.locator('#tsm420Preset').click();assert.equal(await page.locator('#lang').inputValue(),'tsplimg');await page.locator('#dlgClose').click();
  assert.deepEqual(errors,[]);
  console.log('Interface ordinateur/mobile, profils, préférences et démarrage hors ligne : OK');
  const phone=await browser.newPage({viewport:{width:390,height:844}});
  await phone.addInitScript(()=>{window.printmeNative={platform:'android',usb:{list:async()=>({devices:[{id:'test-usb',name:'TS-M420 simulée'}]}),connect:async()=>({name:'TS-M420 simulée'}),disconnect:async()=>{},write:async({data})=>{window.sentUsb=atob(data)}},print:async()=>{},save:async()=>{}}});
  await phone.goto('http://127.0.0.1:8088/');await phone.locator('#homeClose').click();await phone.locator('#btnPrinter').click();
  await phone.locator('#mode').selectOption('androidusb');await phone.locator('#btnConnect').click();
  await phone.waitForFunction(()=>document.querySelector('#connText').textContent.includes('TS-M420 simulée'));
  await phone.locator('#dlgClose').click();await phone.locator('#btnPrint').click();
  await phone.waitForFunction(()=>window.sentUsb?.includes('BITMAP '));
  assert.ok(await phone.evaluate(()=>sentUsb.startsWith('SIZE 40 mm,60 mm')));
  const desktop=await browser.newPage({viewport:{width:1440,height:1000}});
  await desktop.addInitScript(()=>{window.printmeDesktop={platform:'win32',installDriver:async()=>{},print:async()=>{},save:async()=>{},helper:async(route,options)=>{if(route==='/printers')return {printers:['LABEL'],details:[{name:'LABEL',driver:'LABEL',port:'USB001'}]};if(route.startsWith('/jobs'))return {jobs:[]};if(route==='/print'){window.sentWindows=atob(JSON.parse(options.body).data);return {ok:true,job:1}}}}});
  await desktop.goto('http://127.0.0.1:8088/');await desktop.locator('#homeClose').click();await desktop.locator('#btnPrinter').click();await desktop.locator('#mode').selectOption('local');await desktop.locator('#btnConnect').click();
  await desktop.waitForFunction(()=>document.querySelector('#connText').textContent.includes('LABEL'));await desktop.locator('#dlgClose').click();await desktop.locator('#btnPrint').click();await desktop.waitForFunction(()=>window.sentWindows?.includes('BITMAP '));
  assert.ok(await desktop.evaluate(()=>sentWindows.endsWith('PRINT 1,1\r\n')));
  console.log('USB Android et file Windows simulés : données TSPL transmises au pont attendu.');
  const bluetooth=await browser.newPage({viewport:{width:390,height:844}});
  const btErrors=[];bluetooth.on('pageerror',error=>btErrors.push(error.message));
  await bluetooth.addInitScript(()=>{
    window.btConnected=false;window.btAttempts=0;window.btFail=false;
    window.printmeNative={platform:'android',bluetooth:{
      list:async()=>({devices:[{id:'00:11:22:33:44:55',name:'bluetoothprinter',classic:true},{id:'AA:BB:CC:DD:EE:FF',name:'BLE appareil',classic:false}]}),
      connect:async({id})=>{window.btAttempts++;if(id!=='00:11:22:33:44:55')throw Error('Mauvaise sélection');window.btConnected=true;return {name:'bluetoothprinter'}},
      disconnect:async()=>{window.btConnected=false},
      openSettings:async()=>{},
      write:async({data})=>{if(window.btFail)throw Error('Connexion Bluetooth perdue');if(!window.btConnected)throw Error('Déconnectée');window.sentBluetooth=atob(data)}
    },print:async()=>{},save:async()=>{}};
  });
  await bluetooth.goto('http://127.0.0.1:8088/');await bluetooth.locator('#homeClose').click();await bluetooth.locator('#btnPrinter').click();
  await bluetooth.locator('#mode').selectOption('androidbt');await bluetooth.locator('#btRefresh').click();
  await bluetooth.waitForFunction(()=>document.querySelector('#androidBtSel option[value="AA:BB:CC:DD:EE:FF"]')?.disabled===true);
  assert.equal(await bluetooth.locator('#androidBtSel option[value="AA:BB:CC:DD:EE:FF"]').evaluate(option=>option.disabled),true);
  await bluetooth.locator('#btnConnect').click();assert.equal(await bluetooth.evaluate(()=>btAttempts),0); // Never guess a paired device.
  await bluetooth.locator('#androidBtSel').selectOption('00:11:22:33:44:55');await bluetooth.locator('#btnConnect').click();
  await bluetooth.waitForFunction(()=>document.querySelector('#connText').textContent.includes('bluetoothprinter'));
  await bluetooth.locator('#dlgClose').click();await bluetooth.locator('#btnPrint').click();await bluetooth.waitForFunction(()=>window.sentBluetooth?.includes('BITMAP '));
  assert.ok(await bluetooth.evaluate(()=>sentBluetooth.endsWith('PRINT 1,1\r\n')));
  await bluetooth.waitForFunction(()=>!document.querySelector('#btnPrint').disabled);
  await bluetooth.evaluate(()=>{window.btFail=true});await bluetooth.locator('#btnPrint').click();
  await bluetooth.waitForFunction(()=>!document.querySelector('#btnPrint').disabled);
  await bluetooth.locator('#btnPrinter').click();assert.equal(await bluetooth.locator('#connText').textContent(),'Non connectée');
  assert.deepEqual(btErrors,[]);
  console.log('Bluetooth Android simulé : sélection explicite, exclusion BLE, envoi TSPL et erreur de transport vérifiés.');


 }finally{if(browser)await browser.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1});
