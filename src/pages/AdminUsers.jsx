
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@/api/entities.jsx";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ExternalLink, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [reason, setReason] = useState("");
  const [requests, setRequests] = useState([]);
  const [requestActionReason, setRequestActionReason] = useState("");
  const [decidingId, setDecidingId] = useState(null);

  const formatService = (s) => s?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());

  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get("type") || "all";

  const handleCardClick = (user) => {
    // Navigate to the appropriate profile page based on user type
    if (user.user_type === "coach") {
      navigate(`${createPageUrl("CoachProfile")}?userId=${user.id}`);
    } else {
      navigate(`${createPageUrl("UserProfile")}?userId=${user.id}`);
    }
  };

  const openRemove = (u) => {
    setSelectedUser(u);
    setReason("");
    setConfirmOpen(true);
  };

  const handleRemove = async () => {
    if (!selectedUser) return;
    try {
      await User.delete(selectedUser.id, { reason });
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, is_active: false, deactivated_at: new Date().toISOString(), deactivation_reason: reason } : u));
      setConfirmOpen(false);
    } catch (e) {
      alert(`Failed to remove user: ${e.message}`);
    }
  };

  useEffect(() => {
    const load = async () => {
      const me = await User.me();
      setCurrentUser(me);
      if (me.role !== "admin") return;
      const all = await User.list();
      setUsers(all);
      // Load pending deletion requests
      try {
        const pending = await User.listDeletionRequests({ status: 'pending' });
        setRequests(pending);
      } catch (e) {
        console.warn('Failed to load deletion requests', e);
      }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return users
      .filter(u => {
        if (typeParam === "all") return true;
        if (typeParam === "client") return (u.user_type === "client" || u.user_type === "user") && u.role !== "admin";
        if (typeParam === "coach") return u.user_type === "coach" && u.role !== "admin";
        return u.user_type === typeParam;
      })
      .filter(u => {
        const s = search.toLowerCase();
        return (
          u.full_name?.toLowerCase().includes(s) ||
          u.email?.toLowerCase().includes(s)
        );
      });
  }, [users, typeParam, search]);

  if (loading) return <div className="p-8">Loading users...</div>;
  if (!currentUser || currentUser.role !== "admin") return null;

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
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((u, idx) => (
                <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}>
                  <Card 
                    className="border border-slate-200 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all duration-200 group"
                    onClick={() => handleCardClick(u)}
                  >
                    <CardContent className="p-4">
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
                            <Badge className={u.role === "admin" ? "bg-yellow-100 text-yellow-800" : "bg-slate-100 text-slate-700"}>{u.role || "user"}</Badge>
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
                          {(u.user_type === "client" || u.user_type === "user") && u.preferred_coaching_types?.length > 0 && (
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
                    {currentUser?.role === 'admin' && u.role !== 'admin' && (
                      <div className="flex justify-end pb-3 pr-3">
                        {u.is_active !== false ? (
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openRemove(u); }} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="w-4 h-4 mr-2" /> Remove
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={async (e) => { e.stopPropagation(); try { await User.restore(u.id); setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: true, deactivated_at: null, deactivation_reason: null } : x)); } catch { alert('Failed to restore user'); } }} className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50">
                            Restore
                          </Button>
                        )}
                      </div>
                    )}
                  </Card>
                </motion.div>
              ))}
            </div>
            {filtered.length === 0 && <p className="text-slate-500 mt-4">No users found.</p>}
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
            <p className="text-sm text-slate-600">You&apos;re removing {selectedUser?.full_name || 'this user'}. This is a soft deactivation—they won&apos;t be able to log in. Please provide a reason (visible to admins only).</p>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for removal (optional)" />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={handleRemove}>Remove user</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
