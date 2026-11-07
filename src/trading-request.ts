import { transactionResponseError } from './funding.ts';

/** Bound HTTP/body reads independently from chain confirmation. A lost submit
 * response is recovered only with the identical idempotent server ticket. */
export async function tradingRequest(
  url: '/api/sponsor/prepare' | '/api/sponsor/submit',
  data: unknown,
  fetcher: typeof fetch,
  timeoutMs = 15_000,
) {
  const body = JSON.stringify(data);
  const submitted = url === '/api/sponsor/submit';
  const attempt = async () => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        fetcher(url, {method:'POST', headers:{'content-type':'application/json'}, body, signal:controller.signal})
          .then(async response => ({ok:response.ok, value:await response.json()})),
        new Promise<never>((_,reject) => { timer=setTimeout(() => {
          reject(new TypeError('Trading request timed out'));
          controller.abort();
        }, timeoutMs); }),
      ]);
      // A definite HTTP rejection must not trigger the transport-recovery path.
      if(!result.ok) throw transactionResponseError(result.value);
      return result.value;
    } finally { clearTimeout(timer); controller.abort(); }
  };
  try { return await attempt(); }
  catch (error) {
    if(!(error instanceof TypeError || error instanceof SyntaxError)) throw error;
    if(!submitted) throw Error('Could not prepare the transaction. Nothing was submitted; please try again.');
    try { return await attempt(); }
    catch {
      throw Error('Submission outcome is unknown. Check positions and trading balances before retrying; no replacement transaction was sent.');
    }
  }
}
