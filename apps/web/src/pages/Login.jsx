import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { User } from "@/api/entities.jsx";
import LoginOptionsModal from "@/components/auth/LoginOptionsModal";
import { createPageUrl } from "@/utils";
import { buildAbsoluteLoginRedirect, completePostLoginNavigation, getSafeNextPath } from "@/auth/redirects.js";
import { showError } from "@/utils/notifications";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const requestedNextPath = getSafeNextPath(params.get("next"));

  const redirectAuthenticatedUser = async () => {
    await completePostLoginNavigation({ navigate, nextPath: requestedNextPath });
  };

  useEffect(() => {
    let cancelled = false;

    const redirectIfAuthenticated = async () => {
      try {
        const isAuthenticated = await User.isAuthenticated();
        if (!isAuthenticated || cancelled) {
          return;
        }

        await redirectAuthenticatedUser();
      } catch {
        // Stay on the login page when no valid session exists.
      }
    };

    redirectIfAuthenticated();

    return () => {
      cancelled = true;
    };
  }, [location.search]);

  const handleGoogleLogin = async () => {
    const target = buildAbsoluteLoginRedirect(requestedNextPath);
    await User.loginWithRedirect(target);
  };

  const handleEmailLogin = async (email, password) => {
    await User.signInWithEmail(email, password);
    await redirectAuthenticatedUser();
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_40%),linear-gradient(180deg,_#0f172a_0%,_#111827_100%)]">
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-12">
        <div className="text-center text-white/85">
          <p className="text-sm uppercase tracking-[0.3em] text-orange-300">FACT</p>
          <h1 className="mt-4 text-4xl font-semibold">Sign in to continue</h1>
          <p className="mt-3 max-w-xl text-sm text-slate-300">
            Use Google or email to access your coaching dashboard, bookings, messages, and admin tools.
          </p>
        </div>
      </div>

      <LoginOptionsModal
        isOpen={true}
        onClose={() => navigate(createPageUrl("Landing"), { replace: true })}
        onGoogleLogin={async () => {
          try {
            await handleGoogleLogin();
          } catch (error) {
            console.error("Google login error:", error);
            showError("Login Failed", error.message || "Unable to log in.");
            throw error;
          }
        }}
        onEmailLogin={handleEmailLogin}
      />
    </div>
  );
}