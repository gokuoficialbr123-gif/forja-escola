// One history adapter around the existing renderers, permissions and session fences.
// Only route identifiers enter history. Drafts stay in memory and are cleared on session change.
(()=>{
 const key='forjaNavigation',token=crypto.randomUUID(),views=new Map();
 let owner='',epoch=0,index=0,current=null,replaying=false,pending=null,modalInitial='',returning=false;
 const visible=id=>!document.getElementById(id)?.classList.contains('hidden');
 const scope=()=>state.user?.uid&&forjaSessionUID?`${forjaSessionGeneration}:${forjaSessionUID}:${state.role}`:'';
 function route(){if(visible('portalApp'))return {kind:'portal',page:state.page,epoch};if(visible('loginView'))return {kind:'login'};if(visible('enrollmentView'))return {kind:'enrollment',step:state.enrollmentStep||1};return {kind:'public'};}
 const fields=root=>[...root.querySelectorAll('input[id],select[id],textarea[id]')].filter(el=>!['password','file','hidden'].includes(el.type)).map(el=>({id:el.id,value:el.value,checked:el.checked}));
 const signature=()=>JSON.stringify([...document.querySelectorAll('#modal input,#modal select,#modal textarea')].map(el=>[el.type==='password'?Boolean(el.value):el.type==='file'?el.files.length:el.value,el.checked]));
 function session(){const next=scope();if(next===owner)return;owner=next;epoch++;views.clear();pending=null;current=null;index=0;}
 function save(){if(!current)return;const content=document.getElementById('workspaceContent');views.set(current.index,{fields:current.kind==='portal'?fields(content):[],scroll:scrollY,contentScroll:content.scrollTop});if(views.size>32)views.delete(views.keys().next().value);}
 function record(next,replace=false){
  session();if(replaying)return;
  if(current&&JSON.stringify({...current,index:0})===JSON.stringify({...next,index:0,epoch:next.epoch}))return;
  replace=replace||current?.collapsed===true;
  current={...next,index:replace?index:++index};
  history[replace?'replaceState':'pushState']({...history.state,[key]:{token,...current}},'');
 }
 function root(){session();current={...route(),index};history.replaceState({...history.state,[key]:{token,...current}},'');}
 function restore(){if(!pending||state.loading||pending.page!==state.page||pending.epoch!==epoch)return;const data=views.get(pending.index);pending=null;if(!data)return;
  for(const f of data.fields){const el=document.getElementById(f.id);if(el&&document.getElementById('workspaceContent').contains(el)){el.value=f.value;if(['checkbox','radio'].includes(el.type))el.checked=f.checked;}}
  // These existing handlers only filter local lists. Never replay form save/change handlers.
  for(const id of ['userSearch','teacherCStudentSearch','secretaryDStudentSearch'])document.getElementById(id)?.oninput?.();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{document.getElementById('workspaceContent').scrollTop=data.contentScroll;scrollTo({top:data.scroll,behavior:'instant'});}));
 }
 const render=renderPage;renderPage=function(...args){const value=render(...args);restore();return value;};
 const go=navigate;navigate=function(page){session();save();const before=state.page;pending=page===before&&current?{page,epoch,index:current.index}:null;const result=go(page);if(state.page!==before)record(route());return result;};
 const visibility=setAppVisibility;setAppVisibility=function(logged){const result=visibility(logged);root();return result;};
 const end=forjaEndSession;forjaEndSession=function(...args){const result=end(...args);session();return result;};
 const login=showLogin;showLogin=function(...args){session();if(owner){setAppVisibility(true);renderShell();renderPage();return;}save();const result=login(...args);record(route());return result;};
 const publicPage=showPublic;showPublic=function(...args){save();const result=publicPage(...args);record(route());return result;};
 const enrollment=renderEnrollment;renderEnrollment=function(...args){save();const result=enrollment(...args);record({kind:'enrollment',step:1});return result;};
 const step=setEnrollmentStep;setEnrollmentStep=function(...args){if(!replaying&&current?.kind==='enrollment'&&args[0]===state.enrollmentStep-1){history.back();return;}const result=step(...args);record(route());return result;};
 const open=modal;modal=function(...args){save();const wasOpen=visible('modal'),base=current&&current.kind!=='modal'?{...current}:route(),result=open(...args);modalInitial=signature();if(!wasOpen)record({kind:'modal',base,epoch});return result;};
 const close=closeModal;closeModal=function(...args){const result=close(...args);if(current?.kind==='modal'&&!replaying){current={...current.base,index:current.index,collapsed:true};history.replaceState({...history.state,[key]:{token,...current}},'');}return result;};
 window.forjaNavigationDrawer=open=>{
  if(replaying)return;
  if(open){if(current?.kind!=='drawer'){save();record({kind:'drawer',base:{...current},epoch});}}
  else if(current?.kind==='drawer'){current={...current.base,index:current.index,collapsed:true};history.replaceState({...history.state,[key]:{token,...current}},'');}
 };
 for(const button of document.querySelectorAll('[data-scroll]')){const click=button.onclick;button.onclick=function(event){save();const result=click?.call(this,event);record({kind:'public',section:this.dataset.scroll});return result;};}
 const section=showPublicSection;showPublicSection=function(id){save();const previous=replaying;replaying=true;try{section(id);}finally{replaying=previous;}record({kind:'public',section:id});};
 addEventListener('popstate',event=>{
  session();const target=event.state?.[key];
  if(!target||target.token!==token){root();return;}
  if(returning){returning=false;return;}
  if(current?.collapsed&&target.kind===current.kind&&target.page===current.page&&target.section===current.section&&target.index<current.index){current=target;index=target.index;history.back();return;}
  if(visible('modal')&&signature()!==modalInitial&&!confirm('Há dados não enviados nesta janela. Deseja sair dela?')){returning=true;history.go((current?.index||0)-target.index);return;}
  save();replaying=true;
  try{
   if(visible('modal'))closeModal();
   if(state.v630Booking?.open)document.querySelector('[data-v630-close]')?.click();
   const next=['modal','drawer'].includes(target.kind)?target.base:target;
   if(next.kind==='portal'){
    if(!owner||next.epoch!==epoch){if(owner){setAppVisibility(true);go('inicio');}else publicPage();root();return;}
    setAppVisibility(true);pending={...next,index:target.index};go(next.page);if(state.page!==next.page){pending=null;root();return;}
   }else if(next.kind==='login'){if(owner){setAppVisibility(true);go('inicio');root();return;}login();}
   else if(next.kind==='enrollment'){
    document.getElementById('publicSite').classList.add('hidden');document.getElementById('loginView').classList.add('hidden');document.getElementById('portalApp').classList.add('hidden');document.getElementById('enrollmentView').classList.remove('hidden');
    if(!document.getElementById('enrollName'))enrollment();step(next.step);
   }else publicPage();
   current={...next,index:target.index};index=target.index;
   // A closed modal has no executable replay; forward returns to its underlying page.
   history.replaceState({...history.state,[key]:{token,...current}},'');
   if(next.kind==='public'){const data=views.get(target.index);requestAnimationFrame(()=>{if(data)scrollTo({top:data.scroll,behavior:'instant'});else if(next.section)document.getElementById(next.section)?.scrollIntoView({behavior:'instant'});});}
  }finally{replaying=false;}
 });
 root();
})();
