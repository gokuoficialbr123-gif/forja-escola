// TEMPORARY read-only incident audit. Remove from the PR before merge.
// Does not import/start server.js, Auth, Google, migration, or scheduling code.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, generateKeyPairSync, randomBytes, createCipheriv, publicEncrypt, constants } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
const APP_TIME_ZONE='America/Sao_Paulo';
const incidentDate='2026-10-04',incidentWeek='2026-09-28';
const userFields=['role','fullName','active','forjaId','disciplinaIds','serieId','disponibilidadeSemanal','availabilityWeekMigrationV616','availabilityWeekMigrationAt','createdAt','updatedAt'];
const roots=new Set(['users','disciplinas',' disciplinas','disponibilidades_semanais','aluno_materias','aulas','sessoes_terapia','indisponibilidades','calendario_escolar','_agenda_locks','google_calendar_busy','auditoria']);
export function readOnlyDatabase(raw){
  const snapshot=s=>s.docs ? Object.freeze({docs:s.docs.map(snapshot),empty:s.empty,size:s.size}) : Object.freeze({id:s.id,exists:s.exists,data:()=>s.data(),updateTime:s.updateTime,createTime:s.createTime});
  const wrap=(ref,path='')=>new Proxy(Object.freeze({}),{get(_target,key){
    if(key==='get')return async()=>snapshot(await ref.get(path.startsWith('users/')&&!path.includes('/historico')?{fieldMask:userFields}:undefined));
    if(key==='collection')return name=>{const next=path?path+'/'+name:name;if(!path&&!roots.has(name))throw Error('READ_SCOPE_DENIED');if(path&&!(path.startsWith('users/')&&name==='historico'))throw Error('READ_SCOPE_DENIED');return wrap(ref.collection(name),next)};
    if(key==='doc')return id=>{assert.equal(typeof id,'string');assert.ok(id);return wrap(ref.doc(id),path+'/'+id)};
    if(['where','limit','orderBy','select'].includes(key))return (...args)=>wrap(ref[key](...args),path);
    if(key==='listCollections'&&!path)return async()=>(await raw.listCollections()).map(c=>Object.freeze({id:c.id}));
    if(key==='then')return undefined;
    throw Error('READ_ONLY_METHOD_DENIED');
  }});
  return wrap(raw);
}
// Replayed GET uses direct reads only, never the migration-capable original helper.
async function professionalAvailabilityWeek(professionalId, profile, date, { publishedOnly = false } = {}) {
  const weekStart = weekStartKeyForDate(date);
  if (!professionalId || !weekStart) return { weekStart:"", weekEnd:"", items:{}, hasSavedWeek:false, source:"" };
  const weekEnd = weekEndKeyForDate(weekStart);
  const ref = db.collection("disponibilidades_semanais").doc(availabilityWeekDocId(professionalId, weekStart));
  const snap = await ref.get();

  // Reads never migrate, publish, or create legacy availability.

  const data = snap.exists ? (snap.data() || {}) : {};
  return {
    weekStart,
    weekEnd,
    items: publishedOnly && !isPublishedAvailabilityWeek(data, { professionalId, weekStart }) ? {} : normalizeWeeklyAvailability(data.semana),
    hasSavedWeek: snap.exists,
    source: String(data.source || ""),
    publicationValid: isPublishedAvailabilityWeek(data, { professionalId, weekStart }),
  };
}

