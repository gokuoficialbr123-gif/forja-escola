// Included exclusively in the generated Preview artifact, never index.html/live.
// No real SDK, API request, Auth operation, email delivery or persistent user data.
(()=>{
 const user={uid:'DEMO_ADMIN',email:'admin@forja.invalid',emailVerified:true,getIdToken:async()=>'DEMO_NO_CREDENTIALS'};
 const users=[{uid:'DEMO_TEACHER',role:'teacher',active:true,fullName:'Professor de demonstração',forjaId:'DEMO-PROF-001',email:'professor@forja.invalid',cpf:'52998224725',phone:'11999990000',disciplinaIds:['demo-math']}];
 const auth={currentUser:user,setPersistence:async()=>{},onAuthStateChanged:cb=>{queueMicrotask(()=>cb(user));return()=>{}},signOut:async()=>{},sendPasswordResetEmail:async()=>{throw Error('E-mails reais bloqueados na simulação.')}};
 const factory=()=>auth;factory.Auth={Persistence:{SESSION:'session'}};
 window.FORJA_FIREBASE_CONFIG={apiKey:'DEMO_NO_KEY',projectId:'demo-forja',authDomain:'forja.invalid'};
 window.firebase={apps:[],initializeApp:()=>firebase.apps.push({}),auth:factory};
 const response=(value,status=200)=>Promise.resolve(new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}}));
 const invite=()=>{const mode=document.getElementById('forjaDemoOutcome')?.value||'accepted';return mode==='accepted'?{emailSent:true,invitationStatus:'accepted'}:mode==='rate_limited'?{emailSent:false,invitationStatus:'rate_limited',retryAfter:60,activationWarning:'Aguarde 60 segundos antes de solicitar outro convite.'}:{emailSent:false,invitationStatus:mode,activationWarning:'Envio automático não confirmado na simulação. Cadastro preservado.',activationLink:'https://forja-invite-demo.invalid/__/auth/action?mode=resetPassword&oobCode=SIMULADO_SEM_VALIDADE'}};
 window.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url,location.href),path=url.pathname,method=options.method||'GET';
  if(method==='POST'&&['/admin/usuarios','/admin/profissionais'].includes(path)){
   const body=JSON.parse(options.body||'{}');if(users.some(u=>u.email===body.email))return response({error:'Conta já existe na simulação. Use Reenviar convite.'},409);
   const uid='DEMO_USER_'+users.length,forjaId='DEMO-'+String(users.length).padStart(3,'0');users.push({...body,uid,forjaId,active:true});return response({ok:true,uid,forjaId,...invite()},201);
  }
  if(method==='POST'&&/^\/admin\/usuarios\/[^/]+\/reset-senha$/.test(path)){
   const result=invite();return response({ok:true,...result,resetLink:result.activationLink||null});
  }
  if(method!=='GET')return response({error:'Ação real bloqueada. Este Preview é uma simulação de cadastro e convite.'},403);
  if(path==='/me')return response({ok:true,profile:{...user,fullName:'Admin de demonstração',role:'admin',active:true}});
  if(path==='/admin/usuarios')return response({users});
  const target=path.match(/^\/admin\/usuarios\/([^/]+)$/);if(target){const profile=users.find(u=>u.uid===target[1]);return profile?response({user:{profile,auth:{...profile,emailVerified:false,disabled:false}},history:[]}):response({error:'Usuário não encontrado na simulação.'},404)}
  if(path==='/admin/catalogos/disciplinas')return response({items:[{id:'demo-math',nome:'Matemática',active:true},{id:'demo-language',nome:'Português',active:true}]});
  if(path==='/admin/catalogos/series')return response({items:[{id:'demo-serie',nome:'Série de demonstração',active:true}]});
  if(path==='/turmas')return response({items:[{id:'demo-class',nome:'Turma de demonstração',serieId:'demo-serie',active:true}]});
  if(path==='/admin/google-calendar/central/status')return response({configured:false,policy:'calendarlist-association-v2',freeBusyPolicy:'central-freebusy-query-v1',item:{connected:false}});
  if(path==='/admin/google-calendar/central/calendars')return response({items:[],teachers:[],connected:false});
  if(path==='/health')return response({ok:true});
  return response({items:[],users:[],item:{}});
 };
 window.XMLHttpRequest=class{constructor(){throw Error('Rede real bloqueada na simulação.')}};
 window.WebSocket=window.EventSource=window.XMLHttpRequest;
 navigator.sendBeacon=()=>false;
 addEventListener('DOMContentLoaded',()=>{
  const bar=document.createElement('div');bar.id='forjaInvitationDemo';bar.style.cssText='position:sticky;top:0;z-index:100000;background:#fff3cd;color:#503900;padding:10px 16px;font:13px system-ui;border-bottom:1px solid #dfc36c';
  bar.innerHTML='<b>SIMULAÇÃO SEGURA DE CONVITES</b> · Nenhuma conta real é criada; nenhum e-mail é enviado. Use somente dados fictícios. <label>Resultado simulado: <select id="forjaDemoOutcome"><option value="accepted">Solicitação aceita</option><option value="unavailable">Falha de envio</option><option value="not_configured">Chave ausente</option><option value="rate_limited">Limite de reenvio</option></select></label>';
  document.body.prepend(bar);
 });
})();
