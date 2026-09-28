import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanText,
  isValidEmail,
  normalizeWebhookPayload,
  renderTemplate,
  sha256Hex,
  type TemplateVariables,
} from "../lib/automation-utils.ts";

const variables: TemplateVariables = {
  nome: "Maria",
  email: "maria@example.com",
  mensagem: "Quero conhecer o produto",
  classificacao: "Lead qualificado",
  prioridade: "Alta",
  nome_automacao: "Boas-vindas",
};

test("renderiza variáveis conhecidas sem alterar marcadores desconhecidos", () => {
  const result = renderTemplate(
    "Olá, {{ nome }}! {{EMAIL}} · {{desconhecida}}",
    variables,
  );
  assert.equal(result, "Olá, Maria! maria@example.com · {{desconhecida}}");
});

test("limpa e limita textos recebidos", () => {
  assert.equal(cleanText("  abcdef  ", 4), "abcd");
  assert.equal(cleanText(null, 20), "");
});

test("valida e-mails básicos usados pelos fluxos", () => {
  assert.equal(isValidEmail("pessoa@example.com"), true);
  assert.equal(isValidEmail("email-invalido"), false);
  assert.equal(isValidEmail("a @example.com"), false);
});

test("normaliza o payload público do webhook", () => {
  const normalized = normalizeWebhookPayload({
    automationId: "42",
    automationName: "  Cadastro  ",
    event: "user.created",
    name: "  Joana  ",
    email: " JOANA@EXAMPLE.COM ",
    message: " Bem-vinda ",
  });

  assert.deepEqual(normalized, {
    automationId: 42,
    automationName: "Cadastro",
    eventType: "user.created",
    contactName: "Joana",
    contactEmail: "joana@example.com",
    message: "Bem-vinda",
  });
});

test("usa valores seguros quando o webhook recebe campos ausentes", () => {
  assert.deepEqual(normalizeWebhookPayload(null), {
    automationId: undefined,
    automationName: "",
    eventType: "",
    contactName: "Contato",
    contactEmail: "",
    message: "",
  });
});

test("gera SHA-256 determinístico para chaves e sessões", async () => {
  assert.equal(
    await sha256Hex("brunaflow"),
    "ea723ceef2dbd25dd2e9aedf896869224c1dc0ba9064be3613a3fadef66d4c5c",
  );
});
