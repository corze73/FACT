import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities.jsx";
import { Booking } from "@/api/entities.jsx";
import { apiClient } from "@/api/apiClient.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Calendar, MessageCircle, Star, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { format, isValid } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Utility function to safely parse dates
const safeParseDate = (dateValue) => {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  return isValid(date) ? date : null;
};

// Utility function to format dates safely
const formatSafeDate = (dateValue, formatStr = 'PPP') => {
  const date = safeParseDate(dateValue);
  return date ? format(date, formatStr) : 'Date TBD';
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [stats, setStats] = useState({
    totalUsers: 0, // excludes admins
    totalAccounts: 0, // includes admins
    admins: 0,
    totalCoaches: 0,
    totalClients: 0,
    totalBookings: 0,
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    completed: 0
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionReason, setDecisionReason] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        // Check if user is logged in
        const storedUser = localStorage.getItem('currentUser');
        if (!storedUser) {
          console.error('❌ Not logged in - redirecting to login');
          navigate(createPageUrl('Login'));
          return;
        }
        
        const me = await User.me();
        console.log('👤 Current user:', me);
        setCurrentUser(me);
        if (me.role !== "admin") {
          const home = me.user_type === "coach" ? "CoachDashboard" : "FindCoaches";
          navigate(createPageUrl(home));
          return;
        }

          console.log('📊 Fetching user stats...');
          const userStats = await apiClient.getUsers({ stats: '1' });

          console.log('📅 Fetching booking stats...');
          const bookingStats = await apiClient.getBookingStats();

          const totalBookings = bookingStats?.total || 0;
          const pending = bookingStats?.pending || 0;
          const confirmed = bookingStats?.confirmed || 0;
          const cancelled = bookingStats?.cancelled || 0;
          const completed = bookingStats?.completed || 0;

          const totalAccounts = userStats?.total_accounts || 0;
          const totalUsers = userStats?.total_users || 0;
          const totalCoaches = userStats?.total_coaches || 0;
          const totalClients = userStats?.total_clients || 0;
          const admins = userStats?.admins || 0;

          console.log('📅 Fetching recent bookings...');
          const recent = await Booking.list('-created_at', 8);
        const ids = Array.from(new Set(recent.flatMap(b => [b.client_id, b.coach_id]).filter(Boolean)));
        const users = ids.length ? await User.filter({ id: { in: ids } }) : [];
        const umap = users.reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
        
  setStats({ totalUsers, totalAccounts, admins, totalCoaches, totalClients, totalBookings, pending, confirmed, cancelled, completed });
        setRecentBookings(recent);
  setUserMap(umap);

  // Load pending account deletion requests
  const pendingReqs = await User.listDeletionRequests({ status: 'pending' });
  setDeletionRequests(pendingReqs || []);
      } catch (error) {
        console.error('❌ Error loading admin dashboard data:', error);
        console.error('Error details:', {
          message: error.message,
          status: error.status,
          details: error.details
        });
        // If unauthorized, redirect to login
        if (error.status === 401 || error.message?.includes('Not authenticated')) {
          navigate(createPageUrl('Login'));
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

  const openDecision = (req) => {
    setSelectedRequest(req);
    setDecisionReason("");
    setDecisionOpen(true);
  };

  const decideRequest = async (decision) => {
    if (!selectedRequest) return;
    try {
      await User.decideDeletionRequest(selectedRequest.id, decision, decisionReason, currentUser?.id);
      setDeletionRequests(prev => prev.filter(r => r.id !== selectedRequest.id));
      setDecisionOpen(false);
      setDecisionReason("");
    } catch (e) {
      alert(e.message || 'Failed to process request');
    }
  };

  if (loading) return <div className="p-8">Loading admin dashboard...</div>;
  if (!currentUser || currentUser.role !== "admin") return null;

  const StatCard = ({ icon: Icon, label, value, color = "text-slate-700", onClick }) => (
    <button onClick={onClick} className="text-left">
      <Card className="border-0 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">{label}</p>
              <p className="text-3xl font-bold mt-1">{value}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center">
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );

  const statusBadge = (status) => {
    const map = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      completed: "bg-blue-100 text-blue-800"
    };
    return map[status] || "bg-slate-100 text-slate-800";
  };

  const formatService = (s) => s?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());


  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Admin Dashboard</h1>
          <p className="text-slate-600">Overview of users, bookings, and platform activity.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Accounts" value={stats.totalAccounts || stats.totalUsers} color="text-slate-700" onClick={() => navigate(createPageUrl("AdminUsers?type=all"))} />
          <StatCard icon={Star} label="Coaches" value={stats.totalCoaches} color="text-amber-600" onClick={() => navigate(createPageUrl("AdminUsers?type=coach"))} />
          <StatCard icon={Users} label="Clients" value={stats.totalClients} color="text-blue-600" onClick={() => navigate(createPageUrl("AdminUsers?type=client"))} />
          <StatCard icon={Calendar} label="Total Bookings" value={stats.totalBookings} color="text-green-600" onClick={() => navigate(createPageUrl("AdminBookings?status=all"))} />
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <StatCard icon={AlertTriangle} label="Pending" value={stats.pending} color="text-yellow-600" onClick={() => navigate(createPageUrl("AdminBookings?status=pending"))} />
          <StatCard icon={Calendar} label="Confirmed" value={stats.confirmed} color="text-green-600" onClick={() => navigate(createPageUrl("AdminBookings?status=confirmed"))} />
          <StatCard icon={Calendar} label="Completed" value={stats.completed} color="text-blue-600" onClick={() => navigate(createPageUrl("AdminBookings?status=completed"))} />
          <StatCard icon={Calendar} label="Cancelled" value={stats.cancelled} color="text-red-600" onClick={() => navigate(createPageUrl("AdminBookings?status=cancelled"))} />
        </div>

          {/* Account Deletion Requests */}
          {deletionRequests.length > 0 && (
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Account Deletion Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {deletionRequests.map((r) => (
                  <div key={r.id} className="flex flex-col md:flex-row md:items-center md:justify-between p-3 rounded-lg border border-slate-200">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">User ID: {r.user_id}</p>
                      <p className="text-sm text-slate-600">Reason: {r.reason || '—'}</p>
                      <p className="text-xs text-slate-500 mt-1">Requested {formatSafeDate(r.requested_at, 'Pp')}</p>
                    </div>
                    <div className="mt-2 md:mt-0 flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => openDecision(r)}>Decide</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Recent Bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentBookings.length === 0 ? (
              <p className="text-slate-600">No bookings yet.</p>
            ) : (
              <div className="space-y-3">
                {recentBookings.map((b) => {
                  const client = userMap[b.client_id];
                  const coach = userMap[b.coach_id];
                  return (
                    <div key={b.id} className="flex flex-col md:flex-row md:items-center md:justify-between p-3 rounded-lg border border-slate-200">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{formatService(b.service_type)} Session</p>
                        <p className="text-sm text-slate-600">
                          {client?.full_name || "Client"} → {coach?.full_name || "Coach"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatSafeDate(b.session_date)} • {b.session_time} • £{b.total_price || b.price}
                        </p>
                      </div>
                      <div className="mt-2 md:mt-0 flex items-center gap-2">
                        <Badge className={statusBadge(b.status)}>{b.status}</Badge>
                        <Button variant="outline" size="sm" onClick={() => navigate(createPageUrl(`Conversation?booking_id=${b.id}`))}>
                          <MessageCircle className="w-4 h-4 mr-2" /> View Chat
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decide deletion request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Provide an optional reason. Approving will deactivate the user&apos;s account.</p>
            <Textarea value={decisionReason} onChange={(e)=>setDecisionReason(e.target.value)} placeholder="Decision reason (optional)" />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={()=>setDecisionOpen(false)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={()=>decideRequest('approved')}>Approve</Button>
              <Button variant="secondary" onClick={()=>decideRequest('rejected')}>Reject</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
