import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export function nextRelease(current,date){
 if(!/^\d{8}$/.test(date))throw new Error('日期須為 YYYYMMDD');
 const match=/^(\d{8})-(\d{2})$/.exec(current||'');
 const sequence=match?.[1]===date?Number(match[2])+1:1;
 if(sequence>99)throw new Error('當日流水號已達 99，請勿覆用已發布的版本號');
 return `${date}-${String(sequence).padStart(2,'0')}`;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const date=['year','month','day'].map(type=>parts.find(part=>part.type===type).value).join('');
 const pkg=JSON.parse(readFileSync('package.json','utf8'));
 pkg.nropRelease=nextRelease(pkg.nropRelease,date);
 writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');
 console.log('下次發布版本：NROP-'+pkg.nropRelease);
}
