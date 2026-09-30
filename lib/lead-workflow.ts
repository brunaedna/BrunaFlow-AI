import { and, desc, eq, gte, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  automations,
  deliveryAttempts,
  emailTemplates,
  gmailConnections,
} from "../db/schema";
import {
  isValidEmail,
  renderTemplate,
  sha256Hex,
  type TemplateVariables,
} from "./automation-utils";
import { classifyLead } from "./lead-ai";
import { sendTestEmail } from "./gmail";
import { decryptToken } from "./google-oauth";
import { ExecutionTracker } from "./workflows/execution-tracker";

type Input = {
  automationId?: number;
  automationName?: string;
  eventType?: string;
  contactName: string;
  contactEmail: string;
  message: string;
  ipAddress?: string;
  ownerHash?: string;
  requestId?: string;
};

export async function executeLeadWorkflow(input: Input) {
  const db = getDb();
  const email = input.contactEmail.trim().toLowerCase();
  if (!isValidEmail(email))
    throw new Error("Informe um e-mail destinatário válido.");

  const emailHash = await sha256Hex(email);
  const ipHash = await sha256Hex(input.ipAddress || "unknown");
  const [recentEmail] = await db
    .select({ count: sql<number>`count(*)` })
    .from(deliveryAttempts)
    .where(
      and(
        eq(deliveryAttempts.emailHash, emailHash),
        gte(deliveryAttempts.createdAt, sql`datetime('now','-10 minutes')`),
      ),
    );
  if (Number(recentEmail?.count || 0) > 0) {
    throw new Error(
      "Este e-mail já recebeu um teste recentemente. Aguarde 10 minutos.",
    );
  }

  const [recentIp] = await db
    .select({ count: sql<number>`count(*)` })
    .from(deliveryAttempts)
    .where(
      and(
        eq(deliveryAttempts.ipHash, ipHash),
        gte(deliveryAttempts.createdAt, sql`datetime('now','-1 hour')`),
      ),
    );
  if (Number(recentIp?.count || 0) >= 5) {
    throw new Error(
      "Limite de testes atingido nesta conexão. Tente novamente mais tarde.",
    );
  }

  const allowedOwner = input.ownerHash
    ? or(
        eq(automations.ownerHash, input.ownerHash),
        eq(automations.ownerHash, "template"),
      )
    : eq(automations.ownerHash, "template");
  const ownerOnly = eq(automations.ownerHash, input.ownerHash || "template");
  let selected;

  if (input.automationId) {
    [selected] = await db
      .select()
      .from(automations)
      .where(and(eq(automations.id, input.automationId), allowedOwner))
      .limit(1);
  } else if (input.automationName) {
    [selected] = await db
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.name, input.automationName),
          ownerOnly,
          eq(automations.status, "active"),
        ),
      )
      .orderBy(desc(automations.id))
      .limit(1);
    if (!selected) {
      [selected] = await db
        .select()
        .from(automations)
        .where(
          and(
            eq(automations.name, input.automationName),
            eq(automations.ownerHash, "template"),
            eq(automations.status, "active"),
          ),
        )
        .orderBy(desc(automations.id))
        .limit(1);
    }
  } else if (input.eventType) {
    [selected] = await db
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.triggerType, input.eventType),
          ownerOnly,
          eq(automations.status, "active"),
        ),
      )
      .orderBy(desc(automations.id))
      .limit(1);
    if (!selected) {
      [selected] = await db
        .select()
        .from(automations)
        .where(
          and(
            eq(automations.triggerType, input.eventType),
            eq(automations.ownerHash, "template"),
            eq(automations.status, "active"),
          ),
        )
        .orderBy(desc(automations.id))
        .limit(1);
    }
  }

  if (!selected && !input.eventType && !input.automationName) {
    [selected] = await db
      .select()
      .from(automations)
      .where(allowedOwner)
      .orderBy(desc(automations.id))
      .limit(1);
  }
  if (!selected)
    throw new Error("Nenhuma automação ativa corresponde a este evento.");

  const automationId = selected.id;
  const automationName = selected.name;
  const started = Date.now();
  const ownerHash = input.ownerHash || "webhook";
  const requestId = input.requestId || crypto.randomUUID();
  const tracker = new ExecutionTracker(db);
  const pendingRun = await tracker.start({
    ownerHash,
    automationId,
    automationName,
    contactName: input.contactName,
    eventType: input.eventType || "manual",
    requestId,
  });

  try {
    let identity: undefined | { refreshToken: string; email: string };
    if (input.ownerHash) {
      const [connection] = await db
        .select()
        .from(gmailConnections)
        .where(eq(gmailConnections.sessionHash, input.ownerHash))
        .limit(1);
      if (!connection)
        throw new Error("Conecte seu Gmail antes de executar o fluxo.");
      identity = {
        refreshToken: await decryptToken(connection.encryptedRefreshToken),
        email: connection.email,
      };
    }

    const result = await classifyLead({
      name: input.contactName,
      message: input.message,
      automationName,
    });
    let template: typeof emailTemplates.$inferSelect | undefined;
    if (selected.templateId && input.ownerHash) {
      [template] = await db
        .select()
        .from(emailTemplates)
        .where(
          and(
            eq(emailTemplates.id, selected.templateId),
            eq(emailTemplates.ownerHash, input.ownerHash),
          ),
        )
        .limit(1);
    }

    const variables: TemplateVariables = {
      nome: input.contactName,
      email,
      mensagem: input.message,
      classificacao: result.classification,
      prioridade: result.priority,
      nome_automacao: automationName,
    };
    const subject = renderTemplate(
      template?.subject || `BrunaFlow AI: ${result.classification}`,
      variables,
    );
    const body = renderTemplate(
      template?.body ||
        result.emailDraft ||
        "Olá, {{nome}}! Obrigada pelo contato.",
      variables,
    );
    await tracker.classified(pendingRun.id, {
      classification: result.classification,
      priority: result.priority,
      provider: result.provider,
      model: result.model,
      emailDraft: body,
    });

    const emailResult = await sendTestEmail(email, subject, body, identity);
    if (!emailResult.sent)
      throw new Error("Conecte um Gmail para enviar a mensagem.");

    const run = await tracker.complete({
      executionId: pendingRun.id,
      startedAt: started,
      emailHash,
      ipHash,
      ownerHash,
      automationId,
      templateId: template?.id,
      recipientEmail: email,
      recipientName: input.contactName,
      subject,
      body,
      senderEmail: emailResult.sender || identity?.email || "",
    });

    return {
      run,
      analysis: { summary: result.summary, model: result.model },
      email: { ...emailResult, subject },
    };
  } catch (error) {
    await tracker.fail(pendingRun.id, started, error);
    throw error;
  }
}
