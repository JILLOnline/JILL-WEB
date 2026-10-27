// HQ WORK: limited leases for OPTIONAL viewport-triggered Owner detail reads.
// No payloads, tokens, customer identity, result caching or browser persistence.
// An already-started request cannot free its slot on row unmount/cancel:
// the signed fetch must finish (or hit a bounded fallback deadline).
// Explicit Owner clicks continue to bypass OPTIONAL prefetch scheduling.
export function createWorkRequestDetailPrefetchQueue(limit=2,{
  timeoutMs=30000,
  setTimer=setTimeout,
  clearTimer=clearTimeout,
}={}){
  if(!Number.isSafeInteger(limit)||limit<1||limit>4)
    throw Error('invalid_detail_prefetch_limit');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>60000||
    typeof setTimer!=='function'||typeof clearTimer!=='function')
    throw Error('invalid_detail_prefetch_timeout');
  let active=0;
  const waiting=[];
  const drain=()=>{
    while(active<limit && waiting.length>0){
      const job=waiting.shift();
      if(job.released)continue;
      job.started=true;
      active++;
      try{
        // Abandoned/unmounted fetchers may never report idle. Reclaim the
        // slot eventually, without storing any response or initiating retries.
        job.timer=setTimer(job.finish,timeoutMs);
        job.start();
      }catch{
        job.finish(); // Failed launches cannot starve later visible rows.
      }
    }
  };
  return Object.freeze({
    schedule(start){
      if(typeof start!=='function')throw Error('invalid_detail_prefetch_task');
      const job={start,started:false,released:false,timer:null,finish:null};
      job.finish=()=>{
        if(job.released)return;
        job.released=true;
        if(job.timer!==null)clearTimer(job.timer);
        if(job.started)active--;
        drain();
      };
      waiting.push(job);
      drain();
      return Object.freeze({
        get started(){return job.started;},
        finish:()=>job.finish(),
        cancel:()=>{
          // Discard a queued row immediately; but a running request may
          // still consume the network slot. Its fetcher or deadline owns it.
          if(!job.started)job.finish();
        },
      });
    },
  });
}
