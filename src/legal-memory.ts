import type {LegalRole,LegalTask} from './legal-agents';
export type Lesson={id:string;createdAt:string;task:LegalTask;question:string;summary:string;sourcePaths:string[];approved:boolean;feedback:string;roles:LegalRole[]};
const KEY='aspksa-legal-lessons-v1',MAX=60;
export function legalMemory():Lesson[]{
 try{const raw=JSON.parse(localStorage.getItem(KEY)||'[]') as unknown;
 if(!Array.isArray(raw))return [];
 return raw.filter((x):x is Lesson=>!!x&&typeof x==='object'&&typeof x.id==='string'&&typeof x.summary==='string'&&typeof x.question==='string'&&typeof x.approved==='boolean'&&Array.isArray(x.sourcePaths)).slice(-MAX);
 }catch{return [];}
}
function save(items:Lesson[]){localStorage.setItem(KEY,JSON.stringify(items.slice(-MAX)));}
export function rememberLegalCase(task:LegalTask,question:string,summary:string,sourcePaths:string[]):Lesson{
 const lesson:Lesson={id:crypto.randomUUID(),createdAt:new Date().toISOString(),task,question:question.slice(0,350),summary:summary.slice(0,2500),sourcePaths:sourcePaths.slice(0,4),approved:false,feedback:'',roles:['lawyer-drafter','lawyer-reviewer','deputy','chief']};
 save([...legalMemory(),lesson]);return lesson;
}
export function approveLegalCase(id:string,feedback:string){
 save(legalMemory().map(l=>l.id===id?{...l,approved:true,feedback:feedback.slice(0,500)}:l));
}
export function deleteLegalCase(id:string){save(legalMemory().filter(l=>l.id!==id));}
export function clearLegalMemory(){localStorage.removeItem(KEY);}
const terms=(s:string)=>new Set(s.toLocaleLowerCase('ru').match(/[\p{L}\p{N}]{4,}/gu)||[]);
export function recallLegalCases(question:string,limit=3):Lesson[]{
 const q=terms(question);
 return legalMemory().filter(l=>l.approved).map(l=>({lesson:l,score:[...q].filter(t=>terms(l.question+' '+l.feedback).has(t)).length}))
 .filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.lesson);
}
export function legalMemorySummary(){const all=legalMemory();return {total:all.length,approved:all.filter(l=>l.approved).length,pending:all.filter(l=>!l.approved).length};}
