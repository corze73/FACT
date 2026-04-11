import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Booking } from "@/api/entities.jsx";
import { Clock, Calendar as CalendarIcon, AlertCircle } from "lucide-react";

export default function RescheduleBookingModal({ booking, isOpen, onClose, onSuccess, currentUserId }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isRequester = booking?.reschedule_requested_by === currentUserId;
  const hasPendingReschedule = booking?.reschedule_status === 'pending';

  const handleRequestReschedule = async () => {
    if (!selectedDate || !selectedTime) {
      setError("Please select both date and time");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const proposedDateTime = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(':');
      proposedDateTime.setHours(parseInt(hours), parseInt(minutes), 0);

      await Booking.requestReschedule(booking.id, currentUserId, proposedDateTime.toISOString());
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to request reschedule");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptReschedule = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await Booking.acceptReschedule(booking.id);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to accept reschedule");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclineReschedule = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await Booking.declineReschedule(booking.id);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to decline reschedule");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatProposedDate = () => {
    if (!booking?.reschedule_proposed_date) return "";
    const date = new Date(booking.reschedule_proposed_date);
    return date.toLocaleString('en-GB', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Generate time slots (every 30 minutes from 6 AM to 10 PM)
  const timeSlots = [];
  for (let hour = 6; hour <= 22; hour++) {
    for (let minute of [0, 30]) {
      if (hour === 22 && minute === 30) break;
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeSlots.push(timeString);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            {hasPendingReschedule && !isRequester ? 'Reschedule Request' : 'Request Reschedule'}
          </DialogTitle>
          <DialogDescription>
            {hasPendingReschedule && !isRequester
              ? 'Review the proposed new date and time for this session'
              : 'Suggest a new date and time for this session'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {hasPendingReschedule && !isRequester ? (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CalendarIcon className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900">Proposed New Time</p>
                  <p className="text-blue-700 mt-1">{formatProposedDate()}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-slate-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900">Current Time</p>
                  <p className="text-slate-700 mt-1">
                    {new Date(booking.booking_date).toLocaleString('en-GB', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Note:</strong> If you decline this reschedule request, the original booking time remains. 
                If neither party can make the original time, the cancellation policy will apply.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Select New Date</Label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date() || date < new Date(new Date().setHours(0, 0, 0, 0))}
                className="rounded-md border mt-2"
              />
            </div>

            <div>
              <Label htmlFor="time">Select Time</Label>
              <select
                id="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a time...</option>
                {timeSlots.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>

            <Alert>
              <AlertDescription>
                The other party will be notified and can accept or decline this new time. 
                If declined, the original booking time remains or cancellation policy applies.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          {hasPendingReschedule && !isRequester ? (
            <>
              <Button 
                variant="outline" 
                onClick={handleDeclineReschedule} 
                disabled={isSubmitting}
                className="text-red-600 hover:text-red-700"
              >
                Decline
              </Button>
              <Button onClick={handleAcceptReschedule} disabled={isSubmitting}>
                {isSubmitting ? 'Accepting...' : 'Accept New Time'}
              </Button>
            </>
          ) : (
            <Button onClick={handleRequestReschedule} disabled={isSubmitting || !selectedDate || !selectedTime}>
              {isSubmitting ? 'Requesting...' : 'Request Reschedule'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
