import { and, eq } from "drizzle-orm";
import type { getDb } from "../../db";
import { webhookEvents } from "../../db/schema";
import type {
  ReserveWebhookEventInput,
  WebhookEventRecord,
  WebhookEventStatus,
  WebhookEventStore,
} from "./types";

type Database = ReturnType<typeof getDb>;

function toRecord(
  value: typeof webhookEvents.$inferSelect,
): WebhookEventRecord {
  return {
    requestId: value.requestId,
    status: value.status as WebhookEventStatus,
    executionId: value.executionId,
    responseJson: value.responseJson,
    errorMessage: value.errorMessage,
  };
}

export class D1WebhookEventStore implements WebhookEventStore {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async find(ownerHash: string, keyHash: string) {
    const [event] = await this.db
      .select()
      .from(webhookEvents)
      .where(
        and(
          eq(webhookEvents.ownerHash, ownerHash),
          eq(webhookEvents.keyHash, keyHash),
        ),
      )
      .limit(1);
    return event ? toRecord(event) : null;
  }

  async reserve(input: ReserveWebhookEventInput) {
    const inserted = await this.db
      .insert(webhookEvents)
      .values(input)
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });
    return inserted.length === 1;
  }

  async succeed(requestId: string, executionId: number, responseJson: string) {
    await this.db
      .update(webhookEvents)
      .set({
        status: "succeeded",
        executionId,
        responseJson,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(webhookEvents.requestId, requestId));
  }

  async fail(requestId: string, errorMessage: string) {
    await this.db
      .update(webhookEvents)
      .set({
        status: "failed",
        errorMessage,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(webhookEvents.requestId, requestId));
  }
}
