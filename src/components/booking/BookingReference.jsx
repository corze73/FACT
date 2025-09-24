import { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Copy, Search, Ticket, CheckCircle } from 'lucide-react';
import { formatBookingReference } from '../../utils/booking-reference';
import { toast } from 'sonner';

/**
 * Display booking reference with copy functionality
 */
export const BookingReference = ({ reference, className = "" }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      toast.success('Booking reference copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy reference');
    }
  };

  if (!reference) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant="outline" className="font-mono text-sm">
        <Ticket className="w-3 h-3 mr-1" />
        {formatBookingReference(reference)}
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-6 w-6 p-0"
      >
        {copied ? (
          <CheckCircle className="w-3 h-3 text-green-600" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </Button>
    </div>
  );
};

/**
 * Admin search component for booking references
 */
export const BookingReferenceSearch = ({ onBookingFound, onError }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    try {
      const { Booking } = await import('../../api/entities.jsx');
      const results = await Booking.searchByReference(searchTerm.trim());
      setSearchResults(results);
      
      if (results.length === 0) {
        toast.error('No bookings found with that reference');
      } else if (results.length === 1) {
        onBookingFound?.(results[0]);
      } else {
        toast.success(`Found ${results.length} matching bookings`);
      }
    } catch (error) {
      console.error('Search error:', error);
      onError?.(error);
      toast.error('Search failed: ' + error.message);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          Search Booking Reference
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter booking reference (e.g., FACT-20250924-A7B2)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="font-mono"
            />
            <Button type="submit" disabled={isSearching}>
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>
          
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Search Results:</h4>
              {searchResults.map((booking) => (
                <div
                  key={booking.id}
                  className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                  onClick={() => onBookingFound?.(booking)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <BookingReference reference={booking.reference_code} />
                      <p className="text-sm text-gray-600 mt-1">
                        {booking.service_type} • {booking.session_date} • £{booking.total_price}
                      </p>
                    </div>
                    <Badge variant={booking.status === 'completed' ? 'default' : 'secondary'}>
                      {booking.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

/**
 * Booking reference info card for customer support
 */
export const BookingReferenceCard = ({ booking }) => {
  if (!booking) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="w-5 h-5" />
          Booking Reference
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <BookingReference reference={booking.reference_code} className="text-lg" />
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Status:</span>
              <Badge className="ml-2" variant={booking.status === 'completed' ? 'default' : 'secondary'}>
                {booking.status}
              </Badge>
            </div>
            <div>
              <span className="font-medium">Payment:</span>
              <Badge className="ml-2" variant={booking.payment_status === 'released' ? 'default' : 'secondary'}>
                {booking.payment_status}
              </Badge>
            </div>
            <div>
              <span className="font-medium">Service:</span>
              <span className="ml-2">{booking.service_type}</span>
            </div>
            <div>
              <span className="font-medium">Amount:</span>
              <span className="ml-2">£{booking.total_price}</span>
            </div>
          </div>
          
          <div className="pt-2 border-t text-xs text-gray-500">
            <p>Created: {new Date(booking.created_at).toLocaleDateString()}</p>
            <p>Use this reference for customer support inquiries</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};