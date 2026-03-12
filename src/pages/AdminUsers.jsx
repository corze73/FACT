
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@/api/entities.jsx";
import { apiClient } from "@/api/apiClient.js";
import { createPageUrl, isAdminUser, canManageUserLifecycle, canHardDeleteUsers } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ExternalLink, Trash2, Check, X, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const USERS_PER_PAGE = 20;
const normalizeUserType = (value) => {
  if (value === 'coach' || value === 'client') return value;
  if (value === 'user' || !value) return 'client';
  return value;
};

const normalizeUserList = (list) => (Array.isArray(list)
  ? list.map((u) => ({ ...u, user_type: normalizeUserType(u.user_type) }))
  : list
);

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [reason, setReason] = useState("");
  const [hardDelete, setHardDelete] = useState(false);
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [secondAdminId, setSecondAdminId] = useState("");
  const [requests, setRequests] = useState([]);
  const [requestActionReason, setRequestActionReason] = useState("");
  const [decidingId, setDecidingId] = useState(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState(new Set());
  const [adminApprovers, setAdminApprovers] = useState([]);

  const formatService = (s) => s?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());

  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get("type") || "all";
  const hasActiveFilters = search.trim().length > 0 || typeParam !== "all";

  const handleCardClick = (user) => {
    // Navigate to the appropriate profile page based on user type
    if (user.user_type === "coach") {
      navigate(`${createPageUrl("CoachProfile")}?userId=${user.id}`);
    } else if (user.user_type === "admin") {
      // Admin accounts don't have a user-facing profile page; go to Operations
      navigate(createPageUrl("AdminOperations"));
    } else {
      navigate(`${createPageUrl("UserProfile")}?userId=${user.id}`);
    }
  };

  const openRemove = (u) => {
    setSelectedUser(u);
    setReason("");
    setHardDelete(false);
    setConfirmationPhrase("");
    setSecondAdminId("");
    setConfirmOpen(true);
  };

  const handleRemove = async () => {
    if (!selectedUser) return;

    const previousUsers = users;
    const previousTotalUsers = totalUsers;

    try {
      const selectedId = selectedUser.id;
      setPendingDeleteIds(prev => new Set(prev).add(selectedId));

      if (hardDelete) {
        setUsers(prev => prev.filter(u => u.id !== selectedId));
        setTotalUsers(prev => Math.max(0, prev - 1));
      } else {
        setUsers(prev => prev.map(u => u.id === selectedId
          ? { ...u, is_active: false, deactivated_at: new Date().toISOString(), deactivation_reason: reason }
          : u));
      }

      setConfirmOpen(false);
      await User.delete(selectedUser.id, {
        reason,
        hard: hardDelete,
        confirmation_phrase: hardDelete ? confirmationPhrase : undefined,
        second_admin_id: hardDelete && secondAdminId.trim() ? secondAdminId : undefined
      });
    } catch (e) {
      setUsers(previousUsers);
      setTotalUsers(previousTotalUsers);
      alert(`Failed to remove user: ${e.message}`);
    } finally {
      setPendingDeleteIds(prev => {
        const next = new Set(prev);
        next.delete(selectedUser.id);
        return next;
      });
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const load = async () => {
      try {
        const me = await User.me();
        setCurrentUser(me);
        if (!isAdminUser(me)) return;

        setIsFetching(true);
        const params = {
          type: typeParam,
          limit: USERS_PER_PAGE,
          offset: (currentPage - 1) * USERS_PER_PAGE,
          include_total: '1',
          view: 'admin_list'
        };
        if (debouncedSearch) params.search = debouncedSearch;

        const response = await apiClient.getUsers(params);
        if (response && Array.isArray(response.data)) {
          setUsers(normalizeUserList(response.data));
          setTotalUsers(response.total || 0);
        } else {
          const list = Array.isArray(response) ? response : [];
          setUsers(normalizeUserList(list));
          setTotalUsers(list.length);
        }

        if (currentPage === 1) {
          const [pending, approvers] = await Promise.all([
            User.listDeletionRequests({ status: 'pending' }),
            User.listAdminUsersOps({ limit: 100, offset: 0 })
          ]);
          setRequests(pending);
          setAdminApprovers((approvers?.data || []).filter((a) => a.id !== me.id));
        }
      } catch (e) {
        console.warn('Failed to load users admin list', e);
      } finally {
        setLoading(false);
        setIsFetching(false);
      }
    };
    load();
  }, [currentPage, debouncedSearch, typeParam]);

  const paginatedUsers = users;
  const totalPages = Math.ceil(totalUsers / USERS_PER_PAGE);

  // Reset to page 1 when search or type changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, typeParam]);

  if (loading) return <div className="p-8">Loading users...</div>;
  if (!currentUser || !isAdminUser(currentUser)) return null;

  const canLifecycle = canManageUserLifecycle(currentUser);
  const canHardDelete = canHardDeleteUsers(currentUser);

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Deletion Requests Panel */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Account Deletion Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-slate-500">No pending requests.</p>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <div key={r.id} className="p-3 border rounded-md">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="font-medium">User: {r.user_id}</p>
                        <p className="text-sm text-slate-600">Reason: {r.reason || 'N/A'}</p>
                        <p className="text-xs text-slate-400">Requested at: {new Date(r.requested_at).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Decision reason (optional)"
                          value={decidingId === r.id ? requestActionReason : ''}
                          onChange={(e) => { setDecidingId(r.id); setRequestActionReason(e.target.value); }}
                          className="w-56"
                        />
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={async () => {
                          try {
                            await User.decideDeletionRequest(r.id, 'approved', requestActionReason || null, currentUser.id);
                            // Reflect immediately: deactivate user locally
                            setUsers(prev => prev.map(u => u.id === r.user_id ? { ...u, is_active: false, deactivated_at: new Date().toISOString(), deactivation_reason: requestActionReason || 'Account deletion approved' } : u));
                            setRequests(prev => prev.filter(x => x.id !== r.id));
                            setRequestActionReason('');
                            setDecidingId(null);
                          } catch (e) { alert('Failed to approve request: ' + e.message); }
                        }}>
                          <Check className="w-4 h-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" onClick={async () => {
                          try {
                            await User.decideDeletionRequest(r.id, 'rejected', requestActionReason || null, currentUser.id);
                            setRequests(prev => prev.filter(x => x.id !== r.id));
                            setRequestActionReason('');
                            setDecidingId(null);
                          } catch (e) { alert('Failed to reject request: ' + e.message); }
                        }}>
                          <X className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Users ({typeParam === "all" ? "All" : typeParam.charAt(0).toUpperCase() + typeParam.slice(1)})</CardTitle>
            {hasActiveFilters && (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setCurrentPage(1);
                    navigate(createPageUrl("AdminUsers?type=all"));
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
              {isFetching && !loading && (
                <p className="text-xs text-slate-500 mt-2">Updating users...</p>
              )}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
              {paginatedUsers.map((u, idx) => (
                <motion.div key={u.id} className="h-full" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}>
                  <Card 
                    className="border border-slate-200 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all duration-200 group h-full flex flex-col overflow-hidden"
                    onClick={() => handleCardClick(u)}
                  >
                    <CardContent className="p-4 flex-1">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                          <span className="font-semibold text-slate-600">{u.full_name?.charAt(0) || "U"}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900 truncate">{u.full_name || "Unnamed"}</p>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                          </div>
                          {/* Hide email (PII) for GDPR */}
                          <p className="text-xs text-slate-500">Email hidden</p>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className="capitalize">{u.user_type || "member"}</Badge>
                            <Badge className={u.user_type === "admin" ? "bg-yellow-100 text-yellow-800" : "bg-slate-100 text-slate-700"}>{u.user_type === 'admin' ? 'admin' : 'member'}</Badge>
                            {u.is_active === false && (
                              <Badge className="bg-red-100 text-red-700">deactivated</Badge>
                            )}
                          </div>

                          {/* Coach offerings */}
                          {u.user_type === "coach" && u.coach_profile?.services_offered?.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs text-slate-500 mb-1">Offers:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {u.coach_profile.services_offered.map(s => (
                                  <Badge key={s} className="bg-blue-50 text-blue-700 border border-blue-100">
                                    {formatService(s)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Client requirements */}
                          {u.user_type === "client" && u.preferred_coaching_types?.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs text-slate-500 mb-1">Needs:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {u.preferred_coaching_types.map(s => (
                                  <Badge key={s} className="bg-emerald-50 text-emerald-700 border border-emerald-100">
                                    {formatService(s)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                    {isAdminUser(currentUser) && u.user_type !== 'admin' && (
                      <div className="flex flex-wrap justify-end gap-2 p-4 pt-3 border-t border-slate-100">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(createPageUrl(`Conversation?direct_user_id=${u.id}`));
                          }}
                          className="text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                        >
                          <MessageCircle className="w-4 h-4 mr-2" /> Message
                        </Button>
                        {canLifecycle && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await User.revokeSessions(u.id);
                                alert('User sessions revoked. They will need to sign in again.');
                              } catch (err) {
                                alert('Failed to revoke sessions: ' + err.message);
                              }
                            }}
                            className="text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                          >
                            Revoke Sessions
                          </Button>
                        )}
                        {canLifecycle && (u.is_active !== false ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pendingDeleteIds.has(u.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              openRemove(u);
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Remove
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await User.restore(u.id);
                                setUsers((prev) =>
                                  prev.map((x) =>
                                    x.id === u.id
                                      ? { ...x, is_active: true, deactivated_at: null, deactivation_reason: null }
                                      : x
                                  )
                                );
                              } catch {
                                alert('Failed to restore user');
                              }
                            }}
                            className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                          >
                            Restore
                          </Button>
                        ))}
                      </div>
                    )}
                  </Card>
                </motion.div>
              ))}
            </div>
            
            {/* Pagination Controls */}
            {totalUsers > USERS_PER_PAGE && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                
                <div className="flex items-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      return page === 1 || 
                             page === totalPages || 
                             Math.abs(page - currentPage) <= 1;
                    })
                    .map((page, idx, arr) => (
                      <div key={page} className="flex items-center gap-2">
                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                          <span className="text-slate-400">...</span>
                        )}
                        <Button
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="w-10"
                        >
                          {page}
                        </Button>
                      </div>
                    ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
            
            {/* Results counter */}
            {totalUsers > 0 && (
              <div className="mt-4 text-center text-sm text-slate-600">
                Showing {((currentPage - 1) * USERS_PER_PAGE) + 1} - {Math.min(currentPage * USERS_PER_PAGE, totalUsers)} of {totalUsers} users
              </div>
            )}
            
            {users.length === 0 && <p className="text-slate-500 mt-4">No users found.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Confirm Removal Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove user</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">You&apos;re removing {selectedUser?.full_name || 'this user'}. This is a soft deactivation unless hard delete is checked. Reason is required for audit/compliance.</p>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for removal (required)" />
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={hardDelete}
                onChange={(e) => setHardDelete(e.target.checked)}
                disabled={!canHardDelete}
              />
              <span>
                Hard delete. This permanently removes the user and related records.
              </span>
            </label>
            {hardDelete && (
              <>
                <div>
                  <label className="text-xs text-slate-500">Second Admin Approver (optional for full admins)</label>
                  <select
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={secondAdminId}
                    onChange={(e) => setSecondAdminId(e.target.value)}
                  >
                    <option value="">Select second admin approver</option>
                    {adminApprovers.map((a) => (
                      <option key={a.id} value={a.id}>
                        {(a.full_name || a.email || a.id)} ({a.admin_scope || 'full'})
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  value={confirmationPhrase}
                  onChange={(e) => setConfirmationPhrase(e.target.value)}
                  placeholder={`Type exactly: HARD DELETE ${selectedUser?.id || ''}`}
                />
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                disabled={
                  !canLifecycle ||
                  !reason.trim() ||
                  (hardDelete && !confirmationPhrase.trim())
                }
                onClick={handleRemove}
              >
                {hardDelete ? 'Hard delete' : 'Remove user'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
