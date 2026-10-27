// Source-only HQ quote Save single-flight guard.
// Reserve synchronously before invoking a potentially consequential D1 POST.
// A failed, ambiguous or acknowledged POST DOES NOT release the reservation.
// Only a separately verified readback may release it. No I/O or storage.
export function createWorkQuoteSaveFlight(){
 let reserved=false;
 return Object.freeze({
  reserve(){
   if(reserved)return false;
   reserved=true;
   return true;
  },
  isReserved(){return reserved;},
  verifiedRelease(){reserved=false;},
 });
}
