(() => {
  const route = 'automacao-aulas';
  const prefix = '/admin/automacao';
  const title = 'Automação de Aulas';
  const labels = {
    desativado:'Desativado', configurado:'Configurado', configuracao_pendente:'Configuração pendente',
    operacional:'Gravação confirmada', falha:'Falha', pendente:'Pendente', sincronizado:'Confirmado no Sheets',
    via_aluno:'Projetado pelo aluno vinculado', sem_calendario:'Sem calendário verificável',
    sem_contato:'Contato inválido ou ausente', sem_autorizacao:'Sem autorização',
    destinatario_pendente:'Destinatário pendente',
  };
  const metricLabels = {
    syncedTeachers:'Professores sincronizados', noCalendar:'Professores sem calendário',
    noContact:'Alunos sem contato válido', unauthorized:'Destinatários sem autorização',
    pending:'Cadastros pendentes', errors:'Erros de sincronização',
    planned:'Lembretes reservados pendentes', accepted:'Mensagens aceitas pela API',
    delivered:'Mensagens entregues', failed:'Mensagens com falha ou em revisão',
    cancellations:'Cancelamentos registrados', awaitingReview:'Justificativas aguardando análise',
  };
  let model;
  if (!MENUS.admin.some(([id]) => id === route)) MENUS.admin.push([route,title]);
  FORJA_ADMIN_PAGE_READS[route] = [];

  function date(value) {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? new Date(ms).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}) : 'Sem registro';
  }

  function status(value) {
    return esc(labels[value] || 'Não verificado');
  }

  function table(current) {
    const {items,next} = current.roster;
    const {configuration,reprocess} = current.summary.controls;
    return `<section class="card"><h3>Cadastros e destinatários</h3>
      <p>O Firestore é a fonte oficial. Autorize WhatsApp somente com o consentimento registrado do destinatário.</p>
      <div class="table-wrap" style="overflow:auto"><table class="table"><thead>
      <tr><th>Cadastro</th><th>Google Sheets</th><th>WhatsApp</th><th>Controles</th></tr>
      </thead><tbody>${items.map(item => `<tr>
        <td><strong>${esc(item.name)}</strong><br>${esc({teacher:'Professor',student:'Aluno',parent:'Responsável'}[item.role] || '')} · ${item.active?'Ativo':'Inativo'}</td>
        <td><strong>${status(item.sync)}</strong><br>${esc(date(item.lastSyncAt))}
          ${item.issue ? '<br>'+status(item.issue) : ''}${item.error ? '<br>'+esc(item.error) : ''}</td>
        <td>${item.authorized?'Autorizado':'Sem autorização'}<br>${item.validPhone?'Contato válido':'Contato inválido ou ausente'}</td>
        <td>${configuration ? `<button class="small-btn" data-auto-consent="${esc(item.id)}">${item.authorized?'Revogar autorização':'Registrar autorização'}</button>` : ''}
          ${configuration && item.role==='student' ? `<button class="small-btn" data-auto-recipient="${esc(item.id)}">Definir destinatário</button>` : ''}
          ${reprocess && item.role!=='parent' && ['falha','pendente'].includes(item.sync) ? `<button class="small-btn" data-auto-retry="${esc(item.id)}">Reprocessar Sheets</button>` : ''}</td>
      </tr>`).join('') || '<tr><td colspan="4">Nenhum cadastro nesta página.</td></tr>'}</tbody></table></div>
      <button class="small-btn" data-auto-first ${current.after?'':'disabled'}>Primeira página</button>
      <button class="small-btn" data-auto-next ${next?'':'disabled'}>Próxima página</button></section>`;
  }

  function overview(current) {
    const {integrations,metrics,review,controls} = current.summary;
    const card = (name,item,last) => `<article class="secretary-d-kpi"><strong style="font-size:1rem">${status(item.state)}</strong>
      <span>${name}</span><small>${esc(date(last))}</small>${item.error?'<small>'+esc(item.error)+'</small>':''}</article>`;
    return `<section class="secretary-d-kpis" aria-label="Integrações">
      ${card('Google Sheets',integrations.sheets,integrations.sheets.lastSyncAt)}
      ${card('Google Calendar · configuração',integrations.calendar)}
      ${card('n8n · última reserva registrada',integrations.n8n,integrations.n8n.lastActivity)}
      ${card('WhatsApp Business · último recibo',integrations.whatsapp,integrations.whatsapp.lastActivity)}
      </section><p>Os totais de cadastros refletem registros da projeção. Lembretes e cancelamentos refletem o histórico registrado pelo backend.</p>
      <section class="secretary-d-kpis" aria-label="Indicadores">${Object.entries(metricLabels).map(([key,label]) =>
        `<article class="secretary-d-kpi"><strong>${Number.isSafeInteger(metrics[key])?metrics[key]:'—'}</strong><span>${label}</span></article>`).join('')}</section>
      ${table(current)}
      <section class="card"><h3>Justificativas aguardando análise</h3>${review.length ? review.map(event =>
        `<article><p><strong>${esc(event.date)} ${esc(event.time)}</strong></p><p>${esc(event.reason || 'Justificativa indisponível')}</p>
          ${controls.configuration&&event.reason?`<button class="small-btn" data-auto-reviewed="${esc(event.id)}">Marcar como analisada</button>`:''}</article>`).join('') : '<p>Nenhuma justificativa aguardando análise.</p>'}
      </section>`;
  }

  const active = current => current && state.role === 'admin' && state.page === route && forjaSessionCurrent(current.session);
  const body = current => {
    if (current.error) return empty('Não foi possível consultar a automação','Atualize para tentar novamente.');
    return current.summary && current.roster ? overview(current) : loading('Consultando automação...');
  };
  function paint(current) {
    const area = document.querySelector('[data-auto-area]');
    if (!area || !active(current)) return;
    area.innerHTML = body(current);
    area.querySelector('[data-auto-next]')?.addEventListener('click', () => load(current,current.roster.next));
    area.querySelector('[data-auto-first]')?.addEventListener('click', () => load(current,''));
    area.querySelectorAll('[data-auto-retry]').forEach(button => {
      button.onclick = () => mutate(current,button,`/cadastros/${encodeURIComponent(button.dataset.autoRetry)}/reprocessar`,'POST',undefined,
        'Reprocessamento do Sheets enfileirado.');
    });
    area.querySelectorAll('[data-auto-reviewed]').forEach(button => {
      button.onclick = () => mutate(current,button,`/cancelamentos/${encodeURIComponent(button.dataset.autoReviewed)}/revisar`,'POST',undefined,
        'Análise registrada.');
    });
    area.querySelectorAll('[data-auto-consent]').forEach(button => {
      button.onclick = () => {
        const item = current.roster.items.find(x => x.id === button.dataset.autoConsent);
        if (!item) return;
        const consent = !item.authorized;
        modal(consent?'Registrar consentimento WhatsApp':'Revogar autorização WhatsApp',
          `<p>${esc(item.name)}. ${consent?'Confirme que o destinatário autorizou receber lembretes de aula pelo WhatsApp.':'O cadastro deixa de autorizar novos lembretes pelo WhatsApp.'}</p>
          <button class="btn primary" data-auto-confirm>Confirmar</button>`);
        document.querySelector('[data-auto-confirm]').onclick = event => mutate(current,event.currentTarget,
          `/cadastros/${encodeURIComponent(item.id)}/contato`,'PATCH',{authorized:consent},'Autorização atualizada.',true);
      };
    });
    area.querySelectorAll('[data-auto-recipient]').forEach(button => {
      button.onclick = () => choose(current,button);
    });
  }

  async function load(current,after=current.after) {
    const request = ++current.request;
    current.error = false;
    try {
      const options = {session:current.session};
      const [summary,roster] = await Promise.all([api(prefix,options),
        api(prefix+'/cadastros'+(after?'?after='+encodeURIComponent(after):''),options)]);
      if (!active(current) || request !== current.request) return;
      if (summary.ok!==true || roster.ok!==true || !summary.controls || !summary.integrations ||
          !summary.metrics || !Array.isArray(summary.review) || !Array.isArray(roster.items)) throw Error();
      Object.assign(current,{summary,roster,after});
    } catch {
      if (request === current.request) current.error = true;
    }
    if (request === current.request) paint(current);
  }

  async function mutate(current,button,path,method,data,message,dialog=false) {
    if (!active(current) || button.disabled) return;
    const owner = button.closest('.modal');
    button.disabled = true;
    try {
      await api(prefix+path,{method,body:data,session:current.session});
      if (!active(current)) return;
      if (dialog && owner?.isConnected) document.querySelector('#modal [data-close-modal]')?.click();
      toast(message,'ok');
      await load(current);
    } catch {
      if (active(current)) toast('Não foi possível confirmar a alteração.','bad');
    } finally {
      button.disabled = false;
    }
  }

  async function choose(current,button) {
    if (!active(current)) return;
    const id = button.dataset.autoRecipient;
    button.disabled = true;
    try {
      const data = await api(prefix+`/cadastros/${encodeURIComponent(id)}/destinatarios`,{session:current.session});
      if (!active(current) || !button.isConnected) return;
      modal('Destinatário dos lembretes',`<label for="auto-recipient-choice">Selecione o destinatário oficial</label>
        <select id="auto-recipient-choice"><option value="">Nenhum</option>${data.items.map(item =>
          `<option value="${esc(item.id)}" ${item.id===data.selected?'selected':''}>${esc(item.label)}</option>`).join('')}</select>
        <button class="btn primary" data-auto-save>Salvar destinatário</button>`);
      document.querySelector('[data-auto-save]').onclick = event => mutate(current,event.currentTarget,
        `/cadastros/${encodeURIComponent(id)}/contato`,'PATCH',{recipient:document.querySelector('#auto-recipient-choice').value},
        'Destinatário atualizado.',true);
    } catch {
      if (active(current)) toast('Não foi possível consultar destinatários.','bad');
    } finally {
      button.disabled = false;
    }
  }

  const previousPage = adminPage;
  adminPage = function(page) {
    if (page !== route || state.role !== 'admin') return previousPage(page);
    return pageHead('SECRETARIA',title,'Acompanhe cadastros, lembretes e cancelamentos.')+
      '<button class="btn ghost" data-auto-refresh>Atualizar</button><div data-auto-area aria-live="polite"></div>';
  };
  const previousBind = bindPage;
  bindPage = function(...args) {
    previousBind(...args);
    if (state.role !== 'admin' || state.page !== route) { model = undefined; return; }
    if (!active(model)) {
      model = {session:forjaCaptureSession(),request:0,after:''};
      void load(model);
    }
    const current = model;
    paint(current);
    const refresh = document.querySelector('[data-auto-refresh]');
    if (refresh) refresh.onclick = () => load(current);
  };
})();