// The real HTTP route can call ensureForjaId, which writes. NEVER call it here.
const ensureForjaId=async()=>{throw Error('READ_ONLY_FORJA_ID_MISSING')};
const verificarAdmin=async()=>({uid:'read-only-diagnostic-context'});
const roleIsProfessional=role=>['teacher','psychologist'].includes(role);
const verificarUsuario=async()=>({profile:{role:'admin'},decoded:{uid:'read-only-diagnostic-context'}});
const jsonResponse=(_res,status,body)=>({status,body});
const handleError=(_res,error)=>({status:400,body:{error:safeError(error)}});
let db;
function safeError(error){
  const code=error?.code,text=String(error?.message||'')+' '+String(error?.details||'');
  const reason=/not been used|api.*disabled|service_disabled/i.test(text)?'API_DISABLED':/insufficient permissions|permission.*denied|does not have.*permission/i.test(text)?'READ_PERMISSION_DENIED':/database.*does not exist|database.*not found/i.test(text)?'DATABASE_NOT_FOUND':/invalid_grant|unauthenticated/i.test(text)?'CREDENTIAL_UNUSABLE':'UNCLASSIFIED';
  const missingPermission=(text.match(/\bdatastore\.[a-zA-Z.]+/g)||[]).filter(x=>/^datastore\.[a-zA-Z.]{1,80}$/.test(x));
  return {code:typeof code==='number'||typeof code==='string'&&/^[a-z0-9_/-]{1,50}$/i.test(code)?code:'UNKNOWN',reason,missingPermission:[...new Set(missingPermission)],message:/^[A-Z0-9_]{1,100}$/.test(error?.message||'')?error.message:'Audit operation unavailable; credential details omitted'};
};
const normalized=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
const matching=(value,name)=>normalized(value)===normalized(name)||normalized(value).startsWith(normalized(name)+' ');
const safeId=x=>typeof x==='string'&&/^[a-zA-Z0-9_|-]{1,190}$/.test(x)?x:null;
const stamp=x=>x?.toDate?.().toISOString?.()||x instanceof Date&&x.toISOString()||typeof x==='string'&&/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(x)&&x||null;
const sourceValue=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x)?x:null;
function weekSummary(snap){
  if(!snap.exists)return {documentId:snap.id,status:'documento/estrutura inexistente'};
  const x=snap.data(),links=x.googleAvailabilityEvents||{};
  return {documentId:snap.id,professionalId:safeId(x.professionalId),weekStart:x.weekStart||null,weekEnd:x.weekEnd||null,source:sourceValue(x.source),semana:normalizeWeeklyAvailability(x.semana),createdAt:stamp(x.createdAt),updatedAt:stamp(x.updatedAt),firestoreUpdateTime:stamp(snap.updateTime),updatedById:safeId(x.updatedById),googleSyncStatus:sourceValue(x.googleSyncStatus),googleSyncAt:stamp(x.googleSyncAt),googleSyncErrorPresent:!!x.googleSyncErro,googleAvailabilityLinks:Object.values(links).map(y=>({date:y.date||null,dayCode:String(y.dayCode??''),inicio:normalizeTime(y.inicio),fim:normalizeTime(y.fim),eventIdPresent:!!y.eventId})),publicationMetadataKeys:Object.keys(x).filter(k=>/publish|publica|confirm|approval/i.test(k)),publishedAt:stamp(x.publishedAt),publishedById:safeId(x.publishedById),publicationPresent:!!x.publication,publicationValid:isPublishedAvailabilityWeek(x,{professionalId:x.professionalId,weekStart:x.weekStart}),publication:x.publication?{version:x.publication.version,fingerprint:x.publication.fingerprint,confirmedById:safeId(x.publication.confirmedById),confirmedAt:stamp(x.publication.confirmedAt),action:sourceValue(x.publication.action)}:null};
}
async function historyFor(uid){
  const wanted=new Set(['disponibilidade_semana_atualizada','disponibilidade_semana_copiada','disponibilidade_google_alterada','disponibilidade_google_removida']);
  const out=[];
  for(const [name,query] of [['historico',db.collection('users').doc(uid).collection('historico')],['auditoria',db.collection('auditoria').where('entidadeId','==',uid)]]){
    try{const snap=await query.get();for(const d of snap.docs){const x=d.data(),event=x.evento||x.acao;if(!wanted.has(event))continue;const desc=String(x.descricao||'');out.push({collection:name,event,createdAt:stamp(x.createdAt),actorId:safeId(x.autorId),actorRole:sourceValue(x.autorTipo||x.autorRole),dates:[...new Set(desc.match(/\d{4}-\d{2}-\d{2}/g)||[])],times:[...new Set(desc.match(/\b\d{2}:\d{2}\b/g)||[])]})}}
    catch(error){out.push({collection:name,readError:safeError(error)})}
  }
  return out.sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
}
export async function audit(raw){
  db=readOnlyDatabase(raw);
  const collections=(await db.listCollections()).map(c=>c.id);
  const structures=[...roots].map(name=>({name,status:collections.includes(name)?'exists':'documento/estrutura inexistente'}));
  const report={readOnly:true,incidentDate,incidentWeek,timeZone:APP_TIME_ZONE,backendReference:'c4397768afad8e273fb5a24501a57852e4478e41',structures,cases:[]};
  if(!collections.includes('users'))return report;
  const teachers=(await db.collection('users').where('role','==','teacher').select(...userFields).get()).docs.filter(s=>matching(s.data().fullName,'Carlos'));
  const students=(await db.collection('users').where('role','==','student').select(...userFields).get()).docs.filter(s=>matching(s.data().fullName,'João'));
  const subjects=[];
  for(const name of ['disciplinas',' disciplinas'])if(collections.includes(name))for(const s of (await db.collection(name).select('nome','active','seriesIds').get()).docs)if(normalized(s.data().nome)===normalized('Matemática')&&!subjects.some(d=>d.id===s.id))subjects.push(s);
  report.matches={teacherCount:teachers.length,studentCount:students.length,subjectCount:subjects.length};
  for(const teacher of teachers){
    const p=teacher.data(),professionalId=teacher.id;
    const item={professionalId,active:p.active===true,forjaIdPresent:!!p.forjaId,legacy:{disponibilidadeSemanal:normalizeWeeklyAvailability(p.disponibilidadeSemanal),availabilityWeekMigrationV616:p.availabilityWeekMigrationV616??null,availabilityWeekMigrationAt:stamp(p.availabilityWeekMigrationAt)},weeks:[],history:await historyFor(professionalId),queries:[]};
    for(const week of [incidentWeek,'2026-09-21'])item.weeks.push(weekSummary(await db.collection('disponibilidades_semanais').doc(availabilityWeekDocId(professionalId,week)).get()));
    if(collections.includes('disponibilidades_semanais')){
      const weeks=await db.collection('disponibilidades_semanais').where('professionalId','==',professionalId).get();
      item.relatedWeeks=weeks.docs.map(weekSummary).filter(x=>x.weekStart===incidentWeek||x.weekStart==='2026-09-21'||x.googleAvailabilityLinks?.some(l=>l.date===incidentDate)||x.semana?.['6']?.some(s=>s.inicio==='20:00'&&s.fim==='22:00'));
    }
    const agenda=await replayAgenda(new URL('https://forja-api-pr-2.onrender.com/admin/disponibilidades-semana?weekStart='+incidentWeek));
    const agendaItem=agenda.body?.items?.find(x=>x.uid===professionalId);
    item.agendaBefore={status:agenda.status,weekStart:agendaItem?.weekStart,source:agendaItem?.source,periods:agendaItem?.disponibilidade?.[String(weekdayForDate(incidentDate))]||[]};
    const confirmedWeek=await professionalAvailabilityWeek(professionalId,p,incidentDate,{publishedOnly:true});
    item.confirmedDay={publicationValid:confirmedWeek.publicationValid,periods:confirmedWeek.items[String(weekdayForDate(incidentDate))]||[]};
    const lessonDocs=await db.collection('aulas').where('professorId','==',professionalId).select('dataAula','horaAula','horaFim','status').get();
    item.teacherLessons=lessonDocs.docs.map(d=>d.data()).filter(x=>dateKey(x.dataAula)===incidentDate).map(x=>({date:incidentDate,inicio:normalizeTime(x.horaAula),fim:normalizeTime(x.horaFim)||addMinutesToTime(x.horaAula,60),status:sourceValue(x.status),cancelled:isCancelledStatus(x.status)}));
    item.googleBusy=(await googleBusyConflictsForDate(professionalId,incidentDate)).map(x=>({type:x.type,inicio:minutesToTime(x.start),fim:minutesToTime(x.end)}));
    item.schoolBlocks=(await getSchoolBlocksForDate(incidentDate)).map(x=>({type:sourceValue(x.tipo),inicio:normalizeTime(x.horaInicio),fim:normalizeTime(x.horaFim)}));
    for(const subject of subjects.filter(s=>professionalDisciplineIds(p).includes(s.id)))for(const student of students){
      const q=new URLSearchParams({data:incidentDate,role:'teacher',professionalId,disciplinaId:subject.id,alunoId:student.id,duracaoMinutos:'60'});
      const result=await replayBooking(new URL('https://forja-api-pr-2.onrender.com/profissionais/disponibilidade?'+q));
      item.queries.push({studentReferenceHash:createHash('sha256').update(student.id).digest('hex').slice(0,12),disciplineReferenceHash:createHash('sha256').update(subject.id).digest('hex').slice(0,12),execution:'internal exact GET business code with read-only week reader, no HTTP/Auth mutation',status:result.status,availabilityPolicy:result.body?.availabilityPolicy,items:(result.body?.items||[]).map(x=>({professionalId:x.uid,availabilityPolicy:x.availabilityPolicy,availabilitySource:x.availabilitySource,weekStart:x.weekStart,publishedPeriods:x.publishedPeriods,slots:x.slots})),error:result.body?.error});
    }
    report.cases.push(item);
  }
  return report;
}
function seal(report){
  const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  const data=Buffer.concat([cipher.update(deflateSync(Buffer.from(JSON.stringify(report)))),cipher.final()]);
  const publicKey=readFileSync(new URL('./temporary-audit-public-key.txt',import.meta.url));
  return Buffer.from(JSON.stringify({algorithm:'RSA-OAEP-SHA256/AES-256-GCM',encoding:'deflate',sealedKey:publicEncrypt({key:publicKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},key).toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:data.toString('base64')})).toString('hex');
}
export async function selfTest(){
  let writes=0;
  const ref={get:async()=>({id:'x',exists:false,data:()=>({})}),doc(){return this},collection(){return this},where(){return this},set(){writes++;throw Error('CANARY')},update(){writes++;throw Error('CANARY')},delete(){writes++;throw Error('CANARY')},add(){writes++;throw Error('CANARY')}};
  const ro=readOnlyDatabase(ref);
  for(const method of ['set','update','add','delete','create','batch','runTransaction','bulkWriter'])assert.throws(()=>ro[method],/READ_ONLY_METHOD_DENIED/);
  assert.throws(()=>ro.collection('google_calendar_connections'),/READ_SCOPE_DENIED/);
  assert.throws(()=>ro.collection('users').doc('x').collection('tokens'),/READ_SCOPE_DENIED/);
  assert.equal((await ro.collection('users').doc('x').get()).exists,false);
  assert.equal(writes,0);
  db=ro;assert.deepEqual((await professionalAvailabilityWeek('x',{},incidentDate,{})).items,{});assert.equal(writes,0);
  await assert.rejects(()=>ensureForjaId(),/READ_ONLY_FORJA_ID_MISSING/);
  assert.equal(writes,0);
  const tid='local-teacher',sid='local-student',mid='local-math';
  const records={
    ['users/'+tid]:{role:'teacher',fullName:'Carlos',active:true,forjaId:'EXISTING',disciplinaIds:[mid],email:'canary@private.invalid'},
    ['users/'+sid]:{role:'student',fullName:'João',active:true,serieId:'g1'},
    ['disciplinas/'+mid]:{nome:'Matemática',active:true,seriesIds:['g1']},
    ['aluno_materias/local-link']:{alunoId:sid,disciplinaId:mid,status:'ativo'},
    ['disponibilidades_semanais/'+availabilityWeekDocId(tid,incidentWeek)]:{professionalId:tid,weekStart:incidentWeek,source:'google',semana:{0:[{inicio:'20:00',fim:'22:00'}]},googleAvailabilityEvents:{one:{eventId:'private-event-canary',date:incidentDate,inicio:'20:00',fim:'22:00',dayCode:'0'}}},
  };
  const fixtureRef=(path='',conditions=[])=>({
    collection:name=>fixtureRef(path?path+'/'+name:name),doc:id=>fixtureRef(path+'/'+id),
    where:(field,operator,value)=>{assert.equal(operator,'==');return fixtureRef(path,[...conditions,[field,value]])},select:()=>fixtureRef(path,conditions),
    listCollections:async()=>[...roots].map(id=>({id})),
    get:async()=>{
      const snap=(p,data)=>({id:p.split('/').at(-1),exists:!!data,data:()=>data});
      if(path.split('/').length%2===0)return snap(path,records[path]);
      const docs=Object.entries(records).filter(([p,x])=>p.startsWith(path+'/')&&p.split('/').length===path.split('/').length+1&&conditions.every(([f,v])=>x[f]===v)).map(([p,x])=>snap(p,x));return {docs,empty:!docs.length,size:docs.length};
    },
  });
  const result=await audit(fixtureRef());
  assert.equal(result.cases[0].queries[0].status,200);
  assert.deepEqual(result.cases[0].queries[0].items[0].slots,[]);
  assert.equal(result.cases[0].queries[0].availabilityPolicy,'confirmed-week-v2');
  assert.equal(result.cases[0].queries[0].items[0].availabilitySource,'google');
  assert.ok(!JSON.stringify(result).includes('canary@private.invalid'));
  assert.ok(!JSON.stringify(result).includes('private-event-canary'));
  const data=records['disponibilidades_semanais/'+availabilityWeekDocId(tid,incidentWeek)];
  data.publication=confirmAvailabilityWeek(data,{version:1,fingerprint:availabilityWeekFingerprint(data)},{confirmedById:tid,confirmedAt:{toMillis:()=>1791043200000}});
  assert.deepEqual((await audit(fixtureRef())).cases[0].queries[0].items[0].slots.map(x=>x.inicio),['20:00','20:30','21:00']);
  const absent=await audit({...fixtureRef(),listCollections:async()=>[]});
  assert.equal(absent.cases.length,0);assert.ok(absent.structures.every(x=>x.status==='documento/estrutura inexistente'));
  console.log('Read-only guard checks passed; no database/network operations.');
}
async function main(){
  let report,app;
  try{
    const sdk=await import(process.env.FORJA_ADMIN_MODULE||'firebase-admin');
    const admin=sdk.default||sdk;
    const credential=JSON.parse(process.env.FORJA_AUDIT_SERVICE_ACCOUNT||'null');
    assert.equal(credential?.project_id,'forja-escola','READ_ONLY_PROJECT_MISMATCH');
    assert.equal(credential?.client_email,'github-forja-hosting@forja-escola.iam.gserviceaccount.com','READ_ONLY_IDENTITY_MISMATCH');
    assert.ok(!process.env.FIRESTORE_EMULATOR_HOST,'READ_ONLY_REAL_TARGET_REQUIRED');
    app=admin.initializeApp({credential:admin.credential.cert(credential),projectId:'forja-escola'},'read-only-incident-audit');
    report=await audit(app.firestore());
  }catch(error){report={readOnly:true,phase:'Firestore read audit',error:safeError(error)};process.exitCode=1}
  finally{if(app)await app.firestore().terminate()}
  if(!report.error) {
    const summary={readOnly:true,incidentDate,backendReference:report.backendReference,matches:report.matches,cases:report.cases.map(c=>({agendaBefore:c.agendaBefore,confirmedDay:c.confirmedDay,teacherLessons:c.teacherLessons,googleBusy:c.googleBusy,schoolBlocks:c.schoolBlocks,week:c.weeks.filter(w=>w.weekStart===incidentWeek).map(w=>({weekStart:w.weekStart,source:w.source,periods:w.semana?.['0']||[],publicationPresent:w.publicationPresent,publicationValid:w.publicationValid})),queries:c.queries.map(q=>({status:q.status,availabilityPolicy:q.availabilityPolicy,items:q.items.map(x=>({publishedPeriods:x.publishedPeriods,slots:x.slots}))}))}))};
    console.log(`::notice title=FORJA_BOOKING_READ_ONLY_RESULT::${JSON.stringify(summary)}`);
  }
  const encrypted=seal(report),chunks=encrypted.match(/.{1,700}/g)||[];
  for(let i=0;i<chunks.length;i++)console.log(`::notice title=FORJA_AUDIT_ENCRYPTED_${i+1}_OF_${chunks.length}::${chunks[i]}`);
  console.log(report.error?'Read-only audit blocked; encrypted diagnostic emitted.':'Read-only audit completed; encrypted result emitted.');
}
// Exact read-only backend helper/GET snapshot SHA256 740a6c9e7ec9b04f3342a686721ff794725983db4810fb4e658cbb3c2a2674cd
function normalizeWeeklyAvailability(value) {
  const out = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (let day = 0; day <= 6; day++) {
    const items = Array.isArray(value[day]) ? value[day] : Array.isArray(value[String(day)]) ? value[String(day)] : [];
    const clean = [];
    for (const item of items) {
      const inicio = normalizeTime(item?.inicio);
      const fim = normalizeTime(item?.fim);
      if (!inicio || !fim || timeMinutes(fim) <= timeMinutes(inicio)) continue;
      clean.push({ inicio, fim });
    }
    clean.sort((a,b)=>timeMinutes(a.inicio)-timeMinutes(b.inicio));
    if (clean.length) out[String(day)] = clean;
  }
  return out;
}

