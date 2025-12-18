
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Calendar, MessageCircle, Star, AlertTriangle, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { format, isValid } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const safeParseDate =(dateValue)=>{
  if (!dateValue) return null;
  const d = new Date(dateValue);
  return isValid(d) ? d : null;
};

const formatSafeDate =(dateValue, formatStr = "PPP")=>{
  const d = safeParseDate(dateValue);
  return d ? format(d, formatStr) : "Date TBD";
};

const apiJson = async(path, options = {})=>{
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(()=> null);

  if (!res.ok) {
    const msg = data?.error || data?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
};

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

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

  // delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const statusBadge =(status)=>{
    const map = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      completed: "bg-blue-100 text-blue-800"
    };
    return map[status] || "bg-slate-100 text-slate-800";
  };

  const formatService =(s)=> s?.replace(/_/g, " ").replace(/\b\w/g, (l)=> l.toUpperCase());

  const StatCard = ({ icon: Icon, label, value, color = "text-slate-700", onClick })=>(
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

  const computedCounts = useMemo(()=>{
    const totalBookings = recentBookings?.__allCount ?? stats.totalBookings; // fallback
    return { totalBookings };
  }, [recentBookings, stats.totalBookings]);

  useEffect(()=>{
    const load = async()=>{
      setLoading(true);
      setErrorMsg("");

      try {
        // 1) Who am I? (Netlify function)
        const me = await apiJson("/api/me");
        setCurrentUser(me);

        if (me?.role !== "admin") {
          const home = me?.user_type === "coach" ? "CoachDashboard" : "FindCoaches";
          navigate(createPageUrl(home));
          return;
        }

        // 2) Users (profiles) + Bookings from Netlify functions
        const allUsers = await apiJson("/api/users?type=all");
        const allBookings = await apiJson("/api/bookings");

        // users breakdown
        const admins = allUsers.filter((u)=> u.role === "admin").length;
        const totalCoaches = allUsers.filter((u)=> u.user_type === "coach" && u.role !== "admin").length;
        const totalClients = allUsers.filter((u)=> (u.user_type === "client" || u.user_type === "user") && u.role !== "admin").length;
        const totalUsers = totalCoaches + totalClients;
        const totalAccounts = allUsers.length;

        // booking breakdown
        const totalBookings = allBookings.length;
        const pending = allBookings.filter((b)=> b.status === "pending").length;
        const confirmed = allBookings.filter((b)=> b.status === "confirmed").length;
        const cancelled = allBookings.filter((b)=> b.status === "cancelled").length;
        const completed = allBookings.filter((b)=> b.status === "completed").length;

        // recent
        const recent = allBookings.slice(0, 8);

        setStats({
          totalUsers,
          totalAccounts,
          admins,
          totalCoaches,
          totalClients,
          totalBookings,
          pending,
          confirmed,
          cancelled,
          completed
        });

        // stash all count on the array (non-reactive helper, harmless)
        recent.__allCount = totalBookings;
        setRecentBookings(recent);

      } catch (e) {
        console.error("Admin dashboard load failed:", e);
        setErrorMsg(e?.message || "Failed to load admin dashboard data");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate]);

  const openDelete =(booking)=>{
    setDeleteTarget(booking);
    setDeleteOpen(true);
  };

  const confirmDelete = async()=>{
    if (!deleteTarget?.id) return;

    setDeleting(true);
    try {
      await apiJson(`/api/bookings/${deleteTarget.id}`, { method: "DELETE" });

      // refresh the list quickly without full reload
      setRecentBookings((prev)=> prev.filter((b)=> b.id !== deleteTarget.id));
      setStats((prev)=> ({
        ...prev,
        totalBookings: Math.max(0, prev.totalBookings - 1),
        pending: deleteTarget.status === "pending" ? Math.max(0, prev.pending - 1) : prev.pending,
        confirmed: deleteTarget.status === "confirmed" ? Math.max(0, prev.confirmed - 1) : prev.confirmed,
        cancelled: deleteTarget.status === "cancelled" ? Math.max(0, prev.cancelled - 1) : prev.cancelled,
        completed: deleteTarget.status === "completed" ? Math.max(0, prev.completed - 1) : prev.completed
      }));

      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (e) {
      alert(e?.message || "Failed to delete booking");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="p-8">Loading admin dashboard...</div>;
  if (!currentUser || currentUser.role !== "admin") return null;

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Admin Dashboard</h1>
          <p className="text-slate-600">Overview of users, bookings, and platform activity.</p>

          {errorMsg && (
            <div className="mt-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm">
              {errorMsg}
            </div>
          )}
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Accounts" value={stats.totalAccounts} color="text-slate-700" onClick={()=>navigate(createPageUrl("AdminUsers?type=all"))} />
          <StatCard icon={Star} label="Coaches" value={stats.totalCoaches} color="text-amber-600" onClick={()=>navigate(createPageUrl("AdminUsers?type=coach"))} />
          <StatCard icon={Users} label="Clients" value={stats.totalClients} color="text-blue-600" onClick={()=>navigate(createPageUrl("AdminUsers?type=client"))} />
          <StatCard icon={Calendar} label="Total Bookings" value={stats.totalBookings} color="text-green-600" onClick={()=>navigate(createPageUrl("AdminBookings?status=all"))} />
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <StatCard icon={AlertTriangle} label="Pending" value={stats.pending} color="text-yellow-600" onClick={()=>navigate(createPageUrl("AdminBookings?status=pending"))} />
          <StatCard icon={Calendar} label="Confirmed" value={stats.confirmed} color="text-green-600" onClick={()=>navigate(createPageUrl("AdminBookings?status=confirmed"))} />
          <StatCard icon={Calendar} label="Completed" value={stats.completed} color="text-blue-600" onClick={()=>navigate(createPageUrl("AdminBookings?status=completed"))} />
          <StatCard icon={Calendar} label="Cancelled" value={stats.cancelled} color="text-red-600" onClick={()=>navigate(createPageUrl("AdminBookings?status=cancelled"))} />
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
                {recentBookings.map((b)=>(
                  <div key={b.id} className="flex flex-col md:flex-row md:items-center md:justify-between p-3 rounded-lg border border-slate-200">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{formatService(b.service_type)} Session</p>
                      <p className="text-sm text-slate-600">
                        {(b.client_name || "Client")} → {(b.coach_name || "Coach")}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatSafeDate(b.session_date || b.booking_date)} • {b.session_time || "—"} • £{b.total_price || b.price || 0}
                      </p>
                    </div>
                    <div className="mt-2 md:mt-0 flex items-center gap-2">
                      <Badge className={statusBadge(b.status)}>{b.status}</Badge>

                      <Button variant="outline" size="sm" onClick={()=>navigate(createPageUrl(`Conversation?booking_id=${b.id}`))}>
                        <MessageCircle className="w-4 h-4 mr-2" /> View Chat
                      </Button>

                      <Button variant="outline" size="sm" className="text-red-600" onClick={()=>openDelete(b)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              This will permanently delete the booking record. If you’d rather “archive” it (recommended),
              we can add an archive flag next.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={()=>setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Removing..." : "Remove"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}