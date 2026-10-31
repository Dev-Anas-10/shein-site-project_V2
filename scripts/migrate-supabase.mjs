import pg from 'pg';

const { Pool } = pg;
const supabaseUrl = process.env.LEGACY_SUPABASE_URL?.replace(/\/$/, '');
const serviceKey = process.env.LEGACY_SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('Set LEGACY_SUPABASE_URL and LEGACY_SUPABASE_SERVICE_ROLE_KEY for this one-time migration.');
  process.exit(1);
}

const pool = new Pool({ max: 2, application_name: 'shein-supabase-migration' });
let client;

async function fetchRows(table) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
    url.searchParams.set('select', '*');
    const response = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Range: `${offset}-${offset + pageSize - 1}`,
        'Range-Unit': 'items',
      },
    });
    if (!response.ok) {
      throw new Error(`Supabase ${table} export failed (${response.status}): ${await response.text()}`);
    }
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`Supabase returned invalid ${table} data.`);
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function mapUser(row) {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    email: String(row.email || '').toLowerCase(),
    password: row.password || undefined,
    role: row.role === 'admin' ? 'admin' : 'user',
    phone: row.phone || '',
    address: row.address || row.shipping_address || '',
    city: row.city || '',
    avatar: row.avatar || '',
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    lastLoginAt: row.last_login_at || row.lastLoginAt || undefined,
  };
}

function mapOrder(row) {
  const payment = row.payment && typeof row.payment === 'object' ? { ...row.payment } : undefined;
  const meta = payment?._orderMeta || {};
  if (payment) delete payment._orderMeta;
  const cleanPayment = payment && Object.keys(payment).length ? payment : undefined;
  const items = Array.isArray(row.items)
    ? row.items.map((item) => ({
        ...item,
        originalPrice: Number(item.originalPrice) || 0,
        originalPriceBeforeDiscount: item.originalPriceBeforeDiscount == null
          ? undefined
          : Number(item.originalPriceBeforeDiscount),
        discountPercent: item.discountPercent == null ? undefined : Number(item.discountPercent),
      }))
    : [];

  return {
    id: String(row.id),
    userId: String(row.user_id || ''),
    userName: String(row.user_name || ''),
    userEmail: String(row.user_email || ''),
    userPhone: String(row.user_phone || ''),
    shippingAddress: row.shipping_address || undefined,
    rawInput: String(row.raw_input || ''),
    extractedLink: String(row.extracted_link || ''),
    cartShareCode: row.cart_share_code || undefined,
    cartGroupId: row.cart_group_id || undefined,
    cartCoverImage: row.cart_cover_image || undefined,
    items,
    itemsCount: Number(row.items_count ?? items.length),
    itemsSubtotal: Number(row.items_subtotal || 0),
    dynamicFeePercent: Number(row.dynamic_fee_percent || 0),
    dynamicFeeAmount: Number(row.dynamic_fee_amount || 0),
    shippingFee: Number(row.shipping_fee || 0),
    totalCash: Number(row.total_cash || 0),
    currency: String(row.currency || 'EGP'),
    status: row.status || 'PENDING_APPROVAL',
    customerNotes: row.customer_notes || meta.customerNotes || undefined,
    shipmentId: meta.shipmentId || undefined,
    shipmentCode: meta.shipmentCode || undefined,
    adminComment: row.admin_comment || undefined,
    payment: cleanPayment,
    reviewedBy: row.reviewed_by || undefined,
    reviewedAt: row.reviewed_at || undefined,
    pricingExpiresAt: meta.pricingExpiresAt || undefined,
    cancelledAt: meta.cancelledAt || undefined,
    cancelledBy: meta.cancelledBy || undefined,
    cancellationReason: meta.cancellationReason || undefined,
    auditLog: Array.isArray(meta.auditLog) ? meta.auditLog : undefined,
    isPriceLocked: typeof meta.isPriceLocked === 'boolean'
      ? meta.isPriceLocked
      : ['APPROVED_PENDING_PAYMENT', 'PAYMENT_UNDER_REVIEW', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'].includes(row.status),
    exchangeRateUsed: meta.exchangeRateUsed ?? undefined,
    profitMarginPercentUsed: meta.profitMarginPercentUsed ?? undefined,
    lockedPricingSnapshot: meta.lockedPricingSnapshot || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

try {
  const [users, orders] = await Promise.all([fetchRows('users'), fetchRows('orders')]);
  client = await pool.connect();
  await client.query('BEGIN');
  const stateResult = await client.query('SELECT state FROM public.app_state WHERE id = 1 FOR UPDATE');
  if (!stateResult.rowCount) throw new Error('PostgreSQL state is missing. Run npm run db:bootstrap first.');

  const state = stateResult.rows[0].state;
  state.users = users.map(mapUser);
  state.orders = orders.map(mapOrder);
  state.shipments = Array.isArray(state.shipments) ? state.shipments : [];
  state.settings = state.settings || {};

  await client.query('UPDATE public.app_state SET state = $1::jsonb, updated_at = NOW() WHERE id = 1', [JSON.stringify(state)]);
  await client.query('COMMIT');
  console.log(`Imported ${users.length} users and ${orders.length} orders from Supabase into local PostgreSQL.`);
} catch (error) {
  await client?.query('ROLLBACK').catch(() => {});
  console.error('Supabase migration failed:', error.message);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
