import {notFound} from "next/navigation";
import {testCatalogEnabled} from "@/lib/test-catalog";
import {privacyPolicyUrl} from "@/lib/request-security";
import {TestTildaCatalog} from "@/components/test-tilda-catalog";
export const dynamic="force-dynamic";
export const metadata={title:"DomKazan — проверка доработок",robots:{index:false,follow:false}};
export default function TestTildaPage(){
  if(!testCatalogEnabled())notFound();
  return <TestTildaCatalog policy={privacyPolicyUrl()||''}/>;
}
