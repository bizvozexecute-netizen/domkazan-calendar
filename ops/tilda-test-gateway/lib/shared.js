const allowedOrigin = 'https://domkazan116.ru';
const allowedRefererPath = process.env.TILDA_TEST_PAGE_PATH || '';

export function cors(request, method) {
  const origin = request.headers.get('origin');
  return {
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    ...(origin === allowedOrigin ? {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': `${method}, OPTIONS`,
      'Access-Control-Allow-Headers': 'Content-Type',
    } : {}),
  };
}

export function checkBrowserSource(request) {
  if (request.headers.get('origin') !== allowedOrigin) return false;
  if (!allowedRefererPath) return true;
  try {
    const referer = new URL(request.headers.get('referer') || '');
    return referer.origin === allowedOrigin && referer.pathname === allowedRefererPath;
  } catch { return false; }
}

export function json(data, status, headers) {
  return Response.json(data, { status, headers });
}

export function upstream(path) {
  const configured = process.env.GATEWAY_UPSTREAM_ORIGIN || '';
  const url = new URL(configured);
  if (url.protocol !== 'https:' || !/^domkazan-calendar-test-[a-z0-9-]+\.vercel\.app$/.test(url.hostname) ||
      url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('Invalid upstream');
  return new URL(path, url);
}

export function token(request) {
  const value = request.headers.get('x-vercel-oidc-token');
  if (!value) throw new Error('Missing gateway identity');
  return value;
}

export async function proxyJson(request, path, method, body, headers) {
  try {
    const response = await fetch(upstream(path), {
      method,
      headers: { 'x-vercel-trusted-oidc-idp-token': token(request),
        ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body } : {}),
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    });
    if (response.status >= 300 && response.status < 400) throw new Error('Unexpected redirect');
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Non-JSON upstream');
    let result = await response.json();
    if (response.status >= 500 || !Number.isInteger(response.status)) throw new Error('Upstream unavailable');
    if (response.ok && path.startsWith('/api/availability')) {
      if (!Array.isArray(result.houses)) throw new Error('Invalid availability');
      result = { ...result, houses: result.houses.filter(house => /^tilda-\d{12}$/.test(house.slug)) };
    }
    if (response.ok && path === '/api/requests') {
      result = { ...result, message: 'Тестовая заявка сохранена. Бронирование и оплата не создаются.',
        contacts: { phone: null, telegram: null, whatsapp: null } };
    }
    const timing = response.headers.get('server-timing');
    return json(result, response.status, { ...headers, ...(timing ? {'Server-Timing':timing} : {}) });
  } catch {
    return json({ error: 'Тестовый каталог временно недоступен.' }, 503, headers);
  }
}
