import React, { useEffect, useMemo, useState } from "react";
import { Booking } from "@/api/entities.jsx";
import { User } from "@/api/entities.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

export default function AdminBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const statusParam = (urlParams.get("status") || "all").toLowerCase();

  useEffect(() => {
    const load = async () => {
      try {
        const me = await User.me();
        setCurrentUser(me);
        if (me.role !== "admin") return;

        const all = await Booking.list('-created_at', 1000);
        const ids = Array.from(new Set(all.flatMap(b => [b.client_id, b.coach_id]).filter(Boolean)));
        const users = ids.length ? await User.filter({ id: { in: ids }}) : [];
        const map = users.reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
        setUserMap(map);
        setBookings(all);
      } catch (error) {
        console.error("Error loading bookings:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return bookings.filter(b => statusParam === "all" ? true : b.status === statusParam);
  }, [bookings, statusParam]);

  const statusBadge = (status) => {
    const map = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      completed: "bg-blue-100 text-blue-800"
    };
    return map[status] || "bg-slate-100 text-slate-800";
  };

  if (loading) return <div className="p-8">Loading bookings...</div>;
  if (!currentUser || currentUser.role !== "admin") return null;

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Bookings ({statusParam === "all" ? "All" : statusParam})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {filtered.length === 0 ? (
              <p className="text-slate-600">No bookings found.</p>
            ) : (
              filtered.map((b) => {
                const client = userMap[b.client_id];
                const coach = userMap[b.coach_id];
                return (
                  <div key={b.id} className="flex flex-col md:flex-row md:items-center md:justify-between p-3 rounded-lg border border-slate-200">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{b.service_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                      <p className="text-sm text-slate-600">{client?.full_name || "Client"} → {coach?.full_name || "Coach"}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {format(new Date(b.session_date), "PPP")} • {b.session_time} • £{b.total_price || b.price}
                      </p>
                    </div>
                    <div className="mt-2 md:mt-0 flex items-center gap-2">
                      <Badge className={statusBadge(b.status)}>{b.status}</Badge>
                      <Button variant="outline" size="sm" onClick={() => navigate(createPageUrl(`Conversation?booking_id=${b.id}`))}>
                        <MessageCircle className="w-4 h-4 mr-2" /> Open Chat
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}