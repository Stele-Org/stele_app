'use strict';
const fs=require('node:fs');
// Bounded, local metadata-only diagnostic log. Never opens a camera or changes permissions.
function createCameraLog(file){
 let count=0;
 return detail=>{
  try{
   if(count++>=1000)return;
   const data=JSON.stringify({...detail,recordedAt:new Date().toISOString(),pid:process.pid});
   if(Buffer.byteLength(data)>16384)return;
   if(fs.existsSync(file)&&fs.statSync(file).size>2*1024*1024){
    fs.copyFileSync(file,file+'.previous');fs.writeFileSync(file,'');
   }
   fs.appendFileSync(file,data+'\n',{encoding:'utf8'});
  }catch{} // Diagnostics must not stop the kiosk.
 };
}
module.exports={createCameraLog};
