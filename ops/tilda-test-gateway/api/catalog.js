import { checkBrowserSource, cors, json } from '../lib/shared.js';
import { loadCatalog } from '../lib/catalog.js';

export function OPTIONS(request) { return new Response(null, { status: 204, headers: cors(request, 'GET') }); }
export async function GET(request) {
  const headers = cors(request, 'GET');
  if (!checkBrowserSource(request)) return json({ error: 'Только тестовая страница каталога.' }, 403, headers);
  try { return json(await loadCatalog(), 200, headers); }
  catch { return json({ error: 'Не удалось загрузить описания домов. Повторите попытку.' }, 503, headers); }
}
