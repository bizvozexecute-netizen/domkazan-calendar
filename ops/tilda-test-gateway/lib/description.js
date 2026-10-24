// Owner HTML is represented as text and emphasis, never executable markup.
const entities={nbsp:' ',amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',ndash:'–',mdash:'—',hellip:'…',laquo:'«',raquo:'»',bull:'•'};
function decode(value){return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(all,key)=>{
  if(key[0]!=='#')return entities[key.toLowerCase()]??all;
  const code=key[1]?.toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
  return code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):'�';
});}
export function descriptionContent(value){
  const source=String(value??'');if(source.length>200000)throw new Error('Tilda description exceeds the supported size');
  const clean=source.replace(/<(script|style|iframe|object|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,'')
    .replace(/<a\b[^>]*href\s*=\s*["'](?:https?:\/\/(?:[^/]+\.)?homereserve\.ru\/|https?:\/\/(?:wa\.me|t\.me)\/|tel:)[^"']*["'][^>]*>[\s\S]*?<\/a\s*>/gi,'');
  const segments=[];const depth={bold:0,italic:0,underline:0};const lists=[];let trailing=0;
  const append=text=>{if(!text)return;const previous=segments.at(-1),flags={bold:depth.bold>0,italic:depth.italic>0,underline:depth.underline>0};
    if(previous&&Object.keys(flags).every(key=>previous[key]===flags[key]))previous.text+=text;else segments.push({text,...flags});
    trailing=text.endsWith('\n')?(text.match(/\n*$/)[0].length===text.length?trailing+text.length:text.match(/\n*$/)[0].length):0;
  };
  const newline=count=>append('\n'.repeat(Math.max(0,count-trailing)));
  for(const token of clean.match(/<[^>]*>|[^<]+|</g)||[]){
    if(token[0]!=='<'||token==='<'){append(decode(token.replace(/\r\n?/g,'\n')));continue;}
    const tag=/^<\s*(\/?)\s*([a-z0-9]+)/i.exec(token);if(!tag)continue;
    const closing=Boolean(tag[1]),name=tag[2].toLowerCase(),emphasis={b:'bold',strong:'bold',i:'italic',em:'italic',u:'underline'}[name];
    if(emphasis){depth[emphasis]=Math.max(0,depth[emphasis]+(closing?-1:1));continue;}
    if(name==='br')append('\n');
    else if(name==='ul'||name==='ol'){newline(1);if(closing)lists.pop();else lists.push({ordered:name==='ol',index:0});}
    else if(name==='li'){newline(1);if(!closing){const list=lists.at(-1);append(list?.ordered?`${++list.index}. `:'• ');}}
    else if(['p','div','h1','h2','h3','h4','blockquote'].includes(name))newline(name==='p'?2:1);
  }
  if(segments.length){segments[0].text=segments[0].text.trimStart();segments.at(-1).text=segments.at(-1).text.trimEnd();}
  return segments.filter(segment=>segment.text);
}
export function descriptionText(value){return descriptionContent(value).map(segment=>segment.text).join('');}
