// Embeddings are computed in-browser. The model is downloaded once by the browser;
// document text and vectors are never sent to the model host.
type Encoder=(text:string,options:{pooling:string;normalize:boolean})=>Promise<{data:Float32Array|number[]}>;
let encoderPromise:Promise<Encoder>|null=null;
async function encoder():Promise<Encoder>{
 if(!encoderPromise)encoderPromise=import('@xenova/transformers').then(async ({pipeline})=>{
  const model=await pipeline('feature-extraction','Xenova/paraphrase-multilingual-MiniLM-L12-v2',{quantized:true});
  return model as unknown as Encoder;
 }).catch(e=>{encoderPromise=null;throw e;});
 return encoderPromise;
}
export async function embed(text:string):Promise<Float32Array>{
 const model=await encoder();
 const result=await model(text.slice(0,1400),{pooling:'mean',normalize:true});
 return Float32Array.from(result.data);
}
export function similarity(a:Float32Array,b:Float32Array):number{
 if(a.length!==b.length)return 0;
 let score=0;for(let i=0;i<a.length;i++)score+=a[i]*b[i];return score;
}
