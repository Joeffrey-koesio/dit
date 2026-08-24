export type RawRow = Record<string, unknown>;
export interface Ticket {
  id:string; createdAt:Date|null; status:string; nature:string; requestType:string; agency:string;
  customer:string; activity:string; operators:string[]; technicians:string[];
  handling:number|null; response:number|null; resolution:number|null; duration:number;
  sourceRows:number; issues:string[];
}
export interface ImportStats { rows:number; tickets:number; grouped:number; rejected:number; issues:number }
