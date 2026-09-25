import { desc, eq, and, gte, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { automations, deliveryAttempts, emailTemplates, gmailConnections, sentEmails } from "../../../db/schema";
import { sendTestEmail } from "../../../lib/gmail";
import { decryptToken } from "../../../lib/google-oauth";
import { generateEmailTemplate } from "../../../lib/lead-ai";
import { getVisitorSession, hashSession, visitorCookie } from "../../../lib/session";

const defaultTemplate={
  name:"Boas-vindas padrão",
  subject:"Bem-vindo(a), {{nome}}!",
  body:"Olá, {{nome}}!\n\nSeu cadastro foi realizado com sucesso. É um prazer ter você com a gente.\n\nSe precisar de ajuda, basta responder a este e-mail.\n\nAtenciosamente,\nEquipe BrunaFlow",
};

function clean(value:unknown,max:number){return String(value??"").trim().slice(0,max)}
function errorMessage(error:unknown){const message=error instanceof Error?error.message:"Erro inesperado";return message.includes("no such table")?"Banco ainda não preparado. Aplique a nova migração do projeto.":message}
function render(value:string,variables:Record<string,string>){return value.replace(/\{\{\s*(nome|email|mensagem|classificacao|prioridade|nome_automacao)\s*\}\}/gi,(_,key:string)=>variables[key.toLowerCase()]||"")}
async function hash(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes)).map(byte=>byte.toString(16).padStart(2,"0")).join("")}

export async function GET(request:Request){
  const session=getVisitorSession(request);const headers=new Headers();if(session.isNew)headers.append("Set-Cookie",visitorCookie(session.id,request));
  try{
    const ownerHash=await hashSession(session.id);const db=getDb();let rows=await db.select().from(emailTemplates).where(eq(emailTemplates.ownerHash,ownerHash)).orderBy(desc(emailTemplates.updatedAt),desc(emailTemplates.id));
    if(!rows.length){rows=await db.insert(emailTemplates).values({ownerHash,...defaultTemplate}).returning()}
    return Response.json({templates:rows},{headers});
  }catch(error){return Response.json({error:errorMessage(error)},{status:500,headers})}
}

export async function POST(request:Request){
  const session=getVisitorSession(request);const headers=new Headers();if(session.isNew)headers.append("Set-Cookie",visitorCookie(session.id,request));
  try{
    const ownerHash=await hashSession(session.id);const payload=await request.json() as Record<string,unknown>;const db=getDb();
    if(payload.kind==="test"){
      const email=clean(payload.email,320).toLowerCase();const contactName=clean(payload.contactName,100)||"Maria";const subject=clean(payload.subject,180);const body=clean(payload.body,5000);const automationName=clean(payload.name,120)||"Modelo de teste";
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return Response.json({error:"Informe um e-mail destinatário válido."},{status:400,headers});
      if(!subject||!body)return Response.json({error:"Preencha assunto e mensagem antes de testar."},{status:400,headers});
      const [connection]=await db.select().from(gmailConnections).where(eq(gmailConnections.sessionHash,ownerHash)).limit(1);if(!connection)return Response.json({error:"Conecte seu Gmail antes de enviar um teste."},{status:400,headers});
      const emailHash=await hash(email);const ipHash=await hash(request.headers.get("CF-Connecting-IP")||"unknown");const [recentEmail]=await db.select({count:sql<number>`count(*)`}).from(deliveryAttempts).where(and(eq(deliveryAttempts.emailHash,emailHash),gte(deliveryAttempts.createdAt,sql`datetime('now','-10 minutes')`)));if(Number(recentEmail?.count||0)>0)return Response.json({error:"Este e-mail já recebeu um teste recentemente. Aguarde 10 minutos."},{status:429,headers});const [recentIp]=await db.select({count:sql<number>`count(*)`}).from(deliveryAttempts).where(and(eq(deliveryAttempts.ipHash,ipHash),gte(deliveryAttempts.createdAt,sql`datetime('now','-1 hour')`)));if(Number(recentIp?.count||0)>=5)return Response.json({error:"Limite de testes atingido nesta conexão. Tente novamente mais tarde."},{status:429,headers});
      const variables={nome:contactName,email,mensagem:"Este é um envio de teste do editor de modelos.",classificacao:"Novo contato",prioridade:"Normal",nome_automacao:automationName};const renderedSubject=render(subject,variables);const renderedBody=render(body,variables);const result=await sendTestEmail(email,renderedSubject,renderedBody,{refreshToken:await decryptToken(connection.encryptedRefreshToken),email:connection.email});if(!result.sent)return Response.json({error:"Não foi possível enviar pela conta conectada."},{status:400,headers});let templateId:null|number=null;const requestedTemplate=Number(payload.id);if(requestedTemplate){const [owned]=await db.select({id:emailTemplates.id}).from(emailTemplates).where(and(eq(emailTemplates.id,requestedTemplate),eq(emailTemplates.ownerHash,ownerHash))).limit(1);templateId=owned?.id||null}await db.batch([db.insert(deliveryAttempts).values({emailHash,ipHash}),db.insert(sentEmails).values({ownerHash,templateId,recipientEmail:email,recipientName:contactName,subject:renderedSubject,body:renderedBody,status:"sent",senderEmail:result.sender||connection.email})]);return Response.json({sent:true,sender:result.sender||connection.email,subject:renderedSubject},{headers});
    }
    if(payload.kind==="generate"){
      const name=clean(payload.name,120)||"Modelo de e-mail";const generated=await generateEmailTemplate({name,subjectHint:clean(payload.subjectHint,180),instructions:clean(payload.instructions,1000)});
      return Response.json(generated,{headers});
    }
    const name=clean(payload.name,120);const subject=clean(payload.subject,180);const body=clean(payload.body,5000);
    if(!name||!subject||!body)return Response.json({error:"Preencha nome, assunto e mensagem."},{status:400,headers});
    const [template]=await db.insert(emailTemplates).values({ownerHash,name,subject,body,aiGenerated:Boolean(payload.aiGenerated)}).returning();
    return Response.json({template},{status:201,headers});
  }catch(error){return Response.json({error:errorMessage(error)},{status:400,headers})}
}

