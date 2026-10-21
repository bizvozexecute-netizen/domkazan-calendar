"use client";
import Script from "next/script";
import {useEffect,useRef,useState} from "react";

declare global { interface Window { DomKazanCatalog?: { mount(options:{root:HTMLElement;apiOrigin:string;privacyUrl:string;pagePath:string;testMode:boolean}):{destroy():void} } } }
export function TestTildaCatalog({policy}:{policy:string}) {
  const root=useRef<HTMLDivElement>(null);
  const [searchReady,setSearchReady]=useState(false);
  const [catalogReady,setCatalogReady]=useState(false);
  useEffect(()=>{
    if(!searchReady||!catalogReady||!root.current||!window.DomKazanCatalog)return;
    const controller=window.DomKazanCatalog.mount({root:root.current,apiOrigin:window.location.origin,privacyUrl:policy,pagePath:'/test-tilda',testMode:true});
    return()=>controller.destroy();
  },[searchReady,catalogReady,policy]);
  return <main><div ref={root}/><Script src="/embed/domkazan-search.js" onReady={()=>setSearchReady(true)}/><Script src="/embed/domkazan-catalog.js" onReady={()=>setCatalogReady(true)}/></main>;
}
