// Reversible migration over the exact audited main. Never publish this script.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
let html=execFileSync('git',['show','86134148337c4dfa9d9979cee734d5bb48a2cd30:index.html'],{encoding:'utf8',maxBuffer:4*1024*1024});
const baseline=createHash('sha256').update(html).digest('hex'),changes=[];
// Regeneration refuses manual edits outside the recorded, reversible migration.
const current=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
if(current.includes('<script id="forja-agenda2-script">')){const {withoutAgendaIntelligence}=await import('./agenda-intelligence-scope.mjs');assert.equal(withoutAgendaIntelligence(current),html);}else assert.equal(current,html);
function replace(before,after){const positions=[];let at=0;while((at=html.indexOf(before,at))>=0){positions.push(at);at+=before.length;}assert.equal(positions.length,1,'Unique migration boundary: '+before.slice(0,80));changes.push({before,after,positions});html=html.replace(before,()=>after);}
replace('e.status=response.status;e.code=data.code;',`e.status=response.status;e.code=data.code;if(path.startsWith('/agenda/')){const raw=response.headers.get('Retry-After'),seconds=raw===null?NaN:Number(raw),wait=Number.isFinite(seconds)?seconds*1000:Date.parse(raw)-Date.now();e.retryAfterMs=Number.isFinite(wait)&&wait>0?Math.min(86400000,wait):0;}`);
replace("  function v621AvailabilityForDay(role,uid,day){","  function v621AvailabilityForDay(role,uid,day){\n    if(window.forjaAgenda2Periods)return window.forjaAgenda2Periods(uid,day);");
replace("  function v621GoogleBusy(uid,day){","  function v621GoogleBusy(uid,day){\n    const current=window.forjaAgenda2Google?.(uid,day);if(current)return current;");
replace("function v621Lessons(uid,day){return (state.lessons||[])","function v621Lessons(uid,day){return window.forjaAgenda2Lessons?.(uid,day)||(state.lessons||[])");
replace("  function v623ManualBusy(uid,day){","  function v623ManualBusy(uid,day){\n    const current=window.forjaAgenda2Blocks?.(uid,day);if(current)return current;");
replace("  async function v621EnsureVisibleWeeks(role){","  async function v621EnsureVisibleWeeks(role){\n    if(window.forjaAgenda2Enabled)return window.forjaAgenda2Refresh();");
replace("googleBusy=v621GoogleBusy(uid,day).filter(x=>!x.allDay),manualBusy=", "googleBusy=v621GoogleBusy(uid,day),manualBusy=");
replace("availability=v623CutAvailability(rawAvailability,[...googleBusy,...manualBusy,...lessonCuts]);let html='';","availability=v623CutAvailability(rawAvailability,[...googleBusy,...manualBusy,...lessonCuts,...(window.forjaAgenda2School?.(uid,day)||[])]);let html=(window.forjaAgenda2Bands?.(uid,day,v621EventStyle)||'')+(window.forjaAgenda2BusyCards?.(uid,day,v621EventStyle,role,filters)||'');");
replace("cuts=[...googleBusy.filter(x=>!x.allDay),...manualBusy,...lessons.filter", "cuts=[...googleBusy,...manualBusy,...(window.forjaAgenda2School?.(uid,day)||[]),...lessons.filter");
replace("const raw=v631CentralKnown(uid,day)?v621AvailabilityForDay('admin',uid,day):[]", "const raw=window.forjaAgenda2Enabled?v621AvailabilityForDay('admin',uid,day):v631CentralKnown(uid,day)?v621AvailabilityForDay('admin',uid,day):[]");
replace("availability=v623CutAvailability(raw,[...google,...manual,...lessonCuts]);", "school=window.forjaAgenda2School?.(uid,day)||[],availability=v623CutAvailability(raw,[...google,...manual,...lessonCuts,...school]);");
replace("return {availability,google,googleTimed,manual,lessons};", "return {availability,google,googleTimed,manual,lessons,school};");
replace("const uid=teacher.uid,name=teacher.fullName||'Professor',data=v629DayData(uid,day);", "const uid=teacher.uid,name=teacher.fullName||'Professor',data=v629DayData(uid,day);html+=(window.forjaAgenda2Bands?.(uid,day,(a,b)=>v629SlotStyle(a,b,index,count))||'')+(window.forjaAgenda2BusyCards?.(uid,day,(a,b)=>v629SlotStyle(a,b,index,count),'admin',filters,name)||'');");
for(const source of ['googleBusy','manualBusy','data.googleTimed','data.manual'])replace(`if(filters.busy!==false)for(const b of ${source})`,`if(!window.forjaAgenda2Enabled&&filters.busy!==false)for(const b of ${source})`);
replace('height=Math.max(24,(Math.max(a+20,b)-a)*unit)','height=Math.max(0,(b-a)*unit)');
replace("busy=[...googleBusy,...manualBusy],tags=[];","busy=[...googleBusy,...manualBusy,...(window.forjaAgenda2School?.(uid,day)||[])],tags=[];");
replace("'Google ⇄ FORJA conectado'","'Google pessoal conectado'");
replace('<span class="v623-two-way">2 vias · auto 5 min</span>','');
replace('<b>Google ⇄ FORJA dos professores</b>','<b>Consulta da agenda</b>');
replace('await api(`/aulas/${id}`,{method:"PATCH",body});toast("Aula reagendada e sincronizada.","ok");','const result=await api(`/aulas/${id}`,{method:"PATCH",body});window.forjaAgenda2RescheduleFeedback(result);');
replace("function v621AllDay(uid,day){const items=","function v621AllDay(uid,day){if(window.forjaAgenda2Cancelled)return state.v624Filters?.lesson===false?'':window.forjaAgenda2Cancelled(uid,day);const items=");
replace("  function v629AllDay(day){","  function v629AllDay(day){\n    if(window.forjaAgenda2Cancelled)return state.v629SecretaryFilters?.lesson===false?'':v629SelectedTeachers().map(t=>window.forjaAgenda2Cancelled(t.uid,day,t.fullName||'Professor')).join('');");
replace('<div class="v621-all-day-cell">${v621AllDay(uid,day)}</div>','<div class="v621-all-day-cell" data-forja2-day="${esc(day)}">${v621AllDay(uid,day)}</div>');
replace('<div class="v621-all-day-cell">${v629AllDay(day)}</div>','<div class="v621-all-day-cell" data-forja2-day="${esc(day)}">${v629AllDay(day)}</div>');
replace("if(filters.lesson!==false)for(const l of lessons){const end=","if(filters.lesson!==false)for(const l of lessons){if(window.forjaAgenda2Enabled&&/cancel/i.test(l.status||''))continue;const end=");
replace("if(filters.lesson!==false)for(const l of data.lessons){const end=","if(filters.lesson!==false)for(const l of data.lessons){if(window.forjaAgenda2Enabled&&/cancel/i.test(l.status||''))continue;const end=");
replace("busy+=d.google.length+d.manual.length;lessons+=d.lessons.length", "busy+=d.google.length+d.manual.length+(d.school?.length||0);lessons+=d.lessons.length");
replace("const busy=data.google.length+data.manual.length;", "const busy=data.google.length+data.manual.length+(data.school?.length||0);");
replace('${name} · Ocupado (${busy})','${name} · Ocupado');
replace('Ocupado · ${busy.length}','Ocupado');
replace("  async function v627AutoSyncTeacherAgenda(){", "  async function v627AutoSyncTeacherAgenda(){\n    if(window.forjaAgenda2Enabled)return;");
replace("  async function v629RefreshSecretaryAgenda({syncGoogle=true,render=true}={}){", "  async function v629RefreshSecretaryAgenda({syncGoogle=true,render=true}={}){\n    if(window.forjaAgenda2Enabled)return window.forjaAgenda2Refresh({manual:true});");
replace("await v629RefreshSecretaryAgenda({syncGoogle:true,render:true});toast('Disponibilidade e Google atualizados.','ok')", "if(window.forjaAgenda2Enabled)await window.forjaAgenda2Refresh({manual:true});else{await v629RefreshSecretaryAgenda({syncGoogle:true,render:true});toast('Disponibilidade e Google atualizados.','ok')}");
replace("{v629Bind();const session=forjaCaptureSession()", "{v629Bind();if(window.forjaAgenda2Enabled)return;const session=forjaCaptureSession()");
replace("${v629SelectedTeachers().some(t=>!v631CentralKnown(t.uid,v621Date('admin')))?", "${!window.forjaAgenda2Enabled&&v629SelectedTeachers().some(t=>!v631CentralKnown(t.uid,v621Date('admin')))?");
replace("return state.role==='admin'&&state.googleBusyUnavailable?", "return !window.forjaAgenda2Enabled&&state.role==='admin'&&state.googleBusyUnavailable?");
replace("if(document.hidden||state.role!=='admin'||state.page!=='agenda')return;if(Date.now()-v629TimerLast", "if(window.forjaAgenda2Enabled||document.hidden||state.role!=='admin'||state.page!=='agenda')return;if(Date.now()-v629TimerLast");
replace("if(!document.hidden&&state.role==='admin'&&state.page==='agenda'&&Date.now()-v629TimerLast", "if(!window.forjaAgenda2Enabled&&!document.hidden&&state.role==='admin'&&state.page==='agenda'&&Date.now()-v629TimerLast");
replace("    if([\"POST\",\"PATCH\",\"DELETE\"].includes(method)&&typeof forjaAdminMutationCommitted", "    if([\"POST\",\"PATCH\",\"DELETE\"].includes(method))window.forjaAgenda2Mutation?.(path);\n    if([\"POST\",\"PATCH\",\"DELETE\"].includes(method)&&typeof forjaAdminMutationCommitted");
// Reuse the official drawer binding after replacing lane buttons. The hook only
// assigns handlers; it never mounts or updates an open form.
const bookingSlotBinding="    $$('[data-v621-book-slot]').forEach(b=>{b.onclick=e=>{e.preventDefault();e.stopPropagation();v630Open({teacherId:b.dataset.v621BookSlot,date:b.dataset.date,start:b.dataset.start,duration:Number(b.dataset.duration||60)})}});";
replace(bookingSlotBinding,"    v630BindAgendaSlots();");
replace("  function v630Mount(){",`  function v630BindAgendaSlots(){
    if(state.role!=='admin'||state.page!=='agenda')return;
${bookingSlotBinding}
  }
  window.forjaAgenda2BindBooking=v630BindAgendaSlots;
  function v630Mount(){`);
