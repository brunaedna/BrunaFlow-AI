import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { gmailConnections, webhookKeys } from "../../../../db/schema";
import { getVisitorSession, hashSession, visitorCookie } from "../../../../lib/session";

function responseHeaders(request:Request,session:{id:string;isNew:boolean}){
  const headers=new Headers();
  if(session.isNew)headers.append("Set-Cookie",visitorCookie(session.id,request));
  return headers;
}

export async function GET(request:Request){
  const session=getVisitorSession(request);const headers=responseHeaders(request,session);const sessionHash=await hashSession(session.id);const db=getDb();
  const [key]=await db.select({keyPrefix:webhookKeys.keyPrefix,createdAt:webhookKeys.createdAt,lastUsedAt:webhookKeys.lastUsedAt}).from(webhookKeys).where(eq(webhookKeys.sessionHash,sessionHash)).limit(1);
  return Response.json({configured:Boolean(key),keyPrefix:key?.keyPrefix,createdAt:key?.createdAt,lastUsedAt:key?.lastUsedAt,endpoint:`${new URL(request.url).origin}/api/webhooks/leads`},{headers});
}

export async function POST(request:Request){
  const session=getVisitorSession(request);const headers=responseHeaders(request,session);const sessionHash=await hashSession(session.id);const db=getDb();
  const [gmail]=await db.select({id:gmailConnections.id}).from(gmailConnections).where(eq(gmailConnections.sessionHash,sessionHash)).limit(1);
  if(!gmail)return Response.json({error:"Conecte seu Gmail antes de gerar uma chave."},{status:400,headers});
  const rawKey=`bf_live_${randomSecret()}`;const keyHash=await hash(rawKey);const keyPrefix=`${rawKey.slice(0,15)}…`;
  const [existing]=await db.select({id:webhookKeys.id}).from(webhookKeys).where(eq(webhookKeys.sessionHash,sessionHash)).limit(1);
  if(existing)await db.update(webhookKeys).set({keyHash,keyPrefix,active:true,createdAt:new Date().toISOString(),lastUsedAt:null}).where(eq(webhookKeys.id,existing.id));
  else await db.insert(webhookKeys).values({sessionHash,keyHash,keyPrefix});
  return Response.json({configured:true,key:rawKey,keyPrefix,endpoint:`${new URL(request.url).origin}/api/webhooks/leads`},{status:201,headers});
}

export async function DELETE(request:Request){
  const session=getVisitorSession(request);const headers=responseHeaders(request,session);const sessionHash=await hashSession(session.id);const db=getDb();
  await db.delete(webhookKeys).where(eq(webhookKeys.sessionHash,sessionHash));
  return Response.json({configured:false},{headers});
}

function randomSecret(){const bytes=crypto.getRandomValues(new Uint8Array(32));let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
async function hash(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes)).map(byte=>byte.toString(16).padStart(2,"0")).join("")}
