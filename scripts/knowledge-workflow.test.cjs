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
    FormData,
    Blob,
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
  client = true,
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
        filters = {},
        singleResult = false;
      const q = {
        select() {
          return q;
        },
        eq(k, v) {
          filters[k] = v;
          return q;
        },
        limit() {
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
          singleResult = true;
          return resolve();
        },
        maybeSingle() {
          singleResult = true;
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
            Object.assign(version, values);
            return { data: { id: version.id } };
          }
          if (table === "knowledge_versions") Object.assign(version, values);
          return { data: null };
        }
        if (operation === "insert") {
          writes.push({ table, values });
          return { data: { id: "new-version" } };
        }
        const result =
          table === "knowledge_versions"
            ? filters.status && version?.status !== filters.status
              ? null
              : version
            : build;
        return { data: singleResult ? result : result ? [result] : [] };
      }
      return q;
    },
  };
  const route = load(
    "src/app/api/jobs/[jobId]/knowledge/route.ts",
    {
      "next/server": next,
      "@/lib/access": {
        requireProject: async (_jobId, adminOnly = false) => {
          if (deny || (client && adminOnly))
            throw new AccessError("Denied", 403);
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
    get: () =>
      route.GET(
        { nextUrl: new URL("https://example.com") },
        { params: { jobId: "job" } },
      ),
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
  source_manifest: [{ id: "a", name: "Website" }],
  created_at: "2026-10-14T10:00:00Z",
  qa: [{ question: "Q", answer: "A", sources: ["a"] }],
  warnings: [],
});
process.env.BLAND_API_KEY = "test-only";
test("non-members are denied knowledge operations before sources or provider are accessed", async () => {
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
  version.qa[0] = {
    question: "Where, exactly?",
    answer: 'Say "hello".\nCafé reception.',
    sources: ["a"],
  };
  const a = api({
    version,
    requestFetch: async (url, opts) => {
      assert.equal(url, "https://api.bland.ai/v1/knowledge/learn");
      const request = new Request(url, opts);
      assert.match(
        request.headers.get("content-type"),
        /multipart\/form-data; boundary=/,
      );
      assert.equal(request.headers.get("authorization"), "test-only");
      const form = await request.formData();
      assert.equal(form.get("type"), "file");
      assert.equal(form.get("file").name, "property-knowledge-version.csv");
      assert.match(form.get("file").type, /^text\/csv/);
      assert.equal(await form.get("file").text(), format.toCSV(version.qa));
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

const quality = load("src/lib/knowledge/source-quality.ts");
test("blocked website interstitials cannot become property answers", () => {
  assert.equal(
    quality.isBlockedSource(
      "Attention Required! | Cloudflare",
      "Please enable cookies. Sorry, you have been blocked",
    ),
    true,
  );
  assert.equal(
    quality.isBlockedSource(
      "Just a moment...",
      "Checking your browser before accessing the property",
    ),
    true,
  );
  assert.equal(
    quality.isBlockedSource(
      "Property FAQ",
      "Our guest Wi-Fi uses security measures. Breakfast is at 7 AM.",
    ),
    false,
  );
});

test("draft edits require valid references and published versions are immutable", async () => {
  const invalid = api({ version: draft() });
  assert.equal(
    (
      await invalid.post({
        action: "save",
        versionId: "version",
        baseQA: draft().qa,
        qa: [{ question: "Q", answer: "A", sources: ["missing"] }],
      })
    ).status,
    422,
  );
  const published = api({ version: { ...draft(), status: "published" } });
  assert.equal(
    (await published.post({ action: "save", versionId: "version", qa: [] }))
      .status,
    409,
  );
  const valid = api({ version: draft() });
  const res = await valid.post({
    action: "save",
    versionId: "version",
    baseQA: draft().qa,
    qa: [
      {
        question: "Where? / Address?",
        answer: "Reviewed answer",
        sources: ["a"],
      },
    ],
  });
  assert.equal(res.status, 200);
  assert.equal(valid.counts().publishes, 0);
});
test("every admin endpoint denies access before reading or changing account data", async () => {
  const path = require("node:path");
  function files(dir) {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory()
          ? files(path.join(dir, entry.name))
          : entry.name === "route.ts"
            ? [path.join(dir, entry.name)]
            : [],
      );
  }
  let checked = 0;
  for (const file of files("src/app/api/admin")) {
    const source = fs.readFileSync(file, "utf8");
    const imports = {};
    for (const match of source.matchAll(/from ["']([^"']+)["']/g))
      imports[match[1]] = {};
    imports["next/server"] = next;
    imports["@/lib/access"] = {
      guardAdmin: async () =>
        Response.json({ error: "Denied" }, { status: 403 }),
    };
    const route = load(file, imports);
    for (const method of ["GET", "POST", "PATCH", "DELETE"])
      if (route[method]) {
        const r = await route[method](new Request("https://example.com"), {
          params: { accountId: "a", userId: "u" },
        });
        assert.equal(r.status, 403, file + " " + method);
        checked++;
      }
  }
  assert.ok(checked >= 15);
});

test("client listing hides provider identity and internal errors", async () => {
  const a = api({
    version: {
      ...draft(),
      provider_id: "secret-provider-id",
      provider_name: "Internal",
      error_message: "Bland failed",
    },
  });
  const res = await a.get();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.versions[0].canRefresh, true);
  assert.doesNotMatch(
    JSON.stringify(body),
    /Bland|provider_id|provider_name|secret-provider-id|Internal/,
  );
});
test("a client can revise a published KB without changing its published history", async () => {
  const version = { ...draft(), status: "published", provider_id: "old-kb" };
  const a = api({ version });
  const res = await a.post({ action: "revise", versionId: "version" });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).versionId, "new-version");
  assert.equal(version.status, "published");
  assert.equal(version.provider_id, "old-kb");
  assert.equal(a.writes[0].values.provider_id, undefined);
  assert.equal(a.counts().publishes, 0);
});
test("stale edits cannot overwrite another client's saved answers", async () => {
  const a = api({ version: draft() });
  const res = await a.post({
    action: "save",
    versionId: "version",
    baseQA: [],
    qa: draft().qa,
  });
  assert.equal(res.status, 409);
  assert.equal(a.writes.length, 0);
});
test("non-members cannot read, edit, revise or publish KBs", async () => {
  const a = api({ deny: true, version: draft() });
  assert.equal((await a.get()).status, 403);
  for (const action of ["save", "revise", "publish", "refresh", "reconcile"])
    assert.equal((await a.post({ action, versionId: "version" })).status, 403);
  assert.equal(a.writes.length, 0);
  assert.equal(a.counts().publishes, 0);
});
test("processing and stale-source KBs cannot be revised", async () => {
  for (const opts of [
    { version: { ...draft(), status: "processing" } },
    { version: { ...draft(), status: "published" }, hash: "new-sources" },
  ]) {
    const a = api(opts);
    assert.equal(
      (await a.post({ action: "revise", versionId: "version" })).status,
      409,
    );
    assert.equal(a.writes.length, 0);
  }
});
