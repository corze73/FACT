/* eslint-env node */
import { Buffer } from 'buffer';
import { executeQuery, executeQueryOne } from './lib/db.js';
import { getAuthContext } from './lib/auth.js';
import { rateLimitMiddleware, RATE_LIMITS } from './lib/rateLimiter.js';
import { withFunctionObservability, captureFunctionError } from './lib/observability.js';

const getAllowedOrigin = (requestOrigin) => {
  const allowedOrigins = [
    'https://findacoachtoday.com',
    'https://www.findacoachtoday.com',
    'http://localhost:5173',
    'http://localhost:8888'
  ];
  if (process.env.NETLIFY_DEV === 'true') return requestOrigin || '*';
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
};

const getHeaders = (event) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(event.headers?.origin),
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
});

const isUuid = (v) => typeof v === 'string' && /^[0-9a-fA-F-]{36}$/.test(v);

const withUserCtx = (query, ctxId) => {
  const safe = isUuid(ctxId) ? ctxId : '';
  return `WITH __ctx AS (SELECT set_config('app.current_user_id', '${safe}', true)) ${query}`;
};

const parseLimit = (raw, fallback = 20, max = 100) => {
  const num = Number(raw ?? fallback);
  if (!Number.isInteger(num) || num < 1 || num > max) return null;
  return num;
};

const parseOffset = (raw, fallback = 0) => {
  const num = Number(raw ?? fallback);
  if (!Number.isInteger(num) || num < 0) return null;
  return num;
};

const parseBody = (event) => {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf-8')
    : event.body;
  return JSON.parse(raw);
};

const isMissingRelationError = (error, relationName) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(`relation \"${relationName}\" does not exist`) || message.includes(`relation '${relationName}' does not exist`);
};

const tableExists = async (tableName) => {
  const row = await executeQueryOne('SELECT to_regclass($1) AS table_name', [`public.${tableName}`]);
  return Boolean(row?.table_name);
};

const logAdminAction = async ({ actorId, action, targetUserId, metadata = {} }) => {
  if (!actorId || !action || !targetUserId) return;
  if (!(await tableExists('admin_action_logs'))) return;
  await executeQuery(
    withUserCtx(
      `INSERT INTO admin_action_logs (actor_user_id, action, target_user_id, metadata, created_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())`,
      actorId
    ),
    [actorId, action, targetUserId, JSON.stringify(metadata)]
  );
};

const normalizeAdminScope = (scope) => {
  const allowed = new Set(['full', 'support', 'compliance', 'ops', 'read_only']);
  return allowed.has(scope) ? scope : 'full';
};

const canMutateForScope = (scope) => scope !== 'read_only';
const canManageRolesForScope = (scope) => scope === 'full';
const canManageUsersForScope = (scope) => scope === 'full' || scope === 'support' || scope === 'ops';
const canManageCasesForScope = (scope) => scope === 'full' || scope === 'support' || scope === 'ops';
const canManageComplianceForScope = (scope) => scope === 'full' || scope === 'compliance' || scope === 'support' || scope === 'ops';
const canExportPiiForScope = (scope) => scope === 'full' || scope === 'ops' || scope === 'support';

