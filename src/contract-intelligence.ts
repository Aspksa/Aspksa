import type {Clause,ContractReport} from './contracts';
export type Obligation={clause:string;actor:string;action:string;condition:string;deadline:string;consequence:string;evidence:string;confidence:'низкая'|'средняя'};
export type Deadline={clause:string;event:string;relative:string;date:string;needsTrigger:boolean};
export type Change={id:string;kind:'добавлен'|'удалён'|'изменён';before:string;after:string};
const sample=(s:string)=>s.replace(/\s+/g,' ').slice(0,500);
export function obligations(report:ContractReport):Obligation[]{
 const result:Obligation[]=[];
 for(const clause of report.clauses){
  const sentences=clause.text.split(/(?<=[.!?;])\s+/).slice(0,80);
  for(const sentence of sentences){
   if(!/обязан|обязуется|должен|должна|необходимо|вправе|уплачивает|оплачивает|предоставляет|переда[её]т|поставляет/i.test(sentence))continue;
   const actor=sentence.match(/(?:заказчик|исполнитель|покупатель|продавец|поставщик|арендатор|арендодатель|подрядчик|сторона|клиент)/i)?.[0]||'Сторона не определена';
   const deadline=sentence.match(/(?:в течение|не позднее|до истечения|через)\s+[^,.;]{3,90}|\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/i)?.[0]||'Не указан в этом предложении';
   const condition=sentence.match(/(?:после|при условии|с момента|в случае|при наступлении)\s+[^,.;]{4,120}/i)?.[0]||'Не определено';
   const consequence=sentence.match(/(?:иначе|в противном случае|за нарушение|при просрочке|неустойк|штраф|пен[ия])[^.;]{0,110}/i)?.[0]||'Не указано';
   result.push({clause:clause.id,actor,action:sample(sentence),condition,deadline,consequence,evidence:sample(sentence),confidence:actor==='Сторона не определена'?'низкая':'средняя'});
   if(result.length>=120)return result;
  }
 }
 return result;
}
export function deadlines(report:ContractReport):Deadline[]{
 const result:Deadline[]=[];
 for(const c of report.clauses){
  for(const m of c.text.matchAll(/(?:в течение|не позднее|через|до)\s+(?:\d{1,3}|[а-яё]+)\s+(?:рабочих\s+|календарных\s+)?(?:дн(?:я|ей|ь)|месяц(?:а|ев)?|недел(?:ь|и)|лет|год(?:а)?)\b[^.;\n]{0,110}|\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/gi)){
   const event=sample(c.text.slice(Math.max(0,m.index-100),Math.min(c.text.length,m.index+m[0].length+80)));
   const absolute=/^\d{1,2}[./-]/.test(m[0]);
   result.push({clause:c.id,event,relative:absolute?'':m[0],date:absolute?m[0]:'Не вычислена',needsTrigger:!absolute});
   if(result.length>=100)return result;
  }
 }
 return result;
}
export function compareContracts(before:ContractReport,after:ContractReport):Change[]{
 const a=new Map(before.clauses.map(c=>[c.id,c.text.replace(/\s+/g,' ').trim()]));
 const b=new Map(after.clauses.map(c=>[c.id,c.text.replace(/\s+/g,' ').trim()]));
 const changes:Change[]=[];
 for(const [id,text] of a){const next=b.get(id);if(next===undefined)changes.push({id,kind:'удалён',before:sample(text),after:''});else if(text!==next)changes.push({id,kind:'изменён',before:sample(text),after:sample(next)});}
 for(const [id,text] of b)if(!a.has(id))changes.push({id,kind:'добавлен',before:'',after:sample(text)});
 return changes.slice(0,150);
}
export function enhancedRisks(report:ContractReport):{clause:string;reason:string;evidence:string}[]{
 const risks=report.risks.map(r=>({clause:r.id,reason:r.reason,evidence:sample(r.clause.text)}));
 for(const o of obligations(report)){
  if(o.deadline==='Не указан в этом предложении'&&/оплат|постав|переда|предостав/i.test(o.action))risks.push({clause:o.clause,reason:'В предложении с обязательством не обнаружен срок исполнения',evidence:o.evidence});
  if(o.actor==='Сторона не определена')risks.push({clause:o.clause,reason:'Неоднозначно определена обязанная сторона',evidence:o.evidence});
 }
 return risks.slice(0,100);
}
export function relatedClauses(report:ContractReport):{from:string;to:string;reason:string}[]{
 const links=[...report.links];const groups=new Map<string,Clause[]>();
 for(const c of report.clauses){const list=groups.get(c.type)||[];list.push(c);groups.set(c.type,list);}
 for(const [type,list] of groups){if(type==='Прочее')continue;for(let i=1;i<Math.min(list.length,25);i++)links.push({from:list[i-1].id,to:list[i].id,reason:'Общая тема: '+type});}
 return links.slice(0,150);
}
export const jurisdictions=['Не выбрана','Россия','Казахстан','Другая страна'] as const;
export function legalScope(country:string){
 return country==='Не выбрана'?'Юрисдикция не выбрана. Нельзя проверять соответствие законам.':
 'Выбрана юрисдикция: '+country+'. Проверка соответствия законам не выполняется без подключённой актуальной нормативной базы и датированных первоисточников. Используй этот раздел как список вопросов для юриста, а не заключение.';
}
export function sourceLabel(file:string,clause:string){return file+' · пункт '+clause+' · страница не установлена';}
