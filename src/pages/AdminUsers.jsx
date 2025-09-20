
import React, { useEffect, useMemo, useState } from "react";
import { User } from "@/api/entities.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  const formatService = (s) => s?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());

  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get("type") || "all";

  useEffect(() => {
    const load = async () => {
      const me = await User.me();
      setCurrentUser(me);
      if (me.role !== "admin") return;
      const all = await User.list();
      setUsers(all);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return users
      .filter(u => {
        if (typeParam === "all") return true;
        if (typeParam === "client") return u.user_type === "client" && u.role !== "admin";
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
                  <Card className="border border-slate-200">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                          <span className="font-semibold text-slate-600">{u.full_name?.charAt(0) || "U"}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 truncate">{u.full_name || "Unnamed"}</p>
                          {/* Hide email (PII) for GDPR */}
                          <p className="text-xs text-slate-500">Email hidden</p>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className="capitalize">{u.user_type || "member"}</Badge>
                            <Badge className={u.role === "admin" ? "bg-yellow-100 text-yellow-800" : "bg-slate-100 text-slate-700"}>{u.role || "user"}</Badge>
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
                  </Card>
                </motion.div>
              ))}
            </div>
            {filtered.length === 0 && <p className="text-slate-500 mt-4">No users found.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
