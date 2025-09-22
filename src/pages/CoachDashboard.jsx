import { useState, useEffect } from "react";
import { User } from "@/api/entities.jsx";
import { Booking } from "@/api/entities.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, MapPin, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { format, isValid } from "date-fns";
import DeclineBookingModal from "../components/booking/DeclineBookingModal";

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

export default function CoachDashboard() {
  const [bookings, setBookings] = useState([]);
  const [clients, setClients] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [bookingToDecline, setBookingToDecline] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);

      console.log('Coach loading data for user:', user.id, user.full_name);

      // Get all bookings and filter for this coach
      const allBookings = await Booking.list('-created_at', 1000);
      console.log('All bookings loaded:', allBookings.length);
      
      const coachBookings = allBookings.filter(booking => 
        booking.coach_id === user.id || 
        (booking.user_id === user.id && booking.coach_id === user.id)
      );
      
      console.log('Coach bookings filtered:', coachBookings.length, coachBookings);
      
      setBookings(coachBookings.sort((a, b) => {
        const dateA = safeParseDate(a.session_date) || new Date('2099-01-01');
        const dateB = safeParseDate(b.session_date) || new Date('2099-01-01');
        return dateA - dateB;
      }));
      
      const clientIds = [...new Set(coachBookings.map(b => b.client_id).filter(Boolean))];
      console.log('Client IDs to fetch:', clientIds);
      
      if (clientIds.length > 0) {
        const clientUsers = await User.filter({ id: { in: clientIds }});
        console.log('Client users loaded:', clientUsers);
        const clientsMap = clientUsers.reduce((acc, client) => {
          acc[client.id] = client;
          return acc;
        }, {});
        setClients(clientsMap);
      }

    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptBooking = async (bookingId) => {
    try {
      await Booking.update(bookingId, { status: 'confirmed' });
      loadData();
    } catch (error) {
      console.error("Error accepting booking:", error);
      alert("Error accepting booking. Please try again.");
    }
  };

  const handleDeclineBooking = async (bookingId, reason) => {
    await Booking.update(bookingId, { status: 'cancelled', decline_reason: reason });
    setBookingToDecline(null);
    loadData();
  };

  const getStatusColor = (status) => {
    return {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      completed: "bg-blue-100 text-blue-800"
    }[status] || "bg-gray-100 text-gray-800";
  };
  
  const getFilteredBookings = (status) => {
    return bookings.filter(b => b.status === status);
  };

  const renderBookingCard = (booking) => {
    const client = clients[booking.client_id];
    return (
      <Card key={booking.id} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">
                Session with {client?.full_name || '...'}
              </CardTitle>
              <p className="text-slate-600">
                {booking.service_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </p>
            </div>
            <Badge className={getStatusColor(booking.status)}>{booking.status}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 mb-4 text-sm">
            <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-500" /><span>{formatSafeDate(booking.session_date)}</span></div>
            <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-slate-500" /><span>{booking.session_time} ({booking.duration} mins)</span></div>
            <div className="flex items-center gap-2 col-span-2"><MapPin className="w-4 h-4 text-slate-500" /><span>{booking.location?.type || 'Online'} - {booking.location?.address}</span></div>
          </div>
          {booking.status === 'pending' && (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleAcceptBooking(booking.id)}><CheckCircle className="w-4 h-4 mr-2" />Accept</Button>
              <Button variant="outline" size="sm" onClick={() => setBookingToDecline(booking)}><XCircle className="w-4 h-4 mr-2" />Decline</Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const pendingBookings = getFilteredBookings('pending');
  const confirmedBookings = getFilteredBookings('confirmed');
  const pastBookings = bookings.filter(b => ['completed', 'cancelled'].includes(b.status));

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Coach Dashboard</h1>
          <p className="text-slate-600">Manage your bookings and schedule.</p>
        </motion.div>
        
        {pendingBookings.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-8 p-4 bg-yellow-50 border-l-4 border-yellow-400 flex items-center gap-3 rounded-r-lg">
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
            <div>
              <h3 className="font-semibold text-yellow-800">New Booking Requests</h3>
              <p className="text-yellow-700 text-sm">You have {pendingBookings.length} new request{pendingBookings.length > 1 ? 's' : ''} to review.</p>
            </div>
          </motion.div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">Pending ({pendingBookings.length})</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming ({confirmedBookings.length})</TabsTrigger>
            <TabsTrigger value="history">History ({pastBookings.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending">
            <div className="grid gap-4">
              {pendingBookings.length > 0 ? pendingBookings.map(renderBookingCard) : <p className="text-center text-slate-500 py-8">No pending booking requests.</p>}
            </div>
          </TabsContent>
          <TabsContent value="upcoming">
             <div className="grid gap-4">
              {confirmedBookings.length > 0 ? confirmedBookings.map(renderBookingCard) : <p className="text-center text-slate-500 py-8">You have no upcoming sessions.</p>}
            </div>
          </TabsContent>
          <TabsContent value="history">
             <div className="grid gap-4">
              {pastBookings.length > 0 ? pastBookings.map(renderBookingCard) : <p className="text-center text-slate-500 py-8">No past sessions found.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <DeclineBookingModal
        isOpen={!!bookingToDecline}
        onClose={() => setBookingToDecline(null)}
        onSubmit={(reason) => handleDeclineBooking(bookingToDecline.id, reason)}
      />
    </div>
  );
}