// Agenda-only detail lifecycle: the canonical GET supplies actions on newly
// polled lessons; a closed/replaced dialog or changed session cannot reopen it.
replace('async function openLesson(id){\n  modal("Aula",loading("Carregando aula..."));',`async function openLesson(id){
  const agendaScope=state.page==='agenda'&&['admin','teacher'].includes(state.role)?{...forjaCaptureSession(),role:state.role}:null;
  modal("Aula",loading("Carregando aula..."));
  const agendaReturnFocus=lastModalFocus;
  const agendaDialog=document.querySelector('#modal .modal');
  const agendaCurrent=()=>!agendaScope||(forjaSessionCurrent(agendaScope)&&state.page==='agenda'&&state.role===agendaScope.role&&document.querySelector('#modal .modal')===agendaDialog);`);
replace('    const l=a.item,history=h.items||[],materials=m.items||[];let actions="";',`    if(!agendaCurrent())return;
    const l=a.item,history=h.items||[],materials=m.items||[];let actions="";
    if(agendaScope)state.lessons=[...(state.lessons||[]).filter(x=>x.id!==id),l];`);
replace('}catch(e){modal("Aula",empty("Não foi possível carregar",e.message))}', '}catch(e){if(agendaCurrent()){modal("Aula",empty("Não foi possível carregar",e.message));if(agendaScope)lastModalFocus=agendaReturnFocus;}}');
replace('    modal("Central da Aula",body);bindModalActions();', '    modal("Central da Aula",body);if(agendaScope)lastModalFocus=agendaReturnFocus;bindModalActions();return agendaScope?document.querySelector("#modal .modal"):undefined;');
// The existing P1/P2/v616 decorators await the canonical detail. Carry its DOM
// owner through that same chain; never decorate a superseding dialog.
for(const previous of ['openLessonP1','openLessonP2A']){
 const start=html.indexOf('openLesson=async function(id){await '+previous+'(id);'),end=html.indexOf('\n',start),body=html.slice(start,end);assert.ok(start>0&&end>start);
 const updated=body.replace('await '+previous+'(id);','const agendaScope=window.forjaAgenda2DetailScope?.(),agendaDialog=await '+previous+'(id);if(agendaScope&&!window.forjaAgenda2DetailCurrent(agendaDialog,agendaScope))return;').replace(/\};?$/,';return agendaDialog;};');
 assert.notEqual(updated,body);replace(body,updated);
}
replace('  await openLessonBeforeV616(id);','  const agendaScope=window.forjaAgenda2DetailScope?.(),agendaDialog=await openLessonBeforeV616(id);\n  if(agendaScope&&!window.forjaAgenda2DetailCurrent(agendaDialog,agendaScope))return;');
replace('const fresh=await api(`/aulas/${encodeURIComponent(id)}`),l=fresh.item||{},s=gStatusMeta(l)', 'const fresh=await api(`/aulas/${encodeURIComponent(id)}`);if(agendaScope&&!window.forjaAgenda2DetailCurrent(agendaDialog,agendaScope))return;const l=fresh.item||{},s=gStatusMeta(l)');
replace('esc(l.duracaoMinutos+" min"):"—"}', 'esc(l.duracaoMinutos+" min"):agendaScope?esc(window.forjaAgenda2PlannedDuration(l)):"—"}');
replace('const restore=lastModalFocus;lastModalFocus=null;', 'const restore=window.forjaAgenda2ReturnFocus?.(lastModalFocus)||lastModalFocus;lastModalFocus=null;');
replace("if(e.target.closest('.v621-month-tag'))return;", "if(e.target.closest('button[data-lesson]'))return;");
replace('Selecione um ou vários professores como no Google Calendar. Verde é horário disponível, vermelho é ocupado e azul é aula FORJA.', 'Selecione os professores e consulte aulas e horários. A legenda indica o estado de cada intervalo.');
// Keep all filters and the mini-calendar available, with a real collapsible
// control on narrow screens rather than pushing the calendar below the fold.
replace('return `<aside class="v629-sidebar">${v629MiniMonth()}', 'return `<aside class="v629-sidebar"><details class="forja2-filters" ${state.v629AgendaFiltersOpen??!matchMedia("(max-width:900px)").matches?"open":""}><summary>Professores, filtros e calendário</summary><div class="forja2-filter-content">${v629MiniMonth()}');
replace('já preenchidos.</div></aside>`;', 'já preenchidos.</div></div></details></aside>`;');
{
 const start=html.indexOf('  function v621CalendarSidebar(role,uid){'),end=html.indexOf('\n  function v621TeacherTopbar(',start),body=html.slice(start,end);
 assert.ok(start>0&&end>start);
 const updated=body.replace('${actions}${v621MiniMonth(role)}','${actions}<details class="forja2-filters forja2-teacher-filters" ${state.v625AgendaFiltersOpen??!matchMedia("(max-width:900px)").matches?"open":""}><summary>Filtros e calendário</summary><div class="forja2-filter-content">${v621MiniMonth(role)}').replace('</div></aside>`;','</div></div></details></aside>`;');
 assert.notEqual(updated,body);replace(body,updated);
}
replace('<b>Google ⇄ FORJA</b><br>O professor continua usando o Google Calendar.', '<b>Privacidade Google</b><br>A consulta automática verifica ocupações, sem escrever eventos.');
replace('    const search=$(\'#v629TeacherSearch\');', `    const details=document.querySelector('.forja2-filters');if(details&&!details.dataset.boundFine){details.dataset.boundFine='1';details.ontoggle=()=>{state.v629AgendaFiltersOpen=details.open};}
    const search=$('#v629TeacherSearch');`);
