import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSearchResults,
  providerLabel,
  relativeTime,
  renderTemplatePreview,
  triggerLabel,
} from "../lib/brunaflow/presentation.ts";

test("apresenta os nomes usados pela interface sem expor códigos internos", () => {
  assert.equal(triggerLabel("user.created"), "Novo usuário cadastrado");
  assert.equal(triggerLabel("custom.event"), "custom.event");
  assert.equal(providerLabel("groq"), "Groq");
  assert.equal(providerLabel("gemini"), "Gemini");
  assert.equal(providerLabel("pending"), "Aguardando IA");
  assert.equal(providerLabel("demo"), "Demonstração");
});

test("renderiza a prévia do modelo com os exemplos informados", () => {
  assert.equal(
    renderTemplatePreview(
      "Olá, {{nome}}! Responda para {{email}} sobre {{nome_automacao}}.",
      { name: "Boas-vindas" },
      { name: "Joana", email: "joana@example.com" },
    ),
    "Olá, Joana! Responda para joana@example.com sobre Boas-vindas.",
  );
});

test("formata o tempo relativo de forma determinística", () => {
  const now = Date.parse("2026-09-29T12:00:00.000Z");
  assert.equal(relativeTime("2026-09-29T11:59:40.000Z", now), "agora");
  assert.equal(relativeTime("2026-09-29T11:45:00.000Z", now), "há 15 min");
  assert.equal(relativeTime("2026-09-29T09:10:00.000Z", now), "há 2h");
});

test("pesquisa entidades do workspace e limita os resultados", () => {
  const results = buildSearchResults("usuário", {
    automations: [
      {
        id: 1,
        name: "Boas-vindas",
        description: "",
        triggerType: "user.created",
        actionType: "Enviar e-mail pelo Gmail",
        status: "active",
        runs: 0,
        successRate: 0,
      },
    ],
    templates: [],
    emails: [],
    runs: [],
  });

  assert.deepEqual(results, [
    {
      key: "automation-1",
      label: "Boas-vindas",
      detail: "Automação · Novo usuário cadastrado",
      tab: "automations",
    },
  ]);
  assert.deepEqual(
    buildSearchResults("   ", {
      automations: [],
      templates: [],
      emails: [],
      runs: [],
    }),
    [],
  );
});
