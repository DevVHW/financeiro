# Controle Financeiro

App de controle financeiro com dashboard e CRUD completo.
**Stack:** Node.js + Express 5 + SQLite (better-sqlite3) + frontend em HTML/CSS/JS puro.

## Como rodar

```bash
npm install
npm run seed   # opcional: insere lançamentos de exemplo
npm start      # http://localhost:3000
```

Use `npm run dev` para recarregar o servidor ao editar o código e `npm test` para rodar os testes.
Configuração opcional em `.env.example` (`PORT`, `DB_PATH`); o banco é criado em `data/financeiro.db`.

## Estrutura

```
src/
  server.js            inicia o servidor
  app.js               Express: rotas, arquivos estáticos, tratamento de erros
  db.js                conexão SQLite e criação da tabela
  validation.js        validação dos lançamentos (retorna 422 com detalhes por campo)
  categories.js        categorias de receita e despesa
  routes/
    transactions.js    CRUD de lançamentos
    dashboard.js       totais, despesas por categoria, histórico de 6 meses
  seed.js              dados de exemplo
public/                frontend (index.html, style.css, app.js)
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

Corpo de POST/PUT:

```json
{ "description": "Mercado", "amount": 120.5, "type": "out", "category": "Alimentação", "date": "2026-11-03" }
```

Os valores são guardados em centavos (inteiros) no banco para evitar erros de ponto flutuante.

## Próximos passos sugeridos

Autenticação (login por usuário), metas por categoria, lançamentos recorrentes, exportação CSV e deploy com Docker.
