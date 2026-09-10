import {readFile,writeFile} from 'node:fs/promises';
const {origin,agentToken}=JSON.parse(await readFile('.data/runtime.json','utf8'));
const saved=JSON.parse(await readFile('.data/smoke-target.json','utf8'));
const target={fileId:saved.fileId,unitId:saved.unitId,branch:'trunk'};
const results=[];
for(const [action,options]of [['screenshot',{selector:{kind:'sheet-range',range:'A1:F10',sheetName:'数据',scale:1.5},output:'sales-review.png'}],['pdf',{output:'sales-review.pdf'}],['export',{output:'sales-review.xlsx'}]]){
 const start=performance.now();
 const response=await fetch(origin+'/api/delivery',{method:'POST',headers:{Authorization:`Bearer ${agentToken}`,'content-type':'application/json'},body:JSON.stringify({target,action,...options})});
 const result=await response.json();
 results.push({action,status:response.status,ms:Math.round(performance.now()-start),result:{...result,images:result.images?.map(({data,...image})=>image)}});
 console.log(JSON.stringify(results.at(-1)));
 if(!response.ok)break;
}
await writeFile('.data/delivery-evidence.json',JSON.stringify(results,null,2));
