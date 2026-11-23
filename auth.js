import { db } from './supabase.js';

// ---------- utilitários usados por todas as páginas ----------
export const $ = (sel) => document.querySelector(sel);
// esc() evita injeção de HTML (XSS) ao mostrar texto digitado pelo usuário
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const hours = (sec) => (sec / 3600).toFixed(1);
export const day = (d) => new Date(d).toLocaleDateString('sv'); // AAAA-MM-DD no fuso local
export function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'err' ? 'err' : '');
  t.textContent = msg; document.body.append(t);
  setTimeout(() => t.remove(), 3500);
}
// Mostra o erro (se houver) e devolve true. Uso: if (fail(error)) return;
export function fail(error) {
  if (!error) return false;
  toast(error.message || 'Erro de conexão. Tente novamente.', 'err');
  return true;
}
export function chart(id, type, labels, data, label) {
  const axis = { ticks: { color: '#8b8ba3' }, grid: { color: '#1f1f2e' }, beginAtZero: true };
  return new Chart(document.getElementById(id), {
    type,
    data: { labels, datasets: [{ label, data, borderColor: '#8b5cf6', tension: .3, borderRadius: 6,
      backgroundColor: type === 'line' ? '#8b5cf655' : ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4'] }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: type === 'doughnut', labels: { color: '#8b8ba3' } } },
      scales: type === 'doughnut' ? {} : { x: { ...axis, beginAtZero: false }, y: axis } }
  });
}

// ---------- menus por papel ----------
const USER_MENU = [['dashboard.html', 'Dashboard', '▦'], ['materias.html', 'Minhas matérias', '📚'], ['tarefas.html', 'Minhas tarefas', '✅'],
  ['planejamento.html', 'Planejamento', '🗓'], ['cronometro.html', 'Cronômetro', '⏱'], ['metas.html', 'Metas', '🎯'],
  ['historico.html', 'Histórico', '📈'], ['perfil.html', 'Meu perfil', '👤']];
const ADMIN_MENU = [['admin.html#overview', 'Visão geral', '▦'], ['admin.html#users', 'Usuários', '👥'], ['admin.html#stats', 'Estatísticas', '📊'],
  ['admin.html#announcements', 'Comunicados', '📣'], ['admin.html#settings', 'Configurações', '⚙']];

const stop = () => new Promise(() => {}); // pausa o script da página enquanto redireciona

// Protege a página e monta o layout. As páginas fazem: const { user, profile, el } = await startPage('Título')
// IMPORTANTE: isto é só a camada visual. A segurança real está nas políticas RLS do banco.
export async function startPage(title, adminOnly = false) {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { location.replace('login.html'); return stop(); }
  const { data: profile, error } = await db.from('profiles').select('*').eq('id', session.user.id).single();
  if (error || !profile || profile.status === 'blocked') {
    await db.auth.signOut(); location.replace('login.html?blocked=1'); return stop();
  }
  const isAdmin = profile.role === 'admin';
  if (adminOnly !== isAdmin) { location.replace(isAdmin ? 'admin.html' : 'dashboard.html'); return stop(); }

  const page = location.pathname.split('/').pop();
  const menu = isAdmin ? ADMIN_MENU : USER_MENU;
  document.body.innerHTML = `<div class="layout"><aside id="side"><div class="logo">◆ StudyFlow</div>
    <nav>${menu.map(([href, label, icon]) => `<a href="${href}">${icon} ${label}</a>`).join('')}</nav>
    <div class="mut" style="padding:0 8px">${esc(profile.full_name)}<br>${isAdmin ? 'Administrador' : 'Estudante'}</div>
    <button id="logout" class="btn ghost">Sair</button></aside>
    <main><header><button id="burger" class="btn ghost">☰</button><h1>${esc(title)}</h1></header><section id="content"></section></main></div>`;
  const mark = () => document.querySelectorAll('nav a').forEach(a => a.classList.toggle('active',
    a.getAttribute('href') === page + (location.hash || (isAdmin ? '#overview' : ''))));
  mark(); addEventListener('hashchange', mark);
  $('#burger').onclick = () => $('#side').classList.toggle('open');
  $('#logout').onclick = async () => { await db.auth.signOut(); location.replace('login.html'); };
  return { user: session.user, profile, el: $('#content') };
}

// ---------- telas públicas: login, cadastro, recuperação ----------
export async function initAuth(kind) {
  const msg = $('#msg');
  const show = (text, type = 'err') => { msg.textContent = text; msg.className = 'msg ' + type; };
  const { data: { session } } = await db.auth.getSession();
  if (session && kind !== 'recover') return location.replace('dashboard.html');
  if (new URLSearchParams(location.search).get('blocked')) show('Sua conta está bloqueada ou indisponível.');

  if (kind === 'login') $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const { data, error } = await db.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value });
    if (error) return show('E-mail ou senha incorretos.');
    const { data: p, error: profileError } = await db
  .from('profiles')
  .select('status, role')
  .eq('id', data.user.id)
  .maybeSingle();

console.log('Perfil:', p);
console.log('Erro do perfil:', profileError);
    if (!p || p.status === 'blocked') { await db.auth.signOut(); return show('Sua conta está bloqueada.'); }
    location.replace('dashboard.html'); // admin é redirecionado automaticamente por startPage
  };

  if (kind === 'signup') $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const name = $('#name').value.trim(), password = $('#password').value;
    if (name.length < 3) return show('Informe seu nome completo.');
    if (password.length < 8) return show('A senha precisa ter pelo menos 8 caracteres.');
    if (password !== $('#confirm').value) return show('As senhas não conferem.');
    if (!$('#terms').checked) return show('Aceite os termos de uso.');
    // O papel NÃO é enviado: o banco sempre cria como "user".
    const { data, error } = await db.auth.signUp({ email: $('#email').value.trim(), password, options: { data: { full_name: name } } });
    if (error) return show(error.message);
    if (data.session) location.replace('dashboard.html');
    else show('Conta criada! Confirme seu e-mail para entrar.', 'ok');
  };

  if (kind === 'recover') {
    $('#f').onsubmit = async (e) => {
      e.preventDefault();
      const { error } = await db.auth.resetPasswordForEmail($('#email').value.trim(), { redirectTo: location.origin + location.pathname });
      error ? show(error.message) : show('Enviamos um link de recuperação para seu e-mail.', 'ok');
    };
    // Quando o usuário volta pelo link do e-mail, mostramos o formulário de nova senha
    db.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') { $('#f').hidden = true; $('#f2').hidden = false; } });
    $('#f2').onsubmit = async (e) => {
      e.preventDefault();
      if ($('#newpass').value.length < 8) return show('A senha precisa ter pelo menos 8 caracteres.');
      const { error } = await db.auth.updateUser({ password: $('#newpass').value });
      if (error) return show(error.message);
      show('Senha alterada! Redirecionando...', 'ok'); setTimeout(() => location.replace('dashboard.html'), 1500);
    };
  }
}
