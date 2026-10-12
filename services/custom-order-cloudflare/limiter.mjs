// Shared global SHOP quota and per-client quota are applied in ONE
// SQLite-backed Durable Object. No KV eventual-consistency race and
// no process-local reset/fallback. Cloudflare Free supports SQLite DOs.
export function consumeQuota(sql,{bucket,client,shopLimit=30,clientLimit=6}) {
  if(!Number.isSafeInteger(bucket)||bucket<0 ||
     !/^[a-f0-9]{32}$|^unknown$/.test(client) ||
     !Number.isSafeInteger(shopLimit)||shopLimit<1 ||
     !Number.isSafeInteger(clientLimit)||clientLimit<1) {
    throw new Error('Invalid WORK quota dimensions.');
  }
  sql.exec('CREATE TABLE IF NOT EXISTS quotas (bucket INTEGER NOT NULL, kind TEXT NOT NULL, client TEXT NOT NULL, hits INTEGER NOT NULL, PRIMARY KEY (bucket,kind,client))');
  sql.exec('DELETE FROM quotas WHERE bucket < ?',bucket-3);
  for (const [kind,key] of [['shop','global'],['client',client]]) {
    sql.exec('INSERT INTO quotas (bucket,kind,client,hits) VALUES (?,?,?,1) ON CONFLICT(bucket,kind,client) DO UPDATE SET hits=hits+1',
      bucket,kind,key);
  }
  const shop=sql.exec('SELECT hits FROM quotas WHERE bucket=? AND kind=? AND client=?',
    bucket,'shop','global').one()?.hits;
  const personal=sql.exec('SELECT hits FROM quotas WHERE bucket=? AND kind=? AND client=?',
    bucket,'client',client).one()?.hits;
  return shop<=shopLimit&&personal<=clientLimit;
}
