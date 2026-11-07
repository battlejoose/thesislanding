// Validate the existing deployment connection without logging credentials.
const names = ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'];
const missing = names.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Missing deployment secrets: ${missing.join(', ')}`);
  process.exit(1);
}

const secrets = names.map((name) => process.env[name]);
const redact = (value) => secrets.reduce(
  (result, secret) => result.replaceAll(secret, '[redacted]'),
  String(value),
);
const url = new URL(
  `/v9/projects/${encodeURIComponent(process.env.VERCEL_PROJECT_ID)}`,
  'https://api.vercel.com',
);
url.searchParams.set('teamId', process.env.VERCEL_ORG_ID);

try {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    console.error(`Vercel project access failed (HTTP ${response.status}).`);
    if (body.error?.code) console.error(redact(body.error.code));
    if (body.error?.message) console.error(redact(body.error.message));
    console.error('Check the repository deployment secrets against the existing Vercel project.');
    process.exitCode = 1;
  } else {
    console.log('Vercel deployment credentials can access the configured project.');
  }
} catch {
  console.error('Could not reach Vercel to check deployment access. Retry the workflow.');
  process.exitCode = 1;
}
