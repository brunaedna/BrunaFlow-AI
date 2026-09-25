import { desc, eq, and, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { automations, emailTemplates } from "../../../db/schema";
import { generateEmailTemplate } from "../../../lib/lead-ai";
import { getVisitorSession, hashSession, visitorCookie } from "../../../lib/session";

const defaultTemplate={
  name:"Boas-vindas padrão",
  subject:"Bem-vindo(a), {{nome}}!",
  body:"Olá, {{nome}}!\n\nSeu cadastro foi realizado com sucesso. É um prazer ter você com a gente.\n\nSe precisar de ajuda, basta responder a este e-mail.\n\nAtenciosamente,\nEquipe BrunaFlow",
};

function clean(value:unknown,max:number){return String(value??"").trim().slice(0,max)}
function errorMessage(error:unknown){const message=error instanceof Error?error.message:"Erro inesperado";return message.includes("no such table")?"Banco ainda não preparado. Aplique a nova migração do projeto.":message}

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
    const ownerHash=await hashSession(session.id);const payload=await request.json() as Record<string,unknown>;
    if(payload.kind==="generate"){
      const name=clean(payload.name,120)||"E-mail de boas-vindas";const generated=await generateEmailTemplate({name,instructions:clean(payload.instructions,1000)});
      return Response.json(generated,{headers});
    }
    const name=clean(payload.name,120);const subject=clean(payload.subject,180);const body=clean(payload.body,5000);
    if(!name||!subject||!body)return Response.json({error:"Preencha nome, assunto e mensagem."},{status:400,headers});
    const [template]=await getDb().insert(emailTemplates).values({ownerHash,name,subject,body,aiGenerated:Boolean(payload.aiGenerated)}).returning();
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
