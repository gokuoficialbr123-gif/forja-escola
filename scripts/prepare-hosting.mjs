import {extractStaticResources,staticResourceMetadata} from './static-resources.mjs';
import {legalFiles} from './legal-pages.mjs';
import assert from 'node:assert/strict';
import {invitationDemoArtifact} from './invitation-demo.mjs';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rootDir, sha256, validate, validateInlineScripts, googleVerificationFile } from './validate.mjs';
import { validatePreviewApiUrl } from './preview-config.mjs';

export const productionApiUrl = 'https://forja-api-m1kq.onrender.com';

export function buildHostingArtifact(root = rootDir, { previewApiUrl, invitationDemo=false } = {}) {
  const result = validate(root);
  const source = readFileSync(join(root, 'index.html'));
  if(invitationDemo){
    assert.equal(previewApiUrl,undefined,'Demo não combina backend real.');
    const bytes=invitationDemoArtifact(source);
    return {bytes,result:{...result,target:'invitation-demo',apiUrl:null,sha256:sha256(bytes),bytes:bytes.length,inlineScripts:validateInlineScripts(bytes.toString('utf8'))}};
  }
  if (previewApiUrl === undefined) return staticArtifact(source,result,'production',productionApiUrl);

  validatePreviewApiUrl(previewApiUrl);
  const declaration = `const FORJA_API_URL = "${productionApiUrl}";`;
  const html = source.toString('utf8');
  assert.equal(html.split(declaration).length, 2, 'Declaração oficial da API deve existir exatamente uma vez.');
  const bytes = Buffer.from(html.replace(declaration, `const FORJA_API_URL = "${previewApiUrl}";`));
  validateInlineScripts(bytes.toString('utf8'));
  return staticArtifact(bytes,result,'preview',previewApiUrl);
}

function staticArtifact(source,result,target,apiUrl){
 const {bytes,resources}=extractStaticResources(source);
 return {bytes,resources,result:{...result,sourceSha256:sha256(source),target,apiUrl,sha256:sha256(bytes),bytes:bytes.length,inlineScripts:validateInlineScripts(bytes.toString('utf8')),staticResources:staticResourceMetadata(resources)}};
}

export function hostingOptionsFromArgs(args = process.argv.slice(2)) {
  assert.ok(args.length === 0 || (args.length === 1 && ['--preview','--invitation-demo'].includes(args[0])), 'Use somente --preview, --invitation-demo ou nenhum argumento.');
  if (!args.length) return {}; // Preview environment variables cannot affect production.
  if(args[0]==='--invitation-demo')return {invitationDemo:true};
  return { previewApiUrl: validatePreviewApiUrl(process.env.FORJA_PREVIEW_API_URL) };
}

export function prepareHosting(root = rootDir, options = {}) {
  const { bytes, resources=[], result } = buildHostingArtifact(root, options);
  const output = join(root, '.firebase-public');
  // This is a generated, ignored directory owned exclusively by this script.
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output);
  writeFileSync(join(output, 'index.html'), bytes);
  writeFileSync(join(output, googleVerificationFile), readFileSync(join(root, googleVerificationFile)));
  for(const file of legalFiles) { mkdirSync(dirname(join(output,file)),{recursive:true});writeFileSync(join(output,file),readFileSync(join(root,file))); }
  for(const resource of resources){assert.match(resource.file,/^assets\/forja-image-[a-f0-9]{64}\.webp$/);mkdirSync(dirname(join(output,resource.file)),{recursive:true});writeFileSync(join(output,resource.file),resource.bytes);}
  const expectedAssets=[...legalFiles.filter(f=>f.startsWith('assets/')).map(f=>f.slice(7)),...resources.map(r=>r.file.slice(7))].sort();
  assert.deepEqual(readdirSync(join(output,'assets')).sort(),expectedAssets,'Hosting assets must match the exact derived allowlist.');
  assert.deepEqual(readdirSync(output), ['assets',googleVerificationFile,'index.html','privacidade','termos']);
  assert.ok(bytes.equals(readFileSync(join(output, 'index.html'))));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(prepareHosting(rootDir, hostingOptionsFromArgs()), null, 2));
}
