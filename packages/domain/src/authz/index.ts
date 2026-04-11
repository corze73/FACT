export function normalizeUserType(value?: string | null) {
  if (value === 'coach' || value === 'client' || value === 'admin') return value;
  if (value === 'user' || !value) return 'client';
  return value;
}

export function isAdminUser(user?: { user_type?: string | null } | null) {
  return normalizeUserType(user?.user_type) === 'admin';
}

export function getAdminScope(user?: { admin_scope?: string | null } | null) {
  const scope = user?.admin_scope || 'full';
  if (scope === 'full' || scope === 'support' || scope === 'compliance' || scope === 'ops' || scope === 'read_only') {
    return scope;
  }
  return 'full';
}

export function canManageUserLifecycle(user?: { user_type?: string | null; admin_scope?: string | null } | null) {
  if (!isAdminUser(user)) return false;
  const scope = getAdminScope(user);
  return scope === 'full' || scope === 'support' || scope === 'ops';
}

export function canHardDeleteUsers(user?: { user_type?: string | null; admin_scope?: string | null } | null) {
  if (!isAdminUser(user)) return false;
  return getAdminScope(user) === 'full';
}

export function canManageAdminRoles(user?: { user_type?: string | null; admin_scope?: string | null } | null) {
  if (!isAdminUser(user)) return false;
  return getAdminScope(user) === 'full';
}

export function canManageCompliance(user?: { user_type?: string | null; admin_scope?: string | null } | null) {
  if (!isAdminUser(user)) return false;
  const scope = getAdminScope(user);
  return scope === 'full' || scope === 'compliance' || scope === 'support' || scope === 'ops';
}

export function canManageCasesAndDisputes(user?: { user_type?: string | null; admin_scope?: string | null } | null) {
  if (!isAdminUser(user)) return false;
  const scope = getAdminScope(user);
  return scope === 'full' || scope === 'support' || scope === 'ops';
}

export function canExportAuditData(user?: { user_type?: string | null; admin_scope?: string | null } | null) {
  if (!isAdminUser(user)) return false;
  const scope = getAdminScope(user);
  return scope === 'full' || scope === 'support' || scope === 'ops';
}
