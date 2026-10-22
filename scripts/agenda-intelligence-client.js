/* Agenda: native invalidations plus bounded Google revalidation; never sync writes. */
(function(){
 'use strict';
 const POLICY='agenda-readonly-v1',BACKOFF_BASE=20000,SOURCE_LEAD=5000,MAX_AGE=25000;
 let context=null,record=null,flight=null,timer=null,sequence=0,failures=0,nextAt=0,lastSuccess=null,channel=null,failureReason=null;
 let stream=null,streamTimer=null,streamSeenAt=0,streamFailures=0,streamStatus='',revision=0,retryUntil=0,changeTimer=null,changeVersion=null,localDirty=false;
 window.forjaAgenda2Enabled=true;
 window.forjaAgenda2RescheduleFeedback=result=>{
  const status=result?.item?.googleSyncStatus,pending=['erro','conflito','pendente','cancelamento_pendente'].includes(status);
  toast(pending?'Aula reagendada no FORJA; sincronização Google pendente.':status==='sincronizado'?'Aula reagendada e sincronização Google confirmada.':'Aula reagendada no FORJA.',pending?'warn':'ok');
 };
 const active=(visible=true)=>(!visible||!document.hidden)&&state.page==='agenda'&&['admin','teacher'].includes(state.role)&&state.profile?.active===true&&state.profile.role===state.role;
 const capture=(visible=true)=>{if(!active(visible))return null;const range=window.forjaAgenda2Context?.();if(!range)return null;const scope=forjaCaptureSession();return {...range,scope,key:JSON.stringify([scope.uid,scope.generation,state.role,range])};};
 const current=c=>!!c&&active()&&forjaSessionCurrent(c.scope)&&capture()?.key===c.key;
 const row=(uid,day)=>context&&current(context)&&record?.key===context.key&&day>=record.value.from&&day<=record.value.to?record.value.items.find(x=>x.professionalId===uid):null;
 // Some suspended mobile processes stop performance.now while wall time passes.
 // Either clock expiring invalidates the result; neither can extend its TTL.
 const timely=()=>record&&!record.error&&performance.now()<record.expires&&Date.now()<record.wallExpires;
 // Keep the last COMPLETE snapshot only while its original TTL remains valid.
  // A new GET does not revoke already-confirmed intervals; failed or partial
  // responses still invalidate them through record.error or replacement.
  const fresh=()=>timely();
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
 window.forjaAgenda2PlannedDuration=l=>{const duration=minutes(l.horaFim||'00:00')-minutes(l.horaAula||'00:00');return duration>0?duration+' min (prevista)':'—';};
 window.forjaAgenda2DetailScope=()=>state.page==='agenda'&&['admin','teacher'].includes(state.role)?{...forjaCaptureSession(),role:state.role}:null;
 window.forjaAgenda2DetailCurrent=(dialog,scope)=>!!dialog&&forjaSessionCurrent(scope)&&state.page==='agenda'&&state.role===scope.role&&document.querySelector('#modal .modal')===dialog;
 window.forjaAgenda2ReturnFocus=previous=>{
  if(previous?.isConnected||state.page!=='agenda'||!['admin','teacher'].includes(state.role))return previous;
  const id=previous?.dataset?.lesson;
  return id?document.querySelector('.forja2-agenda [data-lesson="'+CSS.escape(id)+'"]'):previous;
 };
 // Layout only: partition connected overlap groups per professional. Reservation
 // cuts remain the full original intervals; no event is hidden or shortened.
 window.forjaAgenda2Polish=orderedIds=>{
  const calendar=document.querySelector('.v629-calendar-card');
  if(calendar)calendar.style.setProperty('--forja2-lane-min',Math.max(112,(orderedIds?.length||1)*112)+'px');
  // Move the existing control node (and its handlers) beside the calendar's
  // filters, once per render. Do not recreate an edited select on each poll.
  const entry=document.getElementById('forjaFixedEntry'),target=state.role==='admin'?document.querySelector('.v629-sidebar .forja2-filter-content'):null;
  if(entry&&target&&entry.parentElement!==target)target.append(entry);
  const teacherFilters=document.querySelector('.forja2-teacher-filters');
  if(teacherFilters&&!teacherFilters.dataset.boundFine){teacherFilters.dataset.boundFine='1';teacherFilters.ontoggle=()=>{state.v625AgendaFiltersOpen=teacherFilters.open};}
  const viewport=document.querySelector('.forja2-agenda .v621-week-wrap'),c=context;
  if(viewport&&current(c)&&viewport.dataset.forja2ScrollBound!==c.key){
   viewport.dataset.forja2ScrollBound=c.key;
   const saved=state.forjaAgenda2Scrolls?.[c.key];if(saved){viewport.scrollTop=saved.top;viewport.scrollLeft=saved.left;}
   // This is view state only. Native session reset clears it; the context key
   // also fences UID/generation, professional selection, range and view.
   viewport.onscroll=()=>{if(!viewport.isConnected||!current(c))return;const positions=state.forjaAgenda2Scrolls||={};positions[c.key]={top:viewport.scrollTop,left:viewport.scrollLeft};for(const key of Object.keys(positions).slice(0,-8))delete positions[key];};
  }
  for(const lane of document.querySelectorAll('.forja2-agenda .v621-lane')){
   const day=lane.dataset.date||lane.dataset.v629Day,ids=orderedIds||context?.ids||[];
   for(const [index,uid] of ids.entries()){
    const lessons=row(uid,day)?.lessons||[],cards=[...lane.querySelectorAll('button[data-lesson]')].flatMap(button=>{
     const l=lessons.find(x=>x.id===button.dataset.lesson);if(!l)return [];
     const text=[l.nomeAluno||'Aluno',typeof lessonTitle==='function'?lessonTitle(l):'Aula FORJA',l.horaAula+'–'+l.horaFim,l.nomeProfessor||state.users?.find(x=>x.uid===uid)?.fullName||'Professor'].join(' · '),origin=window.forjaAgenda2LessonOrigin(uid,day,l.horaAula,l.horaFim);
     button.title=text+(origin?' · Também ocupado · '+origin:'');button.setAttribute('aria-label',button.title);
     if(state.role==='admin')button.querySelector('b').textContent=l.nomeAluno||'Aluno';
     return [{button,start:minutes(l.horaAula),end:minutes(l.horaFim)}];
    }).sort((a,b)=>a.start-b.start||b.end-a.end||a.button.dataset.lesson.localeCompare(b.button.dataset.lesson));
    let group=[],until=-1;
    const layout=()=>{const ends=[];for(const item of group){let column=ends.findIndex(end=>end<=item.start);if(column<0)column=ends.length;ends[column]=item.end;item.column=column;}
     for(const item of group){const count=Math.max(1,ids.length),columns=ends.length,left=(index+item.column/columns)*100/count,width=100/count/columns;
      item.button.style.setProperty('left',`calc(${left.toFixed(5)}% + 4px)`,'important');item.button.style.setProperty('width',`calc(${width.toFixed(5)}% - 8px)`,'important');item.button.style.setProperty('right','auto','important');item.button.dataset.forja2Column=String(item.column);
     }
    };
    for(const item of cards){if(item.start>=until&&group.length){layout();group=[];until=-1;}group.push(item);until=Math.max(until,item.end);}if(group.length)layout();
   }
  }
  // Preserve an explicit state word even when a monthly professional name is
  // ellipsized. Full text remains in the accessible name and native tooltip.
  for(const tag of document.querySelectorAll('.forja2-agenda .v621-month-tag,.forja2-agenda .v629-month-tag')){
   const text=tag.textContent.trim();tag.title=text;tag.setAttribute('aria-label',text);
   tag.dataset.forja2Label=tag.classList.contains('lesson')?'Aula':tag.classList.contains('availability')?'Livre':tag.classList.contains('busy')?'Ocupado':tag.classList.contains('unknown')?'Verificar':tag.classList.contains('outside')?'Fora':tag.classList.contains('cancelled')?'Cancelada':'';
  }
 };
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
  // Preserve fail-closed colors. Explain only safe, fixed source states to the
  // Secretariat; never display personal Google event content or credentials.
  const unresolved=state.role==='admin'&&!record?.error?(record?.value?.items||[]).filter(x=>x.status!=='success'):[];
  const consent=unresolved.filter(x=>x.availabilityReason==='personal_consent_required').length;
  const sync=unresolved.filter(x=>x.availabilityReason==='personal_sync_unavailable').length;
  const personal=unresolved.filter(x=>x.personal?.status==='unavailable'&&!x.availabilityReason).length;
  const central=unresolved.filter(x=>x.central?.status==='unavailable').length;
  const centralConsent=(record?.value.items||[]).some(x=>x.central?.reason==='central_consent_required');
  const details=[consent?`${consent} profissional(is) precisam autorizar a consulta Google pela Secretaria em Hoje ou Conta e perfil, na seção Google Calendar`:null,sync?`${sync} profissional(is) com sincronização Google pessoal indisponível; conferir a conexão do professor`:null,personal?'Google pessoal não confirmou todos os horários':null,centralConsent?'Google central precisa de autorização de consulta; conferir a conexão da Secretaria':central?'Google central não confirmou todos os horários; conferir vínculos e acesso':null].filter(Boolean);
  const quota=(record?.value.items||[]).some(x=>[x.personal?.reason,x.central?.reason].some(r=>r==='personal_rate_limit'||r==='central_rate_limit'));
  const phase=failureReason||(quota?'Limite temporário na fonte Google; aguardando prazo de nova consulta':!record?'Carregamento inicial; horários ainda não confirmados':!timely()?'Dados vencidos; aguardando nova confirmação':!record.value.complete?'Fontes incompletas; horários não confirmados':'');
  host.classList.toggle('unavailable',!!unavailable);host.textContent=(flight?'Consultando… · ':unavailable?'Consulta incompleta ou vencida · ':'Consulta confirmada · ')+(lastSuccess?'Última consulta completa: '+new Date(lastSuccess).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Aguardando primeira consulta completa')+(phase?' · '+phase:'')+(details.length?' · '+details.join(' · '):'')+(streamStatus?' · '+streamStatus:'');
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
  if(!current(c)||!valid(value,c)||changeVersion&&value.changeVersion!==changeVersion)throw Error('AGENDA_RESULT_INVALID');
  // Deduct transport/Auth time as well as server-side source age. A transfer
  // between tabs carries the remaining lifetime, never a fresh full lifetime.
  const serviceTime=Number.isFinite(Date.parse(value.deliveryStartedAt))?Math.max(0,Date.parse(value.servedAt)-Date.parse(value.deliveryStartedAt)):0;
  const requestAge=flight&&!flight.shared?Math.max(0,performance.now()-flight.startedAt-serviceTime):0;
  const ttl=Math.min(MAX_AGE,Date.parse(value.expiresAt)-Date.parse(value.servedAt),transferredTtl??MAX_AGE)-requestAge;
  if(!Number.isFinite(ttl)||ttl<=0)throw Error('AGENDA_RESULT_EXPIRED');
  record={key:c.key,value,expires:performance.now()+ttl,wallExpires:Date.now()+ttl,error:false};failureReason=null;
  for(const item of value.items)if(typeof item.personal.connected==='boolean'){
   const metadata={connected:item.personal.connected,lastSyncAt:item.personal.lastSyncAt||null};
   if(state.role==='admin'){const old=(state.googleConnections||[]).find(x=>x.uid===item.professionalId)||{};state.googleConnections=[...(state.googleConnections||[]).filter(x=>x.uid!==item.professionalId),{...old,uid:item.professionalId,...metadata}];}
   else state.googleCalendar={...state.googleCalendar,item:{...state.googleCalendar?.item,...metadata}};
  }
  if(value.complete){lastSuccess=value.checkedAt;failures=0;retryUntil=0;}else failures++;
  const retry=Math.min(86400000,Math.max(0,Number(value.retryAfterMs)||0));if(!value.complete&&retry>0)retryUntil=performance.now()+retry;
  // Source cache age shortens the next deadline; it never grants another 25s.
  // Native writes arrive independently through the authenticated change stream.
  nextAt=Math.max(retryUntil,performance.now()+(value.complete?Math.max(1000,ttl-SOURCE_LEAD):retry>0?retry:Math.min(120000,BACKOFF_BASE*2**Math.min(failures,3))));}
 function connectChannel(c){
  if(typeof BroadcastChannel!=='function')return;
  // Different UIDs, generations, roles and periods do not receive this payload.
  channel=new BroadcastChannel('forja-agenda-readonly-v1:'+c.key);
  channel.addEventListener('message',event=>{const m=event.data,age=Date.now()-m?.sentAt;if(m?.key!==c.key||!current(c)||!(age>=0&&age<MAX_AGE))return;
   if(m.kind==='changes'){streamSeenAt=Date.now();handleChange(c,m.event);return;}
   if(m.kind==='cooldown'&&Number.isFinite(m.wait)&&m.wait>age){retryUntil=Math.max(retryUntil,performance.now()+Math.min(86400000,m.wait-age));nextAt=Math.max(nextAt,retryUntil);failureReason='Limite temporário de consultas; nova tentativa automática';if(record)record.error=true;paint();schedule();return;}
   if(m.kind==='snapshot'&&performance.now()>=retryUntil&&!localDirty&&!flight&&Number.isFinite(m.ttlMs)&&m.ttlMs>0){try{accept(m.value,c,m.ttlMs-age);paint();schedule();}catch{}}
  });
 }
 const queryFor=c=>{const query=new URLSearchParams({from:c.from,to:c.to});for(const id of c.ids)query.append('professionalId',id);return query;};
 function changed(c){
  if(!current(c))return;revision++;if(record)record.error=true;failureReason='Alteração detectada; confirmando horários';paint();
  clearTimeout(changeTimer);changeTimer=setTimeout(()=>{if(!current(c))return;nextAt=Math.max(retryUntil,performance.now());schedule();},250);
 }
 function handleChange(c,event){
  if(!current(c))return;
  if(typeof event.version==='string'&&/^[a-f0-9]{64}$/.test(event.version)){const previous=changeVersion;changeVersion=event.version;if(previous&&previous!==changeVersion&&event.kind==='heartbeat')changed(c);}
  if(['ready','heartbeat'].includes(event.kind)){streamStatus='Alterações FORJA acompanhadas';if(event.kind==='ready'&&(record||flight))changed(c);}
  else if(event.kind==='changed')changed(c);
  else if(event.kind==='unauthorized'){revision++;if(record)record.error=true;failureReason='Consulta sem autorização; conferir acesso da conta';paint();}
  else if(event.kind==='unavailable')streamStatus='Acompanhamento de alterações indisponível; recuperando consulta';
 }
 function startChanges(c){
  clearTimeout(streamTimer);streamTimer=null;if(stream||!current(c)||!c.ids.length||c.ids.length>50||navigator.onLine===false)return;
  const connection={controller:new AbortController(),last:Date.now()};stream=connection;
  const run=async()=>{
   const deadline=setTimeout(()=>connection.controller.abort(),12000);
   try{
    const user=auth?.currentUser;if(!user||!current(c))return;
    let abortToken;const aborted=new Promise((_,reject)=>{abortToken=()=>reject(Error('AGENDA_STREAM_ABORTED'));connection.controller.signal.addEventListener('abort',abortToken,{once:true});});
    let token;try{token=await Promise.race([user.getIdToken(),aborted]);}finally{connection.controller.signal.removeEventListener('abort',abortToken);}if(!current(c)||connection.controller.signal.aborted)return;
    forjaSessionRequests.add(connection.controller);
    const response=await fetch(FORJA_API_URL+'/agenda/changes?'+queryFor(c),{headers:{Authorization:'Bearer '+token},signal:connection.controller.signal,cache:'no-store'});
    if(!current(c)){await response.body?.cancel();return;}
    if(!response.ok){const raw=response.headers.get('Retry-After'),seconds=raw===null?NaN:Number(raw),wait=Number.isFinite(seconds)?seconds*1000:Date.parse(raw)-Date.now();if(Number.isFinite(wait)&&wait>0)connection.retry=Math.min(86400000,wait);throw Error('AGENDA_STREAM_UNAVAILABLE');}
    if(!response.headers.get('Content-Type')?.startsWith('text/event-stream')||!response.body)throw Error('AGENDA_STREAM_UNAVAILABLE');
    clearTimeout(deadline);const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
    const watchdog=setInterval(()=>{if(Date.now()-connection.last>45000)connection.controller.abort();},15000);
    try{for(;;){const part=await reader.read();if(part.done)break;if(!current(c))break;buffer+=decoder.decode(part.value,{stream:true});if(buffer.length>8192)throw Error('AGENDA_STREAM_INVALID');let boundary;
     while((boundary=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);if(!frame.startsWith('data: '))continue;const event=JSON.parse(frame.slice(6));if(!['ready','changed','heartbeat','unavailable','unauthorized','reconnect'].includes(event.kind))throw Error('AGENDA_STREAM_INVALID');connection.last=Date.now();streamSeenAt=Date.now();streamFailures=0;handleChange(c,event);channel?.postMessage({kind:'changes',key:c.key,event,sentAt:Date.now()});if(['reconnect','unauthorized','unavailable'].includes(event.kind))return;}
    }}finally{clearInterval(watchdog);await reader.cancel().catch(()=>{});reader.releaseLock();}
   }catch{if(current(c))streamStatus='Acompanhamento de alterações indisponível; recuperando consulta';}
   finally{clearTimeout(deadline);forjaSessionRequests.delete(connection.controller);}
  };
  void(async()=>{try{if(navigator.locks)await navigator.locks.request('forja-agenda-events:'+c.key,{ifAvailable:true},async lock=>{if(lock)await run();});else await run();}
   finally{if(stream===connection){stream=null;if(current(c)){streamFailures++;streamTimer=setTimeout(()=>startChanges(c),Math.max(connection.retry||0,streamSeenAt&&Date.now()-streamSeenAt<30000?5000:Math.min(60000,2000*2**Math.min(streamFailures,5))));}}}
  })();
 }
 function schedule(){
  clearTimeout(timer);if(!context||!current(context))return;
  const now=performance.now(),expiry=record&&!record.error&&record.expires>now?record.expires:Infinity,due=Math.min(flight?Infinity:nextAt,expiry);
  // Keep the original expiry armed during renewal. Do not spin or launch a
  // second GET while the existing request owns the refresh slot.
  if(!Number.isFinite(due))return;
  timer=setTimeout(()=>{paint();if(!flight&&performance.now()>=nextAt)void refresh();else schedule();},Math.max(20,due-now));
 }
 async function collect(c,request){
  const query=queryFor(c);
  let aborted;const cancel=new Promise((_,reject)=>{aborted=()=>reject(Error('AGENDA_ABORTED'));request.controller.signal.addEventListener('abort',aborted,{once:true});});
  let value;try{value=await Promise.race([api('/agenda/snapshot?'+query,{session:c.scope,signal:request.controller.signal}),cancel]);}finally{request.controller.signal.removeEventListener('abort',aborted);}
  if(flight!==request||!current(c))return;if(request.revision!==revision){nextAt=Math.max(retryUntil,performance.now()+250);return false;}accept(value,c);localDirty=false;channel?.postMessage({kind:'snapshot',key:c.key,value,ttlMs:record.expires-performance.now(),sentAt:Date.now()});return value.complete;
 }
 async function refresh({manual=false}={}){
  lifecycle(false);const c=context;if(!c||!current(c)||!c.ids.length||c.ids.length>50||navigator.onLine===false)return false;if(flight)return flight.promise;if(performance.now()<retryUntil){nextAt=retryUntil;schedule();return false;}
  const request={controller:new AbortController(),promise:null,shared:false,startedAt:performance.now(),revision},id=++sequence;flight=request;paint();schedule();
  const deadline=setTimeout(()=>request.controller.abort(),15000);
  request.promise=(async()=>{try{
    let result;
    if(navigator.locks){await navigator.locks.request('forja-agenda:'+c.key,{ifAvailable:true},async lock=>{if(!lock){request.shared=true;nextAt=performance.now()+1000;return;}result=await collect(c,request);});}else result=await collect(c,request);
    if(manual&&current(c))toast(result===true?'Consulta da Agenda confirmada.':'Consulta ainda não confirmada por todas as fontes.',result===true?'ok':'warn');return result===true;
   }catch(e){if(id===sequence&&current(c)){failures++;if(record)record.error=true;const changedDuringRead=e.status===409&&e.code==='AGENDA_QUERY_CHANGED';failureReason=changedDuringRead?'Alteração detectada durante a consulta; confirmando horários':[401,403].includes(e.status)?'Consulta sem autorização; conferir acesso da conta':e.status===429?'Limite temporário de consultas; nova tentativa automática':request.controller.signal.aborted?'Tempo de consulta esgotado; nova tentativa automática':e.message==='AGENDA_RESULT_EXPIRED'?'Dados recebidos vencidos; aguardando nova confirmação':e.message==='AGENDA_RESULT_INVALID'?'Resposta inválida; horários não confirmados':'Falha de rede ou serviço; horários não confirmados';const wait=e.status===429&&e.retryAfterMs>0?e.retryAfterMs:changedDuringRead||e.message==='AGENDA_RESULT_EXPIRED'?1000:Math.min(120000,BACKOFF_BASE*2**Math.min(failures,3));nextAt=performance.now()+wait;if(e.status===429){retryUntil=nextAt;channel?.postMessage({kind:'cooldown',key:c.key,wait,sentAt:Date.now()});}if(manual)toast('Não foi possível confirmar a atualização da Agenda.','warn');}return false;}
   finally{clearTimeout(deadline);if(flight===request){flight=null;if(current(c)){paint();schedule();}}}
  })();return request.promise;
 }
 // Pause transport, never renew or extend the retained snapshot's expiry.
 function pause(){sequence++;clearTimeout(timer);clearTimeout(changeTimer);clearTimeout(streamTimer);streamTimer=null;stream?.controller.abort();stream=null;flight?.controller.abort();channel?.close();channel=null;flight=null;}
 function reset(){pause();context=null;record=null;lastSuccess=null;failureReason=null;failures=0;nextAt=0;retryUntil=0;revision=0;streamSeenAt=0;streamFailures=0;streamStatus='';changeVersion=null;localDirty=false;}
 function lifecycle(start=true){const c=capture(!document.hidden);if(!c){if(context)reset();return;}if(document.hidden){if(context?.key!==c.key)reset();else pause();return;}if(context?.key!==c.key){reset();context=c;connectChannel(c);nextAt=performance.now();paint();}else if(start){if(!channel)connectChannel(c);paint();}if(start){if(!stream&&!streamTimer)startChanges(c);if(!flight&&performance.now()>=nextAt)void refresh();}}
 window.forjaAgenda2Refresh=refresh;
 window.forjaAgenda2Mutation=path=>{if(!/^\/(?:aulas|aulas-recorrentes|indisponibilidades|disponibilidade|calendario-escolar|google\/calendar|admin\/google-calendar)/.test(path))return;if(context){localDirty=true;changed(context);}else lifecycle();};
 const previousBind=bindPage;bindPage=function(){previousBind();lifecycle();};
 const previousNavigate=navigate;navigate=function(...args){const result=previousNavigate(...args);lifecycle();return result;};
 const previousSession=forjaChangeSession;forjaChangeSession=function(...args){reset();return previousSession(...args);};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)nextAt=performance.now();lifecycle();});
 window.addEventListener('offline',()=>{pause();if(record)record.error=true;failureReason='Sem conexão; horários não confirmados';paint();});
 window.addEventListener('online',()=>{nextAt=Math.max(retryUntil,performance.now());lifecycle();if(context)startChanges(context);});
 window.addEventListener('beforeunload',()=>{reset();channel?.close();},{once:true});
})();
