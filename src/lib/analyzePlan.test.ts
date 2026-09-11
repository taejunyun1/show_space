import{it,expect,vi,beforeEach}from'vitest';
import{analyzePlan}from'./analyzePlan';
import{readPlanOcr}from'./readPlanOcr';
import{detectPlanWalls}from'./detectPlanWalls';
vi.mock('./readPlanOcr',()=>({readPlanOcr:vi.fn()}));vi.mock('./detectPlanWalls',()=>({detectPlanWalls:vi.fn()}));
const page={imageUrl:'image',widthPx:100,heightPx:100,textSource:'none' as const};
beforeEach(()=>{vi.resetAllMocks();vi.mocked(readPlanOcr).mockResolvedValue([{text:'3200',source:'ocr',box:{x:0,y:0,width:40,height:10}}]);vi.mocked(detectPlanWalls).mockResolvedValue([{id:'line',start:{x:0,y:0},end:{x:90,y:0},thicknessPx:1}]);});
it('automatically combines OCR and line analysis without changing input',async()=>{const result=await analyzePlan(page,new AbortController().signal);expect(result.analysis).toMatchObject({numericCount:1,textState:'complete',lineState:'complete'});expect(result.analysis?.lines).toHaveLength(1);expect(result.labels?.[0].text).toBe('3200');expect(page).not.toHaveProperty('analysis');});
it('uses existing PDF evidence instead of running redundant OCR',async()=>{const result=await analyzePlan({...page,textSource:'pdf-text',labels:[{id:'pdf-1',text:'8000 mm',source:'pdf-text',kind:'dimension',status:'unreviewed',note:'',box:{x:0,y:0,width:30,height:10}}]},new AbortController().signal);expect(readPlanOcr).not.toHaveBeenCalled();expect(result.textSource).toBe('pdf-text');expect(detectPlanWalls).toHaveBeenCalledTimes(3);});
it('preserves partial results and reports failed stages',async()=>{vi.mocked(readPlanOcr).mockRejectedValue(new Error('OCR failed'));const result=await analyzePlan(page,new AbortController().signal);expect(result.analysis?.textState).toBe('failed');expect(result.analysis?.lines).toHaveLength(1);expect(result.analysis?.issues.join(' ')).toContain('읽지 못');});
it('does not deliver a completed result after cancellation',async()=>{const c=new AbortController();vi.mocked(readPlanOcr).mockImplementation(async()=>{c.abort();return [];});await expect(analyzePlan(page,c.signal)).rejects.toThrow('취소');});

it('automatically falls back to local OCR for an empty PDF text result',async()=>{const result=await analyzePlan({...page,textSource:'pdf-text',labels:[]},new AbortController().signal);expect(readPlanOcr).toHaveBeenCalledTimes(12);expect(result.textSource).toBe('ocr');});
it('withholds geometry that fails local reanalysis rather than requesting manual verification',async()=>{const result=await analyzePlan(page,new AbortController().signal);expect(result.analysis?.selfCheck).toEqual({attempts:3,status:'withheld'});expect(result.analysis?.issues.join(' ')).not.toContain('확인하세요');});
it('stops automatic retries immediately when cancelled',async()=>{const c=new AbortController();vi.mocked(detectPlanWalls).mockImplementationOnce(async()=>[]).mockImplementationOnce(async()=>{c.abort();return [];});await expect(analyzePlan(page,c.signal)).rejects.toThrow('취소');expect(detectPlanWalls).toHaveBeenCalledTimes(2);});
function closedPage(){
 const line=(id:string,x:number,y:number,x2:number,y2:number,t=1)=>({id,start:{x,y},end:{x:x2,y:y2},thicknessPx:t});
 const lines=[line('a',100,100,900,100,5),line('b',900,100,900,700,5),line('c',900,700,100,700,5),line('d',100,700,100,100,5),line('dx',100,60,900,60),line('wx1',100,50,100,105),line('wx2',900,50,900,105),line('dy',60,100,60,700),line('wy1',50,100,105,100),line('wy2',50,700,105,700)];
 const labels=[{id:'x',text:'8000 mm',box:{x:400,y:30,width:100,height:20}},{id:'y',text:'6000 mm',box:{x:30,y:350,width:20,height:80}}].map(l=>({...l,source:'pdf-text' as const,kind:'dimension' as const,status:'unreviewed' as const,note:''}));
 return {input:{imageUrl:'image',widthPx:1000,heightPx:800,textSource:'pdf-text' as const,labels},lines};
}
it('automatically accepts matching closed geometry after independent passes',async()=>{const {input,lines}=closedPage();vi.mocked(detectPlanWalls).mockResolvedValue(lines);const result=await analyzePlan(input,new AbortController().signal);expect(result.analysis?.selfCheck?.status).toBe('stable');});
it('vetoes a conflicting successful third pass instead of majority voting',async()=>{const {input,lines}=closedPage(),partition={id:'partition',start:{x:300,y:300},end:{x:700,y:300},thicknessPx:5};vi.mocked(detectPlanWalls).mockResolvedValueOnce(lines).mockResolvedValueOnce(lines).mockResolvedValueOnce([...lines,partition]);const result=await analyzePlan(input,new AbortController().signal);expect(result.analysis?.selfCheck?.status).toBe('withheld');});
it('does not mistake a single successful pass for verified geometry',async()=>{const {input,lines}=closedPage();vi.mocked(detectPlanWalls).mockResolvedValueOnce(lines).mockResolvedValue([]);const result=await analyzePlan(input,new AbortController().signal);expect(result.analysis?.selfCheck?.status).toBe('withheld');});
it('cancels during a rotated OCR pass without starting more orientations',async()=>{const c=new AbortController();vi.mocked(readPlanOcr).mockResolvedValueOnce([]).mockImplementationOnce(async()=>{c.abort();return [];});await expect(analyzePlan(page,c.signal)).rejects.toThrow('취소');expect(readPlanOcr).toHaveBeenCalledTimes(2);});

it('merges newly recovered tile numbers and cancels before subsequent tiles',async()=>{
 vi.mocked(readPlanOcr).mockImplementation(async(_url,_signal,_progress,_mode,_rotation,region)=>region?[{text:'125',source:'ocr',confidence:96,box:{x:40,y:50,width:10,height:30}}]:[]);
 const r=await analyzePlan(page,new AbortController().signal);expect(r.labels?.filter(l=>l.text==='125')).toHaveLength(1);
 const c=new AbortController();vi.mocked(readPlanOcr).mockClear();
 vi.mocked(readPlanOcr).mockImplementation(async(_url,_signal,_progress,_mode,_rotation,region)=>{if(region)c.abort();return [];});
 await expect(analyzePlan(page,c.signal)).rejects.toThrow('취소');expect(readPlanOcr).toHaveBeenCalledTimes(5);
});
