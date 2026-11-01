const categories = require("./categories");

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const isDate = (s) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T12:00:00Z"));
const isMonth = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

// Valida e normaliza o corpo de um lançamento. Lança HttpError 422 se inválido.
function parseTransaction(body = {}) {
  const errors = {};
  const description = String(body.description ?? "").trim();
  const { type, category, date } = body;
  const amount = Number(body.amount);

  if (!description) errors.description = "Informe uma descrição.";
  else if (description.length > 60) errors.description = "Use no máximo 60 caracteres.";
  if (type !== "in" && type !== "out") errors.type = "Tipo deve ser “in” ou “out”.";
  if (!Number.isFinite(amount) || amount <= 0) errors.amount = "Informe um valor maior que zero.";
  if (!isDate(date)) errors.date = "Data inválida. Use o formato AAAA-MM-DD.";
  if (!errors.type && !categories[type].includes(category))
    errors.category = "Categoria inválida para este tipo.";

  if (Object.keys(errors).length) throw new HttpError(422, "Dados inválidos.", errors);
  return { description, type, category, date, amount_cents: Math.round(amount * 100) };
}

module.exports = { HttpError, parseTransaction, isMonth };
