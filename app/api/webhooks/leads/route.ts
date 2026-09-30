import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { webhookKeys } from "../../../../db/schema";
import {
  normalizeWebhookPayload,
  sha256Hex,
} from "../../../../lib/automation-utils";
import { executeLeadWorkflow } from "../../../../lib/lead-workflow";
import { D1WebhookEventStore } from "../../../../lib/webhooks/d1-webhook-event-store";
import { WebhookIdempotencyService } from "../../../../lib/webhooks/idempotency-service";

function duplicateResponse(event: {
  requestId: string;
  status: "processing" | "succeeded" | "failed";
  responseJson: string;
  errorMessage: string;
}) {
  const headers = { "X-BrunaFlow-Request-Id": event.requestId };
  if (event.status === "succeeded") {
    const response = JSON.parse(event.responseJson || "{}") as Record<
      string,
      unknown
    >;
    return Response.json(
      { ...response, duplicate: true, requestId: event.requestId },
      { status: 200, headers },
    );
  }
  if (event.status === "processing") {
    return Response.json(
      { accepted: true, status: "processing", requestId: event.requestId },
      { status: 202, headers },
    );
  }
  return Response.json(
    {
      error: event.errorMessage || "Esta execução falhou anteriormente.",
      duplicate: true,
      requestId: event.requestId,
    },
    { status: 409, headers },
  );
}

export async function POST(request: Request) {
  let idempotency: WebhookIdempotencyService | undefined;
  let requestId = crypto.randomUUID();
  let tracked = false;
  try {
    const db = getDb();
    const workspaceKey = request.headers.get("x-brunaflow-key") || "";
    let ownerHash: string | undefined;
    let keyId: number | undefined;

    if (workspaceKey) {
      const [key] = await db
        .select()
        .from(webhookKeys)
        .where(eq(webhookKeys.keyHash, await sha256Hex(workspaceKey)))
        .limit(1);
      if (!key?.active)
        return Response.json(
          { error: "Chave de webhook inválida" },
          { status: 401 },
        );
      ownerHash = key.sessionHash;
      keyId = key.id;
    } else if (
      !env.BRUNAFLOW_WEBHOOK_SECRET ||
      request.headers.get("x-brunaflow-secret") !== env.BRUNAFLOW_WEBHOOK_SECRET
    ) {
      return Response.json(
        { error: "Webhook não autorizado" },
        { status: 401 },
      );
    }

    const payload = normalizeWebhookPayload(await request.json());
    idempotency = new WebhookIdempotencyService(new D1WebhookEventStore(db));
    const reservation = await idempotency.begin({
      ownerHash: ownerHash || "service-webhook",
      idempotencyKey: request.headers.get("Idempotency-Key"),
      eventType: payload.eventType,
      requestId,
    });
    requestId = reservation.requestId;
    if (reservation.kind === "duplicate") {
      return duplicateResponse(reservation.event);
    }
    tracked = reservation.tracked;

    const result = await executeLeadWorkflow({
      ownerHash,
      ...payload,
      ipAddress: request.headers.get("CF-Connecting-IP") || undefined,
      requestId,
    });

    if (keyId) {
      await db
        .update(webhookKeys)
        .set({ lastUsedAt: new Date().toISOString() })
        .where(eq(webhookKeys.id, keyId));
    }
    await idempotency.succeed(requestId, result.run.id, result, tracked);
    return Response.json(
      { ...result, requestId },
      {
        status: 201,
        headers: { "X-BrunaFlow-Request-Id": requestId },
      },
    );
  } catch (error) {
    await idempotency?.fail(requestId, error, tracked).catch(() => undefined);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Falha no webhook",
        requestId,
      },
      {
        status: 400,
        headers: { "X-BrunaFlow-Request-Id": requestId },
      },
    );
  }
}
