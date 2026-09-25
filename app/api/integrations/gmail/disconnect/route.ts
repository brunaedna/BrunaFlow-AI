import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { gmailConnections } from "../../../../../db/schema";
import { decryptToken } from "../../../../../lib/google-oauth";
import { getVisitorSession, hashSession } from "../../../../../lib/session";

export async function POST(request:Request){
  const session=getVisitorSession(request);if(session.isNew)return Response.json({disconnected:true});const sessionHash=await hashSession(session.id);const db=getDb();const [connection]=await db.select().from(gmailConnections).where(eq(gmailConnections.sessionHash,sessionHash)).limit(1);
  if(connection){try{const token=await decryptToken(connection.encryptedRefreshToken);await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"}})}catch{}await db.delete(gmailConnections).where(eq(gmailConnections.id,connection.id))}
  return Response.json({disconnected:true});
}
