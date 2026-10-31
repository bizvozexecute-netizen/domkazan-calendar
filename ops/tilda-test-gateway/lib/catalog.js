import {descriptionContent,descriptionText} from './description.js';
export const catalogSource = 'https://store.tildaapi.com/api/getproductslist/?storepartuid=213912569062&recid=4148990801&getparts=true&getoptions=true&size=100';

export function normalizeRutube(value) {
  try {
    const url = new URL(String(value).trim());
    const id = url.pathname.match(/^\/(?:shorts|video(?:\/private)?|play\/embed)\/([a-f0-9]{32})\/?$/i)?.[1];
    if (url.protocol !== 'https:' || url.hostname !== 'rutube.ru' || url.username || url.password || url.port || !id) return null;
    const result = new URL(`https://rutube.ru/video/${id}/`);
    const access = url.searchParams.get('p');
    if (access && /^[a-z0-9_-]{1,200}$/i.test(access)) result.searchParams.set('p', access);
    if (url.pathname.includes('/private/') && !result.searchParams.has('p')) return null;
    return result.href;
  } catch { return null; }
}

export function plain(value) {
  return String(value ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?\s*>|<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\r/g, '')
    .split('\n').map(line => line.trim()).filter(Boolean).join('\n').slice(0, 10000);
}

export function publicCatalog(data) {
  if (!Array.isArray(data.products) || data.products.length !== Number(data.total) || data.products.length > 500) {
    throw new Error('Incomplete Tilda catalog');
  }
  const seen = new Set();
  const products = data.products.map(product => {
    const uid = String(product.uid);
    if (!/^\d{12}$/.test(uid) || seen.has(uid)) throw new Error('Invalid Tilda UID');
    seen.add(uid);
    // Full text is the owner's Tilda editor; descr is only a short preview.
    const full=descriptionContent(product.text);
    const content=full.some(segment=>segment.text.trim())?full:descriptionContent(product.descr);
    const description=content.map(segment=>segment.text).join('');
    const facts = (descriptionText(product.descr)||description).split(/\n[—–-]\n|\nБудни\s*[-–—:]/i)[0];
    let rawGallery;
    try { rawGallery = typeof product.gallery === 'string' ? JSON.parse(product.gallery) : product.gallery; } catch { rawGallery = []; }
    const images = [...new Set((Array.isArray(rawGallery) ? rawGallery : []).map(item => item.img).filter(value => {
      try { const url = new URL(value); return url.protocol === 'https:' && /(^|\.)tildacdn\.(com|info|net|pub)$/.test(url.hostname); } catch { return false; }
    }))].slice(0, 50);
    const videoCandidates = [...(Array.isArray(rawGallery) ? rawGallery.flatMap(item => [item.video, item.url]) : []),
      ...(String(product.text||'').replace(/&amp;/gi,'&').match(/https:\/\/rutube\.ru\/[^\s<>"']+/gi)||[]),
      ...(description.match(/https:\/\/rutube\.ru\/[^\s<>"']+/gi) || [])];
    const rutubeUrl = videoCandidates.map(normalizeRutube).find(Boolean) || null;
    const has = expression => expression.test(facts);
    const amenities = [];
    if (has(/бассейн/i)) amenities.push('pool');
    if (has(/баня|бани|саун/i)) amenities.push('sauna');
    if (has(/бильярд/i)) amenities.push('billiards');
    if (has(/джакузи/i)) amenities.push('jacuzzi');
    if (has(/фурако|чан\b/i)) amenities.push('tub');
    if (has(/мангал|барбекю/i)) amenities.push('bbq');
    if (has(/wi-?fi|вай.?фай/i)) amenities.push('wifi');
    const rates = {};
    for (const [key, label] of [['weekday', 'будни'], ['friday', 'пятница'], ['saturday', 'суббота'], ['sunday', 'воскресенье']]) {
      const match = description.match(new RegExp(`${label}\\s*[-–—:]?\\s*([\\d\\s]+)\\s*(?:₽|руб)`, 'iu'));
      rates[key] = match ? Number(match[1].replace(/\s/g, '')) : null;
    }
    const supplement = description.match(/(?:цен[аы]|стоимость)[^\n]*?до\s*(\d+)\s*(?:чел|гост)[^\n]*?(?:далее|свыше)[^\d\n]*([\d\s]+)\s*(?:₽|руб)\s*\/\s*чел/i);
    const service = description.match(/сервисный сбор[^\n]*?[-–—:]\s*([\d\s]+)\s*(?:₽|руб)/i);
    return { productUid: uid, slug: `tilda-${uid}`, name: plain(product.title).slice(0, 120),
      description, descriptionContent:content, facts, images, amenities, rutubeUrl,
      maxGuests: Number(facts.match(/вместимост[ьи]?\s*(?:до\s*)?(\d+)\s*гост/i)?.[1]) || null,
      bedrooms: Number(facts.match(/(\d+)\s*(?:спальня|спальни|спален)(?![а-яё])/i)?.[1]) || null,
      beds: Number(facts.match(/(\d+)\s*спальн[ыо][хе]\s*мест/i)?.[1]) || null,
      publicBaseRates: rates,
      includedGuests: supplement ? Number(supplement[1]) : null,
      extraGuestPrice: supplement ? Number(supplement[2].replace(/\s/g, '')) : 0,
      serviceFee: service ? Number(service[1].replace(/\s/g, '')) : 0,
    };
  });
  return { products };
}

let inFlight;
export async function loadCatalog() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    // Coalesce concurrent reads, but do not keep a process-local content cache:
    // publishing Tilda and reloading must not require a new app deployment.
    const products=[];let total;
    for(let page=1;page<=5;page++){
      const url=new URL(catalogSource);url.searchParams.set('slice',String(page));
      const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(4000)});
      if(!response.ok)throw new Error('Tilda unavailable');
      const data=await response.json();total??=Number(data.total);
      if(!Number.isInteger(total)||total<0||total>500||Number(data.total)!==total||!Array.isArray(data.products))throw new Error('Incomplete Tilda catalog');
      products.push(...data.products);if(products.length===total)return publicCatalog({products,total});
      if(!data.products.length||products.length>total)throw new Error('Incomplete Tilda catalog');
    }
    throw new Error('Incomplete Tilda catalog');
  })();
  try { return await inFlight; }
  finally { inFlight = null; }
}