const listAdminUsers = async ({ event, headers, adminId }) => {
  const q = event.queryStringParameters || {};
  const limit = parseLimit(q.limit, 50, 200);
  const offset = parseOffset(q.offset, 0);
  const includeTotal = q.include_total === '1' || q.include_total === 'true';
  const scopeFilter = typeof q.scope === 'string' ? q.scope.trim() : '';
  const search = typeof q.search === 'string' ? q.search.trim() : '';
  if (limit === null || offset === null) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid pagination values' }) };
  }

  const params = [];
  const conditions = [`user_type = 'admin'`];

  if (scopeFilter) {
    conditions.push(`admin_scope = $${params.length + 1}`);
    params.push(scopeFilter);
  }

  if (search) {
    conditions.push(`(full_name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`);
    params.push(`%${search}%`);
  }

  const rows = await executeQuery(
    withUserCtx(
      `SELECT id, full_name, email, user_type, admin_scope, is_active, token_revoked_at, updated_at
              ${includeTotal ? ', COUNT(*) OVER() AS total_count' : ''}
       FROM profiles
       WHERE ${conditions.join(' AND ')}
       ORDER BY updated_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      adminId
    ),
    params
  );

  if (!includeTotal) {
    return { statusCode: 200, headers, body: JSON.stringify({ data: rows, limit, offset }) };
  }

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const data = rows.map(({ total_count, ...rest }) => rest);
  return { statusCode: 200, headers, body: JSON.stringify({ data, total, limit, offset }) };
};

const updateAdminUser = async ({ event, headers, adminId, targetId }) => {
  if (!isUuid(targetId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid admin user id format' }) };
  }

  const body = parseBody(event);
  const scope = typeof body.admin_scope === 'string' ? body.admin_scope.trim() : null;
  const allowedScopes = new Set(['full', 'support', 'compliance', 'ops', 'read_only']);

  if (!scope || !allowedScopes.has(scope)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid admin_scope' }) };
  }

  const updated = await executeQueryOne(
    withUserCtx(
      `UPDATE profiles
       SET admin_scope = $1,
           updated_at = NOW()
       WHERE id = $2
         AND user_type = 'admin'
       RETURNING id, full_name, email, admin_scope, updated_at`,
      adminId
    ),
    [scope, targetId]
  );

  if (!updated) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Admin user not found' }) };
  }

  await logAdminAction({
    actorId: adminId,
    action: 'admin_scope_updated',
    targetUserId: targetId,
    metadata: { admin_scope: scope }
  });

  return { statusCode: 200, headers, body: JSON.stringify({ data: updated }) };
};

const revokeUserSessions = async ({ headers, adminId, targetId }) => {
  if (!isUuid(targetId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid user id format' }) };
  }

  const updated = await executeQueryOne(
    withUserCtx(
      `UPDATE profiles
       SET token_revoked_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, full_name, token_revoked_at`,
      adminId
    ),
    [targetId]
  );

  if (!updated) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) };
  }

  await logAdminAction({
    actorId: adminId,
    action: 'user_sessions_revoked',
    targetUserId: targetId,
    metadata: { token_revoked_at: updated.token_revoked_at }
  });

  return { statusCode: 200, headers, body: JSON.stringify({ data: updated }) };
};

const listCases = async ({ event, headers, adminId }) => {
  if (!(await tableExists('admin_cases'))) {
    return { statusCode: 200, headers, body: JSON.stringify({ data: [], total: 0, limit: 20, offset: 0 }) };
  }

  const q = event.queryStringParameters || {};
  const limit = parseLimit(q.limit, 20, 100);
  const offset = parseOffset(q.offset, 0);
  const includeTotal = q.include_total === '1' || q.include_total === 'true';
  const status = typeof q.status === 'string' ? q.status.trim() : '';
  const ownerAdminId = typeof q.owner_admin_id === 'string' ? q.owner_admin_id.trim() : '';
  if (limit === null || offset === null) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid pagination values' }) };
  }

  const params = [];
  const conditions = [];
  if (status) {
    conditions.push(`c.status = $${params.length + 1}`);
    params.push(status);
  }
  if (ownerAdminId) {
    if (!isUuid(ownerAdminId)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid owner_admin_id format' }) };
    conditions.push(`c.owner_admin_id = $${params.length + 1}::uuid`);
    params.push(ownerAdminId);
  }

  const rows = await executeQuery(
    withUserCtx(
      `SELECT c.id, c.title, c.description, c.status, c.priority, c.category,
              c.owner_admin_id, c.target_user_id, c.booking_id,
              c.created_by, c.created_at, c.updated_at, c.resolved_at,
              owner.full_name AS owner_name,
              creator.full_name AS creator_name,
              target.full_name AS target_name
              ${includeTotal ? ', COUNT(*) OVER() AS total_count' : ''}
       FROM admin_cases c
       LEFT JOIN profiles owner ON owner.id = c.owner_admin_id
       LEFT JOIN profiles creator ON creator.id = c.created_by
       LEFT JOIN profiles target ON target.id = c.target_user_id
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY c.updated_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      adminId
    ),
    params
  );

  if (!includeTotal) return { statusCode: 200, headers, body: JSON.stringify({ data: rows, limit, offset }) };
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const data = rows.map(({ total_count, ...rest }) => rest);
  return { statusCode: 200, headers, body: JSON.stringify({ data, total, limit, offset }) };
};

