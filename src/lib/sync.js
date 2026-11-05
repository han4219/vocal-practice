export const SYNC_BATCH_SIZE = 100;
// Freeze the clicked batch. Actions performed during a sync wait for the next click.
export async function syncQueued({ client, queue, isCurrent = ()=>true, onBatch }) {
  const snapshot = [...new Map(queue.map(op=>[op.id,op])).values()];
  for (let i=0;i<snapshot.length;i+=SYNC_BATCH_SIZE) {
    if (!isCurrent()) return;
    const batch=snapshot.slice(i,i+SYNC_BATCH_SIZE);
    const {data,error}=await client.rpc('voca_sync_operations',{ops:batch});
    if (error) throw error;
    if (!isCurrent()) return;
    if (!data?.state || !Array.isArray(data.acknowledged) || data.acknowledged.length!==batch.length || batch.some(op=>!data.acknowledged.includes(op.id))) throw new Error('Máy chủ chưa xác nhận đầy đủ thay đổi. Hãy thử đồng bộ lại.');
    await onBatch(data);
  }
}
export const needsExitWarning = (owner,pending,storageFailed=false) => storageFailed || (owner!=='guest' && pending>0);
