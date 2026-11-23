import { db } from './supabase.js';
import { startPage, $, esc, toast, fail, chart } from './auth.js';
// adminOnly = true: quem não for admin é redirecionado. O banco também bloqueia (RLS + is_admin()).
const { user, profile, el } = await startPage('Painel Admin', true);

const views = { overview, users, stats, announcements, settings };
async function route() {
  el.innerHTML = '<p class="empty">Carregando...</p>';
  await (views[(location.hash || '#overview').slice(1)] || overview)();
}
addEventListener('hashchange', route); route();

async function getStats() {
  const { data, error } = await db.rpc('admin_stats');
  if (fail(error)) return null; return data;
}
const card = (t, v) => `<div class="card"><h3>${t}</h3><div class="big">${v}</div></div>`;

async function overview() {
  const s = await getStats(); if (!s) return;
  el.innerHTML = `<div class="grid">${card('Total de usuários', s.users)}${card('Ativos', s.active)}${card('Bloqueados', s.blocked)}${card('Novos (7 dias)', s.new7)}</div>
   <div class="grid">${card('Sessões de estudo', s.sessions)}${card('Horas estudadas', (+s.hours).toFixed(1) + 'h')}
   ${card('Média h/usuário', s.users ? (s.hours / s.users).toFixed(1) + 'h' : '0h')}${card('Tarefas concluídas', s.tasks_done + '/' + s.tasks)}</div>`;
}

async function users() {
  const { data, error } = await db.from('profiles').select('*').order('created_at', { ascending: false });
  if (fail(error)) return;
  el.innerHTML = `<div class="card"><input id="q" placeholder="🔍 Buscar por nome ou e-mail..." style="margin-bottom:12px"><div class="tablewrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Cadastro</th><th>Papel</th><th>Status</th><th>Ações</th></tr></thead><tbody id="rows"></tbody></table></div></div>`;
  const draw = () => {
    const q = $('#q').value.toLowerCase();
    $('#rows').innerHTML = data.filter(u => (u.full_name + u.email).toLowerCase().includes(q)).map(u => `<tr><td>${esc(u.full_name)}</td><td>${esc(u.email)}</td>
      <td>${new Date(u.created_at).toLocaleDateString('pt-BR')}</td><td>${u.role}</td><td><span class="badge ${u.status}">${u.status === 'active' ? 'Ativo' : 'Bloqueado'}</span></td>
      <td>${u.role === 'admin' ? '—' : `<button class="btn ghost sm" data-toggle="${u.id}" data-to="${u.status === 'active' ? 'blocked' : 'active'}">${u.status === 'active' ? 'Bloquear' : 'Desbloquear'}</button>
      <button class="btn danger sm" data-del="${u.id}" data-name="${esc(u.email)}">Excluir</button>`}</td></tr>`).join('');
  };
  $('#q').oninput = draw; draw();
  $('#rows').onclick = async (e) => {
    const d = e.target.dataset;
    if (d.toggle && confirm('Confirmar alteração do status desta conta?')) {
      if (fail((await db.rpc('admin_set_status', { target: d.toggle, new_status: d.to })).error)) return; toast('Status atualizado.'); users();
    }
    if (d.del && confirm(`Excluir PERMANENTEMENTE a conta ${d.name} e todos os seus dados?`)) {
      if (fail((await db.rpc('admin_delete_user', { target: d.del })).error)) return; toast('Conta excluída.'); users();
    }
  };
}

async function stats() {
  const s = await getStats(); if (!s) return;
  el.innerHTML = `<div class="grid2"><div class="card"><h3>Usuários por status</h3><div class="chartbox"><canvas id="c1"></canvas></div></div>
   <div class="card"><h3>Tarefas</h3><div class="chartbox"><canvas id="c2"></canvas></div></div>
   <div class="card"><h3>Uso da plataforma</h3><div class="chartbox"><canvas id="c3"></canvas></div></div></div>`;
  chart('c1', 'doughnut', ['Ativos', 'Bloqueados'], [s.active, s.blocked], 'Usuários');
  chart('c2', 'doughnut', ['Concluídas', 'Abertas'], [s.tasks_done, s.tasks - s.tasks_done], 'Tarefas');
  chart('c3', 'bar', ['Matérias', 'Tarefas', 'Sessões'], [s.subjects, s.tasks, s.sessions], 'Total');
}

async function announcements() {
  const { data, error } = await db.from('announcements').select('*').order('created_at', { ascending: false });
  if (fail(error)) return;
  el.innerHTML = `<div class="card"><form id="f" class="form"><input id="t" placeholder="Título" required maxlength="100"><textarea id="m" placeholder="Mensagem para todos os usuários" required maxlength="500"></textarea><button class="btn">Publicar comunicado</button></form></div>
   <div class="card">${data.map(a => `<div class="row"><div><b>${esc(a.title)}</b> <span class="badge ${a.active ? 'active' : ''}">${a.active ? 'Ativo' : 'Oculto'}</span><br><span class="mut">${esc(a.message)}</span></div>
   <div><button class="btn ghost sm" data-tg="${a.id}" data-on="${a.active}">${a.active ? 'Ocultar' : 'Reativar'}</button> <button class="btn danger sm" data-del="${a.id}">Excluir</button></div></div>`).join('') || '<p class="empty">Nenhum comunicado.</p>'}</div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    if (fail((await db.from('announcements').insert({ title: $('#t').value.trim(), message: $('#m').value.trim(), created_by: user.id })).error)) return;
    toast('Comunicado publicado!'); announcements();
  };
  el.onclick = async (e) => {
    const d = e.target.dataset;
    if (d.tg) { await db.from('announcements').update({ active: d.on !== 'true' }).eq('id', d.tg); announcements(); }
    if (d.del && confirm('Excluir comunicado?')) { await db.from('announcements').delete().eq('id', d.del); announcements(); }
  };
}

function settings() {
  el.innerHTML = `<div class="card"><h3>Conta administrativa</h3><p><b>${esc(profile.full_name)}</b><br><span class="mut">${esc(profile.email)}</span></p>
   <p class="mut">Novos administradores só podem ser criados pelo proprietário, direto no SQL Editor do Supabase:<br><code>update profiles set role = 'admin' where email = 'email@exemplo.com';</code></p></div>`;
}
