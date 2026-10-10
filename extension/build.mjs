import esbuild from 'esbuild';
import { readFileSync, mkdirSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file and build a define map for esbuild.
// Replaces process.env.* in source with literal strings at build time.
// Never put the Supabase service_role key here — only the anon key.
function loadEnv() {
  const envPath = join(__dirname, '.env');
  try {
    const lines = readFileSync(envPath, 'utf8').split('\n');
    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^['""]|['""]$/g, '');
    }
    return env;
  } catch {
    console.warn('[build] .env not found — using placeholders. Copy .env.example to .env and fill in your values.');
    return {};
  }
}

const env = loadEnv();

// Whitelist: only these keys are allowed in the browser bundle.
// NEVER add SERVICE_ROLE_KEY or other server-side secrets here.
const ALLOWED_ENV_KEYS = new Set([
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'WEB_VIEWER_URL',
]);

const forbiddenKeys = Object.keys(env).filter(k => !ALLOWED_ENV_KEYS.has(k));
if (forbiddenKeys.length > 0) {
  console.warn('[build] WARNING: .env contains keys not in the whitelist (they will NOT be bundled):', forbiddenKeys);
}

// Convert whitelisted { KEY: 'value' } → { 'process.env.KEY': '"value"' } for esbuild define
const envDefine = Object.fromEntries(
  Object.entries(env)
    .filter(([k]) => ALLOWED_ENV_KEYS.has(k))
    .map(([k, v]) => ['process.env.' + k, JSON.stringify(v)])
);

// Polyfill process for Chrome extension service workers.
// supabase-js references process.env.NODE_ENV and process.version at module load time.
envDefine['process.env.NODE_ENV'] = envDefine['process.env.NODE_ENV'] ?? '"production"';
envDefine['process.version'] = '"v20.0.0"';

const isWatch = process.argv.includes('--watch');

/** Shared options applied to every entry point. */
const sharedOptions = {
  bundle: true,
  define: envDefine,
  platform: 'browser',
  target: ['chrome120'],
  sourcemap: isWatch ? 'inline' : false,
};

/**
 * Entry point definitions.
 * - background service worker uses ESM format so it can use `import` at the
 *   module level (declared with `"type": "module"` in manifest.json).
 * - content scripts and popup use IIFE because Chrome does not support ES
 *   modules in content script contexts.
 */
const entries = [
  {
    in: 'background/service-worker.ts',
    out: 'dist/background/service-worker.js',
    format: /** @type {import('esbuild').Format} */ ('esm'),
    banner: { js: 'if(typeof globalThis.process==="undefined"){globalThis.process={env:{},version:"v20.0.0"}}' },
  },
  {
    in: 'content-scripts/instagram/index.ts',
    out: 'dist/content-scripts/instagram.js',
    format: /** @type {import('esbuild').Format} */ ('iife'),
  },
  {
    in: 'content-scripts/x.ts',
    out: 'dist/content-scripts/x.js',
    format: /** @type {import('esbuild').Format} */ ('iife'),
  },
  {
    in: 'popup/popup.ts',
    out: 'dist/popup/popup.js',
    format: /** @type {import('esbuild').Format} */ ('iife'),
  },
];

if (isWatch) {
  // Development: create a long-lived context per entry and start watching.
  const contexts = await Promise.all(
    entries.map(({ in: entryIn, out, format, banner }) =>
      esbuild.context({
        ...sharedOptions,
        entryPoints: [entryIn],
        outfile: out,
        format,
        ...(banner ? { banner } : {}),
      })
    )
  );

  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log('[esbuild] Watching for changes — press Ctrl+C to stop.');
} else {
  // Production: build all entry points in parallel.
  await Promise.all(
    entries.map(({ in: entryIn, out, format, banner }) =>
      esbuild.build({
        ...sharedOptions,
        entryPoints: [entryIn],
        outfile: out,
        format,
        ...(banner ? { banner } : {}),
      })
    )
  );
  // Copy static assets
  const staticFiles = [
    ['popup/popup.html', 'dist/popup/popup.html'],
    ['popup/popup.css',  'dist/popup/popup.css'],
    ['styles/toast.css', 'dist/styles/toast.css'],
  ];
  for (const [src, dest] of staticFiles) {
    mkdirSync(dest.split('/').slice(0, -1).join('/'), { recursive: true });
    copyFileSync(src, dest);
  }
  console.log('[esbuild] Build complete.');
}
