export const catalogSource = 'https://store.tildaapi.com/api/getproductslist/?storepartuid=213912569062&recid=4148990801&getparts=true&getoptions=true&size=100';

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
    // descr excludes the shared booking/contact HTML stored in product.text.
    const description = plain(product.descr);
    const facts = description.split(/\n[—–-]\n|\nБудни\s*[-–—:]/i)[0];
    let rawGallery;
    try { rawGallery = typeof product.gallery === 'string' ? JSON.parse(product.gallery) : product.gallery; } catch { rawGallery = []; }
    const images = [...new Set((Array.isArray(rawGallery) ? rawGallery : []).map(item => item.img).filter(value => {
      try { const url = new URL(value); return url.protocol === 'https:' && /(^|\.)tildacdn\.(com|info|net|pub)$/.test(url.hostname); } catch { return false; }
    }))].slice(0, 50);
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
      description, facts, images, amenities,
      maxGuests: Number(facts.match(/вместимост[ьи]?\s*(?:до\s*)?(\d+)\s*гост/i)?.[1]) || null,
      bedrooms: Number(facts.match(/(\d+)\s*спал(?:ьн|ен)/i)?.[1]) || null,
      beds: Number(facts.match(/(\d+)\s*спальн[ыо][хе]\s*мест/i)?.[1]) || null,
      publicBaseRates: rates,
      includedGuests: supplement ? Number(supplement[1]) : null,
      extraGuestPrice: supplement ? Number(supplement[2].replace(/\s/g, '')) : 0,
      serviceFee: service ? Number(service[1].replace(/\s/g, '')) : 0,
    };
  });
  return { products };
}

let cached;
export async function loadCatalog() {
  if (cached && cached.expires > Date.now()) return cached.value;
  const response = await fetch(catalogSource, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Tilda unavailable');
  const value = publicCatalog(await response.json());
  cached = { value, expires: Date.now() + 60000 };
  return value;
}
