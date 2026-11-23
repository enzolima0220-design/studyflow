import { db } from './supabase.js';
import { startPage, $, esc, toast, fail } from './auth.js';
const { user, el } = await startPage('Planejamento Semanal');
const NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // semana começando na segunda
let editId = null, plans = [];

el.innerHTML = `<div class="card"><form id="f" class="form"><select id="subject" required></select>
  <select id="weekday">${ORDER.map(d => `<option value="${d}">${NAMES[d]}</option>`).join('')}</select>
  <input id="start" type="time" required><input id="end" type="time" required>
  <button class="btn">Salvar</button><button type="button" id="cancel" class="btn ghost" hidden>Cancelar</button></form></div>
  <div class="week" id="week"></div>`;

async function load() {
  const [s, p] = await Promise.all([db.from('subjects').select('id,name').order('name'),
    db.from('study_plans').select('*, subjects(name,color)').order('start_time')]);
  if (fail(s.error) || fail(p.error)) return;
  plans = p.data;
  $('#subject').innerHTML = s.data.length ? s.data.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('') : '<option value="">Cadastre uma matéria primeiro</option>';
  $('#week').innerHTML = ORDER.map(d => `<div class="day"><b>${NAMES[d]}</b>${plans.filter(x => x.weekday === d).map(x =>
    `<div class="slot" style="border-color:${esc(x.subjects?.color || '#8b5cf6')}"><b>${esc(x.subjects?.name || '—')}</b><br>${x.start_time.slice(0, 5)} - ${x.end_time.slice(0, 5)}<br>
    <a href="#" data-edit="${x.id}">editar</a> · <a href="#" data-del="${x.id}">excluir</a></div>`).join('') || '<p class="mut">Livre</p>'}</div>`).join('');
}
$('#f').onsubmit = async (e) => {
  e.preventDefault();
  const row = { subject_id: $('#subject').value, weekday: +$('#weekday').value, start_time: $('#start').value, end_time: $('#end').value };
  if (!row.subject_id) return toast('Escolha uma matéria.', 'err');
  if (row.end_time <= row.start_time) return toast('O horário final deve ser depois do inicial.', 'err');
  const { error } = editId ? await db.from('study_plans').update(row).eq('id', editId) : await db.from('study_plans').insert({ ...row, user_id: user.id });
  if (fail(error)) return;
  toast('Horário salvo!'); editId = null; $('#cancel').hidden = true; $('#f').reset(); load();
};
$('#cancel').onclick = () => { editId = null; $('#f').reset(); $('#cancel').hidden = true; };
$('#week').onclick = async (e) => {
  e.preventDefault(); const { edit, del } = e.target.dataset;
  if (edit) { const p = plans.find(x => x.id === edit); editId = edit; $('#subject').value = p.subject_id; $('#weekday').value = p.weekday; $('#start').value = p.start_time.slice(0, 5); $('#end').value = p.end_time.slice(0, 5); $('#cancel').hidden = false; scrollTo(0, 0); }
  if (del && confirm('Excluir este horário?')) { if (fail((await db.from('study_plans').delete().eq('id', del)).error)) return; toast('Horário excluído.'); load(); }
};
load();
