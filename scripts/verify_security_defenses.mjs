import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log('=== Starting Security Defense Verification Suite ===\n');
  let passCount = 0;
  let failCount = 0;

  async function check(name, testFn) {
    try {
      await testFn();
      console.log(`[PASS] ${name}`);
      passCount++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      failCount++;
    }
  }

  // 1. Unauthenticated PUT /api/settings
  await check('Unauthenticated PUT /api/settings is blocked (401)', async () => {
    const res = await fetch(`${BASE_URL}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sarToEgpRate: 99.9 }),
    });
    assert.strictEqual(res.status, 401);
  });

  // 2. Unauthenticated GET /api/orders?admin=true
  await check('Unauthenticated GET /api/orders?admin=true is blocked (401)', async () => {
    const res = await fetch(`${BASE_URL}/api/orders?admin=true`);
    assert.strictEqual(res.status, 401);
  });

  // 3. Unauthenticated PATCH /api/orders/any-id
  await check('Unauthenticated PATCH /api/orders/SH-TEST-001 is blocked (401)', async () => {
    const res = await fetch(`${BASE_URL}/api/orders/SH-TEST-001`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: 'VERIFIED' }),
    });
    assert.strictEqual(res.status, 401);
  });

  // 4. Unauthenticated DELETE /api/orders/any-id
  await check('Unauthenticated DELETE /api/orders/SH-TEST-001 is blocked (401)', async () => {
    const res = await fetch(`${BASE_URL}/api/orders/SH-TEST-001`, {
      method: 'DELETE',
    });
    assert.strictEqual(res.status, 401);
  });

  // 5. Unauthenticated GET /api/users
  await check('Unauthenticated GET /api/users is blocked (401)', async () => {
    const res = await fetch(`${BASE_URL}/api/users`);
    assert.strictEqual(res.status, 401);
  });

  // 6. Unauthenticated POST /api/shipments
  await check('Unauthenticated POST /api/shipments is blocked (401)', async () => {
    const res = await fetch(`${BASE_URL}/api/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'HACKED-BATCH' }),
    });
    assert.strictEqual(res.status, 401);
  });

  // 7. Unauthenticated POST /api/shipments/assign
  await check('Unauthenticated POST /api/shipments/assign is blocked (401)', async () => {
    const res = await fetch(`${BASE_URL}/api/shipments/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipmentId: 'SHP-1', orderIds: ['SH-1'] }),
    });
    assert.strictEqual(res.status, 401);
  });

  // 8. Admin login and cookie capture
  let adminCookie = '';
  await check('Admin login succeeds and issues session cookie', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@sheinextract.com', password: 'admin123456' }),
    });
    assert.ok(res.status === 200 || res.status === 201, `Expected 200 or 201, got ${res.status}`);
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Expected set-cookie header');
    assert.ok(setCookie.includes('shein_session='), 'Expected shein_session cookie');
    adminCookie = setCookie.split(';')[0];
  });

  // 9. Authenticated Admin PUT /api/settings
  await check('Authenticated Admin PUT /api/settings succeeds (200)', async () => {
    const res = await fetch(`${BASE_URL}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({ flatShippingFee: 75 }),
    });
    assert.ok(res.status === 200 || res.status === 201, `Expected 200 or 201, got ${res.status}`);
  });

  // 10. Authenticated Admin GET /api/orders?admin=true
  await check('Authenticated Admin GET /api/orders?admin=true succeeds (200)', async () => {
    const res = await fetch(`${BASE_URL}/api/orders?admin=true`, {
      headers: { Cookie: adminCookie },
    });
    assert.ok(res.status === 200 || res.status === 201, `Expected 200 or 201, got ${res.status}`);
    const json = await res.json();
    assert.ok(json.success);
    assert.ok(Array.isArray(json.data));
  });

  // 11. Authenticated Admin GET /api/users
  await check('Authenticated Admin GET /api/users succeeds (200)', async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: adminCookie },
    });
    assert.ok(res.status === 200 || res.status === 201, `Expected 200 or 201, got ${res.status}`);
    const json = await res.json();
    assert.ok(json.success);
    assert.ok(Array.isArray(json.data));
  });

  // 12. Create test regular user
  let userCookie = '';
  const testEmail = `testuser_${Date.now()}@example.com`;
  await check('Customer signup issues session cookie', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Customer',
        email: testEmail,
        password: 'password123',
        phone: '01012345678',
      }),
    });
    assert.ok(res.status === 200 || res.status === 201, `Expected 200 or 201, got ${res.status}`);
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie && setCookie.includes('shein_session='));
    userCookie = setCookie.split(';')[0];
  });

  // 13. Regular user attempting admin endpoints gets blocked (403)
  await check('Customer cannot access Admin GET /api/orders?admin=true (401/403)', async () => {
    const res = await fetch(`${BASE_URL}/api/orders?admin=true`, {
      headers: { Cookie: userCookie },
    });
    assert.ok(res.status === 401 || res.status === 403);
  });

  await check('Customer cannot access Admin PUT /api/settings (403)', async () => {
    const res = await fetch(`${BASE_URL}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userCookie,
      },
      body: JSON.stringify({ sarToEgpRate: 50 }),
    });
    assert.strictEqual(res.status, 403);
  });

  await check('Customer cannot access Admin GET /api/users (403)', async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: userCookie },
    });
    assert.strictEqual(res.status, 403);
  });

  await check('Customer cannot access Admin POST /api/shipments (403)', async () => {
    const res = await fetch(`${BASE_URL}/api/shipments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userCookie,
      },
      body: JSON.stringify({ code: 'CUSTOMER-SHIPMENT' }),
    });
    assert.strictEqual(res.status, 403);
  });

  console.log(`\n=== Verification Complete: ${passCount} Passed, ${failCount} Failed ===`);
  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
