import { env } from "cloudflare:workers";

export const GMAIL_SCOPES=["https://www.googleapis.com/auth/gmail.send","https://www.googleapis.com/auth/gmail.metadata"];

export function googleConfig(){
  if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)throw new Error("A integração Google ainda não foi configurada.");
  return{clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET};
}

export async function exchangeCode(code:string,redirectUri:string){
  const config=googleConfig();
  const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,code,redirect_uri:redirectUri,grant_type:"authorization_code"})});
  if(!response.ok)throw new Error("O Google não concluiu a autorização.");
  return response.json() as Promise<{access_token:string;refresh_token?:string;scope?:string}>;
}

export async function refreshAccessToken(refreshToken:string){
  const config=googleConfig();
  const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,refresh_token:refreshToken,grant_type:"refresh_token"})});
  if(!response.ok)throw new Error("A conexão com o Gmail expirou. Conecte a conta novamente.");
  const token=await response.json() as {access_token?:string};
  if(!token.access_token)throw new Error("Token do Gmail indisponível.");
  return token.access_token;
}

export async function encryptToken(value:string){
  const key=await encryptionKey();const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(value));
  return`${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

export async function decryptToken(value:string){
  const [ivPart,dataPart]=value.split(".");if(!ivPart||!dataPart)throw new Error("Conexão do Gmail inválida.");
  const decrypted=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromBase64Url(ivPart)},await encryptionKey(),fromBase64Url(dataPart));
  return new TextDecoder().decode(decrypted);
}

async function encryptionKey(){
  if(!env.OAUTH_ENCRYPTION_KEY)throw new Error("A criptografia das conexões ainda não foi configurada.");
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(env.OAUTH_ENCRYPTION_KEY));
  return crypto.subtle.importKey("raw",digest,"AES-GCM",false,["encrypt","decrypt"]);
}
function base64Url(bytes:Uint8Array){let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
function fromBase64Url(value:string){const normalized=value.replace(/-/g,"+").replace(/_/g,"/");const binary=atob(normalized+"=".repeat((4-normalized.length%4)%4));return Uint8Array.from(binary,char=>char.charCodeAt(0))}
