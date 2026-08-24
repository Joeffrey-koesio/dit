import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { RawRow, Ticket } from '../types';

export const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases:Record<string,string[]>= {
 id:['DIT no interne'],created:['DIT Date/Heure'],status:['DIT Etat'],nature:['DIT Nature'],requestType:['Type DIT'],
 opLast:['DIT Opérateur nom'],opFirst:['DIT Opérateur prénom'],techLast:['IT Intervenant nom'],techFirst:['IT Intervenant prénom'],
 duration:['IT Durée'],handling:['Tps Prise en charge'],response:['Tps Réponse'],resolution:['Tps Résolution'],agency:['Profil client AGENCES'],
 customer:['DIT Raison sociale'],activity:['IT Activité article']
};
export function detect(headers:string[]){const map:Record<string,string|undefined>={};for(const [k,names] of Object.entries(aliases)){map[k]=headers.find(h=>names.some(n=>normalize(h)===normalize(n)));}return map;}
const text=(v:unknown)=>v==null?'':String(v).trim();
const num=(v:unknown)=>{if(v==null||v==='')return null;const n=typeof v==='number'?v:Number(String(v).replace(',','.'));return Number.isFinite(n)&&n>=0?n:null};
const date=(v:unknown)=>{if(v instanceof Date&&!isNaN(v.getTime()))return v;if(typeof v==='number'){const p=XLSX.SSF.parse_date_code(v);return p?new Date(p.y,p.m-1,p.d,p.H,p.M,p.S):null;}if(typeof v==='string'){const d=new Date(v);if(!isNaN(d.getTime()))return d;const m=v.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);if(m)return new Date(+m[3],+m[2]-1,+m[1],+(m[4]||0),+(m[5]||0));}return null};
const person=(f:unknown,l:unknown)=>[text(f),text(l).toUpperCase()].filter(Boolean).join(' ');
export async function readFile(file:File):Promise<RawRow[]>{
 if(file.name.toLowerCase().endsWith('.csv')) return await new Promise((resolve,reject)=>Papa.parse<RawRow>(file,{header:true,skipEmptyLines:true,complete:r=>resolve(r.data),error:reject}));
 const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:'array',cellDates:true});return XLSX.utils.sheet_to_json<RawRow>(wb.Sheets[wb.SheetNames[0]],{defval:null,raw:true});
}
export function consolidate(rows:RawRow[]){
 const headers=rows[0]?Object.keys(rows[0]):[];const m=detect(headers);if(!m.id)throw new Error('Colonne « DIT no interne » introuvable.');
 const grouped=new Map<string,RawRow[]>();let rejected=0;
 for(const r of rows){const id=text(r[m.id]).toUpperCase();if(!id){rejected++;continue}(grouped.get(id)||grouped.set(id,[]).get(id)!).push(r)}
 const tickets:Ticket[]=[];
 for(const [id,list] of grouped){const first=(key:string)=>{const col=m[key];return col?list.map(r=>r[col]).find(v=>v!=null&&v!==''):null};const numbers=(key:string)=>{const col=m[key];return col?list.map(r=>num(r[col])).filter((v):v is number=>v!=null):[]};const people=(fk:string,lk:string)=>{const fc=m[fk],lc=m[lk];return [...new Set(list.map(r=>person(fc?r[fc]:null,lc?r[lc]:null)).filter(Boolean))]};const issues:string[]=[];
 const choose=(key:string)=>{const vals=numbers(key);const unique=[...new Set(vals.map(v=>v.toFixed(6)))];if(unique.length>1)issues.push(`Conflit ${key}`);return vals[0]??null};
 const dates=m.created?list.map(r=>date(r[m.created!])).filter((d):d is Date=>!!d):[];
 const states=m.status?[...new Set(list.map(r=>text(r[m.status!])).filter(Boolean))]:[];if(states.length>1)issues.push('Conflit de statut');
 tickets.push({id,createdAt:dates.length?new Date(Math.min(...dates.map(d=>d.getTime()))):null,status:states.at(-1)||'',nature:text(first('nature')),requestType:text(first('requestType')),agency:text(first('agency')),customer:text(first('customer')),activity:text(first('activity')),operators:people('opFirst','opLast'),technicians:people('techFirst','techLast'),handling:choose('handling'),response:choose('response'),resolution:choose('resolution'),duration:numbers('duration').reduce((a,b)=>a+b,0),sourceRows:list.length,issues});
 }
 return {tickets,rejected,headers,mapping:m};
}
export const avg=(a:(number|null)[])=>{const v=a.filter((x):x is number=>x!=null);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null};
export const median=(a:(number|null)[])=>{const v=a.filter((x):x is number=>x!=null).sort((a,b)=>a-b);if(!v.length)return null;const i=Math.floor(v.length/2);return v.length%2?v[i]:(v[i-1]+v[i])/2};
export const formatDuration=(h:number|null)=>{if(h==null)return 'N/D';const mins=Math.round(h*60);if(mins<60)return `${mins} min`;const d=Math.floor(mins/1440),hr=Math.floor((mins%1440)/60),mn=mins%60;return d?`${d} j ${hr} h ${mn} min`:`${hr} h ${mn} min`};
