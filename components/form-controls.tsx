"use client";
/* eslint-disable jsx-a11y/no-static-element-interactions */
import { ChevronDown, X } from "lucide-react";

export function Select({id,value,onChange,options}:{id?:string;value:string;onChange:(x:string)=>void;options:string[]}){return <label className="select"><select id={id} value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o} value={o}>{o[0].toUpperCase()+o.slice(1)}</option>)}</select><ChevronDown size={14}/></label>}
export function Modal({title,subtitle,close,children}:{title:string;subtitle:string;close:()=>void;children:React.ReactNode}){return <div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)close()}}><div className="modal"><div className="modal-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button" className="icon-btn" onClick={close}><X size={19}/></button></div>{children}</div></div>}
export function Field({label,value,set,type="text"}:{label:string;value:string;set:(x:string)=>void;type?:string}){return <label><span>{label}</span><input type={type} value={value} onChange={e=>set(e.target.value)} placeholder={`Enter ${label.toLowerCase()}`}/></label>}
