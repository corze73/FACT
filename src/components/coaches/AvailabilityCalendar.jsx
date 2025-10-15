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
import { Calendar as CalendarIcon, MapPin, Plus, Trash2, Edit2 } from "lucide-react";
import { motion } from "framer-motion";

export default function AvailabilityCalendar({ coachId, isReadOnly = false }) {
  const [availabilities, setAvailabilities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState(null);

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

  if (isLoading) {
    return <div className="p-8 text-center">Loading availability...</div>;
  }

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
          Manage your availability and temporary location changes when traveling
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {availabilities.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No availability periods set</p>
              {!isReadOnly && (
                <p className="text-sm mt-2">Add periods to indicate when you&apos;re traveling or unavailable</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {availabilities.map((avail) => (
                <motion.div
                  key={avail.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 border rounded-lg ${isCurrentlyActive(avail) ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={avail.is_available ? "default" : "secondary"}>
                          {avail.is_available ? 'Available' : 'Unavailable'}
                        </Badge>
                        {isCurrentlyActive(avail) && (
                          <Badge className="bg-blue-600">Active Now</Badge>
                        )}
                      </div>
                      <p className="font-medium text-slate-900">
                        {formatDateRange(avail.start_date, avail.end_date)}
                      </p>
                      {avail.location_override && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                          <MapPin className="w-4 h-4" />
                          <span>{avail.location_override}</span>
                        </div>
                      )}
                      {avail.notes && (
                        <p className="text-sm text-slate-600 mt-2">{avail.notes}</p>
                      )}
                    </div>
                    {!isReadOnly && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(avail)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(avail.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
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
