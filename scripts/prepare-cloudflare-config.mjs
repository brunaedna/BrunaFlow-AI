import { readFile, writeFile } from "node:fs/promises";

const databaseId=process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
const workerName=process.env.CLOUDFLARE_WORKER_NAME?.trim()||"brunaflow-ai";
const databaseName=process.env.CLOUDFLARE_D1_DATABASE_NAME?.trim()||"brunaflow-ai-db";

if(!databaseId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(databaseId)){
  throw new Error("Defina CLOUDFLARE_D1_DATABASE_ID com o UUID do banco D1 de produção.");
}

const path=new URL("../dist/server/wrangler.json",import.meta.url);
const config=JSON.parse(await readFile(path,"utf8"));
config.name=workerName;
config.d1_databases=[{binding:"DB",database_name:databaseName,database_id:databaseId}];
await writeFile(path,`${JSON.stringify(config,null,2)}\n`);
console.log(`Configuração de produção preparada para ${workerName} e D1 ${databaseName}.`);
