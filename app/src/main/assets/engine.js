/* Port of TehmiRus/Filter- 47ea2388f24556409192d5054de28a8911c5a9f3.
 * Equations and ranges follow filter_v2.py and aspiration.py. SI units. */
'use strict';
const Config = typeof module !== 'undefined' ? require('./spec.js') : SPEC;
function calculatePanel(id, d) {
  const panel = Config.panels.find(p => p.id === id);
  if (!panel) throw Error('Неизвестный раздел');
  const label = k => (panel.fields.find(f => f[0] === k) || [k,k])[1];
  const num = (k, lo=0, hi=1e12, positive=false) => {
    const raw = String(d[k] ?? '').trim().replace(',', '.');
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) throw Error('Введите число: '+label(k));
    const v = Number(raw);
    if (!Number.isFinite(v) || v < lo || v > hi || (positive && v < 1e-9)) throw Error(label(k)+': допустимо '+lo+'…'+hi+(positive ? ', не меньше 1e-9' : ''));
    return v;
  };
  const choice = (k, values) => {
    if (!values.includes(d[k])) throw Error('Выберите: '+label(k));
    return d[k];
  };
  const integer = (k, lo, hi) => {
    const v = num(k, lo, hi);
    if (!Number.isInteger(v)) throw Error(label(k)+': требуется целое число');
    return v;
  };
  const source = k => { if (!String(d[k] ?? '').trim()) throw Error('Укажите: '+label(k)); };
  const interp = (x, points) => {
    if (x < points[0][0] || x > points.at(-1)[0]) throw Error('Значение вне таблицы');
    for (let i=1; i<points.length; i++) {
      const [x0,y0] = points[i-1], [x1,y1] = points[i];
      if (x <= x1) return y0+(y1-y0)*(x-x0)/(x1-x0);
    }
    return points.at(-1)[1];
  };
  let r = {};
  if (id === 'filter') {
    const method = choice('method',Config.methods), basis = choice('flow_basis',Config.flowBases);
    const cleaning = choice('cleaning',Config.cleaning), regeneration = choice('regeneration',Config.regeneration);
    const normal = basis === Config.flowBases[1], bntu = method === Config.methods[1];
    const flow = num('flow',.001,1e9);
    let conversion=1, humidity_factor=1, temperature=null;
    if (normal || bntu) temperature=num('temperature',-100,500);
    if (normal) {
      const nt=num('normal_temperature',-100,100), p=num('pressure',1,1000), np=num('normal_pressure',1,1000);
      conversion=(temperature+273.15)/(nt+273.15)*np/p;
      if (choice('moisture_basis',Config.moisture) === Config.moisture[1]) humidity_factor=1/(1-num('water_percent',0,95)/100);
    }
    const actual_flow=flow*conversion*humidity_factor;
    let q, coefficients={}, warnings=[];
    if (bntu) {
      const c=num('concentration',3,110), dia=num('diameter',.001,10000), outlet=num('outlet',5,30);
      if (temperature < 20 || temperature > 160) throw Error('Температура для БНТУ: 20–160 °C');
      const dust=choice('dust',Config.dusts.map(a=>a[0]));
      const qn=Config.dusts.find(a=>a[0]===dust)[1], material=choice('material',Config.materials);
      let c1;
      if (regeneration === Config.regeneration[0]) c1=material === Config.materials[0] ? 1 : 1.075;
      else {
        if (material !== Config.materials[0]) throw Error('БНТУ: нетканый материал поддерживает только импульсную продувку');
        const pos=Config.densities.indexOf(choice('density',Config.densities))/2;
        c1=(regeneration === Config.regeneration[1] ? .85 : .70)-.15*pos;
      }
      const c2=1.2057841637161242-.08230121051989753*Math.log(c+1.191223543938115);
      const c3=dia<3 ? .8 : dia<=10 ? .9 : dia<=50 ? 1 : dia<=100 ? 1.1 : 1.3;
      const c4=interp(temperature,[[20,1],[40,.9],[60,.84],[80,.78],[100,.75],[120,.73],[140,.72],[160,.70]]);
      const c5=interp(outlet,[[5,.9],[10,.95],[30,1]]);
      coefficients={qn,c1,c2,c3,c4,c5}; q=qn*c1*c2*c3*c4*c5;
      warnings.push('Предварительная модель БНТУ: c2 — регрессия рисунка, c4/c5 — интерполяции. Независимое подтверждение для производства отсутствует.', 'c1 для нетканого материала: средний прирост 7,5%; средняя плотность ткани: середина диапазона.');
    } else {
      q=num('specific_load',.001,100);
      if (!String(d.load_source??'').trim()) warnings.push('Основание выбора q не указано. Допустимая нагрузка не обоснована.');
    }
    const sections=integer('sections',1,1000), offline=cleaning===Config.cleaning[1] ? integer('offline',0,sections-1) : 0;
    const extra_flow=num('extra_flow',0,1e9), margin=num('margin',0,200);
    const diameter=num('bag_diameter',1,2000)/1000, length=num('bag_length',.01,30);
    const total_flow=actual_flow+extra_flow, working_minimum=total_flow/(60*q), working_design=working_minimum*(1+margin/100);
    const required_area=working_design/((sections-offline)/sections), bag_area=Math.PI*diameter*length;
    const bags_per_section=Math.ceil(required_area/(sections*bag_area)), bag_count=sections*bags_per_section;
    if (!Number.isSafeInteger(bag_count)) throw Error('Число рукавов слишком велико для точного расчёта. Проверьте размеры и расход.');
    const installed_area=bag_count*bag_area, active_area=(sections-offline)*bags_per_section*bag_area, actual_load=total_flow/(60*active_area);
    const checks={
      'Минимальная net-площадь с запасом обеспечена':active_area>=working_design*(1-1e-12),
      'Нагрузка не превышает допустимую с учётом запаса':actual_load<=q/(1+margin/100)*(1+1e-12),
      'Рукава распределены поровну между секциями':bag_count%sections===0
    };
    if (Object.values(checks).some(v=>!v)) throw Error('Не выполнена проверка геометрии');
    warnings.push('Предварительный подбор площади и рукавов. Не проверены сопротивление, межрукавные скорости, эффективность улавливания, стойкость ткани и точка росы.', 'Секции равные; учитывается только активная боковая поверхность рукавов.', 'Пересчёт расхода: идеальный газ Z=1, абсолютные T/P; доля пара — объёмная, не относительная влажность. Конденсация не моделируется.', 'Дополнительный поток прибавляется только если одновременно проходит через работающую ткань. Не учитывайте один поток дважды.');
    r={actual_flow,total_flow,conversion,humidity_factor,q,coefficients,working_minimum,working_design,required_area,bag_area,bags_per_section,bag_count,installed_area,active_area,actual_load,speed:actual_load/60,sections,offline,extra_flow,margin,checks,warnings};
  } else if (id === 'alternative') {
    const flow=num('flow',0,1e12,true), method=choice('method',['По скорости фильтрации','По действующему фильтру']);
    const speed=method==='По скорости фильтрации' ? num('speed',0,10,true) : num('reference_flow',0,1e12,true)/3600/num('reference_area',0,1e12,true);
    source('source');
    const sections=integer('sections',1,1000), offline=integer('offline',0,1000);
    if (offline>=sections) throw Error('Отключённых секций должно быть меньше общего числа');
    const margin=num('margin',0,200), net=flow/3600/speed, gross=net*(1+margin/100)*sections/(sections-offline);
    const bag=Math.PI*num('bag_diameter',0,2000,true)/1000*num('bag_length',0,30,true);
    const per=Math.ceil(gross/(sections*bag)), active=(sections-offline)*per*bag;
    if (!Number.isSafeInteger(sections*per)) throw Error('Число рукавов слишком велико для точного расчёта. Проверьте размеры и расход.');
    r={'Скорость фильтрации, м/с':speed,'Нагрузка q = 60v, м³/(м²·мин)':60*speed,'Минимальная net-площадь Q/(3600v), м²':net,'Требуемая gross-площадь с запасом, м²':gross,'Площадь одного рукава πDL, м²':bag,'Рукавов в секции, шт.':per,'Всего рукавов, шт.':sections*per,'Установленная gross-площадь, м²':sections*per*bag,'Действующая площадь, м²':active,'Фактическая скорость Q/(3600Factive), м/с':flow/3600/active};
    if (String(d.comparison_area??'').trim()) r['Отличие требуемой gross-площади от сравниваемой, %']=(gross/num('comparison_area',0,1e12,true)-1)*100;
  } else if (id === 'duct') {
    const flow=num('flow',0,1e12,true)/3600, target=num('target_speed',0,200,true), diameter=num('diameter',0,10000,true)/1000;
    const rho=num('rho',0,100,true), area=Math.PI*diameter**2/4, speed=flow/area, dynamic=rho*speed**2/2;
    const length=num('length',0,100000), friction=num('darcy',0,1,true), zeta=num('zeta',0,10000);
    source('source');
    const loss=friction*length/diameter*dynamic, local=zeta*dynamic;
    r={'Расход Q/3600, м³/с':flow,'Теоретический диаметр по заданной скорости, мм':Math.sqrt(4*flow/(Math.PI*target))*1000,'Площадь выбранного сечения, м²':area,'Скорость в выбранном сечении, м/с':speed,'Динамическое давление ρv²/2, Па':dynamic,'Трение λL/D·ρv²/2, Па':loss,'Местные потери Σζ·ρv²/2, Па':local,'Сопротивление участка, Па':loss+local};
  } else if (id === 'fan') {
    const flow=num('flow',0,1e12,true)/3600, pressure=num('network')+num('filter')+num('other');
    const design=pressure*(1+num('reserve',0,200)/100), eta=num('efficiency',0,1,true), drive=num('drive_efficiency',0,1,true);
    r={'Сумма потерь полного давления, Па':pressure,'Требуемое полное давление с запасом, Па':design,'Полезная мощность QΔpt, кВт':flow*design/1000,'Мощность на валу вентилятора, кВт':flow*design/eta/1000,'Потребляемая мощность с КПД привода, кВт':flow*design/eta/drive/1000};
  } else if (id === 'dust') {
    const flow=num('flow',0,1e12,true), c=num('concentration'), eta=num('efficiency',0,100)/100, incoming=flow*c/1000;
    r={'Поступает пыли Q·C/1000, кг/ч':incoming,'Уловлено пыли, кг/ч':incoming*eta,'Выброс пыли, кг/ч':incoming*(1-eta),'Концентрация на выходе, мг/м³':c*1000*(1-eta)};
  }
  function finite(v) { if(typeof v==='number' && !Number.isFinite(v)) throw Error('Переполнение расчёта: проверьте исходные данные'); if(v && typeof v==='object') Object.values(v).forEach(finite); }
  finite(r); return r;
}
const FILTER_LABELS={actual_flow:'Рабочий расход, м³/ч',total_flow:'Расход через ткань, м³/ч',conversion:'Коэффициент пересчёта T/P',humidity_factor:'Коэффициент влажности',q:'Допустимая нагрузка q, м³/(м²·мин)',working_minimum:'Минимальная net-площадь, м²',working_design:'Net-площадь с запасом, м²',required_area:'Требуемая gross-площадь, м²',bag_area:'Активная площадь рукава, м²',bags_per_section:'Рукавов в секции, шт.',bag_count:'Всего рукавов, шт.',installed_area:'Установленная gross-площадь, м²',active_area:'Доступная net-площадь, м²',actual_load:'Фактическая нагрузка, м³/(м²·мин)',speed:'Скорость через ткань, м/с',sections:'Всего секций',offline:'Отключено секций',extra_flow:'Дополнительный поток, м³/ч',margin:'Запас площади, %'};
function activeFields(id,d) {
  const hidden=new Set();
  if (id==='filter') {
    const normal=d.flow_basis===Config.flowBases[1], bntu=d.method===Config.methods[1];
    if (!normal) ['normal_temperature','normal_pressure','pressure','moisture_basis','water_percent'].forEach(k=>hidden.add(k));
    if (!normal && !bntu) hidden.add('temperature');
    if (normal && d.moisture_basis!==Config.moisture[1]) hidden.add('water_percent');
    (bntu ? ['specific_load','load_source'] : ['dust','concentration','diameter','outlet','material','density']).forEach(k=>hidden.add(k));
    if (bntu && d.regeneration===Config.regeneration[0]) hidden.add('density');
    if (d.cleaning!==Config.cleaning[1]) hidden.add('offline');
  } else if (id==='alternative') {
    (d.method==='По скорости фильтрации' ? ['reference_flow','reference_area'] : ['speed']).forEach(k=>hidden.add(k));
  }
  return Config.panels.find(p=>p.id===id).fields.filter(f=>!hidden.has(f[0]));
}
function reportText(id,d,r) {
  const p=Config.panels.find(p=>p.id===id), fmt=n=>Number(n.toPrecision(12)).toString();
  const lines=['ТехМИ — '+p.title,'Android 1.0 · модель Filter- 2.2','Дата: '+new Date().toLocaleString('ru-RU'),'','ИСХОДНЫЕ ДАННЫЕ',...activeFields(id,d).map(f=>f[1]+': '+d[f[0]]),'','ФОРМУЛЫ И УСЛОВИЯ',p.explanation,'','РЕЗУЛЬТАТЫ'];
  for(const [k,v] of Object.entries(r)) if(typeof v==='number') lines.push((FILTER_LABELS[k]||k)+': '+fmt(v));
  if(id==='filter') {
    lines.push('','ПОДСТАНОВКИ',`Qраб = ${d.flow} × ${fmt(r.conversion)} × ${fmt(r.humidity_factor)} = ${fmt(r.actual_flow)} м³/ч`, `Qчерез ткань = ${fmt(r.actual_flow)} + ${fmt(r.extra_flow)} = ${fmt(r.total_flow)} м³/ч`, `Fnet,min = ${fmt(r.total_flow)}/(60 × ${fmt(r.q)}) = ${fmt(r.working_minimum)} м²`, `Fnet,design = ${fmt(r.working_minimum)} × (1 + ${fmt(r.margin)}/100) = ${fmt(r.working_design)} м²`, `Fgross = ${fmt(r.working_design)}/(1 − ${r.offline}/${r.sections}) = ${fmt(r.required_area)} м²`, `fрукава = π × ${Number(String(d.bag_diameter).replace(',','.'))/1000} × ${d.bag_length} = ${fmt(r.bag_area)} м²`, `Nсекц = ceil(${fmt(r.required_area)}/(${r.sections} × ${fmt(r.bag_area)})) = ${r.bags_per_section}`);
    lines.push('','КОЭФФИЦИЕНТЫ',...Object.entries(r.coefficients).map(([k,v])=>k+' = '+fmt(v)),'','ПРОВЕРКИ',...Object.entries(r.checks).map(([k,v])=>k+': '+(v?'ВЫПОЛНЕНО':'НЕ ВЫПОЛНЕНО')),'','ОГРАНИЧЕНИЯ',...r.warnings);
  }
  lines.push('','ИСТОЧНИКИ И СТАТУС',Config.literature,'NASA Glenn — Equation of State: PV=nRT. BIPM SI Brochure §2.3.1: T/K = t/°C + 273,15.','БНТУ, «Расчёт рукавного фильтра», 2011, стр. 17–24. Коэффициенты перенесены из исходной программы, внешняя проверка для производства не выполнена.');
  return lines.join('\n')+'\n';
}
if(typeof module!=='undefined') module.exports={calculatePanel,activeFields,reportText};
