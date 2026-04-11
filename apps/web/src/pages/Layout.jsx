

import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl, isAdminUser, normalizeUserType } from "@/utils";
import { User as UserIcon, Calendar, Search, MessageCircle, Star, LogOut, ShieldCheck, ScrollText, BriefcaseBusiness, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarBookingSearch } from "@/components/admin/SidebarBookingSearch";
import DevelopmentDisclaimer from "@/components/DevelopmentDisclaimer";
import { User, Booking, Message } from "@/api/entities.jsx";
import { apiClient } from "@/api/apiClient.js";
import { getStoredCurrentUser } from "@/api/databaseClient.js";
// Toast and auth imports removed as unused
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [navIndicators, setNavIndicators] = useState({
    hasPendingVerifications: false,
    hasUnreadMessages: false
  });

  const getCachedCurrentUser = async () => getStoredCurrentUser();

  useEffect(() => {
    loadCurrentUser();
  }, []);

  // Real-time notifications setup
  useEffect(() => {
    if (!currentUser) return;
    
    // TODO: Implement real-time notifications with WebSockets or polling
    // when needed for Neon database

    return () => {
      // Cleanup would go here
    };
  }, [currentUser]);
  const loadCurrentUser = async () => {
    try {
      const isAuth = await User.isAuthenticated();
      if (isAuth) {
        const user = await User.me();
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
    } catch (error) {
      console.error("Error loading user:", error);
      const status = Number(error?.status || 0);
      const message = String(error?.message || '').toLowerCase();
      const isAuthFailure = status === 401 || message.includes('not authenticated') || message.includes('unauthorized');

      if (isAuthFailure) {
        setCurrentUser(null);
        return;
      }

      setCurrentUser(await getCachedCurrentUser());
    }
  };
  
  // Redirect domain root "/" to the Landing page
  useEffect(() => {
    if (location.pathname === "/" || location.pathname === "") {
      navigate(createPageUrl("Landing"), { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!currentUser) {
      setNavIndicators({ hasPendingVerifications: false, hasUnreadMessages: false });
      return;
    }

    let cancelled = false;

    const loadNavIndicators = async () => {
      try {
        const isAdmin = isAdminUser(currentUser);

        let hasPendingVerifications = false;
        if (isAdmin) {
          const verificationResponse = await User.listAdminVerifications({
            type: 'coach',
            status: 'pending',
            limit: 1,
            offset: 0,
            include_total: 1
          });
          hasPendingVerifications = Number(verificationResponse?.total || 0) > 0;
        }

        const threads = await apiClient.getDirectThreads();
        const hasUnreadDirect = Array.isArray(threads)
          ? threads.some((thread) => !thread.is_read && thread.sender_id && thread.sender_id !== currentUser.id)
          : false;

        // For coach/client users, include booking-thread unread state too.
        let hasUnreadBooking = false;
        if (!isAdmin) {
          const [clientBookings, coachBookings] = await Promise.all([
            Booking.filter({ client_id: currentUser.id }, '-created_at'),
            Booking.filter({ coach_id: currentUser.id }, '-created_at')
          ]);
          const bookingMap = new Map();
          [...clientBookings, ...coachBookings].forEach((b) => bookingMap.set(b.id, b));
          const bookingIds = Array.from(bookingMap.keys());

          if (bookingIds.length > 0) {
            const messages = await Message.filter({ booking_id: { in: bookingIds } }, '-created_date');
            const lastByBooking = new Map();
            messages.forEach((m) => {
              if (!lastByBooking.has(m.booking_id)) {
                lastByBooking.set(m.booking_id, m);
              }
            });
            hasUnreadBooking = Array.from(lastByBooking.values()).some(
              (m) => m && m.sender_id !== currentUser.id && !m.is_read
            );
          }
        }

        if (!cancelled) {
          const isMessagesPage = location.pathname === createPageUrl("Messages");
          setNavIndicators({
            hasPendingVerifications,
            hasUnreadMessages: isMessagesPage ? false : (hasUnreadDirect || hasUnreadBooking)
          });
        }
      } catch (error) {
        console.error('Failed to load nav indicators', error);
      }
    };

    loadNavIndicators();
    const interval = window.setInterval(loadNavIndicators, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [currentUser, location.pathname]);

  const handleLogout = async () => {
    await User.logout();
    setCurrentUser(null);
    window.location.href = createPageUrl("Landing");
  };

  const handleLogin = async () => {
    // Always return to Landing with next=dashboard so we route once after auth
    await User.loginWithRedirect(window.location.origin + createPageUrl("Landing?next=dashboard"));
  };

  // Hide layout for full-screen pages like Conversation and Landing (public)
  if (currentPageName === 'Conversation' || currentPageName === 'Landing') {
    return children;
  }

  const getNavigationItems = () => {
    if (!currentUser) return [];
    if (isAdminUser(currentUser)) {
      return [
        { title: "Admin Dashboard", url: createPageUrl("AdminDashboard"), icon: Star },
        { title: "Verifications", url: createPageUrl("AdminVerifications"), icon: ShieldCheck, showDot: navIndicators.hasPendingVerifications },
        { title: "Audit Logs", url: createPageUrl("AdminAuditLogs"), icon: ScrollText },
        { title: "Operations", url: createPageUrl("AdminOperations"), icon: BriefcaseBusiness },
        { title: "Messages", url: createPageUrl("Messages"), icon: MessageCircle, showDot: navIndicators.hasUnreadMessages },
        { title: "Help", url: createPageUrl("Help"), icon: CircleHelp }
      ];
    }
    const normalizedType = normalizeUserType(currentUser.user_type);
    const base =
      normalizedType === "coach"
        ? [
            { title: "Dashboard", url: createPageUrl("CoachDashboard"), icon: Calendar },
            { title: "Messages", url: createPageUrl("Messages"), icon: MessageCircle, showDot: navIndicators.hasUnreadMessages },
            { title: "Profile", url: createPageUrl("CoachProfile"), icon: UserIcon },
            { title: "Help", url: createPageUrl("Help"), icon: CircleHelp }
          ]
        : [
            { title: "Find Coaches", url: createPageUrl("FindCoaches"), icon: Search },
            { title: "My Bookings", url: createPageUrl("MyBookings"), icon: Calendar },
            { title: "Messages", url: createPageUrl("Messages"), icon: MessageCircle, showDot: navIndicators.hasUnreadMessages },
            { title: "Profile", url: createPageUrl("UserProfile"), icon: UserIcon },
            { title: "Help", url: createPageUrl("Help"), icon: CircleHelp }
          ];
    return base;
  };

  const getHomeUrl = () => {
    return createPageUrl("Landing");
  };

  // If not logged in, render children without sidebar/header (Landing has its own login)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
        {children}
        <footer className="mt-auto py-6 border-t border-slate-200 bg-white/80">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-slate-500 text-sm">© {new Date().getFullYear()} FACT</p>
            <div className="flex items-center gap-4">
              <Link to={createPageUrl("PrivacyPolicy")} className="text-slate-600 hover:text-slate-900 text-sm">Privacy</Link>
              <Link to={createPageUrl("Terms")} className="text-slate-600 hover:text-slate-900 text-sm">Terms</Link>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 to-blue-50">
        <Sidebar className="border-r border-slate-200 bg-white/80 backdrop-blur-sm">
          <SidebarHeader className="border-b border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <Link to={getHomeUrl()} className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg ring-1 ring-slate-200 group-hover:ring-blue-400 transition">
                  <img 
                    src="https://images.pexels.com/photos/47730/the-ball-stadion-football-the-pitch-47730.jpeg" 
                    alt="FACT Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-lg group-hover:text-blue-700 transition">FACT</h2>
                  <p className="text-xs text-slate-500">Find a Coach Today</p>
                </div>
              </Link>
            </div>
          </SidebarHeader>
          
          {/* Booking Search for Admin Users */}
          {isAdminUser(currentUser) && (
            <div className="px-4 py-2 border-b border-slate-200">
              <SidebarBookingSearch />
            </div>
          )}
          
          <SidebarContent className="p-4">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {getNavigationItems().map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-xl mb-2 h-12 ${
                          location.pathname === item.url ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 w-full">
                          <item.icon className="w-5 h-5" />
                          <span>{item.title}</span>
                          {item.showDot && (
                            <span className="ml-auto inline-block h-2.5 w-2.5 rounded-full bg-red-500" aria-label={`${item.title} has updates`} />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-200 p-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 bg-gradient-to-r from-slate-400 to-slate-500 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {currentUser?.full_name?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm truncate">
                  {currentUser?.full_name || 'User'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize truncate">
                    {normalizeUserType(currentUser?.user_type) || 'member'}
                  </span>
                  {isAdminUser(currentUser) && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full truncate bg-yellow-100 text-yellow-800">
                      admin
                    </span>
                  )}
                </div>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-4 w-full">
              <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200 lg:hidden" />
              <Link to={getHomeUrl()} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg overflow-hidden ring-1 ring-slate-200">
                  <img 
                    src="https://images.pexels.com/photos/47730/the-ball-stadion-football-the-pitch-47730.jpeg" 
                    alt="FACT Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <h1 className="text-xl font-bold text-slate-900">FACT</h1>
              </Link>
              <div className="ml-auto">
                {currentUser ? (
                  <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1">
                    <LogOut className="w-4 h-4" />
                    Logout
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleLogin} className="gap-1">
                    Login
                  </Button>
                )}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>

          <footer className="py-6 border-t border-slate-200 bg-white/80">
            <div className="max-w-7xl mx-auto px-6">
              {/* Development Disclaimer */}
              <DevelopmentDisclaimer />
              
              {/* Footer Links */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                <p className="text-slate-500 text-sm">© {new Date().getFullYear()} FACT</p>
                <div className="flex items-center gap-4">
                  <Link to={createPageUrl("PrivacyPolicy")} className="text-slate-600 hover:text-slate-900 text-sm">Privacy</Link>
                  <Link to={createPageUrl("Terms")} className="text-slate-600 hover:text-slate-900 text-sm">Terms</Link>
                </div>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </SidebarProvider>
  );
}

