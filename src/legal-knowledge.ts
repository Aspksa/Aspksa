export type KnowledgeKind='template'|'mistake'|'standard';
export type KnowledgeEntry={id:string;kind:KnowledgeKind;title:string;body:string;approved:boolean;createdAt:string};
const KEY='aspksa-legal-knowledge-v1',MAX=100;
export const knowledgeKinds:{id:KnowledgeKind;label:string}[]=[{id:'template',label:'Шаблон договора'},{id:'mistake',label:'Типовая ошибка'},{id:'standard',label:'Правило предприятия'}];
export function legalKnowledge():KnowledgeEntry[]{
 try{const data:unknown=JSON.parse(localStorage.getItem(KEY)||'[]');
 if(!Array.isArray(data))return [];
 return data.filter((x):x is KnowledgeEntry=>!!x&&typeof x==='object'&&typeof x.id==='string'&&typeof x.title==='string'&&typeof x.body==='string'&&typeof x.approved==='boolean'&&['template','mistake','standard'].includes(x.kind)).slice(-MAX);
 }catch{return [];}
}
function save(items:KnowledgeEntry[]){localStorage.setItem(KEY,JSON.stringify(items.slice(-MAX)));}
export function addLegalKnowledge(kind:KnowledgeKind,title:string,body:string):KnowledgeEntry{
 const name=title.trim(),text=body.trim();
 if(!name||!text||name.length>160||text.length>12000)throw Error('Название (до 160) и текст (до 12000 символов) обязательны');
 const entry:KnowledgeEntry={id:crypto.randomUUID(),kind,title:name,body:text,approved:false,createdAt:new Date().toISOString()};
 save([...legalKnowledge(),entry]);return entry;
}
export function approveLegalKnowledge(id:string){save(legalKnowledge().map(e=>e.id===id?{...e,approved:true}:e));}
export function removeLegalKnowledge(id:string){save(legalKnowledge().filter(e=>e.id!==id));}
export function clearLegalKnowledge(){localStorage.removeItem(KEY);}
const terms=(s:string)=>new Set(s.toLocaleLowerCase('ru').match(/[\p{L}\p{N}]{4,}/gu)||[]);
export function recallLegalKnowledge(question:string,limit=4):KnowledgeEntry[]{
 const q=terms(question);
 return legalKnowledge().filter(e=>e.approved).map(e=>({entry:e,score:[...q].filter(t=>terms(e.title+' '+e.body.slice(0,800)).has(t)).length}))
 .filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.entry);
}
export function legalKnowledgeStats(){const all=legalKnowledge();return {approved:all.filter(e=>e.approved).length,pending:all.filter(e=>!e.approved).length};}
