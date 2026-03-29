import { useState, useEffect } from 'react';
import { User } from '@/api/entities.jsx';
import { Message } from '@/api/entities.jsx';
import { Booking } from '@/api/entities.jsx';
import { apiClient } from '@/api/apiClient.js';
import { Link } from 'react-router-dom';
import { createPageUrl, isAdminUser } from '@/utils';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

export default function Messages() {
    const [conversations, setConversations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchConversations = async () => {
            try {
                const currentUser = await User.me();
                console.log('Messages: Loading for user:', currentUser.id, currentUser.full_name);

                // Admin: see conversations across all bookings (platform-wide) + direct threads
                if (isAdminUser(currentUser)) {
                    const [allBookings, directThreads] = await Promise.all([
                        Booking.list('-updated_date', 50),
                        apiClient.getDirectThreads()
                    ]);

                    console.log('Admin: All bookings loaded:', allBookings.length);
                    console.log('Admin: Direct threads loaded:', directThreads.length);

                    const bookingIds = allBookings.map(b => b.id);
                    const messages = bookingIds.length
                        ? await Message.filter({ booking_id: { in: bookingIds }}, '-created_date')
                        : [];

                    const lastMessages = {};
                    messages.forEach(msg => {
                        if (!lastMessages[msg.booking_id]) {
                            lastMessages[msg.booking_id] = msg;
                        }
                    });

                    const ids = Array.from(new Set([
                        ...allBookings.flatMap(b => [b.client_id, b.coach_id]),
                        ...directThreads.map(t => t.other_user_id)
                    ]));
                    const users = ids.length ? await User.filter({ id: { in: ids }}) : [];
                    const userMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {});

                    const bookingConvos = allBookings.map(b => {
                        const client = userMap[b.client_id];
                        const coach = userMap[b.coach_id];
                        const last = lastMessages[b.id];
                        return {
                            type: 'booking',
                            booking_id: b.id,
                            direct_user_id: null,
                            other_user_name: `${client?.full_name || 'Client'} ↔ ${coach?.full_name || 'Coach'}`,
                            last_message: last?.content || 'No messages yet',
                            last_message_date: last?.created_date || b.created_date,
                            is_read: true // Admin always sees as read, or doesn't care about read status
                        };
                    });

                    const directConvos = directThreads.map(t => {
                        const other = userMap[t.other_user_id];
                        return {
                            type: 'direct',
                            booking_id: null,
                            direct_user_id: t.other_user_id,
                            other_user_name: other?.full_name || 'User',
                            last_message: t.content,
                            last_message_date: t.created_date,
                            is_read: t.is_read
                        };
                    });

                    const allConvos = [...directConvos, ...bookingConvos].sort(
                        (a, b) => new Date(b.last_message_date) - new Date(a.last_message_date)
                    );

                    setConversations(allConvos);
                    setIsLoading(false);
                    return;
                }

                // Non-admin: conversations based on user's bookings
                // Get bookings where user is either client or coach (server-scoped)
                const [clientBookings, coachBookings] = await Promise.all([
                    Booking.filter({ client_id: currentUser.id }, '-created_at'),
                    Booking.filter({ coach_id: currentUser.id }, '-created_at')
                ]);

                console.log('Filtered bookings:', {
                    client: clientBookings.length,
                    coach: coachBookings.length
                });

                // Combine and deduplicate bookings
                const allBookingsMap = new Map();
                [...clientBookings, ...coachBookings].forEach(booking => {
                    allBookingsMap.set(booking.id, booking);
                });
                const combinedBookings = Array.from(allBookingsMap.values());
                console.log('Combined bookings:', combinedBookings.length, combinedBookings);
                
                const bookingIds = combinedBookings.map(b => b.id);
                console.log('Booking IDs for messages:', bookingIds);
                const messages = bookingIds.length
                    ? await Message.filter({ booking_id: { in: bookingIds }}, '-created_date')
                    : [];
                console.log('Messages loaded:', messages.length);

                const lastMessages = {};
                messages.forEach(msg => {
                    if (!lastMessages[msg.booking_id]) {
                        lastMessages[msg.booking_id] = msg;
                    }
                });

                const convos = combinedBookings.map(booking => {
                    const lastMessage = lastMessages[booking.id];
                    const isClientView = booking.client_id === currentUser.id;
                    const otherName = isClientView
                        ? (booking.coach_name || 'Coach')
                        : (booking.client_name || 'Client');
                    const otherAvatar = isClientView
                        ? booking.coach_avatar
                        : booking.client_avatar;

                    console.log('Processing booking:', booking.id, 'Other user:', otherName, 'Last message:', lastMessage?.content);

                    return {
                        booking_id: booking.id,
                        other_user_name: otherName,
                        other_user_avatar: otherAvatar,
                        last_message: lastMessage?.content || 'Start a conversation',
                        last_message_date: lastMessage?.created_date || booking.created_at,
                        is_read: lastMessage ? (lastMessage.sender_id === currentUser.id || lastMessage.is_read) : true
                    };
                }); // Show all conversations, even without messages

                console.log('Final conversations (booking-based):', convos.length);

                // Also include any direct admin ↔ user threads (no booking)
                let allConvos = convos;
                try {
                    const directThreads = await apiClient.getDirectThreads();
                    console.log('Non-admin: Direct threads loaded:', directThreads.length);
                    if (directThreads.length) {
                        let directUserMap = {};
                        try {
                            const otherIds = Array.from(new Set(directThreads.map(t => t.other_user_id).filter(Boolean)));
                            // This may return 403 for non-admins depending on users endpoint policy.
                            const directUsers = otherIds.length ? await User.filter({ id: { in: otherIds }}) : [];
                            directUserMap = directUsers.reduce((acc, u) => ({ ...acc, [u.id]: u }), {});
                        } catch (err) {
                            console.warn('Direct thread user lookup denied; using fallback labels', err);
                        }

                        const directConvos = directThreads.map(t => {
                            const other = directUserMap[t.other_user_id];
                            return {
                                type: 'direct',
                                booking_id: null,
                                direct_user_id: t.other_user_id,
                                other_user_name: other?.full_name || 'Support Team',
                                other_user_avatar: other?.profile_picture,
                                last_message: t.content,
                                last_message_date: t.created_date,
                                is_read: t.is_read
                            };
                        });

                        allConvos = [...directConvos, ...convos].sort(
                            (a, b) => new Date(b.last_message_date) - new Date(a.last_message_date)
                        );
                    }
                } catch (err) {
                    console.warn('Failed to load direct threads for user', err);
                }

                setConversations(allConvos);
            } catch (error) {
                console.error("Failed to fetch conversations", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchConversations();
    }, []);

    if (isLoading) {
        return <div className="p-8">Loading conversations...</div>;
    }

    return (
        <div className="p-6 md:p-8">
            <div className="max-w-4xl mx-auto">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Messages</h1>
                </motion.div>
                <div className="bg-white rounded-lg shadow-lg">
                    {conversations.length > 0 ? (
                        <ul className="divide-y divide-slate-200">
                            {conversations.map((convo, index) => (
                                <motion.li 
                                    key={convo.booking_id || convo.direct_user_id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <Link
                                        to={convo.type === 'direct'
                                            ? createPageUrl(`Conversation?direct_user_id=${convo.direct_user_id}`)
                                            : createPageUrl(`Conversation?booking_id=${convo.booking_id}`)}
                                        className="block hover:bg-slate-50 p-4"
                                    >
                                        <div className="flex items-center space-x-4">
                                            <div className="relative">
                                                <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
                                                    <span className="text-xl font-bold text-slate-600">{convo.other_user_name?.charAt(0)}</span>
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center">
                                                    <p className={`font-semibold text-slate-800 truncate ${!convo.is_read ? 'font-bold' : ''}`}>
                                                        {convo.other_user_name}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {convo.last_message_date ? formatDistanceToNow(new Date(convo.last_message_date), { addSuffix: true }) : ''}
                                                    </p>
                                                </div>
                                                <p className={`text-sm truncate ${!convo.is_read ? 'text-slate-900' : 'text-slate-600'}`}>
                                                    {convo.last_message}
                                                </p>
                                            </div>
                                            {!convo.is_read && (
                                                <span
                                                    className="inline-block h-2.5 w-2.5 rounded-full bg-red-500"
                                                    title="Unread"
                                                    aria-label="Unread"
                                                />
                                            )}
                                        </div>
                                    </Link>
                                </motion.li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center p-12">
                            <h3 className="text-lg font-semibold text-slate-800">No messages yet</h3>
                            <p className="text-slate-600">Your conversations will appear here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}