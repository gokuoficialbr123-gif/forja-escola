// Preview-only presentation double; backend behavior is independently tested
// with REAL Auth/Firestore emulators. No SDK, credentials or real network calls.
(()=>{
 const baseFetch=window.fetch,day='2026-10-19',week='2026-10-19',teacher='DEMO_TEACHER',student='DEMO_STUDENT',subject='demo-math';
 const key='forja-synthetic-agenda-etapa4-v1';let googleUnavailable=false;
 const safeLesson=x=>x&&x.professorId===teacher&&x.alunoId===student&&x.dataAula===day&&/^\d{2}:\d{2}$/.test(x.horaAula)&&/^\d{2}:\d{2}$/.test(x.horaFim);
 let lessons=[];try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))lessons=saved.filter(safeLesson).slice(0,20).map(x=>({id:String(x.id).replace(/[^a-z0-9-]/g,''),professorId:teacher,alunoId:student,disciplinaId:subject,nomeProfessor:'Júlio fictício',nomeAluno:'Aluno fictício',dataAula:day,horaAula:x.horaAula,horaFim:x.horaFim,status:x.status==='cancelada'?'cancelada':'agendada',modalidade:'presencial',localAula:'Sala sintética'}));}catch{}
 const response=(body,status=200)=>Promise.resolve(new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}));
 const minute=x=>Number(String(x).slice(0,2))*60+Number(String(x).slice(3));
 const time=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 const overlap=(a,b,c,d)=>a<d&&b>c;
 function validate(body,ignore=''){
   if(googleUnavailable)return {error:'Google central simulado indisponível. Nenhum horário foi confirmado como livre.',code:'CENTRAL_BOOKING_UNAVAILABLE',status:503};
   if(body.professorId!==teacher||body.alunoId!==student||body.disciplinaId!==subject||body.dataAula!==day)return {error:'Use somente o professor, aluno, matéria e data do cenário sintético.',status:400};
   const a=minute(body.horaAula),b=minute(body.horaFim);if(!Number.isFinite(a)||!Number.isFinite(b)||a<780||b>1080||b<=a)return {error:'Fora da disponibilidade publicada do cenário.',status:409};
   if(overlap(a,b,840,900))return {error:'O profissional está ocupado no Google Agenda neste horário (simulação).',code:'PROFISSIONAL_OCUPADO_GOOGLE',status:409};
   if(lessons.some(x=>x.id!==ignore&&x.status!=='cancelada'&&overlap(a,b,minute(x.horaAula),minute(x.horaFim))))return {error:'Aula conflitante no cenário sintético.',status:409};
   return null;
 }
 const persist=()=>{try{localStorage.setItem(key,JSON.stringify(lessons))}catch{}};
 window.fetch=async(input,options={})=>{
   const url=new URL(typeof input==='string'?input:input.url,location.href),path=url.pathname,method=options.method||'GET';
   const body=JSON.parse(options.body||'{}');
   if(path==='/admin/agenda/google-central-busy'&&method==='GET'){
     const from=url.searchParams.get('from'),to=url.searchParams.get('to');
     return response({policy:'central-booking-fail-closed-v1',from,to,status:googleUnavailable?'unavailable':'success',complete:!googleUnavailable,
       unavailable:googleUnavailable?[{professionalId:teacher,reason:'central_unavailable'}]:[],items:!googleUnavailable&&from<=day&&to>=day?[{professionalId:teacher,startAt:day+'T17:00:00Z',endAt:day+'T18:00:00Z',title:'Ocupado',source:'google-central'}]:[]});
   }
   if(method==='GET'&&path==='/admin/usuarios'){
     const r=await baseFetch(input,options),data=await r.json();data.users=data.users.map(x=>({...x,fullName:'Júlio fictício',disciplinaIds:[subject]}));
     data.users.push({uid:student,role:'student',active:true,fullName:'Aluno fictício',forjaId:'DEMO-ALUNO-001',serieId:'demo-serie',email:'aluno@forja.invalid'});return response(data);
   }
   if(method==='GET'&&['/alunos','/admin/aluno-materias'].includes(path))return response({items:path==='/alunos'?[{uid:student,role:'student',active:true,fullName:'Aluno fictício',forjaId:'DEMO-ALUNO-001',serieId:'demo-serie'}]:[{id:'DEMO_LINK',alunoId:student,disciplinaId:subject,status:'ativo'}]});
   if(method==='GET'&&path==='/admin/disponibilidades-semana'){
     const requested=url.searchParams.get('weekStart');return response({weekStart:requested,items:[{uid:teacher,role:'teacher',weekStart:requested,fullName:'Júlio fictício',availabilityPolicy:'confirmed-week-v2',publicationValid:requested===week,disponibilidade:requested===week?{1:[{inicio:'13:00',fim:'18:00'}]}:{}}]});
   }
   if(method==='GET'&&path==='/profissionais/disponibilidade'){
     if(googleUnavailable)return response({error:'Consulta Google central simulado indisponível.',code:'CENTRAL_BOOKING_UNAVAILABLE'},503);
     const date=url.searchParams.get('data'),duration=Number(url.searchParams.get('duracaoMinutos')||60),slots=[];
     if(date===day&&url.searchParams.get('professionalId')===teacher&&url.searchParams.get('alunoId')===student&&url.searchParams.get('disciplinaId')===subject&&duration>=15&&duration<=240)
       for(let a=780;a+duration<=1080;a+=30){const b=a+duration;if(!validate({professorId:teacher,alunoId:student,disciplinaId:subject,dataAula:day,horaAula:time(a),horaFim:time(b)}))slots.push({inicio:time(a),fim:time(b),status:'disponivel'});}
     return response({availabilityPolicy:'confirmed-week-v2',centralBookingPolicy:'central-booking-fail-closed-v1',items:[{uid:teacher,slots}]});
   }
   if(path==='/aulas'&&method==='GET')return response({items:lessons});
   const match=path.match(/^\/aulas\/([a-z0-9-]+)(\/cancelar)?$/);
   if(method==='POST'&&path==='/aulas'){
     const error=validate(body);if(error)return response(error,error.status);
     const item={id:'demo-'+crypto.randomUUID(),professorId:teacher,alunoId:student,disciplinaId:subject,nomeProfessor:'Júlio fictício',nomeAluno:'Aluno fictício',dataAula:day,horaAula:body.horaAula,horaFim:body.horaFim,status:'agendada',modalidade:'presencial',localAula:'Sala sintética'};
     lessons.push(item);persist();return response({ok:true,item},201);
   }
   if(match){const item=lessons.find(x=>x.id===match[1]);if(!item)return response({error:'Aula sintética inexistente.'},404);
     if(method==='GET')return response({item});
     if(method==='PATCH'){if(match[2])item.status='cancelada';else{const next={...item,...body},error=validate(next,item.id);if(error)return response(error,error.status);item.horaAula=next.horaAula;item.horaFim=next.horaFim;}persist();return response({ok:true,item});}
   }
   if(method!=='GET')return response({error:'Somente operações de aula do cenário sintético são permitidas. Nenhuma ação real é executada.'},403);
   return baseFetch(input,options);
 };
 addEventListener('DOMContentLoaded',()=>{
   const bar=document.getElementById('forjaInvitationDemo');
   if(!bar)return;const open=document.createElement('button');open.textContent='Abrir cenário: 19/10/2026';open.onclick=()=>{state.adminLessonAgendaDateG=day;state.adminLessonAgendaViewG='day';navigate('agenda');const field=document.querySelector('[data-v621-date]');if(field){field.value=day;field.dispatchEvent(new Event('change',{bubbles:true}));}};bar.append(' ',open);
   const blocked=document.createElement('button');blocked.textContent='Testar bloqueio 14:00 (sintético)';blocked.onclick=async()=>{try{await api('/aulas',{method:'POST',body:{professorId:teacher,alunoId:student,disciplinaId:subject,dataAula:day,horaAula:'14:00',horaFim:'15:00',modalidade:'presencial',localAula:'Sala sintética'}})}catch(error){toast(error.message,'bad')}};bar.append(' ',blocked);
   const toggle=document.createElement('button');toggle.textContent='Simular falha Google';toggle.onclick=()=>{googleUnavailable=!googleUnavailable;toggle.textContent=googleUnavailable?'Restaurar Google simulado':'Simular falha Google';state.v631CentralRanges={};renderPage();};bar.append(' ',toggle);
   const reset=document.createElement('button');reset.textContent='Limpar aulas sintéticas';reset.onclick=()=>{lessons=[];persist();state.lessons=[];state.v631CentralRanges={};renderPage();};bar.append(' ',reset);
 });
})();
