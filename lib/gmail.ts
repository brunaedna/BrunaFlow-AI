import { env } from "cloudflare:workers";
import { refreshAccessToken } from "./google-oauth";

type GmailIdentity={refreshToken:string;email:string};

export async function sendTestEmail(to:string,subject:string,body:string,identity?:GmailIdentity){
  const refreshToken=identity?.refreshToken||env.GOOGLE_REFRESH_TOKEN;
  const sender=identity?.email||env.GMAIL_SENDER;
  if(!refreshToken||!sender)return{sent:false,reason:"not_connected"};
  const accessToken=await refreshAccessToken(refreshToken);
  const safeSender=sender.replace(/[\r\n]/g,"");const safeRecipient=to.replace(/[\r\n]/g,"");const safeSubject=subject.replace(/[\r\n]/g," ");const encodedSubject=`=?UTF-8?B?${toBase64(new TextEncoder().encode(safeSubject))}?=`;
  const boundary=`brunaflow_${crypto.randomUUID().replace(/-/g,"")}`;const html=buildBrunaFlowEmailHtml(body);
  const message=[
    `From: BrunaFlow AI <${safeSender}>`,
    `To: ${safeRecipient}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    `--${boundary}--`,
  ].join("\r\n");
  const raw=base64Url(new TextEncoder().encode(message));
  const response=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{method:"POST",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({raw})});
  if(!response.ok)throw new Error("O Gmail recusou o envio.");return{sent:true,reason:null,sender};
}

export async function getGmailOverview(refreshToken:string){
  const accessToken=await refreshAccessToken(refreshToken);const headers={Authorization:`Bearer ${accessToken}`};
  const [profileResponse,inboxResponse,sentResponse]=await Promise.all([
    fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile",{headers}),
    fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX",{headers}),
    fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels/SENT",{headers}),
  ]);
  if(!profileResponse.ok||!inboxResponse.ok||!sentResponse.ok)throw new Error("Não foi possível sincronizar o Gmail.");
  const profile=await profileResponse.json() as {emailAddress:string;messagesTotal:number;threadsTotal:number};
  const inbox=await inboxResponse.json() as {messagesTotal?:number;messagesUnread?:number};
  const sent=await sentResponse.json() as {messagesTotal?:number};
  return{email:profile.emailAddress,totalMessages:profile.messagesTotal,totalThreads:profile.threadsTotal,inboxMessages:inbox.messagesTotal||0,unreadMessages:inbox.messagesUnread||0,sentMessages:sent.messagesTotal||0};
}

function toBase64(bytes:Uint8Array){let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary)}
function base64Url(bytes:Uint8Array){return toBase64(bytes).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
function escapeHtml(value:string){return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}

export function buildBrunaFlowEmailHtml(body:string){
  const content=escapeHtml(body).replace(/\r?\n/g,"<br>");
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4fb;font-family:Arial,Helvetica,sans-serif;color:#343a4c">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4fb;padding:32px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 16px 44px rgba(45,35,105,.14)">
      <tr><td style="padding:24px 28px;background:linear-gradient(135deg,#7147e8 0%,#4f6cff 100%)">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr>
          <td width="46" height="46" align="center" style="width:46px;height:46px;border:2px solid rgba(255,255,255,.72);border-radius:13px;background:rgba(255,255,255,.14);color:#ffffff;font-size:16px;font-weight:800">BF</td>
          <td style="padding-left:14px;color:#ffffff"><div style="font-size:20px;font-weight:800;letter-spacing:-.4px">BrunaFlow</div><div style="margin-top:3px;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;opacity:.82">AI automation</div></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:34px 32px 30px;font-size:15px;line-height:1.75;color:#4d5366">${content}</td></tr>
      <tr><td style="padding:18px 32px;border-top:1px solid #ececf5;background:#fafaff;text-align:center;color:#8b90a3;font-size:11px;line-height:1.5">Enviado automaticamente pelo <strong style="color:#6657d9">BrunaFlow AI</strong><br>Automação inteligente, comunicação humana.</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}
