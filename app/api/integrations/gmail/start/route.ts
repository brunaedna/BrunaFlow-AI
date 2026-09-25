import { googleConfig, GMAIL_SCOPES } from "../../../../../lib/google-oauth";
import { getVisitorSession, scopedCookie, visitorCookie } from "../../../../../lib/session";

export async function GET(request:Request){
  try{
    const config=googleConfig();const session=getVisitorSession(request);const state=crypto.randomUUID();const redirectUri=new URL("/api/integrations/gmail/callback",request.url).toString();
    const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:redirectUri,response_type:"code",scope:GMAIL_SCOPES.join(" "),access_type:"offline",include_granted_scopes:"true",prompt:"consent select_account",state}).toString();
    const headers=new Headers({Location:url.toString()});headers.append("Set-Cookie",scopedCookie("brunaflow_oauth_state",state,request,600));if(session.isNew)headers.append("Set-Cookie",visitorCookie(session.id,request));
    return new Response(null,{status:302,headers});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Integração indisponível"},{status:503})}
}
