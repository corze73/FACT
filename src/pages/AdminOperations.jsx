import { useEffect, useState } from "react";
import { User } from "@/api/entities.jsx";
import { createPageUrl, isAdminUser } from "@/utils";
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
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [weekly, setWeekly] = useState(null);

  const [admins, setAdmins] = useState([]);

  const [cases, setCases] = useState([]);
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [newCaseDesc, setNewCaseDesc] = useState("");
  const [newCaseTargetUser, setNewCaseTargetUser] = useState("");

  const [disputes, setDisputes] = useState([]);
  const [newDisputeBookingId, setNewDisputeBookingId] = useState("");
  const [newDisputeReason, setNewDisputeReason] = useState("");

  const [expiring, setExpiring] = useState([]);
  const [snapshots, setSnapshots] = useState([]);

  const load = async () => {
    try {
      const me = await User.me();
      setCurrentUser(me);
      if (!isAdminUser(me)) {
        navigate(createPageUrl("Landing"));
        return;
      }

      const [
        overviewData,
        weeklyData,
        adminData,
        caseData,
        disputeData,
        expiringData,
        snapshotData
      ] = await Promise.all([
        User.getAdminOpsOverview(),
        User.getWeeklyOpsReport(),
        User.listAdminUsersOps({ limit: 50, offset: 0 }),
        User.listAdminCases({ include_total: 1, limit: PAGE_SIZE, offset: 0 }),
        User.listBookingDisputes({ include_total: 1, limit: PAGE_SIZE, offset: 0 }),
        User.listComplianceExpiring({ days: 30, limit: PAGE_SIZE, offset: 0 }),
        User.listDeletedUserSnapshots({ include_total: 1, limit: PAGE_SIZE, offset: 0 })
      ]);

      setOverview(overviewData || null);
      setWeekly(weeklyData || null);
      setAdmins(adminData?.data || []);
      setCases(caseData?.data || []);
      setDisputes(disputeData?.data || []);
      setExpiring(expiringData?.data || []);
      setSnapshots(snapshotData?.data || []);
    } catch (error) {
      alert(error.message || "Failed to load admin operations data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
    await load();
  };

  const updateCaseStatus = async (caseId, status) => {
    await User.updateAdminCase(caseId, { status });
    await load();
  };

  const createDispute = async () => {
    if (!newDisputeReason.trim()) return;
    await User.createBookingDispute({
      booking_id: newDisputeBookingId.trim() || null,
      reason: newDisputeReason.trim()
    });
    setNewDisputeBookingId("");
    setNewDisputeReason("");
    await load();
  };

  const updateDisputeStatus = async (disputeId, status) => {
    await User.updateBookingDispute(disputeId, { status });
    await load();
  };

  const updateAdminScope = async (adminUserId, admin_scope) => {
    await User.updateAdminUserScope(adminUserId, { admin_scope });
    await load();
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
                    className="rounded border px-2 py-1 text-sm"
                  >
                    <option value="full">full</option>
                    <option value="support">support</option>
                    <option value="compliance">compliance</option>
                    <option value="ops">ops</option>
                    <option value="read_only">read_only</option>
                  </select>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Case Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-3 gap-2">
              <Input value={newCaseTitle} onChange={(e) => setNewCaseTitle(e.target.value)} placeholder="Case title" />
              <Input value={newCaseTargetUser} onChange={(e) => setNewCaseTargetUser(e.target.value)} placeholder="Target user id (optional)" />
              <Button onClick={createCase}>Create Case</Button>
            </div>
            <Textarea value={newCaseDesc} onChange={(e) => setNewCaseDesc(e.target.value)} placeholder="Case description (optional)" />
            {cases.map((c) => (
              <div key={c.id} className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="text-xs text-slate-500">{c.status} • {c.priority}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => updateCaseStatus(c.id, "in_progress")}>In Progress</Button>
                  <Button size="sm" variant="outline" onClick={() => updateCaseStatus(c.id, "resolved")}>Resolve</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Disputes & Refund Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-3 gap-2">
              <Input value={newDisputeBookingId} onChange={(e) => setNewDisputeBookingId(e.target.value)} placeholder="Booking id (optional)" />
              <Input value={newDisputeReason} onChange={(e) => setNewDisputeReason(e.target.value)} placeholder="Dispute reason" />
              <Button onClick={createDispute}>Create Dispute</Button>
            </div>
            {disputes.map((d) => (
              <div key={d.id} className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="font-medium">{d.reason}</p>
                  <p className="text-xs text-slate-500">{d.status} {d.decision ? `• ${d.decision}` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => updateDisputeStatus(d.id, "under_review")}>Under Review</Button>
                  <Button size="sm" variant="outline" onClick={() => updateDisputeStatus(d.id, "resolved")}>Resolve</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Compliance Monitoring (Expiring Background Checks)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>PII-Safe Exports</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => exportAudit("full")}>Export Audit (Full)</Button>
            <Button variant="outline" onClick={() => exportAudit("masked")}>Export Audit (Masked)</Button>
            <Button variant="outline" onClick={() => exportAudit("strict")}>Export Audit (Strict)</Button>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Hard Delete Snapshots</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
