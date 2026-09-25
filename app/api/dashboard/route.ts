import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { automations, emailTemplates, executions, sentEmails } from "../../../db/schema";
import { executeLeadWorkflow } from "../../../lib/lead-workflow";
import { getVisitorSession, hashSession, visitorCookie } from "../../../lib/session";

function message(error:unknown){const text=error instanceof Error?error.message:"Erro inesperado";return text.includes("no such table")?"Banco ainda não preparado. Aplique as migrações do projeto.":text}

export async function GET(request:Request){
  const session=getVisitorSession(request);const headers=new Headers();if(session.isNew)headers.append("Set-Cookie",visitorCookie(session.id,request));
  try{
    const ownerHash=await hashSession(session.id);const db=getDb();const templateNames=["Boas-vindas para novos usuários","Resposta a novo formulário","Contato de novo lead"];let automationRows=await db.select().from(automations).where(or(and(eq(automations.ownerHash,"template"),inArray(automations.name,templateNames)),eq(automations.ownerHash,ownerHash))).orderBy(desc(automations.createdAt),desc(automations.id)).limit(30);
    if(!automationRows.length){automationRows=await db.insert(automations).values([
      {ownerHash:"template",name:"Boas-vindas para novos usuários",description:"Envia uma mensagem personalizada após cada cadastro",triggerType:"user.created",actionType:"Enviar e-mail pelo Gmail",status:"active",runs:0,successRate:0},
      {ownerHash:"template",name:"Resposta a novo formulário",description:"Responde automaticamente aos contatos recebidos",triggerType:"form.submitted",actionType:"Enviar e-mail pelo Gmail",status:"active",runs:0,successRate:0},
      {ownerHash:"template",name:"Contato de novo lead",description:"Analisa e responde novos leads recebidos pelo webhook",triggerType:"lead.created",actionType:"Enviar e-mail pelo Gmail",status:"paused",runs:0,successRate:0},
    ]).returning()}
    const runRows=await db.select().from(executions).where(eq(executions.ownerHash,ownerHash)).orderBy(desc(executions.createdAt),desc(executions.id)).limit(50);
    const runStats=await db.select({automationId:executions.automationId,runs:sql<number>`count(*)`,successes:sql<number>`sum(case when ${executions.status} = 'success' then 1 else 0 end)`}).from(executions).where(eq(executions.ownerHash,ownerHash)).groupBy(executions.automationId);
    const [totals]=await db.select({executions:sql<number>`count(*)`,successes:sql<number>`sum(case when ${executions.status} = 'success' then 1 else 0 end)`,timeSavedMinutes:sql<number>`coalesce(sum(${executions.timeSavedMinutes}),0)`}).from(executions).where(eq(executions.ownerHash,ownerHash));
    const byAutomation=new Map(runStats.map(item=>[item.automationId,item]));const enriched=automationRows.map(item=>{const stats=byAutomation.get(item.id);const count=Number(stats?.runs||0);return{...item,runs:count,successRate:count?Math.round(Number(stats?.successes||0)/count*1000)/10:0}});
    const emailRows=await db.select().from(sentEmails).where(eq(sentEmails.ownerHash,ownerHash)).orderBy(desc(sentEmails.sentAt),desc(sentEmails.id)).limit(100);
    const executionsCount=Number(totals?.executions||0);return Response.json({automations:enriched,runs:runRows,emails:emailRows,metrics:{executions:executionsCount,successRate:executionsCount?Math.round(Number(totals?.successes||0)/executionsCount*1000)/10:0,timeSavedMinutes:Number(totals?.timeSavedMinutes||0)}},{headers});
  }catch(error){return Response.json({error:message(error)},{status:500,headers})}
}

export async function POST(request:Request){
  const session=getVisitorSession(request);const headers=new Headers();if(session.isNew)headers.append("Set-Cookie",visitorCookie(session.id,request));
  try{
    const ownerHash=await hashSession(session.id);const payload=await request.json() as Record<string,unknown>;const db=getDb();
    if(payload.kind==="automation"){const name=String(payload.name??"").trim();const templateId=Number(payload.templateId)||null;if(!name)return Response.json({error:"Nome obrigatório"},{status:400,headers});if(!templateId)return Response.json({error:"Selecione um modelo de e-mail."},{status:400,headers});const [ownedTemplate]=await db.select({id:emailTemplates.id}).from(emailTemplates).where(and(eq(emailTemplates.id,templateId),eq(emailTemplates.ownerHash,ownerHash))).limit(1);if(!ownedTemplate)return Response.json({error:"Modelo de e-mail inválido."},{status:400,headers});const [automation]=await db.insert(automations).values({ownerHash,name,description:String(payload.description??"").trim(),triggerType:String(payload.triggerType??"user.created"),actionType:"Enviar e-mail pelo Gmail",templateId}).returning();return Response.json({automation:{...automation,runs:0,successRate:0}},{status:201,headers})}
    if(payload.kind==="run"){const result=await executeLeadWorkflow({ownerHash,automationId:Number(payload.automationId),automationName:String(payload.automationName??"Automação"),contactName:String(payload.contactName??"Contato").slice(0,100),contactEmail:String(payload.contactEmail??""),message:String(payload.message??"").slice(0,3000),ipAddress:request.headers.get("CF-Connecting-IP")||undefined});return Response.json(result,{status:201,headers})}
    return Response.json({error:"Operação inválida"},{status:400,headers});
  }catch(error){return Response.json({error:message(error)},{status:400,headers})}
}
