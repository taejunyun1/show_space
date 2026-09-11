export interface PageRasterProfile {lightFraction:number;midToneFraction:number;coloredFraction:number}
/** Sampling only guides page ordering. It cannot establish whether a page is a
 * floor plan; dark scans and colored drawings must remain eligible for analysis. */
export function pageRasterProfile(data:Uint8ClampedArray):PageRasterProfile{
 let light=0,mid=0,colored=0,total=0;
 const stride=Math.max(1,Math.floor(data.length/4/40000));
 for(let pixel=0;pixel<data.length/4;pixel+=stride){
  const i=pixel*4,a=data[i+3]/255,r=data[i]*a+255*(1-a),g=data[i+1]*a+255*(1-a),b=data[i+2]*a+255*(1-a),l=.2126*r+.7152*g+.0722*b;
  total++;if(l>=235)light++;if(l>55&&l<235)mid++;if(Math.max(r,g,b)-Math.min(r,g,b)>30)colored++;
 }
 return {lightFraction:total?light/total:0,midToneFraction:total?mid/total:0,coloredFraction:total?colored/total:0};
}
