import { desc, eq, and, gte, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  automations,
  deliveryAttempts,
  emailTemplates,
  gmailConnections,
  sentEmails,
} from "../../../db/schema";
import { sendTestEmail } from "../../../lib/gmail";
import { decryptToken } from "../../../lib/google-oauth";
import { generateEmailTemplate } from "../../../lib/lead-ai";
import {
  getVisitorSession,
  hashSession,
  visitorCookie,
} from "../../../lib/session";
import {
  cleanText,
  isValidEmail,
  renderTemplate,
  sha256Hex,
  type TemplateVariables,
} from "../../../lib/automation-utils";

const defaultTemplate = {
  name: "Boas-vindas padrão",
  subject: "Bem-vindo(a), {{nome}}!",
  body: "Olá, {{nome}}!\n\nSeu cadastro foi realizado com sucesso. É um prazer ter você com a gente.\n\nSe precisar de ajuda, basta responder a este e-mail.\n\nAtenciosamente,\nEquipe BrunaFlow",
};

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro inesperado";
  return message.includes("no such table")
    ? "Banco ainda não preparado. Aplique a nova migração do projeto."
    : message;
}

export async function GET(request: Request) {
  const session = getVisitorSession(request);
  const headers = new Headers();
  if (session.isNew)
    headers.append("Set-Cookie", visitorCookie(session.id, request));
  try {
    const ownerHash = await hashSession(session.id);
    const db = getDb();
    let rows = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.ownerHash, ownerHash))
      .orderBy(desc(emailTemplates.updatedAt), desc(emailTemplates.id));
    if (!rows.length) {
      rows = await db
        .insert(emailTemplates)
        .values({ ownerHash, ...defaultTemplate })
        .returning();
    }
    return Response.json({ templates: rows }, { headers });
  } catch (error) {
    return Response.json(
      { error: errorMessage(error) },
      { status: 500, headers },
    );
  }
}

export async function POST(request: Request) {
  const session = getVisitorSession(request);
  const headers = new Headers();
  if (session.isNew)
    headers.append("Set-Cookie", visitorCookie(session.id, request));
  try {
    const ownerHash = await hashSession(session.id);
    const payload = (await request.json()) as Record<string, unknown>;
    const db = getDb();
    if (payload.kind === "test") {
      const email = cleanText(payload.email, 320).toLowerCase();
      const contactName = cleanText(payload.contactName, 100) || "Maria";
      const subject = cleanText(payload.subject, 180);
      const body = cleanText(payload.body, 5000);
      const automationName = cleanText(payload.name, 120) || "Modelo de teste";
      if (!isValidEmail(email))
        return Response.json(
          { error: "Informe um e-mail destinatário válido." },
          { status: 400, headers },
        );
      if (!subject || !body)
        return Response.json(
          { error: "Preencha assunto e mensagem antes de testar." },
          { status: 400, headers },
        );
      const [connection] = await db
        .select()
        .from(gmailConnections)
        .where(eq(gmailConnections.sessionHash, ownerHash))
        .limit(1);
      if (!connection)
        return Response.json(
          { error: "Conecte seu Gmail antes de enviar um teste." },
          { status: 400, headers },
        );
      const emailHash = await sha256Hex(email);
      const ipHash = await sha256Hex(
        request.headers.get("CF-Connecting-IP") || "unknown",
      );
      const [recentEmail] = await db
        .select({ count: sql<number>`count(*)` })
        .from(deliveryAttempts)
        .where(
          and(
            eq(deliveryAttempts.emailHash, emailHash),
            gte(deliveryAttempts.createdAt, sql`datetime('now','-10 minutes')`),
          ),
        );
      if (Number(recentEmail?.count || 0) > 0)
        return Response.json(
          {
            error:
              "Este e-mail já recebeu um teste recentemente. Aguarde 10 minutos.",
          },
          { status: 429, headers },
        );
      const [recentIp] = await db
        .select({ count: sql<number>`count(*)` })
        .from(deliveryAttempts)
        .where(
          and(
            eq(deliveryAttempts.ipHash, ipHash),
            gte(deliveryAttempts.createdAt, sql`datetime('now','-1 hour')`),
          ),
        );
      if (Number(recentIp?.count || 0) >= 5)
        return Response.json(
          {
            error:
              "Limite de testes atingido nesta conexão. Tente novamente mais tarde.",
          },
          { status: 429, headers },
        );
      const variables: TemplateVariables = {
        nome: contactName,
        email,
        mensagem: "Este é um envio de teste do editor de modelos.",
        classificacao: "Novo contato",
        prioridade: "Normal",
        nome_automacao: automationName,
      };
      const renderedSubject = renderTemplate(subject, variables);
      const renderedBody = renderTemplate(body, variables);
      const result = await sendTestEmail(email, renderedSubject, renderedBody, {
        refreshToken: await decryptToken(connection.encryptedRefreshToken),
        email: connection.email,
      });
      if (!result.sent)
        return Response.json(
          { error: "Não foi possível enviar pela conta conectada." },
          { status: 400, headers },
        );
      let templateId: null | number = null;
      const requestedTemplate = Number(payload.id);
      if (requestedTemplate) {
        const [owned] = await db
          .select({ id: emailTemplates.id })
          .from(emailTemplates)
          .where(
            and(
              eq(emailTemplates.id, requestedTemplate),
              eq(emailTemplates.ownerHash, ownerHash),
            ),
          )
          .limit(1);
        templateId = owned?.id || null;
      }
      await db.batch([
        db.insert(deliveryAttempts).values({ emailHash, ipHash }),
        db.insert(sentEmails).values({
          ownerHash,
          templateId,
          recipientEmail: email,
          recipientName: contactName,
          subject: renderedSubject,
          body: renderedBody,
          status: "sent",
          senderEmail: result.sender || connection.email,
        }),
      ]);
      return Response.json(
        {
          sent: true,
          sender: result.sender || connection.email,
          subject: renderedSubject,
        },
        { headers },
      );
    }
    if (payload.kind === "generate") {
      const name = cleanText(payload.name, 120) || "Modelo de e-mail";
      const generated = await generateEmailTemplate({
        name,
        subjectHint: cleanText(payload.subjectHint, 180),
        instructions: cleanText(payload.instructions, 1000),
      });
      return Response.json(generated, { headers });
    }
    const name = cleanText(payload.name, 120);
    const subject = cleanText(payload.subject, 180);
    const body = cleanText(payload.body, 5000);
    if (!name || !subject || !body)
      return Response.json(
        { error: "Preencha nome, assunto e mensagem." },
        { status: 400, headers },
      );
    const [template] = await db
      .insert(emailTemplates)
      .values({
        ownerHash,
        name,
        subject,
        body,
        aiGenerated: Boolean(payload.aiGenerated),
      })
      .returning();
    return Response.json({ template }, { status: 201, headers });
  } catch (error) {
    return Response.json(
      { error: errorMessage(error) },
      { status: 400, headers },
    );
  }
}

