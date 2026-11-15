import {recallLegalCases} from './legal-memory';
export type LegalTask='draft'|'review'|'revise'|'disagreements';
export type LegalRole='lawyer-drafter'|'lawyer-reviewer'|'deputy'|'chief';
export const legalRoles:{id:LegalRole;name:string;task:string}[]=[
 {id:'lawyer-drafter',name:'Юрист 1',task:'Подготовка проекта и формулировок'},
 {id:'lawyer-reviewer',name:'Юрист 2',task:'Независимая проверка и замечания'},
 {id:'deputy',name:'Заместитель начальника',task:'Контроль рисков и корпоративных требований'},
 {id:'chief',name:'Начальник управления',task:'Итоговый проект и рекомендации'}
];
export const legalTasks:{id:LegalTask;label:string;prompt:string}[]=[
 {id:'draft',label:'Написать договор',prompt:'Подготовь проект договора РФ. Уточни неизвестные существенные условия и не выдумывай реквизиты.'},
 {id:'review',label:'Проверить договор',prompt:'Проверь договор, обязательства, риски и отклонения от условий предприятия с подтверждениями.'},
 {id:'revise',label:'Изменить договор',prompt:'Предложи редакцию пунктов договора с указанием оснований и различий.'},
 {id:'disagreements',label:'Протокол разногласий',prompt:'Подготовь проект протокола разногласий с исходной и предлагаемой редакциями.'}
];
export type LegalStage='ожидает'|'работает'|'готово'|'ошибка';
export type LegalAgentState={role:LegalRole;status:LegalStage;result:string};
export type LegalResult={stages:LegalAgentState[];final:string};
type Context={path:string;excerpt:string};
export async function runLegalDepartment(task:LegalTask,question:string,context:Context[],onUpdate:(stages:LegalAgentState[])=>void):Promise<LegalResult>{
 const stages:LegalAgentState[]=legalRoles.map(r=>({role:r.id,status:'ожидает',result:''}));
 const emit=()=>onUpdate(stages.map(s=>({...s})));
 const prior:string[]=[];
 const memory=recallLegalCases(question).map(l=>'Проверенный пользователем опыт от '+l.createdAt.slice(0,10)+': '+l.summary.slice(0,900)+'; замечание: '+l.feedback.slice(0,250)+'; исходные файлы: '+l.sourcePaths.join(', '));
 for(let i=0;i<legalRoles.length;i++){
  stages[i].status='работает';emit();
  const role=legalRoles[i];
  const brief=legalTasks.find(t=>t.id===task)!.prompt;
  const prompt=[brief,'Запрос пользователя: '+question,'Общий опыт юридического управления (одобрен пользователем; это НЕ нормы права и НЕ доказательства по текущему делу):',...memory,'Результаты предыдущих сотрудников (проверяй критически, это не доказательства):',...prior].join('\n\n').slice(0,11000);
  try{
   const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({legalRole:role.id,messages:[{role:'user',content:prompt}],context})});
   const payload:unknown=await response.json();
   if(!response.ok||!payload||typeof payload!=='object'||!('reply' in payload)||typeof payload.reply!=='string')throw Error(payload&&typeof payload==='object'&&'error' in payload?String(payload.error):'Ошибка ответа агента');
   stages[i].result=payload.reply;stages[i].status='готово';
   prior.push(role.name+': '+payload.reply.slice(0,2600));
  }catch(e){stages[i].status='ошибка';stages[i].result=String(e);emit();throw Error(role.name+': '+String(e));}
  emit();
 }
 return {stages,final:stages[3].result};
}