const createCase = async ({ event, headers, adminId }) => {
  if (!(await tableExists('admin_cases'))) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'admin_cases table not available' }) };
  }

  const body = parseBody(event);
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : null;
  const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'general';
  const priority = typeof body.priority === 'string' && body.priority.trim() ? body.priority.trim() : 'normal';
  const ownerAdminId = isUuid(body.owner_admin_id) ? body.owner_admin_id : null;
  const targetUserId = isUuid(body.target_user_id) ? body.target_user_id : null;
  const bookingId = isUuid(body.booking_id) ? body.booking_id : null;

  if (!title) return { statusCode: 400, headers, body: JSON.stringify({ error: 'title is required' }) };

  const created = await executeQueryOne(
    withUserCtx(
      `INSERT INTO admin_cases (
         title, description, status, priority, category,
         owner_admin_id, target_user_id, booking_id,
         created_by, created_at, updated_at
       )
       VALUES ($1, $2, 'open', $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      adminId
    ),
    [title, description, priority, category, ownerAdminId, targetUserId, bookingId, adminId]
  );

  await logAdminAction({
    actorId: adminId,
    action: 'admin_case_created',
    targetUserId: targetUserId || adminId,
    metadata: { case_id: created?.id || null, title, priority, category }
  });

  return { statusCode: 201, headers, body: JSON.stringify({ data: created }) };
};

const updateCase = async ({ event, headers, adminId, caseId }) => {
  if (!isUuid(caseId)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid case id format' }) };
  if (!(await tableExists('admin_cases'))) return { statusCode: 503, headers, body: JSON.stringify({ error: 'admin_cases table not available' }) };

  const body = parseBody(event);
  const allowedStatuses = new Set(['open', 'in_progress', 'blocked', 'resolved', 'closed']);
  const allowedPriorities = new Set(['low', 'normal', 'high', 'critical']);

  const status = typeof body.status === 'string' ? body.status.trim() : null;
  const priority = typeof body.priority === 'string' ? body.priority.trim() : null;
  const ownerAdminId = body.owner_admin_id === null ? null : (isUuid(body.owner_admin_id) ? body.owner_admin_id : undefined);
  const description = typeof body.description === 'string' ? body.description.trim() : null;

  if (status && !allowedStatuses.has(status)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid status' }) };
  if (priority && !allowedPriorities.has(priority)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid priority' }) };
  if (ownerAdminId === undefined && body.owner_admin_id !== undefined) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid owner_admin_id format' }) };

  const updated = await executeQueryOne(
    withUserCtx(
      `UPDATE admin_cases
       SET status = COALESCE($1, status),
           priority = COALESCE($2, priority),
           owner_admin_id = CASE WHEN $3::text = '__unset__' THEN owner_admin_id ELSE $4::uuid END,
           description = COALESCE($5, description),
           resolved_at = CASE WHEN COALESCE($1, status) IN ('resolved', 'closed') THEN NOW() ELSE resolved_at END,
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      adminId
    ),
    [status, priority, body.owner_admin_id === undefined ? '__unset__' : '__set__', ownerAdminId, description, caseId]
  );

  if (!updated) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Case not found' }) };

  await logAdminAction({
    actorId: adminId,
    action: 'admin_case_updated',
    targetUserId: updated.target_user_id || adminId,
    metadata: { case_id: updated.id, status: updated.status, priority: updated.priority }
  });

  return { statusCode: 200, headers, body: JSON.stringify({ data: updated }) };
};

