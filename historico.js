import { db } from './supabase.js';
import { startPage, esc, hours, day, chart, fail } from './auth.js';
const { el } = await startPage('Histórico e Estatísticas');
const [ss, t] = await Promise.all([db.from('study_sessions').select('*, subjects(name)').order('started_at', { ascending: false }).limit(1000),
  db.from('tasks').select('status')]);
if (fail(ss.error) || fail(t.error)) throw new Error('Falha ao carregar');
const sessions = ss.data, total = sessions.reduce((n, x) => n + x.duration_seconds, 0);

// Evolução semanal (últimas 8 semanas)
const weeks = Array(8).fill(0), now = Date.now();
sessions.forEach(x => { const w = Math.floor((now - new Date(x.started_at)) / (7 * 864e5)); if (w < 8) weeks[7 - w] += x.duration_seconds; });
// Evolução mensal (últimos 6 meses)
const months = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return day(d).slice(0, 7); });
const perMonth = months.map(m => sessions.filter(x => day(x.started_at).slice(0, 7) === m).reduce((n, x) => n + x.duration_seconds, 0));
// Tempo por matéria
const bySub = {}; sessions.forEach(x => { const n = x.subjects?.name || 'Sem matéria'; bySub[n] = (bySub[n] || 0) + x.duration_seconds; });
const subs = Object.entries(bySub).sort((a, b) => b[1] - a[1]).slice(0, 6);

el.innerHTML = `<div class="grid"><div class="card"><h3>Total estudado</h3><div class="big">${hours(total)}h</div></div>
  <div class="card"><h3>Sessões</h3><div class="big">${sessions.length}</div></div>
  <div class="card"><h3>Tarefas concluídas</h3><div class="big">${t.data.filter(x => x.status === 'concluida').length}</div></div></div>
  <div class="grid2"><div class="card"><h3>Evolução semanal (h)</h3><div class="chartbox"><canvas id="c1"></canvas></div></div>
  <div class="card"><h3>Evolução mensal (h)</h3><div class="chartbox"><canvas id="c2"></canvas></div></div>
  <div class="card"><h3>Matérias com mais tempo</h3><div class="chartbox"><canvas id="c3"></canvas></div></div></div>
  <div class="card"><h3>Últimas sessões</h3>${sessions.slice(0, 15).map(x => `<div class="row"><span>${esc(x.subjects?.name || 'Sem matéria')}</span>
  <span class="mut">${new Date(x.started_at).toLocaleString('pt-BR')}</span><b>${Math.round(x.duration_seconds / 60)} min</b></div>`).join('') || '<p class="empty">Nenhuma sessão registrada ainda.</p>'}</div>`;
const h = (a) => a.map(s => +(s / 3600).toFixed(2));
chart('c1', 'line', weeks.map((_, i) => i === 7 ? 'Atual' : `-${7 - i}s`), h(weeks), 'Horas');
chart('c2', 'bar', months, h(perMonth), 'Horas');
if (subs.length) chart('c3', 'doughnut', subs.map(s => s[0]), h(subs.map(s => s[1])), 'Horas');
