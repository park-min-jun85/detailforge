import { createServer } from 'node:http';
export const projectId='7645f432-b847-4e28-9ee7-f41beccccf46';
export const productId='6645f432-b847-4e28-9ee7-f41beccccf46';
export const otherProductId='5645f432-b847-4e28-9ee7-f41beccccf46';
const date='2026-09-17T00:00:00.000Z';
export async function startOptionsDb(){
 const state={projects:[{id:projectId}],products:[{id:productId,project_id:projectId,raw_data:{keep:'source'},ai_analysis:{keep:'analysis'}}],
  facts:{facts:{keep:'facts'},validation:{keep:'validation'},source_snapshot:{keep:'snapshot'}},assets:[{keep:'asset'}],options:[],requests:[],failRead:false,failWrite:false,ackLost:false,race:false,tick:0};
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost'),table=url.pathname.split('/').at(-1);let text='';for await(const chunk of req)text+=chunk;
  const payload=text?JSON.parse(text):null;state.requests.push({table,method:req.method,payload,query:Object.fromEntries(url.searchParams)});
  const error=(code='TEST')=>{res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({code,message:'private-database-detail secret-test-key'}));};
  const send=rows=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(req.headers.accept?.includes('vnd.pgrst.object')?(rows[0]??null):rows));};
  const match=row=>[...url.searchParams].every(([key,value])=>!value.startsWith('eq.')||String(row[key])===value.slice(3));
  const rows={projects:state.projects,products:state.products,product_options:state.options}[table];if(!rows)return error();
  if(req.method==='GET')return state.failRead?error():send(rows.filter(match));
  if(table!=='product_options'||state.failWrite)return error();
  if(state.race&&req.method==='PATCH'){state.options[0].version++;state.options[0].source_snapshot={};state.race=false;}
  let written=[];const now=new Date(Date.parse(date)+ ++state.tick*1000).toISOString();
  if(req.method==='POST'){
   if(state.options.some(row=>row.product_id===payload.product_id))return error('23505');
   if(!state.products.some(row=>row.id===payload.product_id))return error('23503');
   const row={...payload,created_at:now,updated_at:now};state.options.push(row);written=[row];
  }else if(req.method==='PATCH'){written=state.options.filter(match);for(const row of written)Object.assign(row,payload,{updated_at:now});}
  if(state.ackLost){state.ackLost=false;return error();}send(written);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const previous={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
 process.env.SUPABASE_URL=`http://127.0.0.1:${server.address().port}`;process.env.SUPABASE_SERVICE_ROLE_KEY='secret-test-key';
 return {state,async close(){for(const [key,value] of [['SUPABASE_URL',previous.url],['SUPABASE_SERVICE_ROLE_KEY',previous.key]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}await new Promise(resolve=>server.close(resolve));}};
}
