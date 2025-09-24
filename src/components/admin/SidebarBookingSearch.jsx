import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import { Search, Ticket, ExternalLink, X } from 'lucide-react';
import { Badge } from '../ui/badge';
import { formatBookingReference } from '../../utils/booking-reference';
import { toast } from 'sonner';

/**
 * Compact sidebar search for booking references
 * Always visible in admin sidebar for quick lookup
 */
export const SidebarBookingSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    try {
      const { Booking } = await import('../../api/entities.jsx');
      const results = await Booking.searchByReference(searchTerm.trim());
      setSearchResults(results);
      setIsExpanded(true);
      
      if (results.length === 0) {
        toast.error(`No bookings found for "${searchTerm}"`);
      } else if (results.length === 1) {
        // Auto-select single result and show details
        setSelectedBooking(results[0]);
        toast.success(`Found booking ${results[0].reference_code}`);
      } else {
        toast.success(`Found ${results.length} matching bookings`);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search bookings. Please try again.');
      setSearchResults([]);
      setIsExpanded(false);
    } finally {
      setIsSearching(false);
    }
  };

  const handleBookingSelect = (booking) => {
    setSelectedBooking(booking);
    setIsExpanded(false);
    setSearchTerm('');
    setSearchResults([]);
    toast.success(`Viewing details for ${booking.reference_code}`);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setIsExpanded(false);
    setSelectedBooking(null);
  };

  return (
    <div className="space-y-2">
      <div className="px-3 py-2">
        <form onSubmit={handleSearch} className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search booking ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 text-sm h-9"
            />
            {searchTerm && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="absolute right-1 top-1 h-7 w-7 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          <Button 
            type="submit" 
            disabled={isSearching || !searchTerm.trim()}
            size="sm"
            className="w-full h-8 text-xs"
          >
            <Ticket className="w-3 h-3 mr-1" />
            {isSearching ? 'Searching...' : 'Find Booking'}
          </Button>
        </form>
      </div>

      {/* Selected Booking Details */}
      {selectedBooking && (
        <SidebarBookingInfo 
          booking={selectedBooking} 
          onClose={() => setSelectedBooking(null)}
        />
      )}

      {/* Expanded search results */}
      {isExpanded && searchResults.length > 0 && (
        <Card className="mx-2 mb-2">
          <CardContent className="p-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                {searchResults.length} Result{searchResults.length !== 1 ? 's' : ''}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="h-5 w-5 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {searchResults.map((booking) => (
                <div
                  key={booking.id}
                  className="p-2 rounded border border-blue-200 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 group"
                  onClick={() => handleBookingSelect(booking)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <code className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {formatBookingReference(booking.reference_code)}
                    </code>
                    <Badge variant={booking.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                      {booking.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-600 font-medium">
                    {booking.service_type?.replace(/_/g, ' ')} • £{booking.total_price || booking.price}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">
                      {booking.session_date || new Date(booking.created_at).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs text-blue-600">View Details</span>
                      <ExternalLink className="h-3 w-3 text-blue-600" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

/**
 * Quick booking info display for sidebar
 */
export const SidebarBookingInfo = ({ booking, onClose }) => {
  if (!booking) return null;

  const handleViewFullDetails = () => {
    // Navigate to admin bookings with this booking highlighted
    window.location.href = `/AdminBookings?highlight=${booking.id}`;
  };

  const handleOpenChat = () => {
    // Navigate to conversation for this booking
    window.location.href = `/Conversation?booking_id=${booking.id}`;
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800'
    };
    return colors[status] || 'bg-slate-100 text-slate-800';
  };

  return (
    <Card className="mx-2 mb-2 border-blue-200 bg-blue-50/30">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-sm text-blue-700">Booking Details</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 hover:bg-blue-100"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="space-y-3">
          {/* Reference Code */}
          <div className="bg-white border border-blue-200 rounded-md p-2">
            <code className="text-sm font-mono text-blue-700 block text-center">
              {formatBookingReference(booking.reference_code)}
            </code>
          </div>

          {/* Service Type */}
          <div className="text-sm">
            <span className="font-medium text-slate-700">
              {booking.service_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>
          
          {/* Status and Amount */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500 block">Status:</span>
              <Badge className={`text-xs mt-1 ${getStatusColor(booking.status)}`}>
                {booking.status}
              </Badge>
            </div>
            <div>
              <span className="text-slate-500 block">Amount:</span>
              <span className="font-semibold text-green-700 mt-1 block">
                £{booking.total_price || booking.price}
              </span>
            </div>
          </div>
          
          {/* Date and Time */}
          <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
            <div>📅 {booking.session_date || new Date(booking.created_at).toLocaleDateString()}</div>
            {booking.session_time && (
              <div className="mt-1">🕐 {booking.session_time}</div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewFullDetails}
              className="flex-1 h-8 text-xs"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              View Full
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenChat}
              className="flex-1 h-8 text-xs"
            >
              💬 Chat
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};