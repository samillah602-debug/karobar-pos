export function validOrigin(request: Request, onVercel = process.env.VERCEL === '1') {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const internal = new URL(request.url);
  // Next.js may reconstruct request.url with an internal hostname. The Host
  // header identifies the public origin the browser actually requested.
  const host = request.headers.get('host') || internal.host;
  const protocol = onVercel ? 'https:' : internal.protocol;
  return origin === `${protocol}//${host}`;
}