export async function PATCH(request: Request) {
  const session = getVisitorSession(request);
  const headers = new Headers();
  if (session.isNew)
    headers.append("Set-Cookie", visitorCookie(session.id, request));
  try {
    const ownerHash = await hashSession(session.id);
    const payload = (await request.json()) as Record<string, unknown>;
    const id = Number(payload.id);
    const name = cleanText(payload.name, 120);
    const subject = cleanText(payload.subject, 180);
    const body = cleanText(payload.body, 5000);
    if (!id || !name || !subject || !body)
      return Response.json(
        { error: "Dados inválidos." },
        { status: 400, headers },
      );
    const [template] = await getDb()
      .update(emailTemplates)
      .set({
        name,
        subject,
        body,
        aiGenerated: Boolean(payload.aiGenerated),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(eq(emailTemplates.id, id), eq(emailTemplates.ownerHash, ownerHash)),
      )
      .returning();
    if (!template)
      return Response.json(
        { error: "Modelo não encontrado." },
        { status: 404, headers },
      );
    return Response.json({ template }, { headers });
  } catch (error) {
    return Response.json(
      { error: errorMessage(error) },
      { status: 400, headers },
    );
  }
}

export async function DELETE(request: Request) {
  const session = getVisitorSession(request);
  const headers = new Headers();
  if (session.isNew)
    headers.append("Set-Cookie", visitorCookie(session.id, request));
  try {
    const ownerHash = await hashSession(session.id);
    const payload = (await request.json()) as { id?: number };
    const id = Number(payload.id);
    if (!id)
      return Response.json(
        { error: "Modelo inválido." },
        { status: 400, headers },
      );
    const db = getDb();
    const [owned] = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(
        and(eq(emailTemplates.id, id), eq(emailTemplates.ownerHash, ownerHash)),
      )
      .limit(1);
    if (!owned)
      return Response.json(
        { error: "Modelo não encontrado." },
        { status: 404, headers },
      );
    const [summary] = await db
      .select({ total: sql<number>`count(*)` })
      .from(emailTemplates)
      .where(eq(emailTemplates.ownerHash, ownerHash));
    if (Number(summary?.total || 0) <= 1)
      return Response.json(
        { error: "Mantenha pelo menos um modelo de e-mail no workspace." },
        { status: 409, headers },
      );
    await db.batch([
      db
        .update(automations)
        .set({ templateId: null, status: "paused" })
        .where(
          and(
            eq(automations.ownerHash, ownerHash),
            eq(automations.templateId, id),
          ),
        ),
      db.delete(emailTemplates).where(eq(emailTemplates.id, id)),
    ]);
    return Response.json({ deleted: true }, { headers });
  } catch (error) {
    return Response.json(
      { error: errorMessage(error) },
      { status: 400, headers },
    );
  }
}