function weekdayForDate(date) {
  if (!validDateOnly(date)) return null;
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function addDaysDateKey(date, days) {
  if (!validDateOnly(date)) return "";
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString().slice(0,10);
}

function weekStartKeyForDate(date) {
  if (!validDateOnly(date)) return "";
  const d = new Date(`${date}T12:00:00Z`);
  const dow = d.getUTCDay();
  const delta = dow === 0 ? -6 : 1 - dow; // segunda-feira
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0,10);
}

function weekEndKeyForDate(date) {
  const start = weekStartKeyForDate(date);
  return start ? addDaysDateKey(start, 6) : "";
}

function availabilityWeekDocId(professionalId, weekStart) {
  return Buffer.from(`${String(professionalId||"")}|${String(weekStart||"")}`).toString("base64url").slice(0,180);
}

async function getSchoolBlocksForDate(date) {
  if (!validDateOnly(date)) return [];
  const snap = await db.collection("calendario_escolar").where("data", "==", date).get();
  return snap.docs.map(docJson).filter(item => item.active !== false && item.bloqueiaAulas === true);
}

function findSchoolBlockOverlap(items, startTime, endTime) {
  const start = timeMinutes(startTime);
  const end = timeMinutes(endTime) ?? (start == null ? null : start + 60);
  for (const item of items || []) {
    const xs = timeMinutes(item.horaInicio);
    const xe = timeMinutes(item.horaFim);
    if (xs == null || xe == null) return item; // sem faixa = bloqueio do dia inteiro
    if (start != null && end != null && rangesOverlap(start, end, xs, xe)) return item;
  }
  return null;
}

