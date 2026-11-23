import { db } from './supabase.js';
import { startPage, $, toast, fail } from './auth.js';
const { user, el } = await startPage('Metas');

async function load() {
  // Semana começa na segunda-feira
  const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const [g, ss] = await Promise.all([db.from('goals').select('*').maybeSingle(), db.from('study_sessions').select('started_at,duration_seconds').gte('started_at', monday.toISOString())]);
  if (fail(g.error) || fail(ss.error)) return;
  const daily = g.data?.daily_minutes ?? 120, weekly = g.data?.weekly_hours ?? 10;
  const weekMin = ss.data.reduce((n, x) => n + x.duration_seconds, 0) / 60;
  const todayMin = ss.data.filter(x => new Date(x.started_at) >= midnight).reduce((n, x) => n + x.duration_seconds, 0) / 60;
  const pd = Math.min(100, Math.round(todayMin / daily * 100)), pw = Math.min(100, Math.round(weekMin / 60 / weekly * 100));
  el.innerHTML = `<div class="grid2"><div class="card"><h3>Definir metas</h3><form id="f" class="form">
    <label class="mut">Meta diária (minutos)<input id="d" type="number" min="5" max="1440" value="${daily}" required></label>
    <label class="mut">Meta semanal (horas)<input id="w" type="number" min="1" max="168" step="0.5" value="${weekly}" required></label><button class="btn">Salvar metas</button></form></div>
    <div class="card"><h3>Progresso</h3>Hoje: <b>${pd}%</b> (${Math.round(todayMin)} de ${daily} min)<div class="bar"><i style="width:${pd}%"></i></div>
    Semana: <b>${pw}%</b> (${(weekMin / 60).toFixed(1)} de ${weekly} h)<div class="bar"><i style="width:${pw}%"></i></div></div></div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await db.from('goals').upsert({ user_id: user.id, daily_minutes: +$('#d').value, weekly_hours: +$('#w').value }, { onConflict: 'user_id' });
    if (fail(error)) return; toast('Metas salvas!'); load();
  };
}
load();
