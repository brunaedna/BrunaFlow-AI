import { cleanText, sha256Hex } from "../automation-utils.ts";
import type { WebhookEventRecord, WebhookEventStore } from "./types";

type BeginInput = {
  ownerHash: string;
  idempotencyKey: string | null;
  eventType: string;
  requestId?: string;
};

export type BeginWebhookResult =
  | { kind: "accepted"; requestId: string; tracked: boolean }
  | { kind: "duplicate"; requestId: string; event: WebhookEventRecord };

export function normalizeIdempotencyKey(value: string | null) {
  const key = cleanText(value, 200);
  return key.length >= 8 ? key : "";
}

export class WebhookIdempotencyService {
  private readonly store: WebhookEventStore;

  constructor(store: WebhookEventStore) {
    this.store = store;
  }

  async begin(input: BeginInput): Promise<BeginWebhookResult> {
    const requestId = input.requestId || crypto.randomUUID();
    const key = normalizeIdempotencyKey(input.idempotencyKey);
    if (!key) return { kind: "accepted", requestId, tracked: false };

    const keyHash = await sha256Hex(`${input.ownerHash}:${key}`);
    const existing = await this.store.find(input.ownerHash, keyHash);
    if (existing) {
      return {
        kind: "duplicate",
        requestId: existing.requestId,
        event: existing,
      };
    }

    const reserved = await this.store.reserve({
      ownerHash: input.ownerHash,
      keyHash,
      requestId,
      eventType: input.eventType || "unknown",
    });
    if (reserved) return { kind: "accepted", requestId, tracked: true };

    const concurrent = await this.store.find(input.ownerHash, keyHash);
    if (!concurrent) {
      throw new Error("Não foi possível reservar o evento do webhook.");
    }
    return {
      kind: "duplicate",
      requestId: concurrent.requestId,
      event: concurrent,
    };
  }

  async succeed(
    requestId: string,
    executionId: number,
    response: unknown,
    tracked: boolean,
  ) {
    if (!tracked) return;
    await this.store.succeed(requestId, executionId, JSON.stringify(response));
  }

  async fail(requestId: string, error: unknown, tracked: boolean) {
    if (!tracked) return;
    const message =
      error instanceof Error ? error.message : "Falha inesperada no webhook.";
    await this.store.fail(requestId, cleanText(message, 500));
  }
}
