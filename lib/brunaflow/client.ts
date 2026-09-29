import type {
  Automation,
  AutomationForm,
  DashboardData,
  EmailTemplate,
  GmailStatus,
  LeadForm,
  TemplateForm,
  WebhookStatus,
} from "./types";

type JsonRecord = Record<string, unknown>;

async function requestJson<T>(
  resource: string,
  init: RequestInit | undefined,
  fallbackMessage: string,
): Promise<T> {
  const response = await fetch(resource, init);
  const data = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : fallbackMessage,
    );
  }
  return data as T;
}

function jsonRequest(method: string, payload?: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  };
}

export const brunaFlowApi = {
  dashboard: () =>
    requestJson<DashboardData>(
      "/api/dashboard",
      undefined,
      "Não foi possível carregar o painel.",
    ),

  templates: () =>
    requestJson<{ templates: EmailTemplate[] }>(
      "/api/email-templates",
      undefined,
      "Não foi possível carregar os modelos.",
    ),

  gmailStatus: () =>
    requestJson<GmailStatus>(
      "/api/integrations/gmail/status",
      undefined,
      "Não foi possível sincronizar o Gmail.",
    ),

  webhookStatus: () =>
    requestJson<WebhookStatus>(
      "/api/webhooks/config",
      undefined,
      "Não foi possível carregar o webhook.",
    ),

  createAutomation: (form: AutomationForm | Record<string, unknown>) =>
    requestJson<{ automation: Automation }>(
      "/api/dashboard",
      jsonRequest("POST", {
        kind: "automation",
        ...form,
        templateId: Number(form.templateId),
      }),
      "Não foi possível salvar.",
    ),

  generateTemplate: (form: TemplateForm) =>
    requestJson<{
      subject: string;
      body: string;
      provider: string;
    }>(
      "/api/email-templates",
      jsonRequest("POST", {
        kind: "generate",
        name: form.name || "Modelo de e-mail",
        subjectHint: form.subject,
        instructions: form.body,
      }),
      "A IA não conseguiu gerar o texto.",
    ),

  saveTemplate: (form: TemplateForm, id: number | null) =>
    requestJson<{ template: EmailTemplate }>(
      "/api/email-templates",
      jsonRequest(id ? "PATCH" : "POST", { ...form, id }),
      "Não foi possível salvar.",
    ),

  sendTemplateTest: (
    form: TemplateForm,
    id: number | null,
    example: { name: string; email: string },
  ) =>
    requestJson<{ sender: string; subject: string; sent: boolean }>(
      "/api/email-templates",
      jsonRequest("POST", {
        kind: "test",
        id,
        name: form.name,
        subject: form.subject,
        body: form.body,
        contactName: example.name,
        email: example.email,
      }),
      "Não foi possível enviar o teste.",
    ),

  deleteTemplate: (id: number) =>
    requestJson<{ deleted: boolean }>(
      "/api/email-templates",
      jsonRequest("DELETE", { id }),
      "Não foi possível excluir.",
    ),

  executeAutomation: (automation: Automation, lead: LeadForm) =>
    requestJson<{
      run: { provider: string };
      email: { sender: string };
    }>(
      "/api/dashboard",
      jsonRequest("POST", {
        kind: "run",
        automationId: automation.id,
        automationName: automation.name,
        ...lead,
      }),
      "A execução falhou. Tente novamente.",
    ),

  disconnectGmail: () =>
    requestJson<JsonRecord>(
      "/api/integrations/gmail/disconnect",
      { method: "POST" },
      "Não foi possível desconectar o Gmail.",
    ),

  createWebhook: () =>
    requestJson<WebhookStatus>(
      "/api/webhooks/config",
      { method: "POST" },
      "Não foi possível gerar a chave.",
    ),

  revokeWebhook: () =>
    requestJson<JsonRecord>(
      "/api/webhooks/config",
      { method: "DELETE" },
      "Não foi possível revogar a chave.",
    ),

  deleteWorkspaceData: (scope: "history" | "workspace") =>
    requestJson<JsonRecord>(
      "/api/workspace",
      jsonRequest("DELETE", { scope }),
      "Não foi possível excluir os dados.",
    ),
};
