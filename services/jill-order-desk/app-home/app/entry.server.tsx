import {renderToReadableStream} from "react-dom/server";
import {ServerRouter,type EntryContext} from "react-router";
import {isbot} from "isbot";

// React Router's optional default entry uses Node's renderToPipeableStream.
// Cloudflare Workers exposes Web Streams, so use React's Web Streams renderer.
// Keep this one canonical SSR entry for both WORK and WORK-canary bundles.
export default async function handleRequest(
  request:Request,
  responseStatusCode:number,
  responseHeaders:Headers,
  routerContext:EntryContext,
) {
  let shellRendered=false;
  const stream=await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url}/>,
    {
      signal:request.signal,
      onError(_error:unknown) {
        responseStatusCode=500;
        if(shellRendered) {
          // No exception string; never log Shopify session tokens or secrets.
          console.error("JILL_WORK_STREAM_RENDER_ERROR");
        }
      },
    }
  );
  shellRendered=true;
  if(isbot(request.headers.get("user-agent") || "") || routerContext.isSpaMode)
    await stream.allReady;
  responseHeaders.set("Content-Type","text/html; charset=utf-8");
  return new Response(stream,{
    status:responseStatusCode,
    headers:responseHeaders,
  });
}
