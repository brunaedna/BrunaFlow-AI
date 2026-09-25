import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { automations, executions } from "../../../db/schema";
import { executeLeadWorkflow } from "../../../lib/lead-workflow";
import { getVisitorSession, hashSession, visitorCookie } from "../../../lib/session";

function message(error:unknown){const text=error instanceof Error?error.message:"Erro inesperado";return text.includes("no such table")?"Banco ainda não preparado. Aplique as migrações do projeto.":text}

export async function GET(request:Request){
  const session=getVisitorSession(request);const headers=new Headers();if(session.isNew)headers.append("Set-Cookie",visitorCookie(session.id,request));
  try{
    const ownerHash=await hashSession(session.id);const db=getDb();const templateNames=["Qualificar novos leads","Resposta de boas-vindas","Recuperar oportunidades"];let automationRows=await db.select().from(automations).where(or(and(eq(automations.ownerHash,"template"),inArray(automations.name,templateNames)),eq(automations.ownerHash,ownerHash))).orderBy(desc(automations.createdAt),desc(automations.id)).limit(30);
    if(!automationRows.length){automationRows=await db.insert(automations).values([
      {ownerHash:"template",name:"Qualificar novos leads",description:"Classifica contatos e cria tarefas no CRM",triggerType:"Novo formulário",actionType:"IA + CRM",status:"active",runs:0,successRate:0},
      {ownerHash:"template",name:"Resposta de boas-vindas",description:"Personaliza e envia o primeiro contato",triggerType:"Lead qualificado",actionType:"E-mail",status:"active",runs:0,successRate:0},
      {ownerHash:"template",name:"Recuperar oportunidades",description:"Reengaja leads sem atividade há 7 dias",triggerType:"Agendamento",actionType:"CRM + E-mail",status:"paused",runs:0,successRate:0},
    ]).returning()}
    const runRows=await db.select().from(executions).where(eq(executions.ownerHash,ownerHash)).orderBy(desc(executions.createdAt),desc(executions.id)).limit(50);
    const runStats=await db.select({automationId:executions.automationId,runs:sql<number>`count(*)`,successes:sql<number>`sum(case when ${executions.status} = 'success' then 1 else 0 end)`}).from(executions).where(eq(executions.ownerHash,ownerHash)).groupBy(executions.automationId);
    const [totals]=await db.select({executions:sql<number>`count(*)`,successes:sql<number>`sum(case when ${executions.status} = 'success' then 1 else 0 end)`,timeSavedMinutes:sql<number>`coalesce(sum(${executions.timeSavedMinutes}),0)`}).from(executions).where(eq(executions.ownerHash,ownerHash));
    const byAutomation=new Map(runStats.map(item=>[item.automationId,item]));const enriched=automationRows.map(item=>{const stats=byAutomation.get(item.id);const count=Number(stats?.runs||0);return{...item,runs:count,successRate:count?Math.round(Number(stats?.successes||0)/count*1000)/10:0}});
    const executionsCount=Number(totals?.executions||0);return Response.json({automations:enriched,runs:runRows,metrics:{executions:executionsCount,successRate:executionsCount?Math.round(Number(totals?.successes||0)/executionsCount*1000)/10:0,timeSavedMinutes:Number(totals?.timeSavedMinutes||0)}},{headers});
  }catch(error){return Response.json({error:message(error)},{status:500,headers})}
}

export async function POST(request:Request){
  const session=getVisitorSession(request);const headers=new Headers();if(session.isNew)headers.append("Set-Cookie",visitorCookie(session.id,request));
  try{
    const ownerHash=await hashSession(session.id);const payload=await request.json() as Record<string,unknown>;const db=getDb();
    if(payload.kind==="automation"){const name=String(payload.name??"").trim();if(!name)return Response.json({error:"Nome obrigatório"},{status:400,headers});const [automation]=await db.insert(automations).values({ownerHash,name,description:String(payload.description??"").trim(),triggerType:String(payload.triggerType??"Novo formulário"),actionType:String(payload.actionType??"IA + CRM")}).returning();return Response.json({automation:{...automation,runs:0,successRate:0}},{status:201,headers})}
    if(payload.kind==="run"){const result=await executeLeadWorkflow({ownerHash,automationId:Number(payload.automationId),automationName:String(payload.automationName??"Automação"),contactName:String(payload.contactName??"Contato").slice(0,100),contactEmail:String(payload.contactEmail??""),message:String(payload.message??"").slice(0,3000),ipAddress:request.headers.get("CF-Connecting-IP")||undefined});return Response.json(result,{status:201,headers})}
    return Response.json({error:"Operação inválida"},{status:400,headers});
  }catch(error){return Response.json({error:message(error)},{status:400,headers})}
}
