import assert from 'node:assert/strict';import{createHash}from'node:crypto';
const digest=b=>createHash('sha256').update(b).digest('hex');
const imageDimensions=new Map([['51b57dd0f4f92943a2fcb0b895af9a5fdaea0b7fb64e3aff38edbeb32e810f8b',[902,420]],['44bd49fa5365c383b79352abe0b76c00bccd7130eff4d5d1f8d3ef5429906c02',[353,416]]]);
// Only the two existing brand images are extracted, without transcoding.
// CSS and classic scripts keep their original placement/order and exact bytes.
export function extractStaticResources(source){
 let html=source.toString('utf8');const resources=[];
 for(const url of new Set(html.match(/data:image\/webp;base64,[A-Za-z0-9+/=]+/g)||[])){
  const bytes=Buffer.from(url.slice('data:image/webp;base64,'.length),'base64');assert.equal('data:image/webp;base64,'+bytes.toString('base64'),url);
  const sha256=digest(bytes),file=`assets/forja-image-${sha256}.webp`;
  assert.ok(imageDimensions.has(sha256),'Review dimensions when brand image bytes change.');
  const [width,height]=imageDimensions.get(sha256);resources.push({kind:'image',file,bytes,sha256,width,height});html=html.split(url).join('/'+file);
 }
 assert.equal(resources.length,2,'Exactly the two reviewed brand images must be extracted.');
 const preload='<link rel="preload" as="image" fetchpriority="high" href="/'+resources[0].file+'">';
 html=html.replace('</head>',preload+'</head>');
 assert.ok(html.includes('<img class="forja-art-crest"'),'Reviewed decorative login image is required.');
 html=html.replace('<img class="forja-art-crest"','<img loading="lazy" class="forja-art-crest"');
 for(const r of resources)html=html.replace(/<img\b[^>]*>/g,tag=>tag.includes('/'+r.file)?tag.replace('<img ',`<img width="${r.width}" height="${r.height}" `):tag);
 const bytes=Buffer.from(html);assert.ok(expandStaticResources(bytes,resources).equals(source),'Extracted artifact must reconstruct the exact validated source.');
 return {bytes,resources};
}
export function expandStaticResources(bytes,resources){
 let html=bytes.toString('utf8');
 for(const r of resources)html=html.split(`<img width="${r.width}" height="${r.height}" `).join('<img ');
 html=html.replace('<link rel="preload" as="image" fetchpriority="high" href="/'+resources[0].file+'">','');
 html=html.replace('<img loading="lazy" class="forja-art-crest"','<img class="forja-art-crest"');
 for(const r of resources)html=html.split('/'+r.file).join('data:image/webp;base64,'+r.bytes.toString('base64'));return Buffer.from(html);
}
export function staticResourceMetadata(resources){return resources.map(({kind,file,bytes,sha256})=>({kind,file,bytes:bytes.length,sha256}));}
