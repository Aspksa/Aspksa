import {analyzeContractFile,type ContractReport} from './contracts';
import {obligations,deadlines,compareContracts,enhancedRisks,relatedClauses,jurisdictions,legalScope,sourceLabel} from './contract-intelligence';

export async function showContractAnalysis(file:File,host:HTMLElement,onAsk:(question:string)=>void){
 const panel=document.createElement('section');panel.className='contract-analysis';panel.setAttribute('aria-label','Анализ договора');
 panel.textContent='Анализ структуры и условий договора…';host.replaceChildren(panel);
 let report:ContractReport;
 try{report=await analyzeContractFile(file);}catch(e){panel.textContent='Не удалось проанализировать договор: '+String(e);return;}
 panel.replaceChildren();
 const el=(tag:string,cls:string,value:string)=>{const n=document.createElement(tag);n.className=cls;n.textContent=value;return n;};
 panel.append(el('h3','','Анализ договора · '+report.file),el('p','contract-muted','Предварительная проверка по тексту. Каждый вывод сверяй с оригиналом. Точные страницы пока не определяются.'));
 const summary=el('div','contract-summary','');panel.append(summary);
 for(const [name,values] of [['Стороны',report.parties],['Даты',report.dates],['Суммы',report.amounts]] as [string,string[]][])summary.append(el('p','',name+': '+(values.length?values.join(' · '):'не определены')));
 const tabs=el('div','contract-tabs','');const output=el('div','contract-content','');panel.append(tabs,output);
 const card=(title:string,body:string,clause?:string)=>{const item=el('article','contract-clause','');item.append(el('strong','',title),el('p','',body));if(clause)item.append(el('small','contract-muted',sourceLabel(report.file,clause)));output.append(item);};
 const obs=obligations(report),dates=deadlines(report);
 const sections:[string,()=>void][]=[
 ['Структура',()=>{for(const c of report.clauses)card('Пункт '+c.id+' · '+c.type,c.text.slice(0,950),c.id);}],
 ['Смысл',()=>{for(const o of obs)card(o.actor+' · '+o.confidence+' уверенность','Действие: '+o.action+'\nУсловие: '+o.condition+'\nСрок: '+o.deadline+'\nПоследствие: '+o.consequence,o.clause);if(!obs.length)card('Не выявлено','Формулировки могут отличаться от шаблонов.');}],
 ['Граф',()=>{for(const l of relatedClauses(report))card(l.from+' → '+l.to,l.reason,l.from);if(!relatedClauses(report).length)card('Связи не найдены','Нет распознанных связей.');}],
 ['Риски',()=>{for(const r of enhancedRisks(report))card(r.reason,r.evidence,r.clause);if(!enhancedRisks(report).length)card('Сигналов не обнаружено','Отсутствие сигналов не доказывает безопасность договора.');}],
 ['Версии',()=>{const hint=el('label','contract-muted','Выбери вторую редакцию договора (PDF, DOCX, TXT, MD):');const picker=document.createElement('input');picker.type='file';picker.accept='.pdf,.docx,.txt,.md';picker.setAttribute('aria-label','Вторая версия договора');output.append(hint,picker);picker.addEventListener('change',async()=>{const second=picker.files?.[0];if(!second)return;const result=el('div','','Сравниваю…');output.append(result);try{const next=await analyzeContractFile(second);const changes=compareContracts(report,next);result.textContent=changes.length?'Найдено изменений: '+changes.length:'Изменений в распознанных пунктах не найдено';for(const c of changes){const item=el('article','contract-clause','');item.append(el('strong','',c.kind+' · пункт '+c.id),el('p','','Было: '+(c.before||'—')+'\nСтало: '+(c.after||'—')));output.append(item);}}catch(e){result.textContent='Ошибка сравнения: '+String(e);}});}],
 ['Сроки',()=>{for(const d of dates)card('Пункт '+d.clause+' · '+(d.needsTrigger?'Требуется исходное событие':'Дата указана'),'Срок: '+(d.relative||d.date)+'\nКонтекст: '+d.event,d.clause);if(!dates.length)card('Сроки не распознаны','Проверь договор вручную.');}],
 ['Право',()=>{const select=document.createElement('select');select.setAttribute('aria-label','Применимое право');for(const country of jurisdictions){const option=document.createElement('option');option.value=country;option.textContent=country;select.append(option);}const info=el('p','contract-clause',legalScope(select.value));select.addEventListener('change',()=>{info.textContent=legalScope(select.value);});output.append(select,info,el('p','contract-muted','Актуальные тексты законов и судебная практика не подключены. Юридические выводы о соответствии закону не формируются.'));}],
 ['Вопросы AI',()=>{output.append(el('p','contract-muted','Вопрос заполняется в чате. Для передачи выдержек в Cloud.ru включи RAG и нажми отправить самостоятельно. AI должен указывать цитаты и пункты; страницы не подтверждены.'));for(const q of ['Извлеки обязательства, условия и последствия по договору «'+file.name+'» с точными цитатами и пунктами.','Какие риски и противоречия есть в договоре «'+file.name+'»? Укажи цитаты и не придумывай отсутствующие условия.','Какие сроки и события запускают обязательства по договору «'+file.name+'»?']){const b=el('button','contract-ask',q);b.addEventListener('click',()=>onAsk(q));output.append(b);}}]
 ];
 const selectTab=(index:number)=>{output.replaceChildren();tabs.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',i===index));sections[index][1]();};
 sections.forEach(([label],i)=>{const b=el('button','',label);b.addEventListener('click',()=>selectTab(i));tabs.append(b);});
 selectTab(0);
 for(const warning of report.warnings)panel.append(el('p','contract-muted',warning));
}
