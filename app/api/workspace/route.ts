import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { automations, emailTemplates, executions, gmailConnections, sentEmails, webhookKeys } from "../../../db/schema";
import { decryptToken } from "../../../lib/google-oauth";
import { getVisitorSession, hashSession, visitorCookie } from "../../../lib/session";

export async function DELETE(request:Request){
  const session=getVisitorSession(request);if(session.isNew)return Response.json({cleared:true});
  const sessionHash=await hashSession(session.id);const payload=await request.json().catch(()=>({})) as {scope?:string};const db=getDb();
  if(payload.scope==="history"){
    await db.batch([db.delete(sentEmails).where(eq(sentEmails.ownerHash,sessionHash)),db.delete(executions).where(eq(executions.ownerHash,sessionHash))]);
    return Response.json({cleared:true});
  }
  if(payload.scope!=="workspace")return Response.json({error:"Ação inválida"},{status:400});
  const [connection]=await db.select().from(gmailConnections).where(eq(gmailConnections.sessionHash,sessionHash)).limit(1);
  if(connection){try{const token=await decryptToken(connection.encryptedRefreshToken);await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"}})}catch{}}
  await db.batch([
    db.delete(sentEmails).where(eq(sentEmails.ownerHash,sessionHash)),
    db.delete(executions).where(eq(executions.ownerHash,sessionHash)),
    db.delete(automations).where(eq(automations.ownerHash,sessionHash)),
    db.delete(emailTemplates).where(eq(emailTemplates.ownerHash,sessionHash)),
    db.delete(webhookKeys).where(eq(webhookKeys.sessionHash,sessionHash)),
    db.delete(gmailConnections).where(eq(gmailConnections.sessionHash,sessionHash)),
  ]);
  const headers=new Headers({"Set-Cookie":visitorCookie("deleted",request,0)});
  return Response.json({cleared:true},{headers});
}
