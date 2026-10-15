import assert from 'node:assert/strict';
export function withoutLessonReadPolicy(html){
 assert.equal(html.split('<script id="forja-lesson-read-policy-script">').length,2);
 html=html.replace(/<script id="forja-lesson-read-policy-script">[\s\S]*?<\/script>\n\n/,'');
 const anchor='  return stored;\n}\nconst nextItemsBeforeBlockA';
 assert.equal(html.split(anchor).length,2);
 return html.replace(anchor,'  const end=lessonClientEndMs(l);if(end!=null&&Date.now()>end+15*60000&&!l?.iniciadoEm&&!l?.finalizadoEm)return "cancelada_automaticamente";\n'+anchor);
}