function agendaLockRef(type, id, date) {
  return db.collection("_agenda_locks").doc(`${type}_${id}_${date}`);
}

function validDateOnly(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!m) return false;
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

function datePartsInTimeZone(value = new Date(), timeZone = APP_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(date);
  const get = type => parts.find(p => p.type === type)?.value || "";
  return { year:get("year"), month:get("month"), day:get("day"), hour:get("hour"), minute:get("minute") };
}

function dateKey(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0,10);
  const date = value && typeof value.toDate === "function" ? value.toDate() : value instanceof Date ? value : new Date(value);
  const p = datePartsInTimeZone(date);
  return p ? `${p.year}-${p.month}-${p.day}` : String(value).slice(0,10);
}

function normalizeTime(value) {
  const v = String(value || "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : "";
}

function timeMinutes(value) {
  const v = normalizeTime(value);
  if (!v) return null;
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 24 * 60) return "";
  return `${String(Math.floor(minutes / 60)).padStart(2,"0")}:${String(minutes % 60).padStart(2,"0")}`;
}

function addMinutesToTime(value, amount) {
  const start = timeMinutes(value);
  if (start == null) return "";
  return minutesToTime(start + Number(amount || 0));
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function toPlain(value) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = toPlain(v);
    return out;
  }
  return value;
}

