import assert from 'node:assert/strict';
export function withoutFixedAvailability(html){
  assert.equal(html.split('<script id="forja-fixed-availability-script">').length,2);
  assert.equal(html.split('<style id="forja-fixed-availability-style">').length,2);
  html=html.replace(/<style id="forja-fixed-availability-style">[\s\S]*?<\/style>\n/,'');
  html=html.replace(/<script id="forja-fixed-availability-script">[\s\S]*?<\/script>\n\n/,'');
  const changed="if(role==='teacher')return (forjaFixedWeekItems(ws,v621TeacherAvailabilityForWeek(ws))?.[code]||[]).map(x=>({...x}));";
  const original="if(role==='teacher')return (v621TeacherAvailabilityForWeek(ws)?.[code]||[]).map(x=>({...x}));";
  assert.equal(html.split(changed).length,2);
  return html.replace(changed,original);
}
