import { checkBrowserSource, cors, json, proxyJson } from '../lib/shared.js';
export function OPTIONS(request) { return new Response(null, {status:204, headers:cors(request,'GET')}); }
export async function GET(request) {
  const headers=cors(request,'GET');
  if(!checkBrowserSource(request))return json({error:'Только тестовая страница каталога.'},403,headers);
  return proxyJson(request,'/api/client-settings','GET',null,headers);
}
