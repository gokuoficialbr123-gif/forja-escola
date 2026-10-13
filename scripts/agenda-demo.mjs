import {readFileSync} from 'node:fs';
import {isolatedDemoArtifact} from './invitation-demo.mjs';
export function agendaDemoArtifact(source){
 const foundation=readFileSync(new URL('./invitation-demo.js',import.meta.url),'utf8')
   .replace('SIMULAÇÃO SEGURA DE CONVITES','DEMONSTRAÇÃO SINTÉTICA DA AGENDA')
   .replace('Nenhuma conta real é criada; nenhum e-mail é enviado. Use somente dados fictícios.','Google e API simulados no navegador. Nenhum banco, conta ou evento real é acessado. Use somente dados fictícios.')
   .replace(/<label>Resultado simulado:[\s\S]*?<\/label>/,'');
 return isolatedDemoArtifact(source,foundation+'\n'+readFileSync(new URL('./agenda-demo.js',import.meta.url),'utf8'),'forja-agenda-demo');
}