const listDisputes = async ({ event, headers, adminId }) => {
  if (!(await tableExists('booking_disputes'))) {
    return { statusCode: 200, headers, body: JSON.stringify({ data: [], total: 0, limit: 20, offset: 0 }) };
  }

  const q = event.queryStringParameters || {};
  const limit = parseLimit(q.limit, 20, 100);
  const offset = parseOffset(q.offset, 0);
  const includeTotal = q.include_total === '1' || q.include_total === 'true';
  const status = typeof q.status === 'string' ? q.status.trim() : '';
  if (limit === null || offset === null) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid pagination values' }) };
  }

  const params = [];
  const conditions = [];
  if (status) {
    conditions.push(`d.status = $${params.length + 1}`);
    params.push(status);
  }

  const rows = await executeQuery(
    withUserCtx(
      `SELECT d.id, d.booking_id, d.opened_by, d.assigned_admin_id, d.status, d.decision,
              d.refund_amount, d.reason, d.resolution_notes, d.created_at, d.updated_at, d.resolved_at,
              opener.full_name AS opened_by_name,
              assignee.full_name AS assigned_admin_name
              ${includeTotal ? ', COUNT(*) OVER() AS total_count' : ''}
       FROM booking_disputes d
       LEFT JOIN profiles opener ON opener.id = d.opened_by
       LEFT JOIN profiles assignee ON assignee.id = d.assigned_admin_id
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY d.updated_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      adminId
    ),
    params
  );

  if (!includeTotal) return { statusCode: 200, headers, body: JSON.stringify({ data: rows, limit, offset }) };
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const data = rows.map(({ total_count, ...rest }) => rest);
  return { statusCode: 200, headers, body: JSON.stringify({ data, total, limit, offset }) };
};

const createDispute = async ({ event, headers, adminId }) => {
  if (!(await tableExists('booking_disputes'))) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'booking_disputes table not available' }) };
  }

  const body = parseBody(event);
  const bookingId = isUuid(body.booking_id) ? body.booking_id : null;
  const openedBy = isUuid(body.opened_by) ? body.opened_by : adminId;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!reason) return { statusCode: 400, headers, body: JSON.stringify({ error: 'reason is required' }) };

  const created = await executeQueryOne(
    withUserCtx(
      `INSERT INTO booking_disputes (
         booking_id, opened_by, assigned_admin_id, status, reason, created_at, updated_at
       ) VALUES ($1, $2, $3, 'open', $4, NOW(), NOW())
       RETURNING *`,
      adminId
    ),
    [bookingId, openedBy, null, reason]
  );

  await logAdminAction({
    actorId: adminId,
    action: 'booking_dispute_created',
    targetUserId: openedBy,
    metadata: { dispute_id: created?.id || null, booking_id: bookingId }
  });

  return { statusCode: 201, headers, body: JSON.stringify({ data: created }) };
};

const updateDispute = async ({ event, headers, adminId, disputeId }) => {
  if (!isUuid(disputeId)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid dispute id format' }) };
  if (!(await tableExists('booking_disputes'))) return { statusCode: 503, headers, body: JSON.stringify({ error: 'booking_disputes table not available' }) };

  const body = parseBody(event);
  const status = typeof body.status === 'string' ? body.status.trim() : null;
  const decision = typeof body.decision === 'string' ? body.decision.trim() : null;
  const resolutionNotes = typeof body.resolution_notes === 'string' ? body.resolution_notes.trim() : null;
  const assignedAdminId = body.assigned_admin_id === null ? null : (isUuid(body.assigned_admin_id) ? body.assigned_admin_id : undefined);
  const refundAmount = body.refund_amount === undefined || body.refund_amount === null ? null : Number(body.refund_amount);

  const allowedStatuses = new Set(['open', 'under_review', 'resolved', 'closed']);
  const allowedDecisions = new Set(['refund_full', 'refund_partial', 'no_refund', 'other']);
  if (status && !allowedStatuses.has(status)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid status' }) };
  if (decision && !allowedDecisions.has(decision)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid decision' }) };
  if (assignedAdminId === undefined && body.assigned_admin_id !== undefined) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid assigned_admin_id format' }) };
  if (refundAmount !== null && !Number.isFinite(refundAmount)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid refund_amount' }) };

  const updated = await executeQueryOne(
    withUserCtx(
      `UPDATE booking_disputes
       SET status = COALESCE($1, status),
           decision = COALESCE($2, decision),
           resolution_notes = COALESCE($3, resolution_notes),
           assigned_admin_id = CASE WHEN $4::text = '__unset__' THEN assigned_admin_id ELSE $5::uuid END,
           refund_amount = COALESCE($6::numeric, refund_amount),
           resolved_at = CASE WHEN COALESCE($1, status) IN ('resolved', 'closed') THEN NOW() ELSE resolved_at END,
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      adminId
    ),
    [status, decision, resolutionNotes, body.assigned_admin_id === undefined ? '__unset__' : '__set__', assignedAdminId, refundAmount, disputeId]
  );

  if (!updated) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Dispute not found' }) };

  await logAdminAction({
    actorId: adminId,
    action: 'booking_dispute_updated',
    targetUserId: updated.opened_by || adminId,
    metadata: { dispute_id: updated.id, status: updated.status, decision: updated.decision || null }
  });

  return { statusCode: 200, headers, body: JSON.stringify({ data: updated }) };
};

