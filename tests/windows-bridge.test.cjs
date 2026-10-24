const {test}=require('node:test');const assert=require('node:assert/strict');
const {requestFor}=require('../desktop/windows-print.cjs');
test('Le pont Windows limite les commandes et valide la file',()=>{
 assert.throws(()=>requestFor('/unknown'));assert.throws(()=>requestFor('/jobs'));assert.throws(()=>requestFor('/print',{body:'{"printer":"TS-M420","data":"!"}'}));
 assert.deepEqual(requestFor('/jobs?printer=TS-M420'),{action:'jobs',request:{printer:'TS-M420'}});
 assert.deepEqual(requestFor('/print',{body:JSON.stringify({printer:'TS-M420',data:'QUJD'})}),{action:'print',request:{printer:'TS-M420',data:'QUJD'}});
});
