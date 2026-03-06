import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@/api/entities.jsx";
import { createPageUrl, isAdminUser } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 25;
const ACTION_OPTIONS = [
  "all",
  "user_deactivated",
  "user_hard_delete",
  "account_deletion_approved",
  "account_deletion_rejected"
];

const formatAction = (value) => value.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());

const toneForAction = (action) => {
  if (action === "user_hard_delete") return "bg-red-100 text-red-700";
  if (action === "user_deactivated") return "bg-amber-100 text-amber-700";
  if (action === "account_deletion_approved") return "bg-emerald-100 text-emerald-700";
  if (action === "account_deletion_rejected") return "bg-slate-100 text-slate-700";
  return "bg-blue-100 text-blue-700";
};

const formatDateTime = (iso) => {
  if (!iso) return "-";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
};

const metadataSummary = (metadata) => {
  if (!metadata || typeof metadata !== "object") return "No metadata";
  if (typeof metadata.reason === "string" && metadata.reason.trim()) {
    return metadata.reason.trim();
  }
  return JSON.stringify(metadata);
};

export default function AdminAuditLogs() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState("all");
  const [actorId, setActorId] = useState("");
  const [targetId, setTargetId] = useState("");

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const load = async ({ showSpinner = false, pageOverride } = {}) => {
    if (showSpinner) setIsRefreshing(true);

    try {
      const me = await User.me();
      setCurrentUser(me);
      if (!isAdminUser(me)) {
        navigate(createPageUrl("Landing"));
        return;
      }

      const activePage = Number.isInteger(pageOverride) ? pageOverride : page;
      const offset = (activePage - 1) * PAGE_SIZE;
      const filters = {
        limit: PAGE_SIZE,
        offset,
        include_total: 1
      };

      if (action !== "all") filters.action = action;
      if (actorId.trim()) filters.actor_user_id = actorId.trim();
      if (targetId.trim()) filters.target_user_id = targetId.trim();

      const response = await User.listAdminAuditLogs(filters);
      setRows(Array.isArray(response?.data) ? response.data : []);
      setTotal(Number(response?.total || 0));
    } catch (error) {
      console.error("Failed to load admin audit logs", error);
      alert(error.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
      if (showSpinner) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [page]);

  const applyFilters = async () => {
    const nextPage = 1;
    setPage(nextPage);
    await load({ showSpinner: true, pageOverride: nextPage });
  };

  const clearFilters = async () => {
    setAction("all");
    setActorId("");
    setTargetId("");
    const nextPage = 1;
    setPage(nextPage);
    await load({ showSpinner: true, pageOverride: nextPage });
  };

  if (loading) return <div className="p-8">Loading audit logs...</div>;
  if (!currentUser || !isAdminUser(currentUser)) return null;

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Admin Audit Logs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-slate-500">Action</label>
                <select
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                >
                  {ACTION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === "all" ? "All actions" : formatAction(option)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Actor user ID</label>
                <Input
                  placeholder="UUID"
                  value={actorId}
                  onChange={(e) => setActorId(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Target user ID</label>
                <Input
                  placeholder="UUID"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={applyFilters} disabled={isRefreshing}>Apply</Button>
                <Button variant="outline" onClick={clearFilters} disabled={isRefreshing}>Clear</Button>
              </div>
            </div>

            {isRefreshing && (
              <p className="text-xs text-slate-500">Refreshing logs...</p>
            )}

            {rows.length === 0 ? (
              <p className="text-slate-600">No audit log entries found for the selected filters.</p>
            ) : (
              <div className="space-y-3">
                {rows.map((row) => (
                  <div key={row.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={toneForAction(row.action)}>{formatAction(row.action)}</Badge>
                        <span className="text-xs text-slate-500">{formatDateTime(row.created_at)}</span>
                      </div>
                      <span className="text-xs text-slate-500">Log ID: {row.id}</span>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-slate-500">Actor</p>
                        <p className="text-slate-800 break-all">{row.actor_name || "Unknown"} ({row.actor_user_id})</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Target</p>
                        <p className="text-slate-800 break-all">{row.target_name || "Deleted/Unknown"} ({row.target_user_id})</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-slate-500 text-sm">Metadata</p>
                      <p className="text-sm text-slate-800 break-words">{metadataSummary(row.metadata)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
