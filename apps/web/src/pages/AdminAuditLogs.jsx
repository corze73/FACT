import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { User } from "@/api/entities.jsx";
import { createLoginUrl, createPageUrl, isAdminUser } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { showError } from "@/utils/notifications";

const PAGE_SIZE = 25;
const ADMIN_AUDIT_CURRENT_USER_QUERY_KEY = ["admin-audit", "current-user"];
const ACTION_OPTIONS = [
  "all",
  "user_deactivated",
  "user_hard_delete",
  "account_deletion_approved",
  "account_deletion_rejected",
  "message_deleted",
  "message_conversation_cleared"
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

const toCsvCell = (value) => {
  const str = value === null || value === undefined ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
};

const isAuthFailure = (error) => error?.status === 401 || error?.message?.includes("Not authenticated");

export default function AdminAuditLogs() {
  const navigate = useNavigate();
  const location = useLocation();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("all");
  const [actorId, setActorId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);
  const [submittedFilters, setSubmittedFilters] = useState({
    action: "all",
    actorId: "",
    targetId: "",
    createdFrom: "",
    createdTo: ""
  });

  const currentUserQuery = useQuery({
    queryKey: ADMIN_AUDIT_CURRENT_USER_QUERY_KEY,
    queryFn: () => User.me(),
    staleTime: 5 * 60 * 1000,
  });

  const auditRowsQuery = useQuery({
    queryKey: ["admin-audit", "rows", page, submittedFilters],
    queryFn: async () => {
      const offset = (page - 1) * PAGE_SIZE;
      const filters = {
        limit: PAGE_SIZE,
        offset,
        include_total: 1,
      };

      if (submittedFilters.action !== "all") filters.action = submittedFilters.action;
      if (submittedFilters.actorId.trim()) filters.actor_user_id = submittedFilters.actorId.trim();
      if (submittedFilters.targetId.trim()) filters.target_user_id = submittedFilters.targetId.trim();
      if (submittedFilters.createdFrom) filters.created_from = submittedFilters.createdFrom;
      if (submittedFilters.createdTo) filters.created_to = submittedFilters.createdTo;

      const response = await User.listAdminAuditLogs(filters);
      return {
        rows: Array.isArray(response?.data) ? response.data : [],
        total: Number(response?.total || 0),
      };
    },
    enabled: Boolean(currentUserQuery.data && isAdminUser(currentUserQuery.data)),
    staleTime: 60 * 1000,
  });

  const deletedMessagesQuery = useQuery({
    queryKey: ["admin-audit", "deleted-messages"],
    queryFn: async () => {
      const response = await User.listAdminDeletedMessages({
        limit: 10,
        offset: 0,
        include_total: 0
      });
      return Array.isArray(response?.data) ? response.data : [];
    },
    enabled: Boolean(currentUserQuery.data && isAdminUser(currentUserQuery.data)),
    staleTime: 60 * 1000,
  });

  const currentUser = currentUserQuery.data ?? null;
  const rows = auditRowsQuery.data?.rows ?? [];
  const total = auditRowsQuery.data?.total ?? 0;
  const loading = currentUserQuery.isLoading || auditRowsQuery.isLoading;
  const isRefreshing = auditRowsQuery.isFetching;
  const deletedMessages = deletedMessagesQuery.data ?? [];
  const deletedMessagesLoading = deletedMessagesQuery.isLoading || deletedMessagesQuery.isFetching;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(createPageUrl("AdminDashboard"));
  };

  useEffect(() => {
    if (!currentUserQuery.error) return;
    console.error("Failed to load admin audit user", currentUserQuery.error);
    if (isAuthFailure(currentUserQuery.error)) {
      navigate(createLoginUrl(location.pathname + location.search));
    }
  }, [currentUserQuery.error, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!currentUser || isAdminUser(currentUser)) return;
    navigate(createPageUrl("Landing"));
  }, [currentUser, navigate]);

  useEffect(() => {
    if (!auditRowsQuery.error) return;
    console.error("Failed to load admin audit logs", auditRowsQuery.error);
    showError("Audit Logs Unavailable", auditRowsQuery.error.message || "Failed to load audit logs");
  }, [auditRowsQuery.error]);

  useEffect(() => {
    if (!deletedMessagesQuery.error) return;
    console.error("Failed to load deleted messages archive", deletedMessagesQuery.error);
    showError("Deleted Messages Unavailable", deletedMessagesQuery.error.message || "Failed to load deleted messages archive");
  }, [deletedMessagesQuery.error]);

  const applyFilters = async () => {
    setPage(1);
    setSubmittedFilters({ action, actorId, targetId, createdFrom, createdTo });
  };

  const clearFilters = async () => {
    const resetFilters = {
      action: "all",
      actorId: "",
      targetId: "",
      createdFrom: "",
      createdTo: ""
    };
    setAction(resetFilters.action);
    setActorId(resetFilters.actorId);
    setTargetId(resetFilters.targetId);
    setCreatedFrom(resetFilters.createdFrom);
    setCreatedTo(resetFilters.createdTo);
    setPage(1);
    setSubmittedFilters(resetFilters);
  };

  const exportCsv = () => {
    if (rows.length === 0) return;

    const header = [
      "created_at",
      "action",
      "actor_user_id",
      "actor_name",
      "target_user_id",
      "target_name",
      "reason",
      "metadata_json",
      "log_id"
    ];

    const lines = rows.map((row) => {
      const reason = row?.metadata?.reason || "";
      return [
        row.created_at,
        row.action,
        row.actor_user_id,
        row.actor_name || "",
        row.target_user_id,
        row.target_name || "",
        reason,
        JSON.stringify(row.metadata || {}),
        row.id
      ].map(toCsvCell).join(",");
    });

    const csvContent = [header.map(toCsvCell).join(","), ...lines].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `admin-audit-logs-page-${page}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-8">Loading audit logs...</div>;
  if (!currentUser || !isAdminUser(currentUser)) return null;

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Button variant="outline" onClick={handleBack}>
          Back
        </Button>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Admin Audit Logs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-6 gap-3">
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
              <div>
                <label className="text-xs text-slate-500">Created from</label>
                <Input
                  type="date"
                  value={createdFrom}
                  onChange={(e) => setCreatedFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Created to</label>
                <Input
                  type="date"
                  value={createdTo}
                  onChange={(e) => setCreatedTo(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={applyFilters} disabled={isRefreshing}>Apply</Button>
                <Button variant="outline" onClick={clearFilters} disabled={isRefreshing}>Clear</Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
                Export CSV (current page)
              </Button>
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
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <p className="text-sm text-slate-800 break-words">{metadataSummary(row.metadata)}</p>
                        <Button variant="outline" size="sm" onClick={() => setSelectedLog(row)}>
                          View details
                        </Button>
                      </div>
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

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Deleted Messages Archive</CardTitle>
          </CardHeader>
          <CardContent>
            {deletedMessagesLoading ? (
              <p className="text-slate-600">Loading deleted messages...</p>
            ) : deletedMessages.length === 0 ? (
              <p className="text-slate-600">No deleted messages archived yet.</p>
            ) : (
              <div className="space-y-3">
                {deletedMessages.map((row) => (
                  <div key={row.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-red-100 text-red-700">
                          {row.deletion_scope === 'conversation_clear' ? 'Conversation Cleared' : 'Message Deleted'}
                        </Badge>
                        <span className="text-xs text-slate-500">Deleted: {formatDateTime(row.deleted_at)}</span>
                      </div>
                      <span className="text-xs text-slate-500">Archive ID: {row.id}</span>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-slate-500">From</p>
                        <p className="text-slate-800 break-all">{row.sender_name || 'Unknown'} ({row.sender_id})</p>
                      </div>
                      <div>
                        <p className="text-slate-500">To</p>
                        <p className="text-slate-800 break-all">{row.receiver_name || 'Unknown'} ({row.receiver_id})</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-slate-500">Deleted by</p>
                        <p className="text-slate-800 break-all">{row.deleted_by_name || 'Unknown'} ({row.deleted_by_user_id})</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Booking ID</p>
                        <p className="text-slate-800 break-all">{row.booking_id || 'Direct conversation'}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-slate-500 text-sm">Original content</p>
                      <p className="text-sm text-slate-800 break-words whitespace-pre-wrap">{row.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Action: <span className="text-slate-900 font-medium">{formatAction(selectedLog.action)}</span></p>
              <p className="text-sm text-slate-600">Created: <span className="text-slate-900">{formatDateTime(selectedLog.created_at)}</span></p>
              <div>
                <p className="text-sm text-slate-600 mb-1">Metadata JSON</p>
                <pre className="max-h-80 overflow-auto rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-800 whitespace-pre-wrap break-words">
                  {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
