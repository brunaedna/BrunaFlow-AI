"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cloud,
  Copy,
  Database,
  FileText,
  Inbox,
  KeyRound,
  Link2,
  LogOut,
  Mail,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Webhook,
  X,
  Zap,
} from "lucide-react";
import { brunaFlowApi } from "@/lib/brunaflow/client";
import { Sidebar, Topbar } from "@/components/brunaflow/app-navigation";
import {
  EMPTY_METRICS,
  PAGE_META,
  STARTER_AUTOMATIONS,
  STATUS_LABEL,
} from "@/lib/brunaflow/constants";
import {
  buildSearchResults,
  providerLabel,
  relativeTime,
  renderTemplatePreview,
  triggerLabel,
} from "@/lib/brunaflow/presentation";
import type {
  Automation,
  EmailTemplate,
  GmailStatus,
  Run,
  SentEmail,
  Tab,
  WebhookStatus,
  WebMcpTool,
} from "@/lib/brunaflow/types";

export default function Home() {
  const [automations, setAutomations] =
    useState<Automation[]>(STARTER_AUTOMATIONS);
  const [runs, setRuns] = useState<Run[]>([]);
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [gmail, setGmail] = useState<GmailStatus>({ connected: false });
  const [webhook, setWebhook] = useState<WebhookStatus>({ configured: false });
  const [tab, setTab] = useState<Tab>("overview");
  const [dialog, setDialog] = useState(false);
  const [about, setAbout] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    triggerType: "user.created",
    actionType: "Enviar e-mail pelo Gmail",
    templateId: "",
  });
  const [testAutomation, setTestAutomation] = useState<Automation | null>(null);
  const [lead, setLead] = useState({
    contactName: "",
    contactEmail: "",
    message: "Novo cadastro realizado no aplicativo.",
  });
  const [templateDialog, setTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<number | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    subject: "",
    body: "",
    aiGenerated: false,
  });
  const [templateBaseline, setTemplateBaseline] = useState("");
  const [templateExample, setTemplateExample] = useState({
    name: "Maria",
    email: "",
  });
  const [testSending, setTestSending] = useState(false);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const activeTemplateField = useRef<"subject" | "body">("body");
  const templateDirty =
    templateDialog && JSON.stringify(templateForm) !== templateBaseline;

  const loadData = useCallback(async () => {
    try {
      const [dashboard, templateData] = await Promise.all([
        brunaFlowApi.dashboard(),
        brunaFlowApi.templates(),
      ]);
      setAutomations(dashboard.automations || []);
      setRuns(dashboard.runs || []);
      setEmails(dashboard.emails || []);
      if (dashboard.metrics) setMetrics(dashboard.metrics);

      const loadedTemplates = templateData.templates || [];
      setTemplates(loadedTemplates);
      setForm((current) =>
        current.templateId || !loadedTemplates.length
          ? current
          : { ...current, templateId: String(loadedTemplates[0].id) },
      );
    } catch {}
  }, []);
  const loadGmail = useCallback(async (showFeedback = false) => {
    setSyncing(true);
    try {
      const data = await brunaFlowApi.gmailStatus();
      setGmail(data);
      if (showFeedback)
        setNotice(
          data.connected
            ? "Gmail sincronizado com sucesso"
            : data.error || "Nenhum Gmail conectado",
        );
    } catch {
      if (showFeedback) setNotice("Não foi possível sincronizar o Gmail");
    } finally {
      setSyncing(false);
      if (showFeedback) setTimeout(() => setNotice(""), 4000);
    }
  }, []);
  const loadWebhook = useCallback(async () => {
    try {
      setWebhook(await brunaFlowApi.webhookStatus());
    } catch {}
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
      void loadGmail();
      void loadWebhook();
      const result = new URLSearchParams(window.location.search).get("gmail");
      if (result) {
        setNotice(
          result === "connected"
            ? "Gmail conectado com sucesso"
            : "Não foi possível conectar o Gmail",
        );
        window.history.replaceState({}, "", window.location.pathname);
        setTimeout(() => setNotice(""), 4000);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData, loadGmail, loadWebhook]);
  useEffect(() => {
    if (!templateDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [templateDirty]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool?: (
            tool: WebMcpTool,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool || !templates.length) return;
    const lifecycle = new AbortController();
    const register = context.registerTool.bind(context);
    void Promise.resolve(
      register(
        {
          name: "create_automation",
          title: "Criar automação",
          description:
            "Cria uma automação que reage a um evento e envia um modelo de e-mail pelo Gmail.",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              triggerType: {
                type: "string",
                enum: [
                  "user.created",
                  "form.submitted",
                  "lead.created",
                  "appointment.requested",
                ],
              },
              templateId: { type: "number" },
            },
            required: ["name", "triggerType", "templateId"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: async (input: unknown) => {
            const payload = input as typeof form;
            const data = await brunaFlowApi.createAutomation({
              ...payload,
              actionType: "Enviar e-mail pelo Gmail",
            });
            await loadData();
            return { id: data.automation.id, status: "created" };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [loadData, templates]);

  const hoursSaved = useMemo(
    () => Math.round((metrics.timeSavedMinutes / 60) * 10) / 10,
    [metrics.timeSavedMinutes],
  );
  const searchResults = useMemo(() => {
    return buildSearchResults(searchQuery, {
      automations,
      templates,
      emails,
      runs,
    });
  }, [searchQuery, automations, templates, emails, runs]);
  async function createAutomation(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.templateId) return;
    setLoading(true);
    try {
      const data = await brunaFlowApi.createAutomation(form);
      setAutomations((current) => [data.automation, ...current]);
      setDialog(false);
      setForm({
        name: "",
        description: "",
        triggerType: "user.created",
        actionType: "Enviar e-mail pelo Gmail",
        templateId: templates[0] ? String(templates[0].id) : "",
      });
      setNotice("Automação criada com sucesso");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar. Tente novamente.",
      );
    } finally {
      setLoading(false);
      setTimeout(() => setNotice(""), 3000);
    }
  }
  function newTemplate() {
    const initial = { name: "", subject: "", body: "", aiGenerated: false };
    activeTemplateField.current = "body";
    setTemplateBaseline(JSON.stringify(initial));
    setEditingTemplate(null);
    setTemplateForm(initial);
    setTemplateExample({ name: "Maria", email: gmail.email || "" });
    setTemplateDialog(true);
  }
  function editTemplate(template: EmailTemplate) {
    const initial = {
      name: template.name,
      subject: template.subject,
      body: template.body,
      aiGenerated: template.aiGenerated,
    };
    activeTemplateField.current = "body";
    setTemplateBaseline(JSON.stringify(initial));
    setEditingTemplate(template.id);
    setTemplateForm(initial);
    setTemplateExample({ name: "Maria", email: gmail.email || "" });
    setTemplateDialog(true);
  }
  function closeTemplateEditor() {
    if (
      templateDirty &&
      !window.confirm("Descartar as alterações não salvas deste modelo?")
    )
      return;
    setTemplateDialog(false);
  }
  async function generateTemplate() {
    setLoading(true);
    try {
      const data = await brunaFlowApi.generateTemplate(templateForm);
      setTemplateForm((current) => ({
        ...current,
        subject: data.subject,
        body: data.body,
        aiGenerated: true,
      }));
      notify(
        `Assunto e mensagem gerados com ${providerLabel(data.provider)}. Revise antes de salvar.`,
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o texto.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function saveTemplate(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await brunaFlowApi.saveTemplate(templateForm, editingTemplate);
      setTemplateBaseline(JSON.stringify(templateForm));
      setTemplateDialog(false);
      await loadData();
      notify(editingTemplate ? "Modelo atualizado" : "Modelo criado");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o modelo.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function sendTemplateTest() {
    if (!gmail.connected) {
      notify("Conecte seu Gmail antes de enviar um teste.");
      return;
    }
    setTestSending(true);
    try {
      const data = await brunaFlowApi.sendTemplateTest(
        templateForm,
        editingTemplate,
        templateExample,
      );
      await loadData();
      notify(`Teste enviado por ${data.sender}. Confira a caixa de entrada.`);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o teste.",
      );
    } finally {
      setTestSending(false);
    }
  }
  function insertTemplateVariable(variable: string) {
    const field = activeTemplateField.current;
    const element = field === "subject" ? subjectRef.current : bodyRef.current;
    const current = templateForm[field];
    const start = element?.selectionStart ?? current.length;
    const end = element?.selectionEnd ?? start;
    const next = `${current.slice(0, start)}${variable}${current.slice(end)}`;
    setTemplateForm((previous) => ({ ...previous, [field]: next }));
    requestAnimationFrame(() => {
      const target = field === "subject" ? subjectRef.current : bodyRef.current;
      const cursor = start + variable.length;
      target?.focus();
      target?.setSelectionRange(cursor, cursor);
    });
  }
  async function deleteTemplate(template: EmailTemplate) {
    if (
      !window.confirm(
        `Excluir o modelo “${template.name}”? As automações vinculadas serão pausadas.`,
      )
    )
      return;
    setLoading(true);
    try {
      await brunaFlowApi.deleteTemplate(template.id);
      await loadData();
      notify("Modelo excluído; automações vinculadas foram pausadas.");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o modelo.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function runFlow(event: React.FormEvent) {
    event.preventDefault();
    if (!testAutomation) return;
    setLoading(true);
    setNotice("Executando o fluxo…");
    try {
      const data = await brunaFlowApi.executeAutomation(testAutomation, lead);
      setTestAutomation(null);
      await Promise.all([loadData(), loadGmail()]);
      const source =
        data.run.provider === "groq"
          ? "Groq"
          : data.run.provider === "gemini"
            ? "Gemini"
            : "modo demonstração";
      setNotice(
        `Fluxo concluído com ${source}. E-mail enviado por ${data.email.sender}.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "A execução falhou. Tente novamente.",
      );
    } finally {
      setLoading(false);
      setTimeout(() => setNotice(""), 5000);
    }
  }
  function notify(message: string, duration = 4000) {
    setNotice(message);
    setTimeout(() => setNotice(""), duration);
  }
  function openTest(automation?: Automation) {
    if (!gmail.connected) {
      go("integrations");
      notify("Conecte seu Gmail para usar sua conta como remetente.");
      return;
    }
    const selected = automation || automations[0] || STARTER_AUTOMATIONS[0];
    setTestAutomation(selected);
    setLead({
      contactName: "",
      contactEmail: gmail.email || "",
      message: "Quero automatizar os contatos que chegam pelo meu site.",
    });
  }
  async function disconnectGmail() {
    setSyncing(true);
    try {
      await brunaFlowApi.disconnectGmail();
      setGmail({ connected: false });
      notify(
        "Gmail desconectado. Sua chave de webhook continua salva, mas os envios ficam pausados até uma nova conexão.",
        6000,
      );
    } catch {
      notify("Não foi possível desconectar o Gmail.");
    } finally {
      setSyncing(false);
    }
  }
  async function generateWebhook() {
    setLoading(true);
    try {
      const data = await brunaFlowApi.createWebhook();
      setWebhook(data);
      notify(
        "Chave criada. Copie agora: ela será mostrada somente nesta sessão.",
        6000,
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar a chave.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function revokeWebhook() {
    if (
      !window.confirm(
        "Revogar esta chave? As integrações que usam ela deixarão de funcionar.",
      )
    )
      return;
    setLoading(true);
    try {
      await brunaFlowApi.revokeWebhook();
      setWebhook({ configured: false });
      notify("Chave de webhook revogada");
    } catch {
      notify("Não foi possível revogar a chave.");
    } finally {
      setLoading(false);
    }
  }
  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      notify(`${label} copiado`);
    } catch {
      notify("Não foi possível copiar automaticamente");
    }
  }
  async function clearHistory() {
    if (
      !window.confirm("Apagar o histórico de execuções e de e-mails enviados?")
    )
      return;
    setLoading(true);
    try {
      await brunaFlowApi.deleteWorkspaceData("history");
      await loadData();
      notify("Históricos apagados");
    } catch {
      notify("Não foi possível apagar os históricos");
    } finally {
      setLoading(false);
    }
  }
  async function deleteWorkspace() {
    if (
      !window.confirm(
        "Excluir Gmail, chave de webhook, modelos, automações, execuções e e-mails enviados deste navegador?",
      )
    )
      return;
    setLoading(true);
    try {
      await brunaFlowApi.deleteWorkspaceData("workspace");
      window.location.reload();
    } catch {
      notify("Não foi possível excluir os dados");
      setLoading(false);
    }
  }
  const go = (next: typeof tab) => {
    setTab(next);
    setMobileNav(false);
  };

  return (
    <main className="app-shell">
      <Sidebar
        activeTab={tab}
        isOpen={mobileNav}
        automationCount={automations.length}
        emailCount={emails.length}
        onNavigate={go}
        onAbout={() => setAbout(true)}
      />
      <section className="content">
        <Topbar
          gmail={gmail}
          query={searchQuery}
          searchOpen={searchOpen}
          results={searchResults}
          onQueryChange={setSearchQuery}
          onSearchOpenChange={setSearchOpen}
          onToggleMenu={() => setMobileNav((current) => !current)}
          onNavigate={go}
        />
        <div className="page">
          <div className="page-heading">
            <div>
              <span className="eyebrow">{PAGE_META[tab].eyebrow}</span>
              <h1>{PAGE_META[tab].title}</h1>
              <p>{PAGE_META[tab].description}</p>
            </div>
            {(tab === "overview" || tab === "automations") && (
              <button className="primary" onClick={() => setDialog(true)}>
                <Plus size={18} />
                Nova automação
              </button>
            )}
          </div>
          {tab === "overview" && (
            <>
              <GmailConnection
                gmail={gmail}
                syncing={syncing}
                onSync={() => void loadGmail(true)}
                onDisconnect={() => void disconnectGmail()}
              />
              <div className="metrics">
                <Metric
                  icon={<Activity />}
                  label="Execuções registradas"
                  value={String(metrics.executions)}
                  hint={
                    metrics.executions
                      ? "Calculado pelo histórico real"
                      : "Execute um fluxo para começar"
                  }
                  tone="violet"
                />
                <Metric
                  icon={<CheckCircle2 />}
                  label="Taxa de sucesso"
                  value={`${metrics.successRate}%`}
                  hint={
                    metrics.executions
                      ? `${metrics.executions} ${metrics.executions === 1 ? "execução analisada" : "execuções analisadas"}`
                      : "Sem dados suficientes"
                  }
                  tone="cyan"
                />
                <Metric
                  icon={<Clock3 />}
                  label="Tempo economizado"
                  value={`${hoursSaved}h`}
                  hint={`${metrics.timeSavedMinutes} minutos registrados`}
                  tone="green"
                />
                <Metric
                  icon={<Inbox />}
                  label="Conta Gmail"
                  value={gmail.connected ? "Conectada" : "—"}
                  hint={
                    gmail.connected
                      ? gmail.email || "Pronta para enviar"
                      : "Conecte uma conta para enviar"
                  }
                  tone="pink"
                />
              </div>
              <section className="spotlight">
                <div className="spotlight-copy">
                  <span className="eyebrow light">FLUXO EM DESTAQUE</span>
                  <h2>Transforme cada novo contato em uma oportunidade.</h2>
                  <p>
                    O BrunaFlow recebe o formulário, interpreta a intenção com
                    IA e envia a resposta usando a conta Gmail conectada.
                  </p>
                  {gmail.connected ? (
                    <button
                      onClick={() => openTest(automations[0])}
                      disabled={loading}
                    >
                      <Play size={16} />
                      Testar envio real
                    </button>
                  ) : (
                    <a
                      className="spotlight-action"
                      href="/api/integrations/gmail/start"
                    >
                      <Mail size={16} />
                      Conectar Gmail
                    </a>
                  )}
                </div>
                <div className="flow-visual">
                  <FlowNode
                    icon={<Webhook />}
                    label="Formulário"
                    sub="Novo contato"
                  />
                  <FlowLine />
                  <FlowNode
                    icon={<Bot />}
                    label="IA classifica"
                    sub="Intenção e prioridade"
                    active
                  />
                  <FlowLine />
                  <FlowNode
                    icon={<Target />}
                    label="Histórico"
                    sub="Execução registrada"
                  />
                  <FlowLine />
                  <FlowNode
                    icon={<Mail />}
                    label="Gmail"
                    sub={
                      gmail.connected ? "Conta conectada" : "Aguardando conexão"
                    }
                  />
                </div>
              </section>
              <div className="grid-two">
                <AutomationList
                  automations={automations.slice(0, 3)}
                  onRun={openTest}
                  onAll={() => setTab("automations")}
                />
                <RunList runs={runs.slice(0, 4)} onAll={() => setTab("runs")} />
              </div>
            </>
          )}
          {tab === "automations" && (
            <div className="automation-grid">
              {automations.map((item) => (
                <article className="automation-card" key={item.id}>
                  <div className="card-top">
                    <span className="automation-icon">
                      <Zap size={20} />
                    </span>
                    <span className={`state ${item.status}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                  </div>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <div className="mini-flow">
                    <span>{triggerLabel(item.triggerType)}</span>
                    <ChevronRight size={14} />
                    <span>
                      {item.templateId
                        ? templates.find(
                            (template) => template.id === item.templateId,
                          )?.name || "Modelo de e-mail"
                        : item.actionType}
                    </span>
                  </div>
                  <div className="card-stats">
                    <span>
                      <strong>{item.runs}</strong> execuções reais
                    </span>
                    <span>
                      <strong>{item.successRate}%</strong> sucesso
                    </span>
                  </div>
                  <button className="outline" onClick={() => openTest(item)}>
                    <Play size={15} />
                    Testar fluxo
                  </button>
                </article>
              ))}
            </div>
          )}
          {tab === "runs" && (
            <section className="panel full">
              <div className="panel-head">
                <div>
                  <h2>Execuções recentes</h2>
                  <p>Somente os fluxos executados neste navegador</p>
                </div>
                <button
                  className="icon-button"
                  onClick={() => void loadData()}
                  title="Atualizar execuções"
                  aria-label="Atualizar execuções"
                >
                  <RefreshCw size={17} />
                </button>
              </div>
              <RunTable runs={runs} onInspect={setSelectedRun} />
            </section>
          )}
          {tab === "emails" && (
            <EmailCenter
              templates={templates}
              emails={emails}
              onNew={newTemplate}
              onEdit={editTemplate}
              onDelete={(template) => void deleteTemplate(template)}
            />
          )}
          {tab === "integrations" && (
            <IntegrationsView
              gmail={gmail}
              syncing={syncing}
              onSync={() => void loadGmail(true)}
              onDisconnect={() => void disconnectGmail()}
            />
          )}
          {tab === "webhooks" && (
            <WebhooksView
              webhook={webhook}
              gmail={gmail}
              loading={loading}
              onGenerate={() => void generateWebhook()}
              onRevoke={() => void revokeWebhook()}
              onCopy={(value, label) => void copyText(value, label)}
            />
          )}
          {tab === "settings" && (
            <SettingsView
              gmail={gmail}
              loading={loading}
              onClear={() => void clearHistory()}
              onDelete={() => void deleteWorkspace()}
              onDisconnect={() => void disconnectGmail()}
            />
          )}
        </div>
      </section>
      {dialog && (
        <div className="modal-backdrop" onMouseDown={() => setDialog(false)}>
          <div
            className="modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setDialog(false)}
              aria-label="Fechar criação de automação"
            >
              <X size={18} />
            </button>
            <span className="modal-icon">
              <Zap />
            </span>
            <h2>Criar nova automação</h2>
            <p>
              Escolha qual evento inicia o fluxo e qual mensagem será enviada.
            </p>
            <form onSubmit={createAutomation}>
              <label>
                Nome da automação
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="Ex.: Boas-vindas para novos usuários"
                  required
                />
              </label>
              <label>
                Descrição
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  placeholder="O que este fluxo resolve?"
                />
              </label>
              <label>
                Evento que inicia o fluxo
                <select
                  value={form.triggerType}
                  onChange={(event) =>
                    setForm({ ...form, triggerType: event.target.value })
                  }
                >
                  <option value="user.created">Novo usuário cadastrado</option>
                  <option value="form.submitted">
                    Novo formulário recebido
                  </option>
                  <option value="lead.created">Novo lead recebido</option>
                  <option value="appointment.requested">
                    Solicitação de agendamento
                  </option>
                </select>
              </label>
              <label>
                Modelo de e-mail
                <select
                  value={form.templateId}
                  onChange={(event) =>
                    setForm({ ...form, templateId: event.target.value })
                  }
                  required
                >
                  {templates.map((template) => (
                    <option value={template.id} key={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flow-summary">
                <Webhook size={17} />
                <span>
                  <b>{triggerLabel(form.triggerType)}</b>
                  <small>
                    O BrunaFlow substituirá as variáveis e enviará o modelo pelo
                    Gmail conectado.
                  </small>
                </span>
              </div>
              <button
                className="primary submit"
                disabled={loading || !templates.length}
              >
                {loading ? "Salvando…" : "Criar automação"}
                <ArrowRight size={17} />
              </button>
            </form>
          </div>
        </div>
      )}
      {templateDialog && (
        <div className="modal-backdrop" onMouseDown={closeTemplateEditor}>
          <div
            className="modal template-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={closeTemplateEditor}
              aria-label="Fechar editor de modelo"
            >
              <X size={18} />
            </button>
            <span className="modal-icon">
              <Mail />
            </span>
            <h2>
              {editingTemplate ? "Editar modelo" : "Novo modelo de e-mail"}
            </h2>
            <p>Edite, visualize e envie um teste antes de salvar.</p>
            <form onSubmit={saveTemplate}>
              <div className="template-editor-layout">
                <div className="template-editor-fields">
                  <label>
                    Nome do modelo
                    <input
                      value={templateForm.name}
                      onChange={(event) =>
                        setTemplateForm({
                          ...templateForm,
                          name: event.target.value,
                        })
                      }
                      placeholder="Ex.: Boas-vindas padrão"
                      required
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Assunto ou tema para a IA
                    <input
                      ref={subjectRef}
                      value={templateForm.subject}
                      onFocus={() => {
                        activeTemplateField.current = "subject";
                      }}
                      onChange={(event) =>
                        setTemplateForm({
                          ...templateForm,
                          subject: event.target.value,
                        })
                      }
                      placeholder="Ex.: boas-vindas para novo cliente"
                      required
                      maxLength={180}
                    />
                    <small className="field-help">
                      Escreva palavras-chave ou um assunto pronto. A IA
                      identifica o tema e aprimora o resultado.
                    </small>
                  </label>
                  <label>
                    Mensagem ou orientações
                    <textarea
                      ref={bodyRef}
                      className="email-body"
                      value={templateForm.body}
                      onFocus={() => {
                        activeTemplateField.current = "body";
                      }}
                      onChange={(event) =>
                        setTemplateForm({
                          ...templateForm,
                          body: event.target.value,
                        })
                      }
                      placeholder="Escreva o texto atual ou explique o que a mensagem deve comunicar…"
                      required
                      maxLength={5000}
                    />
                  </label>
                </div>
                <aside
                  className="email-preview"
                  aria-label="Pré-visualização do e-mail"
                >
                  <div className="preview-heading">
                    <span className="eyebrow">PRÉ-VISUALIZAÇÃO</span>
                    <small>Atualizada enquanto você escreve</small>
                  </div>
                  <div className="preview-example">
                    <label>
                      Nome de exemplo
                      <input
                        value={templateExample.name}
                        onChange={(event) =>
                          setTemplateExample({
                            ...templateExample,
                            name: event.target.value,
                          })
                        }
                        maxLength={100}
                      />
                    </label>
                    <label>
                      E-mail de teste
                      <input
                        type="email"
                        value={templateExample.email}
                        onChange={(event) =>
                          setTemplateExample({
                            ...templateExample,
                            email: event.target.value,
                          })
                        }
                        placeholder={
                          gmail.connected ? gmail.email : "Conecte o Gmail"
                        }
                      />
                    </label>
                  </div>
                  <div className="preview-message">
                    <div className="preview-brand">
                      <i>BF</i>
                      <span>
                        <b>BrunaFlow</b>
                        <small>AI automation</small>
                      </span>
                    </div>
                    <div className="preview-content">
                      <span>Assunto</span>
                      <strong>
                        {renderTemplatePreview(
                          templateForm.subject || "Seu assunto aparecerá aqui",
                          templateForm,
                          templateExample,
                        )}
                      </strong>
                      <p>
                        {renderTemplatePreview(
                          templateForm.body ||
                            "A mensagem aparecerá aqui conforme você escreve.",
                          templateForm,
                          templateExample,
                        )}
                      </p>
                    </div>
                    <footer>
                      Enviado automaticamente pelo <b>BrunaFlow AI</b>
                    </footer>
                  </div>
                  <button
                    type="button"
                    className="outline compact preview-send"
                    onClick={() => void sendTemplateTest()}
                    disabled={
                      testSending ||
                      !gmail.connected ||
                      !templateForm.subject.trim() ||
                      !templateForm.body.trim() ||
                      !templateExample.email.trim()
                    }
                  >
                    <Send size={15} />
                    {testSending
                      ? "Enviando…"
                      : gmail.connected
                        ? "Enviar teste"
                        : "Conecte o Gmail para testar"}
                  </button>
                </aside>
              </div>
              <div className="variable-help">
                <b>
                  Variáveis disponíveis{" "}
                  <small>— clique para inserir onde está o cursor</small>
                </b>
                <span>
                  {[
                    "{{nome}}",
                    "{{email}}",
                    "{{mensagem}}",
                    "{{classificacao}}",
                    "{{prioridade}}",
                    "{{nome_automacao}}",
                  ].map((value) => (
                    <button
                      type="button"
                      key={value}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertTemplateVariable(value)}
                      title={`Inserir ${value}`}
                    >
                      {value}
                    </button>
                  ))}
                </span>
              </div>
              <div className="template-form-actions">
                <button
                  type="button"
                  className="outline compact"
                  onClick={() => void generateTemplate()}
                  disabled={loading || testSending}
                >
                  <Sparkles size={15} />
                  {loading
                    ? "Gerando assunto e mensagem…"
                    : "Gerar assunto e mensagem com IA"}
                </button>
                <span
                  className={`unsaved-status ${templateDirty ? "dirty" : ""}`}
                >
                  {templateDirty ? "Alterações não salvas" : "Tudo salvo"}
                </span>
                <button className="primary" disabled={loading || testSending}>
                  {loading ? "Salvando…" : "Salvar modelo"}
                  <Check size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {testAutomation && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setTestAutomation(null)}
        >
          <div
            className="modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setTestAutomation(null)}
              aria-label="Fechar teste"
            >
              <X size={18} />
            </button>
            <span className="modal-icon">
              <Mail />
            </span>
            <h2>Testar automação real</h2>
            <p>
              A mensagem será enviada por <strong>{gmail.email}</strong>, a
              conta autorizada pelo Google.
            </p>
            <form onSubmit={runFlow}>
              <label>
                Nome do contato
                <input
                  value={lead.contactName}
                  onChange={(event) =>
                    setLead({ ...lead, contactName: event.target.value })
                  }
                  placeholder="Nome do destinatário"
                  required
                  maxLength={100}
                />
              </label>
              <label>
                E-mail destinatário
                <input
                  type="email"
                  value={lead.contactEmail}
                  onChange={(event) =>
                    setLead({ ...lead, contactEmail: event.target.value })
                  }
                  placeholder="destinatario@exemplo.com"
                  required
                />
              </label>
              <label>
                Mensagem para classificar
                <textarea
                  value={lead.message}
                  onChange={(event) =>
                    setLead({ ...lead, message: event.target.value })
                  }
                  required
                  maxLength={3000}
                />
              </label>
              <small>
                O BrunaFlow usa sua autorização apenas para consultar métricas
                da caixa e enviar este teste. Cada destinatário pode receber um
                teste a cada 10 minutos.
              </small>
              <button className="primary submit" disabled={loading}>
                {loading ? "Executando…" : "Classificar e enviar"}
                <ArrowRight size={17} />
              </button>
            </form>
          </div>
        </div>
      )}
      {selectedRun && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setSelectedRun(null)}
        >
          <div
            className="modal run-detail-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setSelectedRun(null)}
              aria-label="Fechar detalhes"
            >
              <X size={18} />
            </button>
            <span className="modal-icon">
              <Activity />
            </span>
            <h2>Detalhes da execução</h2>
            <p>
              {selectedRun.automationName} ·{" "}
              {relativeTime(selectedRun.createdAt)}
            </p>
            <div className="run-detail-grid">
              <div>
                <span>Contato</span>
                <b>{selectedRun.contactName}</b>
              </div>
              <div>
                <span>Classificação</span>
                <b>{selectedRun.classification}</b>
              </div>
              <div>
                <span>Prioridade</span>
                <b>{selectedRun.priority}</b>
              </div>
              <div>
                <span>Provedor</span>
                <b>{providerLabel(selectedRun.provider)}</b>
              </div>
              <div>
                <span>Status</span>
                <b>{STATUS_LABEL[selectedRun.status] || selectedRun.status}</b>
              </div>
              <div>
                <span>Duração</span>
                <b>{(selectedRun.durationMs / 1000).toFixed(1)}s</b>
              </div>
            </div>
            <div className="run-message">
              <span>Mensagem enviada</span>
              <p>{selectedRun.emailDraft || "Nenhuma mensagem registrada."}</p>
            </div>
          </div>
        </div>
      )}
      {about && (
        <div className="modal-backdrop" onMouseDown={() => setAbout(false)}>
          <div
            className="modal about"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setAbout(false)}
              aria-label="Fechar explicação"
            >
              <X size={18} />
            </button>
            <span className="eyebrow">SOBRE O PROJETO</span>
            <h2>Como o BrunaFlow AI funciona</h2>
            <p>
              Cada visitante conecta a própria conta Gmail por autorização
              OAuth. Senhas nunca passam pelo BrunaFlow.
            </p>
            <div className="about-steps">
              <div>
                <Mail />
                <span>
                  <b>1. Conecta</b>
                  <small>
                    O Google autoriza métricas da caixa e envio na conta
                    escolhida.
                  </small>
                </span>
              </div>
              <div>
                <Webhook />
                <span>
                  <b>2. Recebe</b>
                  <small>Formulário ou webhook inicia o fluxo.</small>
                </span>
              </div>
              <div>
                <Bot />
                <span>
                  <b>3. Entende</b>
                  <small>A IA classifica intenção e prioridade.</small>
                </span>
              </div>
              <div>
                <Database />
                <span>
                  <b>4. Registra</b>
                  <small>O resultado real atualiza métricas e histórico.</small>
                </span>
              </div>
            </div>
            <div className="tech-note">
              <Cloud />
              <span>
                <b>Arquitetura demonstrada</b>
                <small>
                  Next.js, TypeScript, Cloudflare Workers, D1, OAuth 2.0, Gmail
                  API, webhooks e IA com fallback.
                </small>
              </span>
            </div>
          </div>
        </div>
      )}
      {notice && (
        <div className="toast">
          <Check size={17} />
          {notice}
        </div>
      )}
    </main>
  );
}

function GmailConnection({
  gmail,
  syncing,
  onSync,
  onDisconnect,
}: {
  gmail: GmailStatus;
  syncing: boolean;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  return (
    <section className={`gmail-card ${gmail.connected ? "connected" : ""}`}>
      <span className="gmail-icon">
        <Mail />
      </span>
      <div>
        <span className="eyebrow">INTEGRAÇÃO DE E-MAIL</span>
        <h2>{gmail.connected ? gmail.email : "Conecte sua conta Gmail"}</h2>
        <p>
          {gmail.connected
            ? "Conta autorizada para enviar as mensagens das suas automações. O BrunaFlow não lê sua caixa de entrada."
            : "Autorize o BrunaFlow a enviar mensagens pela sua conta. Sua senha e sua caixa de entrada não são compartilhadas."}
        </p>
      </div>
      <div className="gmail-actions">
        {gmail.connected ? (
          <>
            <button
              className="outline compact"
              onClick={onSync}
              disabled={syncing}
            >
              <RefreshCw size={15} />
              {syncing ? "Verificando" : "Verificar conexão"}
            </button>
            <button
              className="icon-button"
              onClick={onDisconnect}
              title="Desconectar Gmail"
            >
              <LogOut size={16} />
            </button>
          </>
        ) : (
          <a className="primary" href="/api/integrations/gmail/start">
            <Mail size={16} />
            Conectar Gmail
          </a>
        )}
      </div>
    </section>
  );
}
function IntegrationsView({
  gmail,
  syncing,
  onSync,
  onDisconnect,
}: {
  gmail: GmailStatus;
  syncing: boolean;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="workspace-stack">
      <GmailConnection
        gmail={gmail}
        syncing={syncing}
        onSync={onSync}
        onDisconnect={onDisconnect}
      />
      <div className="integration-grid">
        <article className="workspace-card">
          <span className="workspace-icon violet">
            <Bot />
          </span>
          <div>
            <span className="eyebrow">INTELIGÊNCIA ARTIFICIAL</span>
            <h2>Groq com fallback Gemini</h2>
            <p>
              A IA classifica intenção e prioridade e prepara a resposta. Se o
              primeiro provedor falhar, o segundo assume automaticamente.
            </p>
          </div>
          <span className="state active">Ativa</span>
        </article>
        <article className="workspace-card">
          <span className="workspace-icon cyan">
            <Database />
          </span>
          <div>
            <span className="eyebrow">ARMAZENAMENTO</span>
            <h2>Cloudflare D1</h2>
            <p>
              Automações, execuções e chaves ficam isoladas pelo workspace deste
              navegador.
            </p>
          </div>
          <span className="state active">Conectado</span>
        </article>
      </div>
    </div>
  );
}
function WebhooksView({
  webhook,
  gmail,
  loading,
  onGenerate,
  onRevoke,
  onCopy,
}: {
  webhook: WebhookStatus;
  gmail: GmailStatus;
  loading: boolean;
  onGenerate: () => void;
  onRevoke: () => void;
  onCopy: (value: string, label: string) => void;
}) {
  const endpoint =
    webhook.endpoint ||
    `${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/leads`;
  const example = `{\n  "event": "user.created",\n  "name": "Maria",\n  "email": "maria@exemplo.com",\n  "message": "Novo cadastro realizado no plano gratuito"\n}`;
  return (
    <div className="workspace-stack">
      <section className="panel webhook-hero">
        <span className="workspace-icon violet">
          <Webhook />
        </span>
        <div>
          <span className="eyebrow">WEBHOOK DO WORKSPACE</span>
          <h2>
            {webhook.configured
              ? "Pronto para receber eventos"
              : "Gere uma chave para ativar"}
          </h2>
          <p>
            {webhook.configured
              ? "O campo event escolhe automaticamente a automação ativa correspondente."
              : "Conecte o Gmail e gere uma chave exclusiva para ligar outro aplicativo ao BrunaFlow."}
          </p>
        </div>
        <span className={`state ${webhook.configured ? "active" : "paused"}`}>
          {webhook.configured ? "Ativo" : "Inativo"}
        </span>
      </section>
      <section className="panel webhook-config">
        <div className="config-row">
          <div>
            <span>Endpoint</span>
            <code>{endpoint}</code>
          </div>
          <button
            className="icon-button"
            onClick={() => onCopy(endpoint, "Endpoint")}
            title="Copiar endpoint"
          >
            <Copy size={16} />
          </button>
        </div>
        <div className="config-row">
          <div>
            <span>Chave do workspace</span>
            <code>
              {webhook.key || webhook.keyPrefix || "Nenhuma chave criada"}
            </code>
            {webhook.configured && !webhook.key && (
              <small>
                Por segurança, o valor completo só aparece ao gerar uma nova
                chave.
              </small>
            )}
          </div>
          {webhook.key && (
            <button
              className="icon-button"
              onClick={() => onCopy(webhook.key || "", "Chave")}
              title="Copiar chave"
            >
              <Copy size={16} />
            </button>
          )}
        </div>
        <div className="webhook-actions">
          {webhook.configured ? (
            <>
              <button
                className="outline compact"
                onClick={onGenerate}
                disabled={loading || !gmail.connected}
              >
                <RefreshCw size={15} />
                Gerar nova chave
              </button>
              <button
                className="danger-button"
                onClick={onRevoke}
                disabled={loading}
              >
                <Trash2 size={15} />
                Revogar
              </button>
            </>
          ) : (
            <button
              className="primary"
              onClick={onGenerate}
              disabled={loading || !gmail.connected}
            >
              <KeyRound size={16} />
              {gmail.connected ? "Gerar chave" : "Conecte o Gmail primeiro"}
            </button>
          )}
        </div>
      </section>
      <section className="panel code-panel">
        <div className="panel-head">
          <div>
            <h2>Exemplo: novo usuário</h2>
            <p>Envie pelo backend do seu aplicativo</p>
          </div>
          <button className="text-link" onClick={() => onCopy(example, "JSON")}>
            Copiar JSON <Copy size={13} />
          </button>
        </div>
        <pre>{example}</pre>
        <div className="event-reference">
          <span>
            <code>user.created</code>Novo usuário
          </span>
          <span>
            <code>form.submitted</code>Novo formulário
          </span>
          <span>
            <code>lead.created</code>Novo lead
          </span>
          <span>
            <code>appointment.requested</code>Agendamento
          </span>
        </div>
        <div className="security-note">
          <ShieldCheck size={18} />
          <span>
            <b>Envie a chave no cabeçalho x-brunaflow-key</b>
            <small>
              Nunca coloque essa chave em JavaScript público ou dentro do
              navegador do seu cliente.
            </small>
          </span>
        </div>
      </section>
    </div>
  );
}
function EmailCenter({
  templates,
  emails,
  onNew,
  onEdit,
  onDelete,
}: {
  templates: EmailTemplate[];
  emails: SentEmail[];
  onNew: () => void;
  onEdit: (template: EmailTemplate) => void;
  onDelete: (template: EmailTemplate) => void;
}) {
  return (
    <div className="workspace-stack">
      <section className="panel full">
        <div className="panel-head">
          <div>
            <h2>Modelos de e-mail</h2>
            <p>
              Mensagens reutilizáveis com variáveis preenchidas em cada execução
            </p>
          </div>
          <button className="primary small no-margin" onClick={onNew}>
            <Plus size={16} />
            Novo modelo
          </button>
        </div>
        <div className="template-grid">
          {templates.map((template) => (
            <article className="template-card" key={template.id}>
              <div className="template-card-top">
                <span className="workspace-icon violet">
                  <FileText size={18} />
                </span>
                <div className="template-actions">
                  <button
                    className="icon-button"
                    onClick={() => onEdit(template)}
                    title="Editar modelo"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button danger-icon"
                    onClick={() => onDelete(template)}
                    title="Excluir modelo"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <span className="eyebrow">
                {template.aiGenerated
                  ? "RASCUNHO CRIADO COM IA"
                  : "MODELO PERSONALIZADO"}
              </span>
              <h3>{template.name}</h3>
              <b className="template-subject">{template.subject}</b>
              <p>{template.body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="panel full">
        <div className="panel-head">
          <div>
            <h2>E-mails enviados</h2>
            <p>Histórico real das mensagens enviadas pelo Gmail conectado</p>
          </div>
          <span className="state active">{emails.length} enviados</span>
        </div>
        {emails.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Destinatário</th>
                  <th>Assunto</th>
                  <th>Remetente</th>
                  <th>Status</th>
                  <th>Enviado</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((email) => (
                  <tr key={email.id}>
                    <td>
                      <strong>{email.recipientName || "Contato"}</strong>
                      <small>{email.recipientEmail}</small>
                    </td>
                    <td title={email.body}>{email.subject}</td>
                    <td>{email.senderEmail}</td>
                    <td>
                      <span className="state success">
                        <Check size={12} />
                        Enviado
                      </span>
                    </td>
                    <td>{relativeTime(email.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Send size={22} />
            <b>Nenhum e-mail enviado ainda</b>
            <small>Teste uma automação ou envie um evento pelo webhook.</small>
          </div>
        )}
      </section>
    </div>
  );
}
function SettingsView({
  gmail,
  loading,
  onClear,
  onDelete,
  onDisconnect,
}: {
  gmail: GmailStatus;
  loading: boolean;
  onClear: () => void;
  onDelete: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="settings-grid">
      <section className="panel setting-card">
        <span className="workspace-icon cyan">
          <ShieldCheck />
        </span>
        <div>
          <h2>Privacidade e isolamento</h2>
          <p>
            Este workspace é identificado por um cookie seguro. Outros
            visitantes não visualizam suas conexões, chaves ou execuções.
          </p>
          <a className="text-link settings-link" href="/privacidade">
            Ver política de privacidade <ArrowRight size={14} />
          </a>
        </div>
      </section>
      <section className="panel setting-card">
        <span className="workspace-icon violet">
          <Link2 />
        </span>
        <div>
          <h2>Conta conectada</h2>
          <p>
            {gmail.connected
              ? `O Gmail ${gmail.email} está autorizado para métricas e envios.`
              : "Nenhuma conta Gmail está conectada."}
          </p>
          {gmail.connected ? (
            <button
              className="outline compact left"
              onClick={onDisconnect}
              disabled={loading}
            >
              <LogOut size={15} />
              Desconectar Gmail
            </button>
          ) : (
            <a className="primary small" href="/api/integrations/gmail/start">
              <Mail size={15} />
              Conectar Gmail
            </a>
          )}
        </div>
      </section>
      <section className="panel setting-card danger-zone">
        <span className="workspace-icon danger">
          <Trash2 />
        </span>
        <div>
          <h2>Dados deste workspace</h2>
          <p>
            Limpe execuções e e-mails enviados ou remova completamente Gmail,
            webhook, modelos, automações e históricos deste navegador.
          </p>
          <div className="setting-actions">
            <button
              className="outline compact left"
              onClick={onClear}
              disabled={loading}
            >
              Limpar históricos
            </button>
            <button
              className="danger-button"
              onClick={onDelete}
              disabled={loading}
            >
              Excluir workspace
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
function Metric({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <article className="metric">
      <span className={`metric-icon ${tone}`}>{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  );
}
function FlowNode({
  icon,
  label,
  sub,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  active?: boolean;
}) {
  return (
    <div className={`flow-node ${active ? "active" : ""}`}>
      <span>{icon}</span>
      <b>{label}</b>
      <small>{sub}</small>
    </div>
  );
}
function FlowLine() {
  return (
    <span className="flow-line">
      <i />
    </span>
  );
}
function AutomationList({
  automations,
  onRun,
  onAll,
}: {
  automations: Automation[];
  onRun: (automation: Automation) => void;
  onAll: () => void;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Automações</h2>
          <p>Contadores baseados em execuções reais</p>
        </div>
        <button className="text-link" onClick={onAll}>
          Ver todas <ArrowRight size={14} />
        </button>
      </div>
      <div className="list">
        {automations.map((item) => (
          <div className="automation-row" key={item.id}>
            <span className="automation-icon">
              <Zap size={17} />
            </span>
            <div>
              <b>{item.name}</b>
              <small>
                {item.runs}{" "}
                {item.runs === 1
                  ? "execução registrada"
                  : "execuções registradas"}
              </small>
            </div>
            <span className={`state ${item.status}`}>
              {STATUS_LABEL[item.status]}
            </span>
            <button
              className="icon-button"
              onClick={() => onRun(item)}
              title="Executar"
            >
              <Play size={15} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
function RunList({ runs, onAll }: { runs: Run[]; onAll: () => void }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Atividade recente</h2>
          <p>Últimas execuções reais</p>
        </div>
        <button className="text-link" onClick={onAll}>
          Ver histórico <ArrowRight size={14} />
        </button>
      </div>
      {runs.length ? (
        <div className="list">
          {runs.map((run) => (
            <div className="run-row" key={run.id}>
              <span className={`run-dot ${run.status}`}>
                <Check size={13} />
              </span>
              <div>
                <b>{run.contactName}</b>
                <small>{run.automationName}</small>
              </div>
              <div className="run-meta">
                <b>{run.classification}</b>
                <small>
                  {providerLabel(run.provider)} · {relativeTime(run.createdAt)}
                </small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </section>
  );
}
function RunTable({
  runs,
  onInspect,
}: {
  runs: Run[];
  onInspect: (run: Run) => void;
}) {
  if (!runs.length) return <EmptyState />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Contato</th>
            <th>Automação</th>
            <th>Classificação</th>
            <th>IA</th>
            <th>Status</th>
            <th>Duração</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <td>
                <strong>{run.contactName}</strong>
                <small>Prioridade {run.priority.toLowerCase()}</small>
              </td>
              <td>{run.automationName}</td>
              <td>
                <span className="tag">{run.classification}</span>
              </td>
              <td>{providerLabel(run.provider)}</td>
              <td>
                <span className={`state ${run.status}`}>
                  {STATUS_LABEL[run.status] || run.status}
                </span>
              </td>
              <td>{(run.durationMs / 1000).toFixed(1)}s</td>
              <td>
                <button
                  className="icon-button"
                  onClick={() => onInspect(run)}
                  title="Ver detalhes"
                  aria-label={`Ver detalhes de ${run.contactName}`}
                >
                  <MoreHorizontal size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function EmptyState() {
  return (
    <div className="empty-state">
      <Activity size={20} />
      <b>Nenhuma execução ainda</b>
      <small>Conecte o Gmail e teste um fluxo para gerar dados reais.</small>
    </div>
  );
}
