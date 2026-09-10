export const previewPrefix=location.pathname.match(/^\/preview\/[a-f0-9]{64}(?=\/)/)?.[0]??'';
export const isPreview=Boolean(previewPrefix);
export const viewerUrl=(path:string)=>previewPrefix+path;
