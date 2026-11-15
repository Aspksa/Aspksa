import type {IndexedDocument,DocumentLink} from './rag-memory';
export type Fact={kind:'инн'|'договор'|'дата'|'сумма'|'сторона';value:string;excerpt:string;offset:number};
export type Version={path:string;modified:number;version:string;date:string;explicitDate:boolean};
export type Evidence={path:string;excerpt:string;score:number;locator:string;facts:Fact[]};
const normalize=(s:string)=>s.replace(/\s+/g,' ').trim();
export function factsFromText(text:string):Fact[]{
 const patterns:[Fact['kind'],RegExp][]=[
 ['инн',/\bИНН\s*[:№]?\s*(?:\d{10}|\d{12})\b/gi],
 ['договор',/(?:договор|контракт)\s*(?:№|N|номер)\s*[А-ЯA-Z0-9\-/]{2,35}/gi],
 ['дата',/\b(?:0?[1-9]|[12]\d|3[01])[./-](?:0?[1-9]|1[0-2])[./-](?:19|20)\d{2}\b/g],
 ['сумма',/\b\d[\d\s]{0,16}(?:[.,]\d{1,2})?\s*(?:руб(?:лей|ля|ль|\.)?|₽|EUR|USD|₸)\b/gi],
 ['сторона',/(?:ООО|АО|ПАО|ИП|ТОО)\s*[«"][^»"]{2,100}[»"]/gi]
 ];
 const result:Fact[]=[];for(const [kind,re] of patterns)for(const m of text.matchAll(re)){
  result.push({kind,value:normalize(m[0]),excerpt:normalize(text.slice(Math.max(0,m.index-75),Math.min(text.length,m.index+m[0].length+75))),offset:m.index});
  if(result.length>=160)return result.sort((a,b)=>a.offset-b.offset);
 }return result.sort((a,b)=>a.offset-b.offset);
}
export function detectVersions(items:IndexedDocument[]):{group:string;versions:Version[]}[]{
 const groups=new Map<string,Version[]>();
 for(const d of items){
  const base=d.path.split('/').pop()!.replace(/\.[^.]+$/,'').toLocaleLowerCase('ru')
   .replace(/(?:[_\s-]*(?:редакция|версия|version|rev|v)\s*\d+(?:[._-]\d+)*|[_\s-]*(?:от\s*)?\d{2}[._-]\d{2}[._-]\d{4})/gi,'').replace(/[_\s-]+/g,' ').trim();
  if(base.length<5)continue;
  const date=d.path.match(/(?:от\s*)?(\d{2})[._-](\d{2})[._-](\d{4})/);
  const valid=date?new Date(Number(date[3]),Number(date[2])-1,Number(date[1])):null;
  const explicit=Boolean(valid&&valid.getFullYear()===Number(date![3])&&valid.getMonth()===Number(date![2])-1&&valid.getDate()===Number(date![1]));
  const version={path:d.path,modified:d.modified,version:d.version,date:explicit?date![3]+'-'+date![2]+'-'+date![1]:'не установлена',explicitDate:explicit};
  groups.set(base,[...(groups.get(base)||[]),version]);
 }
 return [...groups].filter(([,v])=>v.length>1).map(([group,versions])=>({group,versions:versions.sort((a,b)=>a.modified-b.modified)})).slice(0,100);
}
export function evidenceLocator(text:string,excerpt:string):string{
 const pos=text.indexOf(excerpt);if(pos<0)return 'фрагмент без точной позиции';
 const line=text.slice(0,pos).split('\n').length;
 const page=text.slice(0,pos).match(/\[page\s+\d+\]/gi)?.pop();
 return (page?page+', ':'')+'строка извлечённого текста '+line;
}
export function rerank(query:string,items:Evidence[],links:DocumentLink[]):Evidence[]{
 const words=[...new Set(query.toLocaleLowerCase('ru').match(/[\p{L}\p{N}]{3,}/gu)||[])];
 const numbers=[...new Set(query.match(/\d{4,}/g)||[])];
 return items.map(item=>{
  const low=item.excerpt.toLocaleLowerCase('ru');
  const exact=numbers.reduce((sum,n)=>sum+(low.includes(n)?5:0),0);
  const coverage=words.length?words.filter(w=>low.includes(w)).length/words.length:0;
  const neighbors=links.filter(l=>l.from===item.path||l.to===item.path).length;
  return {...item,score:item.score+exact+coverage*4+Math.min(neighbors,5)*0.1};
 }).sort((a,b)=>b.score-a.score);
}
export function planQuestion(question:string):string[]{
 const q=question.toLocaleLowerCase('ru');
 const steps=['Найти исходный документ по вопросу и его реквизиты'];
 if(/договор|контракт|соглашен|постав|услуг|аренд/i.test(q))steps.push('Проверить связанные приложения, спецификации и редакции');
 if(/оплат|сч[её]т|долг|плат[её]ж|ден[её]г/i.test(q))steps.push('Найти счета, платёжные документы и суммы');
 if(/выполн|акт|при[её]м|закрыт|срок|просроч/i.test(q))steps.push('Сопоставить акты, даты и подтверждения исполнения');
 steps.push('Сверить независимые свидетельства, перечислить пробелы и сослаться на источники');
 return steps;
}