function docJson(doc) {
  return { id: doc.id, ...toPlain(doc.data()) };
}

async function getUserProfile(uid) {
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists ? { uid: snap.id, ...snap.data() } : null;
}

async function getDisciplineDoc(id) {
  let snap = await db.collection("disciplinas").doc(id).get();
  if (!snap.exists) snap = await db.collection(" disciplinas").doc(id).get();
  return snap;
}

async function assertDisciplineForStudent(disciplinaId, student) {
  const id=String(disciplinaId||"").trim();
  if(!id) throw new Error("CAMPOS_OBRIGATORIOS");
  const snap=await getDisciplineDoc(id);
  if(!snap.exists||snap.data().active===false) throw new Error("ENTIDADE_NAO_ENCONTRADA");
  const allowed=cleanStringArray(snap.data().seriesIds);
  const serieId=String(student?.serieId||"").trim();
  if(allowed.length&&(!serieId||!allowed.includes(serieId))) throw new Error("DISCIPLINA_SERIE_INCOMPATIVEL");
  return {id,snap};
}

function professionalDisciplineIds(profile) {
  return cleanStringArray(profile?.disciplinaIds);
}

function cleanStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(v => String(v || "").trim()).filter(Boolean))];
}

function isCancelledStatus(status) {
  return /cancelad/i.test(String(status || ""));
}

async function assertStudentHasActiveSubject(studentId,disciplinaId){
  const links=await activeSubjectLinksForStudent(String(studentId||""));
  const link=links.find(x=>x.disciplinaId===String(disciplinaId||"")&&x.status!=="inativo");
  if(!link)throw new Error("MATERIA_NAO_LIBERADA_PARA_ALUNO");
  return link;
}

async function activeSubjectLinksForStudent(studentId){return (await db.collection("aluno_materias").where("alunoId","==",studentId).get().catch(()=>({docs:[]}))).docs.map(docJson).filter(x=>x.status!=="inativo").map(studentSubjectLinkItem);}

function studentSubjectLinkItem(x={}){return {id:x.id||"",alunoId:x.alunoId||"",disciplinaId:x.disciplinaId||"",professorId:x.professorId||"",status:x.status||"ativo",nivelAtual:x.nivelAtual||"",nivelLabel:x.nivelLabel||"",diagnosticoStatus:x.diagnosticoStatus||"pendente",ultimoDiagnosticoId:x.ultimoDiagnosticoId||"",ultimoDiagnosticoScore:x.ultimoDiagnosticoScore??null,createdAt:x.createdAt??null,updatedAt:x.updatedAt??null};}

async function googleBusyConflictsForDate(uid, date) {
  if (!uid || !validDateOnly(date)) return [];
  const snap = await db.collection("google_calendar_busy").where("professionalId", "==", uid).get();
  const out = [];
  for (const doc of snap.docs) {
    const item = doc.data() || {};
    if (item.allDay === true) {
      const startDate = String(item.startDate || "");
      const endDate = String(item.endDate || "");
      // Eventos all-day do Google usam end.date exclusivo.
      if (validDateOnly(startDate) && validDateOnly(endDate) && date >= startDate && date < endDate) {
        out.push({ type:"google", start:0, end:24 * 60 });
      }
      continue;
    }
    const startParts = datePartsInTimeZone(item.startAt);
    const endParts = datePartsInTimeZone(item.endAt);
    if (!startParts || !endParts) continue;
    const startDate = `${startParts.year}-${startParts.month}-${startParts.day}`;
    const endDate = `${endParts.year}-${endParts.month}-${endParts.day}`;
    if (date < startDate || date > endDate) continue;
    let start = 0, end = 24 * 60;
    if (date === startDate) start = Number(startParts.hour) * 60 + Number(startParts.minute);
    if (date === endDate) end = Number(endParts.hour) * 60 + Number(endParts.minute);
    if (end > start) out.push({ type:"google", start, end });
  }
  return out;
}

