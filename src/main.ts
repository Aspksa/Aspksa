import './style.css';
import { openDocuments, openDiskSource } from './documents';
import { ragMultiSearch, ragEnsureIndex, ragLinks, ragState, ragPlan, ragVersions, ragFacts } from './rag';

type Cluster = { name: string; color: string; count: number; angle: number };
const clusters: Cluster[] = [
  {name:'Проекты',color:'#eeb06b',count:1294,angle:-140},
  {name:'Знания',color:'#40dfc9',count:4320,angle:-90},
  {name:'Обучение',color:'#80a8ff',count:2501,angle:-48},
  {name:'Работа',color:'#9b72fa',count:2617,angle:-12},
  {name:'Ресурсы',color:'#37d3bd',count:3821,angle:24},
  {name:'Люди',color:'#6ca9f6',count:328,angle:59},
  {name:'Идеи',color:'#f3b562',count:1583,angle:94},
  {name:'Исследования',color:'#41e2c6',count:2904,angle:129},
  {name:'Технологии',color:'#76b6ff',count:3876,angle:164},
  {name:'Безопасность',color:'#a782f9',count:742,angle:199}
];
const app=document.querySelector<HTMLDivElement>('#app')!;
type ChatMessage = { role: 'user' | 'assistant'; content: string };
const history: ChatMessage[] = [];
let sending = false;
app.innerHTML=`
<header class="topbar"><div class="brand"><span class="brand-mark">◉</span><div><strong>ASPKSA</strong><small>Второй мозг · RAG · Knowledge Graph</small></div></div><nav><button class="active">Обзор</button><button>Граф</button><button>Документы</button><button>Коллекции</button></nav><span class="top-status"><i></i> LOCAL DEMO</span></header>
<main class="workspace">
<aside class="sidebar"><h3>База знаний</h3><button class="navitem selected">◈ &nbsp; Все знания <span>22 094</span></button><button class="navitem">▤ &nbsp; Документы <span>8 432</span></button><button class="navitem">◇ &nbsp; Заметки <span>5 768</span></button><button class="navitem">⌘ &nbsp; Проекты <span>1 294</span></button><h3>Коллекции</h3><div class="legend"><span style="--c:#eeb06b">● Работа</span><span style="--c:#40dfc9">● Исследования</span><span style="--c:#80a8ff">● Обучение</span><span style="--c:#a782f9">● Идеи</span></div><h3>Быстрые действия</h3><button class="action" id="upload">＋ Загрузить документы</button><button class="action" id="reset">↺ Сбросить выделение</button><div class="sync"><b>●</b> Демо-режим · без подключения к RAG</div></aside>
<section class="atlas" aria-label="Интерактивная карта знаний"><canvas id="graph"></canvas><div class="graph-overlay"><div class="eyebrow">KNOWLEDGE ATLAS / INTERACTIVE</div><div id="selected">Нажмите на сектор, чтобы изучить связи</div></div><div class="atlas-controls"><button id="pause" title="Остановить анимацию">Ⅱ</button><button id="zoomout" title="Уменьшить">−</button><span id="zoomlabel">100%</span><button id="zoomin" title="Увеличить">＋</button></div></section>
<section class="assistant" aria-label="AI-чат"><div class="assistant-heading"><span class="ai-logo">◉</span><div><h2>AI Ассистент</h2><p>RAG · Поиск · Анализ · Связи</p></div></div><div class="messages" id="messages"><div class="message ai">Привет! Я ASPKSA. Задай вопрос — я отвечу через Cloud.ru, когда сервер будет настроен.</div></div><label class="rag-toggle"><input id="rag-enabled" type="checkbox"/> Использовать документы USB в ответах AI</label><form id="chat-form" class="composer"><input id="question" autocomplete="off" aria-label="Сообщение" placeholder="Спросить о знаниях..." required/><button aria-label="Отправить" type="submit">➤</button></form><p class="disclaimer">RAG: поиск выполняется локально; только найденные выдержки отправляются в Cloud.ru при включённой опции.</p></section>
</main><input id="file" type="file" hidden multiple accept=".pdf,.txt,.md,.json"/>`;
const canvas=document.querySelector<HTMLCanvasElement>('#graph')!;
const ctx=canvas.getContext('2d')!;
const atlas=document.querySelector<HTMLElement>('.atlas')!;
let scale=1, playing=true, phase=0, active=-1, width=0,height=0,dpr=1;
const polar=(angle:number,r:number):[number,number]=>[Math.cos(angle)*r,Math.sin(angle)*r];
const rad=(degrees:number)=>degrees*Math.PI/180;
function resize(){const rect=atlas.getBoundingClientRect();width=rect.width;height=rect.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';}
new ResizeObserver(resize).observe(atlas);resize();
function render(){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const cx=width*.50,cy=height*.51,r=Math.min(width*.46,height*.46)*scale;
  ctx.save();ctx.translate(cx,cy);
  const halo=ctx.createRadialGradient(0,0,10,0,0,r*1.2);halo.addColorStop(0,'rgba(16,90,98,.17)');halo.addColorStop(1,'rgba(3,12,20,0)');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,0,r*1.2,0,Math.PI*2);ctx.fill();
  for(const factor of [.17,.25,.50,.72,.87,1.04]){ctx.beginPath();ctx.arc(0,0,r*factor,0,Math.PI*2);ctx.strokeStyle='rgba(83,158,168,.15)';ctx.lineWidth=1;ctx.stroke();}
  for(let i=0;i<clusters.length;i++){
    const item=clusters[i], angle=rad(item.angle), selected=active===i, dim=active>=0&&!selected;
    ctx.save();ctx.rotate(angle);ctx.globalAlpha=dim?.22:1;
    const rows=9,columns=13;
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const radius=r*(.31+row*.027),offset=(col-(columns-1)/2)*.019;
      const x=Math.cos(offset)*radius,y=Math.sin(offset)*radius;
      const pulse=.76+.24*Math.sin(phase*1.8+row*.8+col*.35+i);
      ctx.beginPath();ctx.arc(x,y,(selected?2.5:1.7)*pulse,0,Math.PI*2);ctx.fillStyle=item.color;ctx.globalAlpha=(dim?.2:1)*(.38+row*.065);ctx.fill();
    }
    ctx.globalAlpha=dim?.18:.35;ctx.strokeStyle=item.color;ctx.beginPath();ctx.moveTo(r*.57,0);ctx.lineTo(r*.91,0);ctx.stroke();
    for(let j=0;j<7;j++){const a=(j-3)*.052;const [x,y]=polar(a,r*.91);ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.strokeStyle=item.color;ctx.globalAlpha=dim?.15:.7;ctx.stroke();ctx.beginPath();ctx.arc(x,y,1.7,0,Math.PI*2);ctx.fillStyle=item.color;ctx.fill();}
    ctx.restore();
    const [lx,ly]=polar(angle,r*.62);ctx.fillStyle=item.color;ctx.font='600 12px system-ui';ctx.textAlign='center';ctx.globalAlpha=dim?.35:1;ctx.fillText(item.name,lx,ly);ctx.font='11px monospace';ctx.fillText(item.count.toLocaleString('ru-RU'),lx,ly+16);ctx.globalAlpha=1;
  }
  ctx.beginPath();ctx.arc(0,0,r*.16,0,Math.PI*2);ctx.fillStyle='#061923';ctx.fill();ctx.strokeStyle='#40dfc9';ctx.lineWidth=2;ctx.shadowColor='#40dfc9';ctx.shadowBlur=18;ctx.stroke();ctx.shadowBlur=0;
  ctx.textAlign='center';ctx.fillStyle='#d9ffff';ctx.font='700 17px system-ui';ctx.fillText('ASPKSA',0,-2);ctx.fillStyle='#77b3b7';ctx.font='10px monospace';ctx.fillText('RAG CORE',0,17);
  ctx.restore();if(playing)phase+=.008;requestAnimationFrame(render);
}requestAnimationFrame(render);
function pick(e:PointerEvent){const b=canvas.getBoundingClientRect(),x=e.clientX-b.left-width*.5,y=e.clientY-b.top-height*.51,angle=(Math.atan2(y,x)*180/Math.PI+360)%360;const radius=Math.hypot(x,y),r=Math.min(width*.46,height*.46)*scale;if(radius<r*.25||radius>r*1.08)return;let best=0,distance=Infinity;clusters.forEach((c,i)=>{const delta=Math.abs(((angle-c.angle+540)%360)-180);if(delta<distance){distance=delta;best=i;}});active=best;const c=clusters[best];document.querySelector('#selected')!.textContent=`${c.name} · ${c.count.toLocaleString('ru-RU')} элементов`;addMessage(`Выбран кластер «${c.name}». В демо отображается структура без реальных данных RAG.`,'ai');}
canvas.addEventListener('click',pick);
function showRagSources(paths:string[]){const list=document.querySelector<HTMLElement>('#messages')!;const wrapper=document.createElement('div');wrapper.className='message ai rag-sources';const heading=document.createElement('strong');heading.textContent='Источники на USB:';wrapper.append(heading);for(const path of paths){const button=document.createElement('button');button.type='button';button.textContent='↗ '+path;button.title='Открыть файл на Диске';button.addEventListener('click',()=>{if(!document.querySelector('.drive'))openDocuments();openDiskSource(path);});wrapper.append(button);}const relevant=ragLinks().filter(link=>paths.includes(link.from)||paths.includes(link.to)).slice(0,5);if(relevant.length){const related=document.createElement('small');related.textContent='Связи документов (предположительные или по реквизитам): '+relevant.map(l=>l.from+' ↔ '+l.to+' ('+l.reason+')').join('; ');wrapper.append(related);}list.append(wrapper);list.scrollTop=list.scrollHeight;}
function addMessage(text:string,role:'ai'|'user'){const list=document.querySelector<HTMLElement>('#messages')!;const node=document.createElement('div');node.className='message '+role;node.textContent=text;list.append(node);list.scrollTop=list.scrollHeight;}
window.addEventListener('aspksa:contract-question',event=>{const question=(event as CustomEvent<{question:string}>).detail?.question;if(typeof question!=='string')return;const input=document.querySelector<HTMLInputElement>('#question')!;input.value=question;input.focus();addMessage('Вопрос по договору подготовлен. Проверь включение RAG и отправь его в чат.','ai');});
document.querySelector<HTMLFormElement>('#chat-form')!.addEventListener('submit',async e=>{
  e.preventDefault();
  if(sending)return;
  const input=document.querySelector<HTMLInputElement>('#question')!;
  const value=input.value.trim();if(!value)return;
  addMessage(value,'user');input.value='';
  const pending=[...history,{role:'user' as const,content:value}];
  sending=true;input.disabled=true;
  try {
    const enabled=document.querySelector<HTMLInputElement>('#rag-enabled')!.checked;
    if(enabled)await ragEnsureIndex();
    const found=enabled?await ragMultiSearch(value):[];
    const context=found.map(({path,excerpt})=>({path,excerpt:excerpt.slice(0,1400)}));
    if(enabled){addMessage('План проверки:\n'+ragPlan(value).map((step,i)=>(i+1)+'. '+step).join('\n'),'ai');const versions=ragVersions().filter(group=>group.versions.some(v=>found.some(r=>r.path===v.path))).slice(0,3);if(versions.length)addMessage('Возможные редакции (по имени файла; дата действия не подтверждена): '+versions.map(g=>g.group+': '+g.versions.map(v=>v.path+' ['+v.date+']').join(', ')).join('; '),'ai');}
    if(enabled&&context.length===0)addMessage('В локальных документах не найдено совпадений. Отправляю вопрос без выдержек.','ai');
    if(context.length){showRagSources([...new Set(context.map(x=>x.path))]);const citations=found.map((r,i)=>'['+(i+1)+'] '+r.path+' · '+(r.locator||'позиция не установлена')+' · фактов: '+ragFacts(r.path).length);addMessage('Локальные доказательства:\n'+citations.join('\n'),'ai');const note=ragState();addMessage('Найдено фрагментов: '+context.length+'; связей между документами: '+note.links+'. Ответ AI должен опираться на показанные источники; отсутствие сведений не означает отсутствие события.','ai');}
    const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:pending,context})});
    const data:unknown=await response.json();
    if(!response.ok)throw new Error(typeof data==='object'&&data!==null&&'error' in data?String(data.error):'Ошибка AI-сервера');
    if(typeof data!=='object'||data===null||!('reply' in data)||typeof data.reply!=='string')throw new Error('Некорректный ответ сервера');
    addMessage(data.reply,'ai');
    history.push({role:'user',content:value},{role:'assistant',content:data.reply});
    if(history.length>20)history.splice(0,history.length-20);
  }catch(error){addMessage('Не удалось ответить: '+(error instanceof Error?error.message:'неизвестная ошибка')+'. Проверьте настройки серверного API.','ai');}
  finally{sending=false;input.disabled=false;input.focus();}
});
document.querySelector('#pause')!.addEventListener('click',()=>{playing=!playing;document.querySelector('#pause')!.textContent=playing?'Ⅱ':'▶';});
function zoom(delta:number){scale=Math.min(1.55,Math.max(.65,scale+delta));document.querySelector('#zoomlabel')!.textContent=Math.round(scale*100)+'%';}
document.querySelector('#zoomin')!.addEventListener('click',()=>zoom(.1));document.querySelector('#zoomout')!.addEventListener('click',()=>zoom(-.1));
document.querySelector('#reset')!.addEventListener('click',()=>{active=-1;document.querySelector('#selected')!.textContent='Нажмите на сектор, чтобы изучить связи';});
document.querySelector('#upload')!.addEventListener('click',openDocuments);
document.querySelectorAll<HTMLButtonElement>('.topbar nav button').forEach(button=>{if(button.textContent?.trim()==='Документы')button.addEventListener('click',openDocuments);});
document.querySelector<HTMLInputElement>('#file')!.addEventListener('change',e=>{const files=(e.target as HTMLInputElement).files;if(files?.length)addMessage(`Выбрано файлов: ${files.length}. Загрузка на сервер пока не настроена.`,'ai');});
