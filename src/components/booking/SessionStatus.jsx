import { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { CheckCircle, Clock, AlertTriangle, MapPin, Calendar, User } from 'lucide-react';
import { Booking } from '../../api/entities';

export default function SessionStatus({ booking, currentUser, onBookingUpdate }) {
  const [isLoading, setIsLoading] = useState(false);
  const [showEarlyCompleteDialog, setShowEarlyCompleteDialog] = useState(false);
  const [earlyReason, setEarlyReason] = useState('');
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  const isClient = booking.client_id === currentUser.id;
  const isCoach = booking.coach_id === currentUser.id;
  const userRole = isClient ? 'client' : 'coach';

  const handleArrival = async () => {
    setIsLoading(true);
    try {
      const updatedBooking = await Booking.markArrival(booking.id, currentUser.id, userRole);
      onBookingUpdate(updatedBooking);
    } catch (error) {
      console.error('Failed to mark arrival:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSessionComplete = async (reason = null) => {
    setIsLoading(true);
    try {
      const updatedBooking = await Booking.markSessionComplete(booking.id, currentUser.id, userRole, reason);
      onBookingUpdate(updatedBooking);
      setShowEarlyCompleteDialog(false);
      setEarlyReason('');
    } catch (error) {
      console.error('Failed to complete session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) return;
    
    setIsLoading(true);
    try {
      await Booking.initiateDispute(booking.id, currentUser.id, disputeReason);
      const updatedBooking = await Booking.get(booking.id);
      onBookingUpdate(updatedBooking);
      setShowDisputeDialog(false);
      setDisputeReason('');
    } catch (error) {
      console.error('Failed to initiate dispute:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isEarlyCompletion = () => {
    if (!booking.session_started_at) return false;
    const sessionStart = new Date(booking.session_started_at);
    const expectedEnd = new Date(sessionStart.getTime() + (booking.duration * 60 * 60 * 1000));
    return new Date() < expectedEnd;
  };

  const getSessionStatus = () => {
    if (booking.status === 'completed') return 'completed';
    if (booking.status === 'in_session') return 'in_session';
    if (booking.session_started_at) return 'in_session';
    if (booking.client_arrived_at || booking.coach_arrived_at) return 'arrival_pending';
    if (booking.status === 'confirmed') return 'confirmed';
    return booking.status;
  };

  const sessionStatus = getSessionStatus();

  const getStatusBadge = () => {
    switch (sessionStatus) {
      case 'confirmed':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Confirmed</Badge>;
      case 'arrival_pending':
        return <Badge variant="secondary"><MapPin className="w-3 h-3 mr-1" />Arrival Pending</Badge>;
      case 'in_session':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />In Session</Badge>;
      case 'completed':
        return <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'disputed':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Disputed</Badge>;
      default:
        return <Badge variant="outline">{booking.status}</Badge>;
    }
  };

  const canMarkArrival = () => {
    return sessionStatus === 'confirmed' && 
           ((isClient && !booking.client_arrived_at) || (isCoach && !booking.coach_arrived_at));
  };

  const canCompleteSession = () => {
    return sessionStatus === 'in_session' && 
           ((isClient && !booking.client_completed_at) || (isCoach && !booking.coach_completed_at));
  };

  const canDispute = () => {
    return ['completed', 'in_session'].includes(sessionStatus) && !booking.dispute_status;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Session Status</CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Session Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>{new Date(booking.session_date).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>{booking.session_time} ({booking.duration}h)</span>
          </div>
        </div>

        {/* Arrival Status */}
        {sessionStatus !== 'completed' && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Arrival Status:</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <User className="w-3 h-3" />
                <span>Client: {booking.client_arrived_at ? '✅ Arrived' : '⏳ Pending'}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-3 h-3" />
                <span>Coach: {booking.coach_arrived_at ? '✅ Arrived' : '⏳ Pending'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Completion Status */}
        {sessionStatus === 'in_session' && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Completion Status:</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <User className="w-3 h-3" />
                <span>Client: {booking.client_completed_at ? '✅ Completed' : '⏳ Pending'}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-3 h-3" />
                <span>Coach: {booking.coach_completed_at ? '✅ Completed' : '⏳ Pending'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {canMarkArrival() && (
            <Button 
              onClick={handleArrival} 
              disabled={isLoading}
              size="sm"
              className="flex-1"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Mark Arrival
            </Button>
          )}

          {canCompleteSession() && (
            <Button 
              onClick={isEarlyCompletion() ? () => setShowEarlyCompleteDialog(true) : () => handleSessionComplete()}
              disabled={isLoading}
              size="sm"
              className="flex-1"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Session
            </Button>
          )}

          {canDispute() && (
            <Dialog open={showDisputeDialog} onOpenChange={setShowDisputeDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Report Issue
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Report Session Issue</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Please describe the issue with this session. This will initiate a dispute process.
                  </p>
                  <Textarea
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder="Describe the issue..."
                    rows={4}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDisputeDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleDispute} 
                    disabled={!disputeReason.trim() || isLoading}
                  >
                    Submit Issue
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Early Completion Dialog */}
        <Dialog open={showEarlyCompleteDialog} onOpenChange={setShowEarlyCompleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Early Session Completion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                You are completing this session before the scheduled end time. Please provide a reason.
              </p>
              <Textarea
                value={earlyReason}
                onChange={(e) => setEarlyReason(e.target.value)}
                placeholder="Reason for early completion..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEarlyCompleteDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => handleSessionComplete(earlyReason)} 
                disabled={!earlyReason.trim() || isLoading}
              >
                Complete Early
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment Status */}
        {booking.payment_status && booking.payment_status !== 'pending' && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span>Payment Status:</span>
              <Badge variant={booking.payment_status === 'released' ? 'success' : 'secondary'}>
                {booking.payment_status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            {booking.payment_held_until && (
              <p className="text-xs text-slate-500 mt-1">
                Funds release: {new Date(booking.payment_held_until).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}