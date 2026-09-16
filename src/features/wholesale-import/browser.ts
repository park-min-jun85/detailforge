import "server-only";
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { fetchResource, decodeHtml, type ResourceKind } from "./fetcher";
import { resolvePublic } from "./security";
import { ImportError } from "./errors";
export async function renderedHtml(url:string,signal:AbortSignal,dependencies:{fetch?:typeof fetchResource;resolve?:typeof resolvePublic}={}) {
  await (dependencies.resolve??resolvePublic)(url);if(!existsSync(chromium.executablePath()))throw new ImportError("browser_missing");
  const browser=await chromium.launch({headless:true,timeout:10000,args:["--force-webrtc-ip-handling-policy=disable_non_proxied_udp","--disable-quic","--host-resolver-rules=MAP * ~NOTFOUND"]});
  const close=()=>{void browser.close().catch(()=>{});};signal.addEventListener("abort",close,{once:true});
  try {
    if(signal.aborted)throw new ImportError("timeout");
    const context=await browser.newContext({serviceWorkers:"block",acceptDownloads:false});
    await context.addInitScript(()=>{for(const name of ["RTCPeerConnection","webkitRTCPeerConnection","WebTransport"])Object.defineProperty(globalThis,name,{value:undefined,configurable:false});});
    await context.routeWebSocket("**/*",socket=>socket.close());
    let requests=0,total=0,mainError:ImportError|undefined;
    await context.route("**/*",async route=>{
      const request=route.request(),type=request.resourceType();
      if(request.method()!=="GET"||++requests>60||!["document","script","stylesheet","xhr","fetch"].includes(type)){await route.abort();return;}
      // No direct browser network: every HTTP request is fulfilled through DNS-pinned transport.
      const kind:ResourceKind=type==="document"?"html":type==="script"?"script":type==="stylesheet"?"style":"json";
      try {const resource=await (dependencies.fetch??fetchResource)(request.url(),kind,{signal});total+=resource.bytes.length;if(total>20*1024*1024)throw new ImportError("too_large");
        await route.fulfill({status:200,contentType:`${resource.mime}; charset=${kind==="html"?"utf-8":resource.charset??"utf-8"}`,body:kind==="html"?Buffer.from(decodeHtml(resource),"utf8"):resource.bytes});
      }catch(error){if(type==="document")mainError=error instanceof ImportError?error:new ImportError("unavailable");await route.abort().catch(()=>{});}
    });
    const page=await context.newPage();page.setDefaultTimeout(5000);
    await page.goto(url,{waitUntil:"networkidle",timeout:20000}).catch(()=>{if(mainError)throw mainError;if(signal.aborted)throw new ImportError("timeout");});
    if(mainError)throw mainError;
    const html=await page.content();if(Buffer.byteLength(html)>2*1024*1024)throw new ImportError("too_large");return html;
  }catch(error){throw error instanceof ImportError?error:new ImportError(signal.aborted?"timeout":"unavailable");}
  finally{signal.removeEventListener("abort",close);await browser.close().catch(()=>{});}
}
