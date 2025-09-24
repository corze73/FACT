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
export const SidebarBookingSearch = ({ onBookingFound }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);

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
        toast.error('No bookings found');
      } else if (results.length === 1) {
        // Auto-select single result
        onBookingFound?.(results[0]);
        toast.success(`Found booking ${results[0].reference_code}`);
      } else {
        toast.success(`Found ${results.length} bookings`);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleBookingSelect = (booking) => {
    onBookingFound?.(booking);
    setIsExpanded(false);
    setSearchTerm('');
    setSearchResults([]);
    toast.success(`Selected booking ${booking.reference_code}`);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setIsExpanded(false);
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
                  className="p-2 rounded border cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleBookingSelect(booking)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <code className="text-xs font-mono bg-gray-100 px-1 rounded">
                      {formatBookingReference(booking.reference_code)}
                    </code>
                    <Badge variant={booking.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                      {booking.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-600">
                    {booking.service_type?.replace(/_/g, ' ')} • £{booking.total_price || booking.price}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">
                      {booking.session_date || new Date(booking.created_at).toLocaleDateString()}
                    </span>
                    <ExternalLink className="h-3 w-3 text-gray-400" />
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

  return (
    <Card className="mx-2 mb-2">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-sm">Selected Booking</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="space-y-2">
          <code className="text-sm font-mono bg-blue-50 px-2 py-1 rounded block">
            {formatBookingReference(booking.reference_code)}
          </code>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Status:</span>
              <Badge className="ml-1 text-xs" variant={booking.status === 'completed' ? 'default' : 'secondary'}>
                {booking.status}
              </Badge>
            </div>
            <div>
              <span className="text-gray-500">Amount:</span>
              <span className="ml-1 font-medium">£{booking.total_price || booking.price}</span>
            </div>
          </div>
          
          <div className="text-xs text-gray-600">
            {booking.service_type?.replace(/_/g, ' ')}
          </div>
          
          <div className="text-xs text-gray-500">
            {booking.session_date || new Date(booking.created_at).toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};