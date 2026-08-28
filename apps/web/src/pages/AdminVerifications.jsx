import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { User } from "@/api/entities.jsx";
import { createLoginUrl, createPageUrl, isAdminUser } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getBackgroundCheckDisplayStatus } from "@/lib/complianceConstants";
import { showError, showSuccess } from "@/utils/notifications";

const PAGE_SIZE = 20;
const ADMIN_VERIFICATIONS_CURRENT_USER_QUERY_KEY = ["admin-verifications", "current-user"];

const isAuthFailure = (error) => error?.status === 401 || error?.message?.includes("Not authenticated");

const tone = (status) => {
  if (status === 'verified') return 'bg-emerald-100 text-emerald-700';
  if (status === 'rejected') return 'bg-red-100 text-red-700';
  if (status === 'pending') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-700';
};

export default function AdminVerifications() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSaving, setIsSaving] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [notesByCoach, setNotesByCoach] = useState({});
  const [page, setPage] = useState(1);

  const currentUserQuery = useQuery({
    queryKey: ADMIN_VERIFICATIONS_CURRENT_USER_QUERY_KEY,
    queryFn: () => User.me(),
    staleTime: 5 * 60 * 1000,
  });

  const rowsQuery = useQuery({
    queryKey: ["admin-verifications", page],
    queryFn: async () => {
      const offset = (page - 1) * PAGE_SIZE;
      const response = await User.listAdminVerifications({
        type: 'coach',
        status: 'pending',
        limit: PAGE_SIZE,
        offset,
        include_total: 1
      });

      return {
        rows: response?.data || [],
        total: response?.total || 0,
      };
    },
    enabled: Boolean(currentUserQuery.data && isAdminUser(currentUserQuery.data)),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!currentUserQuery.error) return;
    if (isAuthFailure(currentUserQuery.error)) {
      navigate(createLoginUrl(location.pathname + location.search));
    }
  }, [currentUserQuery.error, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!currentUserQuery.data || isAdminUser(currentUserQuery.data)) return;
    navigate(createPageUrl('Landing'));
  }, [currentUserQuery.data, navigate]);

  useEffect(() => {
    if (!rowsQuery.error) return;
    console.error('Failed to load verification queue', rowsQuery.error);
    showError('Verification Queue Unavailable', rowsQuery.error.message || 'Failed to load verification queue');
  }, [rowsQuery.error]);

  const applyDecision = async (coachId, payload, label) => {
    setIsSaving(true);
    setActiveAction(`${coachId}:${label}`);
    try {
      const notes = notesByCoach[coachId] || '';
      await User.updateAdminVerification(coachId, { ...payload, verification_notes: notes || null });
      await rowsQuery.refetch();
      showSuccess('Verification Updated', `${label} updated successfully.`);
    } catch (error) {
      showError('Verification Update Failed', error.message || 'Failed to update verification');
    } finally {
      setIsSaving(false);
      setActiveAction(null);
    }
  };

  const currentUser = currentUserQuery.data ?? null;
  const rows = rowsQuery.data?.rows ?? [];
  const total = rowsQuery.data?.total ?? 0;
  const loading = currentUserQuery.isLoading || rowsQuery.isLoading;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(createPageUrl("AdminDashboard"));
  };

  if (loading) return <div className="p-8">Loading verification queue...</div>;
  if (!currentUser || !isAdminUser(currentUser)) return null;

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Button variant="outline" onClick={handleBack}>
          Back
        </Button>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Coach Verifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rows.length === 0 ? (
              <p className="text-slate-600">No pending coach verification items.</p>
            ) : (
              rows.map((coach) => (
                <div key={coach.id} className="border rounded-lg p-4 space-y-3">
                  {(() => {
                    const backgroundDisplayStatus = getBackgroundCheckDisplayStatus(
                      coach.background_check_status,
                      coach.background_check_expires_at
                    );

                    return (
                      <>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{coach.full_name}</p>
                      <p className="text-sm text-slate-600">{coach.city || '—'}, {coach.country || '—'}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={tone(coach.qualification_status)}>Qualification: {coach.qualification_status}</Badge>
                      <Badge className={tone(backgroundDisplayStatus)}>Background Check: {backgroundDisplayStatus}</Badge>
                      <Badge className={tone(coach.insurance_status)}>Insurance: {coach.insurance_status || 'incomplete'}</Badge>
                    </div>
                  </div>

                  <div className="border rounded-md p-3 space-y-2">
                    <p className="text-sm font-medium text-slate-700">Insurance certificate</p>
                    <p className="text-sm text-slate-600">Provider: {coach.insurance_provider || 'Not specified'}</p>
                    <p className="text-sm text-slate-600">Policy: {coach.insurance_policy_number || 'Not specified'}</p>
                    <p className="text-sm text-slate-600">Cover: {coach.insurance_cover_amount_gbp ? `£${Number(coach.insurance_cover_amount_gbp).toLocaleString()}` : 'Not specified'} · Expiry: {coach.insurance_expires_at || 'Not provided'}</p>
                    {coach.insurance_file_url ? <a className="text-blue-600 underline text-sm" href={coach.insurance_file_url} target="_blank" rel="noreferrer">Open insurance certificate</a> : <p className="text-sm text-slate-500">No file uploaded</p>}
                    <div className="flex gap-2">
                      <Button size="sm" disabled={isSaving || !coach.insurance_provider || !coach.insurance_policy_number || !coach.insurance_file_url || !coach.insurance_expires_at || new Date(coach.insurance_expires_at) < new Date()} onClick={() => applyDecision(coach.id, { insurance_status: 'verified' }, 'Insurance approval')}>Approve</Button>
                      <Button size="sm" variant="outline" disabled={isSaving} onClick={() => applyDecision(coach.id, { insurance_status: 'rejected' }, 'Insurance rejection')}>Reject</Button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">Qualification document</p>
                      {coach.qualification_file_url ? (
                        <a
                          className="text-blue-600 underline text-sm"
                          href={coach.qualification_file_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open qualification file
                        </a>
                      ) : (
                        <p className="text-sm text-slate-500">No file uploaded</p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={isSaving || !coach.qualification_type || !coach.qualification_file_url}
                          onClick={() => applyDecision(coach.id, { qualification_status: 'verified' }, 'Qualification approval')}
                        >
                          {activeAction === `${coach.id}:Qualification approval` ? 'Saving...' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSaving}
                          onClick={() => applyDecision(coach.id, { qualification_status: 'rejected' }, 'Qualification rejection')}
                        >
                          {activeAction === `${coach.id}:Qualification rejection` ? 'Saving...' : 'Reject'}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">Background check document</p>
                      <p className="text-sm text-slate-600">Type: {coach.background_check_type || 'Not specified'}</p>
                      <p className="text-sm text-slate-600">Expiry: {coach.background_check_expires_at || 'Not provided'}</p>
                      {coach.background_check_file_url ? (
                        <a
                          className="text-blue-600 underline text-sm"
                          href={coach.background_check_file_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open background check file
                        </a>
                      ) : (
                        <p className="text-sm text-slate-500">No file uploaded</p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={isSaving || !coach.has_background_check || !coach.background_check_type || !coach.background_check_file_url || !coach.background_check_expires_at || backgroundDisplayStatus === 'expired'}
                          onClick={() => applyDecision(coach.id, { background_check_status: 'verified' }, 'Background check approval')}
                        >
                          {activeAction === `${coach.id}:Background check approval` ? 'Saving...' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSaving}
                          onClick={() => applyDecision(coach.id, { background_check_status: 'rejected' }, 'Background check rejection')}
                        >
                          {activeAction === `${coach.id}:Background check rejection` ? 'Saving...' : 'Reject'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">Verification notes</p>
                    <Textarea
                      value={notesByCoach[coach.id] ?? coach.verification_notes ?? ''}
                      onChange={(e) => setNotesByCoach((prev) => ({ ...prev, [coach.id]: e.target.value }))}
                      placeholder="Add reviewer notes"
                    />
                  </div>
                      </>
                    );
                  })()}
                </div>
              ))
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
