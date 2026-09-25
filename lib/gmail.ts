import { env } from "cloudflare:workers";
import { refreshAccessToken } from "./google-oauth";

type GmailIdentity={refreshToken:string;email:string};

export async function sendTestEmail(to:string,subject:string,body:string,identity?:GmailIdentity){
  const refreshToken=identity?.refreshToken||env.GOOGLE_REFRESH_TOKEN;
  const sender=identity?.email||env.GMAIL_SENDER;
  if(!refreshToken||!sender)return{sent:false,reason:"not_connected"};
  const accessToken=await refreshAccessToken(refreshToken);
  const safeSender=sender.replace(/[\r\n]/g,"");const safeSubject=subject.replace(/[\r\n]/g," ");const encodedSubject=`=?UTF-8?B?${toBase64(new TextEncoder().encode(safeSubject))}?=`;
  const message=[`From: BrunaFlow AI <${safeSender}>`,`To: ${to}`,`Subject: ${encodedSubject}`,"MIME-Version: 1.0","Content-Type: text/plain; charset=UTF-8","",body].join("\r\n");
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
