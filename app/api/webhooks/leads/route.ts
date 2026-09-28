import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { webhookKeys } from "../../../../db/schema";
import { normalizeWebhookPayload, sha256Hex } from "../../../../lib/automation-utils";
import { executeLeadWorkflow } from "../../../../lib/lead-workflow";

export async function POST(request: Request) {
  try {
    const db = getDb();
    const workspaceKey = request.headers.get("x-brunaflow-key") || "";
    let ownerHash: string | undefined;
    let keyId: number | undefined;

    if (workspaceKey) {
      const [key] = await db.select().from(webhookKeys)
        .where(eq(webhookKeys.keyHash, await sha256Hex(workspaceKey))).limit(1);
      if (!key?.active) return Response.json({ error: "Chave de webhook inválida" }, { status: 401 });
      ownerHash = key.sessionHash;
      keyId = key.id;
    } else if (!env.BRUNAFLOW_WEBHOOK_SECRET || request.headers.get("x-brunaflow-secret") !== env.BRUNAFLOW_WEBHOOK_SECRET) {
      return Response.json({ error: "Webhook não autorizado" }, { status: 401 });
    }

    const payload = normalizeWebhookPayload(await request.json());
    const result = await executeLeadWorkflow({
      ownerHash,
      ...payload,
      ipAddress: request.headers.get("CF-Connecting-IP") || undefined,
    });

    if (keyId) {
      await db.update(webhookKeys).set({ lastUsedAt: new Date().toISOString() }).where(eq(webhookKeys.id, keyId));
    }
    return Response.json(result, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Falha no webhook" }, { status: 400 });
  }
}
