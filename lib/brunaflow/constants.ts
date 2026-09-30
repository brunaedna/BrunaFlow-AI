import type { Automation, Metrics, Tab } from "./types";

export const EMPTY_METRICS: Metrics = {
  executions: 0,
  successRate: 0,
  timeSavedMinutes: 0,
};

export const STARTER_AUTOMATIONS: Automation[] = [
  {
    id: 1,
    name: "Boas-vindas para novos usuários",
    description: "Envia uma mensagem personalizada após cada cadastro",
    triggerType: "user.created",
    actionType: "Enviar e-mail pelo Gmail",
    status: "active",
    runs: 0,
    successRate: 0,
  },
  {
    id: 2,
    name: "Resposta a novo formulário",
    description: "Responde automaticamente aos contatos recebidos",
    triggerType: "form.submitted",
    actionType: "Enviar e-mail pelo Gmail",
    status: "active",
    runs: 0,
    successRate: 0,
  },
  {
    id: 3,
    name: "Contato de novo lead",
    description: "Analisa e responde novos leads recebidos pelo webhook",
    triggerType: "lead.created",
    actionType: "Enviar e-mail pelo Gmail",
    status: "paused",
    runs: 0,
    successRate: 0,
  },
];

export const STATUS_LABEL: Record<string, string> = {
  success: "Concluído",
  processing: "Processando",
  failed: "Falhou",
  retry: "Nova tentativa",
  active: "Ativa",
  paused: "Pausada",
};

export const PAGE_META: Record<
  Tab,
  { eyebrow: string; title: string; description: string }
> = {
  overview: {
    eyebrow: "CENTRAL DE OPERAÇÕES",
    title: "Sua central de automações",
    description:
      "Métricas calculadas somente a partir das suas execuções e da conta conectada.",
  },
  automations: {
    eyebrow: "FLUXOS",
    title: "Suas automações",
    description:
      "Crie, teste e gerencie processos inteligentes em um só lugar.",
  },
  runs: {
    eyebrow: "MONITORAMENTO",
    title: "Histórico de execuções",
    description: "Monitore cada etapa, tentativa e resultado dos seus fluxos.",
  },
  emails: {
    eyebrow: "COMUNICAÇÃO",
    title: "E-mails",
    description:
      "Crie mensagens reutilizáveis e acompanhe os envios realizados pelo BrunaFlow.",
  },
  integrations: {
    eyebrow: "CONEXÕES",
    title: "Integrações",
    description:
      "Conecte os serviços que enviam e processam as suas automações.",
  },
  webhooks: {
    eyebrow: "ENTRADA DE EVENTOS",
    title: "Webhooks",
    description:
      "Receba eventos reais do seu site, formulário, aplicativo ou CRM.",
  },
  settings: {
    eyebrow: "WORKSPACE",
    title: "Configurações",
    description:
      "Gerencie privacidade, histórico e dados vinculados a este navegador.",
  },
};
