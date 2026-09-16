import "server-only";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import { candidateSchema, type ImportCandidate } from "./schemas";
import { publicUrl } from "./security";
import { ImportError } from "./errors";
type Node = DefaultTreeAdapterMap["node"];
const children=(node:Node):Node[]=>"childNodes" in node?node.childNodes:[];
const tag=(node:Node)=>"tagName" in node?node.tagName:"";
const attr=(node:Node,name:string)=>"attrs" in node?node.attrs.find(a=>a.name===name)?.value??"":"";
function walk(root:Node){const nodes:Node[]=[],stack=[root];while(stack.length){const node=stack.pop()!;nodes.push(node);if(nodes.length>60000)throw new ImportError("too_large");stack.push(...children(node).slice().reverse());}return nodes;}
function text(node:Node){const parts:string[]=[],stack=[node];while(stack.length){const current=stack.pop()!;if(["script","style","noscript"].includes(tag(current)))continue;if("value" in current)parts.push(current.value);else stack.push(...children(current).slice().reverse());}return parts.join(" ").replace(/\s+/g," ").trim();}
const clean=(value:unknown,max:number):string|null=>typeof value==="string"||typeof value==="number"?String(value).replace(/<[^>]*>/g," ").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"").replace(/\s+/g," ").trim().slice(0,max)||null:null;
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
function jsonProducts(value:unknown){const result:Record<string,unknown>[]=[],stack=[value];let count=0;while(stack.length&&count++<5000){const entry=stack.pop();if(Array.isArray(entry))stack.push(...entry);else if(entry&&typeof entry==="object"){const row=object(entry),type=row["@type"];if((Array.isArray(type)?type:[type]).some(t=>typeof t==="string"&&/(^|\/)Product$/.test(t)))result.push(row);else stack.push(...Object.values(row).filter(v=>v&&typeof v==="object"));}}return result;}
function productScope(node:Node){let parent:Node|null=node;while(parent){if(/product/i.test(attr(parent,"itemtype"))||/(^|[\s_-])product([\s_-]|$)/i.test(attr(parent,"class"))||/product/i.test(attr(parent,"id")))return true;parent="parentNode" in parent?parent.parentNode:null;}return false;}
export function extractCandidate(html:string,sourceUrl:string,rendered=false,now=new Date()):ImportCandidate {
  const root=parse(html),nodes=walk(root),elements=nodes.filter(n=>!!tag(n));
  const meta=(name:string)=>elements.find(n=>tag(n)==="meta"&&(attr(n,"property").toLowerCase()===name||attr(n,"name").toLowerCase()===name));
  const metaValue=(name:string,max=5000)=>clean(meta(name)?attr(meta(name)!,"content"):null,max);
  const title=elements.find(n=>tag(n)==="title"),titleText=title?text(title):"";
  if(/just a moment|access denied|verify (you|that)|captcha|접근.*제한|로그인.*필요|robot check/i.test(titleText))throw new ImportError("restricted");
  const products=elements.filter(n=>tag(n)==="script"&&attr(n,"type").split(";")[0].trim().toLowerCase()==="application/ld+json").slice(0,30).flatMap(n=>{try{return jsonProducts(JSON.parse(children(n).map(c=>"value" in c?c.value:"").join("")));}catch{return [];}});
  const ld=products[0]??{},h1=elements.find(n=>tag(n)==="h1"&&productScope(n));
  const domName=elements.find(n=>attr(n,"itemprop")==="name"&&productScope(n))??h1;
  const desc=elements.find(n=>attr(n,"itemprop")==="description"||/(^|[\s_-])product[-_]description([\s_-]|$)/i.test(attr(n,"id")+" "+attr(n,"class")));
  const description=desc?(text(desc)||null):null;
  let domDescription=description;
  if(desc&&"parentNode" in desc&&desc.parentNode){const siblings=children(desc.parentNode),index=siblings.indexOf(desc);const next=siblings.slice(index+1).find(n=>tag(n)==="p");if(next)domDescription=text(next);}
  const ldName=clean(ld.name,200),ogName=metaValue("og:title",200);
  const product={name:ldName??ogName??(domName?clean(text(domName),200):null),
    brand:clean(typeof ld.brand==="object"?object(ld.brand).name:ld.brand,100)??metaValue("product:brand",100)??clean(elements.find(n=>attr(n,"itemprop")==="brand")?text(elements.find(n=>attr(n,"itemprop")==="brand")!):null,100),
    category:clean(ld.category,100)??metaValue("product:category",100),
    description:clean(ld.description,5000)??metaValue("og:description")??metaValue("description")??clean(domDescription,5000), specifications:[] as {name:string;value:string}[]};
  const specs=new Map<string,{name:string;value:string}>();
  function addSpec(name:unknown,value:unknown){const n=clean(name,100),v=clean(value,500);if(n&&v&&!specs.has(n.toLowerCase())&&specs.size<50)specs.set(n.toLowerCase(),{name:n,value:v});}
  for(const row of (Array.isArray(ld.additionalProperty)?ld.additionalProperty:[ld.additionalProperty]).slice(0,100)){const item=object(row);addSpec(item.name,item.value);}
  for(const key of ["sku","mpn","gtin","material","color","size","weight","width","height","depth"])if(ld[key]!==undefined){const value=ld[key],amount=clean(object(value).value,450);addSpec(key,typeof value==="object"?(amount?amount+(clean(object(value).unitText,50)??""):null):value);}
  for(const row of elements.filter(n=>tag(n)==="tr"&&productScope(n)).slice(0,100)){const cells=children(row).filter(n=>["td","th"].includes(tag(n)));if(cells.length===2)addSpec(text(cells[0]),text(cells[1]));}
  for(const row of elements.filter(n=>tag(n)==="dt"&&productScope(n)).slice(0,100)){if("parentNode" in row&&row.parentNode){const siblings=children(row.parentNode),next=siblings.slice(siblings.indexOf(row)+1).find(n=>tag(n)==="dd");if(next)addSpec(text(row),text(next));}}
  product.specifications=[...specs.values()];
  const images:ImportCandidate["images"]=[],seen=new Set<string>();
  function addImage(value:unknown,alt:unknown,selected:boolean,width?:string,height?:string){if(typeof value!=="string"||images.length>=30)return;
    try{const url=publicUrl(new URL(value,sourceUrl).href).href;if(seen.has(url)||/\.(svg|gif|ico)(?:\?|$)/i.test(url)||/(?:^|[\/_-])(logo|icon|spacer|tracking|pixel)(?:[\/_\-.?]|$)/i.test(new URL(url).pathname)||(width&&Number(width)>0&&Number(width)<100)||(height&&Number(height)>0&&Number(height)<100))return;seen.add(url);images.push({url,alt:clean(alt,200),selected});}catch{/* Ignore unsafe/non-image candidates. */}}
  for(const image of (Array.isArray(ld.image)?ld.image:[ld.image]).slice(0,100))addImage(typeof image==="object"?object(image).url??object(image).contentUrl:image,product.name,true);
  addImage(metaValue("og:image",2048),metaValue("og:image:alt",200),true);
  for(const img of elements.filter(n=>tag(n)==="img"&&(productScope(n)||attr(n,"itemprop")==="image")))addImage(attr(img,"data-src")||attr(img,"src"),attr(img,"alt"),false,attr(img,"width"),attr(img,"height"));
  if(!ldName&&!domName&&elements.some(n=>tag(n)==="input"&&attr(n,"type")==="password"))throw new ImportError("restricted");
  const method=rendered?"browser":ldName?"json_ld":ogName?"metadata":"dom";
  return candidateSchema.parse({sourceType:"wholesale_url",sourceUrl,sourceHost:new URL(sourceUrl).hostname,fetchedAt:now.toISOString(),extractionMethod:method,product,images,
    warnings:["자동 추출한 후보입니다. 저장 전에 상품명·스펙·이미지를 직접 확인해 주세요.",...(products.length>1?["여러 상품 정보가 있습니다. 첫 번째 상품 후보가 맞는지 확인해 주세요."]:[]),...(!images.length?["상품 이미지 후보를 찾지 못했습니다."]:[])]});
}
export function sufficient(candidate:ImportCandidate){return !!candidate.product.name&&!!(candidate.product.description||candidate.product.specifications.length||candidate.images.length);}
