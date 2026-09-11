/** PDF font mappings can produce nonempty strings full of control/private-use glyphs.
 * Their presence must not suppress image OCR. Ordinary multilingual text is retained. */
export function assessPdfText(items:unknown[]){
 const text=items.flatMap(item=>item&&typeof item==='object'&&'str' in item&&typeof item.str==='string'?[item.str]:[]).join('');
 const characters=[...text].filter(c=>!/[\t\r\n ]/.test(c)).length;
 const badCharacters=(text.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ue000-\uf8ff\ufffd]/g)??[]).length;
 return {usable:characters>0&&!(badCharacters>=3&&badCharacters/characters>=.01),characters,badCharacters};
}
