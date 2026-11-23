import { db } from './supabase.js';
import { startPage, $, esc, toast, fail, hours } from './auth.js';
const { user, el } = await startPage('Cronômetro de Estudos');

// Estado do cronômetro. Usamos Date.now() (e não contagem de setInterval) para o tempo não "atrasar".
let running = false, accumulated = 0, startedAt = 0, sessionStart = null, timer = null;
const elapsed = () => accumulated + (running ? Date.now() - startedAt : 0);

el.innerHTML = `<div class="card"><select id="subject"></select><div class="timer" id="time">00:00:00</div>
  <div class="row" style="justify-content:center;border:0"><button class="btn" id="start">▶ Iniciar</button><button class="btn ghost" id="pause" disabled>⏸ Pausar</button><button class="btn danger" id="finish" disabled>■ Finalizar</button></div></div>
  <div class="card"><h3>Sessões de hoje</h3><div id="today"></div></div>`;

function show() {
  const s = Math.floor(elapsed() / 1000);
  $('#time').textContent = [s / 3600 | 0, (s / 60 | 0) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':');
}
function buttons() {
  $('#start').disabled = running; $('#pause').disabled = !running; $('#finish').disabled = !sessionStart;
  $('#start').textContent = sessionStart ? '▶ Continuar' : '▶ Iniciar'; $('#subject').disabled = !!sessionStart;
}
$('#start').onclick = () => {
  if (!$('#subject').value) return toast('Escolha uma matéria.', 'err');
  if (!sessionStart) sessionStart = new Date();
  running = true; startedAt = Date.now(); timer = setInterval(show, 500); buttons();
};
$('#pause').onclick = () => { accumulated = elapsed(); running = false; clearInterval(timer); show(); buttons(); };
$('#finish').onclick = async () => {
  const seconds = Math.round(elapsed() / 1000); clearInterval(timer);
  if (seconds < 10) { toast('Sessão muito curta (mínimo 10s), não foi salva.', 'err'); }
  else {
    const { error } = await db.from('study_sessions').insert({ user_id: user.id, subject_id: $('#subject').value, started_at: sessionStart.toISOString(), duration_seconds: seconds });
    if (fail(error)) { if (running) timer = setInterval(show, 500); return; }
    toast('Sessão salva! 👏');
  }
  running = false; accumulated = 0; sessionStart = null; show(); buttons(); loadToday();
};
addEventListener('beforeunload', (e) => { if (sessionStart) e.preventDefault(); }); // avisa antes de perder a sessão

async function loadToday() {
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const { data, error } = await db.from('study_sessions').select('*, subjects(name,color)').gte('started_at', midnight.toISOString()).order('started_at', { ascending: false });
  if (fail(error)) return;
  $('#today').innerHTML = data.map(x => `<div class="row"><span style="color:${esc(x.subjects?.color || '#888')}">● ${esc(x.subjects?.name || 'Sem matéria')}</span><span>${Math.round(x.duration_seconds / 60)} min</span></div>`).join('')
    + (data.length ? `<p class="mut">Total hoje: ${hours(data.reduce((n, x) => n + x.duration_seconds, 0))}h</p>` : '<p class="empty">Nenhuma sessão hoje.</p>');
}
const { data: subs } = await db.from('subjects').select('id,name').order('name');
$('#subject').innerHTML = subs?.length ? subs.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('') : '<option value="">Cadastre uma matéria primeiro</option>';
buttons(); loadToday();
