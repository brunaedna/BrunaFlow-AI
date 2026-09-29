import type {
  Automation,
  EmailTemplate,
  Run,
  SearchResult,
  SentEmail,
} from "./types";

const TRIGGER_LABELS: Record<string, string> = {
  "user.created": "Novo usuário cadastrado",
  "form.submitted": "Novo formulário recebido",
  "lead.created": "Novo lead recebido",
  "appointment.requested": "Solicitação de agendamento",
};

export function renderTemplatePreview(
  value: string,
  template: { name: string },
  example: { name: string; email: string },
) {
  const variables = {
    nome: example.name || "Maria",
    email: example.email || "maria@exemplo.com",
    mensagem: "Este é um envio de teste do editor de modelos.",
    classificacao: "Novo contato",
    prioridade: "Normal",
    nome_automacao: template.name || "Minha automação",
  };
  return value.replace(
    /\{\{\s*(nome|email|mensagem|classificacao|prioridade|nome_automacao)\s*\}\}/gi,
    (_, key: string) => variables[key.toLowerCase()] || "",
  );
}

export function triggerLabel(value: string) {
  return TRIGGER_LABELS[value] || value;
}

export function providerLabel(value: string) {
  return value === "groq"
    ? "Groq"
    : value === "gemini"
      ? "Gemini"
      : "Demonstração";
}

export function relativeTime(value: string, now = Date.now()) {
  const minutes = Math.max(
    0,
    Math.round((now - new Date(value).getTime()) / 60_000),
  );
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  return `há ${Math.floor(minutes / 60)}h`;
}

export function buildSearchResults(
  query: string,
  data: {
    automations: Automation[];
    templates: EmailTemplate[];
    emails: SentEmail[];
    runs: Run[];
  },
): SearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  return [
    ...data.automations.map((item) => ({
      key: `automation-${item.id}`,
      label: item.name,
      detail: `Automação · ${triggerLabel(item.triggerType)}`,
      tab: "automations" as const,
    })),
    ...data.templates.map((item) => ({
      key: `template-${item.id}`,
      label: item.name,
      detail: `Modelo · ${item.subject}`,
      tab: "emails" as const,
    })),
    ...data.emails.map((item) => ({
      key: `email-${item.id}`,
      label: item.recipientName || item.recipientEmail,
      detail: `E-mail enviado · ${item.subject}`,
      tab: "emails" as const,
    })),
    ...data.runs.map((item) => ({
      key: `run-${item.id}`,
      label: item.contactName,
      detail: `Execução · ${item.automationName}`,
      tab: "runs" as const,
    })),
  ]
    .filter((item) =>
      `${item.label} ${item.detail}`.toLowerCase().includes(normalizedQuery),
    )
    .slice(0, 8);
}
