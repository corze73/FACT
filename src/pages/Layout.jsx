

import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User as UserIcon, Calendar, Search, MessageCircle, Star, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarBookingSearch } from "@/components/admin/SidebarBookingSearch";
import DevelopmentDisclaimer from "@/components/DevelopmentDisclaimer";
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

  useEffect(() => {
    loadCurrentUser();
  }, []);

  // Real-time notifications setup
  useEffect(() => {
    if (!currentUser) return;

    console.log('Real-time notifications disabled during Neon migration');
    
    // TODO: Implement real-time notifications with WebSockets or polling
    // when needed for Neon database

    return () => {
      // Cleanup would go here
    };
  }, [currentUser]);
  const loadCurrentUser = async () => {
    try {
      const { User } = await import("@/api/entities.jsx");
      const isAuth = await User.isAuthenticated();
      if (isAuth) {
        const user = await User.me();
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
    } catch (error) {
      console.error("Error loading user:", error);
      // Clear any stale auth state
      setCurrentUser(null);
    }
  };
  
  // Redirect domain root "/" to the Landing page
  useEffect(() => {
    if (location.pathname === "/" || location.pathname === "") {
      navigate(createPageUrl("Landing"), { replace: true });
    }
  }, [location.pathname, navigate]);

  const handleLogout = async () => {
    const { User } = await import("@/api/entities.jsx");
    await User.logout();
    setCurrentUser(null);
    window.location.href = createPageUrl("Landing");
  };

  const handleLogin = async () => {
    const { User } = await import("@/api/entities.jsx");
    // Always return to Landing with next=dashboard so we route once after auth
    await User.loginWithRedirect(window.location.origin + createPageUrl("Landing?next=dashboard"));
  };

  // Hide layout for full-screen pages like Conversation and Landing (public)
  if (currentPageName === 'Conversation' || currentPageName === 'Landing') {
    return children;
  }

  const getNavigationItems = () => {
    if (!currentUser) return [];
    if (currentUser.role === "admin") {
      return [
        { title: "Admin Dashboard", url: createPageUrl("AdminDashboard"), icon: Star },
        { title: "Messages", url: createPageUrl("Messages"), icon: MessageCircle }
      ];
    }
    const base =
      currentUser.user_type === "coach"
        ? [
            { title: "Dashboard", url: createPageUrl("CoachDashboard"), icon: Calendar },
            { title: "Messages", url: createPageUrl("Messages"), icon: MessageCircle },
            { title: "Profile", url: createPageUrl("CoachProfile"), icon: UserIcon }
          ]
        : [
            { title: "Find Coaches", url: createPageUrl("FindCoaches"), icon: Search },
            { title: "My Bookings", url: createPageUrl("MyBookings"), icon: Calendar },
            { title: "Messages", url: createPageUrl("Messages"), icon: MessageCircle },
            { title: "Profile", url: createPageUrl("UserProfile"), icon: UserIcon }
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
          {currentUser?.role === 'admin' && (
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
                        <Link to={item.url} className="flex items-center gap-3 px-4">
                          <item.icon className="w-5 h-5" />
                          <span>{item.title}</span>
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
                    {currentUser?.user_type === 'user' ? 'client' : currentUser?.user_type || 'member'}
                  </span>
                  {currentUser?.role && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full truncate ${
                        currentUser.role === 'admin'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {currentUser.role}
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

