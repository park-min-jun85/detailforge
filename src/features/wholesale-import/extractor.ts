import "server-only";
import { parse, parseFragment, type DefaultTreeAdapterMap } from "parse5";
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
function cleanSpecValue(value: unknown) {
  const result=clean(value,500);
  if(!result||/^[\/|\s]+$/.test(result))return null;
  // Trim only whitespace-separated edge separators; preserve internal ratios,
  // compound materials, identifiers, units and negative numeric values.
  return result.replace(/^(?:[\/|]\s+)+|(?:\s+[\/|])+$/g,"").trim()||null;
}
function jsonProducts(value:unknown){const result:Record<string,unknown>[]=[],stack=[value];let count=0;while(stack.length&&count++<5000){const entry=stack.pop();if(Array.isArray(entry))stack.push(...entry);else if(entry&&typeof entry==="object"){const row=object(entry),type=row["@type"];if((Array.isArray(type)?type:[type]).some(t=>typeof t==="string"&&/(^|\/)Product$/.test(t)))result.push(row);else stack.push(...Object.values(row).filter(v=>v&&typeof v==="object"));}}return result;}
function productScope(node:Node){let parent:Node|null=node;while(parent){if(/product/i.test(attr(parent,"itemtype"))||/(^|[\s_-])product([\s_-]|$)/i.test(attr(parent,"class"))||/product/i.test(attr(parent,"id")))return true;parent="parentNode" in parent?parent.parentNode:null;}return false;}

