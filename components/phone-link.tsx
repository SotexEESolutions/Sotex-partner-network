"use client";

import { Phone } from "lucide-react";

export function PhoneLink({phone,prefix,className=""}:{phone:string;prefix?:string;className?:string}){
  const dialable=phone.trim().replace(/[^\d+]/g,"");
  if(!dialable)return null;
  return <a className={`phone-link ${className}`.trim()} href={`tel:${dialable}`} aria-label={`Call ${phone}`} title={`Call ${phone}`} onClick={event=>event.stopPropagation()}><Phone size={14}/><span>{prefix?`${prefix}: `:""}{phone}</span></a>;
}
