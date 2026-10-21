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
const hooks=`
  // Scoped rendering hooks: replace grid contents, never forms, toolbar or scroll containers.
  window.forjaAgenda2Context=()=>{const role=state.role;if(state.page!=='agenda'||!['admin','teacher'].includes(role)||!document.querySelector(role==='admin'?'.v629-calendar-card':'.v621-calendar-card'))return null;const days=v621RangeDays(role);return {from:days[0],to:days.at(-1),ids:role==='admin'?v629SelectedTeachers().map(t=>t.uid).sort():[state.user.uid],view:v621View(role)};};
  window.forjaAgenda2Paint=()=>{
    if(state.page!=='agenda'||!['admin','teacher'].includes(state.role))return;
    const admin=state.role==='admin',role=state.role;
    document.querySelector(admin?'.v629-secretary-agenda':'.v625-professor-agenda')?.classList.add('forja2-agenda');
    if(admin)document.querySelector('.v630-mode-tabs')?.remove();
    const focus=document.activeElement,focusedGrid=focus?.closest('.v621-lane,.v621-month-grid'),focusKey=focusedGrid?JSON.stringify({...focus.dataset}):null;
    for(const lane of document.querySelectorAll(admin?'[data-v629-day]':'[data-v621-lane="teacher"]')){const day=admin?lane.dataset.v629Day:lane.dataset.date;lane.innerHTML=admin?v629Lane(day):v621Lane(role,state.user.uid,day);}
    for(const cell of document.querySelectorAll('[data-forja2-day]'))cell.innerHTML=admin?v629AllDay(cell.dataset.forja2Day):v621AllDay(state.user.uid,cell.dataset.forja2Day);
    if(v621View(role)==='month'){
      const grid=document.querySelector('.v621-month-grid'),temp=document.createElement('div');temp.innerHTML=admin?v629MonthCalendar():v621MonthCalendar(role,state.user.uid);if(grid)grid.innerHTML=temp.querySelector('.v621-month-grid').innerHTML;
      for(const cell of grid?.querySelectorAll('.v621-month-cell')||[]){
        const day=cell.dataset.v629MonthDay||cell.dataset.v625MonthDay;if(!day)continue;cell.classList.add('forja2-month');
        const people=admin?v629SelectedTeachers():[{uid:state.user.uid}],bucket=cell.querySelector('.v621-month-tags');
        for(const person of people){const kind=window.forjaAgenda2DayKind(person.uid,day);if(!['unknown','outside'].includes(kind))continue;
          const tag=document.createElement(admin?'button':'div');tag.className=(admin?'v629':'v621')+'-month-tag '+kind;tag.dataset.forja2MonthStatus=person.uid;tag.textContent=(admin?(person.fullName||'Professor')+' · ':'')+(kind==='unknown'?'Não confirmado':'Fora da publicação');tag.title=tag.textContent;
          if(admin){tag.type='button';tag.dataset.v629OpenTeacherDay=person.uid;tag.dataset.date=day;}bucket?.prepend(tag);
        }
        for(const tag of cell.querySelectorAll('.v629-month-tag.lesson')){const count=window.forjaAgenda2LessonCounts(tag.dataset.v629OpenTeacherDay,day);if(count.cancelled){tag.textContent=v629TeacherName(tag.dataset.v629OpenTeacherDay)+' · '+count.active+' aula(s) · '+count.cancelled+' cancelada(s)';if(!count.active){tag.classList.remove('lesson');tag.classList.add('cancelled');}}}
      }
    }
    const host=document.querySelector(admin?'.v629-secretary-sync':'.v622-topbar');if(host&&!host.querySelector('[data-forja2-status]'))host.insertAdjacentHTML('beforeend','<div class="forja2-status" data-forja2-status role="status" aria-live="polite"></div>');
    const card=document.querySelector(admin?'.v629-calendar-card':'.v621-calendar-card');if(card&&!card.querySelector('.forja2-legend'))card.insertAdjacentHTML('afterbegin','<div class="forja2-legend" aria-label="Legenda da disponibilidade"><span class="lesson">Aula FORJA</span><span class="available">Disponível</span><span class="busy">Ocupado / bloqueado</span><span class="unknown">Não confirmado</span><span class="outside">Fora da publicação</span></div>');
    const top=document.querySelector('.v629-secretary-sync .copy span');if(top)top.textContent='Última sincronização Google: '+v629LastGoogleSync();
    const teacherSync=document.querySelector('.v622-topbar .sync-copy span');if(!admin&&teacherSync)teacherSync.textContent='Última sincronização Google: '+(state.googleCalendar?.item?.lastSyncAt?fmtDateTime(state.googleCalendar.item.lastSyncAt):'—');
    const refresh=document.querySelector('[data-v629-refresh]');if(refresh)refresh.textContent='Atualizar consulta';
    if(!admin&&host&&!host.querySelector('[data-forja2-refresh]')){const b=document.createElement('button');b.className='small-btn';b.dataset.forja2Refresh='1';b.textContent='Atualizar consulta';b.onclick=()=>window.forjaAgenda2Refresh({manual:true});(host.querySelector('.v622-sync')||host).append(b);}
    if(admin)document.querySelector('.v629-secretary-summary')?.remove();
    v621Bind();if(admin){v629Bind();window.forjaAgenda2BindBooking?.();}for(const b of document.querySelectorAll('[data-lesson]')){b.onclick=()=>openLesson(b.dataset.lesson);window.forjaAgenda2DecorateLesson?.(b);}
    for(const block of document.querySelectorAll('.v621-lane .v621-block'))block.classList.toggle('forja2-compact',parseFloat(block.style.height)<34);
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
