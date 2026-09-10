import { createServer } from "node:http";

export const projectId="7645f432-b847-4e28-9ee7-f41beccccf46";
const initialDate="2026-09-10T01:00:00.000Z";
export async function startProductDb() {
  const state={project:{id:projectId,name:"로컬 검증 프로젝트",status:"draft",created_at:initialDate,updated_at:initialDate},
    product:null,facts:null,requests:[],failure:null,ackLost:null,failRollback:false,concurrentWrite:false,readFailure:false,tick:0};
  const server=createServer(async(request,response)=>{
    const url=new URL(request.url,"http://localhost");
    const table=url.pathname.split("/").at(-1);
    let body="";
    for await(const chunk of request) body+=chunk;
    const payload=body?JSON.parse(body):null;
    state.requests.push({table,method:request.method,payload});
    const error=()=>{response.writeHead(400,{"Content-Type":"application/json"});response.end(JSON.stringify({code:"TEST",message:"private-db-detail secret-test-key"}));};
    const send=(rows)=>{
      const object=request.headers.accept?.includes("vnd.pgrst.object");
      response.writeHead(200,{"Content-Type":"application/json"});
      response.end(JSON.stringify(object?(rows[0]??null):rows));
    };
    const key={projects:"project",products:"product",product_facts:"facts"}[table];
    if(!key) return error();
    const current=state[key];
    const matches=(row)=>row && [...url.searchParams].every(([field,value])=>
      ["select","order","limit","offset"].includes(field) || !value.startsWith("eq.") || String(row[field])===value.slice(3));
    if(request.method==="GET"){
      if(state.readFailure) return error();
      return send(matches(current)?[current]:[]);
    }
    const operation=table==="products"?(request.method==="POST"?"product-insert":request.method==="DELETE"?"product-delete":"product-update")
      :(request.method==="POST"?"facts-insert":"facts-update");
    const previousProductWrites=state.requests.filter((entry)=>entry.table==="products"&&entry.method!=="GET").length;
    if(state.failure===operation || (state.failRollback && table==="products" && (request.method==="DELETE"||previousProductWrites>1))){
      if(state.concurrentWrite && table==="product_facts") state.product={...state.product,name:"다른 창 변경",updated_at:"2026-09-11T01:00:00.000Z"};
      return error();
    }
    const timestamp=()=>new Date(Date.parse(initialDate)+ ++state.tick*1000).toISOString();
    let rows=[];
    if(request.method==="POST"){
      if(current) return error();
      state[key]={...(key==="product"?{brand:null,category:null,description:null,source_url:null,source_type:"manual",raw_data:{}}:{version:1,validated_at:null}),
        created_at:timestamp(),updated_at:timestamp(),...payload};
      rows=[state[key]];
    }else if(request.method==="PATCH"&&matches(current)){
      state[key]={...current,...payload,updated_at:timestamp()};rows=[state[key]];
    }else if(request.method==="DELETE"&&matches(current)){
      rows=[current];state[key]=null;
      if(key==="product")state.facts=null;
    }
    if(state.ackLost===table){state.ackLost=null;return error();}
    return send(rows);
  });
  await new Promise((resolve)=>server.listen(0,"127.0.0.1",resolve));
  const previousUrl=process.env.SUPABASE_URL,previousKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL=`http://127.0.0.1:${server.address().port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY="secret-test-key";
  return {state,async close(){
    if(previousUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=previousUrl;
    if(previousKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previousKey;
    await new Promise((resolve)=>server.close(resolve));
  }};
}