const listComplianceExpiring = async ({ event, headers, adminId }) => {
  const q = event.queryStringParameters || {};
  const days = Number(q.days || 30);
  const safeDays = Number.isFinite(days) && days > 0 && days <= 365 ? days : 30;
  const limit = parseLimit(q.limit, 50, 200);
  const offset = parseOffset(q.offset, 0);
  const includeTotal = q.include_total === '1' || q.include_total === 'true';
  if (limit === null || offset === null) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid pagination values' }) };
  }

  const rows = await executeQuery(
    withUserCtx(
      `SELECT id, full_name, email, city, country,
              background_check_status, background_check_expires_at,
              qualification_status, has_background_check
              ${includeTotal ? ', COUNT(*) OVER() AS total_count' : ''}
       FROM profiles
       WHERE user_type = 'coach'
         AND COALESCE(is_active, true) = true
         AND has_background_check = true
         AND background_check_status = 'verified'
         AND background_check_expires_at IS NOT NULL
         AND background_check_expires_at <= CURRENT_DATE + ($1::int * INTERVAL '1 day')
       ORDER BY background_check_expires_at ASC
       LIMIT ${limit} OFFSET ${offset}`,
      adminId
    ),
    [safeDays]
  );

  if (includeTotal) {
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    const data = rows.map(({ total_count, ...rest }) => rest);
    return { statusCode: 200, headers, body: JSON.stringify({ data, total, days: safeDays, limit, offset }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ data: rows, days: safeDays, limit, offset }) };
};

const getOverview = async ({ headers, adminId }) => {
  const summary = {
    users: { total_accounts: 0, total_users: 0, admins: 0, coaches: 0, clients: 0, deactivated: 0 },
    operations: { pending_deletion_requests: 0, open_cases: 0, open_disputes: 0, expiring_background_checks_30d: 0 },
    reliability: { auth_events_24h: 0, email_failures_24h: 0 }
  };

  const userStats = await executeQueryOne(
    withUserCtx(
      `SELECT
         COUNT(*)::int AS total_accounts,
         COUNT(*) FILTER (WHERE user_type <> 'admin')::int AS total_users,
         COUNT(*) FILTER (WHERE user_type = 'admin')::int AS admins,
         COUNT(*) FILTER (WHERE user_type = 'coach')::int AS coaches,
         COUNT(*) FILTER (WHERE user_type = 'client')::int AS clients,
         COUNT(*) FILTER (WHERE COALESCE(is_active, true) = false)::int AS deactivated
       FROM profiles`,
      adminId
    )
  );

  summary.users = { ...summary.users, ...(userStats || {}) };

  if (await tableExists('account_deletion_requests')) {
    const adr = await executeQueryOne(
      withUserCtx(`SELECT COUNT(*)::int AS count FROM account_deletion_requests WHERE status = 'pending'`, adminId)
    );
    summary.operations.pending_deletion_requests = adr?.count || 0;
  }

  if (await tableExists('admin_cases')) {
    const c = await executeQueryOne(
      withUserCtx(`SELECT COUNT(*)::int AS count FROM admin_cases WHERE status NOT IN ('resolved', 'closed')`, adminId)
    );
    summary.operations.open_cases = c?.count || 0;
  }

  if (await tableExists('booking_disputes')) {
    const d = await executeQueryOne(
      withUserCtx(`SELECT COUNT(*)::int AS count FROM booking_disputes WHERE status NOT IN ('resolved', 'closed')`, adminId)
    );
    summary.operations.open_disputes = d?.count || 0;
  }

  const expiring = await executeQueryOne(
    withUserCtx(
      `SELECT COUNT(*)::int AS count
       FROM profiles
       WHERE user_type = 'coach'
         AND has_background_check = true
         AND background_check_status = 'verified'
         AND background_check_expires_at IS NOT NULL
         AND background_check_expires_at <= CURRENT_DATE + INTERVAL '30 days'`,
      adminId
    )
  );
  summary.operations.expiring_background_checks_30d = expiring?.count || 0;

  if (await tableExists('auth_logs')) {
    const authEvents = await executeQueryOne(
      withUserCtx(`SELECT COUNT(*)::int AS count FROM auth_logs WHERE created_at >= NOW() - INTERVAL '24 hours'`, adminId)
    );
    summary.reliability.auth_events_24h = authEvents?.count || 0;
  }

  if (await tableExists('email_logs')) {
    const emailFailures = await executeQueryOne(
      withUserCtx(`SELECT COUNT(*)::int AS count FROM email_logs WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours'`, adminId)
    );
    summary.reliability.email_failures_24h = emailFailures?.count || 0;
  }

  return { statusCode: 200, headers, body: JSON.stringify(summary) };
};

