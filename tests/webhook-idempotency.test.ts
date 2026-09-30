import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeIdempotencyKey,
  WebhookIdempotencyService,
} from "../lib/webhooks/idempotency-service.ts";
import type {
  ReserveWebhookEventInput,
  WebhookEventRecord,
  WebhookEventStore,
} from "../lib/webhooks/types.ts";

class InMemoryWebhookEventStore implements WebhookEventStore {
  readonly events = new Map<string, WebhookEventRecord>();
  readonly reservations: ReserveWebhookEventInput[] = [];

  async find(ownerHash: string, keyHash: string) {
    return this.events.get(`${ownerHash}:${keyHash}`) ?? null;
  }

  async reserve(input: ReserveWebhookEventInput) {
    const key = `${input.ownerHash}:${input.keyHash}`;
    if (this.events.has(key)) return false;
    this.reservations.push(input);
    this.events.set(key, {
      requestId: input.requestId,
      status: "processing",
      executionId: null,
      responseJson: "",
      errorMessage: "",
    });
    return true;
  }

  async succeed(requestId: string, executionId: number, responseJson: string) {
    const event = this.findByRequestId(requestId);
    Object.assign(event, { status: "succeeded", executionId, responseJson });
  }

  async fail(requestId: string, errorMessage: string) {
    const event = this.findByRequestId(requestId);
    Object.assign(event, { status: "failed", errorMessage });
  }

  private findByRequestId(requestId: string) {
    const event = [...this.events.values()].find(
      (item) => item.requestId === requestId,
    );
    if (!event) throw new Error("Evento não encontrado.");
    return event;
  }
}

test("ignora chaves de idempotência ausentes ou curtas", () => {
  assert.equal(normalizeIdempotencyKey(null), "");
  assert.equal(normalizeIdempotencyKey("curta"), "");
  assert.equal(normalizeIdempotencyKey(" evento-123 "), "evento-123");
});

test("reserva uma chave sem armazenar seu valor em texto puro", async () => {
  const store = new InMemoryWebhookEventStore();
  const service = new WebhookIdempotencyService(store);

  const result = await service.begin({
    ownerHash: "workspace",
    idempotencyKey: "cadastro-123",
    eventType: "user.created",
    requestId: "request-1",
  });

  assert.deepEqual(result, {
    kind: "accepted",
    requestId: "request-1",
    tracked: true,
  });
  assert.equal(store.reservations.length, 1);
  assert.notEqual(store.reservations[0].keyHash, "cadastro-123");
});

test("reconhece uma repetição e devolve a execução original", async () => {
  const store = new InMemoryWebhookEventStore();
  const service = new WebhookIdempotencyService(store);
  const input = {
    ownerHash: "workspace",
    idempotencyKey: "cadastro-123",
    eventType: "user.created",
  };

  const first = await service.begin({ ...input, requestId: "request-1" });
  assert.equal(first.kind, "accepted");
  await service.succeed("request-1", 42, { ok: true }, true);

  const duplicate = await service.begin({ ...input, requestId: "request-2" });

  assert.equal(duplicate.kind, "duplicate");
  if (duplicate.kind === "duplicate") {
    assert.equal(duplicate.requestId, "request-1");
    assert.equal(duplicate.event.executionId, 42);
    assert.equal(duplicate.event.status, "succeeded");
    assert.equal(duplicate.event.responseJson, '{"ok":true}');
  }
});

test("não persiste eventos quando o cliente não envia uma chave", async () => {
  const store = new InMemoryWebhookEventStore();
  const service = new WebhookIdempotencyService(store);

  const result = await service.begin({
    ownerHash: "workspace",
    idempotencyKey: null,
    eventType: "user.created",
    requestId: "request-1",
  });

  assert.deepEqual(result, {
    kind: "accepted",
    requestId: "request-1",
    tracked: false,
  });
  assert.equal(store.reservations.length, 0);
});