const specLabel = /^(?:상품번호|상품코드|품번|품명(?:\s*및\s*모델명)?|모델명?|원산지|제조국(?:\s*또는\s*원산지)?|제조사|재질|소재|색상|크기|중량|무게|용량|규격|상품포장 부피\/무게|sku|mpn|model|country of origin|manufacturer|material|color|size|weight)$/i;
const wallText = /just a moment|access denied|verify (?:you|that)|captcha|robot check|checking your browser|(?:login|sign in|authentication) required|(?:log|sign) in to continue|보안\s*문자|접근.*제한|로그인.*(?:필요|해주세요|하십시오)|인증.*(?:필요|해주세요)/i;
function contentHeading(node: Node): boolean {
  if(tag(node)!=="h1"||!text(node)||wallText.test(text(node))||/^(로그인|login|sign in)$/i.test(text(node)))return false;
  let parent: Node | null = node;
  while(parent){
    if(["header","nav","footer","form"].includes(tag(parent)))return false;
    parent="parentNode" in parent?parent.parentNode:null;
  }
  return true;
}
function detailScope(node: Node): boolean {
  let current: Node | null = node;
  while (current) {
    const marker = attr(current, "id") + " " + attr(current, "class");
    if (/(?:product|goods|item)[\w\s-]*(?:detail|description|contents)|(?:detail|description)[\w\s-]*(?:product|goods|item)/i.test(marker)) return true;
    current = "parentNode" in current ? current.parentNode : null;
  }
  return false;
}
function breadcrumb(elements: Node[]): string | null {
  const region = elements.find(node => /breadcrumb/i.test(attr(node,"id")+" "+attr(node,"class")+" "+attr(node,"aria-label")) || /(?:^|\s)path(?:\s|$)/i.test((attr(node,"id")+" "+attr(node,"class")).replace(/([a-z])([A-Z])/g,"$1 $2")));
  if (!region) return null;
  const list = walk(region).find(node => ["ol","ul"].includes(tag(node)));
  if (!list) return null;
  // Only the active trail, never the nested category dropdown choices.
  const parts = children(list).filter(node => tag(node)==="li").map(node => children(node).filter(child => !["ol","ul","script","style"].includes(tag(child))).map(text).join(" ").trim()).filter(Boolean);
  return clean(parts.filter(part => !/^(?:home|홈)$|홈$/i.test(part)).join(" > "),100);
}
export function extractCandidate(html:string,sourceUrl:string,rendered=false,now=new Date()):ImportCandidate {
  const root=parse(html),nodes=walk(root),elements=nodes.filter(n=>!!tag(n));
  const meta=(name:string)=>elements.find(n=>tag(n)==="meta"&&(attr(n,"property").toLowerCase()===name||attr(n,"name").toLowerCase()===name));
  const metaValue=(name:string,max=5000)=>clean(meta(name)?attr(meta(name)!,"content"):null,max);
  const title=elements.find(n=>tag(n)==="title"),titleText=title?text(title):"";
  const products=elements.filter(n=>tag(n)==="script"&&attr(n,"type").split(";")[0].trim().toLowerCase()==="application/ld+json").slice(0,30).flatMap(n=>{try{return jsonProducts(JSON.parse(children(n).map(c=>"value" in c?c.value:"").join("")));}catch{return [];}});
  const ld=products[0]??{},h1=elements.find(n=>tag(n)==="h1"&&productScope(n))??elements.find(n=>contentHeading(n)&&metaValue("og:title",200)?.endsWith(text(n)))??elements.find(contentHeading);
  const domName=elements.find(n=>attr(n,"itemprop")==="name"&&productScope(n))??h1;
  const desc=elements.find(n=>attr(n,"itemprop")==="description"||/(^|[\s_-])product[-_]description([\s_-]|$)/i.test(attr(n,"id")+" "+attr(n,"class")));
  const description=desc?(text(desc)||null):null;
  let domDescription=description;
  if(desc&&"parentNode" in desc&&desc.parentNode){const siblings=children(desc.parentNode),index=siblings.indexOf(desc);const next=siblings.slice(index+1).find(n=>tag(n)==="p");if(next)domDescription=text(next);}
  const ldName=clean(ld.name,200),ogName=metaValue("og:title",200);
  const domTitle=domName?clean(text(domName),200):null;
  const preferredDomTitle=domTitle&&(!ogName||productScope(domName!)||ogName.endsWith(domTitle))?domTitle:null;
  const body=elements.find(n=>tag(n)==="body")??root,bodyText=text(body);
  const priceRestricted=/(?:사업자\s*회원|회원|로그인).{0,35}가격\s*(?:확인|공개)|가격.{0,35}(?:로그인|사업자\s*회원)/i.test(bodyText);
  const product={name:ldName??preferredDomTitle??ogName??domTitle,
    brand:clean(typeof ld.brand==="object"?object(ld.brand).name:ld.brand,100)??metaValue("product:brand",100)??clean(elements.find(n=>attr(n,"itemprop")==="brand")?text(elements.find(n=>attr(n,"itemprop")==="brand")!):null,100),
    category:clean(ld.category,100)??metaValue("product:category",100)??breadcrumb(elements),
    description:clean(ld.description,5000)??clean(domDescription,5000)??(priceRestricted?null:metaValue("og:description")??metaValue("description")), specifications:[] as {name:string;value:string}[]};
  const specs=new Map<string,{name:string;value:string}>();
  function addSpec(name:unknown,value:unknown){const n=clean(name,100),v=cleanSpecValue(value);if(n&&v&&!specs.has(n.toLowerCase())&&specs.size<50)specs.set(n.toLowerCase(),{name:n,value:v});}
  for(const row of (Array.isArray(ld.additionalProperty)?ld.additionalProperty:[ld.additionalProperty]).slice(0,100)){const item=object(row);addSpec(item.name,item.value);}
  for(const key of ["sku","mpn","gtin","material","color","size","weight","width","height","depth"])if(ld[key]!==undefined){const value=ld[key],amount=clean(object(value).value,450);addSpec(key,typeof value==="object"?(amount?amount+(clean(object(value).unitText,50)??""):null):value);}
  for(const row of elements.filter(n=>tag(n)==="tr").slice(0,300)){const cells=children(row).filter(n=>["td","th"].includes(tag(n)));if(cells.length===2&&(productScope(row)||specLabel.test(text(cells[0]))))addSpec(text(cells[0]),text(cells[1]));}
  for(const row of elements.filter(n=>tag(n)==="dt"&&productScope(n)).slice(0,100)){if("parentNode" in row&&row.parentNode){const siblings=children(row.parentNode),next=siblings.slice(siblings.indexOf(row)+1).find(n=>tag(n)==="dd");if(next)addSpec(text(row),text(next));}}
  // Legacy notices often use label/div pairs instead of a semantic table.
  for(const label of elements.filter(n=>tag(n)==="label"&&specLabel.test(text(n))).slice(0,100)){
    if(attr(label,"for")||!("parentNode" in label)||!label.parentNode)continue;
    const cells=children(label.parentNode).filter(n=>!!tag(n));
    if(cells.length===2&&cells[0]===label&&["div","span","p"].includes(tag(cells[1]))&&!walk(cells[1]).some(n=>["input","select","textarea"].includes(tag(n))))addSpec(text(label),text(cells[1]));
  }
  for(const node of elements.filter(n=>["span","p"].includes(tag(n)))){
    const match=text(node).match(/^(상품번호|상품코드|품번|SKU)\s*[:：]\s*([\w-]{1,100})$/i);
    if(match)addSpec(match[1],match[2]);
  }
  product.specifications=[...specs.values()];
  if(!product.description&&specs.size)product.description=clean(product.specifications.map(row=>`${row.name}: ${row.value}`).join("\n"),5000);
  const images:ImportCandidate["images"]=[],seen=new Set<string>();
  function addImage(value:unknown,alt:unknown,selected:boolean,width?:string,height?:string){if(typeof value!=="string"||images.length>=30)return;
    try{const url=publicUrl(new URL(value,sourceUrl).href).href;if(seen.has(url)||/\.(svg|gif|ico)(?:\?|$)/i.test(url)||/(?:^|[\/_-])(logo|icon|ico|btn|menu|star|rating|banner|arrow|chevron|spacer|tracking|pixel)(?:[\/_\-.?]|$)/i.test(new URL(url).pathname.replace(/([a-z])([A-Z])/g,"$1_$2"))||(width&&parseFloat(width)>0&&parseFloat(width)<100)||(height&&parseFloat(height)>0&&parseFloat(height)<100))return;seen.add(url);images.push({url,alt:clean(alt,200),selected});}catch{/* Ignore unsafe/non-image candidates. */}}
  for(const image of (Array.isArray(ld.image)?ld.image:[ld.image]).slice(0,100))addImage(typeof image==="object"?object(image).url??object(image).contentUrl:image,product.name,true);
  addImage(metaValue("og:image",2048),metaValue("og:image:alt",200),true);
  for(const img of elements.filter(n=>tag(n)==="img"&&(productScope(n)||detailScope(n)||attr(n,"itemprop")==="image")))addImage(attr(img,"data-src")||attr(img,"src"),attr(img,"alt"),false,attr(img,"width"),attr(img,"height"));
  // Read inert detail markup as data; do not execute scripts or follow embeds.
  let fragmentBytes=0,fragmentNodes=0;
  for(const buffer of elements.filter(n=>tag(n)==="textarea"&&detailScope(n)).slice(0,20)){
    const markup=text(buffer);fragmentBytes+=Buffer.byteLength(markup);
    if(fragmentBytes>256*1024)throw new ImportError("too_large");
    const fragment=walk(parseFragment(markup));fragmentNodes+=fragment.length;
    if(fragmentNodes>10000)throw new ImportError("too_large");
    for(const img of fragment.filter(n=>tag(n)==="img"))addImage(attr(img,"data-src")||attr(img,"src"),attr(img,"alt"),false,attr(img,"width"),attr(img,"height"));
  }
  const hasBody=!!domName&&!!(specs.size||images.length||domDescription);
  const productSignals=!!product.name&&(hasBody||(!!ldName&&!!(specs.size||images.length||product.description))||(metaValue("og:type")==="product"&&!!(specs.size||images.length)));
  const password=elements.some(n=>tag(n)==="input"&&attr(n,"type").toLowerCase()==="password");
  const challenge=elements.some(n=>/(?:cf-chl|challenge-form|captcha|turnstile)/i.test(attr(n,"id")+" "+attr(n,"class")));
  const authPath=/\/(?:login|signin|sign-in|auth|authenticate)(?:[/.]|$)/i.test(new URL(sourceUrl).pathname);
  const loginTitle=/^\s*(?:로그인|sign in|login)\s*$/i.test(titleText);
  const wallWithoutProduct=!productSignals&&(password||challenge||wallText.test(titleText)||wallText.test(bodyText)||loginTitle);
  const explicitWall=!hasBody&&(authPath||loginTitle||(challenge&&wallText.test(titleText)));
  if(wallWithoutProduct||explicitWall)throw new ImportError("restricted");
  const method=rendered?"browser":ldName?"json_ld":ogName?"metadata":"dom";
  return candidateSchema.parse({sourceType:"wholesale_url",sourceUrl,sourceHost:new URL(sourceUrl).hostname,fetchedAt:now.toISOString(),extractionMethod:method,product,images,
    warnings:["자동 추출한 후보입니다. 저장 전에 상품명·스펙·이미지를 직접 확인해 주세요.",...(priceRestricted?["상품정보는 가져왔지만 가격은 로그인한 사업자회원에게만 공개됩니다."]:[]),...(products.length>1?["여러 상품 정보가 있습니다. 첫 번째 상품 후보가 맞는지 확인해 주세요."]:[]),...(!images.length?["상품 이미지 후보를 찾지 못했습니다."]:[])]});
}
export function sufficient(candidate:ImportCandidate){return !!candidate.product.name&&!!(candidate.product.description||candidate.product.specifications.length||candidate.images.length);}
