import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AdminInvite() {
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setError("Invite token is missing.");
        setLoading(false);
        return;
      }

      try {
        const result = await User.verifyAdminInvite(token);
        setInvite(result?.data || result || null);
      } catch (e) {
        setError(e.message || "Unable to verify invite.");
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  const acceptInvite = async () => {
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await User.acceptAdminInvite({ token, full_name: fullName.trim() });
      navigate(createPageUrl("AdminDashboard"), { replace: true });
    } catch (e) {
      setError(e.message || "Failed to accept invite.");
    } finally {
      setSubmitting(false);
    }
  };

  const isPending = invite?.status === "pending";

  return (
    <div className="min-h-screen p-6 md:p-10 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-xl mx-auto">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Admin Invite</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-slate-600">Verifying invite...</p>
            ) : (
              <>
                {invite && (
                  <div className="text-sm text-slate-700 space-y-1">
                    <p><span className="font-medium">Email:</span> {invite.email}</p>
                    <p><span className="font-medium">Scope:</span> {invite.admin_scope}</p>
                    <p><span className="font-medium">Status:</span> {invite.status}</p>
                    <p><span className="font-medium">Expires:</span> {invite.expires_at ? new Date(invite.expires_at).toLocaleString() : 'n/a'}</p>
                  </div>
                )}

                {isPending && (
                  <>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
                      disabled={submitting}
                    />
                    <Button onClick={acceptInvite} disabled={submitting || !fullName.trim()} className="w-full">
                      {submitting ? "Accepting..." : "Accept Invite And Continue"}
                    </Button>
                  </>
                )}

                {!isPending && invite && (
                  <p className="text-slate-600">This invite is no longer active.</p>
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
