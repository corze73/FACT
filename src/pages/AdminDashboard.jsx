
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities.jsx";
import { Booking } from "@/api/entities.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Calendar, MessageCircle, Star, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { format, isValid } from "date-fns";

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
    totalUsers: 0,
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

  useEffect(() => {
    const load = async () => {
      try {
        const me = await User.me();
        setCurrentUser(me);
        if (me.role !== "admin") {
          const home = me.user_type === "coach" ? "CoachDashboard" : "FindCoaches";
          navigate(createPageUrl(home));
          return;
        }

        const allUsers = await User.list();

        // Exclude admins from member totals
        const totalCoaches = allUsers.filter(u => u.user_type === "coach" && u.role !== "admin").length;
        const totalClients = allUsers.filter(u => (u.user_type === "client" || u.user_type === "user") && u.role !== "admin").length;
        const totalUsers = totalCoaches + totalClients;

        const allBookings = await Booking.list('-created_at', 1000);
        
        const totalBookings = allBookings.length;
        const pending = allBookings.filter(b => b.status === "pending").length;
        const confirmed = allBookings.filter(b => b.status === "confirmed").length;
        const cancelled = allBookings.filter(b => b.status === "cancelled").length;
        const completed = allBookings.filter(b => b.status === "completed").length;
        
        const recent = allBookings.slice(0, 8);
        const ids = Array.from(new Set(recent.flatMap(b => [b.client_id, b.coach_id]).filter(Boolean)));
        const users = ids.length ? await User.filter({ id: { in: ids } }) : [];
        const umap = users.reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
        
        setStats({ totalUsers, totalCoaches, totalClients, totalBookings, pending, confirmed, cancelled, completed });
        setRecentBookings(recent);
        setUserMap(umap);
      } catch (error) {
        console.error('Error loading admin dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

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
          <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="text-slate-700" onClick={() => navigate(createPageUrl("AdminUsers?type=all"))} />
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
    </div>
  );
}
