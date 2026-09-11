// Synthetic browser regression input, not part of real-drawing success statistics.
import {createCanvas} from '@napi-rs/canvas';
import {writeFileSync} from 'node:fs';
const canvas=createCanvas(1000,800),ctx=canvas.getContext('2d');
ctx.fillStyle='white';ctx.fillRect(0,0,1000,800);
ctx.strokeStyle='black';ctx.lineWidth=8;ctx.strokeRect(100,100,800,600);ctx.lineWidth=2;
for(const [x,y,a,b] of [[100,60,900,60],[100,50,100,105],[900,50,900,105],[60,100,60,700],[50,100,105,100],[50,700,105,700]]){
 ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(a,b);ctx.stroke();
}
ctx.fillStyle='black';ctx.font='24px Arial';ctx.fillText('8000 mm',400,40);
ctx.save();ctx.translate(35,450);ctx.rotate(-Math.PI/2);ctx.fillText('9000 mm',0,0);ctx.restore();
writeFileSync('/tmp/gonggan-nonuniform.png',canvas.toBuffer('image/png'));
