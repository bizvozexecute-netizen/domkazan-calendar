import { checkBrowserSource, cors, json, proxyJson } from '../lib/shared.js';
export function OPTIONS(request) { return new Response(null, {status:204,headers:cors(request,'GET')}); }
export async function GET(request) {
  const headers = cors(request,'GET');
  if (!checkBrowserSource(request)) return json({error:'Только тестовая страница каталога.'},403,headers);
  const params = new URL(request.url).searchParams;
  const house = params.get('house') || '';
  const month = params.get('month') || '';
  if (!/^tilda-\d{12}$/.test(house) || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || [...params.keys()].some(key=>!['house','month'].includes(key))) {
    return json({error:'Укажите дом и месяц.'},400,headers);
  }
  return proxyJson(request,`/api/houses/${house}/calendar?month=${month}`,'GET',null,headers);
}
