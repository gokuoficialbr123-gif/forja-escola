/* Agenda: native invalidations plus bounded Google revalidation; never sync writes. */
(function(){
 'use strict';
 const POLICY='agenda-readonly-v1',BACKOFF_BASE=20000,SOURCE_LEAD=5000,MAX_AGE=25000,INSTITUTIONAL_MAX_AGE=300000;
 let context=null,record=null,flight=null,timer=null,sequence=0,failures=0,nextAt=0,lastSuccess=null,channel=null,failureReason=null,observedLatency=0;
 // Bounded to one last confirmed set per source/professional in this context.
 // Display only: never feeds published periods, cuts or booking authorization.
 let knownRows=new Map(),accessDenied=false;
 function denyAccess(){accessDenied=true;knownRows.clear();record=null;lastSuccess=null;}
 let stream=null,streamTimer=null,streamSeenAt=0,streamFailures=0,streamStatus='',revision=0,retryUntil=0,changeTimer=null,changeVersion=null,localDirty=false,awaitingStream=false;
 window.forjaAgenda2Enabled=true;
 window.forjaAgenda2RescheduleFeedback=result=>{
  const status=result?.item?.googleSyncStatus,pending=['erro','conflito','pendente','cancelamento_pendente'].includes(status);
  toast(pending?'Aula reagendada no FORJA; sincronização Google pendente.':status==='sincronizado'?'Aula reagendada e sincronização Google confirmada.':'Aula reagendada no FORJA.',pending?'warn':'ok');
 };
 const active=(visible=true)=>(!visible||!document.hidden)&&state.page==='agenda'&&['admin','teacher'].includes(state.role)&&state.profile?.active===true&&state.profile.role===state.role;
 const capture=(visible=true)=>{if(!active(visible))return null;const range=window.forjaAgenda2Context?.();if(!range)return null;const scope=forjaCaptureSession();return {...range,scope,key:JSON.stringify([scope.uid,scope.generation,state.role,range])};};
 const current=c=>!!c&&active()&&forjaSessionCurrent(c.scope)&&capture()?.key===c.key;
 const row=(uid,day)=>context&&current(context)&&record?.key===context.key&&day>=record.value.from&&day<=record.value.to?record.value.items.find(x=>x.professionalId===uid):null;
 const knownRow=(uid,day)=>row(uid,day)?knownRows.get(uid):null;
 const accountLessons=uid=>(state.lessons||[]).filter(l=>l?.professorId===uid);
 function remember(value){for(const item of value.items){
  const old=knownRows.get(item.professionalId)||{},next={...old};
  if(item.nativeStatus==='success')Object.assign(next,{lessons:item.lessons,blocks:item.blocks,school:item.school});
  for(const source of ['personal','central'])if(['success','not_applicable'].includes(item[source].status))next[source]=item.busy.filter(x=>(x.source==='google-central'?'central':'personal')===source);
  knownRows.set(item.professionalId,next);
 }}
 function sourceCurrent(r,source){
  if(!r||!record||record.revoked||record.invalidSources?.has(source))return false;
  if(record.value.refreshMode==='events'&&(record.leaseLost||!streamSeenAt||Date.now()-streamSeenAt>=45000)){record.leaseLost=true;return false;}
  const deadline=record.sources?.get(r.professionalId)?.[source],status=source==='native'?r.nativeStatus:r[source]?.status;
  return ['success','not_applicable'].includes(status)&&!!deadline&&performance.now()<deadline.expires&&Date.now()<deadline.wallExpires;
 }
 function noteStream(){if(record?.value.refreshMode==='events'&&streamSeenAt&&Date.now()-streamSeenAt>=45000)record.leaseLost=true;streamSeenAt=Date.now();}
 function displayRow(uid,day){const r=row(uid,day),old=knownRow(uid,day);if(!r)return null;return {...r,nativeHistorical:!sourceCurrent(r,'native'),lessons:sourceCurrent(r,'native')?r.lessons:old?.lessons??accountLessons(uid),blocks:r.nativeStatus==='success'?r.blocks:old?.blocks||[],school:r.nativeStatus==='success'?r.school:old?.school||[],busy:['personal','central'].flatMap(source=>['success','not_applicable'].includes(r[source].status)?r.busy.filter(x=>(x.source==='google-central'?'central':'personal')===source):old?.[source]||[])};}
 const historical=(uid,day)=>!timely()||row(uid,day)?.status!=='success';
 // Some suspended mobile processes stop performance.now while wall time passes.
 // Either clock expiring invalidates the result; neither can extend its TTL.
 const timely=()=>record&&!record.error&&performance.now()<record.expires&&Date.now()<record.wallExpires&&(record.value.refreshMode!=='events'||streamSeenAt>0&&Date.now()-streamSeenAt<45000);
 // Keep the last COMPLETE snapshot only while its original TTL remains valid.
  // A new GET does not revoke already-confirmed intervals; failed or partial
  // responses still invalidate them through record.error or replacement.
  const fresh=()=>timely();
 const minutes=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
 const time=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 const part=x=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(x)).map(p=>[p.type,p.value]));
 const dayKey=p=>p.year+'-'+p.month+'-'+p.day;
 const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 // Presentation derives only from the native modality field. Titles and status
 // never turn an unclassified lesson into an online/presential lesson.
 window.forjaAgenda2Modality=lesson=>{
  const kind=['presencial','online'].includes(String(lesson?.modalidade||'').trim().toLowerCase())?String(lesson.modalidade).trim().toLowerCase():'unknown';
  const label=kind==='presencial'?'Presencial':kind==='online'?'Online':'Modalidade não informada';
  const icon=kind==='online'?'<rect x="2" y="4" width="12" height="12" rx="2"/><path d="m14 8 5-3v10l-5-3z"/>':kind==='presencial'?'<path d="M3 18V7l7-4 7 4v11M7 18v-5h6v5M7 8h.01M13 8h.01M2 18h16"/>':'<circle cx="10" cy="10" r="7"/><path d="M8 8a2 2 0 1 1 3 2c-1 0-1 1-1 2M10 15h.01"/>';
  return {kind,label,icon:'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">'+icon+'</svg>'};
 };
 const nativeHistoryLabel='Última informação conhecida · Aula não confirmada';
 window.forjaAgenda2LessonClass=lesson=>'forja2-lesson forja2-'+window.forjaAgenda2Modality(lesson).kind+(lesson?.forja2NativeHistorical?' forja2-native-history':'');
 window.forjaAgenda2LessonMeta=(lesson,{place=true}={})=>{
  const m=window.forjaAgenda2Modality(lesson),location=place&&m.kind==='presencial'?String(lesson.localAula||'').trim():'';
  return '<span class="forja2-mode">'+m.icon+escape(m.label)+(location?'<span class="forja2-place"> · '+escape(location)+'</span>':'')+'</span>';
 };
 window.forjaAgenda2MonthTime=lesson=>{
  const start=String(lesson.horaAula||''),period=[lesson.horaAula,lesson.horaFim].filter(Boolean).join('–');
  if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start))return '';
  return '<time class="forja2-month-time" datetime="'+escape(start)+'" aria-label="'+escape(period)+'">'+escape(start.slice(0,2)+'h'+(start.slice(3)==='00'?'':start.slice(3)))+'</time>';
 };
 window.forjaAgenda2LessonContent=(lesson,{name='',compact=false}={})=>{
  const subject=typeof lessonTitle==='function'?lessonTitle(lesson):lesson.disciplinaNome||'Aula',period=[lesson.horaAula,lesson.horaFim].filter(Boolean).join('–');
  return (compact?window.forjaAgenda2MonthTime(lesson):'')+(compact&&lesson.forja2NativeHistorical?'<span class="forja2-native-notice">Hist.</span>':'')+'<b class="forja2-event-title">'+escape(compact?name||lesson.nomeAluno||subject:period).replace('–','–<wbr>')+'</b><small class="forja2-event-time">'+escape(compact?[period,subject].filter(Boolean).join(' · '):name||lesson.nomeAluno||subject)+'</small>'+(!compact&&lesson.forja2NativeHistorical?'<span class="forja2-history-label">Histórico</span>':'')+window.forjaAgenda2LessonMeta(lesson,{place:!compact});
 };
 window.forjaAgenda2LessonLegend=()=>'<div class="forja2-legend" aria-label="Legenda das aulas"><span class="presencial">Presencial</span><span class="online">Online</span><span class="unknown">Modalidade não informada</span></div>';
 window.forjaAgenda2CalendarLesson=(lesson,role)=>{
  const status=gStatusMeta(lesson),subject=lessonTitle(lesson),title=role==='student'?subject:[lesson.nomeAluno||'Aluno',subject].join(' · '),period=[lesson.horaAula,lesson.horaFim].filter(Boolean).join('–'),label=[title,period,lesson.nomeProfessor,window.forjaAgenda2Modality(lesson).label,lesson.localAula,status.label].filter(Boolean).join(' · ');
  return '<button type="button" class="g-event '+status.cls+' '+window.forjaAgenda2LessonClass(lesson)+'" data-lesson="'+escape(lesson.id)+'" data-forja2-modality="'+window.forjaAgenda2Modality(lesson).kind+'" title="'+escape(label)+'" aria-label="'+escape(label)+'"><b>'+escape(title)+'</b><small>'+escape([period,role==='student'?lesson.nomeProfessor:status.label].filter(Boolean).join(' · '))+'</small>'+window.forjaAgenda2LessonMeta(lesson)+'</button>';
 };
 window.forjaAgenda2DetailMeta=lesson=>'<div class="forja2-detail-mode '+window.forjaAgenda2LessonClass(lesson)+'">'+window.forjaAgenda2LessonMeta(lesson,{place:false})+'</div>';
 window.forjaAgenda2Institutional=()=>state.role==='teacher'&&(state.profile?.calendarModel==='institutional-events-v1'||state.googleCalendar?.item?.sourceMode==='institutional-events-v1'||context&&current(context)&&record?.key===context.key&&record.value.items.some(x=>x.professionalId===state.user?.uid&&x.personal?.sourceMode==='institutional-events-v1'));
 window.forjaAgenda2ProfilePolish=()=>{
  const workspace=document.querySelector('#workspaceContent'),calendar=['agenda','aulas','sessoes'].includes(state.page);
  workspace?.classList.toggle('forja2-calendar-page',calendar);if(!calendar||!workspace)return;
  for(const toolbar of workspace.querySelectorAll('.g-cal-toolbar,.cal18-toolbar,.agenda-toolbar'))toolbar.parentElement.classList.add('forja2-calendar');
  if(['student','parent'].includes(state.role))for(const legend of workspace.querySelectorAll('.g-legend,.g-cal-legend,.status-legend')){
   if(!legend.dataset.forja2Legend){legend.innerHTML=window.forjaAgenda2LessonLegend();legend.dataset.forja2Legend='1';}
  }
  if(state.role==='psychologist')for(const legend of workspace.querySelectorAll('.agenda-legend'))if(!legend.dataset.forja2Legend){legend.innerHTML='<div class="forja2-legend" aria-label="Legenda dos atendimentos"><span class="unknown">Atendimento</span><span class="busy">Indisponibilidade</span><span class="unknown">Disponibilidade não consultada</span></div>';legend.dataset.forja2Legend='1';}
  for(const event of workspace.querySelectorAll('.agenda-month-events .agenda-event,.v621-month-tags .forja2-lesson,.cal18-month-grid .forja2-lesson')){
   if(event.dataset.forja2MonthLabel)continue;
   const label=[...event.children].filter(part=>!part.classList.contains('forja2-month-time')).map(part=>part.textContent.replace(/\s+/g,' ').trim()).filter(Boolean).join(' · ');event.title=label;event.setAttribute('aria-label',label);event.dataset.forja2MonthLabel='1';
   const kind=event.dataset.forja2EventKind,start=event.dataset.forja2EventStart;
   if(['sessao','disponibilidade'].includes(kind)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start)){
    const compact=document.createElement('span'),time=document.createElement('span'),type=document.createElement('span');compact.className='forja2-operational-compact';compact.setAttribute('aria-hidden','true');
    time.textContent=start.slice(0,2)+'h'+(start.slice(3)==='00'?'':start.slice(3));type.textContent=kind==='sessao'?'Sessão':'Disp.';compact.append(time,type);event.append(compact);
   }
  }
  for(const button of workspace.querySelectorAll('[data-forja2-cal-day]'))button.onclick=e=>{e.preventDefault();e.stopPropagation();const role=button.dataset.forja2CalRole;if(role!==state.role)return;const keys=gCalendarState(role);state[keys.dateKey]=button.dataset.forja2CalDay;state[keys.viewKey]='day';renderPage();};
  for(const button of workspace.querySelectorAll('[data-forja2-therapy-day]'))button.onclick=()=>{if(state.role!=='psychologist')return;state.agendaDate=button.dataset.forja2TherapyDay;state.agendaView='day';renderPage();};
 };
 const sourceLabel=source=>source==='google-central'?'Google central':'Google pessoal';
 const position=(style,a,b)=>style(time(a),time(b)).replace(/height:[\d.]+px/,'height:'+((b-a)*96/60).toFixed(1)+'px');
 function busyFor(r,day){return (r?.busy||[]).flatMap(x=>{const a=part(x.startAt),b=part(x.endAt),ad=dayKey(a),bd=dayKey(b);if(day<ad||day>bd)return [];const start=day===ad?a.hour+':'+a.minute:'00:00',end=day===bd?b.hour+':'+b.minute:'24:00';return end>start?[{start,end,source:x.source}]:[];});}
 function cuts(r,day){return [...busyFor(r,day),...(r?.blocks||[]).filter(x=>String(x.data).slice(0,10)===day).map(x=>({start:x.horaInicio,end:x.horaFim})),...(r?.school||[]).filter(x=>String(x.data).slice(0,10)===day).map(x=>({start:x.horaInicio,end:x.horaFim})),...(r?.lessons||[]).filter(x=>String(x.dataAula).slice(0,10)===day&&!/cancel/i.test(x.status||'')).map(x=>({start:x.horaAula,end:x.horaFim}))];}
 const confirmedRow=r=>record&&!record.error&&r?.status==='success'&&['native','personal','central'].every(source=>sourceCurrent(r,source));
 window.forjaAgenda2Periods=(uid,day)=>{const r=row(uid,day);return confirmedRow(r)?(r.days[day]||[]):[];};
 // Presentation metadata belongs to a clone, never to the source/native cache.
 // Google failure alone does not invalidate a currently confirmed native row.
 window.forjaAgenda2Lessons=(uid,day)=>{
  if(accessDenied)return [];
  const r=displayRow(uid,day);if(!r&&!current(context))return null;
  // The legacy state cache has no current snapshot proof. Keep it identifiable
  // during a new read, but never let a refused read fall back into that cache.
  const lessons=r?.lessons??(state.lessons||[]).filter(l=>l?.professorId===uid);
  return lessons.filter(l=>String(l.dataAula||'').slice(0,10)===day).map(l=>({...l,forja2NativeHistorical:r?.nativeHistorical??true}));
 };
 window.forjaAgenda2Google=(uid,day)=>{const r=row(uid,day);return busyFor(r,day).filter(x=>sourceCurrent(r,x.source==='google-central'?'central':'personal'));};
 window.forjaAgenda2School=(uid,day)=>{const r=row(uid,day);return sourceCurrent(r,'native')?r.school.filter(x=>String(x.data).slice(0,10)===day).map(x=>({start:x.horaInicio,end:x.horaFim})):[];};
 window.forjaAgenda2SchoolCards=(uid,day,style)=>window.forjaAgenda2School(uid,day).map(x=>`<div class="v621-block busy school" style="${style(x.start,x.end)}" title="Calendário escolar bloqueia este período"><b>Bloqueio escolar</b><small>${x.start}–${x.end}</small></div>`).join('');
 window.forjaAgenda2Blocks=(uid,day)=>{const r=row(uid,day);return sourceCurrent(r,'native')?r.blocks.filter(x=>String(x.data).slice(0,10)===day).map(x=>({id:x.id,start:x.horaInicio,end:x.horaFim,source:x})):[];};
 function occupiedSources(r,day){return [
  ...busyFor(r,day).map(x=>({...x,label:sourceLabel(x.source)})),
  ...(r?.blocks||[]).filter(x=>String(x.data).slice(0,10)===day).map(x=>({start:x.horaInicio,end:x.horaFim,label:'Bloqueio FORJA',manual:x})),
  ...(r?.school||[]).filter(x=>String(x.data).slice(0,10)===day).map(x=>({start:x.horaInicio,end:x.horaFim,label:'Calendário escolar'}))
 ];}
 function displaySources(uid,day){const r=row(uid,day);return occupiedSources(displayRow(uid,day),day).map(x=>({...x,historical:!sourceCurrent(r,x.label==='Google central'?'central':x.label==='Google pessoal'?'personal':'native')}));}
 // Presentation only: union overlapping busy sources and leave native lesson
 // cards visible. This NEVER removes an interval from cuts(), booking or Google.
 window.forjaAgenda2BusyCards=(uid,day,style,role,filters={},name='')=>{
  const r=displayRow(uid,day);if(filters.busy===false||!r)return '';
  const nativeKnown=sourceCurrent(row(uid,day),'native');
  const sources=displaySources(uid,day),lessons=r.lessons.filter(x=>String(x.dataAula).slice(0,10)===day&&!/cancel/i.test(x.status||'')),points=new Set([420,1320]);
  for(const x of [...sources,...lessons.map(x=>({start:x.horaAula,end:x.horaFim}))])for(const t of [x.start,x.end])points.add(Math.max(420,Math.min(1320,minutes(t))));
  const bounds=[...points].sort((a,b)=>a-b),parts=[];
  for(let i=0;i<bounds.length-1;i++){
   const a=bounds[i],b=bounds[i+1],active=sources.filter(x=>minutes(x.start)<b&&minutes(x.end)>a);
   if(!active.length||filters.lesson!==false&&(nativeKnown||active.every(x=>x.historical))&&lessons.some(x=>minutes(x.horaAula)<b&&minutes(x.horaFim)>a))continue;
   const confirmed=active.filter(x=>!x.historical),shown=confirmed.length?confirmed:active,labels=[...new Set(shown.map(x=>x.label))].sort(),manual=[...new Map(shown.filter(x=>x.manual).map(x=>[x.manual.id,x.manual])).values()],stale=!confirmed.length,key=JSON.stringify([labels,manual.map(x=>x.id).sort(),stale]),last=parts.at(-1);
   if(last?.b===a&&(last.key===key||last.stale===stale&&!last.manual.length&&!manual.length&&[...last.labels,...labels].every(x=>x.startsWith('Google')))){last.b=b;last.labels=[...new Set([...last.labels,...labels])].sort();}else parts.push({a,b,labels,manual,key,stale});
  }
  return parts.map(({a,b,labels,manual,stale})=>{
   const editable=nativeKnown&&role==='teacher'&&manual.length===1,m=manual[0],tag=editable?'button':'div',origin=labels.join(' · '),attrs=editable?`type="button" data-v625-busy="${escape(m.id)}" data-date="${escape(day)}" data-start="${escape(m.horaInicio)}" data-end="${escape(m.horaFim)}"`:'',extra=nativeKnown&&role==='teacher'&&manual.length>1?manual.map(x=>`<button type="button" data-v625-busy="${escape(x.id)}" data-date="${escape(day)}" data-start="${escape(x.horaInicio)}" data-end="${escape(x.horaFim)}">Ver bloqueio FORJA</button>`).join(''):'';
   const period=time(a)+'–'+time(b),label=[name,stale?'Última informação conhecida':'Ocupado',origin,period].filter(Boolean).join(' · '),shortOrigin=labels.some(x=>x.startsWith('Google'))&&labels.every(x=>x.startsWith('Google'))?(labels.length===1?labels[0]:'Google'):origin;
   return `<${tag} ${attrs} class="v621-block ${role==='admin'?'v629-block':''} busy forja2-band forja2-busy ${stale?'forja2-historical':''} ${labels.includes('Calendário escolar')?'school':''} ${labels.some(x=>x.startsWith('Google'))?'google':''}" style="${position(style,a,b)}" data-forja2-key="${escape(['busy',uid,a,b,origin].join(':'))}" data-forja2-professional="${escape(uid)}" data-forja2-origin="${escape(origin)}" data-forja2-start="${time(a)}" data-forja2-end="${time(b)}" aria-label="${escape(label)}" title="${escape(label)}"><b>${period.replace('–','–<wbr>')}</b><span class="forja2-origin">${stale?'Histórico · ':''}${escape(shortOrigin)}</span>${extra}</${tag}>`;
  }).join('');
 };
 window.forjaAgenda2HistoricalMonth=(uid,day)=>(state.role==='admin'?state.v629SecretaryFilters:state.v624Filters)?.busy!==false&&displaySources(uid,day).some(x=>x.historical);
 window.forjaAgenda2LessonOrigin=(uid,day,start,end)=>{
  const r=row(uid,day);return sourceCurrent(r,'native')?[...new Set(occupiedSources(r,day).filter(x=>minutes(x.start)<minutes(end)&&minutes(x.end)>minutes(start)).map(x=>x.label))].join(' · '):'';
 };
 window.forjaAgenda2DecorateLesson=button=>{
  const parent=button.closest('.v621-lane,.v621-month-cell'),day=parent?.dataset.date||parent?.dataset.v629Day||parent?.dataset.v625MonthDay||parent?.dataset.v629MonthDay;
  for(const uid of context?.ids||[]){const l=window.forjaAgenda2Lessons(uid,day)?.find(x=>x.id===button.dataset.lesson);if(!l)continue;
   if(/cancel/i.test(l.status||'')){button.classList.add('cancelled');button.textContent=(l.forja2NativeHistorical?'Histórico · ':'')+'Cancelada · '+[l.horaAula,l.horaFim].filter(Boolean).join('–')+' · '+(l.nomeAluno||'Aula FORJA');button.title=button.textContent+' · '+(l.forja2NativeHistorical?nativeHistoryLabel:'Não ocupa o horário');button.setAttribute('aria-label',button.title);return;}
   button.classList.add(...window.forjaAgenda2LessonClass(l).split(' '));button.dataset.forja2Modality=window.forjaAgenda2Modality(l).kind;
   if(!button.classList.contains('v621-block'))return;
   const origin=window.forjaAgenda2LessonOrigin(uid,day,l.horaAula,l.horaFim);if(!origin)return;
   button.querySelector('.forja2-lesson-origin')?.remove();const text='Também ocupado · '+origin;button.title=button.textContent.trim()+' · '+text;
   return; // The source stays in the accessible description, without a duplicate row.
  }
 };
 window.forjaAgenda2Cancelled=(uid,day,name='')=>(window.forjaAgenda2Lessons(uid,day)||[]).filter(l=>/cancel/i.test(l.status||'')).map(l=>{
  const caption=[name,l.forja2NativeHistorical?'Histórico · Cancelada':'Cancelada',[l.horaAula,l.horaFim].filter(Boolean).join('–'),l.nomeAluno||'Aula FORJA'].filter(Boolean).join(' · '),label=caption+' · '+(l.forja2NativeHistorical?nativeHistoryLabel:'Não ocupa o horário');
  return `<button type="button" class="forja2-cancelled ${l.forja2NativeHistorical?'forja2-native-history':''}" data-lesson="${escape(l.id)}" aria-label="${escape(label)}" title="${escape(label)}">${escape(caption)}</button>`;
 }).join('');
 window.forjaAgenda2LessonCounts=(uid,day)=>{const all=window.forjaAgenda2Lessons(uid,day)||[],cancelled=all.filter(l=>/cancel/i.test(l.status||'')).length;return {active:all.length-cancelled,cancelled};};
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
  if(calendar)calendar.style.setProperty('--forja2-lane-min',Math.max(144,(orderedIds?.length||1)*144)+'px');
  // Move the existing control node (and its handlers) beside the calendar's
  // filters, once per render. Do not recreate an edited select on each poll.
  const entry=document.getElementById('forjaFixedEntry'),target=document.querySelector(state.role==='admin'?'.v629-sidebar .forja2-filter-content':'.forja2-teacher-filters .forja2-filter-content');
  if(entry&&target&&entry.parentElement!==target)target.append(entry);
  const diagnostics=document.querySelector('[data-personal-google-status]'),googleActions=document.querySelector('.v622-topbar .v622-sync');
  if(diagnostics&&googleActions&&!googleActions.contains(diagnostics))googleActions.append(diagnostics);
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
    const lessons=window.forjaAgenda2Lessons(uid,day)||[],cards=[...lane.querySelectorAll('button[data-lesson]')].flatMap(button=>{
     const l=lessons.find(x=>x.id===button.dataset.lesson);if(!l)return [];
     const text=[l.nomeAluno||'Aluno',typeof lessonTitle==='function'?lessonTitle(l):'Aula FORJA',[l.horaAula,l.horaFim].filter(Boolean).join('–'),window.forjaAgenda2Modality(l).label,l.localAula||'',l.nomeProfessor||state.users?.find(x=>x.uid===uid)?.fullName||'Professor'].filter(Boolean).join(' · '),origin=window.forjaAgenda2LessonOrigin(uid,day,l.horaAula,l.horaFim);
     button.title=text+(origin?' · Também ocupado · '+origin:'')+(l.forja2NativeHistorical?' · '+nativeHistoryLabel:'');button.setAttribute('aria-label',button.title);
     // Keep the native renderer's legacy layout if its cached duration is
     // incomplete. Only a valid snapshot can confirm the complete interval.
     return timeValid(l.horaAula)&&timeValid(l.horaFim)?[{button,start:minutes(l.horaAula),end:minutes(l.horaFim)}]:[];
    });
    if(!sourceCurrent(row(uid,day),'native'))for(const button of lane.querySelectorAll('.forja2-busy:not(.forja2-historical)'))if(button.dataset.forja2Professional===uid)cards.push({button,start:minutes(button.dataset.forja2Start),end:minutes(button.dataset.forja2End)});
    cards.sort((a,b)=>a.start-b.start||b.end-a.end||(a.button.dataset.lesson||a.button.dataset.forja2Key||'').localeCompare(b.button.dataset.lesson||b.button.dataset.forja2Key||''));
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
   const text=(tag.dataset.forja2MonthStatus||tag.dataset.forja2Summary?tag.getAttribute('aria-label'):tag.textContent.trim())+(tag.classList.contains('forja2-native-history')?' · '+nativeHistoryLabel:'');tag.title=text;tag.setAttribute('aria-label',text);
   tag.dataset.forja2Label=tag.classList.contains('lesson')?(tag.classList.contains('forja2-online')?'Online':tag.classList.contains('forja2-presencial')?'Presencial':'Aula'):tag.classList.contains('availability')?'Livre':tag.classList.contains('busy')?'Ocupado':tag.classList.contains('unknown')?'Verificar':tag.classList.contains('outside')?'Fora':tag.classList.contains('cancelled')?'Cancelada':'';
  }
 };
 window.forjaAgenda2MonthDensity=(root,admin)=>{
  for(const cell of root.querySelectorAll('.v621-month-cell')){
   for(const kind of ['availability','busy']){
    const tags=[...cell.querySelectorAll('.v621-month-tag.'+kind+',.v629-month-tag.'+kind)],total=context?.ids.length||1;if(!tags.length)continue;
    tags[0].dataset.forja2Compact=admin&&total>1?tags.length+'/'+total:kind==='availability'?'Livre':'Ocup.';
    tags[0].setAttribute('aria-label',tags.length+' de '+total+' profissional(is) '+(kind==='availability'?'com horários livres confirmados':'com ocupação confirmada')+' · '+tags.map(x=>x.textContent).join(' · '));tags[0].dataset.forja2Summary='1';for(const tag of tags.slice(1))tag.remove();
   }
   const lessons=[...cell.querySelectorAll('button[data-lesson]')],day=cell.dataset.v629MonthDay||cell.dataset.v625MonthDay;if(!day||lessons.length<=2)continue;
   const hidden=lessons.slice(2);for(const card of hidden)card.remove();
   const button=document.createElement('button');button.type='button';button.className='forja2-more-lessons';button.dataset.forja2Date=day;button.textContent='+'+hidden.length;button.setAttribute('aria-label',hidden.length+' aula(s) adicional(is). Ver todas as aulas de '+day);cell.querySelector('.v621-month-tags')?.append(button);
  }
 };
 window.forjaAgenda2Bands=(uid,day,style)=>{
  const r=row(uid,day),known=confirmedRow(r),native=sourceCurrent(r,'native'),published=native?(r?.days?.[day]||[]):[],occupied=native?cuts(r,day):[],points=new Set([420,1320]);
  for(const p of published)for(const t of [p.inicio,p.fim])points.add(Math.max(420,Math.min(1320,minutes(t))));
  for(const p of occupied)for(const t of [p.start,p.end])points.add(Math.max(420,Math.min(1320,minutes(t))));
  const bounds=[...points].sort((a,b)=>a-b);let html='';
  for(let i=0;i<bounds.length-1;i++){const a=bounds[i],b=bounds[i+1];if(b<=a)continue;const inside=published.some(p=>minutes(p.inicio)<=a&&minutes(p.fim)>=b),blocked=occupied.some(p=>minutes(p.start)<b&&minutes(p.end)>a),kind=blocked?'busy':!native?'unknown':inside?(known?'available':'unknown'):'outside';
   // Available/busy/lessons already have one native card with its official action.
   // Only unrepresented neutral/unknown intervals need a background band.
   if(kind==='busy'||kind==='available')continue;
   const label=kind==='unknown'?'Disponibilidade não confirmada':'Fora da publicação';html+=`<div class="forja2-band forja2-state ${kind}" style="${position(style,a,b)};--forja2-grid-offset:${(-((a-420)*96/60)).toFixed(1)}px" data-forja2-key="${escape(['state',uid,a,b,kind].join(':'))}" role="img" aria-label="${label} ${time(a)}–${time(b)}" title="${label}"></div>`;
  }
  return html;
 };
 window.forjaAgenda2DayKind=(uid,day)=>{
  const r=row(uid,day);if(!sourceCurrent(r,'native'))return 'unknown';const periods=r.days[day]||[],occupied=cuts(r,day);if(!periods.length)return occupied.length?'busy':'outside';if(!confirmedRow(r))return 'unknown';
  for(const p of periods){let parts=[[minutes(p.inicio),minutes(p.fim)]];for(const cut of occupied){const a=minutes(cut.start),b=minutes(cut.end);parts=parts.flatMap(([s,e])=>b<=s||a>=e?[[s,e]]:[...(a>s?[[s,a]]:[]),...(b<e?[[b,e]]:[])]);}if(parts.some(([s,e])=>e>s))return 'available';}return 'busy';
 };
 function paint(){window.forjaAgenda2Paint?.();for(const host of document.querySelectorAll('[data-forja2-status]')){
  const unavailable=!record||record.error||!record.value.complete||record.value.items.some(x=>!confirmedRow(x));
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
  const reasons=(record?.value.items||[]).flatMap(x=>[x.personal?.reason,x.central?.reason]);
  const quota=reasons.some(r=>['personal_rate_limit','central_rate_limit','institutional_rate_limit','institutional_concurrency'].includes(r));
  const institutionalIssue=reasons.includes('institutional_consent_required')?'Autorização institucional incompleta; a Secretaria precisa conferir a conexão central':reasons.includes('institutional_access_denied')?'Acesso ao calendário institucional recusado; a Secretaria precisa conferir as permissões':reasons.includes('institutional_configuration')?'Configuração da integração institucional indisponível; solicitar revisão administrativa':reasons.includes('institutional_authorization_invalid')?'Autorização institucional recusada; solicitar revisão da conexão pela Secretaria':'';
  if(institutionalIssue)details.push(institutionalIssue);
  const institutional=(record?.value.items||[]).some(x=>x.personal?.sourceMode==='institutional-events-v1');
  const phase=(failureReason||(quota?'Limite temporário na fonte Google; aguardando prazo de nova consulta':!record?'Carregamento inicial; horários ainda não confirmados':!timely()?'Dados vencidos; aguardando nova confirmação':!record.value.complete?'Fontes incompletas; horários não confirmados':''))+(!fresh()&&knownRows.size?' · Última informação conhecida nas ocupações; horários sem confirmação para agendar':'');
  host.classList.toggle('unavailable',!!unavailable);
  if(!host.querySelector('.forja2-status-main')){const main=document.createElement('strong'),sources=document.createElement('div'),info=document.createElement('span'),diagnostic=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');main.className='forja2-status-main';sources.className='forja2-source-status';info.className='forja2-status-message';diagnostic.className='forja2-diagnostic';summary.textContent='Fontes e diagnóstico';body.className='forja2-diagnostic-body';diagnostic.append(summary,body);host.replaceChildren(main,sources,info,diagnostic);}
  const timestamp=lastSuccess?new Date(lastSuccess).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—',prefix=flight?'Consultando…':unavailable?'Consulta incompleta ou vencida':'Consulta confirmada';
  const main=host.querySelector('.forja2-status-main'),mainText=prefix+' · última completa '+timestamp;if(main.textContent!==mainText)main.textContent=mainText;
  const items=record?.value.items||[],sourceStates=['native','personal','central'].map(source=>({source,label:source==='native'?'FORJA':source==='personal'?'Google pessoal':'Google central',known:items.length>0&&items.every(x=>sourceCurrent(x,source)),notRequired:source!=='native'&&items.length>0&&items.every(x=>x[source]?.status==='not_applicable')}));
  const pills=sourceStates.filter(x=>!x.notRequired).map(x=>'<span class="forja2-source-pill '+(x.known?'confirmed':'unavailable')+'">'+x.label+(x.known?' ✓':': pendente')+'</span>').join(''),sourceHost=host.querySelector('.forja2-source-status');if(sourceHost.innerHTML!==pills)sourceHost.innerHTML=pills;
  const message=(failureReason||institutionalIssue||(centralConsent?'Google central: autorização pendente.':consent?'Google pessoal: consentimento pendente.':quota?'Limite temporário na fonte Google; horários sem confirmação para agendar.':unavailable?'Fontes incompletas ou vencidas; horários sem confirmação para agendar.':streamStatus.includes('indisponível')?streamStatus:institutional?'Agenda institucional gerenciada pela Secretaria.':'Atualização automática ativa.'))+(document.querySelector('.forja2-historical,.forja2-native-history')?' Há ocupações em histórico, sem confirmação atual.':'');
  const info=host.querySelector('.forja2-status-message');if(info.textContent!==message)info.textContent=message;
  const diagnostic=(phase||'Todas as fontes necessárias confirmadas')+(details.length?' · '+details.join(' · '):'')+(institutional?' · Fonte Google institucional administrada pela Secretaria':'')+(streamStatus?' · '+streamStatus:'')+(lastSuccess?' · Última consulta completa: '+timestamp:' · Aguardando primeira consulta completa'),body=host.querySelector('.forja2-diagnostic-body');if(body.textContent!==diagnostic)body.textContent=diagnostic;
  if(state.role==='teacher'){
   const controls=host.closest('.v622-topbar')?.querySelector('.v622-sync'),diagnostic=host.querySelector('.forja2-diagnostic'),refresh=controls?.querySelector('[data-forja2-refresh]');
   if(refresh){refresh.classList.add('forja2-refresh-inline');host.append(refresh);}
   if(controls&&!diagnostic.contains(controls))diagnostic.append(controls);
  }
 }}
 const timeValid=x=>typeof x==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x);
 function valid(value,c){
  if(value?.collectionStartedAt!==undefined&&(!Number.isFinite(Date.parse(value.collectionStartedAt))||Date.parse(value.collectionStartedAt)>Date.parse(value.servedAt)))return false;
  if(value?.refreshMode!==undefined&&(value.refreshMode!=='events'||value.complete!==true||!Number.isFinite(Date.parse(value.sourceExpiresAt))||Date.parse(value.sourceExpiresAt)<=Date.parse(value.servedAt)||Date.parse(value.sourceExpiresAt)-Date.parse(value.servedAt)>INSTITUTIONAL_MAX_AGE||!value.items?.every(x=>x.personal?.sourceMode==='institutional-events-v1'&&x.personal?.status==='not_applicable')))return false;
  if(value?.policy!==POLICY||value.from!==c.from||value.to!==c.to||!Array.isArray(value.professionalIds)||JSON.stringify([...value.professionalIds].sort())!==JSON.stringify([...c.ids].sort())||!Array.isArray(value.items)||value.items.length!==c.ids.length||new Set(value.items.map(x=>x.professionalId)).size!==c.ids.length||typeof value.complete!=='boolean'||![value.checkedAt,value.expiresAt,value.servedAt].every(x=>Number.isFinite(Date.parse(x)))||Date.parse(value.expiresAt)-Date.parse(value.checkedAt)!==MAX_AGE||Date.parse(value.expiresAt)<=Date.parse(value.servedAt))return false;
  return value.complete===value.items.every(x=>x.status==='success')&&value.items.every(x=>{
   if(!c.ids.includes(x.professionalId)||!['success','unavailable'].includes(x.status)||!['success','unavailable'].includes(x.nativeStatus)||!['success','not_applicable','unavailable'].includes(x.personal?.status)||!['success','unavailable'].includes(x.central?.status)||x.status==='success'&&(x.nativeStatus!=='success'||x.personal.status==='unavailable'||x.central.status==='unavailable')||!x.days||typeof x.days!=='object'||!Array.isArray(x.lessons)||!Array.isArray(x.blocks)||!Array.isArray(x.school)||!Array.isArray(x.busy))return false;
   for(let d=c.from;d<=c.to;d=gAddDays(d,1))if(x.nativeStatus==='success'&&(!Array.isArray(x.days[d])||x.days[d].some(p=>!timeValid(p.inicio)||!timeValid(p.fim)||p.fim<=p.inicio)))return false;
   return [x.personal.checkedAt,x.central.checkedAt].every(t=>t==null||Number.isFinite(Date.parse(t))&&Date.parse(t)<=Date.parse(value.servedAt))&&x.busy.every(b=>Number.isFinite(Date.parse(b.startAt))&&Date.parse(b.endAt)>Date.parse(b.startAt))&&x.blocks.every(b=>timeValid(b.horaInicio)&&timeValid(b.horaFim)&&b.horaFim>b.horaInicio)&&x.school.every(b=>timeValid(b.horaInicio)&&timeValid(b.horaFim)&&b.horaFim>b.horaInicio)&&x.lessons.every(l=>timeValid(l.horaAula)&&timeValid(l.horaFim)&&l.horaFim>l.horaAula);
  });
 }
 function accept(value,c,transferredTtl=null,transferredAge=null){
  if(!current(c)||!valid(value,c)||changeVersion&&value.changeVersion!==changeVersion)throw Error('AGENDA_RESULT_INVALID');
  // Deduct transport/Auth time as well as server-side source age. A transfer
  // between tabs carries the remaining lifetime, never a fresh full lifetime.
  const serviceTime=Number.isFinite(Date.parse(value.deliveryStartedAt))?Math.max(0,Date.parse(value.servedAt)-Date.parse(value.deliveryStartedAt)):0;
  const requestAge=transferredAge??(flight&&!flight.shared?Math.max(0,performance.now()-flight.startedAt-serviceTime):0);
  const eventDriven=value.refreshMode==='events',previousDeadline=record?.value.sourceExpiresAt;
  if(eventDriven&&(!streamSeenAt||Date.now()-streamSeenAt>=45000))throw Error('AGENDA_STREAM_UNAVAILABLE');
  const maxAge=eventDriven?INSTITUTIONAL_MAX_AGE:MAX_AGE,sourceTtl=eventDriven?Date.parse(value.sourceExpiresAt)-Date.parse(value.servedAt):Date.parse(value.expiresAt)-Date.parse(value.servedAt);
  const ttl=Math.min(maxAge,sourceTtl-requestAge,transferredTtl??maxAge);
  if(!Number.isFinite(ttl)||ttl<=0)throw Error('AGENDA_RESULT_EXPIRED');
  const sources=new Map(value.items.map(item=>[item.professionalId,Object.fromEntries(['native','personal','central'].map(source=>{
   const stamp=source==='native'?value.collectionStartedAt||value.checkedAt:item[source]?.checkedAt||value.collectionStartedAt||value.checkedAt;
   const explicit=source==='native'?NaN:Date.parse(item[source]?.expiresAt),remaining=eventDriven?(source==='central'?(Number.isFinite(explicit)?explicit:Date.parse(value.sourceExpiresAt)):Date.parse(value.collectionStartedAt||value.checkedAt)+INSTITUTIONAL_MAX_AGE)-Date.parse(value.servedAt):Number.isFinite(explicit)?Math.min(MAX_AGE,explicit-Date.parse(value.servedAt)):Date.parse(stamp)+MAX_AGE-Date.parse(value.servedAt),life=Math.max(0,Math.min(maxAge,remaining,transferredTtl!==null&&transferredAge===null?transferredTtl:maxAge)-requestAge);
   return [source,{expires:performance.now()+life,wallExpires:Date.now()+life}];
  }))]));
  observedLatency=Math.max(flight&&!flight.shared?performance.now()-flight.startedAt:serviceTime+requestAge,observedLatency*.8);
  clearTimeout(changeTimer);changeTimer=null;
  awaitingStream=false;accessDenied=false;remember(value);record={key:c.key,value,sources,transportAge:requestAge,expires:performance.now()+ttl,wallExpires:Date.now()+ttl,error:false,revoked:false,leaseLost:false};failureReason=null;
  for(const item of value.items)if(typeof item.personal.connected==='boolean'){
   const metadata={connected:item.personal.connected,lastSyncAt:(item.personal.sourceMode==='institutional-events-v1'?item.central.checkedAt:item.personal.lastSyncAt)||null,...(item.personal.sourceMode?{sourceMode:item.personal.sourceMode,managedBySecretaria:true}:{})};
   if(state.role==='admin'){const old=(state.googleConnections||[]).find(x=>x.uid===item.professionalId)||{};state.googleConnections=[...(state.googleConnections||[]).filter(x=>x.uid!==item.professionalId),{...old,uid:item.professionalId,...metadata}];}
   else state.googleCalendar={...state.googleCalendar,item:{...state.googleCalendar?.item,...metadata}};
  }
  if(value.complete){lastSuccess=value.checkedAt;failures=0;retryUntil=0;}else failures++;
  const retry=Math.min(86400000,Math.max(0,Number(value.retryAfterMs)||0));record.sourceRetryAt=retry?performance.now()+retry:0;
  // Source cache age shortens the next deadline; it never grants another 25s.
  // Native writes arrive independently through the authenticated change stream.
  // Read before expiry, including institutional projections. If the server has
  // not renewed that projection yet, wait for its existing deadline, not a loop
  // of one-second reads. No deadline is extended by this scheduling decision.
  const lead=Math.min(MAX_AGE-15000,Math.max(SOURCE_LEAD,observedLatency+2000)),unchanged=eventDriven&&previousDeadline===value.sourceExpiresAt&&ttl<=lead,normal=Math.max(1000,unchanged?ttl:ttl-lead),healthy=value.items.some(x=>x.nativeStatus==='success'||x.personal.status==='success'||x.central.status==='success');
  nextAt=Math.max(retryUntil,performance.now()+(value.complete?normal:healthy?Math.min(BACKOFF_BASE,retry||BACKOFF_BASE):retry||Math.min(120000,BACKOFF_BASE*2**Math.min(failures,3))));}
 function connectChannel(c){
  if(typeof BroadcastChannel!=='function')return;
  // Different UIDs, generations, roles and periods do not receive this payload.
  channel=new BroadcastChannel('forja-agenda-readonly-v1:'+c.key);
  channel.addEventListener('message',event=>{const m=event.data,age=Date.now()-m?.sentAt;if(m?.key!==c.key||!current(c)||!(age>=0&&age<(m?.value?.refreshMode==='events'?INSTITUTIONAL_MAX_AGE:MAX_AGE)))return;
   if(m.kind==='changes'){noteStream();handleChange(c,m.event);return;}
   if(m.kind==='cooldown'&&Number.isFinite(m.wait)&&m.wait>age){retryUntil=Math.max(retryUntil,performance.now()+Math.min(86400000,m.wait-age));nextAt=Math.max(nextAt,retryUntil);failureReason='Limite temporário de consultas; nova tentativa automática';if(record)record.error=true;paint();schedule();return;}
   if(m.kind==='snapshot'&&!accessDenied&&performance.now()>=retryUntil&&!localDirty&&!flight&&Number.isFinite(m.ttlMs)&&m.ttlMs>0){try{accept(m.value,c,m.ttlMs-age,Number.isFinite(m.elapsedMs)&&m.elapsedMs>=0?m.elapsedMs+age:null);paint();schedule();}catch{}}
  });
 }
 const queryFor=c=>{const query=new URLSearchParams({from:c.from,to:c.to});for(const id of c.ids)query.append('professionalId',id);return query;};
 function changed(c,sources=null,refreshOnly=false){
  if(!current(c))return;revision++;if(!refreshOnly){if(record){record.error=true;if(Array.isArray(sources)&&sources.length&&sources.every(x=>['native','personal','central'].includes(x))){record.invalidSources||=new Set();for(const source of sources)record.invalidSources.add(source);}else record.revoked=true;}failureReason='Alteração detectada; confirmando horários';}paint();
  clearTimeout(changeTimer);changeTimer=setTimeout(()=>{if(!current(c))return;nextAt=Math.max(retryUntil,performance.now());schedule();},250);
 }
 function handleChange(c,event){
  if(!current(c))return;
  const versioned=typeof event.version==='string'&&/^[a-f0-9]{64}$/.test(event.version),previous=changeVersion??record?.value.changeVersion;
  if(versioned)changeVersion=event.version;
  if(['ready','heartbeat'].includes(event.kind)){if(awaitingStream&&!flight){awaitingStream=false;nextAt=Math.max(retryUntil,performance.now());schedule();}streamStatus='Alterações FORJA acompanhadas';
   // A handshake is not a mutation. Revoke only on a different/unknown version,
   // never extend either original source deadline or revive an invalid record.
   if(record&&(!versioned||previous!==event.version))changed(c);
   else if((!record||record.error)&&!flight){nextAt=Math.max(retryUntil,performance.now());schedule();}
   if(event.kind==='ready')paint();
  }
  else if(event.kind==='changed')changed(c,event.sources,event.refreshOnly===true&&Array.isArray(event.sources)&&event.sources.length===1&&event.sources[0]==='central');
  else if(event.kind==='unauthorized'){revision++;denyAccess();failureReason='Consulta sem autorização; conferir acesso da conta';paint();}
  else if(event.kind==='unavailable'){streamStatus='Acompanhamento de alterações indisponível; recuperando consulta';if(record?.value.refreshMode==='events'){record.error=true;failureReason='Acompanhamento interrompido; horários não confirmados';paint();}}
 }
 function startChanges(c){
  clearTimeout(streamTimer);streamTimer=null;if(stream||!current(c)||!c.ids.length||c.ids.length>50||navigator.onLine===false)return;
  const connection={controller:new AbortController(),last:Date.now(),attempted:false};stream=connection;
  const run=async()=>{
   connection.attempted=true;
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
     while((boundary=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);if(!frame.startsWith('data: '))continue;const event=JSON.parse(frame.slice(6));if(!['ready','changed','heartbeat','unavailable','unauthorized','reconnect'].includes(event.kind))throw Error('AGENDA_STREAM_INVALID');connection.last=Date.now();noteStream();streamFailures=0;handleChange(c,event);channel?.postMessage({kind:'changes',key:c.key,event,sentAt:Date.now()});if(['reconnect','unauthorized','unavailable'].includes(event.kind))return;}
     }}finally{clearInterval(watchdog);await reader.cancel().catch(()=>{});reader.releaseLock();}
     // An unexpected EOF is also a transport failure. Explicit reconnect frames
     // return above; they do not pass through this fail-closed path.
     if(current(c)){handleChange(c,{kind:'unavailable'});channel?.postMessage({kind:'changes',key:c.key,event:{kind:'unavailable'},sentAt:Date.now()});}
   }catch{if(current(c)){handleChange(c,{kind:'unavailable'});channel?.postMessage({kind:'changes',key:c.key,event:{kind:'unavailable'},sentAt:Date.now()});}}
   finally{clearTimeout(deadline);forjaSessionRequests.delete(connection.controller);}
  };
  void(async()=>{try{if(navigator.locks)await navigator.locks.request('forja-agenda-events:'+c.key,{ifAvailable:true},async lock=>{if(lock)await run();});else await run();}
   // A visible follower losing ifAvailable is healthy contention, not a failed
   // transport. Keep its election interval bounded; retain backoff/Retry-After
   // only for the tab that actually owned the lock and attempted the stream.
   finally{if(stream===connection){stream=null;if(current(c)){if(connection.attempted)streamFailures++;streamTimer=setTimeout(()=>startChanges(c),connection.attempted?Math.max(connection.retry||0,streamSeenAt&&Date.now()-streamSeenAt<30000?5000:Math.min(60000,2000*2**Math.min(streamFailures,5))):5000);}}}
  })();
 }
 function schedule(){
  clearTimeout(timer);if(!context||!current(context))return;
  const now=performance.now(),expiry=record&&!record.error&&record.expires>now?record.expires:Infinity,sourceExpiry=Math.min(Infinity,...[...(record?.sources?.values()||[])].flatMap(x=>Object.values(x)).map(x=>Math.min(x.expires,now+x.wallExpires-Date.now())).filter(x=>x>now)),liveness=record?.value.refreshMode==='events'&&!record.leaseLost&&streamSeenAt&&Date.now()-streamSeenAt<45000?now+45000-(Date.now()-streamSeenAt):Infinity,due=Math.min(flight?Infinity:nextAt,expiry,sourceExpiry,liveness);
  // Keep the original expiry armed during renewal. Do not spin or launch a
  // second GET while the existing request owns the refresh slot.
  if(!Number.isFinite(due))return;
  timer=setTimeout(()=>{if(record?.value.refreshMode==='events'&&Date.now()-streamSeenAt>=45000){record.error=true;record.leaseLost=true;nextAt=navigator.onLine===false?Infinity:Math.max(retryUntil,performance.now());}paint();if(!flight&&performance.now()>=nextAt)void refresh();else schedule();},Math.max(20,due-now));
 }
 async function collect(c,request){
  const query=queryFor(c);
  let aborted;const cancel=new Promise((_,reject)=>{aborted=()=>reject(Error('AGENDA_ABORTED'));request.controller.signal.addEventListener('abort',aborted,{once:true});});
  let value;try{value=await Promise.race([api('/agenda/snapshot?'+query,{session:c.scope,signal:request.controller.signal}),cancel]);}finally{request.controller.signal.removeEventListener('abort',aborted);}
  if(flight!==request||!current(c))return;if(request.revision!==revision){nextAt=Math.max(retryUntil,performance.now()+250);return false;}accept(value,c);localDirty=false;channel?.postMessage({kind:'snapshot',key:c.key,value,ttlMs:record.expires-performance.now(),elapsedMs:record.transportAge,sentAt:Date.now()});return value.complete;
 }
 async function refresh({manual=false}={}){
  lifecycle(false);const c=context;if(!c||!current(c)||!c.ids.length||c.ids.length>50||navigator.onLine===false)return false;if(flight)return flight.promise;if(performance.now()<retryUntil){nextAt=retryUntil;schedule();return false;}
  const request={controller:new AbortController(),promise:null,shared:false,startedAt:performance.now(),revision},id=++sequence;flight=request;paint();schedule();
  const deadline=setTimeout(()=>request.controller.abort(),15000);
  request.promise=(async()=>{try{
    let result;
    if(navigator.locks){await navigator.locks.request('forja-agenda:'+c.key,{ifAvailable:true},async lock=>{if(!lock){request.shared=true;nextAt=performance.now()+1000;return;}result=await collect(c,request);});}else result=await collect(c,request);
    if(manual&&current(c))toast(result===true?'Consulta da Agenda confirmada.':'Consulta ainda não confirmada por todas as fontes.',result===true?'ok':'warn');return result===true;
   }catch(e){if(id===sequence&&current(c)){failures++;if([401,403].includes(e.status))denyAccess();awaitingStream=e.message==='AGENDA_STREAM_UNAVAILABLE';if(record)record.error=true;const changedDuringRead=e.status===409&&e.code==='AGENDA_QUERY_CHANGED';failureReason=changedDuringRead?'Alteração detectada durante a consulta; confirmando horários':[401,403].includes(e.status)?'Consulta sem autorização; conferir acesso da conta':e.status===429?'Limite temporário de consultas; nova tentativa automática':request.controller.signal.aborted?'Tempo de consulta esgotado; nova tentativa automática':e.message==='AGENDA_RESULT_EXPIRED'?'Dados recebidos vencidos; aguardando nova confirmação':e.message==='AGENDA_RESULT_INVALID'?'Resposta inválida; horários não confirmados':'Falha de rede ou serviço; horários não confirmados';const wait=e.status===429&&e.retryAfterMs>0?e.retryAfterMs:changedDuringRead||e.message==='AGENDA_RESULT_EXPIRED'?1000:Math.min(120000,BACKOFF_BASE*2**Math.min(failures,3));nextAt=performance.now()+wait;if(e.status===429){retryUntil=nextAt;channel?.postMessage({kind:'cooldown',key:c.key,wait,sentAt:Date.now()});}if(manual)toast('Não foi possível confirmar a atualização da Agenda.','warn');}return false;}
   finally{clearTimeout(deadline);if(flight===request){flight=null;if(current(c)){paint();schedule();}}}
  })();return request.promise;
 }
 // Pause transport, never renew or extend the retained snapshot's expiry.
 function pause(){if(record?.value.refreshMode==='events')record.error=true;sequence++;clearTimeout(timer);clearTimeout(changeTimer);clearTimeout(streamTimer);streamTimer=null;stream?.controller.abort();stream=null;flight?.controller.abort();channel?.close();channel=null;flight=null;}
 function reset(){pause();context=null;record=null;knownRows.clear();accessDenied=false;lastSuccess=null;failureReason=null;failures=0;nextAt=0;retryUntil=0;revision=0;streamSeenAt=0;streamFailures=0;streamStatus='';changeVersion=null;localDirty=false;awaitingStream=false;observedLatency=0;}
 function lifecycle(start=true){const c=capture(!document.hidden);if(!c){if(context)reset();return;}if(document.hidden){if(context?.key!==c.key)reset();else pause();return;}if(context?.key!==c.key){reset();context=c;connectChannel(c);nextAt=performance.now();paint();}else if(start){if(!channel)connectChannel(c);paint();}if(start){if(!stream&&!streamTimer)startChanges(c);if(!flight&&performance.now()>=nextAt)void refresh();}}
 window.forjaAgenda2Refresh=refresh;
 window.forjaAgenda2Mutation=(path,result)=>{if(!/^\/(?:aulas|aulas-recorrentes|indisponibilidades|disponibilidade|calendario-escolar|google\/calendar|admin\/google-calendar)/.test(path))return;
  // api() invokes this only after a successful response and its session fence.
  // Keep canonical write receipts in the EXISTING display-only history, never
  // in source proofs. A fresh native snapshot still replaces this entire set.
  if(current(context)&&!accessDenied&&/^\/aulas(?:\/|$|-recorrentes(?:\/|$))/.test(path))for(const lesson of [result?.item,...(Array.isArray(result?.items)?result.items:[])]){
   if(!lesson||typeof lesson.id!=='string'||!context.ids.includes(lesson.professorId)||!/^\d{4}-\d{2}-\d{2}$/.test(lesson.dataAula||'')||!timeValid(lesson.horaAula)||!timeValid(lesson.horaFim)||lesson.horaFim<=lesson.horaAula)continue;
   const old=knownRows.get(lesson.professorId)||{};knownRows.set(lesson.professorId,{...old,lessons:[...(old.lessons??accountLessons(lesson.professorId)).filter(x=>x.id!==lesson.id),{...lesson}]});
  }
  if(context){localDirty=true;changed(context);}else lifecycle();};
 const previousBind=bindPage;bindPage=function(){previousBind();window.forjaAgenda2ProfilePolish();lifecycle();};
 const previousNavigate=navigate;navigate=function(...args){const result=previousNavigate(...args);lifecycle();return result;};
 const previousSession=forjaChangeSession;forjaChangeSession=function(...args){reset();return previousSession(...args);};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)nextAt=performance.now();lifecycle();});
 window.addEventListener('offline',()=>{pause();if(record)record.error=true;nextAt=Infinity;failureReason='Sem conexão; horários não confirmados';paint();schedule();});
 window.addEventListener('online',()=>{nextAt=Math.max(retryUntil,performance.now());lifecycle();if(context)startChanges(context);});
 window.addEventListener('beforeunload',()=>{reset();channel?.close();},{once:true});
})();
