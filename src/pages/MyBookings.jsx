
import { useState, useEffect } from "react";
import { User } from "@/api/entities.jsx";
import { Booking } from "@/api/entities.jsx";
import { Review } from "@/api/entities.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, MapPin, Star, MessageCircle, CheckCircle } from "lucide-react";
import { XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isValid } from "date-fns";

// Utility function to safely parse dates
const safeParseDate = (dateValue) => {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  return isValid(date) ? date : null;
};

// Utility function to format dates safely
const formatSafeDate = (dateValue, formatStr = 'PPP') => {
  const date = safeParseDate(dateValue);
  return date ? format(date, formatStr) : 'Date TBD';
};
import ReviewModal from "../components/reviews/ReviewModal";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import CancelBookingModal from "../components/booking/CancelBookingModal";


export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [partners, setPartners] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const navigate = useNavigate();

  // Redirect admins to AdminDashboard
  useEffect(() => {
    (async () => {
      try {
        const me = await User.me();
        if (me.role === "admin") {
          navigate(createPageUrl("AdminDashboard"));
        }
      } catch (error) {
        // User not authenticated - redirect to landing
        console.error("Error checking user role:", error);
        navigate(createPageUrl("Landing"));
      }
    })();
  }, [navigate]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
      
      // Get bookings where user is either client or coach
      const clientBookings = await Booking.filter({ client_id: user.id }, '-created_at');
      const coachBookings = await Booking.filter({ coach_id: user.id }, '-created_at');
      const userBookings = await Booking.filter({ user_id: user.id }, '-created_at');
      
      // Combine and deduplicate bookings
      const allBookingsMap = new Map();
      [...clientBookings, ...coachBookings, ...userBookings].forEach(booking => {
        allBookingsMap.set(booking.id, booking);
      });
      const allBookings = Array.from(allBookingsMap.values());
      
      setBookings(allBookings.sort((a,b) => {
        const dateA = safeParseDate(a.session_date) || new Date('1900-01-01');
        const dateB = safeParseDate(b.session_date) || new Date('1900-01-01');
        return dateB - dateA;
      }));

      const partnerIds = [...new Set(allBookings.map(b => 
          user.id === b.client_id ? b.coach_id : b.client_id
      ).filter(Boolean))];

      if (partnerIds.length > 0) {
          const partnerUsers = await User.filter({ id: { in: partnerIds }});
          const partnersMap = partnerUsers.reduce((acc, partner) => {
              acc[partner.id] = partner;
              return acc;
          }, {});
          setPartners(partnersMap);
      }

    } catch (error) {
      console.error("Error loading bookings:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleMessageClick = (bookingId) => {
    navigate(createPageUrl(`Conversation?booking_id=${bookingId}`));
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      completed: "bg-blue-100 text-blue-800"
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const formatServiceName = (service) => {
    return service.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getFilteredBookings = (tab) => {
    const now = new Date();
    return bookings.filter(booking => {
      const bookingDate = safeParseDate(booking.session_date) || new Date('1900-01-01');
      
      switch (tab) {
        case "upcoming":
          return bookingDate >= now && (booking.status === 'confirmed' || booking.status === 'pending');
        case "past":
          return bookingDate < now || booking.status === "completed";
        case "cancelled":
          return booking.status === "cancelled";
        default:
          return true;
      }
    });
  };

  const handleLeaveReview = (booking) => {
    setSelectedBooking(booking);
    setShowReviewModal(true);
  };

  const handleReviewSubmit = async (reviewData) => {
    try {
      const revieweeId = currentUser.id === selectedBooking.client_id 
        ? selectedBooking.coach_id 
        : selectedBooking.client_id;

      await Review.create({
        ...reviewData,
        booking_id: selectedBooking.id,
        reviewer_id: currentUser.id,
        reviewee_id: revieweeId,
        reviewer_type: currentUser.user_type
      });

      setShowReviewModal(false);
      setSelectedBooking(null);
      loadData(); // Refresh bookings
    } catch (error) {
      console.error("Error submitting review:", error);
      alert("Error submitting review. Please try again.");
    }
  };

  const handleCancelBooking = async (reason) => {
    try {
      await Booking.update(bookingToCancel.id, { 
        cancel: true, 
        cancellation_reason: reason 
      });
      setBookingToCancel(null);
      loadData(); // Refresh bookings
      alert("Booking cancelled successfully.");
    } catch (error) {
      console.error("Error cancelling booking:", error);
      alert("Error cancelling booking. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-slate-900 mb-2">My Bookings</h1>
          <p className="text-slate-600">
            Manage your coaching sessions and track your progress
          </p>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past Sessions</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>

          {["upcoming", "past", "cancelled"].map((tab) => (
            <TabsContent key={tab} value={tab}>
              <div className="grid gap-4">
                <AnimatePresence>
                  {getFilteredBookings(tab).map((booking, index) => {
                    const isClient = currentUser.id === booking.client_id;
                    const partnerId = isClient ? booking.coach_id : booking.client_id;
                    const partner = partners[partnerId];
                    const otherParty = isClient ? "Coach" : "Client";
                    
                    return (
                      <motion.div
                        key={booking.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-lg">
                                  {formatServiceName(booking.service_type)} Session
                                </CardTitle>
                                <p className="text-slate-600">
                                  {otherParty}: {partner?.full_name || '...'}
                                </p>
                              </div>
                              <Badge className={getStatusColor(booking.status)}>
                                {booking.status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid md:grid-cols-2 gap-4 mb-4">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-500" />
                                <span>{formatSafeDate(booking.session_date)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-500" />
                                <span>{booking.session_time} ({booking.duration} mins)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-slate-500" />
                                <span>{booking.location?.type || 'Online'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">£{booking.total_price || booking.price}</span>
                                {booking.admin_fee && (
                                  <span className="text-xs text-slate-500">
                                    (inc. £{booking.admin_fee} admin fee)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2 flex-wrap">
                              <Button variant="outline" size="sm" onClick={() => handleMessageClick(booking.id)}>
                                <MessageCircle className="w-4 h-4 mr-2" />
                                Message
                              </Button>
                              
                              {(booking.status === "pending" || booking.status === "confirmed") && isClient && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setBookingToCancel(booking)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Cancel
                                </Button>
                              )}
                              
                              {tab === "past" && booking.status === "completed" && (
                                <Button 
                                  size="sm"
                                  onClick={() => handleLeaveReview(booking)}
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  <Star className="w-4 h-4 mr-2" />
                                  Leave Review
                                </Button>
                              )}
                              
                              {booking.status === "pending" && !isClient && (
                                <>
                                  <Button 
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={async () => { await Booking.update(booking.id, {accept: true}); loadData(); }}
                                  >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Accept
                                  </Button>
                                  <Button 
                                    variant="outline" size="sm"
                                    onClick={() => navigate(createPageUrl('CoachDashboard'))}
                                  >
                                    Decline
                                  </Button>
                                </>
                              )}
                              
                              {booking.status === "confirmed" && !isClient && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setBookingToCancel(booking)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Cancel as Coach
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {getFilteredBookings(tab).length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12"
                  >
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      No {tab} bookings
                    </h3>
                    <p className="text-slate-600">
                      {tab === "upcoming" 
                        ? "You don't have any upcoming sessions scheduled."
                        : `No ${tab} sessions to display.`
                      }
                    </p>
                  </motion.div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <ReviewModal
        isOpen={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setSelectedBooking(null);
        }}
        booking={selectedBooking}
        onSubmit={handleReviewSubmit}
        currentUser={currentUser}
      />

      <CancelBookingModal
        isOpen={!!bookingToCancel}
        onClose={() => setBookingToCancel(null)}
        onSubmit={handleCancelBooking}
      />
    </div>
  );
}