const getWeeklyReport = async ({ headers, adminId }) => {
  const hasAdminActionLogs = await tableExists('admin_action_logs');
  const adminActionsCurrentExpr = hasAdminActionLogs
    ? `(SELECT COUNT(*)::int FROM admin_action_logs WHERE created_at >= NOW() - INTERVAL '7 days')`
    : '0';
  const adminActionsPreviousExpr = hasAdminActionLogs
    ? `(SELECT COUNT(*)::int FROM admin_action_logs WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days')`
    : '0';

  const current = await executeQueryOne(
    withUserCtx(
      `SELECT
         (SELECT COUNT(*)::int FROM profiles WHERE created_at >= NOW() - INTERVAL '7 days') AS new_profiles,
         (SELECT COUNT(*)::int FROM bookings WHERE created_at >= NOW() - INTERVAL '7 days') AS new_bookings,
         (SELECT COUNT(*)::int FROM bookings WHERE status = 'completed' AND updated_at >= NOW() - INTERVAL '7 days') AS completed_bookings,
         ${adminActionsCurrentExpr} AS admin_actions`,
      adminId
    )
  );

  const previous = await executeQueryOne(
    withUserCtx(
      `SELECT
         (SELECT COUNT(*)::int FROM profiles WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days') AS new_profiles,
         (SELECT COUNT(*)::int FROM bookings WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days') AS new_bookings,
         (SELECT COUNT(*)::int FROM bookings WHERE status = 'completed' AND updated_at >= NOW() - INTERVAL '14 days' AND updated_at < NOW() - INTERVAL '7 days') AS completed_bookings,
        ${adminActionsPreviousExpr} AS admin_actions`,
      adminId
    )
  );

  const deltaPct = (curr, prev) => {
    const a = Number(curr || 0);
    const b = Number(prev || 0);
    if (b === 0) return a === 0 ? 0 : 100;
    return Number((((a - b) / b) * 100).toFixed(1));
  };

  const data = {
    current_week: current || {},
    previous_week: previous || {},
    deltas_pct: {
      new_profiles: deltaPct(current?.new_profiles, previous?.new_profiles),
      new_bookings: deltaPct(current?.new_bookings, previous?.new_bookings),
      completed_bookings: deltaPct(current?.completed_bookings, previous?.completed_bookings),
      admin_actions: deltaPct(current?.admin_actions, previous?.admin_actions)
    }
  };

  return { statusCode: 200, headers, body: JSON.stringify(data) };
};

const maskUserId = (id, redaction) => {
  if (!id) return null;
  if (redaction === 'full') return id;
  if (redaction === 'masked') return `${id.slice(0, 8)}...${id.slice(-4)}`;
  return 'REDACTED';
};

