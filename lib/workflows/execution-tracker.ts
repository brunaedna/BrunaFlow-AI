import { eq } from "drizzle-orm";
import type { getDb } from "../../db";
import { deliveryAttempts, executions, sentEmails } from "../../db/schema";
import { cleanText } from "../automation-utils";

type Database = ReturnType<typeof getDb>;

type StartExecutionInput = {
  ownerHash: string;
  automationId: number;
  automationName: string;
  contactName: string;
  eventType: string;
  requestId: string;
};

type ClassificationInput = {
  classification: string;
  priority: string;
  provider: string;
  model: string;
  emailDraft: string;
};

type CompleteExecutionInput = {
  executionId: number;
  startedAt: number;
  emailHash: string;
  ipHash: string;
  ownerHash: string;
  automationId: number;
  templateId?: number;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  senderEmail: string;
};

export class ExecutionTracker {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async start(input: StartExecutionInput) {
    const [execution] = await this.db
      .insert(executions)
      .values({
        ownerHash: input.ownerHash,
        automationId: input.automationId,
        automationName: input.automationName,
        contactName: cleanText(input.contactName, 100),
        classification: "Pendente",
        priority: "Pendente",
        status: "processing",
        attempts: 1,
        durationMs: 0,
        timeSavedMinutes: 0,
        provider: "pending",
        model: "",
        emailDraft: "",
        eventType: input.eventType || "manual",
        requestId: input.requestId,
        currentStep: "classifying",
      })
      .returning();
    return execution;
  }

  async classified(executionId: number, input: ClassificationInput) {
    await this.db
      .update(executions)
      .set({
        classification: input.classification,
        priority: input.priority,
        provider: input.provider,
        model: input.model,
        emailDraft: input.emailDraft,
        currentStep: "sending_email",
      })
      .where(eq(executions.id, executionId));
  }

  async complete(input: CompleteExecutionInput) {
    const completedAt = new Date().toISOString();
    await this.db.batch([
      this.db
        .update(executions)
        .set({
          status: "success",
          currentStep: "completed",
          durationMs: Date.now() - input.startedAt,
          timeSavedMinutes: 10,
          completedAt,
        })
        .where(eq(executions.id, input.executionId)),
      this.db.insert(deliveryAttempts).values({
        emailHash: input.emailHash,
        ipHash: input.ipHash,
      }),
      this.db.insert(sentEmails).values({
        ownerHash: input.ownerHash,
        executionId: input.executionId,
        automationId: input.automationId,
        templateId: input.templateId,
        recipientEmail: input.recipientEmail,
        recipientName: cleanText(input.recipientName, 100),
        subject: input.subject,
        body: input.body,
        status: "sent",
        senderEmail: input.senderEmail,
      }),
    ]);

    const [execution] = await this.db
      .select()
      .from(executions)
      .where(eq(executions.id, input.executionId))
      .limit(1);
    return execution;
  }

  async fail(executionId: number, startedAt: number, error: unknown) {
    const errorMessage = cleanText(
      error instanceof Error ? error.message : "Falha inesperada na execução.",
      500,
    );
    await this.db
      .update(executions)
      .set({
        status: "failed",
        currentStep: "failed",
        errorMessage,
        durationMs: Date.now() - startedAt,
        completedAt: new Date().toISOString(),
      })
      .where(eq(executions.id, executionId));
  }
}
