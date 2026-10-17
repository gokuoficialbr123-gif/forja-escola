import {readFileSync} from 'node:fs';
// Safe diagnostics in check annotations when the runner log download is blocked.
// Only static test names, failure categories, numeric assertions and test source
// positions; never provider messages, payloads, headers, URLs or credentials.
const lines=readFileSync(process.argv[2],'utf8').split('\n');
const safe=[];
for(const line of lines){
 if(/^\s*not ok \d+ - /.test(line))safe.push(line.trim());
 else if(/^\s*(failureType|code|name|operator): ['\w-]+\s*$/.test(line))safe.push(line.trim());
 else if(/^\s*(actual|expected): (?:\d+|true|false|null|'[A-Z][A-Z_]+')\s*$/.test(line))safe.push(line.trim());
 else if(line.includes('/scripts/')){const position=line.match(/\/scripts\/[\w./-]+:\d+:\d+/);if(position)safe.push(position[0]);}
 else {const timeout=line.match(/\b(page|locator)\.([a-zA-Z]+): Timeout (\d+)ms/);if(timeout)safe.push(timeout[0]);}
}
const escape=x=>x.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
for(let i=0;i<Math.min(safe.length,120);i+=12)console.log('::error title=Regressão Chromium::'+escape(safe.slice(i,i+12).join('\n')));
