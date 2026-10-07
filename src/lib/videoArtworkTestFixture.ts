/** Container-header fixture only. Native codec proof uses a real generated clip. */
export const testVideoArtwork=()=>({dataUrl:'data:video/mp4;base64,'+btoa(String.fromCharCode(0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0)),widthPx:640,heightPx:360,durationSeconds:3,loop:true,fit:'contain' as const});
