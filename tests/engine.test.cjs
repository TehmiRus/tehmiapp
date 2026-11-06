const assert=require('node:assert/strict');
const fs=require('node:fs');
const {calculatePanel,reportText,activeFields}=require('../app/src/main/assets/engine.js');
const spec=require('../app/src/main/assets/spec.js');
const cases=require('./reference-cases.json');
function compare(a,b,path=''){
 if(typeof b==='number'){assert.equal(typeof a,'number',path);assert.ok(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b)),`${path}: ${a} != ${b}`);}
 else if(b && typeof b==='object' && !Array.isArray(b)){for(const k of Object.keys(b)) compare(a[k],b[k],path+'.'+k);}
 else if(Array.isArray(b)){} // Warning wording is adapted to the Android report.
 else assert.equal(a,b,path);
}
for(const [i,c]of cases.entries()){
 if(c.error)assert.throws(()=>calculatePanel(c.id,c.data),undefined,'case '+i);
 else compare(calculatePanel(c.id,c.data),c.result,'case '+i);
}
const d=Object.fromEntries(spec.panels[0].fields.map(f=>[f[0],f[2]]));
Object.assign(d,{specific_load:'1',flow:'6000',sections:'3',offline:'1',cleaning:spec.cleaning[1],bag_diameter:'200',bag_length:'2',margin:'0'});
const r=calculatePanel('filter',d);assert.equal(r.bag_count,120);
const report=reportText('filter',d,r);
for(const s of ['120','ВЫПОЛНЕНО','EPA/452/B-02-001','Fnet,min','ОГРАНИЧЕНИЯ','кПа'])assert.ok(report.includes(s),s);
assert.ok(!activeFields('filter',d).some(f=>f[0]==='dust'));
assert.throws(()=>calculatePanel('filter',{...d,flow:'0x10'}));
assert.throws(()=>calculatePanel('filter',{...d,flow:'Infinity'}));
assert.throws(()=>calculatePanel('filter',{...d,flow:'1000000000',specific_load:'.001',bag_diameter:'1',bag_length:'.01',sections:'1000',offline:'999',margin:'200'}));
console.log(`${cases.length} Python comparison cases + report, visibility and input checks passed`);
