import { checkBrowserSource, cors, json, proxyJson } from '../lib/shared.js';

export function OPTIONS(request) { return new Response(null, { status: 204, headers: cors(request, 'GET') }); }

export async function GET(request) {
  const headers = cors(request, 'GET');
  if (!checkBrowserSource(request)) return json({ error: 'Только тестовая страница каталога.' }, 403, headers);
  const url = new URL(request.url);
  const allowed = new Set(['checkIn', 'checkOut', 'guests', 'district', 'bedrooms', 'amenities', 'petsAllowed']);
  if ([...url.searchParams.keys()].some(key => !allowed.has(key)) || url.search.length > 1024) {
    return json({ error: 'Некорректные параметры поиска.' }, 400, headers);
  }
  return proxyJson(request, `/api/availability${url.search}`, 'GET', null, headers);
}
