const path = require("path");
const express = require("express");
const categories = require("./categories");
const { HttpError } = require("./validation");
const auth = require("./auth");

const app = express();
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.use(express.json({ limit: "100kb" }));
app.use("/api", auth.requireJson);

app.use("/api/auth", auth.router);
app.get("/api/categories", (req, res) => res.json(categories));
app.use("/api/transactions", auth.requireAuth, require("./routes/transactions"));
app.use("/api/dashboard", auth.requireAuth, require("./routes/dashboard"));
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