// USB file manager. Browser permission is required once per session.
type PickerWindow = Window & { showDirectoryPicker?: (options?: {mode?:'readwrite'})=>Promise<FileSystemDirectoryHandle> };
let drive:FileSystemDirectoryHandle|null=null;
let current:string[]=[];
let mode:'grid'|'list'='grid';
let tab:'all'|'favorites'|'recent'='all';
const favoriteKey='aspksa-usb-favorites-v1';
const recentKey='aspksa-usb-recent-v1';
const stored=(key:string):string[]=>{try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[];}catch{return [];}};
const save=(key:string,items:string[])=>localStorage.setItem(key,JSON.stringify(items.slice(0,100)));
const itemPath=(segments:string[],name:string)=>[...segments,name].join('/');
async function at(segments:string[]){if(!drive)throw Error('USB не подключён');let dir=drive;for(const name of segments)dir=await dir.getDirectoryHandle(name);return dir;}
async function searchAll(query:string){const results:{entry:FileSystemHandle;path:string[]}[]=[];if(!drive)return results;const walk=async(dir:FileSystemDirectoryHandle,path:string[],depth:number)=>{if(depth>12||results.length>=500)return;for await(const entry of dir.values()){if(entry.name.toLocaleLowerCase('ru').includes(query)||!query)results.push({entry,path});if(entry.kind==='directory'&&depth<12)await walk(await dir.getDirectoryHandle(entry.name),[...path,entry.name],depth+1);if(results.length>=500)return;}};await walk(drive,[],0);return results;}

