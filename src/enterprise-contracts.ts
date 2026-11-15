import type {ContractReport} from './contracts';
export type EnterpriseRule={id:string;title:string;required:string;forbidden:string;scope:string};
export type EnterpriseProfile={name:string;rules:EnterpriseRule[]};
export type EnterpriseFinding={rule:EnterpriseRule;status:'не найдено'|'запрещено'|'найдено';clause:string;excerpt:string};
const KEY='aspksa-enterprise-contract-profile-v1';
const clean=(v:unknown,max=250)=>typeof v==='string'?v.trim().slice(0,max):'';
export function validateProfile(v:unknown):EnterpriseProfile{
 if(!v||typeof v!=='object')throw Error('Неверный формат профиля');
 const obj=v as Record<string,unknown>;
 if(!Array.isArray(obj.rules)||obj.rules.length>100)throw Error('Нужно указать массив rules (до 100 правил)');
 const rules=obj.rules.map((r:unknown,i:number)=>{if(!r||typeof r!=='object')throw Error('Некорректное правило '+(i+1));const x=r as Record<string,unknown>;
 const rule={id:clean(x.id,60)||String(i+1),title:clean(x.title)||'Правило '+(i+1),required:clean(x.required,500),forbidden:clean(x.forbidden,500),scope:clean(x.scope,100)};
 if(!rule.required&&!rule.forbidden)throw Error('У правила '+rule.id+' нет required или forbidden');
 return rule;});
 return {name:clean(obj.name)||'Стандарт предприятия',rules};
}
export function readProfile():EnterpriseProfile|null{
 try{const raw=localStorage.getItem(KEY);return raw?validateProfile(JSON.parse(raw)):null;}catch{return null;}
}
export function saveProfile(profile:EnterpriseProfile){localStorage.setItem(KEY,JSON.stringify(validateProfile(profile)));}
export function clearProfile(){localStorage.removeItem(KEY);}
export function checkEnterprise(report:ContractReport,profile:EnterpriseProfile):EnterpriseFinding[]{
 const clauses=report.clauses;
 const results:EnterpriseFinding[]=[];
 for(const rule of profile.rules){
  const candidates=rule.scope?clauses.filter(c=>c.type.toLocaleLowerCase('ru').includes(rule.scope.toLocaleLowerCase('ru'))):clauses;
  const required=rule.required.toLocaleLowerCase('ru');
  const forbidden=rule.forbidden.toLocaleLowerCase('ru');
  const hitForbidden=forbidden?candidates.find(c=>c.text.toLocaleLowerCase('ru').includes(forbidden)):undefined;
  const hitRequired=required?candidates.find(c=>c.text.toLocaleLowerCase('ru').includes(required)):undefined;
  if(hitForbidden)results.push({rule,status:'запрещено',clause:hitForbidden.id,excerpt:hitForbidden.text.slice(0,400)});
  else if(required&&!hitRequired)results.push({rule,status:'не найдено',clause:'',excerpt:'Точная формулировка не обнаружена; возможен смысловой эквивалент.'});
  else results.push({rule,status:'найдено',clause:hitRequired?.id||'',excerpt:hitRequired?.text.slice(0,400)||'Запрещённая формулировка не найдена.'});
 }
 return results;
}
export function classifyContract(report:ContractReport):{type:string;evidence:string}[]{
 const types:[string,RegExp][]=[
 ['Поставка',/договор поставки|поставщик обязуется|поставка товара/i],
 ['Купля-продажа',/договор купли-продажи|продавец обязуется передать/i],
 ['Подряд',/договор подряда|подрядчик обязуется выполнить/i],
 ['Возмездные услуги',/оказани[ея] услуг|исполнитель обязуется оказать/i],
 ['Аренда',/договор аренды|арендодатель обязуется/i],
 ['Трудовой',/трудовой договор|работодатель обязуется/i],
 ['Заём / кредит',/договор займа|кредитный договор|заимодавец/i],
 ['Агентский',/агентский договор|агент обязуется/i],
 ['Перевозка',/договор перевозки|перевозчик обязуется/i],
 ['Страхование',/договор страхования|страховщик обязуется/i],
 ['Лицензионный',/лицензионный договор|лицензиар предоставляет/i],
 ['Хранение',/договор хранения|хранитель обязуется/i]
 ];
 const text=report.clauses.slice(0,30).map(c=>c.text).join(' ').slice(0,40000);
 return types.filter(([,re])=>re.test(text)).map(([type,re])=>({type,evidence:text.match(re)?.[0]||''}));
}
export const russianLawNotes:Record<string,string>={
 'Трудовой':'ТК РФ: проверить обязательные условия трудового договора и специальные гарантии по актуальной редакции.',
 'Поставка':'ГК РФ: проверить условия поставки, сроки, качество, приёмку и ответственность.',
 'Купля-продажа':'ГК РФ: проверить предмет, передачу, качество, оплату и ответственность.',
 'Подряд':'ГК РФ: проверить результат работ, сроки, приёмку и ответственность.',
 'Возмездные услуги':'ГК РФ: проверить предмет услуг, оплату, отказ от договора и ответственность.',
 'Аренда':'ГК РФ: проверить объект, срок, плату, использование и возврат.',
 'Заём / кредит':'ГК РФ и специальные законы: проверить сумму, проценты, возврат и статус сторон.',
 'Агентский':'ГК РФ: проверить полномочия агента, отчёты и вознаграждение.',
 'Перевозка':'ГК РФ и транспортные уставы: проверить ответственность, сроки и документы.',
 'Страхование':'ГК РФ и специальное регулирование: проверить страховой случай, исключения и выплату.',
 'Лицензионный':'ГК РФ (интеллектуальные права): проверить объект, способы использования, территорию и срок.',
 'Хранение':'ГК РФ: проверить предмет, условия хранения, возврат и ответственность.'
};
