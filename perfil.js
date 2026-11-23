import { db } from './supabase.js';
import { startPage, $, esc, toast, fail } from './auth.js';
const { user, profile, el } = await startPage('Meu Perfil');
const { data: g } = await db.from('goals').select('*').maybeSingle();

el.innerHTML = `<div class="grid2"><div class="card"><h3>Dados da conta</h3><form id="f" class="form">
  <label class="mut">Nome<input id="name" value="${esc(profile.full_name)}" required minlength="3" maxlength="80"></label>
  <label class="mut">E-mail<input value="${esc(profile.email)}" disabled></label>
  <label class="mut">Conta criada em<input value="${new Date(profile.created_at).toLocaleDateString('pt-BR')}" disabled></label><button class="btn">Salvar nome</button></form></div>
  <div class="card"><h3>Preferências de estudo</h3><form id="g" class="form">
  <label class="mut">Meta diária (min)<input id="d" type="number" min="5" max="1440" value="${g?.daily_minutes ?? 120}"></label>
  <label class="mut">Meta semanal (h)<input id="w" type="number" min="1" max="168" step="0.5" value="${g?.weekly_hours ?? 10}"></label>
  <label class="mut">Tema<select disabled><option>Escuro</option></select></label><button class="btn">Salvar preferências</button></form>
  <p><button class="btn danger" id="out">Encerrar sessão</button></p></div></div>`;
$('#f').onsubmit = async (e) => {
  e.preventDefault();
  if (fail((await db.from('profiles').update({ full_name: $('#name').value.trim() }).eq('id', user.id)).error)) return;
  toast('Nome atualizado!');
};
$('#g').onsubmit = async (e) => {
  e.preventDefault();
  if (fail((await db.from('goals').upsert({ user_id: user.id, daily_minutes: +$('#d').value, weekly_hours: +$('#w').value }, { onConflict: 'user_id' })).error)) return;
  toast('Preferências salvas!');
};
$('#out').onclick = () => $('#logout').click();
