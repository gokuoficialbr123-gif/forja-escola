import assert from 'node:assert/strict';
const patches=[
  [
    "  // BEGIN FORJA central booking presentation: on demand, session scoped, no polling.\n  state.v631CentralRanges={};\n  const v631CentralFlights=new Map();\n  function v631CentralKnown(uid,day){\n    return Object.values(state.v631CentralRanges||{}).some(r=>r.from<=day&&r.to>=day&&Date.now()-r.checkedAt>=0&&Date.now()-r.checkedAt<60000&&r.valid&&!r.unavailable.some(x=>x.professionalId===uid));\n  }\n  function v631CentralBusy(){\n    if(state.role!=='admin')return [];\n    const out=new Map();for(const r of Object.values(state.v631CentralRanges||{}))if(r.valid&&Date.now()-r.checkedAt<60000)for(const x of r.items||[])out.set(`${x.professionalId}|${x.startAt}|${x.endAt}`,x);return [...out.values()];\n  }\n  async function v631LoadCentralRange({force=false}={}){\n    if(state.role!=='admin')return;\n    const session=forjaCaptureSession(),days=v621RangeDays('admin'),chunks=[];\n    for(let i=0;i<days.length;i+=31)chunks.push({from:days[i],to:days[Math.min(i+30,days.length-1)]});\n    await Promise.all(chunks.map(async ({from,to})=>{\n      const key=from+'|'+to,flightKey=session.uid+'|'+session.generation+'|'+key,prior=state.v631CentralRanges?.[key];\n      if(!force&&prior&&Date.now()-prior.checkedAt<60000)return;\n      if(v631CentralFlights.has(flightKey))return v631CentralFlights.get(flightKey);\n      const request=(async()=>{\n        let result;\n        try{result=await api(`/admin/agenda/google-central-busy?from=${from}&to=${to}`,{session});if(result.policy!=='central-booking-fail-closed-v1'||result.from!==from||result.to!==to||!Array.isArray(result.items)||!Array.isArray(result.unavailable)||result.complete!==(result.unavailable.length===0))throw Error('CENTRAL_RESULT_INVALID');}\n        catch(e){if(!forjaSessionCurrent(session))return;result={items:prior?.items||[],unavailable:[],valid:false};}\n        forjaAssertSession(session);state.v631CentralRanges=state.v631CentralRanges||{};\n        state.v631CentralRanges[key]={from,to,checkedAt:Date.now(),valid:result.valid!==false,items:result.items||[],unavailable:result.unavailable||[]};\n        const keys=Object.keys(state.v631CentralRanges);if(keys.length>8)delete state.v631CentralRanges[keys[0]];\n      })();\n      v631CentralFlights.set(flightKey,request);try{await request}finally{if(v631CentralFlights.get(flightKey)===request)v631CentralFlights.delete(flightKey)}\n    }));\n  }\n  // END FORJA central booking presentation.\n\n  async function v621EnsureVisibleWeeks(role){",
    "  async function v621EnsureVisibleWeeks(role){"
  ],
  [
    "const weeks=v621VisibleWeeks(role);if(role==='teacher')await Promise.all(weeks.map(v621FetchTeacherWeek));else await Promise.all([Promise.all(weeks.map(v621FetchAdminWeek)),v631LoadCentralRange()]);",
    "const weeks=v621VisibleWeeks(role);if(role==='teacher')await Promise.all(weeks.map(v621FetchTeacherWeek));else await Promise.all(weeks.map(v621FetchAdminWeek));"
  ],
  [
    "const out=[];for(const x of [...(state.googleBusy||[]),...v631CentralBusy()]){if(x.managedForja||x.professionalId!==uid)continue;",
    "const out=[];for(const x of state.googleBusy||[]){if(x.managedForja||x.professionalId!==uid)continue;"
  ],
  [
    "const raw=v631CentralKnown(uid,day)?v621AvailabilityForDay('admin',uid,day):[],google=v621GoogleBusy(uid,day)",
    "const raw=v621AvailabilityForDay('admin',uid,day),google=v621GoogleBusy(uid,day)"
  ],
  [
    "      await v631LoadCentralRange({force:true});forjaAssertSession(session);state.v629SecretaryLastRefreshAt=Date.now();",
    "      forjaAssertSession(session);state.v629SecretaryLastRefreshAt=Date.now();"
  ],
  [
    "if(state.role==='admin'&&state.page==='agenda'){v629Bind();const session=forjaCaptureSession(),date=v621Date('admin'),view=v621View('admin');const ready=v629SelectedTeachers().every(x=>v631CentralKnown(x.uid,date));if(!ready){v621EnsureVisibleWeeks('admin').then(()=>{if(forjaSessionCurrent(session)&&state.role==='admin'&&state.page==='agenda'&&v621Date('admin')===date&&v621View('admin')===view&&v629SelectedTeachers().some(x=>v631CentralKnown(x.uid,date)))renderPage()}).catch(()=>{});}}",
    "if(state.role==='admin'&&state.page==='agenda')v629Bind()"
  ],
  [
    "return `<div class=\"v629-secretary-agenda\">${v629SelectedTeachers().some(t=>!v631CentralKnown(t.uid,v621Date('admin')))?'<div class=\"system-note\" role=\"status\">Consulta Google central ainda não confirmada para um ou mais professores. Horários desconhecidos não são apresentados como disponíveis; tente atualizar a Agenda.</div>':''}${head}${summary}",
    "return `<div class=\"v629-secretary-agenda\">${head}${summary}"
  ],
  [
    "      if(r.availabilityPolicy!=='confirmed-week-v2')throw new Error('Este backend ainda não valida disponibilidade publicada. Use o Preview atualizado antes de marcar a aula.');\n      if(r.centralBookingPolicy!=='central-booking-fail-closed-v1')throw new Error('Este backend ainda não valida ocupado da conta Google central. Aguarde a API atualizada antes de marcar a aula.');",
    "      if(r.availabilityPolicy!=='confirmed-week-v2')throw new Error('Este backend ainda não valida disponibilidade publicada. Use o Preview atualizado antes de marcar a aula.');"
  ],
  [
    "out.push({id:x.id,start:day===sd?`${sp.hour}:${sp.minute}`:'00:00',end:day===ed?`${ep.hour}:${ep.minute}`:'23:59',allDay:false,...(x.source==='google-central'?{source:'google-central'}:{})});",
    "out.push({id:x.id,start:day===sd?`${sp.hour}:${sp.minute}`:'00:00',end:day===ed?`${ep.hour}:${ep.minute}`:'23:59',allDay:false});"
  ],
  [
    "v629EventContent(name,b.source==='google-central'?\"Ocupado · Google central\":\"Ocupado · Google pessoal\",b.start,b.end)",
    "v629EventContent(name,\"Ocupado · Google\",b.start,b.end)"
  ]
];
export function withoutCentralBooking(html){for(const [changed,original] of [...patches].reverse()){assert.equal(html.split(changed).length,2,'Etapa 4 patch missing or duplicated');html=html.replace(changed,original);}return html;}
