import fs from 'fs';import https from 'https';import http from 'http';import {PNG} from 'pngjs';import jpeg from 'jpeg-js';
const js=fs.readFileSync('/tmp/dkjs.txt','utf8');
let urls=[...js.matchAll(/https?:\/\/[^\"'`\\) ]+?\.(?:png|jpg|jpeg|webp)(?:\?[^\"'`\\) ]*)?/g)].map(m=>m[0]);
urls=[...new Set(urls)].filter(u=>!u.includes('.svg')&&!u.includes('favicon')&&!u.includes('logo')&&!u.includes('meidou')&&!u.includes('vip')&&!u.includes('qrCode'));
console.log('urls',urls.length);
function get(u){return new Promise((res,rej)=>{(u.startsWith('https')?https:http).get(u,{headers:{'User-Agent':'Mozilla/5.0'}},r=>{let a=[];r.on('data',d=>a.push(d));r.on('end',()=>res(Buffer.concat(a)));}).on('error',rej)})}
function decode(buf,u){try{if(buf[0]===0x89)return PNG.sync.read(buf); if(buf[0]===0xff)return jpeg.decode(buf,{useTArray:true});}catch(e){} return null}
const thumbs=[];
for(let i=0;i<urls.length;i++){try{let buf=await get(urls[i]);let img=decode(buf,urls[i]); if(!img) continue; let {width:w,height:h,data}=img; let orange=0, total=0; for(let y=0;y<h;y+=Math.max(1,Math.floor(h/80))) for(let x=0;x<w;x+=Math.max(1,Math.floor(w/80))){let k=(y*w+x)*4,r=data[k],g=data[k+1],b=data[k+2],a=data[k+3]??255; if(a>20){total++; if(r>150&&g>60&&g<180&&b<80) orange++;}} thumbs.push({i,u:urls[i],w,h,data,orange:orange/Math.max(total,1)}); console.log(thumbs.length-1,w,h,orange/Math.max(total,1),urls[i]);}catch(e){} }
fs.writeFileSync('/tmp/dkurls.json',JSON.stringify(thumbs.map(({i,u,w,h,orange})=>({i,u,w,h,orange})),null,2));
const cell=160, label=22, cols=5, rows=Math.ceil(thumbs.length/cols); const out=new PNG({width:cols*cell,height:rows*(cell+label),colorType:6}); out.data.fill(255);
function setpix(x,y,r,g,b,a=255){if(x<0||y<0||x>=out.width||y>=out.height)return; let k=(y*out.width+x)*4; out.data[k]=r;out.data[k+1]=g;out.data[k+2]=b;out.data[k+3]=a;}
// crude 3x5 digits
const font={0:['111','101','101','101','111'],1:['010','110','010','010','111'],2:['111','001','111','100','111'],3:['111','001','111','001','111'],4:['101','101','111','001','001'],5:['111','100','111','001','111'],6:['111','100','111','101','111'],7:['111','001','010','010','010'],8:['111','101','111','101','111'],9:['111','101','111','001','111']};
function drawText(txt,x,y){let xx=x; for(const ch of txt){let p=font[ch]||['000','000','000','000','000']; for(let yy=0;yy<5;yy++) for(let dx=0;dx<3;dx++) if(p[yy][dx]=='1') for(let sy=0;sy<3;sy++) for(let sx=0;sx<3;sx++) setpix(xx+dx*3+sx,y+yy*3+sy,255,0,0,255); xx+=12;}}
thumbs.forEach((im,idx)=>{let cx=(idx%cols)*cell, cy=Math.floor(idx/cols)*(cell+label); drawText(String(idx),cx+4,cy+2); let scale=Math.min((cell-8)/im.w,(cell-28)/im.h); let tw=Math.max(1,Math.floor(im.w*scale)), th=Math.max(1,Math.floor(im.h*scale)); let ox=cx+(cell-tw)/2|0, oy=cy+label+((cell-label)-th)/2|0; for(let y=0;y<th;y++) for(let x=0;x<tw;x++){let sx=Math.floor(x/scale), sy=Math.floor(y/scale), k=(sy*im.w+sx)*4; setpix(ox+x,oy+y,im.data[k],im.data[k+1],im.data[k+2],im.data[k+3]??255)}});
fs.writeFileSync('/tmp/sheet.png',PNG.sync.write(out));
