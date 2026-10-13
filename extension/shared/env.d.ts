/**
 * env.d.ts — Global type declarations for build-time environment variables.
 *
 * esbuild replaces every `process.env.*` occurrence with a string literal at
 * build time (see build.mjs, envDefine map).  TypeScript needs this declaration
 * so it does not flag `process` as an unknown identifier in browser/extension
 * source files, where the real Node.js `process` object is absent at runtime.
 *
 * Allowed keys (see build.mjs ALLOWED_ENV_KEYS):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, WEB_VIEWER_URL
 */
declare const process: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly version: string;
};
