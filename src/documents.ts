import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const anon=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
const bucket='project-documents';
const project='ASPKSA';
const client:SupabaseClient|null=url&&anon?createClient(url,anon):null;
let folder:string[]=[];
let signedIn=false;
const safe=(name:string)=>name.trim().replace(/[\\/\x00-\x1f]/g,'_').slice(0,120);
const prefix=()=>[project,...folder].join('/')+'/';
const el=(tag:string,cls:string,text?:string)=>{const node=document.createElement(tag);node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const notice=(root:HTMLElement,message:string)=>{const status=root.querySelector<HTMLElement>('.drive-status');if(status)status.textContent=message;};
export function openDocuments(){
  const workspace=document.querySelector<HTMLElement>('.workspace')!;
  const existing=workspace.querySelector<HTMLElement>('.drive');
  if(existing){existing.remove();workspace.classList.remove('documents-open');return;}
  workspace.classList.add('documents-open');
  const root=el('section','drive');
  root.setAttribute('aria-label','Документы проекта');
  root.innerHTML='<div class="drive-head"><div><div class="eyebrow">PROJECT STORAGE / ASPKSA</div><h2>Мои документы</h2><p>Файлы проекта · облачное хранилище</p></div><button class="drive-close" aria-label="Закрыть">✕</button></div><div class="drive-toolbar"><div class="drive-crumbs"></div><div class="drive-actions"><button class="drive-new">＋ Папка</button><button class="drive-upload">↑ Загрузить</button></div></div><div class="drive-status" role="status"></div><div class="drive-list"></div><input class="drive-input" type="file" multiple hidden />';
  workspace.append(root);
  root.querySelector('.drive-close')!.addEventListener('click',()=>{root.remove();workspace.classList.remove('documents-open');});
  root.querySelector('.drive-upload')!.addEventListener('click',()=>root.querySelector<HTMLInputElement>('.drive-input')!.click());
  root.querySelector<HTMLInputElement>('.drive-input')!.addEventListener('change',async e=>{
    if(!client||!signedIn)return;
    const files=(e.target as HTMLInputElement).files;
    if(!files)return;
    for(const file of files){
      if(file.size>50*1024*1024){notice(root,'Файл '+file.name+' больше лимита 50 МБ');continue;}
      const name=safe(file.name);if(!name)continue;
      notice(root,'Загрузка: '+name);
      const {error}=await client.storage.from(bucket).upload(prefix()+name,file,{upsert:false});
      if(error)notice(root,'Ошибка загрузки: '+error.message);
    }
    (e.target as HTMLInputElement).value='';
    await refresh(root);
  });
  root.querySelector('.drive-new')!.addEventListener('click',async()=>{
    if(!client||!signedIn)return;
    const name=prompt('Название новой папки:');
    if(!name)return;
    const clean=safe(name);if(!clean||clean==='.'||clean==='..')return;
    const {error}=await client.storage.from(bucket).upload(prefix()+clean+'/.keep',new Blob([''],{type:'text/plain'}),{upsert:false});
    if(error)notice(root,error.message);else await refresh(root);
  });
  void refresh(root);
}
async function refresh(root:HTMLElement){
  const list=root.querySelector<HTMLElement>('.drive-list')!;
  const crumbs=root.querySelector<HTMLElement>('.drive-crumbs')!;
  list.replaceChildren();crumbs.replaceChildren();
  const home=el('button','',project);home.addEventListener('click',()=>{folder=[];void refresh(root);});crumbs.append(home);
  folder.forEach((part,index)=>{crumbs.append(el('span','',' / '));const button=el('button','',part);button.addEventListener('click',()=>{folder=folder.slice(0,index+1);void refresh(root);});crumbs.append(button);});
  if(!client){notice(root,'Укажите VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY при развёртывании.');return;}
  const {data:{user}}=await client.auth.getUser();
  signedIn=!!user;
  if(!signedIn){
    notice(root,'Войдите в свой аккаунт Supabase, чтобы открыть приватные документы.');
    const form=el('form','drive-login');
    const email=el('input','') as HTMLInputElement;email.type='email';email.placeholder='Email';email.required=true;
    const password=el('input','') as HTMLInputElement;password.type='password';password.placeholder='Пароль';password.required=true;
    const submit=el('button','','Войти');submit.type='submit';form.append(email,password,submit);list.append(form);
    form.addEventListener('submit',async e=>{e.preventDefault();const {error}=await client.auth.signInWithPassword({email:email.value,password:password.value});if(error)notice(root,error.message);else await refresh(root);});
    return;
  }
  const {data,error}=await client.storage.from(bucket).list(prefix(),{limit:100,sortBy:{column:'name',order:'asc'}});
  if(error){notice(root,'Ошибка хранилища: '+error.message);return;}
  notice(root,'Папка проекта: '+prefix()+' · '+(data?.length||0)+' элементов');
  if(!data?.length)list.append(el('p','drive-empty','Здесь пока нет документов. Создайте папку или загрузите файл.'));
  for(const item of data||[]){
    if(item.name==='.keep')continue;
    const isFolder=item.id===null;
    const row=el('div','drive-item');
    const name=el('button','drive-name',(isFolder?'📁  ':'📄  ')+item.name);
    name.addEventListener('click',async()=>{
      if(isFolder){folder.push(item.name);await refresh(root);}
      else if(client){const {data,error}=await client.storage.from(bucket).createSignedUrl(prefix()+item.name,60);if(error)notice(root,error.message);else if(data?.signedUrl)window.open(data.signedUrl,'_blank','noopener,noreferrer');}
    });
    const meta=el('span','drive-meta',isFolder?'Папка':item.metadata?.size?Math.ceil(Number(item.metadata.size)/1024)+' КБ':'Файл');
    const remove=el('button','drive-delete','Удалить');
    remove.addEventListener('click',async()=>{
      if(!client||!confirm('Удалить «'+item.name+'»?'))return;
      if(isFolder){notice(root,'Удаление папки с содержимым пока не поддерживается.');return;}
      const {error}=await client.storage.from(bucket).remove([prefix()+item.name]);
      if(error)notice(root,error.message);else await refresh(root);
    });
    row.append(name,meta,remove);list.append(row);
  }
}
