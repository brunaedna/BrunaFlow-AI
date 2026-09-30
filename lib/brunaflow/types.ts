export type Automation = {
  id: number;
  name: string;
  description: string;
  triggerType: string;
  actionType: string;
  templateId?: number | null;
  status: string;
  runs: number;
  successRate: number;
};

export type Run = {
  id: number;
  automationId: number;
  automationName: string;
  contactName: string;
  classification: string;
  priority: string;
  status: string;
  attempts: number;
  durationMs: number;
  timeSavedMinutes: number;
  provider: string;
  model?: string;
  emailDraft: string;
  eventType?: string;
  requestId?: string;
  currentStep?: string;
  errorMessage?: string;
  completedAt?: string | null;
  createdAt: string;
};

export type EmailTemplate = {
  id: number;
  name: string;
  subject: string;
  body: string;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SentEmail = {
  id: number;
  automationId?: number;
  templateId?: number;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  status: string;
  senderEmail: string;
  sentAt: string;
};

export type Metrics = {
  executions: number;
  successRate: number;
  timeSavedMinutes: number;
};

export type GmailStatus = {
  connected: boolean;
  email?: string;
  lastSyncedAt?: string;
  error?: string;
};

export type WebhookStatus = {
  configured: boolean;
  key?: string;
  keyPrefix?: string;
  endpoint?: string;
  createdAt?: string;
  lastUsedAt?: string;
};

export type Tab =
  | "overview"
  | "automations"
  | "runs"
  | "emails"
  | "integrations"
  | "webhooks"
  | "settings";

export type AutomationForm = {
  name: string;
  description: string;
  triggerType: string;
  actionType: string;
  templateId: string;
};

export type TemplateForm = {
  name: string;
  subject: string;
  body: string;
  aiGenerated: boolean;
};

export type LeadForm = {
  contactName: string;
  contactEmail: string;
  message: string;
};

export type DashboardData = {
  automations?: Automation[];
  runs?: Run[];
  emails?: SentEmail[];
  metrics?: Metrics;
};

export type SearchResult = {
  key: string;
  label: string;
  detail: string;
  tab: Tab;
};

export type WebMcpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: Record<string, boolean>;
  execute: (input: unknown) => Promise<unknown>;
};
