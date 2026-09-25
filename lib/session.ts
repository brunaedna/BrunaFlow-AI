const COOKIE_NAME="brunaflow_session";

export function getVisitorSession(request:Request){
  const cookie=request.headers.get("cookie")||"";
  const current=cookie.split(";").map(part=>part.trim()).find(part=>part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length+1);
  if(current&&/^[a-f0-9-]{36}$/i.test(current))return{id:current,isNew:false};
  return{id:crypto.randomUUID(),isNew:true};
}

export function visitorCookie(id:string,request:Request,maxAge=60*60*24*30){
  const secure=new URL(request.url).protocol==="https:"?"; Secure":"";
  return`${COOKIE_NAME}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function readCookie(request:Request,name:string){
  const cookie=request.headers.get("cookie")||"";
  return cookie.split(";").map(part=>part.trim()).find(part=>part.startsWith(`${name}=`))?.slice(name.length+1)||null;
}

export function scopedCookie(name:string,value:string,request:Request,maxAge:number){
  const secure=new URL(request.url).protocol==="https:"?"; Secure":"";
  return`${name}=${value}; Path=/api/integrations/gmail; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function hashSession(value:string){
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map(byte=>byte.toString(16).padStart(2,"0")).join("");
}
