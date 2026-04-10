import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { alertToast } from "@/utils/notifications";

export default function CancelBookingModal({ isOpen, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      alertToast("Please provide a reason for cancelling.");
      return;
    }
    setIsSubmitting(true);
    await onSubmit(reason);
    setIsSubmitting(false);
    onClose();
    setReason("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Booking</DialogTitle>
          <DialogDescription>
            Please provide a brief reason for cancelling this session. This will be shared with the coach.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <Label htmlFor="cancel_reason" className="sr-only">Cancellation Reason</Label>
            <Textarea
              id="cancel_reason"
              placeholder="e.g., Schedule conflict, Personal emergency, Need to reschedule, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Keep Booking
            </Button>
            <Button 
              type="submit" 
              variant="destructive"
              disabled={isSubmitting || !reason.trim()}
            >
              {isSubmitting ? "Cancelling..." : "Cancel Booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}