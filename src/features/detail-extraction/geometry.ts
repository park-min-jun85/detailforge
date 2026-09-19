import "server-only";
import { createHash } from "node:crypto";
import { boxSchema, type Candidate, type Dimensions, type Rect, type Region } from "./schemas";
import { CROP_MARGIN, MAX_CROP_MARGIN, MAX_CANDIDATES, MIN_CROP_WIDTH, MIN_CROP_HEIGHT, MIN_CROP_AREA, PRODUCT_REGIONS } from "./policy";
import { ExtractionError } from "./errors";
import { defaultExclusionReason } from "./selection";
export type TileRect = Rect & { index: number };
export function clampRect(rect: Rect, source: Dimensions): Rect {
  if (![rect.x,rect.y,rect.width,rect.height].every(Number.isSafeInteger)||rect.width<=0||rect.height<=0) throw new ExtractionError("invalid_rect");
  const x=Math.max(0,rect.x),y=Math.max(0,rect.y),right=Math.min(source.width,rect.x+rect.width),bottom=Math.min(source.height,rect.y+rect.height);
  if(right<=x||bottom<=y)throw new ExtractionError("invalid_rect");
  return {x,y,width:right-x,height:bottom-y};
}
export function mapBox(box: Region["box"], tile: TileRect, source: Dimensions): Rect {
  if(!boxSchema.safeParse(box).success||box.xMax<=box.xMin||box.yMax<=box.yMin)throw new ExtractionError("invalid_rect");
  const x=tile.x+Math.floor(box.xMin*tile.width/1000),y=tile.y+Math.floor(box.yMin*tile.height/1000);
  return clampRect({x,y,width:tile.x+Math.ceil(box.xMax*tile.width/1000)-x,height:tile.y+Math.ceil(box.yMax*tile.height/1000)-y},source);
}
export function withMargin(rect: Rect,source: Dimensions) { const px=Math.min(MAX_CROP_MARGIN,Math.round(rect.width*CROP_MARGIN)),py=Math.min(MAX_CROP_MARGIN,Math.round(rect.height*CROP_MARGIN));return clampRect({x:rect.x-px,y:rect.y-py,width:rect.width+px*2,height:rect.height+py*2},source); }
export function candidateId(fingerprint: string,rect: Rect,type: Region["regionType"]) { return createHash("sha256").update(JSON.stringify([fingerprint,rect.x,rect.y,rect.width,rect.height,type])).digest("hex"); }
export function overlap(a:Rect,b:Rect) {const area=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));return {iou:area/(a.width*a.height+b.width*b.height-area),containment:area/Math.min(a.width*a.height,b.width*b.height)};}
const productRole=(type:Region["regionType"])=>PRODUCT_REGIONS.some(role=>role===type);
const score=(c:Candidate)=>(productRole(c.regionType)?2:c.regionType==="mixed"?1:0)+c.confidence+c.standaloneUsability+c.productVisibility-(c.edgeTruncated?0.5:0);
export function normalizeCandidates(entries:{region:Region;tile:TileRect}[],source:Dimensions,fingerprint:string) {
  const candidates=entries.map(({region,tile}):Candidate=>{
    const raw=mapBox(region.box,tile,source),rect=withMargin(raw,source);
    const edgeTruncated=(tile.y>0&&region.box.yMin<=5)||(tile.y+tile.height<source.height&&region.box.yMax>=995);
    const size=raw.width>=MIN_CROP_WIDTH&&raw.height>=MIN_CROP_HEIGHT&&raw.width*raw.height>=MIN_CROP_AREA;
    const saveAllowed=size&&(productRole(region.regionType)||region.regionType==="mixed")&&region.confidence>=0.4&&region.productVisibility>=0.35&&region.standaloneUsability>=0.35;
    const {box: _box,...description}=region;void _box;
    const candidate = {...description,id:candidateId(fingerprint,rect,region.regionType),rect,tileIndices:[tile.index],saveAllowed,edgeTruncated,defaultSelected:false};
    return {...candidate,defaultSelected:defaultExclusionReason(candidate)===null};
  }).sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));
  const kept:Candidate[]=[];
  for(const c of candidates){const duplicate=kept.find(k=>k.regionType===c.regionType&&(overlap(k.rect,c.rect).iou>=0.65||overlap(k.rect,c.rect).containment>=0.92));
    if(duplicate){duplicate.tileIndices=[...new Set([...duplicate.tileIndices,...c.tileIndices])].sort((a,b)=>a-b);continue;}kept.push(c);}
  // Partial seam detections are NOT unioned: coordinates alone cannot prove the same photo.
  // Preserve ambiguous neighbours for review, and never preselect a tile-edge fragment.
  const truncatedCandidates=kept.length>MAX_CANDIDATES;
  return {candidates:kept.slice(0,MAX_CANDIDATES).sort((a,b)=>a.rect.y-b.rect.y||a.rect.x-b.rect.x||a.id.localeCompare(b.id)),truncatedCandidates};
}
