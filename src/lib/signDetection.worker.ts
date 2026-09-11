import {pageSignSymbols} from '../domain/pageSignSymbols';
self.onmessage=(event:MessageEvent<{data:ArrayBuffer;width:number;height:number}>)=>{
 try{const {data,width,height}=event.data;self.postMessage({symbols:pageSignSymbols(new Uint8ClampedArray(data),width,height)});}
 catch{self.postMessage({error:'표지 기호 분석에 실패했습니다.'});}
};
