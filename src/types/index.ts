export type RawRow=Record<string,unknown>;
export interface BaseRecord{createdAt:Date|null;status:string;uo:string;agency:string;customer:string;activity:string;operators:string[];technicians:string[];handling:number|null;response:number|null;resolution:number|null;duration:number;sourceRows:number;issues:string[]}
export interface Ticket extends BaseRecord{ticketId:string}
export interface Intervention extends BaseRecord{interventionId:string;ticketId:string}
export interface PersonMetric{name:string;count:number;handling:number|null;response:number|null;resolution:number|null;workload:number}
