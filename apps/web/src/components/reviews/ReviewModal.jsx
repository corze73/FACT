import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { motion } from "framer-motion";
import { alertToast } from "@/utils/notifications";

export default function ReviewModal({ isOpen, onClose, booking, onSubmit, currentUser }) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (rating === 0) {
      alertToast("Please select a rating");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ rating, comment });
      setRating(0);
      setComment("");
    } catch (error) {
      console.error("Error submitting review:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!booking) return null;

  const isClient = currentUser?.id === booking.client_id;
  const revieweeType = isClient ? "coach" : "client";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Rate Your {isClient ? "Coach" : "Client"}
          </DialogTitle>
          <DialogDescription>
            Share your experience and help others in the football community
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="text-center">
            <p className="text-slate-600 mb-4">
              How was your {booking.service_type.replace(/_/g, ' ')} session?
            </p>
            
            <div className="flex justify-center gap-2 mb-6">
              {Array(5).fill(0).map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className="focus:outline-none"
                  onMouseEnter={() => setHoveredRating(index + 1)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(index + 1)}
                >
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Star
                      className={`w-8 h-8 transition-colors duration-200 ${
                        index < (hoveredRating || rating)
                          ? "text-yellow-500 fill-current"
                          : "text-slate-300"
                      }`}
                    />
                  </motion.div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Share your experience (optional)
            </label>
            <Textarea
              placeholder={`Tell others about your session with this ${revieweeType}...`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={isSubmitting || rating === 0}
            >
              {isSubmitting ? "Submitting..." : "Submit Review"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}