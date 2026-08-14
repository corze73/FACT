import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { User } from '@/api/entities.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

const categories = [
  ['child_safety', 'Concern involving a child or young person'],
  ['inappropriate_behaviour', 'Inappropriate behaviour'],
  ['harassment', 'Harassment or unwanted contact'],
  ['discrimination', 'Discrimination'],
  ['physical_safety', 'Physical safety'],
  ['other', 'Other safeguarding concern']
];

export default function SafeguardingReport() {
  const [params] = useSearchParams();
  const subjectUserId = useMemo(() => params.get('subject_user_id') || null, [params]);
  const bookingId = useMemo(() => params.get('booking_id') || null, [params]);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [immediateDanger, setImmediateDanger] = useState(false);
  const [contactPermission, setContactPermission] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!category || description.trim().length < 20) {
      setError('Select a category and provide at least 20 characters of detail.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await User.submitSafeguardingReport({
        category,
        description: description.trim(),
        immediate_danger: immediateDanger,
        contact_permission: contactPermission,
        subject_user_id: subjectUserId,
        booking_id: bookingId
      });
      setSubmitted(result);
    } catch (submissionError) {
      setError(submissionError?.message || 'Your concern could not be submitted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto p-6 md:p-10">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert /> Concern submitted</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p>Your concern has been sent securely to the FACT safeguarding team.</p>
            <p className="text-sm text-slate-600">Reference: {submitted?.data?.id}</p>
            {immediateDanger && <p className="font-semibold text-red-700">If anyone is in immediate danger, call 999 now.</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Report a safeguarding concern</h1>
        <p className="mt-2 text-slate-600">Tell FACT about behaviour or circumstances that may put someone at risk.</p>
      </div>
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex gap-3 text-red-900">
        <AlertTriangle className="shrink-0" />
        <div><p className="font-semibold">This service is not monitored as an emergency service.</p><p>If anyone is in immediate danger, call 999 now.</p></div>
      </div>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-5">
            <label className="block space-y-2">
              <span className="font-medium">Type of concern</span>
              <select className="w-full rounded-md border border-slate-300 p-2" value={category} onChange={(e) => setCategory(e.target.value)} required>
                <option value="">Select one</option>
                {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="font-medium">What happened?</span>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={8} maxLength={4000} placeholder="Include what happened, when it happened, and who was involved. Do not investigate the matter yourself." required />
              <span className="text-xs text-slate-500">{description.length}/4000 characters</span>
            </label>
            <label className="flex gap-3 items-start"><input type="checkbox" checked={immediateDanger} onChange={(e) => setImmediateDanger(e.target.checked)} className="mt-1" /><span><strong>Someone may be in immediate danger.</strong> This marks the case as critical, but you should still call 999.</span></label>
            <label className="flex gap-3 items-start"><input type="checkbox" checked={contactPermission} onChange={(e) => setContactPermission(e.target.checked)} className="mt-1" /><span>FACT may contact me for more information.</span></label>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <Button type="submit" disabled={submitting}>{submitting ? 'Submitting securely…' : 'Submit concern'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
