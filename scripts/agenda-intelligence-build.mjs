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
function replace(before,after){const positions=[];let at=0;while((at=html.indexOf(before,at))>=0){positions.push(at);at+=before.length;}assert.equal(positions.length,1,'Unique migration boundary: '+before.slice(0,80));changes.push({before,after,positions});html=html.replace(before,after);}
replace("  function v621AvailabilityForDay(role,uid,day){","  function v621AvailabilityForDay(role,uid,day){\n    if(window.forjaAgenda2Periods)return window.forjaAgenda2Periods(uid,day);");
replace("  function v621GoogleBusy(uid,day){","  function v621GoogleBusy(uid,day){\n    const current=window.forjaAgenda2Google?.(uid,day);if(current)return current;");
replace("function v621Lessons(uid,day){return (state.lessons||[])","function v621Lessons(uid,day){return window.forjaAgenda2Lessons?.(uid,day)||(state.lessons||[])");
replace("  function v623ManualBusy(uid,day){","  function v623ManualBusy(uid,day){\n    const current=window.forjaAgenda2Blocks?.(uid,day);if(current)return current;");
replace("  async function v621EnsureVisibleWeeks(role){","  async function v621EnsureVisibleWeeks(role){\n    if(window.forjaAgenda2Enabled)return window.forjaAgenda2Refresh();");
replace("googleBusy=v621GoogleBusy(uid,day).filter(x=>!x.allDay),manualBusy=", "googleBusy=v621GoogleBusy(uid,day),manualBusy=");
replace("availability=v623CutAvailability(rawAvailability,[...googleBusy,...manualBusy,...lessonCuts]);let html='';","availability=v623CutAvailability(rawAvailability,[...googleBusy,...manualBusy,...lessonCuts,...(window.forjaAgenda2School?.(uid,day)||[])]);let html=(window.forjaAgenda2Bands?.(uid,day,v621EventStyle)||'')+(window.forjaAgenda2SchoolCards?.(uid,day,v621EventStyle)||'');");
replace("cuts=[...googleBusy.filter(x=>!x.allDay),...manualBusy,...lessons.filter", "cuts=[...googleBusy,...manualBusy,...(window.forjaAgenda2School?.(uid,day)||[]),...lessons.filter");
replace("const raw=v631CentralKnown(uid,day)?v621AvailabilityForDay('admin',uid,day):[]", "const raw=window.forjaAgenda2Enabled?v621AvailabilityForDay('admin',uid,day):v631CentralKnown(uid,day)?v621AvailabilityForDay('admin',uid,day):[]");
replace("availability=v623CutAvailability(raw,[...google,...manual,...lessonCuts]);", "school=window.forjaAgenda2School?.(uid,day)||[],availability=v623CutAvailability(raw,[...google,...manual,...lessonCuts,...school]);");
replace("return {availability,google,googleTimed,manual,lessons};", "return {availability,google,googleTimed,manual,lessons,school};");
replace("const uid=teacher.uid,name=teacher.fullName||'Professor',data=v629DayData(uid,day);", "const uid=teacher.uid,name=teacher.fullName||'Professor',data=v629DayData(uid,day);html+=(window.forjaAgenda2Bands?.(uid,day,(a,b)=>v629SlotStyle(a,b,index,count))||'')+(window.forjaAgenda2SchoolCards?.(uid,day,(a,b)=>v629SlotStyle(a,b,index,count))||'');");
replace("busy+=d.google.length+d.manual.length;lessons+=d.lessons.length", "busy+=d.google.length+d.manual.length+(d.school?.length||0);lessons+=d.lessons.length");
replace("const busy=data.google.length+data.manual.length;", "const busy=data.google.length+data.manual.length+(data.school?.length||0);");
replace("  async function v627AutoSyncTeacherAgenda(){", "  async function v627AutoSyncTeacherAgenda(){\n    if(window.forjaAgenda2Enabled)return;");
replace("  async function v629RefreshSecretaryAgenda({syncGoogle=true,render=true}={}){", "  async function v629RefreshSecretaryAgenda({syncGoogle=true,render=true}={}){\n    if(window.forjaAgenda2Enabled)return window.forjaAgenda2Refresh({manual:true});");
replace("await v629RefreshSecretaryAgenda({syncGoogle:true,render:true});toast('Disponibilidade e Google atualizados.','ok')", "if(window.forjaAgenda2Enabled)await window.forjaAgenda2Refresh({manual:true});else{await v629RefreshSecretaryAgenda({syncGoogle:true,render:true});toast('Disponibilidade e Google atualizados.','ok')}");
replace("{v629Bind();const session=forjaCaptureSession()", "{v629Bind();if(window.forjaAgenda2Enabled)return;const session=forjaCaptureSession()");
replace("${v629SelectedTeachers().some(t=>!v631CentralKnown(t.uid,v621Date('admin')))?", "${!window.forjaAgenda2Enabled&&v629SelectedTeachers().some(t=>!v631CentralKnown(t.uid,v621Date('admin')))?");
replace("return state.role==='admin'&&state.googleBusyUnavailable?", "return !window.forjaAgenda2Enabled&&state.role==='admin'&&state.googleBusyUnavailable?");
replace("if(document.hidden||state.role!=='admin'||state.page!=='agenda')return;if(Date.now()-v629TimerLast", "if(window.forjaAgenda2Enabled||document.hidden||state.role!=='admin'||state.page!=='agenda')return;if(Date.now()-v629TimerLast");
replace("if(!document.hidden&&state.role==='admin'&&state.page==='agenda'&&Date.now()-v629TimerLast", "if(!window.forjaAgenda2Enabled&&!document.hidden&&state.role==='admin'&&state.page==='agenda'&&Date.now()-v629TimerLast");
replace("    if([\"POST\",\"PATCH\",\"DELETE\"].includes(method)&&typeof forjaAdminMutationCommitted", "    if([\"POST\",\"PATCH\",\"DELETE\"].includes(method))window.forjaAgenda2Mutation?.(path);\n    if([\"POST\",\"PATCH\",\"DELETE\"].includes(method)&&typeof forjaAdminMutationCommitted");
const hooks=`
  // Scoped rendering hooks: replace grid contents, never forms, toolbar or scroll containers.
  window.forjaAgenda2Context=()=>{const role=state.role;if(state.page!=='agenda'||!['admin','teacher'].includes(role)||!document.querySelector(role==='admin'?'.v629-calendar-card':'.v621-calendar-card'))return null;const days=v621RangeDays(role);return {from:days[0],to:days.at(-1),ids:role==='admin'?v629SelectedTeachers().map(t=>t.uid).sort():[state.user.uid],view:v621View(role)};};
  window.forjaAgenda2Paint=()=>{
    if(state.page!=='agenda'||!['admin','teacher'].includes(state.role))return;
    const admin=state.role==='admin',role=state.role;
    const focus=document.activeElement,focusedGrid=focus?.closest('.v621-lane,.v621-month-grid'),focusKey=focusedGrid?JSON.stringify({...focus.dataset}):null;
    for(const lane of document.querySelectorAll(admin?'[data-v629-day]':'[data-v621-lane="teacher"]')){const day=admin?lane.dataset.v629Day:lane.dataset.date;lane.innerHTML=admin?v629Lane(day):v621Lane(role,state.user.uid,day);}
    if(v621View(role)==='month'){const grid=document.querySelector('.v621-month-grid'),temp=document.createElement('div');temp.innerHTML=admin?v629MonthCalendar():v621MonthCalendar(role,state.user.uid);if(grid)grid.innerHTML=temp.querySelector('.v621-month-grid').innerHTML;for(const cell of grid?.querySelectorAll('.v621-month-cell')||[]){const day=cell.dataset.v629MonthDay||cell.dataset.v625MonthDay,ids=admin?v629SelectedTeachers().map(x=>x.uid):[state.user.uid],kinds=day?ids.map(id=>window.forjaAgenda2DayKind(id,day)):[];cell.classList.add('forja2-month',...['unknown','available','busy','outside'].filter(k=>k===kinds.find(x=>x===k)||k==='outside'&&!kinds.length).slice(0,1));}}
    const host=document.querySelector(admin?'.v629-secretary-sync':'.v622-topbar');if(host&&!host.querySelector('[data-forja2-status]'))host.insertAdjacentHTML('beforeend','<div class="forja2-status" data-forja2-status role="status" aria-live="polite"></div>');
    const card=document.querySelector(admin?'.v629-calendar-card':'.v621-calendar-card');if(card&&!card.querySelector('.forja2-legend'))card.insertAdjacentHTML('afterbegin','<div class="forja2-legend" aria-label="Legenda da disponibilidade"><span class="available">Disponível confirmado</span><span class="busy">Ocupado / bloqueado</span><span class="unknown">Verificando / desconhecido</span><span class="outside">Fora da publicação</span><span>Aulas mantêm identificação própria</span></div>');
    const top=document.querySelector('.v629-secretary-sync .copy span');if(top)top.textContent='Consulta a cada 20 s · Sync Google mais recente: '+v629LastGoogleSync();
    const teacherSync=document.querySelector('.v622-topbar .sync-copy span');if(!admin&&teacherSync)teacherSync.textContent='Última sincronização Google: '+(state.googleCalendar?.item?.lastSyncAt?fmtDateTime(state.googleCalendar.item.lastSyncAt):'—');
    const refresh=document.querySelector('[data-v629-refresh]');if(refresh)refresh.textContent='Atualizar consulta';
    if(!admin&&host&&!host.querySelector('[data-forja2-refresh]')){const b=document.createElement('button');b.className='small-btn';b.dataset.forja2Refresh='1';b.textContent='Atualizar consulta';b.onclick=()=>window.forjaAgenda2Refresh({manual:true});host.append(b);}
    if(admin){const summary=document.querySelector('.v629-secretary-summary'),s=v629VisibleStats();if(summary)summary.innerHTML='<span>'+s.total+' professor(es)</span><span class="ok">'+s.available+' período(s) confirmado(s)</span><span class="busy">'+s.busy+' ocupado(s)</span><span>'+s.lessons+' aula(s)</span>';}
    v621Bind();if(admin)v629Bind();for(const b of document.querySelectorAll('[data-lesson]'))b.onclick=()=>openLesson(b.dataset.lesson);
    if(focusKey&&!focus.isConnected){const target=[...document.querySelectorAll('.v621-lane button,.v621-month-grid button')].find(el=>JSON.stringify({...el.dataset})===focusKey);if(target)target.focus({preventScroll:true});else if(card){card.tabIndex=-1;card.focus({preventScroll:true});}}
  };
`;
replace("  const polishPortalBlockEBeforeV629=polishPortalBlockE;", hooks+"  const polishPortalBlockEBeforeV629=polishPortalBlockE;");
const css=`<style id="forja-agenda2-style">
#workspaceContent .forja2-band{position:absolute;pointer-events:none;z-index:1;border:0;border-radius:0;opacity:.65;min-height:0}
#workspaceContent .forja2-band.available{background:#e6f4ea}#workspaceContent .forja2-band.busy{background:#f6c8c4}#workspaceContent .forja2-band.unknown{background:repeating-linear-gradient(135deg,#fff0bd,#fff0bd 8px,#fff6da 8px,#fff6da 16px)}#workspaceContent .forja2-band.outside{background:#e5e7eb}
.forja2-legend{display:flex;flex-wrap:wrap;gap:8px;padding:12px;color:#374151;font-size:12px;border-bottom:1px solid #e5e7eb}.forja2-legend span{display:flex;align-items:center;gap:5px}.forja2-legend span:before{content:'';width:10px;height:10px;display:inline-block;border-radius:2px}.forja2-legend .available:before{background:#34a853}.forja2-legend .busy:before{background:#d93025}.forja2-legend .unknown:before{background:#eab308}.forja2-legend .outside:before{background:#9ca3af}.forja2-status{font-size:12px;color:#166534;flex-basis:100%;padding:5px 0}.forja2-status.unavailable{color:#854d0e}
#workspaceContent .forja2-month.available{background:#f0faf3}#workspaceContent .forja2-month.busy{background:#fff0ee}#workspaceContent .forja2-month.unknown{background:#fff7db}#workspaceContent .forja2-month.outside{background:#eef0f3}
#workspaceContent .v621-block.lesson{z-index:9!important}#workspaceContent .v629-secretary-sync{flex-wrap:wrap}#workspaceContent .v622-topbar{flex-wrap:wrap}
@media(max-width:600px){.forja2-legend{font-size:11px;padding:8px;gap:6px}.forja2-status{max-width:100%;overflow-wrap:anywhere}}
</style>
`;
const client=readFileSync(new URL('./agenda-intelligence-client.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
replace('</body>\n</html>',css+'<script id="forja-agenda2-script">\n'+client+'\n</script>\n</body>\n</html>');
writeFileSync(new URL('../index.html',import.meta.url),html);
writeFileSync(new URL('./agenda-intelligence-changes.json',import.meta.url),JSON.stringify({baseline,changes},null,2)+'\n');
const validator=new URL('./validate.mjs',import.meta.url),digest=createHash('sha256').update(html).digest('hex');
writeFileSync(validator,readFileSync(validator,'utf8').replace(/export const referenceSha256 = '[a-f0-9]{64}';/,"export const referenceSha256 = '"+digest+"';"));
console.log(JSON.stringify({baseline,sha256:createHash('sha256').update(html).digest('hex'),changes:changes.length}));
