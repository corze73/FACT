import { useEffect, useMemo, useState } from "react";
import { User } from "@/api/entities.jsx";
import {
  createPageUrl,
  isAdminUser,
  getAdminScope,
  canManageAdminRoles,
  canManageCasesAndDisputes,
  canManageCompliance,
  canExportAuditData
} from "@/utils";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 20;

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export default function AdminOperations() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [opsError, setOpsError] = useState("");
  const [overview, setOverview] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const [admins, setAdmins] = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminScopeFilter, setAdminScopeFilter] = useState("all");
  const [promoteTarget, setPromoteTarget] = useState("");
  const [promoteScope, setPromoteScope] = useState("full");
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [promoteMessage, setPromoteMessage] = useState("");
  const [promoteError, setPromoteError] = useState("");
  const [adminActionLoadingId, setAdminActionLoadingId] = useState("");
  const [invites, setInvites] = useState([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteScope, setInviteScope] = useState("support");
  const [inviteHours, setInviteHours] = useState(72);
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState("");

  const [cases, setCases] = useState([]);
  const [casesTotal, setCasesTotal] = useState(0);
  const [casesPage, setCasesPage] = useState(1);
  const [casesStatus, setCasesStatus] = useState("all");
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState("");
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [newCaseDesc, setNewCaseDesc] = useState("");
  const [newCaseTargetUser, setNewCaseTargetUser] = useState("");

  const [disputes, setDisputes] = useState([]);
  const [disputesTotal, setDisputesTotal] = useState(0);
  const [disputesPage, setDisputesPage] = useState(1);
  const [disputesStatus, setDisputesStatus] = useState("all");
  const [disputesLoading, setDisputesLoading] = useState(false);
  const [disputesError, setDisputesError] = useState("");
  const [newDisputeBookingId, setNewDisputeBookingId] = useState("");
  const [newDisputeReason, setNewDisputeReason] = useState("");

  const [expiring, setExpiring] = useState([]);
  const [expiringTotal, setExpiringTotal] = useState(0);
  const [expiringPage, setExpiringPage] = useState(1);
  const [expiringDays, setExpiringDays] = useState(30);
  const [expiringLoading, setExpiringLoading] = useState(false);
  const [expiringError, setExpiringError] = useState("");

  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsTotal, setSnapshotsTotal] = useState(0);
  const [snapshotsPage, setSnapshotsPage] = useState(1);
  const [snapshotUserFilter, setSnapshotUserFilter] = useState("");
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotsError, setSnapshotsError] = useState("");

  const [signupAttempts, setSignupAttempts] = useState([]);
  const [signupAttemptsTotal, setSignupAttemptsTotal] = useState(0);
  const [signupAttemptsPage, setSignupAttemptsPage] = useState(1);
  const [signupEmailFilter, setSignupEmailFilter] = useState("");
  const [signupSuccessFilter, setSignupSuccessFilter] = useState("all");
  const [signupSourceFilter, setSignupSourceFilter] = useState("all");
  const [signupAttemptsLoading, setSignupAttemptsLoading] = useState(false);
  const [signupAttemptsError, setSignupAttemptsError] = useState("");

  const adminScope = useMemo(() => getAdminScope(currentUser), [currentUser]);
  const canRoles = useMemo(() => canManageAdminRoles(currentUser), [currentUser]);
  const canCasesDisputes = useMemo(() => canManageCasesAndDisputes(currentUser), [currentUser]);
  const canComplianceOps = useMemo(() => canManageCompliance(currentUser), [currentUser]);
  const canExport = useMemo(() => canExportAuditData(currentUser), [currentUser]);

  const totalCasesPages = Math.max(1, Math.ceil(casesTotal / PAGE_SIZE));
  const totalDisputesPages = Math.max(1, Math.ceil(disputesTotal / PAGE_SIZE));
  const totalExpiringPages = Math.max(1, Math.ceil(expiringTotal / PAGE_SIZE));
  const totalSnapshotsPages = Math.max(1, Math.ceil(snapshotsTotal / PAGE_SIZE));
  const totalSignupAttemptsPages = Math.max(1, Math.ceil(signupAttemptsTotal / PAGE_SIZE));

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(createPageUrl("AdminDashboard"));
  };

  const loadTopCards = async () => {
    setOverviewLoading(true);
    setOpsError("");
    try {
      const [overviewData, weeklyData] = await Promise.all([
        User.getAdminOpsOverview(),
        User.getWeeklyOpsReport()
      ]);
      setOverview(overviewData || null);
      setWeekly(weeklyData || null);
    } catch (error) {
      setOpsError(error.message || "Failed to load summary cards");
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadAdmins = async () => {
    setAdminsLoading(true);
    try {
      const adminData = await User.listAdminUsersOps({
        limit: 100,
        offset: 0,
        search: adminSearch.trim() || undefined,
        scope: adminScopeFilter !== "all" ? adminScopeFilter : undefined
      });
      setAdmins(adminData?.data || []);
    } finally {
      setAdminsLoading(false);
    }
  };

  const loadCases = async () => {
    setCasesLoading(true);
    setCasesError("");
    try {
      const caseData = await User.listAdminCases({
        include_total: 1,
        limit: PAGE_SIZE,
        offset: (casesPage - 1) * PAGE_SIZE,
        status: casesStatus !== "all" ? casesStatus : undefined
      });
      setCases(caseData?.data || []);
      setCasesTotal(Number(caseData?.total || 0));
    } catch (error) {
      setCasesError(error.message || "Failed to load cases");
    } finally {
      setCasesLoading(false);
    }
  };

  const loadDisputes = async () => {
    setDisputesLoading(true);
    setDisputesError("");
    try {
      const disputeData = await User.listBookingDisputes({
        include_total: 1,
        limit: PAGE_SIZE,
        offset: (disputesPage - 1) * PAGE_SIZE,
        status: disputesStatus !== "all" ? disputesStatus : undefined
      });
      setDisputes(disputeData?.data || []);
      setDisputesTotal(Number(disputeData?.total || 0));
    } catch (error) {
      setDisputesError(error.message || "Failed to load disputes");
    } finally {
      setDisputesLoading(false);
    }
  };

  const loadExpiring = async () => {
    setExpiringLoading(true);
    setExpiringError("");
    try {
      const expiringData = await User.listComplianceExpiring({
        days: expiringDays,
        include_total: 1,
        limit: PAGE_SIZE,
        offset: (expiringPage - 1) * PAGE_SIZE
      });
      setExpiring(expiringData?.data || []);
      setExpiringTotal(Number(expiringData?.total || 0));
    } catch (error) {
      setExpiringError(error.message || "Failed to load compliance alerts");
    } finally {
      setExpiringLoading(false);
    }
  };

  const loadSnapshots = async () => {
    setSnapshotsLoading(true);
    setSnapshotsError("");
    try {
      const snapshotData = await User.listDeletedUserSnapshots({
        include_total: 1,
        limit: PAGE_SIZE,
        offset: (snapshotsPage - 1) * PAGE_SIZE,
        user_id: snapshotUserFilter.trim() || undefined
      });
      setSnapshots(snapshotData?.data || []);
      setSnapshotsTotal(Number(snapshotData?.total || 0));
    } catch (error) {
      setSnapshotsError(error.message || "Failed to load snapshots");
    } finally {
      setSnapshotsLoading(false);
    }
  };

  const loadSignupAttempts = async () => {
    setSignupAttemptsLoading(true);
    setSignupAttemptsError("");
    try {
      const authData = await User.listAuthLogs({
        include_total: 1,
        limit: PAGE_SIZE,
        offset: (signupAttemptsPage - 1) * PAGE_SIZE,
        event_type: 'signup',
        user_email: signupEmailFilter.trim() || undefined,
        success: signupSuccessFilter !== 'all' ? signupSuccessFilter : undefined,
        signup_source: signupSourceFilter !== 'all' ? signupSourceFilter : undefined
      });
      setSignupAttempts(authData?.data || []);
      setSignupAttemptsTotal(Number(authData?.total || 0));
    } catch (error) {
      setSignupAttemptsError(error.message || 'Failed to load signup attempts');
    } finally {
      setSignupAttemptsLoading(false);
    }
  };

  const bootstrap = async () => {
    try {
      const me = await User.me();
      setCurrentUser(me);
      if (!isAdminUser(me)) {
        navigate(createPageUrl("Landing"));
        return;
      }
    } catch (error) {
      setOpsError(error.message || "Failed to initialize admin operations");
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (!initialized) return;
    loadTopCards();
  }, [initialized]);

  useEffect(() => {
    if (!initialized) return;
    loadAdmins();
  }, [initialized, adminSearch, adminScopeFilter]);

  useEffect(() => {
    if (!initialized) return;
    loadCases();
  }, [initialized, casesPage, casesStatus]);

  useEffect(() => {
    if (!initialized) return;
    loadDisputes();
  }, [initialized, disputesPage, disputesStatus]);

  useEffect(() => {
    if (!initialized) return;
    loadExpiring();
  }, [initialized, expiringPage, expiringDays]);

  useEffect(() => {
    if (!initialized) return;
    loadSnapshots();
  }, [initialized, snapshotsPage, snapshotUserFilter]);

  useEffect(() => {
    if (!initialized) return;
    loadSignupAttempts();
  }, [initialized, signupAttemptsPage, signupEmailFilter, signupSuccessFilter, signupSourceFilter]);

  useEffect(() => {
    if (!initialized) return;
    loadAdminInvites();
  }, [initialized]);

  const createCase = async () => {
    if (!newCaseTitle.trim()) return;
    await User.createAdminCase({
      title: newCaseTitle.trim(),
      description: newCaseDesc.trim() || null,
      target_user_id: newCaseTargetUser.trim() || null
    });
    setNewCaseTitle("");
    setNewCaseDesc("");
    setNewCaseTargetUser("");
    await Promise.all([loadCases(), loadTopCards()]);
  };

  const updateCaseStatus = async (caseId, status) => {
    await User.updateAdminCase(caseId, { status });
    await Promise.all([loadCases(), loadTopCards()]);
  };

  const createDispute = async () => {
    if (!newDisputeReason.trim()) return;
    await User.createBookingDispute({
      booking_id: newDisputeBookingId.trim() || null,
      reason: newDisputeReason.trim()
    });
    setNewDisputeBookingId("");
    setNewDisputeReason("");
    await Promise.all([loadDisputes(), loadTopCards()]);
  };

  const updateDisputeStatus = async (disputeId, status) => {
    await User.updateBookingDispute(disputeId, { status });
    await Promise.all([loadDisputes(), loadTopCards()]);
  };

  const updateAdminScope = async (adminUserId, admin_scope) => {
    await User.updateAdminUserScope(adminUserId, { admin_scope });
    await loadAdmins();
  };

  const deactivateAdmin = async (adminUser) => {
    if (!adminUser?.id) return;
    const reason = window.prompt(`Reason for deactivating ${adminUser.full_name || adminUser.email}:`);
    if (!reason || !reason.trim()) return;

    setAdminActionLoadingId(adminUser.id);
    try {
      await User.delete(adminUser.id, {
        reason: reason.trim(),
        hard: false
      });
      await Promise.all([loadAdmins(), loadTopCards()]);
    } catch (error) {
      alert(error.message || 'Failed to deactivate admin');
    } finally {
      setAdminActionLoadingId("");
    }
  };

  const restoreAdmin = async (adminUser) => {
    if (!adminUser?.id) return;

    setAdminActionLoadingId(adminUser.id);
    try {
      await User.restore(adminUser.id);
      await Promise.all([loadAdmins(), loadTopCards()]);
    } catch (error) {
      alert(error.message || 'Failed to restore admin');
    } finally {
      setAdminActionLoadingId("");
    }
  };

  const promoteToAdmin = async () => {
    const target = promoteTarget.trim();
    if (!target) return;

    setPromoteLoading(true);
    setPromoteError("");
    setPromoteMessage("");
    try {
      const payload = target.includes('@')
        ? { email: target.toLowerCase(), admin_scope: promoteScope }
        : { user_id: target, admin_scope: promoteScope };
      const result = await User.promoteAdminUser(payload);
      setPromoteMessage(`Promoted ${result?.data?.email || target} to admin (${result?.data?.admin_scope || promoteScope}).`);
      setPromoteTarget("");
      await Promise.all([loadAdmins(), loadTopCards()]);
    } catch (error) {
      setPromoteError(error.message || 'Failed to promote user to admin');
    } finally {
      setPromoteLoading(false);
    }
  };

  const loadAdminInvites = async () => {
    setInvitesLoading(true);
    setInviteError("");
    try {
      const data = await User.listAdminInvites({ include_total: 1, limit: 20, offset: 0 });
      setInvites(data?.data || []);
    } catch (error) {
      setInviteError(error.message || 'Failed to load admin invites');
    } finally {
      setInvitesLoading(false);
    }
  };

  const createInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteError("");
    setInviteMessage("");

    try {
      const response = await User.createAdminInvite({
        email: inviteEmail.trim().toLowerCase(),
        admin_scope: inviteScope,
        expires_in_hours: Number(inviteHours || 72)
      });

      const delivered = response?.email_delivery?.sent === true;
      const preview = response?.data?.invite_link_preview;
      setInviteMessage(
        delivered
          ? `Invite sent to ${inviteEmail.trim().toLowerCase()}.`
          : `Invite created but email was not sent (SMTP not configured). Link preview: ${preview}`
      );
      setInviteEmail("");
      await loadAdminInvites();
    } catch (error) {
      setInviteError(error.message || 'Failed to create admin invite');
    }
  };

  const revokeInvite = async (inviteId) => {
    try {
      await User.revokeAdminInvite(inviteId);
      await loadAdminInvites();
    } catch (error) {
      setInviteError(error.message || 'Failed to revoke invite');
    }
  };

  const exportAudit = async (redaction) => {
    const res = await User.exportAuditLogs({ redaction, limit: 1000 });
    const rows = res?.data || [];
    if (!rows.length) {
      alert("No audit rows to export.");
      return;
    }

    const header = ["created_at", "action", "actor_user_id", "target_user_id", "metadata", "id"];
    const lines = rows.map((r) => [
      r.created_at,
      r.action,
      r.actor_user_id,
      r.target_user_id,
      JSON.stringify(r.metadata || {}),
      r.id
    ].map(csvCell).join(","));

    const csv = [header.map(csvCell).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-export-${redaction}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-8">Loading admin operations...</div>;
  if (!currentUser || !isAdminUser(currentUser)) return null;

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Button variant="outline" onClick={handleBack}>
          Back
        </Button>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Admin Operations</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div className="p-3 rounded border">
              <p className="text-xs text-slate-500">Total Accounts</p>
              <p className="text-2xl font-bold">{overview?.users?.total_accounts || 0}</p>
              <p className="text-xs text-slate-500">Deactivated: {overview?.users?.deactivated || 0}</p>
            </div>
            <div className="p-3 rounded border">
              <p className="text-xs text-slate-500">Open Cases</p>
              <p className="text-2xl font-bold">{overview?.operations?.open_cases || 0}</p>
              <p className="text-xs text-slate-500">Open Disputes: {overview?.operations?.open_disputes || 0}</p>
            </div>
            <div className="p-3 rounded border">
              <p className="text-xs text-slate-500">Reliability (24h)</p>
              <p className="text-sm">Auth Events: <span className="font-semibold">{overview?.reliability?.auth_events_24h || 0}</span></p>
              <p className="text-sm">Email Failures: <span className="font-semibold">{overview?.reliability?.email_failures_24h || 0}</span></p>
            </div>
          </CardContent>
        </Card>

        {opsError && (
          <p className="text-sm text-red-600">{opsError}</p>
        )}

        <p className="text-xs text-slate-500">Your scope: <span className="font-medium text-slate-700">{adminScope}</span>{overviewLoading ? " (refreshing...)" : ""}</p>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Weekly Report</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-3 text-sm">
            <div className="p-3 border rounded">
              <p className="text-slate-500">New Profiles</p>
              <p className="font-semibold">{weekly?.current_week?.new_profiles || 0}</p>
              <p className="text-xs">Delta: {weekly?.deltas_pct?.new_profiles || 0}%</p>
            </div>
            <div className="p-3 border rounded">
              <p className="text-slate-500">New Bookings</p>
              <p className="font-semibold">{weekly?.current_week?.new_bookings || 0}</p>
              <p className="text-xs">Delta: {weekly?.deltas_pct?.new_bookings || 0}%</p>
            </div>
            <div className="p-3 border rounded">
              <p className="text-slate-500">Completed Bookings</p>
              <p className="font-semibold">{weekly?.current_week?.completed_bookings || 0}</p>
              <p className="text-xs">Delta: {weekly?.deltas_pct?.completed_bookings || 0}%</p>
            </div>
            <div className="p-3 border rounded">
              <p className="text-slate-500">Admin Actions</p>
              <p className="font-semibold">{weekly?.current_week?.admin_actions || 0}</p>
              <p className="text-xs">Delta: {weekly?.deltas_pct?.admin_actions || 0}%</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Role & Permission Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid md:grid-cols-3 gap-2 pb-2">
              <Input
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                placeholder="Search admin by name/email"
              />
              <select
                value={adminScopeFilter}
                onChange={(e) => setAdminScopeFilter(e.target.value)}
                className="rounded border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="all">All scopes</option>
                <option value="full">full</option>
                <option value="support">support</option>
                <option value="compliance">compliance</option>
                <option value="ops">ops</option>
                <option value="read_only">read_only</option>
              </select>
              <div className="flex items-center text-xs text-slate-500">{adminsLoading ? "Loading admins..." : `${admins.length} admin records`}</div>
            </div>

            <div className="grid md:grid-cols-4 gap-2 pb-2">
              <Input
                value={promoteTarget}
                onChange={(e) => setPromoteTarget(e.target.value)}
                placeholder="User email or UUID"
                disabled={!canRoles || promoteLoading}
              />
              <select
                value={promoteScope}
                onChange={(e) => setPromoteScope(e.target.value)}
                disabled={!canRoles || promoteLoading}
                className="rounded border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="full">full (super admin)</option>
                <option value="support">support</option>
                <option value="compliance">compliance</option>
                <option value="ops">ops</option>
                <option value="read_only">read_only</option>
              </select>
              <Button onClick={promoteToAdmin} disabled={!canRoles || promoteLoading || !promoteTarget.trim()}>
                {promoteLoading ? 'Promoting...' : 'Promote To Admin'}
              </Button>
            </div>
            {promoteMessage && <p className="text-xs text-emerald-700">{promoteMessage}</p>}
            {promoteError && <p className="text-xs text-red-600">{promoteError}</p>}

            {admins.map((a) => (
              <div key={a.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border rounded p-3">
                <div>
                  <p className="font-medium">{a.full_name || a.email}</p>
                  <p className="text-xs text-slate-500">{a.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={a.admin_scope || "full"}
                    onChange={(e) => updateAdminScope(a.id, e.target.value)}
                    disabled={!canRoles}
                    className="rounded border px-2 py-1 text-sm"
                  >
                    <option value="full">full</option>
                    <option value="support">support</option>
                    <option value="compliance">compliance</option>
                    <option value="ops">ops</option>
                    <option value="read_only">read_only</option>
                  </select>
                  {a.id !== currentUser?.id && (
                    a.is_active === false ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canRoles || adminActionLoadingId === a.id}
                        onClick={() => restoreAdmin(a)}
                        className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                      >
                        Restore
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canRoles || adminActionLoadingId === a.id}
                        onClick={() => deactivateAdmin(a)}
                        className="text-red-700 hover:text-red-800 hover:bg-red-50"
                      >
                        Deactivate
                      </Button>
                    )
                  )}
                </div>
              </div>
            ))}
            {!canRoles && (
              <p className="text-xs text-slate-500">Your scope does not allow role/scope changes.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Admin Invites (Unregistered Emails)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-4 gap-2">
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Invite email"
                disabled={!canRoles}
              />
              <select
                value={inviteScope}
                onChange={(e) => setInviteScope(e.target.value)}
                disabled={!canRoles}
                className="rounded border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="full">full (super admin)</option>
                <option value="support">support</option>
                <option value="compliance">compliance</option>
                <option value="ops">ops</option>
                <option value="read_only">read_only</option>
              </select>
              <Input
                type="number"
                min={1}
                max={168}
                value={inviteHours}
                onChange={(e) => setInviteHours(Number(e.target.value || 72))}
                placeholder="Expires (hours)"
                disabled={!canRoles}
              />
              <Button onClick={createInvite} disabled={!canRoles || !inviteEmail.trim()}>
                Send Invite
              </Button>
            </div>

            {inviteMessage && <p className="text-xs text-emerald-700 break-all">{inviteMessage}</p>}
            {inviteError && <p className="text-xs text-red-600">{inviteError}</p>}

            {invitesLoading ? (
              <p className="text-sm text-slate-500">Loading invites...</p>
            ) : invites.length === 0 ? (
              <p className="text-sm text-slate-500">No admin invites yet.</p>
            ) : (
              invites.map((invite) => (
                <div key={invite.id} className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <p className="font-medium">{invite.email}</p>
                    <p className="text-xs text-slate-500">
                      {invite.admin_scope} • {invite.status} • expires {invite.expires_at ? new Date(invite.expires_at).toLocaleString() : 'n/a'}
                    </p>
                  </div>
                  {invite.status === 'pending' && (
                    <Button size="sm" variant="outline" onClick={() => revokeInvite(invite.id)} disabled={!canRoles}>
                      Revoke
                    </Button>
                  )}
                </div>
              ))
            )}

            {!canRoles && <p className="text-xs text-slate-500">Only full-scope admins can create/revoke invites.</p>}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Case Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-4 gap-2">
              <select
                value={casesStatus}
                onChange={(e) => {
                  setCasesStatus(e.target.value);
                  setCasesPage(1);
                }}
                className="rounded border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="open">open</option>
                <option value="in_progress">in_progress</option>
                <option value="blocked">blocked</option>
                <option value="resolved">resolved</option>
                <option value="closed">closed</option>
              </select>
              <div className="flex items-center text-xs text-slate-500">{casesLoading ? "Loading..." : `${casesTotal} total`}</div>
            </div>

            <div className="grid md:grid-cols-3 gap-2">
              <Input value={newCaseTitle} onChange={(e) => setNewCaseTitle(e.target.value)} placeholder="Case title" />
              <Input value={newCaseTargetUser} onChange={(e) => setNewCaseTargetUser(e.target.value)} placeholder="Target user id (optional)" />
              <Button onClick={createCase} disabled={!canCasesDisputes}>Create Case</Button>
            </div>
            <Textarea value={newCaseDesc} onChange={(e) => setNewCaseDesc(e.target.value)} placeholder="Case description (optional)" />
            {casesError && <p className="text-xs text-red-600">{casesError}</p>}
            {cases.map((c) => (
              <div key={c.id} className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="text-xs text-slate-500">{c.status} • {c.priority}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => updateCaseStatus(c.id, "in_progress")} disabled={!canCasesDisputes}>In Progress</Button>
                  <Button size="sm" variant="outline" onClick={() => updateCaseStatus(c.id, "resolved")} disabled={!canCasesDisputes}>Resolve</Button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button variant="outline" disabled={casesPage <= 1} onClick={() => setCasesPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <span className="text-sm text-slate-600">Page {casesPage} of {totalCasesPages}</span>
              <Button variant="outline" disabled={casesPage >= totalCasesPages} onClick={() => setCasesPage((p) => Math.min(totalCasesPages, p + 1))}>Next</Button>
            </div>
            {!canCasesDisputes && <p className="text-xs text-slate-500">Your scope is read-only for case/dispute mutations.</p>}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Disputes & Refund Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-4 gap-2">
              <select
                value={disputesStatus}
                onChange={(e) => {
                  setDisputesStatus(e.target.value);
                  setDisputesPage(1);
                }}
                className="rounded border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="open">open</option>
                <option value="under_review">under_review</option>
                <option value="resolved">resolved</option>
                <option value="closed">closed</option>
              </select>
              <div className="flex items-center text-xs text-slate-500">{disputesLoading ? "Loading..." : `${disputesTotal} total`}</div>
            </div>

            <div className="grid md:grid-cols-3 gap-2">
              <Input value={newDisputeBookingId} onChange={(e) => setNewDisputeBookingId(e.target.value)} placeholder="Booking id (optional)" />
              <Input value={newDisputeReason} onChange={(e) => setNewDisputeReason(e.target.value)} placeholder="Dispute reason" />
              <Button onClick={createDispute} disabled={!canCasesDisputes}>Create Dispute</Button>
            </div>
            {disputesError && <p className="text-xs text-red-600">{disputesError}</p>}
            {disputes.map((d) => (
              <div key={d.id} className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="font-medium">{d.reason}</p>
                  <p className="text-xs text-slate-500">{d.status} {d.decision ? `• ${d.decision}` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => updateDisputeStatus(d.id, "under_review")} disabled={!canCasesDisputes}>Under Review</Button>
                  <Button size="sm" variant="outline" onClick={() => updateDisputeStatus(d.id, "resolved")} disabled={!canCasesDisputes}>Resolve</Button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button variant="outline" disabled={disputesPage <= 1} onClick={() => setDisputesPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <span className="text-sm text-slate-600">Page {disputesPage} of {totalDisputesPages}</span>
              <Button variant="outline" disabled={disputesPage >= totalDisputesPages} onClick={() => setDisputesPage((p) => Math.min(totalDisputesPages, p + 1))}>Next</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Compliance Monitoring (Expiring Background Checks)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid md:grid-cols-4 gap-2 pb-2">
              <Input
                type="number"
                min={1}
                max={365}
                value={expiringDays}
                onChange={(e) => {
                  const next = Number(e.target.value || 30);
                  setExpiringDays(next);
                  setExpiringPage(1);
                }}
                placeholder="Days"
                disabled={!canComplianceOps}
              />
              <div className="flex items-center text-xs text-slate-500">{expiringLoading ? "Loading..." : `${expiringTotal} total`}</div>
            </div>
            {expiringError && <p className="text-xs text-red-600">{expiringError}</p>}
            {expiring.length === 0 ? (
              <p className="text-slate-500">No coaches expiring in next 30 days.</p>
            ) : (
              expiring.map((c) => (
                <div key={c.id} className="border rounded p-3 flex justify-between items-center gap-2">
                  <div>
                    <p className="font-medium">{c.full_name}</p>
                    <p className="text-xs text-slate-500">Expires: {c.background_check_expires_at || "n/a"}</p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700">Expiring</Badge>
                </div>
              ))
            )}
            <div className="flex items-center justify-between">
              <Button variant="outline" disabled={expiringPage <= 1} onClick={() => setExpiringPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <span className="text-sm text-slate-600">Page {expiringPage} of {totalExpiringPages}</span>
              <Button variant="outline" disabled={expiringPage >= totalExpiringPages} onClick={() => setExpiringPage((p) => Math.min(totalExpiringPages, p + 1))}>Next</Button>
            </div>
            {!canComplianceOps && <p className="text-xs text-slate-500">Your scope cannot access compliance actions.</p>}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>PII-Safe Exports</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => exportAudit("full")} disabled={!canExport || adminScope !== 'full'}>Export Audit (Full)</Button>
            <Button variant="outline" onClick={() => exportAudit("masked")} disabled={!canExport}>Export Audit (Masked)</Button>
            <Button variant="outline" onClick={() => exportAudit("strict")} disabled={!canExport}>Export Audit (Strict)</Button>
            {!canExport && <p className="text-xs text-slate-500">Your scope cannot export audit data.</p>}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Hard Delete Snapshots</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid md:grid-cols-4 gap-2 pb-2">
              <Input
                value={snapshotUserFilter}
                onChange={(e) => {
                  setSnapshotUserFilter(e.target.value);
                  setSnapshotsPage(1);
                }}
                placeholder="Filter by user UUID"
              />
              <div className="flex items-center text-xs text-slate-500">{snapshotsLoading ? "Loading..." : `${snapshotsTotal} total`}</div>
            </div>
            {snapshotsError && <p className="text-xs text-red-600">{snapshotsError}</p>}
            {snapshots.length === 0 ? (
              <p className="text-slate-500">No snapshots yet.</p>
            ) : (
              snapshots.map((s) => (
                <div key={s.id} className="border rounded p-3">
                  <p className="font-medium">User: {s.user_id}</p>
                  <p className="text-xs text-slate-500">Deleted at: {new Date(s.created_at).toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Reason: {s.reason || "n/a"}</p>
                </div>
              ))
            )}
            <div className="flex items-center justify-between">
              <Button variant="outline" disabled={snapshotsPage <= 1} onClick={() => setSnapshotsPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <span className="text-sm text-slate-600">Page {snapshotsPage} of {totalSnapshotsPages}</span>
              <Button variant="outline" disabled={snapshotsPage >= totalSnapshotsPages} onClick={() => setSnapshotsPage((p) => Math.min(totalSnapshotsPages, p + 1))}>Next</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Signup Attempts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid md:grid-cols-4 gap-2 pb-2">
              <Input
                value={signupEmailFilter}
                onChange={(e) => {
                  setSignupEmailFilter(e.target.value);
                  setSignupAttemptsPage(1);
                }}
                placeholder="Filter by user email"
              />
              <select
                value={signupSuccessFilter}
                onChange={(e) => {
                  setSignupSuccessFilter(e.target.value);
                  setSignupAttemptsPage(1);
                }}
                className="rounded border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="all">All attempts</option>
                <option value="true">Success only</option>
                <option value="false">Failed only</option>
              </select>
              <select
                value={signupSourceFilter}
                onChange={(e) => {
                  setSignupSourceFilter(e.target.value);
                  setSignupAttemptsPage(1);
                }}
                className="rounded border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="all">All sources</option>
                <option value="email">Email</option>
                <option value="oauth">OAuth</option>
                <option value="invite">Invite</option>
                <option value="unknown">Unknown</option>
              </select>
              <div className="flex items-center text-xs text-slate-500">{signupAttemptsLoading ? "Loading..." : `${signupAttemptsTotal} total`}</div>
            </div>
            {signupAttemptsError && <p className="text-xs text-red-600">{signupAttemptsError}</p>}
            {signupAttempts.length === 0 ? (
              <p className="text-slate-500">No signup attempts logged yet.</p>
            ) : (
              signupAttempts.map((attempt) => (
                <div key={attempt.id} className="border rounded p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{attempt.user_email || 'unknown'}</p>
                    <Badge className={attempt.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                      {attempt.success ? 'success' : 'failed'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(attempt.timestamp || attempt.created_at).toLocaleString()} • {attempt.event_type}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    source: {attempt.signup_source || 'unknown'}
                  </p>
                  {!attempt.success && attempt.error_details && (
                    <p className="text-xs text-red-600 mt-1 break-all">{String(attempt.error_details)}</p>
                  )}
                </div>
              ))
            )}
            <div className="flex items-center justify-between">
              <Button variant="outline" disabled={signupAttemptsPage <= 1} onClick={() => setSignupAttemptsPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <span className="text-sm text-slate-600">Page {signupAttemptsPage} of {totalSignupAttemptsPages}</span>
              <Button variant="outline" disabled={signupAttemptsPage >= totalSignupAttemptsPages} onClick={() => setSignupAttemptsPage((p) => Math.min(totalSignupAttemptsPages, p + 1))}>Next</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