export async function PATCH(request:Request){
  const session=getVisitorSession(request);const headers=new Headers();if(session.isNew)headers.append("Set-Cookie",visitorCookie(session.id,request));
  try{
    const ownerHash=await hashSession(session.id);const payload=await request.json() as Record<string,unknown>;const id=Number(payload.id);const name=clean(payload.name,120);const subject=clean(payload.subject,180);const body=clean(payload.body,5000);
    if(!id||!name||!subject||!body)return Response.json({error:"Dados inválidos."},{status:400,headers});
    const [template]=await getDb().update(emailTemplates).set({name,subject,body,aiGenerated:Boolean(payload.aiGenerated),updatedAt:new Date().toISOString()}).where(and(eq(emailTemplates.id,id),eq(emailTemplates.ownerHash,ownerHash))).returning();
    if(!template)return Response.json({error:"Modelo não encontrado."},{status:404,headers});
    return Response.json({template},{headers});
  }catch(error){return Response.json({error:errorMessage(error)},{status:400,headers})}
}

export async function DELETE(request:Request){
  const session=getVisitorSession(request);const headers=new Headers();if(session.isNew)headers.append("Set-Cookie",visitorCookie(session.id,request));
  try{
    const ownerHash=await hashSession(session.id);const payload=await request.json() as {id?:number};const id=Number(payload.id);if(!id)return Response.json({error:"Modelo inválido."},{status:400,headers});const db=getDb();
    const [owned]=await db.select({id:emailTemplates.id}).from(emailTemplates).where(and(eq(emailTemplates.id,id),eq(emailTemplates.ownerHash,ownerHash))).limit(1);
    if(!owned)return Response.json({error:"Modelo não encontrado."},{status:404,headers});
    const [summary]=await db.select({total:sql<number>`count(*)`}).from(emailTemplates).where(eq(emailTemplates.ownerHash,ownerHash));
    if(Number(summary?.total||0)<=1)return Response.json({error:"Mantenha pelo menos um modelo de e-mail no workspace."},{status:409,headers});
    await db.batch([db.update(automations).set({templateId:null,status:"paused"}).where(and(eq(automations.ownerHash,ownerHash),eq(automations.templateId,id))),db.delete(emailTemplates).where(eq(emailTemplates.id,id))]);
    return Response.json({deleted:true},{headers});
  }catch(error){return Response.json({error:errorMessage(error)},{status:400,headers})}
}