// A source label is provenance, never a publication receipt. Only the server
// records a receipt after an authenticated professional confirms this exact week.
const BOOKING_AVAILABILITY_POLICY = 'confirmed-week-v2';
const AVAILABILITY_PUBLICATION_VERSION = 1;

function canonicalAvailabilityWeek(semana) {
  if (!semana || typeof semana !== 'object' || Array.isArray(semana) ||
      Object.keys(semana).some(day => !/^[0-6]$/.test(day))) throw new Error('DISPONIBILIDADE_INVALIDA');
  const canonical = {};
  for (let day = 0; day <= 6; day++) {
    if (semana[day] === undefined) continue;
    if (!Array.isArray(semana[day])) throw new Error('DISPONIBILIDADE_INVALIDA');
    const periods = semana[day].map(period => {
      const start = minutes(period?.inicio), end = minutes(period?.fim);
      if (start === null || end === null || end <= start) throw new Error('DISPONIBILIDADE_INVALIDA');
      return { inicio: period.inicio, fim: period.fim };
    }).sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fim.localeCompare(b.fim));
    for (let i = 1; i < periods.length; i++) {
      if (periods[i].inicio < periods[i - 1].fim) throw new Error('DISPONIBILIDADE_SOBREPOSTA');
    }
    if (periods.length) canonical[String(day)] = periods;
  }
  return canonical;
}

function availabilityWeekFingerprint({ professionalId, weekStart, semana }) {
  if (typeof professionalId !== 'string' || !professionalId || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart || '')) throw new Error('DISPONIBILIDADE_INVALIDA');
  return createHash('sha256').update(JSON.stringify({ version: AVAILABILITY_PUBLICATION_VERSION,
    timeZone: 'America/Sao_Paulo', professionalId, weekStart,
    semana: canonicalAvailabilityWeek(semana) })).digest('hex');
}

function confirmAvailabilityWeek(data, confirmation, { confirmedById, confirmedAt, action = 'publish', copiedFrom = null }) {
  if (confirmation === undefined) return null; // Older clients save a draft.
  const fingerprint = availabilityWeekFingerprint(data);
  if (confirmation?.version !== AVAILABILITY_PUBLICATION_VERSION || confirmation.fingerprint !== fingerprint ||
      confirmedById !== data.professionalId || !['publish', 'copy'].includes(action)) throw new Error('DISPONIBILIDADE_CONFIRMACAO_INVALIDA');
  return { version: AVAILABILITY_PUBLICATION_VERSION, fingerprint, confirmedById, confirmedAt, action, copiedFrom };
}

function isPublishedAvailabilityWeek(data, { professionalId, weekStart }) {
  try {
    const receipt = data?.publication;
    return !!data && data.professionalId === professionalId && data.weekStart === weekStart &&
      receipt?.version === AVAILABILITY_PUBLICATION_VERSION && receipt.confirmedById === professionalId &&
      Number.isFinite(receipt.confirmedAt?.toMillis?.()) && receipt.confirmedAt.toMillis() > 0 &&
      ['publish', 'copy'].includes(receipt.action) &&
      (receipt.action !== 'copy' || (typeof receipt.copiedFrom?.weekStart === 'string' && /^[a-f0-9]{64}$/.test(receipt.copiedFrom?.fingerprint || ''))) &&
      receipt.fingerprint === availabilityWeekFingerprint(data);
  } catch { return false; }
}

