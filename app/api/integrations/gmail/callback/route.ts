import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { gmailConnections } from "../../../../../db/schema";
import { encryptToken, exchangeCode } from "../../../../../lib/google-oauth";
import { getGmailOverview } from "../../../../../lib/gmail";
import { getVisitorSession, hashSession, readCookie, scopedCookie, visitorCookie } from "../../../../../lib/session";

export async function GET(request:Request){
  const url=new URL(request.url);const state=url.searchParams.get("state");const code=url.searchParams.get("code");const expected=readCookie(request,"brunaflow_oauth_state");
  if(!state||!code||!expected||state!==expected)return Response.redirect(new URL("/?gmail=invalid",request.url),302);
  try{
    const session=getVisitorSession(request);const tokens=await exchangeCode(code,new URL("/api/integrations/gmail/callback",request.url).toString());if(!tokens.refresh_token)throw new Error("O Google não forneceu acesso permanente.");
    const overview=await getGmailOverview(tokens.refresh_token);const sessionHash=await hashSession(session.id);const encrypted=await encryptToken(tokens.refresh_token);const db=getDb();
    const [existing]=await db.select({id:gmailConnections.id}).from(gmailConnections).where(eq(gmailConnections.sessionHash,sessionHash)).limit(1);
    if(existing)await db.update(gmailConnections).set({email:overview.email,encryptedRefreshToken:encrypted,scopes:tokens.scope||"",lastSyncedAt:new Date().toISOString()}).where(eq(gmailConnections.id,existing.id));
    else await db.insert(gmailConnections).values({sessionHash,email:overview.email,encryptedRefreshToken:encrypted,scopes:tokens.scope||"",lastSyncedAt:new Date().toISOString()});
    const headers=new Headers({Location:new URL("/?gmail=connected",request.url).toString()});headers.append("Set-Cookie",scopedCookie("brunaflow_oauth_state","",request,0));if(session.isNew)headers.append("Set-Cookie",visitorCookie(session.id,request));return new Response(null,{status:302,headers});
  }catch{return Response.redirect(new URL("/?gmail=error",request.url),302)}
}
