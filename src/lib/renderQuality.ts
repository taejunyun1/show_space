export type RenderQuality='edit'|'preview';
export function renderProfile(quality:RenderQuality,capture=false){return quality==='preview'||capture?{maxDpr:1.75,shadowBudget:4,spotShadowSize:1024,baseShadowSize:2048}:{maxDpr:1,shadowBudget:2,spotShadowSize:512,baseShadowSize:1024};}
