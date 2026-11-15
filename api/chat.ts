// Vercel serverless function. Never expose CLOUD_RU_API_KEY to the browser.
type Message = { role: 'user' | 'assistant'; content: string };
type RequestLike = { method?: string; body?: unknown };
type ResponseLike = { status: (code:number)=>ResponseLike; json:(body:unknown)=>void; setHeader:(name:string,value:string)=>void };
const isMessage=(v:unknown):v is Message=>typeof v==='object'&&v!==null&&'role'in v&&'content'in v&&(v.role==='user'||v.role==='assistant')&&typeof v.content==='string'&&v.content.length>0&&v.content.length<=12000;
export default async function handler(req:RequestLike,res:ResponseLike){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const key=process.env.CLOUD_RU_API_KEY;
  if(!key)return res.status(503).json({error:'CLOUD_RU_API_KEY не настроен на сервере'});
  const body=req.body;
  const messages=typeof body==='object'&&body!==null&&'messages'in body?body.messages:null;
  if(!Array.isArray(messages)||messages.length<1||messages.length>20||!messages.every(isMessage))
    return res.status(400).json({error:'Некорректная история сообщений'});
  try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),30000);
    let upstream:Response;
    try{
      upstream=await fetch('https://foundation-models.api.cloud.ru/v1/chat/completions',{
        method:'POST',signal:controller.signal,
        headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
        body:JSON.stringify({model:process.env.CLOUD_RU_MODEL||'ai-sage/GigaChat3-10B-A1.8B',messages:[{role:'system',content:'Ты — AI-ассистент ASPKSA. Отвечай на языке пользователя. Не утверждай, что у тебя есть доступ к документам или RAG, пока поиск не подключен.'},...messages],max_completion_tokens:1200,temperature:0.5})
      });
    }finally{clearTimeout(timeout);}
    if(!upstream.ok)return res.status(502).json({error:'Cloud.ru вернул ошибку '+upstream.status});
    const result:unknown=await upstream.json();
    const reply=(result as {choices?:{message?:{content?:unknown}}[]})?.choices?.[0]?.message?.content;
    if(typeof reply!=='string'||!reply.trim())return res.status(502).json({error:'Cloud.ru вернул пустой ответ'});
    return res.status(200).json({reply});
  }catch{return res.status(502).json({error:'Не удалось связаться с Cloud.ru'});}
}
