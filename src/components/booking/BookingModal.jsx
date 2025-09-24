import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addDays, isToday, isBefore } from "date-fns";
import { CalendarIcon, Clock, CreditCard } from "lucide-react";
import { calculatePaymentBreakdown, getAdminFee } from "../../utils/payment";

export default function BookingModal({ isOpen, onClose, coach, onSubmit }) {
  const servicePrice = coach?.coach_profile?.hourly_rate || 50;
  const paymentBreakdown = calculatePaymentBreakdown(servicePrice);
  
  const [bookingData, setBookingData] = useState({
    service_type: '',
    session_date: null,
    session_time: '',
    duration: 60,
    location: {
      type: 'online',
      address: '',
      notes: ''
    },
    client_notes: '',
    price: servicePrice,
    admin_fee: paymentBreakdown.adminFee,
    total_price: paymentBreakdown.totalAmount
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!bookingData.session_date || !bookingData.session_time || !bookingData.service_type) {
      alert('Please fill in all required fields');
      return;
    }

    onSubmit({
      ...bookingData,
      session_date: format(bookingData.session_date, 'yyyy-MM-dd')
    });
  };

  const timeSlots = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', 
    '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
  ];

  const serviceTypes = coach?.coach_profile?.services_offered || [];

  const formatServiceName = (service) => {
    return service.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const isDateDisabled = (date) => {
    return isBefore(date, new Date()) && !isToday(date);
  };

  const updatePrice = (duration) => {
    const rate = coach?.coach_profile?.hourly_rate || 0;
    const sessionPrice = rate; // Use full hourly rate regardless of duration for simplicity
    const adminFee = 3;
    const totalPrice = sessionPrice + adminFee;
    
    setBookingData(prev => ({ 
      ...prev, 
      duration, 
      price: sessionPrice, 
      admin_fee: adminFee,
      total_price: totalPrice
    }));
  };

  if (!coach) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">
                {coach.full_name?.charAt(0) || 'C'}
              </span>
            </div>
            <div>
              <h3 className="font-bold">Book with {coach.full_name}</h3>
              <p className="text-sm text-slate-600 font-normal">
                £{coach.coach_profile?.hourly_rate}/hour + £3 admin fee
              </p>
            </div>
          </DialogTitle>
          <DialogDescription>
            Fill out the form below to book a coaching session with {coach.full_name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Service Type */}
          <div className="space-y-2">
            <Label>Service Type *</Label>
            <Select
              value={bookingData.service_type}
              onValueChange={(value) => setBookingData(prev => ({ ...prev, service_type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a service" />
              </SelectTrigger>
              <SelectContent>
                {serviceTypes.map((service) => (
                  <SelectItem key={service} value={service}>
                    {formatServiceName(service)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Session Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {bookingData.session_date ? 
                    format(bookingData.session_date, "PPP") : 
                    "Select a date"
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={bookingData.session_date}
                  onSelect={(date) => setBookingData(prev => ({ ...prev, session_date: date }))}
                  disabled={isDateDisabled}
                  fromDate={new Date()}
                  toDate={addDays(new Date(), 90)}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <Label>Session Time *</Label>
            <Select
              value={bookingData.session_time}
              onValueChange={(value) => setBookingData(prev => ({ ...prev, session_time: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                {timeSlots.map((time) => (
                  <SelectItem key={time} value={time}>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {time}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Select
              value={bookingData.duration.toString()}
              onValueChange={(value) => updatePrice(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
                <SelectItem value="90">90 minutes</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Location Type */}
          <div className="space-y-2">
            <Label>Session Location</Label>
            <Select
              value={bookingData.location.type}
              onValueChange={(value) => setBookingData(prev => ({ 
                ...prev, 
                location: { ...prev.location, type: value } 
              }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online Session</SelectItem>
                <SelectItem value="client_home">My Home</SelectItem>
                <SelectItem value="coach_location">Coach&apos;s Location</SelectItem>
                <SelectItem value="gym">Gym/Fitness Center</SelectItem>
                <SelectItem value="outdoor">Outdoor Location</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Location Address (if not online) */}
          {bookingData.location.type !== 'online' && (
            <div className="space-y-2">
              <Label>Address/Location Details</Label>
              <Input
                placeholder="Enter specific address or location"
                value={bookingData.location.address}
                onChange={(e) => setBookingData(prev => ({
                  ...prev,
                  location: { ...prev.location, address: e.target.value }
                }))}
              />
            </div>
          )}

          {/* Client Notes */}
          <div className="space-y-2">
            <Label>Special Requests or Notes</Label>
            <Textarea
              placeholder="Any specific goals, requirements, or information for your coach..."
              value={bookingData.client_notes}
              onChange={(e) => setBookingData(prev => ({ ...prev, client_notes: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Price Summary */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Session ({bookingData.duration} mins):</span>
                <span>£{bookingData.price}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Administration fee:</span>
                <span>£{bookingData.admin_fee}</span>
              </div>
              <div className="border-t pt-2 flex justify-between items-center font-bold">
                <span>Total:</span>
                <span className="text-2xl text-blue-600">£{bookingData.total_price}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
              <CreditCard className="w-3 h-3" />
              Secure payment powered by Stripe
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Send Booking Request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}