const exportAuditLogs = async ({ event, headers, adminId }) => {
  const q = event.queryStringParameters || {};
  const redaction = typeof q.redaction === 'string' ? q.redaction.trim() : 'masked';
  const allowed = new Set(['full', 'masked', 'strict']);
  if (!allowed.has(redaction)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid redaction level' }) };
  }

  const limit = parseLimit(q.limit, 100, 1000);
  if (limit === null) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid limit' }) };
  }

  let rows = [];
  try {
    rows = await executeQuery(
      withUserCtx(
        `SELECT id, action, actor_user_id, target_user_id, metadata, created_at
         FROM admin_action_logs
         ORDER BY created_at DESC
         LIMIT ${limit}`,
        adminId
      )
    );
  } catch (error) {
    if (!isMissingRelationError(error, 'admin_action_logs')) throw error;
  }

  const data = rows.map((row) => ({
    id: row.id,
    action: row.action,
    actor_user_id: maskUserId(row.actor_user_id, redaction),
    target_user_id: maskUserId(row.target_user_id, redaction),
    created_at: row.created_at,
    metadata: redaction === 'strict' ? { redacted: true } : row.metadata
  }));

  if (await tableExists('admin_export_logs')) {
    await executeQuery(
      withUserCtx(
        `INSERT INTO admin_export_logs (actor_user_id, export_type, redaction_level, metadata, created_at)
         VALUES ($1, $2, $3, $4::jsonb, NOW())`,
        adminId
      ),
      [adminId, 'audit_logs', redaction, JSON.stringify({ limit, exported_count: data.length })]
    );
  }

  return { statusCode: 200, headers, body: JSON.stringify({ data, redaction, count: data.length }) };
};

