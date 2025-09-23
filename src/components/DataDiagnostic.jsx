import { useEffect, useState } from 'react';
import { User } from '@/api/entities.jsx';
import { Booking } from '@/api/entities.jsx';
import { Message } from '@/api/entities.jsx';

export default function DataDiagnostic() {
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const allUsers = await User.list();
        const allBookings = await Booking.list();
        const allMessages = await Message.filter({}, '-created_date');
        
        setUsers(allUsers);
        setBookings(allBookings);
        setMessages(allMessages);
        
        console.log('=== DIAGNOSTIC DATA ===');
        console.log('Users:', allUsers);
        console.log('Bookings:', allBookings);
        console.log('Messages:', allMessages);
        
        // Analyze user data
        console.log('\n=== USER ANALYSIS ===');
        allUsers.forEach(user => {
          console.log(`User ${user.id}:`, {
            name: user.full_name,
            email: user.email,
            user_type: user.user_type,
            role: user.role,
            is_active: user.is_active
          });
        });
        
        // Analyze booking data
        console.log('\n=== BOOKING ANALYSIS ===');
        allBookings.forEach(booking => {
          console.log(`Booking ${booking.id}:`, {
            status: booking.status,
            client_id: booking.client_id,
            coach_id: booking.coach_id,
            user_id: booking.user_id,
            service_type: booking.service_type,
            session_date: booking.session_date,
            created_at: booking.created_at
          });
        });

        // Analyze message data
        console.log('\n=== MESSAGE ANALYSIS ===');
        allMessages.forEach(message => {
          console.log(`Message ${message.id}:`, {
            booking_id: message.booking_id,
            sender_id: message.sender_id,
            receiver_id: message.receiver_id,
            message: message.content?.substring(0, 50) + '...' || 'No content',
            created_date: message.created_date
          });
        });

        // Count stats
        const coaches = allUsers.filter(u => u.user_type === "coach" && u.role !== "admin");
        const clients = allUsers.filter(u => u.user_type === "client" && u.role !== "admin");
        
        console.log('\n=== STATS ===');
        console.log('Total coaches (excluding admins):', coaches.length);
        console.log('Total clients (excluding admins):', clients.length);
        console.log('Total bookings:', allBookings.length);
        console.log('Total messages:', allMessages.length);
        
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  if (loading) return <div>Loading diagnostic data...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Database Diagnostic</h1>
      
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Users ({users.length})</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {users.map(user => (
              <div key={user.id} className="text-sm border-b pb-2">
                <div className="font-medium">{user.full_name || 'No name'}</div>
                <div className="text-gray-600">{user.email}</div>
                <div className="flex gap-2 text-xs">
                  <span className={`px-2 py-1 rounded ${user.user_type === 'coach' ? 'bg-blue-100 text-blue-800' : user.user_type === 'client' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    Type: {user.user_type || 'undefined'}
                  </span>
                  <span className={`px-2 py-1 rounded ${user.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                    Role: {user.role || 'undefined'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Bookings ({bookings.length})</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {bookings.map(booking => (
              <div key={booking.id} className="text-sm border-b pb-2">
                <div className="font-medium">Booking #{booking.id}</div>
                <div className="text-gray-600">
                  Status: <span className={`px-2 py-1 rounded text-xs ${
                    booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                    booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {booking.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Client: {booking.client_id} | Coach: {booking.coach_id}
                </div>
                <div className="text-xs text-gray-500">
                  User: {booking.user_id} | Service: {booking.service_type}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Messages ({messages.length})</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {messages.map(message => (
              <div key={message.id} className="text-sm border-b pb-2">
                <div className="font-medium">Message #{message.id}</div>
                <div className="text-gray-600">
                  Booking: {message.booking_id}
                </div>
                <div className="text-xs text-gray-500">
                  From: {message.sender_id} | To: {message.receiver_id}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {message.message.substring(0, 30)}...
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800">Expected Data Structure:</h3>
        <div className="text-sm text-blue-700 mt-2">
          <p><strong>Users should have:</strong></p>
          <ul className="list-disc list-inside ml-4">
            <li><code>user_type</code>: "coach" or "client"</li>
            <li><code>role</code>: "user" (for regular users) or "admin" (for admins)</li>
            <li><code>full_name</code>: User's display name</li>
            <li><code>email</code>: User's email</li>
          </ul>
          <p className="mt-2"><strong>Bookings should have:</strong></p>
          <ul className="list-disc list-inside ml-4">
            <li><code>status</code>: "pending", "confirmed", "cancelled", or "completed"</li>
            <li><code>client_id</code> and <code>coach_id</code>: References to user profiles</li>
            <li><code>user_id</code>: Should match client_id (legacy field)</li>
          </ul>
          <p className="mt-2"><strong>Messages should have:</strong></p>
          <ul className="list-disc list-inside ml-4">
            <li><code>booking_id</code>: Reference to booking</li>
            <li><code>sender_id</code> and <code>receiver_id</code>: User IDs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
