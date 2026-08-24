export type RawRow=Record<string,unknown>;
export interface Ticket{id:string;createdAt:Date|null;status:string;nature:string;requestType:string;agency:string;uo:string;customer:string;activity:string;operators:string[];technicians:string[];handling:number|null;response:number|null;resolution:number|null;duration:number;sourceRows:number;issues:string[]}
export interface PersonMetrics{name:string;tickets:number;handling:number|null;response:number|null;resolution:number|null;resolvedTickets:number}
