import {it,expect} from 'vitest';import {vectorWallBands} from './vectorWallBands';
const rect=(id:string,x:number,y:number,width:number,height:number)=>({id,x,y,width,height,color:'#969696'});
const room=[rect('a',0,0,200,10),rect('b',0,190,200,10),rect('c',0,0,10,200),rect('d',190,0,10,200)];
it('forms candidate centerlines from repeated neutral fill rectangles without mutating inputs',()=>{const input=[...room,rect('extend',100,0,200,10)],copy=structuredClone(input);const r=vectorWallBands(input);expect(r).toHaveLength(4);expect(r.find(l=>l.id==='a')?.end.x).toBe(300);expect(input).toEqual(copy);});
it('does not bridge gaps, classify a single gray panel, or choose between competing fill styles',()=>{expect(vectorWallBands([room[0]])).toEqual([]);expect(vectorWallBands([...room,...room.map(r=>({...r,id:r.id+'other',color:'#777777'}))])).toEqual([]);expect(vectorWallBands([...room,rect('apart',220,0,100,10)])).toHaveLength(5);});

it('keeps the same wall style when the page is rendered at a different resolution',()=>{const scaled=room.map(r=>({...r,x:r.x*2,y:r.y*2,width:r.width*2,height:r.height*2}));expect(vectorWallBands(scaled,4800)).toHaveLength(vectorWallBands(room,2400).length);expect(vectorWallBands(room,NaN)).toEqual([]);});
