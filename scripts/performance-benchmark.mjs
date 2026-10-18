// Controlled synthetic benchmark. This program never benchmarks school data or calls Google.
import{readFileSync,writeFileSync}from'node:fs';import{resolve}from'node:path';import{pathToFileURL}from'node:url';import{gzipSync,brotliCompressSync}from'node:zlib';
import{performancePortal,delay}from'./helpers/performance-portal-fixture.mjs';import{buildHostingArtifact}from'./prepare-hosting.mjs';import{withoutPerformanceChanges}from'./performance-scope.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);
const baseline=process.argv.includes('--baseline'),output=process.env.FORJA_PERFORMANCE_OUTPUT||'/tmp/forja-performance.json',iterations=Number(process.env.FORJA_PERFORMANCE_RUNS||3),meDelay=Number(process.env.FORJA_PERFORMANCE_ME_MS||120);
if(!Number.isInteger(iterations)||iterations<1||iterations>5||meDelay<0||meDelay>60000)throw Error('Invalid bounded benchmark configuration');
const artifact=baseline?{bytes:Buffer.from(withoutPerformanceChanges(readFileSync(new URL('../index.html',import.meta.url),'utf8'))),resources:[]}:buildHostingArtifact();
const browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}),rows=[];
try{for(const mobile of[false,true])for(let run=0;run<iterations;run++){
 const f=await performancePortal({browser,...artifact,mobile,meDelay});try{
  const {page,calls}=f;
  const initial=await page.evaluate(()=>({navigation:performance.getEntriesByType('navigation').map(x=>({ttfb:x.responseStart-x.requestStart,transfer:x.transferSize,decoded:x.decodedBodySize,domContentLoaded:x.domContentLoadedEventEnd}))[0],resources:performance.getEntriesByType('resource').filter(x=>x.name.startsWith(location.origin)).map(x=>({path:new URL(x.name).pathname,transfer:x.transferSize,encoded:x.encodedBodySize,decoded:x.decodedBodySize})),paints:performance.getEntriesByType('paint').map(x=>({name:x.name,start:x.startTime})),longTasks:__longTasks}));
  const loginStart=Date.now();await f.login();await page.waitForFunction(()=>state.role==='admin'&&!state.loading);const loginMs=Date.now()-loginStart,shellMs=await page.evaluate(()=>__perfShellTime)-loginStart,loginCalls=calls.slice();
  const usersStart=Date.now();await page.evaluate(()=>navigate('usuarios'));await page.locator('[data-action=newUser]').waitFor({state:'visible'});const usersMs=Date.now()-usersStart;
  const agendaStart=Date.now();await page.evaluate(()=>navigate('agenda'));await page.waitForFunction(()=>Object.values(state.v631CentralRanges||{}).some(x=>x.valid));const agendaMs=Date.now()-agendaStart;
  const beforeWeek=calls.length,weekStart=Date.now();await page.locator('[data-v621-nav=next][data-role=admin]').click();await page.waitForFunction(()=>Object.values(state.v631CentralRanges||{}).filter(x=>x.valid).length>=2);const weekMs=Date.now()-weekStart;await delay(150);
  const row={mobile,run,initial,shellMs,loginMs,usersMs,agendaMs,weekMs,loginGetRequests:loginCalls.filter(x=>x.method==='GET').length,centralBeforeAgenda:loginCalls.filter(x=>x.path.includes('google-central-busy')).length,weekRequests:calls.slice(beforeWeek).map(x=>x.path+x.query),loginCalls:loginCalls.map(x=>({...x,start:x.start-loginStart,end:x.end-loginStart})),errors:f.errors};rows.push(row);console.log(JSON.stringify({...row,loginCalls:undefined,initial:undefined}));
 }finally{await f.close()}
}}finally{await browser.close()}
writeFileSync(output,JSON.stringify({baseline,model:{meDelay,requestMs:120,secondaryMs:900,mobileCpuSlowdown:4,mobileDownMbps:1.6,desktopDownMbps:10,sdk:'mock',google:'mock',api:'mock',browserCache:'disabled by request interception'},htmlBytes:artifact.bytes.length,htmlBr:brotliCompressSync(artifact.bytes).length,htmlGzip:gzipSync(artifact.bytes).length,resources:(artifact.resources||[]).map(r=>({file:r.file,bytes:r.bytes.length,brBytes:r.file.endsWith('.webp')?r.bytes.length:brotliCompressSync(r.bytes).length})),rows},null,2)+'\n');
