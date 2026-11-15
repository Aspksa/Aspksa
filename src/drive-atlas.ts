// Radial visualization of actual entries in the connected USB folder.
export type DiskNode={name:string;kind:'file'|'directory';path:string[]};
export function drawDiskAtlas(host:HTMLElement,items:DiskNode[],onOpen:(node:DiskNode)=>void){
 host.replaceChildren();
 const canvas=document.createElement('canvas');canvas.className='drive-atlas-canvas';
 canvas.setAttribute('aria-label','Радиальная карта файлов');host.append(canvas);
 const legend=document.createElement('div');legend.className='drive-atlas-legend';legend.textContent='● Папки     ● Документы     ● Медиа     ● Архивы';host.append(legend);
 const center=document.createElement('div');center.className='drive-atlas-center';center.innerHTML='<strong>ASPKSA</strong><span>ДИСК / ФАЙЛЫ</span>';host.append(center);
 const ctx=canvas.getContext('2d');if(!ctx)return()=>{};
 const colors=['#56e2c6','#75a9fa','#f0b477','#aa8df3'];
 const category=(n:DiskNode)=>n.kind==='directory'?0:/\\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mp3|wav|flac|m4a)$/i.test(n.name)?2:/\\.(zip|rar|7z)$/i.test(n.name)?3:1;
 const groups=[0,1,2,3].map(type=>items.filter(n=>category(n)===type));
 let points:{x:number;y:number;node:DiskNode;type:number}[]=[];
 let hover:DiskNode|null=null;
 let width=0,height=0;
 const render=()=>{
  const rect=host.getBoundingClientRect();width=Math.max(320,rect.width);height=Math.max(330,rect.height);
  const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,width,height);const cx=width/2,cy=height/2;
  const r=Math.min(width*.43,height*.43);points=[];
  for(const factor of [.28,.43,.6,.79,1]){ctx.beginPath();ctx.arc(cx,cy,r*factor,0,Math.PI*2);ctx.strokeStyle='rgba(95,175,182,.14)';ctx.lineWidth=1;ctx.stroke();}
  const active=groups.filter(g=>g.length>0);let offset=-Math.PI/2;
  for(let type=0;type<4;type++){
   const group=groups[type];if(!group.length)continue;
   const span=(Math.PI*2)*(group.length/items.length);
   const gap=Math.min(.075,span*.12);const start=offset+gap,end=offset+span-gap;
   const rows=Math.min(4,Math.max(1,Math.ceil(group.length/20)));
   group.forEach((node,i)=>{
    const row=i%rows;const column=Math.floor(i/rows);
    const columns=Math.ceil(group.length/rows);
    const angle=start+(end-start)*(column+.5)/columns;
    const radius=r*(.48+row*.115);
    const x=cx+Math.cos(angle)*radius,y=cy+Math.sin(angle)*radius;
    ctx.beginPath();ctx.moveTo(cx+Math.cos(angle)*r*.32,cy+Math.sin(angle)*r*.32);ctx.lineTo(x,y);ctx.strokeStyle=colors[type]+'22';ctx.stroke();
    ctx.beginPath();ctx.arc(x,y,hover===node?5.5:3.3,0,Math.PI*2);ctx.fillStyle=colors[type];ctx.fill();
    points.push({x,y,node,type});
   });
   const labelAngle=offset+span/2;const lx=cx+Math.cos(labelAngle)*r*.91,ly=cy+Math.sin(labelAngle)*r*.91;
   ctx.font='600 10px system-ui';ctx.textAlign='center';ctx.fillStyle=colors[type];ctx.fillText(['ПАПКИ','ДОКУМЕНТЫ','МЕДИА','АРХИВЫ'][type]+' · '+group.length,lx,ly);
   offset+=span;
  }
  ctx.beginPath();ctx.arc(cx,cy,r*.23,0,Math.PI*2);ctx.fillStyle='#071c28';ctx.fill();ctx.strokeStyle='#4bd9c1';ctx.lineWidth=1.5;ctx.stroke();
  if(hover){const p=points.find(p=>p.node===hover);if(p){ctx.fillStyle='#dff9f6';ctx.textAlign='center';ctx.font='12px system-ui';ctx.fillText(hover.name.slice(0,45),cx,cy+r*.35);}}
 };
 const locate=(event:PointerEvent)=>{const rect=canvas.getBoundingClientRect();const x=event.clientX-rect.left,y=event.clientY-rect.top;let nearest:DiskNode|null=null,dist=18;for(const p of points){const d=Math.hypot(x-p.x,y-p.y);if(d<dist){dist=d;nearest=p.node;}}return nearest;};
 const move=(event:PointerEvent)=>{const next=locate(event);if(next!==hover){hover=next;canvas.style.cursor=hover?'pointer':'default';render();}};
 const click=(event:PointerEvent)=>{const node=locate(event);if(node)onOpen(node);};
 canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerleave',()=>{hover=null;render();});canvas.addEventListener('click',click);
 const observer=new ResizeObserver(render);observer.observe(host);render();
 return()=>observer.disconnect();
}
