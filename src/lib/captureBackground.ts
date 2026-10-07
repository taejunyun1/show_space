import {Color,type Scene,type WebGLRenderer} from 'three';
export interface CaptureBackgroundOptions {transparentBackground?:boolean;includeEnvironment?:boolean}
export function captureBackgroundColor(options:CaptureBackgroundOptions,environmentColor='#e9edf1'):string|null{
 return options.transparentBackground?null:options.includeEnvironment===false?'#ffffff':environmentColor;
}
/** Clear reused composition canvases too, so a prior opaque image cannot survive. */
export function paintCaptureBackground(context:Pick<CanvasRenderingContext2D,'clearRect'|'fillRect'|'fillStyle'>,width:number,height:number,color:string|null){
 context.clearRect(0,0,width,height);if(color!==null){context.fillStyle=color;context.fillRect(0,0,width,height);}
}
/** Applied only after capture resources settle; retain object references for restoration. */
export function beginCaptureBackground(scene:Scene,renderer:Pick<WebGLRenderer,'getClearColor'|'getClearAlpha'|'setClearColor'>,options:CaptureBackgroundOptions){
 const background=scene.background,environment=scene.environment,clearColor=renderer.getClearColor(new Color()).clone(),alpha=renderer.getClearAlpha();
 const color=captureBackgroundColor(options,background instanceof Color?'#'+background.getHexString():'#e9edf1');
 let restored=false;
 const restore=()=>{if(restored)return;restored=true;scene.background=background;scene.environment=environment;renderer.setClearColor(clearColor,alpha);};
 try{
  if(options.transparentBackground||options.includeEnvironment===false)scene.background=null;
  if(options.includeEnvironment===false)scene.environment=null;
  renderer.setClearColor(color??clearColor,color===null?0:1);
  return {color,restore};
 }catch(error){try{restore();}finally{throw error;}}
}
export function capturePlanGridFill(options:{includeGrid:boolean;transparentBackground?:boolean}){
 return options.includeGrid?'url(#plan-grid)':options.transparentBackground?'none':'#ffffff';
}
