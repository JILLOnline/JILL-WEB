// Deterministic local Storage + exclusive Web Locks fixtures; no browser I/O.
export function createQuoteRecoveryBrowser(){
 const data=new Map(),queues=new Map();
 const storage={
  getItem:key=>data.get(key)??null,
  setItem:(key,value)=>{data.set(key,value);},
  removeItem:key=>{data.delete(key);},
 };
 const locks={request(key,callback){
  const next=(queues.get(key)??Promise.resolve()).then(callback);
  queues.set(key,next.catch(()=>{}));
  return next;
 }};
 return {storage,locks,data};
}
