import { db } from './supabase.js';
import { startPage, $, esc, toast, fail } from './auth.js';
const { user, el } = await startPage('Minhas Tarefas');
let editId = null, tasks = [];
const PRI = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }, STA = { pendente: 'Pendente', andamento: 'Em andamento', concluida: 'Concluída' };
const opts = (o) => Object.entries(o).map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

el.innerHTML = `<div class="card"><form id="f" class="form">
  <input id="title" placeholder="Título" required maxlength="120"><select id="subject"></select><input id="due" type="date">
  <select id="priority">${opts(PRI)}</select><select id="status">${opts(STA)}</select>
  <textarea id="desc" placeholder="Descrição"></textarea>
  <button class="btn">Salvar</button><button type="button" id="cancel" class="btn ghost" hidden>Cancelar</button></form></div>
  <div class="card"><div class="filters"><input id="q" placeholder="🔍 Pesquisar tarefas..."><select id="fs"></select>
  <select id="fp"><option value="">Todas prioridades</option>${opts(PRI)}</select></div><div id="list"></div></div>`;
$('#priority').value = 'media';

// Calcula aviso de vencimento
function warning(t) {
  if (!t.due_date || t.status === 'concluida') return '';
  const days = Math.ceil((new Date(t.due_date + 'T00:00') - new Date().setHours(0, 0, 0, 0)) / 864e5);
  if (days < 0) return '<span class="badge late">⚠ Atrasada</span>';
  if (days <= 2) return `<span class="badge soon">⏰ Vence ${days === 0 ? 'hoje' : 'em ' + days + ' dia(s)'}</span>`;
  return '';
}
function render() {
  const q = $('#q').value.toLowerCase(), fs = $('#fs').value, fp = $('#fp').value;
  const rows = tasks.filter(t => (!fs || t.subject_id === fs) && (!fp || t.priority === fp) && (t.title + ' ' + (t.description || '')).toLowerCase().includes(q));
  $('#list').innerHTML = rows.map(t => `<div class="row"><div><b style="${t.status === 'concluida' ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(t.title)}</b> ${warning(t)}
    <div class="mut"><span style="color:${esc(t.subjects?.color || '#888')}">● ${esc(t.subjects?.name || 'Sem matéria')}</span> · ${t.due_date ? t.due_date.split('-').reverse().join('/') : 'sem data'}
    · <span class="badge ${t.priority}">${PRI[t.priority]}</span> <span class="badge">${STA[t.status]}</span></div></div>
    <div>${t.status !== 'concluida' ? `<button class="btn sm" data-done="${t.id}">✔ Concluir</button> ` : ''}
    <button class="btn ghost sm" data-edit="${t.id}">Editar</button> <button class="btn danger sm" data-del="${t.id}">Excluir</button></div></div>`).join('')
    || '<p class="empty">Nenhuma tarefa encontrada.</p>';
}
async function load() {
  const [s, t] = await Promise.all([db.from('subjects').select('id,name').order('name'), db.from('tasks').select('*, subjects(name,color)').order('due_date', { nullsFirst: false })]);
  if (fail(s.error) || fail(t.error)) return;
  tasks = t.data;
  const so = s.data.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
  $('#subject').innerHTML = '<option value="">Sem matéria</option>' + so;
  const cur = $('#fs').value; $('#fs').innerHTML = '<option value="">Todas matérias</option>' + so; $('#fs').value = cur;
  render();
}
function reset() { editId = null; $('#f').reset(); $('#priority').value = 'media'; $('#cancel').hidden = true; }

$('#f').onsubmit = async (e) => {
  e.preventDefault();
  const row = { title: $('#title').value.trim(), description: $('#desc').value.trim(), subject_id: $('#subject').value || null,
    due_date: $('#due').value || null, priority: $('#priority').value, status: $('#status').value };
  if (!row.title) return toast('Informe o título.', 'err');
  const { error } = editId ? await db.from('tasks').update(row).eq('id', editId) : await db.from('tasks').insert({ ...row, user_id: user.id });
  if (fail(error)) return;
  toast('Tarefa salva!'); reset(); load();
};
$('#cancel').onclick = reset;
['#q', '#fs', '#fp'].forEach(s => $(s).oninput = render);
$('#list').onclick = async (e) => {
  const { edit, del, done } = e.target.dataset;
  if (done) { if (fail((await db.from('tasks').update({ status: 'concluida' }).eq('id', done)).error)) return; toast('Tarefa concluída! 🎉'); load(); }
  if (edit) { const t = tasks.find(x => x.id === edit); editId = edit; $('#title').value = t.title; $('#desc').value = t.description || ''; $('#subject').value = t.subject_id || '';
    $('#due').value = t.due_date || ''; $('#priority').value = t.priority; $('#status').value = t.status; $('#cancel').hidden = false; scrollTo(0, 0); }
  if (del && confirm('Excluir esta tarefa?')) { if (fail((await db.from('tasks').delete().eq('id', del)).error)) return; toast('Tarefa excluída.'); load(); }
};
load();