for(const name of ['v621MonthCalendar(role,uid)','v629MonthCalendar()']){
 const start=html.indexOf('  function '+name+'{'),end=html.indexOf('\n  function ',start+1),body=html.slice(start,end);
 const number='<div class="v621-month-num">${obj.getUTCDate()}</div>';
 assert.equal(body.split(number).length,2,'One day number per month renderer');
 replace(body,body.replace(number,'<button type="button" class="v621-month-num" data-forja2-date="${esc(day)}" aria-label="Ver dia ${esc(fmtDate(day))}">${obj.getUTCDate()}</button>'));
}
// Change the native renderers, recording every reversible boundary. One shared
// modality contract serves the existing calendars/lists; booking is unchanged.
function presentation(signature,transform){
 const start=html.indexOf('function '+signature+'{');assert.ok(start>0,signature);
 const indent=html.slice(html.lastIndexOf('\n',start)+1,start),end=html.indexOf('\n'+indent+'function ',start+1);assert.ok(end>start,signature);
 const before=html.slice(start,end),after=transform(before);assert.notEqual(after,before,signature);replace(before,after);
}
presentation('v621Lane(role,uid,day)',body=>body
 .replace('class="v621-block lesson ${v621LessonClass(l)}"','class="v621-block lesson ${v621LessonClass(l)} ${window.forjaAgenda2LessonClass(l)}" data-forja2-modality="${window.forjaAgenda2Modality(l).kind}"')
 .replace(/<b>\$\{esc\(`\$\{l\.nomeAluno[\s\S]*?<\/small>/,'${window.forjaAgenda2LessonContent(l)}'));
presentation('v629Lane(day)',body=>body
 .replace('lesson ${v621LessonClass(l)} ${v629EventPresentationClass(l.horaAula,end)}"','lesson ${v621LessonClass(l)} ${v629EventPresentationClass(l.horaAula,end)} ${window.forjaAgenda2LessonClass(l)}" data-forja2-modality="${window.forjaAgenda2Modality(l).kind}"')
 .replace('${v629EventContent(name,`Aula · ${lessonTitle(l)}`,l.horaAula,end)}','${window.forjaAgenda2LessonContent(l,{name:l.nomeAluno||name})}'));
presentation('v621MonthCalendar(role,uid)',body=>body
 .replace('lessons.slice(0,2)','lessons')
 .replace('class="v621-month-tag lesson"','class="v621-month-tag lesson ${window.forjaAgenda2LessonClass(l)}" data-forja2-modality="${window.forjaAgenda2Modality(l).kind}"')
 .replace('${esc(`${l.horaAula||\'—\'} · ${l.nomeAluno||\'Aluno\'}`)}','${window.forjaAgenda2LessonContent(l,{compact:true})}'));
presentation('v629MonthCalendar()',body=>body
 .replace('if(filters.lesson!==false&&data.lessons.length)tags.push(`<button class="v629-month-tag lesson" data-v629-open-teacher-day="${esc(teacher.uid)}" data-date="${esc(day)}">${esc(`${name} · ${data.lessons.length} aula(s)`)}</button>`);','if(filters.lesson!==false)for(const l of data.lessons)tags.push(`<button type="button" class="v629-month-tag lesson ${window.forjaAgenda2LessonClass(l)}" data-lesson="${esc(l.id)}" data-forja2-modality="${window.forjaAgenda2Modality(l).kind}" title="${esc(name)}">${window.forjaAgenda2LessonContent(l,{name,compact:true})}</button>`);')
 .replace('const shown=tags.slice(0,5),extra=Math.max(0,tags.length-shown.length);','const shown=tags,extra=0;'));
presentation('gLessonEvent(l,role)',()=>`function gLessonEvent(l,role){return window.forjaAgenda2CalendarLesson(l,role);}`);
presentation('gRenderCalendar(role,lessons,sessions=[])',body=>body
 .replace('<div class="g-day-num">${obj.getUTCDate()}</div>','<button type="button" class="g-day-num" data-forja2-cal-day="${esc(day)}" data-forja2-cal-role="${role}" aria-label="Ver dia ${esc(fmtDate(day))}">${obj.getUTCDate()}</button>')
 .replace('class="g-list-event"','class="g-list-event ${window.forjaAgenda2LessonClass(v.x)}" data-forja2-modality="${window.forjaAgenda2Modality(v.x).kind}"')
 .replace('</small></div><button class="small-btn" data-lesson=','</small>${window.forjaAgenda2LessonMeta(v.x)}</div><button class="small-btn" data-lesson='));
// v617 is the final native list/month renderer used by the student calendar.
presentation('v617CalendarLegend(role)',()=>"function v617CalendarLegend(role){return window.forjaAgenda2LessonLegend();}");
presentation('v617ListLesson(l,role)',body=>body
 .replace('class="g-list-event"','class="g-list-event ${window.forjaAgenda2LessonClass(l)}" data-forja2-modality="${window.forjaAgenda2Modality(l).kind}"')
 .replace("${esc(l.horaAula||'—')}","${esc([l.horaAula,l.horaFim].filter(Boolean).join('–'))}")
 .replace('</small></div>','</small>${window.forjaAgenda2LessonMeta(l)}</div>'));
// The existing isolated cal18 renderer is the final student calendar. Keep
// its controls/actions and apply the same modality contract at its native cards.
presentation('lessonEvent618(l,role)',body=>body
 .replace('class="cal18-event ${esc618(st.cls||\'\')}"','class="cal18-event ${esc618(st.cls||\'\')} ${window.forjaAgenda2LessonClass(l)}" data-forja2-modality="${window.forjaAgenda2Modality(l).kind}"')
 .replace('<b>${esc618(title)}</b>','${window.forjaAgenda2MonthTime(l)}<b>${esc618(title)}</b>')
 .replace('${esc618(sub)}</small>','${esc618(sub)}</small>${window.forjaAgenda2LessonMeta(l)}'));
presentation('listLesson618(l,role)',body=>body
 .replace('class="cal18-list-row"','class="cal18-list-row ${window.forjaAgenda2LessonClass(l)}" data-forja2-lesson="${esc618(l.id)}" data-forja2-modality="${window.forjaAgenda2Modality(l).kind}"')
 .replace("${esc618(l.horaAula||'—')}","${esc618([l.horaAula,l.horaFim].filter(Boolean).join('–'))}")
 .replace('</small></div>','</small>${window.forjaAgenda2LessonMeta(l)}</div>'));
presentation('legend618(role)',()=>"function legend618(role){return window.forjaAgenda2LessonLegend();}");
replace('<div class="cal18-daynum">${obj.getUTCDate()}</div>','<button type="button" class="cal18-daynum" data-forja2-cal-day="${esc618(day)}" data-forja2-cal-role="${role}" aria-label="Ver dia ${esc618(fmtDate(day))}">${obj.getUTCDate()}</button>');
replace('<div class="g-day-num">${obj.getUTCDate()}</div>','<button type="button" class="g-day-num" data-forja2-cal-day="${esc(day)}" data-forja2-cal-role="${role}" aria-label="Ver dia ${esc(fmtDate(day))}">${obj.getUTCDate()}</button>');
presentation('studentLessonCardB(l)',body=>body
 .replace('class="student-b-lesson ${canRespond','data-forja2-lesson="${esc(l.id)}" class="student-b-lesson ${window.forjaAgenda2LessonClass(l)} ${canRespond')
 .replace('${esc(`${l.nomeProfessor||"Professor"} · ${l.modalidade||"modalidade não informada"}`)}</p>','${esc(l.nomeProfessor||"Professor")}</p>${window.forjaAgenda2LessonMeta(l)}'));
// The later justification-aware renderer owns the current student cards.
// Keep every cancellation/justification/Meet action in that renderer intact.
replace('return `<article class="student-b-lesson ${canRespond?', 'return `<article data-forja2-lesson="${esc(l.id)}" class="student-b-lesson ${window.forjaAgenda2LessonClass(l)} ${canRespond?');
replace('${esc(`${l.nomeProfessor||\'Professor\'} · ${l.modalidade||\'modalidade não informada\'}`)}</p>', '${esc(l.nomeProfessor||\'Professor\')}</p>${window.forjaAgenda2LessonMeta(l)}');
presentation('teacherTodayCardC(l)',body=>body
 .replace('class="teacher-c-lesson"','class="teacher-c-lesson ${window.forjaAgenda2LessonClass(l)}" data-forja2-lesson="${esc(l.id)}"')
 .replace('</h4><p>${esc(`${l.modalidade','</h4>${window.forjaAgenda2LessonMeta(l)}<p>${esc(`${l.modalidade'));
presentation('agendaEventButton(e)',body=>body
 .replace('class="agenda-event ${esc(e.kind)}','data-forja2-event-kind="${esc(e.kind)}" data-forja2-event-start="${esc(e.start||\'\')}" class="agenda-event ${esc(e.kind)}')
 .replace('${esc(e.kind)} ${cancelled?', '${esc(e.kind)} ${e.kind==="aula"?window.forjaAgenda2LessonClass(e.source):e.kind==="disponibilidade"?"forja2-unverified":""} ${cancelled?')
 .replace('${e.title}', '${e.kind==="disponibilidade"?"Disponibilidade cadastrada":e.title}')
 .replace('${esc(e.sub||statusLabel(e.status||""))}</small>', '${esc(e.kind==="disponibilidade"?"Disponibilidade ainda não consultada":e.sub||statusLabel(e.status||""))}</small>${e.kind==="aula"?window.forjaAgenda2LessonMeta(e.source):""}'));
presentation('renderAgendaMonth(events)',body=>body
 .replace('<div class="agenda-month">','<div class="agenda-month">'+[['Seg','Segunda-feira'],['Ter','Terça-feira'],['Qua','Quarta-feira'],['Qui','Quinta-feira'],['Sex','Sexta-feira'],['Sáb','Sábado'],['Dom','Domingo']].map(([short,full])=>`<div class="agenda-month-weekday"><abbr title="${full}">${short}</abbr></div>`).join(''))
 .replace('<div class="agenda-month-date">${esc(String(Number(day.slice(-2))))}</div>','<button type="button" class="agenda-month-date" data-forja2-therapy-day="${esc(day)}" aria-label="Ver dia ${esc(fmtDate(day))}">${esc(String(Number(day.slice(-2))))}</button>'));
// Native markup owns its scope on the first frame, including re-renders before
// the asynchronous snapshot painter runs. Reusing that class is idempotent.
for(const classes of ['v621-agenda-shell v623-agenda-root v624-agenda-ready v625-professor-agenda','v621-agenda-shell v623-agenda-root v624-agenda-ready','v629-secretary-agenda'])replace(`class="${classes}"`,`class="${classes} forja2-agenda"`);
replace('  function v621TeacherTopbar(){',`  function v621TeacherTopbar(){
    if(window.forjaAgenda2Institutional?.())return '<div class="v622-topbar"><div class="v622-title"><div><small>AGENDA DO PROFESSOR</small><h2>Minha agenda</h2><p>Aulas, disponibilidade e horários ocupados em uma visão única.</p></div></div><div class="v622-sync"><div class="sync-copy"><b>Agenda institucional</b><span>Gerenciada pela Secretaria · confirmação automática das fontes</span></div></div></div>';
`);
replace('modal("Central da Aula",body);','modal("Central da Aula",(window.forjaAgenda2DetailMeta?.(l)||\'\')+body);');
replace("function professional(){return ['teacher','psychologist'].includes(state.role)&&state.profile?.active===true}","function professional(){return ['teacher','psychologist'].includes(state.role)&&state.profile?.active===true&&!window.forjaAgenda2Institutional?.()}");
replace("access_denied:'Acesso ao calendário recusado',rate_limited:","access_denied:'Acesso ao calendário recusado',insufficient_scope:'Permissão OAuth insuficiente',rate_limited:");
// Keep the native professional scope through the consent-era wrapper. Dropping
// it made the psychologist calendar fall back to the administrative header.
replace('forjaAgendaPage=function(){const page=previousAgenda();','forjaAgendaPage=function(...args){const page=previousAgenda(...args);');
const hooks=`
  gLessonEvent=function(l,role){return window.forjaAgenda2CalendarLesson(l,role);};
  // Preserve the official row/actions and add modality metadata to authorized
  // lesson lists (including the selected dependent), without changing data.
  const forjaAgenda2PreviousLessonRows=lessonRows;
  lessonRows=function(items,showPerson=true){return items.length?items.map(l=>'<div class="forja2-lesson-row '+window.forjaAgenda2LessonClass(l)+'" data-forja2-lesson="'+esc(l.id)+'">'+forjaAgenda2PreviousLessonRows([l],showPerson)+'<div class="forja2-row-meta">'+window.forjaAgenda2LessonMeta(l)+'</div></div>').join(''):forjaAgenda2PreviousLessonRows(items,showPerson);};
  // Preserve actual grid nodes when their generated presentation is unchanged.
  // Cache belongs to each DOM host, so remounts always render the current data.
  const forjaAgenda2GridMarkup=new WeakMap();
  function forjaAgenda2WriteGrid(host,markup){
    if(!host)return;
    const clock=host.classList.contains('v621-lane')&&markup.startsWith('<div class="v623-now-line"')?markup.slice(0,markup.indexOf('</div>')+6):'',content=clock?markup.slice(clock.length):markup,old=forjaAgenda2GridMarkup.get(host);
    if(!old||old.markup!==content||old.rendered!==host.innerHTML){host.innerHTML=markup;forjaAgenda2GridMarkup.set(host,{markup:content,clock,rendered:markup});}
    else if(old.clock!==clock){host.querySelector('.v623-now-line')?.remove();if(clock)host.insertAdjacentHTML('afterbegin',clock);old.clock=clock;}
  }
  // Scoped rendering hooks: replace grid contents, never forms, toolbar or scroll containers.
  // Logical ownership does not depend on a transiently detached calendar node.
  // Session, profile, date range and selected professionals still fence reads.
  window.forjaAgenda2Context=()=>{const role=state.role;if(state.page!=='agenda'||!['admin','teacher'].includes(role))return null;const days=v621RangeDays(role);return {from:days[0],to:days.at(-1),ids:role==='admin'?v629SelectedTeachers().map(t=>t.uid).sort():[state.user.uid],view:v621View(role)};};
  window.forjaAgenda2Paint=()=>{
    if(state.page!=='agenda'||!['admin','teacher'].includes(state.role))return;
    const admin=state.role==='admin',role=state.role;
    document.querySelector(admin?'.v629-secretary-agenda':'.v625-professor-agenda')?.classList.add('forja2-agenda');
    if(admin)document.querySelector('.v630-mode-tabs')?.remove();
    const focus=document.activeElement,focusedGrid=focus?.closest('.v621-lane,.v621-month-grid'),focusKey=focusedGrid?JSON.stringify({...focus.dataset}):null;
    for(const lane of document.querySelectorAll(admin?'[data-v629-day]':'[data-v621-lane="teacher"]')){const day=admin?lane.dataset.v629Day:lane.dataset.date;forjaAgenda2WriteGrid(lane,admin?v629Lane(day):v621Lane(role,state.user.uid,day));}
    for(const cell of document.querySelectorAll('[data-forja2-day]'))forjaAgenda2WriteGrid(cell,admin?v629AllDay(cell.dataset.forja2Day):v621AllDay(state.user.uid,cell.dataset.forja2Day));
    if(v621View(role)==='month'){
      const grid=document.querySelector('.v621-month-grid'),temp=document.createElement('div');temp.innerHTML=admin?v629MonthCalendar():v621MonthCalendar(role,state.user.uid);
      for(const cell of temp.querySelectorAll('.v621-month-cell')){
        const day=cell.dataset.v629MonthDay||cell.dataset.v625MonthDay;if(!day)continue;cell.classList.add('forja2-month');
        const people=admin?v629SelectedTeachers():[{uid:state.user.uid}],bucket=cell.querySelector('.v621-month-tags');
        for(const person of people){const kind=window.forjaAgenda2DayKind(person.uid,day);if(!['unknown','outside'].includes(kind))continue;
          if(window.forjaAgenda2HistoricalMonth(person.uid,day)){const history=document.createElement('div');history.className='v621-month-tag forja2-historical';history.textContent='Última informação conhecida · Ocupado';history.setAttribute('aria-label',(person.fullName||'Professor')+' · '+history.textContent);bucket?.prepend(history);}
          const tag=document.createElement(admin?'button':'div');tag.className=(admin?'v629':'v621')+'-month-tag '+kind;tag.dataset.forja2MonthStatus=person.uid;tag.textContent=(admin?(person.fullName||'Professor')+' · ':'')+(kind==='unknown'?'Não confirmado':'Fora da publicação');tag.title=tag.textContent;
          if(admin){tag.type='button';tag.dataset.v629OpenTeacherDay=person.uid;tag.dataset.date=day;}bucket?.prepend(tag);
        }
        for(const tag of cell.querySelectorAll('.v629-month-tag.lesson')){const count=window.forjaAgenda2LessonCounts(tag.dataset.v629OpenTeacherDay,day);if(count.cancelled){tag.textContent=v629TeacherName(tag.dataset.v629OpenTeacherDay)+' · '+count.active+' aula(s) · '+count.cancelled+' cancelada(s)';if(!count.active){tag.classList.remove('lesson');tag.classList.add('cancelled');}}}
      }
      forjaAgenda2WriteGrid(grid,temp.querySelector('.v621-month-grid').innerHTML);
    }
    const host=document.querySelector(admin?'.v629-secretary-sync':'.v622-topbar');if(host&&!host.querySelector('[data-forja2-status]'))host.insertAdjacentHTML('beforeend','<div class="forja2-status" data-forja2-status role="status" aria-live="polite"></div>');
    const card=document.querySelector(admin?'.v629-calendar-card':'.v621-calendar-card');if(card&&!card.querySelector('.forja2-legend'))card.insertAdjacentHTML('afterbegin','<div class="forja2-legend" aria-label="Legenda da Agenda"><span class="presencial">Presencial</span><span class="online">Online</span><span class="available">Disponível</span><span class="busy">Ocupado / bloqueado</span><span class="unknown">Não confirmado / fora da publicação</span></div>');
    const top=document.querySelector('.v629-secretary-sync .copy span');if(top)top.textContent='Última sincronização Google: '+v629LastGoogleSync();
    const teacherSync=document.querySelector('.v622-topbar .sync-copy span');if(!admin&&teacherSync)teacherSync.textContent='Última sincronização Google: '+(state.googleCalendar?.item?.lastSyncAt?fmtDateTime(state.googleCalendar.item.lastSyncAt):'—');
    const refresh=document.querySelector('[data-v629-refresh]');if(refresh)refresh.textContent='Atualizar consulta';
    if(!admin&&host&&!host.querySelector('[data-forja2-refresh]')){const b=document.createElement('button');b.className='small-btn';b.dataset.forja2Refresh='1';b.textContent='Atualizar consulta';b.onclick=()=>window.forjaAgenda2Refresh({manual:true});(host.querySelector('.v622-sync')||host).append(b);}
    if(admin)document.querySelector('.v629-secretary-summary')?.remove();
    v621Bind();if(admin){v629Bind();window.forjaAgenda2BindBooking?.();}for(const b of document.querySelectorAll('[data-lesson]')){b.onclick=e=>{e.preventDefault();e.stopPropagation();openLesson(b.dataset.lesson);};window.forjaAgenda2DecorateLesson?.(b);}
    for(const block of document.querySelectorAll('.v621-lane .v621-block'))block.classList.toggle('forja2-compact',parseFloat(block.style.height)<34);
    window.forjaAgenda2Polish?.(admin?v629SelectedTeachers().map(x=>x.uid):[state.user.uid]);
    for(const host of document.querySelectorAll('.v621-lane,.v621-month-grid,[data-forja2-day]')){const saved=forjaAgenda2GridMarkup.get(host);if(saved)saved.rendered=host.innerHTML;}
    if(focusKey&&!focus.isConnected){const target=[...document.querySelectorAll('.v621-lane button,.v621-month-grid button')].find(el=>JSON.stringify({...el.dataset})===focusKey);if(target)target.focus({preventScroll:true});else if(card){card.tabIndex=-1;card.focus({preventScroll:true});}}
  };
`;
replace("  const polishPortalBlockEBeforeV629=polishPortalBlockE;", hooks+"  const polishPortalBlockEBeforeV629=polishPortalBlockE;");
const css='<style id="forja-agenda2-style">\n'+readFileSync(new URL('./agenda-intelligence-style.css',import.meta.url),'utf8').replace(/\r\n/g,'\n')+'\n</style>\n';
const client=readFileSync(new URL('./agenda-intelligence-client.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
replace('</body>\n</html>',css+'<script id="forja-agenda2-script">\n'+client+'\n</script>\n</body>\n</html>');
writeFileSync(new URL('../index.html',import.meta.url),html);
writeFileSync(new URL('./agenda-intelligence-changes.json',import.meta.url),JSON.stringify({baseline,changes},null,2)+'\n');
const validator=new URL('./validate.mjs',import.meta.url),digest=createHash('sha256').update(html).digest('hex');
writeFileSync(validator,readFileSync(validator,'utf8').replace(/export const referenceSha256 = '[a-f0-9]{64}';/,"export const referenceSha256 = '"+digest+"';"));
console.log(JSON.stringify({baseline,sha256:createHash('sha256').update(html).digest('hex'),changes:changes.length}));
// Preserve the later scoped migration when regenerating this published Agenda layer.
if(current.includes('<script id="forja-navigation-script">')){
 const scope=new URL('./navigation-student-scope.mjs',import.meta.url);
 writeFileSync(scope,readFileSync(scope,'utf8').replace(/export const navigationBaseline='[a-f0-9]{64}';/,`export const navigationBaseline='${digest}';`));
 execFileSync(process.execPath,[new URL('./navigation-student-build.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],{stdio:'inherit'});
}
if(current.includes('<script id="forja-institutional-script">'))execFileSync(process.execPath,[new URL('./institutional-calendar-build.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],{stdio:'inherit'});
