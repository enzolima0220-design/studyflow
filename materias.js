import { db } from './supabase.js';
import { startPage, $, esc, toast, fail } from './auth.js';
const { user, el } = await startPage('Minhas Matérias');
let editId = null, subjects = [];

el.innerHTML = `<div class="card"><form id="f" class="form">
  <input id="name" placeholder="Nome (ex: Matemática)" required maxlength="60"><input id="color" type="color" value="#8b5cf6">
  <textarea id="desc" placeholder="Descrição (opcional)"></textarea>
  <button class="btn">Salvar</button><button type="button" id="cancel" class="btn ghost" hidden>Cancelar</button></form></div>
  <div id="list" class="grid"></div>`;

async function load() {
  const [s, t] = await Promise.all([db.from('subjects').select('*').order('name'), db.from('tasks').select('subject_id')]);
  if (fail(s.error)) return;
  subjects = s.data;
  const count = {}; (t.data || []).forEach(x => count[x.subject_id] = (count[x.subject_id] || 0) + 1);
  $('#list').innerHTML = subjects.map(m => `<div class="card" style="border-top:3px solid ${esc(m.color)}">
    <h2>${esc(m.name)}</h2><p class="mut">${esc(m.description) || 'Sem descrição'}</p><span class="badge">${count[m.id] || 0} tarefa(s)</span>
    <div class="row"><button class="btn ghost sm" data-edit="${m.id}">Editar</button><button class="btn danger sm" data-del="${m.id}">Excluir</button></div></div>`).join('')
    || '<p class="empty">Nenhuma matéria ainda. Cadastre a primeira acima!</p>';
}
function reset() { editId = null; $('#f').reset(); $('#color').value = '#8b5cf6'; $('#cancel').hidden = true; }

$('#f').onsubmit = async (e) => {
  e.preventDefault();
  const row = { name: $('#name').value.trim(), color: $('#color').value, description: $('#desc').value.trim() };
  if (!row.name) return toast('Informe o nome.', 'err');
  const { error } = editId ? await db.from('subjects').update(row).eq('id', editId) : await db.from('subjects').insert({ ...row, user_id: user.id });
  if (fail(error)) return;
  toast('Matéria salva!'); reset(); load();
};
$('#cancel').onclick = reset;
$('#list').onclick = async (e) => {
  const { edit, del } = e.target.dataset;
  if (edit) { const m = subjects.find(x => x.id === edit); editId = edit; $('#name').value = m.name; $('#color').value = m.color; $('#desc').value = m.description || ''; $('#cancel').hidden = false; scrollTo(0, 0); }
  if (del && confirm('Excluir esta matéria? As tarefas ficarão sem matéria.')) {
    if (fail((await db.from('subjects').delete().eq('id', del)).error)) return;
    toast('Matéria excluída.'); load();
  }
};
load();
