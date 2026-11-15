import { extractFileText } from './rag-extract';

export type Clause={id:string;title:string;text:string;type:string;flags:string[]};
export type ContractReport={file:string;clauses:Clause[];parties:string[];dates:string[];amounts:string[];risks:{id:string;reason:string;clause:Clause}[];links:{from:string;to:string;reason:string}[];warnings:string[]};
const patterns:[string,RegExp][]=[
 ['Оплата',/оплат|платеж|стоимост|цен[аы]|расчет|расчёт/i],
 ['Сроки',/срок|дней|месяц|год|дата|действу/i],
 ['Ответственность',/штраф|пен[ия]|неустойк|ответственност|убытк/i],
 ['Расторжение',/расторж|прекращени|отказ от исполнени/i],
 ['Обязательства',/обязу|обязан|должен|вправе|предоставля|переда[её]т/i],
 ['Споры',/суд|арбитраж|претензи|подсудност/i],
 ['Конфиденциальность',/конфиденциальн|персональн|тайн/i]
];
const riskRules:[RegExp,string][]=[
 [/односторонн.{0,80}(измен|порядк|расторж|цен)/i,'Возможность одностороннего изменения или прекращения условий'],
 [/без ограничени.{0,35}ответственност|неограниченн.{0,30}ответственност/i,'Потенциально неограниченная ответственность'],
 [/автоматическ.{0,45}(продлен|пролонгац)|продлевается автоматически/i,'Автоматическое продление'],
 [/штраф|неустойк|пен[ия]/i,'Проверь размер и условия начисления санкций'],
 [/не подлежит возврату|невозвратн/i,'Ограничение возврата средств'],
 [/в любое время.{0,80}(измен|отказ|расторг)/i,'Широкое право изменить или прекратить договор']
];
const unique=(xs:string[],max:number)=>[...new Set(xs)].slice(0,max);
export function analyzeContractText(raw:string,file:string):ContractReport{
 const source=raw.replace(/\r/g,'').slice(0,350000);
 const lines=source.split(/\n+/).map(x=>x.trim()).filter(Boolean);
 const clauses:Clause[]=[];let active:Clause|null=null;
 for(const line of lines){
  const match=line.match(/^(?:пункт\s*)?(\d+(?:\.\d+){0,4})[.)]?\s+(.+)/i);
  if(match){active={id:match[1],title:match[2].slice(0,100),text:line,type:'Прочее',flags:[]};clauses.push(active);}
  else if(active)active.text+='\n'+line;
  else {active={id:'Введение',title:'Введение и преамбула',text:line,type:'Прочее',flags:[]};clauses.push(active);}
  if(clauses.length>=250)break;
 }
 for(const c of clauses){
  c.text=c.text.slice(0,12000);
  c.type=patterns.find(([,p])=>p.test(c.text))?.[0]||'Прочее';
 }
 const risks=clauses.flatMap(clause=>riskRules.filter(([pattern])=>pattern.test(clause.text)).map(([,reason])=>({id:clause.id,reason,clause}))).slice(0,70);
 for(const r of risks)r.clause.flags.push(r.reason);
 const dates=unique(source.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g)||[],40);
 const amounts=unique(source.match(/\b\d[\d\s]{0,16}(?:[.,]\d{1,2})?\s*(?:руб(?:лей|ля|ль|\.)?|₽|тенге|₸|евро|EUR|USD|доллар(?:ов|а)?)\b/gi)||[],40);
 const parties=unique(lines.slice(0,35).flatMap(l=>[...l.matchAll(/(?:ООО|АО|ИП|ТОО|ЗАО|ПАО)\s*[«"][^»"]+[»"]/g)].map(m=>m[0])),20);
 const links:{from:string;to:string;reason:string}[]=[];
 const ids=new Map(clauses.map(c=>[c.id,c]));
 for(const c of clauses){for(const match of c.text.matchAll(/(?:п\.|пункт(?:а|е|ом)?|раздел(?:а|е)?)\s*(\d+(?:\.\d+){1,4})/gi)){const target=match[1];if(ids.has(target)&&target!==c.id&&!links.some(l=>l.from===c.id&&l.to===target))links.push({from:c.id,to:target,reason:'Ссылка на пункт'});if(links.length>=100)break;}}
 const warnings=['Автоматический предварительный анализ, не юридическое заключение. Проверь оригинал и применимое право.'];
 if(!clauses.some(c=>/\d/.test(c.id)))warnings.push('Нумерация пунктов не распознана; ссылки могут быть неточными.');
 if(source.length>=350000)warnings.push('Проанализированы только первые 350 000 символов.');
 if(!parties.length)warnings.push('Стороны не определены автоматически; проверь преамбулу.');
 return {file,clauses,parties,dates,amounts,risks,links,warnings};
}
export async function analyzeContractFile(file:File):Promise<ContractReport>{
 if(file.size>8_000_000)throw Error('Договор превышает лимит 8 МБ');
 if(!/\.(pdf|docx|txt|md)$/i.test(file.name))throw Error('Поддерживаются PDF, DOCX, TXT, MD');
 const raw=await extractFileText(file);
 if(!raw.trim())throw Error('Не удалось извлечь текст договора');
 return analyzeContractText(raw,file.name);
}
