// Interactive radial map of real USB directory hierarchy.
export type DiskNode={name:string;kind:'file'|'directory';path:string[];rag?:boolean};
export function drawDiskAtlas(host:HTMLElement,items:DiskNode[],onOpen:(node:DiskNode)=>void){
 host.replaceChildren();
 const canvas=document.createElement('canvas');canvas.className='drive-atlas-canvas';canvas.setAttribute('aria-label','Карта файлов и папок: колесо мыши для масштаба, перетаскивание для перемещения');canvas.tabIndex=0;host.append(canvas);
 const controls=document.createElement('div');controls.className='drive-atlas-controls';
 const plus=document.createElement('button');plus.textContent='＋';plus.title='Приблизить';
 const minus=document.createElement('button');minus.textContent='−';minus.title='Отдалить';
 const reset=document.createElement('button');reset.textContent='◎';reset.title='Сбросить масштаб и позицию';
 const count=document.createElement('span');count.textContent=items.length+' объектов';
 controls.append(minus,plus,reset,count);host.append(controls);
 const legend=document.createElement('div');legend.className='drive-atlas-legend';legend.textContent='● Папки   ● Документы   ● Медиа   ● Архивы   ◉ В индексе RAG';host.append(legend);
 const center=document.createElement('div');center.className='drive-atlas-center';center.innerHTML='<strong>ASPKSA</strong><span>ДИСК / ФАЙЛЫ</span>';host.append(center);
 const ctx=canvas.getContext('2d');if(!ctx)return()=>{};
 const colors=['#56e2c6','#75a9fa','#f0b477','#aa8df3'];
 const category=(n:DiskNode)=>n.kind==='directory'?0:/\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mp3|wav|flac|m4a)$/i.test(n.name)?2:/\.(zip|rar|7z)$/i.test(n.name)?3:1;
 const key=(n:DiskNode)=>[...n.path,n.name].join('/');
 const indexed=new Map(items.map(n=>[key(n),n]));
 // A missing ancestor can occur when the search result set is truncated.
 const nodes=items.map(n=>({node:n,parent:n.path.join('/'),key:key(n)}));
 const byParent=new Map<string,typeof nodes>();
 for(const n of nodes){const siblings=byParent.get(n.parent)||[];siblings.push(n);byParent.set(n.parent,siblings);}
 let zoom=1,panX=0,panY=0,hover:DiskNode|null=null;
 let positions:{x:number;y:number;node:DiskNode;parentX:number;parentY:number}[]=[];
 let width=0,height=0,unit=1;
 const render=()=>{
  const rect=host.getBoundingClientRect();width=Math.max(280,rect.width);height=Math.max(300,rect.height);
  const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const cx=width/2+panX,cy=height/2+panY;unit=Math.min(width*.40,height*.40)*zoom;
  for(const factor of [.22,.45,.7,1]){ctx.beginPath();ctx.arc(cx,cy,unit*factor,0,Math.PI*2);ctx.strokeStyle='rgba(89,175,183,.15)';ctx.lineWidth=1;ctx.stroke();}
  positions=[];
  const roots=nodes.filter(n=>!indexed.has(n.parent));
  const maxDepth=Math.max(1,...nodes.map(n=>n.node.path.length+1));
  const place=(siblings:typeof nodes,start:number,end:number,depth:number,px:number,py:number)=>{
   if(!siblings.length)return;
   const step=(end-start)/siblings.length;
   siblings.forEach((entry,i)=>{
    const angle=start+(i+.5)*step;
    const radius=unit*(.23+.72*(depth/Math.max(2,maxDepth)));
    const x=cx+Math.cos(angle)*radius,y=cy+Math.sin(angle)*radius;
    positions.push({x,y,node:entry.node,parentX:px,parentY:py});
    const children=byParent.get(entry.key)||[];
    if(children.length)place(children,start+i*step,start+(i+1)*step,depth+1,x,y);
   });
  };
  place(roots,-Math.PI/2,-Math.PI/2+Math.PI*2,1,cx,cy);
  for(const p of positions){ctx.beginPath();ctx.moveTo(p.parentX,p.parentY);ctx.lineTo(p.x,p.y);ctx.strokeStyle=p.node.rag?'rgba(105,235,180,.42)':'rgba(90,164,175,.19)';ctx.lineWidth=p.node.rag?1.5:1;ctx.stroke();}
  for(const p of positions){const color=colors[category(p.node)];ctx.beginPath();ctx.arc(p.x,p.y,p.node===hover?6:3.5,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();if(p.node.rag){ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.strokeStyle='#81efb6';ctx.lineWidth=1.5;ctx.stroke();}}
  ctx.beginPath();ctx.arc(cx,cy,unit*.16,0,Math.PI*2);ctx.fillStyle='#071c28';ctx.fill();ctx.strokeStyle='#4bd9c1';ctx.lineWidth=1.5;ctx.stroke();
  center.style.left=cx+'px';center.style.top=cy+'px';
  if(hover){ctx.fillStyle='#dff9f6';ctx.textAlign='center';ctx.font='12px system-ui';ctx.fillText(hover.name.slice(0,50),cx,cy+unit*.23);}
 };
 const locate=(x:number,y:number)=>{let found:DiskNode|null=null,dist=17;for(const p of positions){const d=Math.hypot(x-p.x,y-p.y);if(d<dist){dist=d;found=p.node;}}return found;};
 let dragging=false,moved=false,lastX=0,lastY=0;
 canvas.addEventListener('pointerdown',e=>{dragging=true;moved=false;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(dragging){const dx=e.clientX-lastX,dy=e.clientY-lastY;if(Math.abs(dx)+Math.abs(dy)>1)moved=true;panX+=dx;panY+=dy;lastX=e.clientX;lastY=e.clientY;render();return;}const r=canvas.getBoundingClientRect();const next=locate(e.clientX-r.left,e.clientY-r.top);if(next!==hover){hover=next;canvas.style.cursor=next?'pointer':'grab';render();}});
 canvas.addEventListener('pointerup',e=>{if(!dragging)return;dragging=false;if(!moved){const r=canvas.getBoundingClientRect();const node=locate(e.clientX-r.left,e.clientY-r.top);if(node)onOpen(node);}});
 canvas.addEventListener('pointercancel',()=>{dragging=false;});
 canvas.addEventListener('pointerleave',()=>{if(!dragging){hover=null;render();}});
 const setZoom=(value:number)=>{zoom=Math.max(.55,Math.min(3,value));render();};
 plus.addEventListener('click',()=>setZoom(zoom*1.2));minus.addEventListener('click',()=>setZoom(zoom/1.2));reset.addEventListener('click',()=>{zoom=1;panX=0;panY=0;render();});
 canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*(e.deltaY<0?1.12:.89));},{passive:false});
 canvas.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='=')setZoom(zoom*1.2);else if(e.key==='-')setZoom(zoom/1.2);else if(e.key==='Escape'){zoom=1;panX=0;panY=0;render();}});
 const observer=new ResizeObserver(render);observer.observe(host);render();
 return()=>observer.disconnect();
}
