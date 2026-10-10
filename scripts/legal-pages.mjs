import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstatSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

// Explicit public allowlist. Repository files and credentials are never copied.
export const legalFiles = ['assets/forja-legal.css', 'privacidade/index.html', 'termos/index.html'];
export const legalNavigation = `    <div id="forja-public-legal" style="margin-top:24px;border-top:1px solid #dde3e9;padding-top:16px">
      <p>O FORJA organiza cadastros, atividades e agendamentos da escola. Professores e psicólogos podem conectar seu Google Calendar para sincronizar agendamentos e identificar conflitos; a Secretaria possui uma conexão central separada para consultar calendários e horários ocupados.</p>
      <a href="/privacidade/">Política de Privacidade</a> · <a href="/termos/">Termos de Serviço</a>
    </div>
`;
export function withoutLegalNavigation(html) {
  assert.equal(html.split(legalNavigation).length, 2, 'Navegação legal deve existir exatamente uma vez.');
  return html.replace(legalNavigation, '');
}
export const portalBeforeLegalSha256 = '3d6908cd807c5b2abf3a7620b2d4275738bb28931478e4340fe84c4557e6cf1f';
export function validateLegalPages(root) {
  return legalFiles.map(file => {
    const path = join(root, file);
    assert.ok(lstatSync(path).isFile(), `Arquivo público regular obrigatório: ${file}`);
    const bytes = readFileSync(path), text = bytes.toString('utf8');
    assert.ok(!/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(text), `Credencial em ${file}`);
    if (file.endsWith('.html')) {
      assert.match(text, /<html lang="pt-BR">/);
      assert.match(text, /<meta name="viewport"/);
      assert.match(text, /data-legal-review="pending"/, 'Remover status de revisão exige aprovação institucional.');
      assert.match(text, /href="\/assets\/forja-legal\.css"/);
      assert.ok(!/<script\b|\son[a-z]+\s*=|<iframe\b|<form\b/i.test(text), 'Páginas legais públicas não executam scripts, autenticação ou ações.');
    } else {
      assert.ok(!/@import|url\s*\(/i.test(text), 'CSS legal não deve carregar recursos externos.');
    }
    return {file, bytes:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex')};
  });
}
