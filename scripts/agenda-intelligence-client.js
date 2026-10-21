/* Agenda 2.0: one visible-page read loop; no Google synchronization writes. */
(function(){
 'use strict';
 const POLICY='agenda-readonly-v1',INTERVAL=20000,MAX_AGE=25000;
 let context=null,record=null,flight=null,timer=null,sequence=0,failures=0,nextAt=0,lastSuccess=null,channel=null;
 window.forjaAgenda2Enabled=true;
 window.forjaAgenda2RescheduleFeedback=result=>{
  const status=result?.item?.googleSyncStatus,pending=['erro','conflito','pendente','cancelamento_pendente'].includes(status);
  toast(pending?'Aula reagendada no FORJA; sincronização Google pendente.':status==='sincronizado'?'Aula reagendada e sincronização Google confirmada.':'Aula reagendada no FORJA.',pending?'warn':'ok');
 };
 const active=()=>!document.hidden&&state.page==='agenda'&&['admin','teacher'].includes(state.role)&&state.profile?.active===true&&state.profile.role===state.role;
 const capture=()=>{if(!active())return null;const range=window.forjaAgenda2Context?.();if(!range)return null;const scope=forjaCaptureSession();return {...range,scope,key:JSON.stringify([scope.uid,scope.generation,state.role,range])};};
 const current=c=>!!c&&active()&&forjaSessionCurrent(c.scope)&&capture()?.key===c.key;
 const row=(uid,day)=>context&&current(context)&&record?.key===context.key&&day>=record.value.from&&day<=record.value.to?record.value.items.find(x=>x.professionalId===uid):null;
 const timely=()=>record&&!record.error&&performance.now()<record.expires;
 const fresh=()=>timely()&&(!flight||flight.shared);
 const minutes=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
 const time=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 const part=x=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(x)).map(p=>[p.type,p.value]));
 const dayKey=p=>p.year+'-'+p.month+'-'+p.day;
 const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const sourceLabel=source=>source==='google-central'?'Google central':'Google pessoal';
 const position=(style,a,b)=>style(time(a),time(b)).replace(/height:[\d.]+px/,'height:'+((b-a)*48/60).toFixed(1)+'px');
 function busyFor(r,day){return (r?.busy||[]).flatMap(x=>{const a=part(x.startAt),b=part(x.endAt),ad=dayKey(a),bd=dayKey(b);if(day<ad||day>bd)return [];const start=day===ad?a.hour+':'+a.minute:'00:00',end=day===bd?b.hour+':'+b.minute:'24:00';return end>start?[{start,end,source:x.source}]:[];});}
 function cuts(r,day){return [...busyFor(r,day),...(r?.blocks||[]).filter(x=>String(x.data).slice(0,10)===day).map(x=>({start:x.horaInicio,end:x.horaFim})),...(r?.school||[]).filter(x=>String(x.data).slice(0,10)===day).map(x=>({start:x.horaInicio,end:x.horaFim})),...(r?.lessons||[]).filter(x=>String(x.dataAula).slice(0,10)===day&&!/cancel/i.test(x.status||'')).map(x=>({start:x.horaAula,end:x.horaFim}))];}
 window.forjaAgenda2Periods=(uid,day)=>{const r=row(uid,day);return fresh()&&r?.status==='success'?(r.days[day]||[]):[];};
 window.forjaAgenda2Lessons=(uid,day)=>row(uid,day)?.nativeStatus==='success'?row(uid,day).lessons.filter(x=>String(x.dataAula).slice(0,10)===day):null;
 window.forjaAgenda2Google=(uid,day)=>{const r=row(uid,day);return r&&timely()?busyFor(r,day):[];};
 window.forjaAgenda2School=(uid,day)=>{const r=row(uid,day);return r?.nativeStatus==='success'&&timely()?r.school.filter(x=>String(x.data).slice(0,10)===day).map(x=>({start:x.horaInicio,end:x.horaFim})):[];};
 window.forjaAgenda2SchoolCards=(uid,day,style)=>window.forjaAgenda2School(uid,day).map(x=>`<div class="v621-block busy school" style="${style(x.start,x.end)}" title="Calendário escolar bloqueia este período"><b>Bloqueio escolar</b><small>${x.start}–${x.end}</small></div>`).join('');
 window.forjaAgenda2Blocks=(uid,day)=>{const r=row(uid,day);return r?.nativeStatus==='success'&&timely()?r.blocks.filter(x=>String(x.data).slice(0,10)===day).map(x=>({id:x.id,start:x.horaInicio,end:x.horaFim,source:x})):[];};
 function occupiedSources(r,day){return [
  ...busyFor(r,day).map(x=>({...x,label:sourceLabel(x.source)})),
  ...(r?.blocks||[]).filter(x=>String(x.data).slice(0,10)===day).map(x=>({start:x.horaInicio,end:x.horaFim,label:'Bloqueio FORJA',manual:x})),
  ...(r?.school||[]).filter(x=>String(x.data).slice(0,10)===day).map(x=>({start:x.horaInicio,end:x.horaFim,label:'Calendário escolar'}))
 ];}
 // Presentation only: union overlapping busy sources and leave native lesson
 // cards visible. This NEVER removes an interval from cuts(), booking or Google.
 window.forjaAgenda2BusyCards=(uid,day,style,role,filters={},name='')=>{
  const r=row(uid,day);if(filters.busy===false||r?.nativeStatus!=='success'||!timely())return '';
  const sources=occupiedSources(r,day),lessons=r.lessons.filter(x=>String(x.dataAula).slice(0,10)===day&&!/cancel/i.test(x.status||'')),points=new Set([420,1320]);
  for(const x of [...sources,...lessons.map(x=>({start:x.horaAula,end:x.horaFim}))])for(const t of [x.start,x.end])points.add(Math.max(420,Math.min(1320,minutes(t))));
  const bounds=[...points].sort((a,b)=>a-b),parts=[];
  for(let i=0;i<bounds.length-1;i++){
   const a=bounds[i],b=bounds[i+1],active=sources.filter(x=>minutes(x.start)<b&&minutes(x.end)>a);
   if(!active.length||filters.lesson!==false&&lessons.some(x=>minutes(x.horaAula)<b&&minutes(x.horaFim)>a))continue;
   const labels=[...new Set(active.map(x=>x.label))].sort(),manual=[...new Map(active.filter(x=>x.manual).map(x=>[x.manual.id,x.manual])).values()],key=JSON.stringify([labels,manual.map(x=>x.id).sort()]),last=parts.at(-1);
   if(last?.b===a&&last.key===key)last.b=b;else parts.push({a,b,labels,manual,key});
  }
  return parts.map(({a,b,labels,manual})=>{
   const editable=role==='teacher'&&manual.length===1,m=manual[0],tag=editable?'button':'div',origin=labels.join(' · '),attrs=editable?`type="button" data-v625-busy="${escape(m.id)}" data-date="${escape(day)}" data-start="${escape(m.horaInicio)}" data-end="${escape(m.horaFim)}"`:'',extra=role==='teacher'&&manual.length>1?manual.map(x=>`<button type="button" data-v625-busy="${escape(x.id)}" data-date="${escape(day)}" data-start="${escape(x.horaInicio)}" data-end="${escape(x.horaFim)}">Ver bloqueio FORJA</button>`).join(''):'';
   return `<${tag} ${attrs} class="v621-block ${role==='admin'?'v629-block':''} busy forja2-band forja2-busy ${labels.includes('Calendário escolar')?'school':''} ${labels.some(x=>x.startsWith('Google'))?'google':''}" style="${position(style,a,b)}" data-forja2-origin="${escape(origin)}" data-forja2-start="${time(a)}" data-forja2-end="${time(b)}" aria-label="${escape([name,'Ocupado',origin,time(a)+'–'+time(b)].filter(Boolean).join(' · '))}" title="${escape(origin)} · ${time(a)}–${time(b)}"><b>${escape(role==='admin'?name:'Ocupado')}</b><small>${time(a)}–${time(b)}</small><span class="forja2-origin">${escape(origin)}</span>${extra}</${tag}>`;
  }).join('');
 };
 window.forjaAgenda2LessonOrigin=(uid,day,start,end)=>{
  const r=row(uid,day);return timely()&&r?.nativeStatus==='success'?[...new Set(occupiedSources(r,day).filter(x=>minutes(x.start)<minutes(end)&&minutes(x.end)>minutes(start)).map(x=>x.label))].join(' · '):'';
 };
 window.forjaAgenda2DecorateLesson=button=>{
  const parent=button.closest('.v621-lane,.v621-month-cell'),day=parent?.dataset.date||parent?.dataset.v629Day||parent?.dataset.v625MonthDay||parent?.dataset.v629MonthDay;
  for(const uid of context?.ids||[]){const l=row(uid,day)?.lessons.find(x=>x.id===button.dataset.lesson);if(!l)continue;
   if(/cancel/i.test(l.status||'')){button.classList.add('cancelled');button.textContent='Cancelada · '+l.horaAula+' · '+(l.nomeAluno||'Aula FORJA');button.title=button.textContent+' · Não ocupa o horário';return;}
   if(!button.classList.contains('v621-block'))return;
   const origin=window.forjaAgenda2LessonOrigin(uid,day,l.horaAula,l.horaFim);if(!origin)return;
   button.querySelector('.forja2-lesson-origin')?.remove();const text='Também ocupado · '+origin;button.title=button.textContent.trim()+' · '+text;
   const note=document.createElement('span');note.className='forja2-lesson-origin';note.textContent=text;button.append(note);return;
  }
 };
 window.forjaAgenda2Cancelled=(uid,day,name='')=>(row(uid,day)?.lessons||[]).filter(l=>String(l.dataAula).slice(0,10)===day&&/cancel/i.test(l.status||'')).map(l=>`<button type="button" class="forja2-cancelled" data-lesson="${escape(l.id)}" title="Aula cancelada · Não ocupa o horário">${escape([name,'Cancelada',l.horaAula+'–'+l.horaFim,l.nomeAluno||'Aula FORJA'].filter(Boolean).join(' · '))}</button>`).join('');
 window.forjaAgenda2LessonCounts=(uid,day)=>{const all=(row(uid,day)?.lessons||[]).filter(l=>String(l.dataAula).slice(0,10)===day),cancelled=all.filter(l=>/cancel/i.test(l.status||'')).length;return {active:all.length-cancelled,cancelled};};
 window.forjaAgenda2Bands=(uid,day,style)=>{
  const r=row(uid,day),known=fresh()&&r?.status==='success',native=r?.nativeStatus==='success'&&timely(),published=native?(r?.days?.[day]||[]):[],occupied=native?cuts(r,day):[],points=new Set([420,1320]);
  for(const p of published)for(const t of [p.inicio,p.fim])points.add(Math.max(420,Math.min(1320,minutes(t))));
  for(const p of occupied)for(const t of [p.start,p.end])points.add(Math.max(420,Math.min(1320,minutes(t))));
  const bounds=[...points].sort((a,b)=>a-b);let html='';
  for(let i=0;i<bounds.length-1;i++){const a=bounds[i],b=bounds[i+1];if(b<=a)continue;const inside=published.some(p=>minutes(p.inicio)<=a&&minutes(p.fim)>=b),blocked=occupied.some(p=>minutes(p.start)<b&&minutes(p.end)>a),kind=blocked?'busy':!native?'unknown':inside?(known?'available':'unknown'):'outside';
   // Available/busy/lessons already have one native card with its official action.
   // Only unrepresented neutral/unknown intervals need a background band.
   if(kind==='busy'||kind==='available')continue;
   const label=kind==='unknown'?'Disponibilidade não confirmada':'Fora da publicação';html+=`<div class="forja2-band forja2-state ${kind}" style="${position(style,a,b)};--forja2-grid-offset:${(-((a-420)*48/60)).toFixed(1)}px" role="img" aria-label="${label} ${time(a)}–${time(b)}" title="${label}"><span>${label}</span></div>`;
  }
  return html;
 };
 window.forjaAgenda2DayKind=(uid,day)=>{
  const r=row(uid,day);if(r?.nativeStatus!=='success'||!timely())return 'unknown';const periods=r.days[day]||[],occupied=cuts(r,day);if(!periods.length)return occupied.length?'busy':'outside';if(!fresh()||r.status!=='success')return 'unknown';
  for(const p of periods){let parts=[[minutes(p.inicio),minutes(p.fim)]];for(const cut of occupied){const a=minutes(cut.start),b=minutes(cut.end);parts=parts.flatMap(([s,e])=>b<=s||a>=e?[[s,e]]:[...(a>s?[[s,a]]:[]),...(b<e?[[b,e]]:[])]);}if(parts.some(([s,e])=>e>s))return 'available';}return 'busy';
 };
 function paint(){window.forjaAgenda2Paint?.();for(const host of document.querySelectorAll('[data-forja2-status]')){
  const unavailable=!record||record.error||!fresh()||!record.value.complete;
  if(context?.ids.length>50){host.classList.add('unavailable');host.textContent='Selecione até 50 professores para confirmar a consulta automática.';continue;}
  host.classList.toggle('unavailable',!!unavailable);host.textContent=(flight?'Consultando… · ':unavailable?'Consulta incompleta ou vencida · ':'Consulta confirmada · ')+(lastSuccess?'Última consulta completa: '+new Date(lastSuccess).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Aguardando primeira consulta completa');
 }}
 const timeValid=x=>typeof x==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x);
 function valid(value,c){
  if(value?.policy!==POLICY||value.from!==c.from||value.to!==c.to||!Array.isArray(value.professionalIds)||JSON.stringify([...value.professionalIds].sort())!==JSON.stringify([...c.ids].sort())||!Array.isArray(value.items)||value.items.length!==c.ids.length||new Set(value.items.map(x=>x.professionalId)).size!==c.ids.length||typeof value.complete!=='boolean'||![value.checkedAt,value.expiresAt,value.servedAt].every(x=>Number.isFinite(Date.parse(x)))||Date.parse(value.expiresAt)-Date.parse(value.checkedAt)!==MAX_AGE||Date.parse(value.expiresAt)<=Date.parse(value.servedAt))return false;
  return value.complete===value.items.every(x=>x.status==='success')&&value.items.every(x=>{
   if(!c.ids.includes(x.professionalId)||!['success','unavailable'].includes(x.status)||!['success','unavailable'].includes(x.nativeStatus)||!['success','not_applicable','unavailable'].includes(x.personal?.status)||!['success','unavailable'].includes(x.central?.status)||x.status==='success'&&(x.nativeStatus!=='success'||x.personal.status==='unavailable'||x.central.status==='unavailable')||!x.days||typeof x.days!=='object'||!Array.isArray(x.lessons)||!Array.isArray(x.blocks)||!Array.isArray(x.school)||!Array.isArray(x.busy))return false;
   for(let d=c.from;d<=c.to;d=gAddDays(d,1))if(x.nativeStatus==='success'&&(!Array.isArray(x.days[d])||x.days[d].some(p=>!timeValid(p.inicio)||!timeValid(p.fim)||p.fim<=p.inicio)))return false;
   return x.busy.every(b=>Number.isFinite(Date.parse(b.startAt))&&Date.parse(b.endAt)>Date.parse(b.startAt))&&x.blocks.every(b=>timeValid(b.horaInicio)&&timeValid(b.horaFim)&&b.horaFim>b.horaInicio)&&x.school.every(b=>timeValid(b.horaInicio)&&timeValid(b.horaFim)&&b.horaFim>b.horaInicio)&&x.lessons.every(l=>timeValid(l.horaAula)&&timeValid(l.horaFim)&&l.horaFim>l.horaAula);
  });
 }
 function accept(value,c,transferredTtl=null){
  if(!current(c)||!valid(value,c))throw Error('AGENDA_RESULT_INVALID');
  // Deduct transport/Auth time as well as server-side source age. A transfer
  // between tabs carries the remaining lifetime, never a fresh full lifetime.
  const serviceTime=Number.isFinite(Date.parse(value.deliveryStartedAt))?Math.max(0,Date.parse(value.servedAt)-Date.parse(value.deliveryStartedAt)):0;
  const requestAge=flight&&!flight.shared?Math.max(0,performance.now()-flight.startedAt-serviceTime):0;
  const ttl=Math.min(MAX_AGE,Date.parse(value.expiresAt)-Date.parse(value.servedAt),transferredTtl??MAX_AGE)-requestAge;
  if(!Number.isFinite(ttl)||ttl<=0)throw Error('AGENDA_RESULT_EXPIRED');
  record={key:c.key,value,expires:performance.now()+ttl,error:false};
  for(const item of value.items)if(typeof item.personal.connected==='boolean'){
   const metadata={connected:item.personal.connected,lastSyncAt:item.personal.lastSyncAt||null};
   if(state.role==='admin'){const old=(state.googleConnections||[]).find(x=>x.uid===item.professionalId)||{};state.googleConnections=[...(state.googleConnections||[]).filter(x=>x.uid!==item.professionalId),{...old,uid:item.professionalId,...metadata}];}
   else state.googleCalendar={...state.googleCalendar,item:{...state.googleCalendar?.item,...metadata}};
  }
  if(value.complete){lastSuccess=value.checkedAt;failures=0;}else failures++;nextAt=performance.now()+(value.complete?INTERVAL:Math.min(120000,INTERVAL*2**Math.min(failures,3)));}
 function connectChannel(c){
  if(typeof BroadcastChannel!=='function')return;
  // Different UIDs, generations, roles and periods do not receive this payload.
  channel=new BroadcastChannel('forja-agenda-readonly-v1:'+c.key);
  channel.addEventListener('message',event=>{const m=event.data,age=Date.now()-m?.sentAt;if(m?.kind==='snapshot'&&m.key===c.key&&!flight&&current(c)&&Number.isFinite(m.ttlMs)&&m.ttlMs>0&&age>=0&&age<MAX_AGE){try{accept(m.value,c,m.ttlMs-age);paint();schedule();}catch{}}});
 }
 function schedule(){clearTimeout(timer);if(!context||!current(context))return;const now=performance.now(),expiry=record&&!record.error&&record.expires>now?record.expires:Infinity;timer=setTimeout(()=>{paint();if(performance.now()>=nextAt)void refresh();else schedule();},Math.max(20,Math.min(nextAt,expiry)-now));}
 async function collect(c,request){
  const query=new URLSearchParams({from:c.from,to:c.to});for(const id of c.ids)query.append('professionalId',id);
  let aborted;const cancel=new Promise((_,reject)=>{aborted=()=>reject(Error('AGENDA_ABORTED'));request.controller.signal.addEventListener('abort',aborted,{once:true});});
  let value;try{value=await Promise.race([api('/agenda/snapshot?'+query,{session:c.scope,signal:request.controller.signal}),cancel]);}finally{request.controller.signal.removeEventListener('abort',aborted);}
  if(flight!==request||!current(c))return;accept(value,c);channel?.postMessage({kind:'snapshot',key:c.key,value,ttlMs:record.expires-performance.now(),sentAt:Date.now()});return value.complete;
 }
 async function refresh({manual=false}={}){
  lifecycle(false);const c=context;if(!c||!current(c)||!c.ids.length||c.ids.length>50)return false;if(flight)return flight.promise;
  const request={controller:new AbortController(),promise:null,shared:false,startedAt:performance.now()},id=++sequence;flight=request;paint();
  const deadline=setTimeout(()=>request.controller.abort(),15000);
  request.promise=(async()=>{try{
    let result;
    if(navigator.locks){await navigator.locks.request('forja-agenda:'+c.key,{ifAvailable:true},async lock=>{if(!lock){request.shared=true;nextAt=performance.now()+1000;return;}result=await collect(c,request);});}else result=await collect(c,request);
    if(manual&&current(c))toast(result===true?'Consulta da Agenda confirmada.':'Consulta ainda não confirmada por todas as fontes.',result===true?'ok':'warn');return result===true;
   }catch(e){if(id===sequence&&current(c)){failures++;if(record)record.error=true;nextAt=performance.now()+Math.min(120000,INTERVAL*2**Math.min(failures,3));if(manual)toast('Não foi possível confirmar a atualização da Agenda.','warn');}return false;}
   finally{clearTimeout(deadline);if(flight===request){flight=null;if(current(c)){paint();schedule();}}}
  })();return request.promise;
 }
 function reset(){sequence++;clearTimeout(timer);flight?.controller.abort();channel?.close();channel=null;flight=null;context=null;record=null;lastSuccess=null;failures=0;nextAt=0;}
 function lifecycle(start=true){const c=capture();if(!c){if(context)reset();return;}if(context?.key!==c.key){reset();context=c;connectChannel(c);nextAt=performance.now();paint();}else if(start)paint();if(start&&!flight&&performance.now()>=nextAt)void refresh();}
 window.forjaAgenda2Refresh=refresh;
 window.forjaAgenda2Mutation=path=>{if(!/^\/(?:aulas|aulas-recorrentes|indisponibilidades|disponibilidade|calendario-escolar|google\/calendar|admin\/google-calendar)/.test(path))return;reset();lifecycle();};
 const previousBind=bindPage;bindPage=function(){previousBind();lifecycle();};
 const previousNavigate=navigate;navigate=function(...args){const result=previousNavigate(...args);lifecycle();return result;};
 const previousSession=forjaChangeSession;forjaChangeSession=function(...args){reset();return previousSession(...args);};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();else lifecycle();});
 window.addEventListener('beforeunload',()=>{reset();channel?.close();},{once:true});
})();
