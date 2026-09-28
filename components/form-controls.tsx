"use client";
/* eslint-disable jsx-a11y/no-static-element-interactions */
import { ChevronDown, X } from "lucide-react";

type SelectOption=string|{value:string;label:string};
export function Select({id,value,onChange,options,disabled=false}:{id?:string;value:string;onChange:(x:string)=>void;options:SelectOption[];disabled?:boolean}){return <label className="select"><select id={id} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}>{options.map(option=>{const normalized=typeof option==="string"?{value:option,label:option[0].toUpperCase()+option.slice(1)}:option;return <option key={normalized.value} value={normalized.value}>{normalized.label}</option>})}</select><ChevronDown size={14}/></label>}
export function Modal({title,subtitle,close,children}:{title:string;subtitle:string;close:()=>void;children:React.ReactNode}){return <div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)close()}}><div className="modal"><div className="modal-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button" className="icon-btn" onClick={close}><X size={19}/></button></div>{children}</div></div>}
export function Field({label,value,set,type="text"}:{label:string;value:string;set:(x:string)=>void;type?:string}){return <label><span>{label}</span><input type={type} value={value} onChange={e=>set(e.target.value)} placeholder={`Enter ${label.toLowerCase()}`}/></label>}
