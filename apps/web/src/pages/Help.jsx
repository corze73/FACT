import { useEffect, useMemo, useRef, useState } from "react";
import { User } from "@/api/entities.jsx";
import apiClient from "@/api/apiClient.js";
import { createPageUrl, normalizeUserType } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, Mail, MessageCircle, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import faqData from "@/data/helpFaq.json";
import { alertToast } from "@/utils/notifications";

/**
 * Normalise a row from the help-content API (DB format) or the static JSON
 * into a unified shape used throughout this component.
 */
const normalizeFaqRow = (row) => {
  const isDbRow = row.slug !== undefined;
  return {
    id: isDbRow ? row.slug : row.id,
    uuid: isDbRow ? row.id : null,
    role: row.role,
    category: row.category,
    q: row.question || row.q,
    a: row.answer || row.a,
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    position: row.position || 0,
    is_active: row.is_active !== false
  };
};

const HELP_ANALYTICS_KEY = "help_analytics_v1";

const categoryLabels = {
  all: "All",
  onboarding: "Getting Started",
  verification: "Verification",
  bookings: "Bookings",
  messaging: "Messaging",
  payments: "Payments",
  support: "Support",
  security: "Security"
};

export default function Help() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userType, setUserType] = useState("client");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [openFaqIds, setOpenFaqIds] = useState([]);
  const [helpMetrics, setHelpMetrics] = useState({ faqViews: {}, searches: {}, categories: {} });
  const lastTrackedRef = useRef("");
  const lastOpenedRef = useRef([]);

  // FAQ data: starts with bundled JSON, replaced by API data when available
  const [faqEntries, setFaqEntries] = useState(() => faqData.map(normalizeFaqRow));
  // Admin: all FAQ rows including inactive (for the editor)
  const [allFaqs, setAllFaqs] = useState([]);
  // Admin: global analytics from the backend
  const [globalInsights, setGlobalInsights] = useState(null);

  // Admin FAQ editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null); // normalized row being edited (null = create)
  const [editForm, setEditForm] = useState({});
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState("");
  const importInputRef = useRef(null);

  const roleLabel = userType === "coach" ? "coach" : userType === "admin" ? "admin" : "client";

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    if (roleLabel === "admin") {
      navigate(createPageUrl("AdminDashboard"));
      return;
    }

    if (roleLabel === "coach") {
      navigate(createPageUrl("CoachDashboard"));
      return;
    }

    navigate(createPageUrl("Landing"));
  };

  const trackHelpEvent = (eventName, params = {}) => {
    try {
      if (typeof window !== "undefined" && typeof window.gtag === "function") {
        window.gtag("event", eventName, { help_role: roleLabel, ...params });
      }
    } catch {
      // Ignore analytics failures
    }
    // Also POST to the backend for global analytics
    const eventTypeMap = {
      help_search: "search",
      help_faq_open: "faq_view",
      help_category_select: "category_select",
      help_no_results: "no_results"
    };
    const apiEventType = eventTypeMap[eventName];
    if (apiEventType) {
      apiClient.recordHelpEvent({
        event_type: apiEventType,
        role: roleLabel,
        faq_id: params.faq_id || "",
        search_term: params.query || "",
        category: params.category || ""
      });
    }
  };

  const readMetrics = () => {
    try {
      const raw = localStorage.getItem(HELP_ANALYTICS_KEY);
      if (!raw) return { faqViews: {}, searches: {}, categories: {} };
      const parsed = JSON.parse(raw);
      return {
        faqViews: parsed?.faqViews || {},
        searches: parsed?.searches || {},
        categories: parsed?.categories || {}
      };
    } catch {
      return { faqViews: {}, searches: {}, categories: {} };
    }
  };

  const writeMetrics = (nextMetrics) => {
    try {
      localStorage.setItem(
        HELP_ANALYTICS_KEY,
        JSON.stringify({ ...nextMetrics, updatedAt: new Date().toISOString() })
      );
    } catch {
      // Ignore localStorage write failures
    }
  };

  const incrementMetric = (kind, key) => {
    if (!key) return;
    setHelpMetrics((prev) => {
      const updated = {
        ...prev,
        [kind]: {
          ...(prev[kind] || {}),
          [key]: ((prev[kind] || {})[key] || 0) + 1
        }
      };
      writeMetrics(updated);
      return updated;
    });
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const me = await User.me();
        if (isMounted) {
          const role = me?.role === "admin" || me?.user_type === "admin"
            ? "admin"
            : (normalizeUserType(me?.user_type) || "client");
          setUserType(role);
          setHelpMetrics(readMetrics());

          // Load FAQ entries from API (fallback to bundled JSON stays in place)
          try {
            const data = await apiClient.getFaqEntries();
            if (isMounted && Array.isArray(data?.faqs)) {
              setFaqEntries(data.faqs.map(normalizeFaqRow));
            }
          } catch {
            // Stay on JSON fallback
          }

          // Admin-only: global insights + all FAQs (including inactive) for the editor
          if (role === "admin") {
            try {
              const insights = await apiClient.getHelpInsights();
              if (isMounted) setGlobalInsights(insights);
            } catch {
              // Will fall back to localStorage display
            }
            try {
              const allData = await apiClient.getFaqEntries({ include_inactive: 1 });
              if (isMounted && Array.isArray(allData?.faqs)) {
                setAllFaqs(allData.faqs.map(normalizeFaqRow));
              }
            } catch {
              // Editor won't populate, but the page still works
            }
          }
        }
      } catch {
        if (isMounted) {
          setUserType("client");
          setHelpMetrics(readMetrics());
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const roleScopedFaq = useMemo(() => {
    return faqEntries.filter((item) => item.role === "both" || item.role === roleLabel);
  }, [faqEntries, roleLabel]);

  const categories = useMemo(() => {
    const unique = ["all", ...new Set(roleScopedFaq.map((item) => item.category))];
    return unique;
  }, [roleScopedFaq]);

  useEffect(() => {
    const requestedCategory = searchParams.get("category");
    if (!requestedCategory) return;
    if (categories.includes(requestedCategory) && activeCategory !== requestedCategory) {
      setActiveCategory(requestedCategory);
      return;
    }
    if (!categories.includes(requestedCategory)) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("category");
        return next;
      }, { replace: true });
    }
  }, [activeCategory, categories, searchParams, setSearchParams]);

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (activeCategory === "all") {
        next.delete("category");
      } else {
        next.set("category", activeCategory);
      }
      return next;
    }, { replace: true });
  }, [activeCategory, setSearchParams]);

  const filteredFaq = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return roleScopedFaq.filter((item) => {
      const categoryMatch = activeCategory === "all" || item.category === activeCategory;
      if (!categoryMatch) return false;
      if (!term) return true;

      const haystack = [item.q, item.a, ...(item.keywords || [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [roleScopedFaq, activeCategory, searchTerm]);

  useEffect(() => {
    const key = `${roleLabel}|${activeCategory}|${searchTerm.trim().toLowerCase()}|${filteredFaq.length}`;
    if (lastTrackedRef.current === key) return;
    lastTrackedRef.current = key;

    if (searchTerm.trim()) {
      trackHelpEvent("help_search", {
        query: searchTerm.trim().slice(0, 80),
        category: activeCategory,
        results: filteredFaq.length
      });
    }

    if (searchTerm.trim() && filteredFaq.length === 0) {
      trackHelpEvent("help_no_results", {
        query: searchTerm.trim().slice(0, 80),
        category: activeCategory
      });
    }
  }, [activeCategory, filteredFaq.length, roleLabel, searchTerm]);

  useEffect(() => {
    const newlyOpened = openFaqIds.filter((id) => !lastOpenedRef.current.includes(id));
    if (newlyOpened.length > 0) {
      newlyOpened.forEach((faqId) => {
        incrementMetric("faqViews", faqId);
        trackHelpEvent("help_faq_open", { faq_id: faqId });
      });
    }
    lastOpenedRef.current = openFaqIds;
  }, [openFaqIds]);

  const topSearched = useMemo(() => {
    return Object.entries(helpMetrics.searches || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [helpMetrics.searches]);

  const topViewedFaq = useMemo(() => {
    return Object.entries(helpMetrics.faqViews || {})
      .map(([id, count]) => {
        const item = faqEntries.find((faq) => faq.id === id) || faqData.find((faq) => faq.id === id);
        return item ? { id, q: item.q, count } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [helpMetrics.faqViews, faqEntries]);

  const topCategories = useMemo(() => {
    return Object.entries(helpMetrics.categories || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [helpMetrics.categories]);

  // ── Admin FAQ editor helpers ──────────────────────────────────

  const openCreateEditor = () => {
    setEditingFaq(null);
    setEditForm({ slug: "", role: "both", category: "onboarding", question: "", answer: "", keywords: "", position: 0 });
    setEditorError("");
    setEditorOpen(true);
  };

  const openEditEditor = (faq) => {
    setEditingFaq(faq);
    setEditForm({
      slug: faq.id,
      role: faq.role,
      category: faq.category,
      question: faq.q,
      answer: faq.a,
      keywords: (faq.keywords || []).join(", "),
      position: faq.position || 0,
      is_active: faq.is_active !== false
    });
    setEditorError("");
    setEditorOpen(true);
  };

  const handleSaveFaq = async () => {
    const { slug, role, category, question, answer, keywords, position, is_active } = editForm;
    if (!slug?.trim() || !question?.trim() || !answer?.trim()) {
      setEditorError("Slug, question, and answer are required.");
      return;
    }
    setEditorSaving(true);
    setEditorError("");
    try {
      const payload = {
        slug: slug.trim(),
        role,
        category: category.trim(),
        question: question.trim(),
        answer: answer.trim(),
        keywords: keywords ? keywords.split(",").map((k) => k.trim()).filter(Boolean) : [],
        position: Number(position) || 0
      };
      if (editingFaq?.uuid) {
        await apiClient.updateFaqEntry(editingFaq.uuid, { ...payload, is_active: Boolean(is_active) });
      } else {
        await apiClient.createFaqEntry(payload);
      }
      const [active, all] = await Promise.all([
        apiClient.getFaqEntries(),
        apiClient.getFaqEntries({ include_inactive: 1 })
      ]);
      if (active?.faqs) setFaqEntries(active.faqs.map(normalizeFaqRow));
      if (all?.faqs) setAllFaqs(all.faqs.map(normalizeFaqRow));
      setEditorOpen(false);
    } catch (err) {
      setEditorError(err?.message || "Save failed. Please try again.");
    } finally {
      setEditorSaving(false);
    }
  };

  const handleDeleteFaq = async (faq) => {
    if (!faq.uuid) return;
    if (!window.confirm(`Delete FAQ: "${faq.q}"?\n\nThis will hide it from all users.`)) return;
    try {
      await apiClient.deleteFaqEntry(faq.uuid);
      const [active, all] = await Promise.all([
        apiClient.getFaqEntries(),
        apiClient.getFaqEntries({ include_inactive: 1 })
      ]);
      if (active?.faqs) setFaqEntries(active.faqs.map(normalizeFaqRow));
      if (all?.faqs) setAllFaqs(all.faqs.map(normalizeFaqRow));
    } catch (err) {
      alertToast(`Delete failed: ${err?.message || "Unknown error"}`);
    }
  };

  const handleExportFaq = () => {
    const exportable = (allFaqs.length ? allFaqs : faqEntries)
      .filter((f) => f.is_active)
      .map(({ id, role, category, q, a, keywords }) => ({ id, role, category, q, a, keywords }));
    const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `helpFaq-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFaq = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const text = await file.text();
      const entries = JSON.parse(text);
      if (!Array.isArray(entries)) throw new Error("JSON must be an array of FAQ entries.");
      for (const entry of entries) {
        if (!entry.id || !entry.role || !entry.category || !entry.q || !entry.a) {
          throw new Error(`Entry missing required fields: ${JSON.stringify(entry).slice(0, 80)}`);
        }
      }
      if (!window.confirm(`Import ${entries.length} entries? Entries with matching slugs will be skipped.`)) return;
      let imported = 0;
      let skipped = 0;
      for (const entry of entries) {
        try {
          await apiClient.createFaqEntry({
            slug: entry.id,
            role: entry.role,
            category: entry.category,
            question: entry.q,
            answer: entry.a,
            keywords: entry.keywords || [],
            position: entry.position || 0
          });
          imported++;
        } catch {
          skipped++;
        }
      }
      const [active, all] = await Promise.all([
        apiClient.getFaqEntries(),
        apiClient.getFaqEntries({ include_inactive: 1 })
      ]);
      if (active?.faqs) setFaqEntries(active.faqs.map(normalizeFaqRow));
      if (all?.faqs) setAllFaqs(all.faqs.map(normalizeFaqRow));
      alertToast(`Import complete: ${imported} added, ${skipped} skipped (already exist).`);
    } catch (err) {
      alertToast(`Import failed: ${err?.message || "Unknown error"}`);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Button variant="outline" onClick={handleBack} className="w-fit gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Help & FAQs</h1>
          <p className="text-slate-600">
            Find answers fast with role-specific guidance for {roleLabel === "coach" ? "coaches" : roleLabel === "admin" ? "admins" : "clients"}.
          </p>
        </motion.div>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Search Help</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search topics, e.g. verification, messages, bookings..."
                value={searchTerm}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchTerm(value);
                  const trimmed = value.trim().toLowerCase();
                  if (trimmed) {
                    incrementMetric("searches", trimmed);
                  }
                }}
                className="pl-9"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {categories.map((category) => (
                <Button
                  key={category}
                  type="button"
                  size="sm"
                  variant={activeCategory === category ? "default" : "outline"}
                  onClick={() => {
                    setActiveCategory(category);
                    trackHelpEvent("help_category_select", { category });
                    incrementMetric("categories", category);
                  }}
                >
                  {categoryLabels[category] || category}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {roleLabel === "admin" && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>
                Help Insights
                <span className="ml-2 text-sm font-normal text-slate-500">
                  {globalInsights
                    ? `Last ${globalInsights.days} days — all users`
                    : "This browser only"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-6 text-sm">
              <div>
                <p className="font-semibold text-slate-900 mb-2">Top Searches</p>
                {(() => {
                  const rows = globalInsights
                    ? globalInsights.topSearches.map((r) => [r.search_term, r.count])
                    : topSearched;
                  return rows.length === 0 ? (
                    <p className="text-slate-500">No search data yet.</p>
                  ) : (
                    <ul className="space-y-1 text-slate-700">
                      {rows.map(([term, count]) => (
                        <li key={term}>{term} <span className="text-slate-400">({count})</span></li>
                      ))}
                    </ul>
                  );
                })()}
              </div>

              <div>
                <p className="font-semibold text-slate-900 mb-2">Most Viewed FAQs</p>
                {(() => {
                  const rows = globalInsights
                    ? globalInsights.topFaqs.map((r) => {
                        const item = faqEntries.find((f) => f.id === r.faq_id);
                        return { id: r.faq_id, q: item?.q || r.faq_id, count: r.count };
                      })
                    : topViewedFaq;
                  return rows.length === 0 ? (
                    <p className="text-slate-500">No FAQ views yet.</p>
                  ) : (
                    <ul className="space-y-1 text-slate-700">
                      {rows.map((item) => (
                        <li key={item.id}>{item.q} <span className="text-slate-400">({item.count})</span></li>
                      ))}
                    </ul>
                  );
                })()}
              </div>

              <div>
                <p className="font-semibold text-slate-900 mb-2">Top Categories</p>
                {(() => {
                  const rows = globalInsights
                    ? globalInsights.topCategories.map((r) => [r.category, r.count])
                    : topCategories;
                  return rows.length === 0 ? (
                    <p className="text-slate-500">No category data yet.</p>
                  ) : (
                    <ul className="space-y-1 text-slate-700">
                      {rows.map(([cat, count]) => (
                        <li key={cat}>{categoryLabels[cat] || cat} <span className="text-slate-400">({count})</span></li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin FAQ Editor */}
        {roleLabel === "admin" && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle>Manage FAQs</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="gap-1" onClick={handleExportFaq}>
                    <Download className="w-3.5 h-3.5" />
                    Export JSON
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => importInputRef.current?.click()}>
                    <Upload className="w-3.5 h-3.5" />
                    Import JSON
                  </Button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={handleImportFaq}
                  />
                  <Button size="sm" className="gap-1" onClick={openCreateEditor}>
                    <Plus className="w-3.5 h-3.5" />
                    Add New FAQ
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {allFaqs.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No FAQ entries loaded. Add entries above or run the migration to seed defaults.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="pb-2 pr-4 font-medium">Question</th>
                        <th className="pb-2 pr-4 font-medium">Role</th>
                        <th className="pb-2 pr-4 font-medium">Category</th>
                        <th className="pb-2 pr-4 font-medium">Active</th>
                        <th className="pb-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allFaqs.map((faq) => (
                        <tr key={faq.id} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="py-2 pr-4 max-w-xs">
                            <span className="line-clamp-2">{faq.q}</span>
                          </td>
                          <td className="py-2 pr-4">
                            <Badge variant="outline" className="text-xs capitalize">{faq.role}</Badge>
                          </td>
                          <td className="py-2 pr-4 text-slate-600 capitalize">{faq.category}</td>
                          <td className="py-2 pr-4">
                            {faq.is_active
                              ? <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Active</Badge>
                              : <Badge variant="outline" className="text-xs text-slate-400">Hidden</Badge>}
                          </td>
                          <td className="py-2">
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditEditor(faq)} title="Edit">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              {faq.is_active && (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDeleteFaq(faq)} title="Delete">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* FAQ Editor Dialog */}
        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingFaq ? "Edit FAQ Entry" : "Add New FAQ Entry"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="faq-slug">Slug (unique ID, lowercase-hyphenated)</Label>
                <Input
                  id="faq-slug"
                  value={editForm.slug || ""}
                  disabled={Boolean(editingFaq)}
                  onChange={(e) => setEditForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                  placeholder="coach-verification-flow"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="faq-role">Role</Label>
                  <Select value={editForm.role || "both"} onValueChange={(v) => setEditForm((p) => ({ ...p, role: v }))}>
                    <SelectTrigger id="faq-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coach">Coach</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="faq-category">Category</Label>
                  <Select value={editForm.category || "onboarding"} onValueChange={(v) => setEditForm((p) => ({ ...p, category: v }))}>
                    <SelectTrigger id="faq-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryLabels).filter(([k]) => k !== "all").map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="faq-question">Question</Label>
                <Input
                  id="faq-question"
                  value={editForm.question || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, question: e.target.value }))}
                  placeholder="How does coach verification work?"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="faq-answer">Answer</Label>
                <Textarea
                  id="faq-answer"
                  rows={4}
                  value={editForm.answer || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, answer: e.target.value }))}
                  placeholder="Explain the answer clearly..."
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="faq-keywords">Keywords <span className="text-slate-400 font-normal">(comma-separated)</span></Label>
                <Input
                  id="faq-keywords"
                  value={editForm.keywords || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, keywords: e.target.value }))}
                  placeholder="verification, approval, documents"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="faq-position">Position (sort order)</Label>
                  <Input
                    id="faq-position"
                    type="number"
                    value={editForm.position ?? 0}
                    onChange={(e) => setEditForm((p) => ({ ...p, position: Number(e.target.value) }))}
                  />
                </div>
                {editingFaq && (
                  <div className="space-y-1">
                    <Label htmlFor="faq-active">Visibility</Label>
                    <Select
                      value={editForm.is_active ? "active" : "hidden"}
                      onValueChange={(v) => setEditForm((p) => ({ ...p, is_active: v === "active" }))}
                    >
                      <SelectTrigger id="faq-active"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active (visible)</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {editorError && <p className="text-sm text-red-600">{editorError}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={editorSaving}>Cancel</Button>
              <Button onClick={handleSaveFaq} disabled={editorSaving}>
                {editorSaving ? "Saving…" : editingFaq ? "Save Changes" : "Create FAQ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>{roleLabel === "coach" ? "Coach FAQs" : roleLabel === "admin" ? "Admin FAQs" : "Client FAQs"}</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredFaq.length === 0 ? (
              <p className="text-sm text-slate-600">
                No FAQ entries matched your search. Try a broader term or switch category.
              </p>
            ) : (
              <Accordion type="multiple" className="w-full" value={openFaqIds} onValueChange={setOpenFaqIds}>
                {filteredFaq.map((item) => (
                  <AccordionItem key={item.id} value={item.id}>
                    <AccordionTrigger>{item.q}</AccordionTrigger>
                    <AccordionContent>{item.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-slate-50/80">
          <CardHeader>
            <CardTitle>Still Need Help?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="gap-2">
              <Link to={createPageUrl("Messages")}>
                <MessageCircle className="w-4 h-4" />
                Open Messages
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <a href="mailto:support@findacoachtoday.com">
                <Mail className="w-4 h-4" />
                Email Support
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
