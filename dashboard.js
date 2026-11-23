import { db } from './supabase.js';
import { startPage, esc, hours, day, chart, fail } from './auth.js';
const { profile, el } = await startPage('Dashboard');

// RLS já devolve apenas os dados do usuário logado
const since = new Date(); since.setDate(since.getDate() - 6); since.setHours(0, 0, 0, 0);
const [s, t, ss, g, a] = await Promise.all([
  db.from('subjects').select('id,name,color'),
  db.from('tasks').select('*, subjects(name,color)').order('due_date'),
  db.from('study_sessions').select('*').gte('started_at', since.toISOString()),
  db.from('goals').select('*').maybeSingle(),
  db.from('announcements').select('*').eq('active', true).order('created_at', { ascending: false }).limit(3)]);
[s, t, ss, g, a].forEach(r => fail(r.error));
const subjects = s.data || [], tasks = t.data || [], sessions = ss.data || [];

const weekSec = sessions.reduce((n, x) => n + x.duration_seconds, 0);
const pending = tasks.filter(x => x.status !== 'concluida');
const weeklyGoal = g.data?.weekly_hours || 10;
const pct = Math.min(100, Math.round(weekSec / 3600 / weeklyGoal * 100));

const days = [...Array(7)].map((_, i) => { const d = new Date(since); d.setDate(d.getDate() + i); return day(d); });
const perDay = days.map(d => +(sessions.filter(x => day(x.started_at) === d).reduce((n, x) => n + x.duration_seconds, 0) / 3600).toFixed(2));
const bySubject = {};
sessions.forEach(x => bySubject[x.subject_id] = (bySubject[x.subject_id] || 0) + x.duration_seconds);
const top = subjects.map(m => ({ ...m, sec: bySubject[m.id] || 0 })).filter(m => m.sec).sort((x, y) => y.sec - x.sec).slice(0, 4);

el.innerHTML = `
 ${(a.data || []).map(n => `<div class="notice"><b>📣 ${esc(n.title)}</b><br>${esc(n.message)}</div>`).join('')}
 <p class="mut">Olá, <b>${esc(profile.full_name.split(' ')[0] || 'estudante')}</b>! Vamos estudar hoje?</p>
 <div class="grid">
  <div class="card"><h3>Matérias</h3><div class="big">${subjects.length}</div></div>
  <div class="card"><h3>Tarefas pendentes</h3><div class="big">${pending.length}</div></div>
  <div class="card"><h3>Tarefas concluídas</h3><div class="big">${tasks.length - pending.length}</div></div>
  <div class="card"><h3>Horas na semana</h3><div class="big">${hours(weekSec)}h</div></div></div>
 <div class="card"><h3>Meta semanal: ${pct}% (${hours(weekSec)}h de ${weeklyGoal}h)</h3><div class="bar"><i style="width:${pct}%"></i></div></div>
 <div class="grid2">
  <div class="card"><h3>Horas estudadas (7 dias)</h3><div class="chartbox"><canvas id="c1"></canvas></div></div>
  <div class="card"><h3>Próximas tarefas</h3>${pending.slice(0, 5).map(x => `<div class="row"><span>${esc(x.title)}<br><span class="mut">${esc(x.subjects?.name || 'Sem matéria')}</span></span><span class="badge">${x.due_date ? x.due_date.split('-').reverse().join('/') : 'sem data'}</span></div>`).join('') || '<p class="empty">Nenhuma tarefa pendente 🎉</p>'}</div></div>
 <div class="card"><h3>Matérias mais estudadas (7 dias)</h3>${top.map(m => `<div class="row"><span style="color:${esc(m.color)}">● ${esc(m.name)}</span><b>${hours(m.sec)}h</b></div>`).join('') || '<p class="empty">Registre sessões no cronômetro para ver aqui.</p>'}</div>`;
chart('c1', 'bar', days.map(d => d.slice(5)), perDay, 'Horas');
