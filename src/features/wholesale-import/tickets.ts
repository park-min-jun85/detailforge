import "server-only";
import { randomUUID } from "node:crypto";
import type { ImportCandidate } from "./schemas";
import { ImportError } from "./errors";
export type ImportTicket = {projectId:string;candidate:ImportCandidate;expiresAt:number;saved?:{productId:string;urls:string[]}};
// Bounded transient cache only. No HTML, cookies, credentials or persistent state.
const globalCache=globalThis as typeof globalThis & { wholesaleTickets?:Map<string,ImportTicket> };
const tickets=globalCache.wholesaleTickets??=new Map<string,ImportTicket>();
export function issueTicket(projectId:string,candidate:ImportCandidate){for(const [key,value] of tickets)if(value.expiresAt<Date.now())tickets.delete(key);if(tickets.size>=50)tickets.delete(tickets.keys().next().value!);const token=randomUUID();tickets.set(token,{projectId,candidate,expiresAt:Date.now()+20*60*1000});return token;}
export function readTicket(projectId:string,token:string){const ticket=tickets.get(token);if(!ticket||ticket.projectId!==projectId||ticket.expiresAt<Date.now())throw new ImportError("expired");return ticket;}
const globalJobs=globalThis as typeof globalThis & { wholesaleJobs?:Set<string> };
const jobs=globalJobs.wholesaleJobs??=new Set<string>();
export async function importExclusive<T>(key:string,operation:()=>Promise<T>){if(jobs.has(key)||jobs.size>=4)throw new ImportError("busy");jobs.add(key);try{return await operation();}finally{jobs.delete(key);}}
const thumbnailState=globalThis as typeof globalThis & { wholesaleThumbnails?:{active:number;waiters:(()=>void)[]} };
const thumbnails=thumbnailState.wholesaleThumbnails??={active:0,waiters:[]};
export async function thumbnailSlot<T>(operation:()=>Promise<T>){
  if(thumbnails.active>=4){if(thumbnails.waiters.length>=30)throw new ImportError("busy");await new Promise<void>((resolve,reject)=>{const ready=()=>{clearTimeout(timer);resolve();};const timer=setTimeout(()=>{const index=thumbnails.waiters.indexOf(ready);if(index>=0)thumbnails.waiters.splice(index,1);reject(new ImportError("timeout"));},20000);thumbnails.waiters.push(ready);});}
  else thumbnails.active++;
  try{return await operation();}finally{const next=thumbnails.waiters.shift();if(next)next();else thumbnails.active--;}
}