const listSnapshots = async ({ event, headers, adminId }) => {
  if (!(await tableExists('deleted_user_snapshots'))) {
    return { statusCode: 200, headers, body: JSON.stringify({ data: [], total: 0, limit: 20, offset: 0 }) };
  }

  const q = event.queryStringParameters || {};
  const limit = parseLimit(q.limit, 20, 100);
  const offset = parseOffset(q.offset, 0);
  const includeTotal = q.include_total === '1' || q.include_total === 'true';
  const rawUserId = typeof q.user_id === 'string' ? q.user_id.trim() : '';
  const userId = (rawUserId === 'undefined' || rawUserId === 'null') ? '' : rawUserId;
  if (limit === null || offset === null) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid pagination values' }) };
  if (userId && !isUuid(userId)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid user_id format' }) };

  const params = [];
  const conditions = [];
  if (userId) {
    conditions.push(`s.user_id = $${params.length + 1}::uuid`);
    params.push(userId);
  }

  const rows = await executeQuery(
    withUserCtx(
      `SELECT s.id, s.user_id, s.deleted_by, s.approved_by, s.reason, s.created_at,
              s.snapshot,
              deleter.full_name AS deleted_by_name,
              approver.full_name AS approved_by_name
              ${includeTotal ? ', COUNT(*) OVER() AS total_count' : ''}
       FROM deleted_user_snapshots s
       LEFT JOIN profiles deleter ON deleter.id = s.deleted_by
       LEFT JOIN profiles approver ON approver.id = s.approved_by
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY s.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      adminId
    ),
    params
  );

  if (!includeTotal) return { statusCode: 200, headers, body: JSON.stringify({ data: rows, limit, offset }) };
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const data = rows.map(({ total_count, ...rest }) => rest);
  return { statusCode: 200, headers, body: JSON.stringify({ data, total, limit, offset }) };
};

const rawHandler = async (event) => {
  const headers = getHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const rateLimitResponse = rateLimitMiddleware(
    event,
    headers,
    event.httpMethod === 'GET' ? RATE_LIMITS.read : RATE_LIMITS.mutation
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const auth = await getAuthContext(event);
    if (!auth.userId) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: auth.tokenRevoked ? 'Session revoked. Please login again.' : 'Not authenticated' }) };
    }
    if (!auth.isAdmin) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    const adminScope = normalizeAdminScope(auth.adminScope || 'full');

    const pathParts = (event.path || '').split('/').filter(Boolean);
    const opsIdx = pathParts.findIndex((part) => part === 'admin-ops');
    const seg1 = opsIdx >= 0 ? pathParts[opsIdx + 1] : null;
    const seg2 = opsIdx >= 0 ? pathParts[opsIdx + 2] : null;

    if (event.httpMethod === 'GET' && seg1 === 'overview') {
      return await getOverview({ headers, adminId: auth.userId });
    }

    if (event.httpMethod === 'GET' && seg1 === 'admin-users') {
      return await listAdminUsers({ event, headers, adminId: auth.userId });
    }

    if (event.httpMethod === 'PATCH' && seg1 === 'admin-users' && seg2) {
      if (!canManageRolesForScope(adminScope)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Only full-scope admins can manage admin roles/scopes' }) };
      }
      return await updateAdminUser({ event, headers, adminId: auth.userId, targetId: seg2 });
    }

    if (event.httpMethod === 'POST' && seg1 === 'revoke-session' && seg2) {
      if (!canManageUsersForScope(adminScope) || !canMutateForScope(adminScope)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Your admin scope cannot revoke sessions' }) };
      }
      return await revokeUserSessions({ headers, adminId: auth.userId, targetId: seg2 });
    }

    if (event.httpMethod === 'GET' && seg1 === 'cases') {
      return await listCases({ event, headers, adminId: auth.userId });
    }

    if (event.httpMethod === 'POST' && seg1 === 'cases') {
      if (!canManageCasesForScope(adminScope) || !canMutateForScope(adminScope)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Your admin scope cannot create cases' }) };
      }
      return await createCase({ event, headers, adminId: auth.userId });
    }

    if (event.httpMethod === 'PATCH' && seg1 === 'cases' && seg2) {
      if (!canManageCasesForScope(adminScope) || !canMutateForScope(adminScope)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Your admin scope cannot update cases' }) };
      }
      return await updateCase({ event, headers, adminId: auth.userId, caseId: seg2 });
    }

    if (event.httpMethod === 'GET' && seg1 === 'disputes') {
      return await listDisputes({ event, headers, adminId: auth.userId });
    }

    if (event.httpMethod === 'POST' && seg1 === 'disputes') {
      if (!canManageCasesForScope(adminScope) || !canMutateForScope(adminScope)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Your admin scope cannot create disputes' }) };
      }
      return await createDispute({ event, headers, adminId: auth.userId });
    }

    if (event.httpMethod === 'PATCH' && seg1 === 'disputes' && seg2) {
      if (!canManageCasesForScope(adminScope) || !canMutateForScope(adminScope)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Your admin scope cannot update disputes' }) };
      }
      return await updateDispute({ event, headers, adminId: auth.userId, disputeId: seg2 });
    }

    if (event.httpMethod === 'GET' && seg1 === 'compliance-expiring') {
      if (!canManageComplianceForScope(adminScope)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Your admin scope cannot access compliance monitoring' }) };
      }
      return await listComplianceExpiring({ event, headers, adminId: auth.userId });
    }

    if (event.httpMethod === 'GET' && seg1 === 'reports' && seg2 === 'weekly') {
      return await getWeeklyReport({ headers, adminId: auth.userId });
    }

    if (event.httpMethod === 'GET' && seg1 === 'audit-export') {
      if (!canExportPiiForScope(adminScope)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Your admin scope cannot export audit data' }) };
      }
      if (adminScope !== 'full' && (event.queryStringParameters?.redaction || '').trim() === 'full') {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Only full-scope admins can export full redaction level' }) };
      }
      return await exportAuditLogs({ event, headers, adminId: auth.userId });
    }

    if (event.httpMethod === 'GET' && seg1 === 'snapshots') {
      return await listSnapshots({ event, headers, adminId: auth.userId });
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
  } catch (error) {
    captureFunctionError(error, {
      route: 'admin-ops',
      method: event.httpMethod,
      path: event.path
    });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Admin ops request failed' })
    };
  }
};

export const handler = withFunctionObservability('admin-ops', rawHandler);
