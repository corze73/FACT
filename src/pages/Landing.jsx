import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, Zap, Target, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { User } from "@/api/entities.jsx";
import LoginOptionsModal from "@/components/auth/LoginOptionsModal";
import DevelopmentDisclaimer from "@/components/DevelopmentDisclaimer";

export default function Landing() {
  const navigate = useNavigate();

  // Removed auto-redirect so Landing can serve as the true homepage
  // The useEffect hook that previously handled automatic redirection is removed.

  const handleRoleSelection = (userType) => {
    const registrationType = userType === 'client' ? 'user' : userType;
    navigate(createPageUrl(`Register?type=${registrationType}`));
  };
  
  const handleLogin = async () => {
    try {
      // After auth, come back to Landing with a flag so we can redirect once
      await User.loginWithRedirect(window.location.origin + createPageUrl("Landing?next=dashboard"));
    } catch (error) {
      console.error("Google login error:", error);
      alert(`Login failed: ${error.message}`);
    }
  };

  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleEmailLogin = async (email, password) => {
    try {
      const { User } = await import("@/api/entities");
      await User.signInWithEmail(email, password);
      
      // Wait a moment for session to establish, then redirect
      setTimeout(() => {
        window.location.href = createPageUrl("Landing?next=dashboard");
      }, 500);
    } catch (error) {
      console.error("Email login failed:", error);
      // Don't redirect on error - let the modal handle the error display
      throw error;
    }
  };

  // Check if user is already logged in and redirect them
  useEffect(() => {
    const checkExistingAuth = async () => {
      const cachedUser = localStorage.getItem('currentUser');
      if (cachedUser) {
        try {
          const user = JSON.parse(cachedUser);
          console.log('User already logged in, redirecting:', user);
          
          // Redirect based on role
          if (user.role === 'admin') {
            navigate(createPageUrl("AdminDashboard"), { replace: true });
          } else if (user.user_type === 'coach') {
            navigate(createPageUrl("CoachDashboard"), { replace: true });
          } else {
            navigate(createPageUrl("FindCoaches"), { replace: true });
          }
        } catch (e) {
          console.error('Failed to parse cached user:', e);
        }
      }
    };
    
    checkExistingAuth();
  }, [navigate]);

  // Only redirect after a successful login callback (when next=dashboard)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    if (next === 'dashboard') {
      (async () => {
        try {
          // Check localStorage first for cached user data
          const cachedUser = localStorage.getItem('currentUser');
          let me = null;
          
          if (cachedUser) {
            try {
              me = JSON.parse(cachedUser);
              console.log('Using cached user data:', me);
            } catch (e) {
              console.error('Failed to parse cached user:', e);
            }
          }
          
          // If no cached data, poll for authentication with exponential backoff
          if (!me) {
            let attempts = 0;
            const maxAttempts = 10;
            
            while (attempts < maxAttempts && !me) {
              try {
                me = await User.me();
                break;
              } catch (error) {
                attempts++;
                if (attempts >= maxAttempts) {
                  throw error;
                }
                // Exponential backoff: 100ms, 200ms, 400ms, 800ms, etc.
                const delay = Math.min(100 * Math.pow(2, attempts - 1), 2000);
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          }
          
          if (!me) {
            throw new Error('Failed to establish authenticated session');
          }
          
          // Check for pending profile data from registration
          const pendingData = sessionStorage.getItem('pendingProfileData');
          if (pendingData) {
            try {
              const profileData = JSON.parse(pendingData);
              // Update user profile with registration data
              await User.updateMyUserData(profileData);
              // Clear the stored data
              sessionStorage.removeItem('pendingProfileData');
              
              // Redirect based on the user type from registration data
              if (profileData.user_type === 'coach') {
                navigate(createPageUrl("CoachDashboard"), { replace: true });
              } else {
                navigate(createPageUrl("FindCoaches"), { replace: true });
              }
              return;
            } catch (error) {
              console.error("Error applying pending profile data:", error);
              // Clear invalid data and continue with normal flow
              sessionStorage.removeItem('pendingProfileData');
            }
          }
          
          // Normal redirect logic for existing users
          if (me.role === 'admin') {
            navigate(createPageUrl("AdminDashboard"), { replace: true });
          } else if (me.user_type === 'coach') {
            navigate(createPageUrl("CoachDashboard"), { replace: true });
          } else {
            navigate(createPageUrl("FindCoaches"), { replace: true });
          }
        } catch (error) {
          // Authentication failed - stay on Landing
          console.error("Authentication check failed:", error);
          // Clear the next parameter to prevent redirect loops
          const newUrl = new URL(window.location);
          newUrl.searchParams.delete('next');
          window.history.replaceState({}, '', newUrl);
        }
      })();
    }
  }, [navigate]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg">
                <img 
                  src="https://images.pexels.com/photos/47730/the-ball-stadion-football-the-pitch-47730.jpeg" 
                  alt="FACT Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <h2 className="font-bold text-white text-xl">FACT</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              className="bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 hover:text-white"
              onClick={() => setShowLoginModal(true)}
            >
              Login
            </Button>
          </div>
        </div>
      </header>
      
      {/* Hero Section with Stadium Background */}
      <div className="relative overflow-hidden min-h-screen">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=2000&q=80')"
          }}
        >
          {/* Dark overlay for better text readability */}
          <div className="absolute inset-0 bg-black/60"></div>
          {/* Blue gradient overlay to maintain brand colors */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 via-blue-800/60 to-transparent"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 py-20 flex items-center min-h-screen">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center md:text-left max-w-4xl"
          >
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight leading-tight">
              Elevate Your Game
              <span className="block text-orange-300">With Expert Football Coaching</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-white/90 mb-12 max-w-3xl leading-relaxed">
              Connect with top-tier football coaches for personalized training. 
              Find local experts and book sessions to unlock your true potential on the pitch.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center md:justify-start items-center">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  size="lg"
                  className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-2xl hover:shadow-3xl transition-all duration-300 min-w-48"
                  onClick={() => handleRoleSelection("client")}
                >
                  Find a Coach
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 hover:border-white/50 px-8 py-4 text-lg font-semibold rounded-xl min-w-48 shadow-xl"
                  onClick={() => handleRoleSelection("coach")}
                >
                  Become a Coach
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Train Like a Pro
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Access elite coaching tailored to every aspect of your game.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Shield,
                title: "Defensive Mastery",
                description: "Master tackling, positioning, and tactical awareness."
              },
              {
                icon: Zap,
                title: "Midfield Engine",
                description: "Improve passing, vision, and control of the game."
              },
              {
                icon: Target,
                title: "Striker's Instinct",
                description: "Sharpen your finishing, movement, and goal-scoring."
              },
              {
                icon: Users,
                title: "Verified Coaches",
                description: "Learn from experienced and vetted football experts."
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="text-center border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-white to-slate-50">
                  <CardHeader className="pb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <feature.icon className="w-8 h-8 text-white" />
                    </div>
                    <CardTitle className="text-xl font-bold text-slate-900">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-gradient-to-r from-slate-900 to-blue-900">
        <div className="max-w-4xl mx-auto text-center px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold text-white mb-6">
              Ready to Transform Your Game?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Join thousands who&apos;ve found their perfect coach and achieved remarkable results. All payments are securely processed by Stripe.
            </p>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                size="lg"
                className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-4 text-xl font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300"
                onClick={() => handleRoleSelection("client")}
              >
                Get Started Today
                <ArrowRight className="w-6 h-6 ml-2" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Footer with legal links */}
      <footer className="py-8 bg-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          {/* Development Disclaimer */}
          <DevelopmentDisclaimer />
          
          {/* Footer Links */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-300 text-sm">© {new Date().getFullYear()} FACT: Find a Coach Today</p>
            <div className="flex items-center gap-6">
              <Link to={createPageUrl("PrivacyPolicy")} className="text-slate-300 hover:text-white text-sm">
                Privacy Policy
              </Link>
              <Link to={createPageUrl("Terms")} className="text-slate-300 hover:text-white text-sm">
                Terms & Conditions
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Login Options Modal */}
      <LoginOptionsModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onGoogleLogin={handleLogin}
        onEmailLogin={handleEmailLogin}
      />
    </div>
  );
}