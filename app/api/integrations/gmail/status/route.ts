import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { gmailConnections } from "../../../../../db/schema";
import {
  decryptToken,
  refreshAccessToken,
} from "../../../../../lib/google-oauth";
import {
  getVisitorSession,
  hashSession,
  visitorCookie,
} from "../../../../../lib/session";

export async function GET(request: Request) {
  const session = getVisitorSession(request);
  const headers = new Headers();
  if (session.isNew)
    headers.append("Set-Cookie", visitorCookie(session.id, request));
  try {
    const sessionHash = await hashSession(session.id);
    const db = getDb();
    const [connection] = await db
      .select()
      .from(gmailConnections)
      .where(eq(gmailConnections.sessionHash, sessionHash))
      .limit(1);
    if (!connection) return Response.json({ connected: false }, { headers });
    await refreshAccessToken(
      await decryptToken(connection.encryptedRefreshToken),
    );
    const lastSyncedAt = new Date().toISOString();
    await db
      .update(gmailConnections)
      .set({ lastSyncedAt })
      .where(eq(gmailConnections.id, connection.id));
    return Response.json(
      { connected: true, email: connection.email, lastSyncedAt },
      { headers },
    );
  } catch (error) {
    return Response.json(
      {
        connected: false,
        error: error instanceof Error ? error.message : "Falha ao sincronizar",
      },
      { status: 200, headers },
    );
  }
}
