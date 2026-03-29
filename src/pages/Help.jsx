import { useEffect, useMemo, useRef, useState } from "react";
import { User } from "@/api/entities.jsx";
import { createPageUrl, normalizeUserType } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import { Mail, MessageCircle, Search } from "lucide-react";
import faqData from "@/data/helpFaq.json";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [userType, setUserType] = useState("client");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [openFaqIds, setOpenFaqIds] = useState([]);
  const [helpMetrics, setHelpMetrics] = useState({ faqViews: {}, searches: {}, categories: {} });
  const lastTrackedRef = useRef("");
  const lastOpenedRef = useRef([]);

  const roleLabel = userType === "coach" ? "coach" : userType === "admin" ? "admin" : "client";

  const trackHelpEvent = (eventName, params = {}) => {
    try {
      if (typeof window !== "undefined" && typeof window.gtag === "function") {
        window.gtag("event", eventName, { help_role: roleLabel, ...params });
      }
    } catch {
      // Ignore analytics failures
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
    return faqData.filter((item) => item.role === "both" || item.role === roleLabel);
  }, [roleLabel]);

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
        const item = faqData.find((faq) => faq.id === id);
        return item ? { id, q: item.q, count } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [helpMetrics.faqViews]);

  const topCategories = useMemo(() => {
    return Object.entries(helpMetrics.categories || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [helpMetrics.categories]);

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
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
              <CardTitle>Help Insights</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-6 text-sm">
              <div>
                <p className="font-semibold text-slate-900 mb-2">Top Searches</p>
                {topSearched.length === 0 ? (
                  <p className="text-slate-500">No search data yet.</p>
                ) : (
                  <ul className="space-y-1 text-slate-700">
                    {topSearched.map(([term, count]) => (
                      <li key={term}>{term} ({count})</li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="font-semibold text-slate-900 mb-2">Most Viewed FAQs</p>
                {topViewedFaq.length === 0 ? (
                  <p className="text-slate-500">No FAQ views yet.</p>
                ) : (
                  <ul className="space-y-1 text-slate-700">
                    {topViewedFaq.map((item) => (
                      <li key={item.id}>{item.q} ({item.count})</li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="font-semibold text-slate-900 mb-2">Top Categories</p>
                {topCategories.length === 0 ? (
                  <p className="text-slate-500">No category data yet.</p>
                ) : (
                  <ul className="space-y-1 text-slate-700">
                    {topCategories.map(([cat, count]) => (
                      <li key={cat}>{categoryLabels[cat] || cat} ({count})</li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        )}

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
