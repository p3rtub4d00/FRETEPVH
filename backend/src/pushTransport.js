// One bounded retry for temporary gateway/network failures. Permanent errors
// (including expired subscriptions and invalid VAPID credentials) are not retried.
export async function postPush(endpoint, options, {
  request = fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms))
} = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    try {
      response = await request(endpoint, { ...options, signal: AbortSignal.timeout(6500) });
    } catch (error) {
      if (attempt) throw error;
      await wait(350);
      continue;
    }
    const temporary = response.status === 429 || response.status >= 500;
    if (!temporary || attempt) return response;
    const raw = response.headers?.get('retry-after');
    const delay = raw ? (/^\d+$/.test(raw) ? Number(raw) * 1000 : Date.parse(raw) - Date.now()) : 350;
    // Respect longer backoffs without holding the HTTP request open.
    if (!Number.isFinite(delay) || delay > 2000) return response;
    await response.body?.cancel().catch(() => {});
    await wait(Math.max(350, delay));
  }
}
