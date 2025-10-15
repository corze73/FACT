import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CoachAvailability } from "@/api/entities.jsx";
import { Calendar as CalendarIcon, MapPin, Plus, Trash2, Edit2, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function AvailabilityCalendar({ coachId, isReadOnly = false }) {
  const [availabilities, setAvailabilities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Form state
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [locationOverride, setLocationOverride] = useState("");
  const [notes, setNotes] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    if (coachId) {
      loadAvailabilities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachId]);

  const loadAvailabilities = async () => {
    try {
      setIsLoading(true);
      const data = await CoachAvailability.getByCoachId(coachId);
      setAvailabilities(data);
    } catch (error) {
      console.error("Failed to load availabilities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingAvailability(null);
    setDateRange({ from: null, to: null });
    setLocationOverride("");
    setNotes("");
    setIsAvailable(true);
    setShowAddModal(true);
  };

  const handleEdit = (availability) => {
    setEditingAvailability(availability);
    setDateRange({
      from: new Date(availability.start_date),
      to: new Date(availability.end_date)
    });
    setLocationOverride(availability.location_override || "");
    setNotes(availability.notes || "");
    setIsAvailable(availability.is_available);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!dateRange.from || !dateRange.to) {
      alert("Please select a date range");
      return;
    }

    try {
      const data = {
        coach_id: coachId,
        start_date: dateRange.from.toISOString(),
        end_date: dateRange.to.toISOString(),
        location_override: locationOverride || null,
        notes: notes || null,
        is_available: isAvailable
      };

      if (editingAvailability) {
        await CoachAvailability.update(editingAvailability.id, data);
      } else {
        await CoachAvailability.create(data);
      }

      await loadAvailabilities();
      setShowAddModal(false);
    } catch (error) {
      console.error("Failed to save availability:", error);
      alert("Failed to save availability");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this availability period?")) {
      return;
    }

    try {
      await CoachAvailability.delete(id);
      await loadAvailabilities();
    } catch (error) {
      console.error("Failed to delete availability:", error);
      alert("Failed to delete availability");
    }
  };

  const formatDateRange = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} - ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  const isCurrentlyActive = (availability) => {
    const now = new Date();
    return new Date(availability.start_date) <= now && new Date(availability.end_date) >= now;
  };

  // Get availability for a specific date
  const getAvailabilityForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return availabilities.find(avail => {
      const start = new Date(avail.start_date).toISOString().split('T')[0];
      const end = new Date(avail.end_date).toISOString().split('T')[0];
      return dateStr >= start && dateStr <= end;
    });
  };

  // Generate calendar days for current month
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty slots for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days in month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDateClick = (date) => {
    if (isReadOnly) return;
    
    const existingAvail = getAvailabilityForDate(date);
    if (existingAvail) {
      handleEdit(existingAvail);
    } else {
      // Start creating new availability period with clicked date
      setEditingAvailability(null);
      setDateRange({ from: date, to: date });
      setLocationOverride("");
      setNotes("");
      setIsAvailable(true);
      setShowAddModal(true);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading availability...</div>;
  }

  const calendarDays = generateCalendarDays();
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Availability & Location Calendar
          </CardTitle>
          {!isReadOnly && (
            <Button onClick={handleAdd} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Period
            </Button>
          )}
        </div>
        <p className="text-sm text-slate-600 mt-2">
          {isReadOnly 
            ? 'View availability and location when traveling' 
            : 'Click on any date to set your availability and location'
          }
        </p>
      </CardHeader>
      <CardContent>
        {/* Calendar Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="sm" onClick={previousMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="font-semibold text-lg">{monthName}</h3>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="mb-6">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-semibold text-slate-600 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }

              const availability = getAvailabilityForDate(date);
              const isPast = date < today;
              const isToday = date.toDateString() === today.toDateString();

              return (
                <TooltipProvider key={index}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.div
                        whileHover={!isReadOnly && !isPast ? { scale: 1.05 } : {}}
                        className={`
                          aspect-square p-2 rounded-lg border-2 flex flex-col items-center justify-center
                          transition-all cursor-pointer relative
                          ${isPast ? 'opacity-40 cursor-not-allowed' : ''}
                          ${isToday ? 'border-blue-500 font-bold' : 'border-slate-200'}
                          ${availability?.is_available === false 
                            ? 'bg-red-100 border-red-300' 
                            : availability?.location_override 
                            ? 'bg-green-100 border-green-300' 
                            : availability 
                            ? 'bg-blue-100 border-blue-300' 
                            : 'bg-white hover:bg-slate-50'}
                        `}
                        onClick={() => !isPast && handleDateClick(date)}
                      >
                        <span className="text-sm">{date.getDate()}</span>
                        {availability && (
                          <div className="absolute bottom-1 flex gap-1">
                            {availability.location_override && (
                              <MapPin className="w-3 h-3 text-green-700" />
                            )}
                            {!availability.is_available && (
                              <div className="w-2 h-2 bg-red-600 rounded-full" />
                            )}
                          </div>
                        )}
                      </motion.div>
                    </TooltipTrigger>
                    {availability && (
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-1">
                          <p className="font-semibold">
                            {availability.is_available ? 'Available' : 'Unavailable'}
                          </p>
                          {availability.location_override && (
                            <p className="text-sm flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {availability.location_override}
                            </p>
                          )}
                          {availability.notes && (
                            <p className="text-sm text-slate-600">{availability.notes}</p>
                          )}
                        </div>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm mb-6 p-4 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border-2 border-blue-300 bg-blue-100" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border-2 border-green-300 bg-green-100 flex items-center justify-center">
              <MapPin className="w-3 h-3 text-green-700" />
            </div>
            <span>Location Override</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border-2 border-red-300 bg-red-100" />
            <span>Unavailable</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border-2 border-blue-500 bg-white" />
            <span>Today</span>
          </div>
        </div>

        {/* Availability Periods List */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-slate-700">Upcoming Periods</h4>
          {availabilities.length === 0 ? (
            <div className="text-center py-4 text-slate-500">
              <p className="text-sm">No availability periods set</p>
              {!isReadOnly && (
                <p className="text-xs mt-1">Click on calendar dates or use the Add Period button</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {availabilities.map((avail) => (
                <motion.div
                  key={avail.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 border rounded-lg ${isCurrentlyActive(avail) ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={avail.is_available ? "default" : "secondary"} className="text-xs">
                          {avail.is_available ? 'Available' : 'Unavailable'}
                        </Badge>
                        {isCurrentlyActive(avail) && (
                          <Badge className="bg-blue-600 text-xs">Active Now</Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-900">
                        {formatDateRange(avail.start_date, avail.end_date)}
                      </p>
                      {avail.location_override && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-slate-600">
                          <MapPin className="w-3 h-3" />
                          <span>{avail.location_override}</span>
                        </div>
                      )}
                      {avail.notes && (
                        <p className="text-xs text-slate-600 mt-1">{avail.notes}</p>
                      )}
                    </div>
                    {!isReadOnly && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(avail)}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(avail.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingAvailability ? 'Edit Availability Period' : 'Add Availability Period'}
              </DialogTitle>
              <DialogDescription>
                Set your availability status and temporary location when traveling
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Select Date Range</Label>
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  className="rounded-md border mt-2"
                />
              </div>

              <div>
                <Label htmlFor="availability-status">Availability Status</Label>
                <select
                  id="availability-status"
                  value={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.value === 'true')}
                  className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">Available for bookings</option>
                  <option value="false">Unavailable (blocked)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="location-override">Temporary Location (Optional)</Label>
                <Input
                  id="location-override"
                  value={locationOverride}
                  onChange={(e) => setLocationOverride(e.target.value)}
                  placeholder="e.g., Dubai, UAE"
                  className="mt-2"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Set your location when traveling - this will display on your profile
                </p>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Training camp in Dubai"
                  rows={3}
                  className="mt-2"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingAvailability ? 'Update' : 'Add'} Period
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
