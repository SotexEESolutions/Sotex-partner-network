import test from "node:test";
import assert from "node:assert/strict";

function score(input) {
  const bookkeeping=Boolean(input.bookkeeping||input.accounting);
  const cas=Boolean(input.cas||input.advisory);
  const recurring=bookkeeping||cas;
  const businessClients=Boolean(input.businessClients||input.smb||recurring);
  let fit=(input.smb?15:0)+(bookkeeping?10:0)+(input.businessTax?8:0)+(cas?10:0)+(input.idealClients?7:0)+(input.systems?5:0)+(input.targetIndustry?5:0);
  fit=Math.min(fit,60);
  let opportunity=0;
  if(input.payrollAbsent) opportunity=15+(recurring?5:0)+(input.local?5:0);
  else if(input.payrollOffered) opportunity=10+(input.payrollSecondary?5:0)+(recurring?5:0)+(input.smallLocal?5:0);
  opportunity=Math.min(opportunity,25);
  const readiness=Math.min((input.owner?5:0)+(input.verifiedEmail?5:0)+(input.directChannel?2:0)+(input.personalizable?3:0),15);
  const adjustments=(input.consumerTax?-15:0)+(input.franchise?-20:0)+(input.auditHeavy&&!cas?-10:0)+(input.wealthHeavy?-10:0)+(input.noBusinessClients?-10:0)+(input.inactive?-20:0)+(input.institutionalPayrollAdjustment||0);
  const total=Math.max(0,Math.min(100,fit+opportunity+readiness+adjustments));
  const grade=total>=90?"A+":total>=80?"A":total>=65?"B":total>=50?"C":"D";
  const topTarget=fit>=48&&opportunity>=18;
  const partnerType=total<50||input.consumerTax||input.auditHeavy&&!cas?"Low Fit":input.cpa&&input.smb&&fit>=48?"Strategic CPA Partner":input.payrollAbsent&&businessClients?"Referral Payroll Partner":input.payrollOffered&&recurring?"Wholesale Payroll Partner":input.bookkeeper&&bookkeeping?"Bookkeeping Partner":input.taxPractice&&input.businessTax?"Tax / EA Partner":"Needs Research";
  return {fit,opportunity,readiness,total,grade,topTarget,partnerType};
}

test("high-fit small CPA referral prospect is A+, Top Target, and independent of contact completeness",()=>{
  const result=score({cpa:true,smb:true,bookkeeping:true,businessTax:true,cas:true,idealClients:true,systems:true,targetIndustry:true,payrollAbsent:true,local:true,owner:true,verifiedEmail:true,personalizable:true});
  assert.deepEqual(result,{fit:60,opportunity:25,readiness:13,total:98,grade:"A+",topTarget:true,partnerType:"Strategic CPA Partner"});
});

test("bookkeeper without email keeps strong fit and opportunity while readiness stays lower",()=>{
  const result=score({bookkeeper:true,smb:true,bookkeeping:true,idealClients:true,systems:true,targetIndustry:true,payrollAbsent:true,local:true,owner:true,personalizable:true});
  assert.equal(result.fit,42); assert.equal(result.opportunity,25); assert.equal(result.readiness,8); assert.equal(result.total,75); assert.equal(result.grade,"B"); assert.equal(result.partnerType,"Referral Payroll Partner");
});

test("payroll offered creates a wholesale opportunity without a payroll penalty",()=>{
  const result=score({accounting:true,smb:true,bookkeeping:true,businessTax:true,idealClients:true,payrollOffered:true,payrollSecondary:true,smallLocal:true,owner:true,verifiedEmail:true,personalizable:true});
  assert.equal(result.opportunity,25); assert.equal(result.partnerType,"Wholesale Payroll Partner"); assert.equal(result.total,78); assert.equal(result.grade,"B");
});

test("audit-heavy practice receives a visible adjustment and is not a Top Target",()=>{
  const result=score({cpa:true,auditHeavy:true,personalizable:true});
  assert.equal(result.total,0); assert.equal(result.grade,"D"); assert.equal(result.topTarget,false); assert.equal(result.partnerType,"Low Fit");
});

test("individual-tax shop with explicit lack of business clients remains Low Fit",()=>{
  const result=score({taxPractice:true,consumerTax:true,noBusinessClients:true,personalizable:true});
  assert.equal(result.total,0); assert.equal(result.grade,"D"); assert.equal(result.partnerType,"Low Fit");
});

test("unknown payroll earns neither referral nor wholesale opportunity points",()=>{
  const result=score({cpa:true,smb:true,bookkeeping:true,cas:true,idealClients:true,systems:true,targetIndustry:true,owner:true});
  assert.equal(result.fit,52); assert.equal(result.opportunity,0); assert.equal(result.readiness,5); assert.equal(result.topTarget,false);
});
