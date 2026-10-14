const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
function load(file, imports = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (n) => {
      if (n in imports) return imports[n];
      throw Error(n);
    },
    Error,
    Set,
    Buffer,
    Response,
    Request,
    AbortSignal,
    process,
    console,
    ...globals,
  });
  return exports;
}
const format = load("src/lib/knowledge/format.ts");
test("Q&A CSV matches the supplied two-column format and escapes quotes, commas and newlines", () => {
  assert.equal(
    format.toCSV([
      {
        question: "Where? / Address?",
        answer: 'Say "hello",\nthen continue.',
        sources: ["a"],
      },
    ]),
    'Question,Answer\r\n"Where? / Address?","Say ""hello"",\nthen continue."\r\n',
  );
});
test("answers without valid source references cannot be published", () => {
  for (const row of [
    { question: "Q", answer: "A", sources: [] },
    { question: "Q", answer: "A", sources: ["invented"] },
    { question: " ", answer: "A", sources: ["a"] },
  ])
    assert.throws(() => format.validateQA([row], new Set(["a"])));
  assert.equal(
    format.validateQA(
      [{ question: "Q", answer: "A", sources: ["a", "a"] }],
      new Set(["a"]),
    )[0].sources.length,
    1,
  );
});
class AccessError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}
const next = { NextResponse: { json: (b, o) => Response.json(b, o) } };
function api({
  version = null,
  deny = false,
  hash = "source",
  requestFetch = async () => {
    throw Error("unexpected provider request");
  },
  build = null,
} = {}) {
  let claims = 0,
    publishes = 0,
    finishCount = 0;
  const writes = [];
  const db = {
    from(table) {
      let operation = "select",
        values,
        filters = {};
      const q = {
        select() {
          return q;
        },
        eq(k, v) {
          filters[k] = v;
          return q;
        },
        order() {
          return q;
        },
        update(v) {
          operation = "update";
          values = v;
          return q;
        },
        insert(v) {
          operation = "insert";
          values = v;
          return q;
        },
        single() {
          return resolve();
        },
        maybeSingle() {
          return resolve();
        },
        then(a, b) {
          return resolve().then(a, b);
        },
      };
      async function resolve() {
        if (operation === "update") {
          writes.push({ table, values });
          if (table === "knowledge_versions" && filters.status === "draft") {
            if (version.status !== "draft") return { data: null };
            version.status = values.status;
            return { data: { id: version.id } };
          }
          if (table === "knowledge_versions") Object.assign(version, values);
          return { data: null };
        }
        if (operation === "insert") return { data: { id: "new-version" } };
        return { data: table === "knowledge_versions" ? version : build };
      }
      return q;
    },
  };
  const route = load(
    "src/app/api/jobs/[jobId]/knowledge/route.ts",
    {
      "next/server": next,
      "@/lib/access": {
        requireProject: async () => {
          if (deny) throw new AccessError("Denied", 403);
          return { db, user: { id: "admin" }, job: { property_name: "Test" } };
        },
        AccessError,
        accessResponse: (e) =>
          Response.json({ error: e.message }, { status: e.status || 500 }),
      },
      "@/lib/property-operations": {
        claim: async () => {
          claims++;
          return { token: "t", cached: false };
        },
        finish: async () => {
          finishCount++;
        },
      },
      "@/lib/knowledge/sources": {
        sourceInventory: async () => ({ hash, manifest: [] }),
        readKnowledgeSources: async () => ({ sources: [], warnings: [] }),
      },
      "@/lib/knowledge/generate": {
        splitSources: () => [],
        extractKnowledgeChunk: async () => ({
          qa: [{ question: "Q", answer: "A", sources: ["a"] }],
          warnings: [],
        }),
        consolidateKnowledge: async () => ({ qa: [], warnings: [] }),
      },
      "@/lib/knowledge/format": format,
    },
    {
      fetch: async (...args) => {
        publishes++;
        return requestFetch(...args);
      },
    },
  );
  return {
    post: (body) =>
      route.POST(
        new Request("https://example.com", {
          method: "POST",
          body: JSON.stringify(body),
        }),
        { params: { jobId: "job" } },
      ),
    writes,
    counts: () => ({ claims, publishes, finishCount }),
  };
}
const draft = () => ({
  id: "version",
  status: "draft",
  source_hash: "source",
  created_at: "2026-10-14T10:00:00Z",
  qa: [{ question: "Q", answer: "A", sources: ["a"] }],
  warnings: [],
});
process.env.BLAND_API_KEY = "test-only";
test("clients are denied knowledge operations before sources or provider are accessed", async () => {
  const a = api({ deny: true });
  assert.equal((await a.post({ action: "generate" })).status, 403);
  assert.equal(a.counts().claims, 0);
  assert.equal(a.counts().publishes, 0);
});
test("unchanged sources reuse the existing KB instead of another extraction", async () => {
  const a = api({ version: draft() });
  const res = await a.post({ action: "generate" });
  assert.equal((await res.json()).skipped, true);
  assert.equal(a.counts().finishCount, 1);
  assert.equal(a.counts().publishes, 0);
});
test("one model section is saved before the browser continues", async () => {
  const a = api({
    build: { cursor: 0, chunks: [{ id: "a" }], qa: [], warnings: [] },
  });
  const r = await a.post({ action: "generate" });
  assert.equal((await r.json()).pending, true);
  assert.equal(a.writes[0].values.cursor, 1);
  assert.equal(a.counts().finishCount, 1);
});
test("stale sources and unacknowledged warnings block publishing", async () => {
  for (const opts of [
    { hash: "changed" },
    { version: { ...draft(), warnings: ["Unreadable document"] } },
  ]) {
    const a = api({ version: draft(), ...opts });
    const r = await a.post({ action: "publish", versionId: "version" });
    assert.ok([409, 422].includes(r.status));
    assert.equal(a.counts().publishes, 0);
  }
});
test("publishing the same version twice creates exactly one provider item", async () => {
  const version = draft();
  const a = api({
    version,
    requestFetch: async (url, opts) => {
      assert.equal(url, "https://api.bland.ai/v1/knowledge/learn");
      assert.equal(JSON.parse(opts.body).type, "text");
      return Response.json({
        data: { id: "provider-item", status: "PROCESSING" },
      });
    },
  });
  assert.equal(
    (await a.post({ action: "publish", versionId: "version" })).status,
    200,
  );
  assert.equal(
    (await a.post({ action: "publish", versionId: "version" })).status,
    200,
  );
  assert.equal(a.counts().publishes, 1);
});
test("ambiguous delivery is recorded and cannot blindly republish", async () => {
  const version = draft();
  const a = api({
    version,
    requestFetch: async () => {
      throw Error("timeout");
    },
  });
  await a.post({ action: "publish", versionId: "version" });
  assert.equal(version.status, "uncertain");
  assert.equal(
    (await a.post({ action: "publish", versionId: "version" })).status,
    409,
  );
  assert.equal(a.counts().publishes, 1);
});
test("definite provider rejection leaves a reviewable draft", async () => {
  const version = draft();
  const a = api({
    version,
    requestFetch: async () => new Response("private", { status: 400 }),
  });
  assert.equal(
    (await a.post({ action: "publish", versionId: "version" })).status,
    502,
  );
  assert.equal(version.status, "draft");
  assert.doesNotMatch(version.error_message, /private/);
});
function access({
  authenticated = true,
  role = "client",
  owner = "another",
  member = false,
} = {}) {
  const q = (table) => {
    const chain = {
      select() {
        return chain;
      },
      eq() {
        return chain;
      },
      single: resolve,
      maybeSingle: resolve,
    };
    async function resolve() {
      return {
        data:
          table === "profiles"
            ? { role }
            : table === "onboarding_jobs"
              ? { id: "job", created_by: owner }
              : member
                ? { job_id: "job" }
                : null,
      };
    }
    return chain;
  };
  return load("src/lib/access.ts", {
    "next/server": next,
    "@/lib/supabase/server-client": {
      createServerSupabaseClient: () => ({
        auth: {
          getUser: async () => ({
            data: { user: authenticated ? { id: "user" } : null },
          }),
        },
      }),
    },
    "@/lib/supabase/server": { createServiceClient: () => ({ from: q }) },
  });
}
test("project access verifies login, membership and admin-only operations", async () => {
  await assert.rejects(
    access({ authenticated: false }).requireProject("job"),
    (e) => e.status === 401,
  );
  await assert.rejects(access().requireProject("job"), (e) => e.status === 404);
  assert.equal(
    (await access({ member: true }).requireProject("job")).isAdmin,
    false,
  );
  await assert.rejects(
    access({ member: true }).requireProject("job", true),
    (e) => e.status === 403,
  );
  assert.equal(
    (await access({ role: "admin" }).requireProject("job", true)).isAdmin,
    true,
  );
});
