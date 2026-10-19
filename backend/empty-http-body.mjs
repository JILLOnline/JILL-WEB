// HTTP runtimes may represent a zero-byte POST as a non-null stream.
// Accept only EOF or one empty chunk followed by EOF, with bounded work/time.
export async function hasEmptyHttpBody(request) {
  if(request.body===null)return true;
  let reader,timer;
  try {
    reader=request.body.getReader();
    const read=async()=>{
      const first=await reader.read();
      if(first.value?.byteLength)return false;
      if(first.done)return true;
      const last=await reader.read();
      return last.done===true&&!last.value?.byteLength;
    };
    return await Promise.race([read(),new Promise(resolve=>{
      timer=setTimeout(()=>resolve(false),1000);
    })]);
  } catch {return false;}
  finally {
    clearTimeout(timer);
    // A malicious/stalled producer must not hold the caller on cancellation.
    if(reader)reader.cancel().catch(()=>{});
  }
}
