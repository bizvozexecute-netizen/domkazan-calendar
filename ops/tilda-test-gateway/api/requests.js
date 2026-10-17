import { checkBrowserSource, cors, json, proxyJson } from '../lib/shared.js';

export function OPTIONS(request) { return new Response(null, { status: 204, headers: cors(request, 'POST') }); }

export async function POST(request) {
  const headers = cors(request, 'POST');
  if (!checkBrowserSource(request)) return json({ error: 'Только тестовая страница каталога.' }, 403, headers);
  if (!request.headers.get('content-type')?.startsWith('application/json') ||
      Number(request.headers.get('content-length')) > 8192) return json({ error: 'Ожидается небольшой JSON-запрос.' }, 415, headers);
  let body;
  let data;
  try {
    body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 8192) throw new Error('Too large');
    data = JSON.parse(body);
    if (data?.clientName !== 'Тестовый Гость' || data?.clientPhone !== '+70000000000' ||
        data?.messenger || data?.messengerContact || data?.consent !== true || data?.website ||
        data?.privacyPolicyUrl !== `${new URL(request.url).origin}/test-policy`) throw new Error('Not synthetic');
  } catch { return json({ error: 'Разрешены только вымышленные заявки: Тестовый Гость, +70000000000.' }, 400, headers); }
  const query = new URLSearchParams({ checkIn: String(data.checkIn || ''), checkOut: String(data.checkOut || ''),
    guests: String(data.guestCount ?? '') });
  const availability = await proxyJson(request, `/api/availability?${query}`, 'GET', null, headers);
  if (!availability.ok) return availability;
  const catalog = await availability.json();
  if (!catalog.houses?.some(house => house.id === data.houseId)) {
    return json({ error: 'Выберите доступный дом из тестового каталога.' }, 409, headers);
  }
  return proxyJson(request, '/api/requests', 'POST', body, headers);
}
