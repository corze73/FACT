import { useEffect, useState } from "react";
import { Booking } from "@/api/entities.jsx";
import { User } from "@/api/entities.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, CreditCard } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl, isAdminUser } from "@/utils";
import { format, isValid } from "date-fns";
import { BookingReference, BookingReferenceSearch } from "../components/booking/BookingReference";
import StripePaymentModal from "@/components/payment/StripePaymentModal.jsx";

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

export default function AdminBookings() {
  const navigate = useNavigate();
  const location = useLocation();
  const [bookings, setBookings] = useState([]);
  const [totalBookings, setTotalBookings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [highlightedBookingId, setHighlightedBookingId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentBooking, setPaymentBooking] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  const urlParams = new URLSearchParams(window.location.search);
  const statusParam = (urlParams.get("status") || "all").toLowerCase();
  const highlightParam = urlParams.get("highlight");
  const hasActiveFilters = statusParam !== "all";

  useEffect(() => {
    const load = async () => {
      try {
        const me = await User.me();
        setCurrentUser(me);
        if (!isAdminUser(me)) return;

        setIsFetching(true);
        const response = await Booking.list({
          orderBy: '-created_at',
          limit: PAGE_SIZE,
          offset: (currentPage - 1) * PAGE_SIZE,
          includeTotal: true,
          view: 'admin_list',
          status: statusParam !== 'all' ? statusParam : undefined
        });

        const list = response?.data || response || [];
        const total = response?.total ?? list.length;
        setTotalBookings(total);
        setBookings(list);
      } catch (error) {
        console.error("Error loading bookings:", error);
      } finally {
        setLoading(false);
        setIsFetching(false);
      }
    };
    load();
  }, [currentPage, statusParam]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusParam]);

  // Handle navigation from sidebar search
  useEffect(() => {
    const targetId = location.state?.selectedBookingId || highlightParam;
    if (targetId) {
      setHighlightedBookingId(targetId);
      // Clear the highlight after 3 seconds
      const timer = setTimeout(() => {
        setHighlightedBookingId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [location.state, highlightParam]);

  const filtered = bookings;

  const statusBadge = (status) => {
    const map = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      completed: "bg-blue-100 text-blue-800"
    };
    return map[status] || "bg-slate-100 text-slate-800";
  };

  const openPayment = (booking, client, coach) => {
    // Enrich booking with names/emails expected by StripePaymentModal
    const enriched = {
      ...booking,
      client_name: client?.full_name || 'Client',
      client_email: client?.email || undefined,
      coach_name: coach?.full_name || 'Coach',
      duration: booking.duration || 1,
    };
    setPaymentBooking(enriched);
    setIsPaymentOpen(true);
  };

  const handlePaymentSuccess = () => {
    // Update local state for the paid booking
    if (paymentBooking) {
      setBookings(prev => prev.map(b => (
        b.id === paymentBooking.id
          ? { ...b, status: 'confirmed', payment_status: 'authorized' }
          : b
      )));
    }
    setIsPaymentOpen(false);
    setPaymentBooking(null);
  };

  if (loading) return <div className="p-8">Loading bookings...</div>;
  if (!currentUser || !isAdminUser(currentUser)) return null;

  const handleBookingFound = (booking) => {
    // Highlight or navigate to the found booking
    console.log('Found booking:', booking);
    // You could scroll to the booking or open it in a modal
  };

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <BookingReferenceSearch 
          onBookingFound={handleBookingFound}
          onError={console.error}
        />
        
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Bookings ({statusParam === "all" ? "All" : statusParam})</CardTitle>
            {hasActiveFilters && (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCurrentPage(1);
                    navigate(createPageUrl("AdminBookings?status=all"));
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            )}
            {isFetching && !loading && <p className="text-xs text-slate-500">Updating bookings...</p>}
          </CardHeader>
          <CardContent className="space-y-3">
            {filtered.length === 0 ? (
              <p className="text-slate-600">No bookings found.</p>
            ) : (
              filtered.map((b) => {
                return (
                  <div 
                    key={b.id} 
                    className={`flex flex-col md:flex-row md:items-center md:justify-between p-3 rounded-lg border transition-all duration-300 ${
                      highlightedBookingId === b.id 
                        ? 'border-blue-400 bg-blue-50 shadow-md' 
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-medium text-slate-900">{b.service_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                        <BookingReference reference={b.reference_code} />
                      </div>
                      <p className="text-sm text-slate-600">{b.client_name || "Client"} → {b.coach_name || "Coach"}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatSafeDate(b.booking_date)} • {b.duration || 60} mins • £{b.total_price || b.price}
                      </p>
                    </div>
                    <div className="mt-2 md:mt-0 flex items-center gap-2">
                      <Badge className={statusBadge(b.status)}>{b.status}</Badge>
                      <Button variant="outline" size="sm" onClick={() => navigate(createPageUrl(`Conversation?booking_id=${b.id}`))}>
                        <MessageCircle className="w-4 h-4 mr-2" /> Open Chat
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => openPayment(b, { full_name: b.client_name }, { full_name: b.coach_name })}
                      >
                        <CreditCard className="w-4 h-4 mr-2" /> Take Payment
                      </Button>
                    </div>
                  </div>
                );
              })
            )}

            {totalBookings > PAGE_SIZE && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-slate-600">
                  Page {currentPage} of {Math.max(1, Math.ceil(totalBookings / PAGE_SIZE))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalBookings / PAGE_SIZE), p + 1))}
                  disabled={currentPage >= Math.ceil(totalBookings / PAGE_SIZE)}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        {/* Stripe Payment Modal */}
        {isPaymentOpen && paymentBooking && (
          <StripePaymentModal
            booking={paymentBooking}
            isOpen={isPaymentOpen}
            onClose={() => { setIsPaymentOpen(false); setPaymentBooking(null); }}
            onPaymentSuccess={handlePaymentSuccess}
          />
        )}
      </div>
    </div>
  );
}