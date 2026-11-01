# Controle Financeiro

App de controle financeiro com dashboard e CRUD completo.
**Stack:** Node.js + Express 5 + SQLite (better-sqlite3) + frontend em HTML/CSS/JS puro.

## Como rodar

```bash
npm install
npm start      # http://localhost:3000 → crie sua conta na tela de login
npm run seed -- seu@email.com   # opcional: lançamentos de exemplo para essa conta
```

Use `npm run dev` para recarregar o servidor ao editar o código e `npm test` para rodar os testes da API.
Variáveis opcionais (veja `.env.example`): `PORT`, `DB_PATH`, `AUTH_RATE_MAX`, `NODE_ENV` e `TRUST_PROXY`. O banco é criado em `data/financeiro.db`.

## Estrutura

```
src/
  server.js            inicia o servidor
  app.js               Express: rotas, arquivos estáticos, tratamento de erros
  db.js                conexão SQLite, criação das tabelas e migração
  validation.js        validação dos lançamentos (retorna 422 com detalhes por campo)
  categories.js        categorias de receita e despesa
  routes/
    transactions.js    CRUD de lançamentos
    dashboard.js       totais, despesas por categoria, histórico de 6 meses
  auth.js              cadastro, login, logout, sessões e proteções
  seed.js              dados de exemplo para uma conta
public/                frontend (index.html, login.html, style.css, app.js, auth.js)
test/api.test.js       testes da API
```

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/transactions` | Lista. Filtros: `month=AAAA-MM`, `type=in\|out`, `category`, `q` |
| GET | `/api/transactions/:id` | Busca um lançamento |
| POST | `/api/transactions` | Cria (201) |
| PUT | `/api/transactions/:id` | Atualiza |
| DELETE | `/api/transactions/:id` | Remove (204) |
| GET | `/api/dashboard?month=AAAA-MM` | Resumo do mês e histórico |
| GET | `/api/categories` | Categorias por tipo |
| POST | `/api/auth/register` | Cria conta (`name`, `email`, `password` com 8+ caracteres) e já inicia a sessão |
| POST | `/api/auth/login` | Entra com `email` e `password` |
| POST | `/api/auth/logout` | Encerra a sessão (204) |
| GET | `/api/auth/me` | Dados do usuário logado |

Todas as rotas de `/api/transactions` e `/api/dashboard` exigem login (401 sem sessão) e só acessam os dados do próprio usuário.

Corpo de POST/PUT:

```json
{ "description": "Mercado", "amount": 120.5, "type": "out", "category": "Alimentação", "date": "2026-11-03" }
```

Os valores são guardados em centavos (inteiros) no banco para evitar erros de ponto flutuante.

## Segurança

- Senhas guardadas com scrypt e salt aleatório; nunca em texto puro.
- Sessão por token aleatório em cookie `HttpOnly` + `SameSite=Lax` (`Secure` quando `NODE_ENV=production`); no banco fica apenas o hash do token. Validade de 7 dias.
- Escritas na API só aceitam `application/json`, o que bloqueia formulários de outros sites (CSRF).
- Limite de tentativas por IP em cadastro e login; a mensagem de erro de login não revela se o e-mail existe.
- Bancos criados antes do login são migrados automaticamente: os lançamentos antigos passam para a primeira conta criada.
- Em produção, sirva por HTTPS e defina `NODE_ENV=production` (e `TRUST_PROXY=1` atrás de proxy).

## Próximos passos sugeridos

Recuperação de senha por e-mail, metas por categoria, lançamentos recorrentes, exportação CSV e deploy com Docker.
