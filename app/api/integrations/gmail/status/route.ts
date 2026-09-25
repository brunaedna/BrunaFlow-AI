import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { gmailConnections } from "../../../../../db/schema";
import { decryptToken } from "../../../../../lib/google-oauth";
import { getGmailOverview } from "../../../../../lib/gmail";
import { getVisitorSession, hashSession, visitorCookie } from "../../../../../lib/session";

export async function GET(request:Request){
  const session=getVisitorSession(request);const headers=new Headers();if(session.isNew)headers.append("Set-Cookie",visitorCookie(session.id,request));
  try{
    const sessionHash=await hashSession(session.id);const db=getDb();const [connection]=await db.select().from(gmailConnections).where(eq(gmailConnections.sessionHash,sessionHash)).limit(1);
    if(!connection)return Response.json({connected:false},{headers});
    const overview=await getGmailOverview(await decryptToken(connection.encryptedRefreshToken));await db.update(gmailConnections).set({email:overview.email,lastSyncedAt:new Date().toISOString()}).where(eq(gmailConnections.id,connection.id));
    return Response.json({connected:true,...overview,lastSyncedAt:new Date().toISOString()},{headers});
  }catch(error){return Response.json({connected:false,error:error instanceof Error?error.message:"Falha ao sincronizar"},{status:200,headers})}
}