const text=(tag:string,cls:string,value='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=value;return e;};
const clean=(name:string)=>name.trim().replace(/[\\/\x00-\x1f]/g,'_').slice(0,120);
async function directory(){if(!drive)throw Error('USB не подключён');let dir=drive;for(const name of current)dir=await dir.getDirectoryHandle(name);return dir;}
async function initialize(){const picker=(window as PickerWindow).showDirectoryPicker;if(!picker)throw Error('Используй Chrome или Edge на компьютере через HTTPS. Этот браузер не поддерживает доступ к USB-папкам.');const disk=await picker({mode:'readwrite'});const project=await disk.getDirectoryHandle('Aspksa',{create:true});drive=await project.getDirectoryHandle('Документы',{create:true});current=[];}
async function exists(dir:FileSystemDirectoryHandle,name:string){try{await dir.getFileHandle(name);return true;}catch{}try{await dir.getDirectoryHandle(name);return true;}catch{}return false;}
async function removeTree(dir:FileSystemDirectoryHandle,name:string){await dir.removeEntry(name,{recursive:true});}
async function renameEntry(dir:FileSystemDirectoryHandle,entry:FileSystemHandle,newName:string){
 if(await exists(dir,newName))throw Error('Файл или папка с таким именем уже существует');
 if(entry.kind==='file'){const original=await dir.getFileHandle(entry.name);const file=await original.getFile();const target=await dir.getFileHandle(newName,{create:true});const writable=await target.createWritable();await writable.write(file);await writable.close();await dir.removeEntry(entry.name);}
 else {const source=await dir.getDirectoryHandle(entry.name);const dest=await dir.getDirectoryHandle(newName,{create:true});for await(const child of source.values()){if(child.kind==='directory')throw Error('Переименование папки с вложенными папками пока не поддерживается');const file=await(await source.getFileHandle(child.name)).getFile();const target=await dest.getFileHandle(child.name,{create:true});const writer=await target.createWritable();await writer.write(file);await writer.close();}await dir.removeEntry(entry.name,{recursive:true});}
}
export function openDocuments(){
 const workspace=document.querySelector<HTMLElement>('.workspace')!;
 const existing=workspace.querySelector<HTMLElement>('.drive');
 if(existing){existing.remove();workspace.classList.remove('documents-open');return;}
 workspace.classList.add('documents-open');
 const root=text('section','drive');root.setAttribute('aria-label','USB-документы');
 root.innerHTML='<div class="drive-head"><div class="drive-brand"><span class="drive-brand-icon" aria-hidden="true">◈</span><div><div class="eyebrow">ЛОКАЛЬНОЕ ХРАНИЛИЩЕ</div><h2>ASPKSA Диск</h2><p>Твои файлы. Твой USB-диск.</p></div></div><div class="drive-head-right"><span class="drive-connection">● Не подключён</span><button class="drive-close" aria-label="Закрыть">✕</button></div></div><div class="drive-location-bar"><div class="drive-crumbs"></div><label class="drive-search-wrap"><span aria-hidden="true">⌕</span><input class="drive-search" type="search" placeholder="Поиск файлов и папок" aria-label="Поиск по всем папкам USB"/></label></div><div class="drive-toolbar"><div class="drive-actions"><button class="drive-connect">◉ Подключить USB</button><button class="drive-new drive-primary">＋ Создать папку</button><button class="drive-upload">↑ Загрузить</button><button class="drive-layout" title="Переключить вид" aria-label="Переключить плитки и список">▦ Вид</button></div></div><div class="drive-tools"><span class="drive-status" role="status"></span></div><div class="drive-tabs"><button data-tab="all" class="active">Все файлы</button><button data-tab="favorites">★ Избранное</button><button data-tab="recent">Недавние</button></div><div class="drive-section-heading"><h3>Папки и файлы</h3><span>USB / Aspksa / Документы</span></div><div class="drive-list"></div><input class="drive-input" type="file" multiple hidden />';
 workspace.append(root);
 const preview=async(file:File)=>{
  const overlay=text('div','drive-preview-overlay');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Просмотр '+file.name);
  const panel=text('section','drive-preview-panel');const header=text('div','drive-preview-head');const heading=text('strong','',file.name);const close=text('button','drive-preview-close','✕');close.setAttribute('aria-label','Закрыть просмотр');
  const body=text('div','drive-preview-body');const download=text('button','drive-preview-download','↓ Скачать');let url:string|null=null;
  const dismiss=()=>{overlay.remove();if(url)URL.revokeObjectURL(url);document.removeEventListener('keydown',escape);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')dismiss();};close.addEventListener('click',dismiss);overlay.addEventListener('click',e=>{if(e.target===overlay)dismiss();});document.addEventListener('keydown',escape);
  download.addEventListener('click',()=>{const a=document.createElement('a');const link=URL.createObjectURL(file);a.href=link;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(link),60000);});
  header.append(heading,download,close);panel.append(header,body);overlay.append(panel);root.append(overlay);close.focus();
  if(/\.(txt|md|markdown|json|csv|log|html|css|js|ts)$/i.test(file.name)){if(file.size>5_000_000){body.textContent='Файл слишком большой для предварительного просмотра (максимум 5 МБ).';return;}const pre=text('pre','drive-preview-text',await file.text());body.append(pre);}
  else if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){url=URL.createObjectURL(file);const frame=document.createElement('iframe');frame.src=url;frame.title='PDF: '+file.name;frame.className='drive-preview-frame';body.append(frame);}
  else if(file.type.startsWith('image/')&&/\.(png|jpe?g|webp|gif|svg)$/i.test(file.name)){url=URL.createObjectURL(file);const image=document.createElement('img');image.src=url;image.alt=file.name;image.className='drive-preview-image';body.append(image);}
  else body.append(text('p','drive-preview-unsupported','Предпросмотр этого формата пока недоступен. Можно скачать файл и открыть его на компьютере.'));
 };
 const status=(s:string)=>{root.querySelector<HTMLElement>('.drive-status')!.textContent=s;};
 const connection=()=>{const label=root.querySelector<HTMLElement>('.drive-connection')!;label.textContent=drive?'● USB подключён':'● Не подключён';label.classList.toggle('connected',!!drive);};
 const refresh=async()=>{
  const list=root.querySelector<HTMLElement>('.drive-list')!,crumbs=root.querySelector<HTMLElement>('.drive-crumbs')!;
  list.replaceChildren();crumbs.replaceChildren();connection();
  if(!drive){status('Подключи USB-диск — папка Aspksa/Документы создастся автоматически.');list.append(text('div','drive-empty','◈  Подключи USB-диск, чтобы увидеть свои папки и файлы.'));return;}
  const home=text('button','','⌂  Aspksa / Документы');home.addEventListener('click',()=>{current=[];void refresh();});crumbs.append(home);
  current.forEach((part,i)=>{crumbs.append(text('span','',' / '));const b=text('button','',part);b.addEventListener('click',()=>{current=current.slice(0,i+1);void refresh();});crumbs.append(b);});
  try{
   const q=root.querySelector<HTMLInputElement>('.drive-search')!.value.trim().toLocaleLowerCase('ru');
   const all=(q||tab!=='all')?await searchAll(q):await (async()=>{const entries:{entry:FileSystemHandle;path:string[]}[]=[];const dir=await directory();for await(const entry of dir.values())entries.push({entry,path:[...current]});return entries;})();
   const favorites=stored(favoriteKey),recent=stored(recentKey);
   const entries=all.filter(({entry,path})=>{
    const key=itemPath(path,entry.name);
    if(tab==='favorites'&&!favorites.includes(key))return false;
    if(tab==='recent'&&!recent.includes(key))return false;
    return q?entry.name.toLocaleLowerCase('ru').includes(q):tab==='all'?path.join('/')===current.join('/'):true;
   });
   entries.sort((a,b)=>tab==='recent'?recent.indexOf(itemPath(a.path,a.entry.name))-recent.indexOf(itemPath(b.path,b.entry.name)):(a.entry.kind===b.entry.kind?a.entry.name.localeCompare(b.entry.name,'ru'):a.entry.kind==='directory'?-1:1));
   list.className='drive-list '+(mode==='grid'?'drive-grid':'drive-rows');
   for(const {entry,path} of entries){
    const dir=await at(path);
    const key=itemPath(path,entry.name);
    const tile=text('div','drive-item');
    const icon=text('span','drive-icon',entry.kind==='directory'?'📁':/\.(pdf)$/i.test(entry.name)?'📕':/\.(docx?|odt)$/i.test(entry.name)?'📘':/\.(png|jpe?g|webp|gif)$/i.test(entry.name)?'🖼️':'📄');
    const name=text('button','drive-name',entry.name);
    name.addEventListener('click',async()=>{try{if(entry.kind==='directory'){current=[...path,entry.name];await refresh();}else{save(recentKey,[key,...stored(recentKey).filter(x=>x!==key)]);const file=await(await dir.getFileHandle(entry.name)).getFile();await preview(file);}}catch(e){status(String(e));}});
    const actions=text('div','drive-item-actions');
    const star=text('button','drive-star',favorites.includes(key)?'★ В избранном':'☆ Избранное');star.addEventListener('click',()=>{const list=stored(favoriteKey);save(favoriteKey,list.includes(key)?list.filter(x=>x!==key):[key,...list]);void refresh();});
    const location=text('span','drive-location',path.length?path.join(' / '):'Документы');
    const rename=text('button','','Переименовать');rename.addEventListener('click',async()=>{const proposed=prompt('Новое имя:',entry.name);if(!proposed||clean(proposed)===entry.name)return;const next=clean(proposed);if(!next||next==='.'||next==='..')return;try{await renameEntry(dir,entry,next);for(const storageKey of [favoriteKey,recentKey])save(storageKey,stored(storageKey).map(x=>x===key?itemPath(path,next):x));await refresh();}catch(e){status('Ошибка: '+String(e));}});
    const remove=text('button','drive-delete','Удалить');remove.addEventListener('click',async()=>{if(!confirm('Удалить «'+entry.name+'» и всё содержимое?'))return;try{await removeTree(dir,entry.name);for(const storageKey of [favoriteKey,recentKey])save(storageKey,stored(storageKey).filter(x=>x!==key&&!x.startsWith(key+'/')));await refresh();}catch(e){status(String(e));}});
    actions.append(star,rename,remove);tile.append(icon,name,location,actions);list.append(tile);
   }
   status(entries.length+' элементов · '+(q?'Поиск по папкам':'Локальные файлы на USB'));
  }catch(e){status('Ошибка чтения: '+String(e));}
 };
 root.querySelector('.drive-close')!.addEventListener('click',()=>{root.remove();workspace.classList.remove('documents-open');});
 root.querySelector('.drive-connect')!.addEventListener('click',async()=>{try{await initialize();await refresh();}catch(e){status('Подключение отменено или недоступно: '+String(e));}});
 root.querySelector('.drive-layout')!.addEventListener('click',()=>{mode=mode==='grid'?'list':'grid';root.querySelector<HTMLElement>('.drive-layout')!.textContent=mode==='grid'?'▦ Вид':'☷ Вид';void refresh();});
 root.querySelector('.drive-search')!.addEventListener('input',()=>void refresh());
 root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button=>button.addEventListener('click',()=>{tab=button.dataset.tab as typeof tab;root.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===button));void refresh();}));
 root.querySelector('.drive-new')!.addEventListener('click',async()=>{if(!drive){status('Сначала подключи USB');return;}const value=prompt('Название папки:');if(!value)return;const name=clean(value);if(!name||name==='.'||name==='..')return;try{const dir=await directory();if(await exists(dir,name))throw Error('Такое имя уже существует');await dir.getDirectoryHandle(name,{create:true});await refresh();}catch(e){status(String(e));}});
 root.querySelector('.drive-upload')!.addEventListener('click',()=>{if(!drive){status('Сначала подключи USB');return;}root.querySelector<HTMLInputElement>('.drive-input')!.click();});
 async function upload(files:FileList|File[]){if(!drive){status('Сначала подключи USB');return;}try{const dir=await directory();for(const file of Array.from(files)){const name=clean(file.name);if(!name)continue;let target:FileSystemFileHandle;try{target=await dir.getFileHandle(name,{create:false});if(!confirm('Заменить существующий файл «'+name+'»?'))continue;}catch{target=await dir.getFileHandle(name,{create:true});}const writer=await target.createWritable();await writer.write(file);await writer.close();}await refresh();}catch(e){status('Ошибка записи: '+String(e));}}
 root.querySelector<HTMLInputElement>('.drive-input')!.addEventListener('change',e=>{const input=e.target as HTMLInputElement;if(input.files)void upload(input.files);input.value='';});
 root.addEventListener('dragover',e=>{e.preventDefault();root.classList.add('drive-drag');});
 root.addEventListener('dragleave',()=>root.classList.remove('drive-drag'));
 root.addEventListener('drop',e=>{e.preventDefault();root.classList.remove('drive-drag');if(e.dataTransfer?.files)void upload(e.dataTransfer.files);});
 void refresh();
}
