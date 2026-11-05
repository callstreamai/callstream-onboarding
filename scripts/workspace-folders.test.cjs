const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(path, imports) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: (name) => {
    if (name in imports) return imports[name];
    throw Error(name);
  }, Error });
  return exports;
}

function setup({ signedIn = true, member = true, admin = false, dbError = false } = {}) {
  const tables = {
    profiles: [{ id: 'client', role: admin ? 'admin' : 'client' }],
    onboarding_jobs: [{ id: 'assigned', created_by: 'owner' }, { id: 'other', created_by: 'owner' }],
    project_members: member ? [{ user_id: 'client', job_id: 'assigned' }] : [],
    spaces: [{ id: 'folder-a', job_id: 'assigned', name: 'Existing', created_by: 'admin' },
      { id: 'folder-b', job_id: 'other', name: 'Private', created_by: 'admin' }],
  };
  const writes = [];
  const db = { from(table) {
    let rows = tables[table] || [], update;
    const q = {
      select() { return q; }, order() { return q; },
      eq(key, value) { rows = rows.filter(row => row[key] === value); return q; },
      insert(row) { writes.push({ table, row }); rows = [{ id: 'new-folder', ...row }]; return q; },
      update(fields) { update = fields; return q; },
      async maybeSingle() {
        if (update && rows[0]) { writes.push({ table, update }); Object.assign(rows[0], update); }
        return { data: rows[0] || null, error: dbError && table === 'spaces' ? Error('database failed') : null };
      },
      single() { return q.maybeSingle(); },
    };
    return q;
  }, rpc: async () => { writes.push({ rpc: true }); return { error: null }; } };
  const next = { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } };
  const access = load('src/lib/access.ts', {
    'next/server': next,
    '@/lib/supabase/server-client': { createServerSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'client' } : null } }) } }) },
    '@/lib/supabase/server': { createServiceClient: () => db },
  });
  const route = load('src/app/api/jobs/[jobId]/spaces/route.ts', {
    'next/server': next, '@/lib/access': access, '@/lib/supabase/server': { createServiceClient: () => db },
  });
  const call = (method, body, jobId = 'assigned') => route[method]({ json: async () => body }, { params: { jobId } });
  return { call, tables, writes };
}

test('assigned client creates a named folder attributed to the signed-in user', async () => {
  const { call } = setup();
  const result = await call('POST', { name: '  Spa & Wellness  ', description: '  Hours  ', userId: 'someone-else', job_id: 'other' });
  assert.equal(result.status, 200);
  assert.equal(result.body.space.name, 'Spa & Wellness');
  assert.equal(result.body.space.description, 'Hours');
  assert.equal(result.body.space.created_by, 'client');
  assert.equal(result.body.space.job_id, 'assigned');
});
test('assigned client can rename an existing admin-created folder and change its icon', async () => {
  const { call, tables } = setup();
  const result = await call('PATCH', { spaceId: 'folder-a', name: '  Dining  ', description: null, icon: 'folder', created_by: 'fake', job_id: 'other' });
  assert.equal(result.status, 200);
  assert.equal(tables.spaces[0].name, 'Dining');
  assert.equal(tables.spaces[0].created_by, 'admin');
  assert.equal(tables.spaces[0].job_id, 'assigned');
});
test('anonymous and unassigned users cannot create or edit folders', async () => {
  for (const options of [{ signedIn: false }, { member: false }]) {
    for (const method of ['POST', 'PATCH']) {
      const { call, writes } = setup(options);
      const result = await call(method, { name: 'Blocked', spaceId: 'folder-a' });
      assert.ok([401, 404].includes(result.status));
      assert.equal(writes.length, 0);
    }
  }
});
test('membership in one property cannot be used to edit another property folder', async () => {
  const { call, tables, writes } = setup();
  assert.equal((await call('PATCH', { spaceId: 'folder-b', name: 'Blocked' })).status, 404);
  assert.equal((await call('POST', { name: 'Blocked' }, 'other')).status, 404);
  assert.equal(tables.spaces[1].name, 'Private');
  assert.equal(writes.length, 0);
});
test('blank, oversized, and invalid names are rejected without writes', async () => {
  for (const name of ['', '  ', null, 3, 'a'.repeat(121)]) {
    for (const method of ['POST', 'PATCH']) {
      const { call, writes } = setup();
      assert.equal((await call(method, { name, spaceId: 'folder-a' })).status, 400);
      assert.equal(writes.length, 0);
    }
  }
});
test('clients cannot delete folders or initialize default folders', async () => {
  const { call, writes } = setup();
  assert.equal((await call('DELETE', {})).status, 403);
  assert.equal((await call('POST', { initDefaults: true })).status, 403);
  assert.equal(writes.length, 0);
});
test('administrators retain folder creation and editing access', async () => {
  const { call } = setup({ admin: true, member: false });
  assert.equal((await call('POST', { name: 'New' }, 'other')).status, 200);
  assert.equal((await call('PATCH', { spaceId: 'folder-b', name: 'Changed' }, 'other')).status, 200);
});
test('empty updates and invalid folder metadata are rejected', async () => {
  for (const body of [{}, { name: [] }, { description: {} }, { description: 'a'.repeat(2001) }, { icon: '' }, { icon: {} }]) {
    const { call, writes } = setup();
    assert.equal((await call('PATCH', { spaceId: 'folder-a', ...body })).status, 400);
    assert.equal(writes.length, 0);
  }
});
test('database failures return a failure response', async () => {
  const { call } = setup({ dbError: true });
  assert.equal((await call('POST', { name: 'New' })).status, 500);
});