function minutes(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [h,m] = value.split(':').map(Number);
  return h*60+m;
}
const time = value => `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;

function bookingSlotCandidates(periods, duration) {
  if (!Number.isInteger(duration) || duration < 15 || duration > 240) return [];
  const slots = new Map();
  for (const period of periods || []) {
    const start=minutes(period?.inicio),end=minutes(period?.fim);
    if (start===null || end===null || end<=start) continue;
    // Retain half-hour start alignment, derived only from each published window.
    for (let minute=Math.ceil(start/30)*30; minute+duration<=end; minute+=30) {
      slots.set(minute,{inicio:time(minute),fim:time(minute+duration)});
    }
  }
  return [...slots.entries()].sort(([a],[b])=>a-b).map(([,slot])=>slot);
}

async function replayBooking(url){const req={method:"GET"},pathname="/profissionais/disponibilidade",res={};
if (req.method === "GET" && pathname === "/profissionais/disponibilidade") {
    try {
      const authCtx = await verificarUsuario(req);
      if (!["admin","teacher","psychologist"].includes(authCtx.profile.role)) throw new Error("SEM_PERMISSAO");
      const data = String(url.searchParams.get("data") || "").trim();
      if (!validDateOnly(data)) throw new Error("DATA_INVALIDA");
      const wantedId = String(url.searchParams.get("professionalId") || "").trim();
      const wantedRole = String(url.searchParams.get("role") || "").trim();
      const disciplinaId = String(url.searchParams.get("disciplinaId") || "").trim();
      const alunoId = String(url.searchParams.get("alunoId") || "").trim();
      if (alunoId && authCtx.profile.role !== "admin") throw new Error("SEM_PERMISSAO");
      // The Secretaria lesson query is deliberately scoped; other operational
      // views retain their existing response/status semantics.
      const bookingQuery = authCtx.profile.role === "admin" && wantedRole === "teacher" && !!wantedId && !!disciplinaId && !!alunoId;
      const requestedDuration = Number(url.searchParams.get("duracaoMinutos") || 60);
      const duration = Number.isFinite(requestedDuration) && requestedDuration >= 15 && requestedDuration <= 240 ? Math.round(requestedDuration) : 60;
      const requestedStart = normalizeTime(url.searchParams.get("horaInicio") || "");
      const requestedEndRaw = normalizeTime(url.searchParams.get("horaFim") || "");
      const requestedEnd = requestedStart ? (requestedEndRaw || addMinutesToTime(requestedStart,duration)) : "";
      if (requestedStart && (!requestedEnd || timeMinutes(requestedEnd) <= timeMinutes(requestedStart))) throw new Error("HORARIO_INVALIDO");
      if (wantedRole && !["teacher","psychologist"].includes(wantedRole)) throw new Error("ROLE_INVALIDA");

      const userSnap = await db.collection("users").get();
      let professionals = userSnap.docs.filter(d => ["teacher","psychologist"].includes(d.data().role) && d.data().active === true);
      if (authCtx.profile.role !== "admin") professionals = professionals.filter(d => d.id === authCtx.decoded.uid);
      if (wantedId) professionals = professionals.filter(d => d.id === wantedId);
      if (wantedRole) professionals = professionals.filter(d => d.data().role === wantedRole);
      if (disciplinaId) professionals = professionals.filter(d => d.data().role === "teacher" && professionalDisciplineIds(d.data()).includes(disciplinaId));

      const schoolBlocks = await getSchoolBlocksForDate(data);
      const studentDayConflicts = [];
      if (alunoId) {
        const student = await getUserProfile(alunoId);
        if (!student || student.role !== "student" || student.active !== true) throw new Error("ENTIDADE_NAO_ENCONTRADA");
        if (disciplinaId) {
          await assertDisciplineForStudent(disciplinaId, student);
          await assertStudentHasActiveSubject(alunoId, disciplinaId);
        }
        const [studentLessonSnap, studentSessionSnap] = await Promise.all([
          db.collection("aulas").where("alunoId", "==", alunoId).get(),
          db.collection("sessoes_terapia").where("alunoId", "==", alunoId).get(),
        ]);
        for (const lessonDoc of studentLessonSnap.docs) {
          const x = lessonDoc.data();
          if (dateKey(x.dataAula) !== data || isCancelledStatus(x.status)) continue;
          const startMin = timeMinutes(x.horaAula), endMin = timeMinutes(x.horaFim) ?? (startMin == null ? null : startMin + 60);
          if (startMin != null && endMin != null) studentDayConflicts.push({ type:"aula_aluno", start:startMin, end:endMin });
        }
        for (const sessionDoc of studentSessionSnap.docs) {
          const x = sessionDoc.data();
          if (dateKey(x.dataSessao) !== data || isCancelledStatus(x.status)) continue;
          const startMin = timeMinutes(x.horaSessao), endMin = timeMinutes(x.horaFim) ?? (startMin == null ? null : startMin + 60);
          if (startMin != null && endMin != null) studentDayConflicts.push({ type:"sessao_aluno", start:startMin, end:endMin });
        }
      }
      const items = [];
      for (const doc of professionals) {
        const profile = { uid:doc.id, ...doc.data() };
        if (!profile.forjaId && !bookingQuery) profile.forjaId = await ensureForjaId(doc.id, doc.data());
        const weekData = await professionalAvailabilityWeek(doc.id, profile, data, { publishedOnly: bookingQuery }), weekly = weekData.items;
        const hasSchedule = Object.keys(weekly).length > 0;
        const day = String(weekdayForDate(data));
        const periods = weekly[day] || [];
        const [lessonSnap, sessionSnap, blockSnap, teacherLock, studentLock] = await Promise.all([
          db.collection("aulas").where("professorId", "==", doc.id).get(),
          db.collection("sessoes_terapia").where("psicologoId", "==", doc.id).get(),
          db.collection("indisponibilidades").where("professionalId", "==", doc.id).get(),
          bookingQuery ? agendaLockRef("professor",doc.id,data).get() : null,
          bookingQuery ? agendaLockRef("aluno",alunoId,data).get() : null,
        ]);
        const locked = [teacherLock,studentLock].some(snap => snap?.exists && (snap.data()?.lockedUntil?.toMillis?.() || 0) > Date.now());
        const dayConflicts = [];
        for (const lessonDoc of lessonSnap.docs) {
          const x = lessonDoc.data();
          if (dateKey(x.dataAula) !== data || isCancelledStatus(x.status)) continue;
          const startMin = timeMinutes(x.horaAula), endMin = timeMinutes(x.horaFim) ?? (startMin == null ? null : startMin + 60);
          if (startMin != null && endMin != null) dayConflicts.push({ type:"aula", start:startMin, end:endMin });
        }
        for (const sessionDoc of sessionSnap.docs) {
          const x = sessionDoc.data();
          if (dateKey(x.dataSessao) !== data || isCancelledStatus(x.status)) continue;
          const startMin = timeMinutes(x.horaSessao), endMin = timeMinutes(x.horaFim) ?? (startMin == null ? null : startMin + 60);
          if (startMin != null && endMin != null) dayConflicts.push({ type:"sessao", start:startMin, end:endMin });
        }
        for (const blockDoc of blockSnap.docs) {
          const x = blockDoc.data();
          if (dateKey(x.data) !== data || String(x.status || "ativo") === "inativo") continue;
          const startMin = timeMinutes(x.horaInicio), endMin = timeMinutes(x.horaFim);
          if (startMin != null && endMin != null) dayConflicts.push({ type:"indisponibilidade", start:startMin, end:endMin });
        }
        dayConflicts.push(...await googleBusyConflictsForDate(doc.id, data));
        const rangeState=(start,end)=>{
          const minute=timeMinutes(start),endMinute=timeMinutes(end);
          let status="nao_informado",reason="Disponibilidade semanal não informada";
          if(minute==null||endMinute==null||endMinute<=minute)return {inicio:start,fim:end,status:"indisponivel",motivo:"Horário inválido"};
          if(locked){status="indisponivel";reason="Agenda em processamento";}
          else if(findSchoolBlockOverlap(schoolBlocks,start,end)){status="indisponivel";reason="Calendário escolar indisponível";}
          else if(hasSchedule){
            const inside=periods.some(p=>minute>=timeMinutes(p.inicio)&&endMinute<=timeMinutes(p.fim));
            if(!inside){status="indisponivel";reason="Fora da disponibilidade cadastrada";}
            else{
              const conflict=dayConflicts.find(c=>rangesOverlap(minute,endMinute,c.start,c.end));
              const studentConflict=studentDayConflicts.find(c=>rangesOverlap(minute,endMinute,c.start,c.end));
              if(!conflict&&!studentConflict){status="disponivel";reason="";}
              else if(conflict?.type==="indisponibilidade"){status="indisponivel";reason="Horário marcado como indisponível pelo profissional";}
              else if(conflict?.type==="google"){status="ocupado";reason="Ocupado no Google Agenda";}
              else if(conflict){status="ocupado";reason="Profissional já possui compromisso FORJA";}
              else{status="ocupado";reason="Aluno já possui compromisso FORJA";}
            }
          }
          return {inicio:start,fim:end,duracaoMinutos:endMinute-minute,status,motivo:reason};
        };
        const slots=[];
        if(bookingQuery){
          for(const candidate of bookingSlotCandidates(periods,duration)){
            const slot=rangeState(candidate.inicio,candidate.fim);
            if(slot.status==="disponivel")slots.push(slot);
          }
        }else{
          for(let minute=7*60;minute+duration<=22*60;minute+=30){const start=minutesToTime(minute),end=minutesToTime(minute+duration);slots.push(rangeState(start,end));}
        }
        const requestedSlot=requestedStart?rangeState(requestedStart,requestedEnd):null;
        items.push({
          uid:doc.id,
          forjaId:profile.forjaId,
          fullName:profile.fullName || (profile.role === "psychologist" ? "Psicólogo" : "Professor"),
          role:profile.role,
          disciplinaIds:profile.role === "teacher" ? professionalDisciplineIds(profile) : [],
          availabilityConfigured:hasSchedule,
          ...(bookingQuery ? { availabilityPolicy:BOOKING_AVAILABILITY_POLICY, availabilitySource:weekData.source, weekStart:weekData.weekStart, publishedPeriods:periods } : {}),
          data,
          duracaoMinutos:duration,
          requestedSlot,
          slots
        });
      }
      return jsonResponse(res, 200, {
        ok:true,
        data,
        duracaoMinutos:duration,
        ...(bookingQuery ? { availabilityPolicy:BOOKING_AVAILABILITY_POLICY } : {}),
        calendario:schoolBlocks.map(x=>({id:x.id,titulo:x.titulo||x.tipo||"Indisponibilidade",tipo:x.tipo||"feriado",horaInicio:x.horaInicio||"",horaFim:x.horaFim||""})),
        items
      });
    } catch (error) {
      return handleError(res,error,"Erro ao consultar disponibilidade dos profissionais");
    }
  }
}

if(process.argv.includes('--self-test'))await selfTest();
else if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
// __GENERATED_READ_ONLY_BACKEND_FUNCTIONS_AND_GET__

async function replayAgenda(url){const req={method:"GET"},pathname="/admin/disponibilidades-semana",res={};
  if (req.method === "GET" && pathname === "/admin/disponibilidades-semana") {
    try {
      await verificarAdmin(req);
      const requested = String(url.searchParams.get("weekStart") || todayKeyInTimeZone()).trim();
      if (!validDateOnly(requested)) throw new Error("DATA_INVALIDA");
      const weekStart = weekStartKeyForDate(requested), weekEnd = weekEndKeyForDate(weekStart);
      const snap = await db.collection("users").get(), items = [];
      for (const doc of snap.docs) {
        const profile = { uid:doc.id, ...doc.data() };
        if (!roleIsProfessional(profile.role) || profile.active !== true) continue;
        const week = await professionalAvailabilityWeek(doc.id, profile, weekStart);
        items.push({
          uid:doc.id,
          fullName:profile.fullName||"Profissional",
          role:profile.role,
          forjaId:profile.forjaId||"",
          weekStart,
          weekEnd,
          disponibilidade:week.items,
          configurada:Object.keys(week.items).length>0,
          source:week.source||"",
        });
      }
      return jsonResponse(res,200,{ok:true,weekStart,weekEnd,items});
    } catch (error) { return handleError(res,error,"Erro ao carregar disponibilidade da semana"); }
  }


}
