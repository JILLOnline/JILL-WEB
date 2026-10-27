// HQ WORK: concurrency gate for OPTIONAL viewport-triggered Owner detail reads.
// No payloads, tokens, customer identity, result caching or browser persistence.
// Explicit Owner row-clicks bypass the queue; the real signed detail route
// remains the ONLY authority for names, item details and personalization.
export function createWorkRequestDetailPrefetchQueue(limit=2){
  if(!Number.isSafeInteger(limit)||limit<1||limit>4)
    throw Error('invalid_detail_prefetch_limit');
  let active=0;
  const waiting=[];
  const drain=()=>{
    while(active<limit && waiting.length>0){
      const job=waiting.shift();
      if(job.released)continue;
      job.started=true;
      active++;
      try{job.start();}catch{
        job.finish(); // A failed launch must not stall future visible rows.
      }
    }
  };
  return Object.freeze({
    schedule(start){
      if(typeof start!=='function')throw Error('invalid_detail_prefetch_task');
      const job={start,started:false,released:false,finish:null};
      job.finish=()=>{
        if(job.released)return;
        job.released=true;
        if(job.started)active--;
        drain();
      };
      waiting.push(job);
      drain();
      return Object.freeze({
        get started(){return job.started;},
        finish:()=>job.finish(),
        cancel:()=>job.finish(),
      });
    },
  });
}
