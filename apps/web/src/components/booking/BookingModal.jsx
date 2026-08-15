import { useEffect, useMemo, useState } from "react";
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
import { calculatePaymentBreakdown } from "../../utils/payment";
import { bookingSchema, formatValidationErrors, safeValidate } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rateLimiter";
import { alertToast } from "@/utils/notifications";
import { createPageUrl } from "@/utils";
import { POLICY_VERSION } from "@/lib/policyConstants";
import { CoachAvailability, CoachRecurringAvailability } from "@/api/entities.jsx";
import {
  buildAvailableTimeSlots,
  calculateSessionPrice,
  getCoachHourlyRate,
  isCoachDateAvailable,
} from "@/utils/bookingAvailability";

const DEFAULT_SERVICE_TYPE = '1-to-1 Football Coaching';

export default function BookingModal({ isOpen, onClose, coach, onSubmit }) {
  const hourlyRate = getCoachHourlyRate(coach);
  const initialSessionPrice = calculateSessionPrice(hourlyRate, 60);
  const paymentBreakdown = calculatePaymentBreakdown(initialSessionPrice);
  const serviceTypes = useMemo(() => {
    const coachServices = coach?.services_offered ?? coach?.coach_profile?.services_offered ?? [];
    const normalizedServices = Array.isArray(coachServices)
      ? coachServices.filter((service) => typeof service === 'string' && service.trim())
      : [];

    return normalizedServices.length > 0 ? normalizedServices : [DEFAULT_SERVICE_TYPE];
  }, [coach]);
  
  const [bookingData, setBookingData] = useState({
    service_type: serviceTypes[0] || DEFAULT_SERVICE_TYPE,
    session_date: null,
    session_time: '',
    duration: 60,
    location: {
      type: 'online',
      address: '',
      notes: ''
    },
    client_notes: '',
    price: initialSessionPrice,
    admin_fee: paymentBreakdown.adminFee,
    total_price: paymentBreakdown.totalAmount
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [recurringAvailability, setRecurringAvailability] = useState([]);
  const [dateAvailability, setDateAvailability] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const sessionPrice = calculateSessionPrice(hourlyRate, 60);
    const breakdown = calculatePaymentBreakdown(sessionPrice);
    setBookingData((prev) => ({
      ...prev,
      service_type: serviceTypes[0] || DEFAULT_SERVICE_TYPE,
      session_date: null,
      session_time: '',
      duration: 60,
      price: sessionPrice,
      admin_fee: breakdown.adminFee,
      total_price: breakdown.totalAmount,
    }));
    setPolicyAccepted(false);
    setValidationErrors({});
  }, [hourlyRate, isOpen, serviceTypes]);

  useEffect(() => {
    if (!isOpen || !coach?.id) return undefined;

    let cancelled = false;
    setAvailabilityLoading(true);
    setAvailabilityError('');

    Promise.all([
      CoachRecurringAvailability.getByCoachId(coach.id),
      CoachAvailability.getByCoachId(coach.id),
    ])
      .then(([recurring, dated]) => {
        if (cancelled) return;
        setRecurringAvailability(Array.isArray(recurring) ? recurring : []);
        setDateAvailability(Array.isArray(dated) ? dated : []);
      })
      .catch((error) => {
        console.error('Failed to load coach availability:', error);
        if (!cancelled) setAvailabilityError('Coach availability could not be loaded. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [coach?.id, isOpen]);

  const availableTimeSlots = useMemo(() => buildAvailableTimeSlots({
    date: bookingData.session_date,
    durationMinutes: bookingData.duration,
    recurringAvailability,
    dateAvailability,
  }), [bookingData.duration, bookingData.session_date, dateAvailability, recurringAvailability]);

  useEffect(() => {
    if (bookingData.session_time && !availableTimeSlots.includes(bookingData.session_time)) {
      setBookingData((prev) => ({ ...prev, session_time: '' }));
    }
  }, [availableTimeSlots, bookingData.session_time]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationErrors({});
    
    // Check rate limit
    const rateLimitCheck = checkRateLimit('booking');
    if (!rateLimitCheck.allowed) {
      alertToast(`Too many booking attempts. Please wait until ${new Date(rateLimitCheck.resetTime).toLocaleTimeString()}`);
      return;
    }

    if (!bookingData.session_date || !bookingData.session_time) {
      setValidationErrors({
        session_date: ['Please select a date'],
        session_time: ['Please select a time']
      });
      alertToast('Please select a session date and time');
      return;
    }
    if (availabilityLoading || availabilityError || !availableTimeSlots.includes(bookingData.session_time)) {
      alertToast(availabilityError || 'That time is no longer available. Please select another time.');
      return;
    }
    if (!policyAccepted) {
      alertToast('Please accept the cancellation and no-show policy.');
      return;
    }

    // Combine date + time into a single booking_date (ISO string)
    const datePart = format(bookingData.session_date, 'yyyy-MM-dd');
    const bookingDateIso = new Date(`${datePart}T${bookingData.session_time}:00`).toISOString();

    // Prepare data for validation
    const dataToValidate = {
      coach_id: coach?.id,
      service_type: bookingData.service_type,
      booking_date: bookingDateIso,
      duration: bookingData.duration,
      location_type: bookingData.location.type,
      location_address: bookingData.location.address || '',
      client_notes: bookingData.client_notes || '',
      price: bookingData.price,
      admin_fee: bookingData.admin_fee,
      total_price: bookingData.total_price
    };

    // Validate booking data using safeValidate
    const validation = safeValidate(bookingSchema, dataToValidate);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.errors || validation.error);
      setValidationErrors(errors);
      
      // Show first error to user
      const firstError = Object.values(errors)[0];
      alertToast(firstError || 'Please check the form for errors');
      return;
    }

    // Submit validated and sanitized data
    onSubmit({
      ...validation.data,
      location: {
        type: validation.data.location_type,
        address: validation.data.location_address,
        notes: ''
      },
      cancellation_policy_accepted: true,
      policy_version: POLICY_VERSION
    });
  };

  const formatServiceName = (service) => {
    return service.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const isDateDisabled = (date) => {
    const isPast = isBefore(date, new Date()) && !isToday(date);
    return isPast || (!availabilityLoading && !availabilityError && !isCoachDateAvailable(
      date,
      recurringAvailability,
      dateAvailability,
    ));
  };

  const updatePrice = (duration) => {
    const sessionPrice = calculateSessionPrice(hourlyRate, duration);
    const breakdown = calculatePaymentBreakdown(sessionPrice);
    
    setBookingData(prev => ({ 
      ...prev, 
      duration, 
      price: sessionPrice, 
      admin_fee: breakdown.adminFee,
      total_price: breakdown.totalAmount
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
                £{hourlyRate.toFixed(2)}/hour + £{paymentBreakdown.adminFee.toFixed(2)} admin fee
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
              <SelectTrigger className={validationErrors.service_type ? 'border-red-500' : ''}>
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
            {validationErrors.service_type && (
              <p className="text-sm text-red-500">{validationErrors.service_type}</p>
            )}
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Session Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={`w-full justify-start text-left font-normal ${validationErrors.session_date ? 'border-red-500' : ''}`}
                >
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
                  onSelect={(date) => setBookingData(prev => ({ ...prev, session_date: date, session_time: '' }))}
                  disabled={isDateDisabled}
                  fromDate={new Date()}
                  toDate={addDays(new Date(), 90)}
                />
              </PopoverContent>
            </Popover>
            {validationErrors.session_date && (
              <p className="text-sm text-red-500">{validationErrors.session_date}</p>
            )}
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <Label>Session Time *</Label>
            <Select
              value={bookingData.session_time}
              onValueChange={(value) => setBookingData(prev => ({ ...prev, session_time: value }))}
              disabled={!bookingData.session_date || availabilityLoading || Boolean(availabilityError) || availableTimeSlots.length === 0}
            >
              <SelectTrigger className={validationErrors.session_time ? 'border-red-500' : ''}>
                <SelectValue placeholder={availabilityLoading ? 'Loading times...' : 'Select time'} />
              </SelectTrigger>
              <SelectContent>
                {availableTimeSlots.map((time) => (
                  <SelectItem key={time} value={time}>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {time}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {validationErrors.session_time && (
              <p className="text-sm text-red-500">{validationErrors.session_time}</p>
            )}
            {availabilityError && <p className="text-sm text-red-500">{availabilityError}</p>}
            {!availabilityLoading && !availabilityError && bookingData.session_date && availableTimeSlots.length === 0 && (
              <p className="text-sm text-slate-500">No times are available on this date for the selected duration.</p>
            )}
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
                className={validationErrors.location_address ? 'border-red-500' : ''}
              />
              {validationErrors.location_address && (
                <p className="text-sm text-red-500">{validationErrors.location_address}</p>
              )}
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
              className={validationErrors.client_notes ? 'border-red-500' : ''}
            />
            {validationErrors.client_notes && (
              <p className="text-sm text-red-500">{validationErrors.client_notes}</p>
            )}
          </div>

          {/* Price Summary */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Session ({bookingData.duration} mins):</span>
                <span>£{Number(bookingData.price).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Administration fee:</span>
                <span>£{Number(bookingData.admin_fee).toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between items-center font-bold">
                <span>Total:</span>
                <span className="text-2xl text-blue-600">£{Number(bookingData.total_price).toFixed(2)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
              <CreditCard className="w-3 h-3" />
              Secure payment powered by Stripe
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm">
            <input type="checkbox" className="mt-1" checked={policyAccepted} onChange={(event) => setPolicyAccepted(event.target.checked)} />
            <span>
              I accept the <a href={createPageUrl('Terms')} target="_blank" rel="noreferrer" className="text-blue-600 underline">cancellation and no-show policy</a>: coach cancellations receive a full refund; client cancellations at least 48 hours before receive the coaching fee back but not the £3 administration fee; 24–48 hours receive 50% of the coaching fee; under 24 hours receive no refund.
            </span>
          </label>

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
