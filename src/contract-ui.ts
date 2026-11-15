import { analyzeContractFile, type ContractReport } from './contracts';
export async function showContractAnalysis(file:File,host:HTMLElement,onAsk:(question:string)=>void){
 const panel=document.createElement('section');panel.className='contract-analysis';panel.setAttribute('aria-label','Анализ договора');
 panel.textContent='Анализ структуры и условий договора…';host.replaceChildren(panel);
 let report:ContractReport;
 try{report=await analyzeContractFile(file);}catch(e){panel.textContent='Не удалось проанализировать договор: '+String(e);return;}
 panel.replaceChildren();
 const el=(tag:string,cls:string,value:string)=>{const n=document.createElement(tag);n.className=cls;n.textContent=value;return n;};
 panel.append(el('h3','','Анализ договора · '+report.file),el('p','contract-muted','Предварительный автоматический разбор. Риски — сигналы для проверки, а не вывод о незаконности.'));
 const summary=el('div','contract-summary','');panel.append(summary);
 for(const [name,values] of [['Стороны',report.parties],['Даты',report.dates],['Суммы',report.amounts]] as [string,string[]][])summary.append(el('p','',name+': '+(values.length?values.join(' · '):'не определены')));
 const tabs=el('div','contract-tabs','');const output=el('div','contract-content','');panel.append(tabs,output);
 const sections:[string,()=>void][]=[
 ['Условия',()=>{for(const c of report.clauses){const item=el('article','contract-clause','');item.append(el('strong','',c.id+' · '+c.type),el('p','',c.text.slice(0,950)));output.append(item);}}],
 ['Обязательства',()=>{const list=report.clauses.filter(c=>/обязу|обязан|должен|вправе|оплат|переда[её]т|предоставля/i.test(c.text));for(const c of list)output.append(el('p','contract-clause',c.id+': '+c.text.slice(0,700)));if(!list.length)output.append(el('p','','Не выявлены по шаблонам.'))}],
 ['Риски',()=>{for(const r of report.risks){const item=el('article','contract-clause','');item.append(el('strong','',r.reason+' · п. '+r.id),el('p','',r.clause.text.slice(0,700)));output.append(item);}if(!report.risks.length)output.append(el('p','','По текущим правилам сигналы не найдены. Это не означает отсутствие рисков.'));}],
 ['Связи',()=>{for(const l of report.links)output.append(el('p','contract-clause',l.from+' → '+l.to+' · '+l.reason));if(!report.links.length)output.append(el('p','','Явные ссылки между пунктами не найдены.'));}],
 ['Вопросы AI',()=>{const note=el('p','contract-muted','Для ответа по тексту договора включи RAG в чате. Не все фрагменты могут попасть в контекст модели.');output.append(note);for(const q of ['Какие обязательства сторон по договору «'+file.name+'»?','Какие риски и штрафы в договоре «'+file.name+'»?','Каковы условия расторжения договора «'+file.name+'»?']){const b=el('button','contract-ask',q);b.addEventListener('click',()=>onAsk(q));output.append(b);}}]
 ];
 const select=(index:number)=>{output.replaceChildren();tabs.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',i===index));sections[index][1]();};
 sections.forEach(([label],i)=>{const b=el('button','',label);b.addEventListener('click',()=>select(i));tabs.append(b);});
 select(0);
 for(const warning of report.warnings)panel.append(el('p','contract-muted',warning));
}
