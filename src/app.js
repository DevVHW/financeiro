const path = require("path");
const express = require("express");
const categories = require("./categories");
const { HttpError } = require("./validation");

const app = express();
app.use(express.json({ limit: "100kb" }));

app.get("/api/categories", (req, res) => res.json(categories));
app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api", (req, res, next) => next(new HttpError(404, "Rota não encontrada.")));

app.use(express.static(path.join(__dirname, "..", "public")));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") err = new HttpError(400, "JSON inválido.");
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    error: status === 500 ? "Erro interno do servidor." : err.message,
    details: err.details,
  });
});

module.exports = app;
