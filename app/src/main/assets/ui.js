'use strict';
const $=id=>document.getElementById(id);
const models=Object.fromEntries(SPEC.panels.map(p=>[p.id,Object.fromEntries(p.fields.map(f=>[f[0],String(f[2])]))]));
const key='tehmi-aspiration-1';
let current='filter', latest=null;
try {
  const saved=JSON.parse(localStorage.getItem(key)||'{}');
  for(const p of SPEC.panels) for(const f of p.fields) {
    const value=saved.models?.[p.id]?.[f[0]];
    if(typeof value==='string' && (!f[3] || f[3].includes(value))) models[p.id][f[0]]=value;
  }
  if(SPEC.panels.some(p=>p.id===saved.current)) current=saved.current;
} catch(e) { /* A failed storage read must not block calculations. */ }
function persist() { try { localStorage.setItem(key,JSON.stringify({models,current})); } catch(e) { $('status').textContent='Не удалось сохранить ввод. Расчёт остаётся доступен.'; } }
for(const [id,title] of [...SPEC.panels.map(p=>[p.id,p.title]),['reference','Литература'],['about','О компании']]) {
  const option=document.createElement('option'); option.value=id; option.textContent=title; $('navigation').append(option);
}
$('navigation').value=current;
function invalidate(){latest=null;$('result').hidden=true;$('error').hidden=true;$('status').textContent='Данные изменены. Выполните расчёт.';}
function visibility(){
  const active=new Set(activeFields(current,models[current]).map(f=>f[0]));
  for(const el of $('fields').children){el.hidden=!active.has(el.dataset.key);el.querySelector('input,select').disabled=el.hidden;}
}
function render(){
  latest=null;
  const panel=SPEC.panels.find(p=>p.id===current);
  $('calculator').hidden=!panel; $('reference').hidden=current!=='reference'; $('about').hidden=current!=='about';
  if(!panel)return;
  $('title').textContent=panel.title;$('section-number').textContent=String(SPEC.panels.indexOf(panel)+1).padStart(2,'0');
  $('explanation').textContent=panel.explanation;$('fields').replaceChildren();
  for(const [name,label,def,choices] of panel.fields){
    const wrap=document.createElement('label');wrap.className='field';wrap.dataset.key=name;
    const caption=document.createElement('span');caption.textContent=label;
    const input=document.createElement(choices?'select':'input'); input.name=name;
    if(choices)for(const c of choices){const o=document.createElement('option');o.value=c;o.textContent=c;input.append(o);}
    else{input.type='text';input.autocomplete='off';if(!['source','load_source'].includes(name))input.inputMode='decimal';input.placeholder=def || 'Введите значение';}
    input.value=models[current][name];
    input.addEventListener(choices?'change':'input',()=>{models[current][name]=input.value;invalidate();visibility();persist();});
    wrap.append(caption,input);$('fields').append(wrap);
  }
  invalidate();visibility();$('status').textContent='Введите исходные данные и выполните расчёт.';
}
$('navigation').addEventListener('change',()=>{current=$('navigation').value;persist();render();});
$('literature').textContent=SPEC.literature+'\n\n'+SPEC.panels.map(p=>p.title+'\n'+p.explanation).join('\n\n')+'\n\nБНТУ, «Расчёт рукавного фильтра», 2011, стр. 17–24. Коэффициенты и регрессии перенесены из исходной программы.\nNASA Glenn: Equation of State, PV=nRT. BIPM SI Brochure §2.3.1: t/°C = T/K − 273,15.';
$('form').addEventListener('submit',e=>{
  e.preventDefault();invalidate();
  try{
    const d={...models[current]},r=calculatePanel(current,d);
    latest={title:SPEC.panels.find(p=>p.id===current).title,text:reportText(current,d,r)};
    const entries=current==='filter' ? ['bag_count','installed_area','active_area','q','actual_load','required_area'].map(k=>[FILTER_LABELS[k],r[k]]) : Object.entries(r);
    $('metrics').replaceChildren();
    for(const [label,v] of entries){const card=document.createElement('div');card.className='metric';const b=document.createElement('b');b.textContent=new Intl.NumberFormat('ru-RU',{maximumSignificantDigits:7}).format(v);const s=document.createElement('span');s.textContent=label;card.append(b,s);$('metrics').append(card);}
    $('report').textContent=latest.text;
    $('checks').textContent=current==='filter'?'✓ Геометрия, net-площадь и допустимая нагрузка проверены. '+r.warnings.join(' '):'Применимость коэффициентов и исходных данных проверяет инженер. '+SPEC.panels.find(p=>p.id===current).explanation;
    $('result').hidden=false;$('status').textContent='Расчёт выполнен. Доступен полный TXT-отчёт.';$('result').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){$('error').textContent=error.message;$('error').hidden=false;$('status').textContent='Исправьте исходные данные.';$('error').scrollIntoView({block:'center'});}
});
$('reset').addEventListener('click',()=>{if(!confirm('Сбросить введённые данные этого раздела к начальным примерам?'))return;const p=SPEC.panels.find(p=>p.id===current);models[current]=Object.fromEntries(p.fields.map(f=>[f[0],String(f[2])]));persist();render();});
$('save').addEventListener('click',()=>{
  if(!latest)return;
  if(window.AndroidReports){window.AndroidReports.save(latest.title,latest.text);return;}
  const url=URL.createObjectURL(new Blob(['\ufeff'+latest.text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='ТехМИ_'+latest.title+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
render();
