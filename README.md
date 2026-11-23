# StudyFlow
Plataforma web para organizar estudos: matérias, tarefas, planejamento semanal, cronômetro, metas e estatísticas. Possui dois papéis: **USER** (estudante) e **ADMIN** (painel administrativo).

## Funcionalidades
- Cadastro, login, recuperação de senha por e-mail e sessão persistente (Supabase Auth)
- **Usuário:** dashboard, matérias, tarefas (filtros, busca, avisos de vencimento), planejamento semanal, cronômetro, metas, histórico com gráficos, perfil
- **Admin:** visão geral, usuários (busca, bloquear/desbloquear, excluir), estatísticas, comunicados (aparecem no dashboard dos usuários), configurações
- Segurança com RLS: cada usuário só acessa seus dados; contas bloqueadas perdem acesso no banco

## Tecnologias
HTML5, CSS3, JavaScript (módulos ES), Supabase (Auth + PostgreSQL), Chart.js.

## Estrutura
```
index.html login.html cadastro.html recuperar-senha.html
dashboard.html materias.html tarefas.html planejamento.html cronometro.html metas.html historico.html perfil.html
admin.html            <- painel admin (as seções usam #overview, #users, #stats, #announcements, #settings)
css/  style.css auth.css responsive.css
js/   supabase.js (config) auth.js (login + layout + proteção de páginas + utilitários)
      dashboard.js materias.js tarefas.js planejamento.js cronometro.js metas.js historico.js perfil.js admin.js
database/schema.sql
```
Ajuste técnico: o menu lateral é montado por `startPage()` em `js/auth.js`, evitando repetir HTML em todas as páginas; o painel admin é uma única página com seções.

## Como executar
1. Crie um projeto grátis em https://supabase.com.
2. No Supabase: **SQL Editor > New query**, cole todo o `database/schema.sql` e clique em **Run**.
3. Em **Project Settings > API**, copie a *Project URL* e a chave **anon/publishable** e cole em `js/supabase.js`. Nunca use a `service_role`.
4. Em **Authentication > URL Configuration**, coloque a URL do seu site (ex.: `http://localhost:5500`) em *Site URL* e em *Redirect URLs* (necessário para recuperar senha).
5. Rode com um servidor local (módulos ES **não** funcionam abrindo o arquivo direto): extensão *Live Server* do VS Code, ou `python3 -m http.server 5500` na pasta do projeto, e abra `http://localhost:5500`.

## Criando o primeiro administrador
Crie uma conta normalmente pelo site e, no **SQL Editor** do Supabase, execute:
```sql
update profiles set role = 'admin' where email = 'seu@email.com';
```
Cadastros públicos sempre viram USER; usuários comuns não conseguem alterar o próprio papel (trigger `protect_profile`).

## Publicar
Sites estáticos: Netlify, Vercel, Cloudflare Pages ou GitHub Pages. Envie a pasta, depois adicione a URL publicada em *Authentication > URL Configuration* no Supabase.

## Dicas para estudar o código
Comece por `js/auth.js` (como a página é protegida) e `js/materias.js` (CRUD simples). Os outros arquivos seguem o mesmo padrão.
