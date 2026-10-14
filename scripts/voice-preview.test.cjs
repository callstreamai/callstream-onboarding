const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => { if (name in imports) return imports[name]; throw new Error(`Unexpected import: ${name}`); }, fetch, Request, Response, AbortSignal, Uint8Array, Set, Error, console, process });
  return exports;
}
const lib = load('src/lib/voice-preview.ts');
const id = 'd4610ec1-933d-44c9-a05f-53df2437808d';
const model = '5134ee24-7d14-49a4-8aff-2215d295b6cc';
const input = { text: 'Hello.', voice: id };

test('voice catalog uses the public voice ID, includes compatible engines, deduplicates IDs only', () => {
  const voices = lib.normalizeVoices({ voices: [
    { id, voice_id: model, name: 'Karen', service: 'BTTS_V3', tags: ['Bland Curated'] },
    { id, name: 'duplicate', service: 'BTTS_V3' },
    { id: model, name: 'Karen', service: 'BTTS_V2' },
    { id: 'bad-id', service: 'BTTS_V3' },
    { id: 'a4610ec1-933d-44c9-a05f-53df2437808d', service: 'LEGACY' },
  ] });
  assert.equal(voices.length, 2); assert.equal(voices[0].id, id); assert.equal(voices[0].recommended, true); assert.equal(voices[1].name, 'Karen');
});
test('malformed catalog fails instead of silently showing an empty library', () => assert.throws(() => lib.normalizeVoices({ error: 'unavailable' })));
test('preview validation rejects empty, oversized, malformed requests and named voices', () => {
  for (const body of [null, {}, { ...input, text: ' ' }, { ...input, text: 'a'.repeat(301) }, { ...input, text: 3 }, { ...input, voice: 'karl' }]) assert.throws(() => lib.validatePreview(body), e => e.status === 400);
  assert.equal(lib.validatePreview({ ...input, text: ' Hello. ' }).text, 'Hello.');
});
test('TTS requests browser-playable WAV from v2 with the public voice ID', async () => {
  const wav = Buffer.alloc(60); wav.write('RIFF'); wav.write('WAVE', 8);
  const result = await lib.generatePreview('fake-test-key', input, async (url, options) => {
    assert.equal(url, 'https://api.bland.ai/v2/tts');
    const body = JSON.parse(options.body);
    assert.equal(body.voice, id); assert.equal(body.audio.container, 'wav'); assert.equal(body.audio.encoding, 'pcm_s16le');
    assert.ok(options.signal); return new Response(wav);
  });
  assert.equal(result.byteLength, 60);
});
test('successful HTTP responses containing JSON or empty audio are rejected', async () => {
  for (const body of ['{"error":"provider failure"}', '']) await assert.rejects(lib.generatePreview('fake', input, async () => new Response(body)), e => e.status === 502);
});
test('credit, unavailable voice, and rate-limit failures produce actionable errors', async () => {
  for (const [upstream, status, message] of [[402,503,/credits/], [403,503,/another voice/], [404,422,/another voice/], [429,429,/busy/], [500,502,/temporarily/]]) {
    await assert.rejects(lib.generatePreview('fake', input, async () => new Response('secret-provider-detail', { status: upstream })), e => e.status === status && message.test(e.message) && !e.message.includes('secret'));
  }
});
const next = { NextResponse: { json: (body, options) => Response.json(body, options) } };
function route(authenticated, generation = lib.generatePreview) {
  return load('src/app/api/bland/speak/route.ts', { 'next/server': next, '@/lib/supabase/server-client': { createServerSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'test-user' } : null }, error: null }) } }) }, '@/lib/voice-preview': { ...lib, generatePreview: generation } });
}
test('anonymous preview requests are denied before invoking the paid provider', async () => {
  const res = await route(false, () => { throw new Error('must not call'); }).POST(new Request('https://example.com', { method: 'POST', body: JSON.stringify(input) }));
  assert.equal(res.status, 401);
});
test('signed-in malformed JSON returns 400', async () => {
  const res = await route(true).POST(new Request('https://example.com', { method: 'POST', body: '{' }));
  assert.equal(res.status, 400);
});
test('provider timeouts return an actionable 504 and no internal details', async () => {
  const prior = process.env.BLAND_API_KEY; process.env.BLAND_API_KEY = 'fake';
  try {
    const res = await route(true, async () => { const e = new Error('internal'); e.name = 'TimeoutError'; throw e; }).POST(new Request('https://example.com', { method: 'POST', body: JSON.stringify(input) }));
    assert.equal(res.status, 504); assert.match((await res.json()).error, /too long/);
  } finally { if (prior === undefined) delete process.env.BLAND_API_KEY; else process.env.BLAND_API_KEY = prior; }
});
