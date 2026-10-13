// Temporary projected metadata read. Never import server/migration/sync helpers.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const admin=createRequire('/tmp/forja-readonly/package.json')('firebase-admin');
let report;
try{
 const account=JSON.parse(process.env.AUDIT_FIREBASE_ACCOUNT||'{}');
 if(account.project_id!=='forja-escola')throw Object.assign(Error('PROJECT_MISMATCH'),{code:'PROJECT_MISMATCH'});
 const app=admin.initializeApp({credential:admin.credential.cert(account),projectId:'forja-escola'}),db=app.firestore();
 const people=await db.collection('users').where('role','==','teacher').where('active','==',true).select('fullName').get();
 const matches=people.docs.filter(d=>/^carlos(?:\s|$)/i.test(String(d.data().fullName||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')));
 report={project:'forja-escola',readOnly:true,googleTokensRead:false,matchedActiveTeachers:matches.length};
 if(matches.length===1){
  const uid=matches[0].id;
  const result=await db.collection('google_calendar_connections').where(admin.firestore.FieldPath.documentId(),'==',uid).select('connected','status','lastSyncStatus','lastSyncSource','lastError','lastSyncAt','lastSyncAttemptAt','googleIdentity.verifiedAt').get();
  const data=result.docs[0]?.data()||{};
  const err=String(data.lastError||''),code=err.match(/GOOGLE_[A-Z_]+/)?.[0]||null,http=Number(err.match(/HTTP\s+(\d{3})/)?.[1])||null;
  const allowedStatus=new Set(['ok','erro','conectado','desconectado','sincronizado','pendente']);
  report.connection={type:'professor_pessoal',referenceHash:createHash('sha256').update(uid).digest('hex').slice(0,16),documentExists:result.size===1,connected:data.connected===true,status:allowedStatus.has(data.status)?data.status:null,lastSyncStatus:allowedStatus.has(data.lastSyncStatus)?data.lastSyncStatus:null,lastErrorCode:code,lastErrorHttp:http,identityVerified:!!data.googleIdentity?.verifiedAt,lastSyncAt:data.lastSyncAt?.toDate?.().toISOString()||null,lastSyncAttemptAt:data.lastSyncAttemptAt?.toDate?.().toISOString()||null};
 }
 await db.terminate();
}catch(error){report={readOnly:true,googleTokensRead:false,errorCode:['PROJECT_MISMATCH',7,'permission-denied','PERMISSION_DENIED'].includes(error?.code)?String(error.code):'READ_FAILED'};}
// Publish only the whitelist above, never raw errors, IDs, emails or credential data.
const response=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/check-runs`,{method:'POST',headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,'Content-Type':'application/json',Accept:'application/vnd.github+json'},body:JSON.stringify({name:'FORJA read-only booking metadata',head_sha:process.env.GITHUB_SHA,status:'completed',conclusion:'success',output:{title:'Projected metadata only; no Firestore writes or Google token reads',summary:'```json\n'+JSON.stringify(report,null,2)+'\n```'}})});
if(!response.ok)throw Error('AUDIT_CHECK_PUBLICATION_FAILED');
