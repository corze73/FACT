import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User } from '@/api/entities.jsx';
import { Message } from '@/api/entities.jsx';
import { Booking } from '@/api/entities.jsx';
import { apiClient } from '@/api/apiClient.js';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl, isAdminUser } from '@/utils';
import { showError } from '@/utils/notifications';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const MESSAGES_CURRENT_USER_QUERY_KEY = ['messages', 'current-user'];

async function loadConversations(currentUser) {
    if (isAdminUser(currentUser)) {
        const [allBookings, directThreads] = await Promise.all([
            Booking.list('-updated_date', 50),
            apiClient.getDirectThreads()
        ]);

        const bookingIds = allBookings.map((booking) => booking.id);
        const messages = bookingIds.length
            ? await Message.filter({ booking_id: { in: bookingIds } }, '-created_date')
            : [];

        const lastMessages = {};
        messages.forEach((message) => {
            if (!lastMessages[message.booking_id]) {
                lastMessages[message.booking_id] = message;
            }
        });

        const ids = Array.from(new Set([
            ...allBookings.flatMap((booking) => [booking.client_id, booking.coach_id]),
            ...directThreads.map((thread) => thread.other_user_id)
        ]));
        const users = ids.length ? await User.filter({ id: { in: ids } }) : [];
        const userMap = users.reduce((accumulator, user) => ({ ...accumulator, [user.id]: user }), {});

        const bookingConversations = allBookings.map((booking) => {
            const client = userMap[booking.client_id];
            const coach = userMap[booking.coach_id];
            const lastMessage = lastMessages[booking.id];

            return {
                type: 'booking',
                booking_id: booking.id,
                direct_user_id: null,
                other_user_name: `${client?.full_name || 'Client'} ↔ ${coach?.full_name || 'Coach'}`,
                last_message: lastMessage?.content || 'No messages yet',
                last_message_date: lastMessage?.created_date || booking.created_date,
                is_read: true
            };
        });

        const directConversations = directThreads.map((thread) => {
            const other = userMap[thread.other_user_id];
            return {
                type: 'direct',
                booking_id: null,
                direct_user_id: thread.other_user_id,
                other_user_name: other?.full_name || 'User',
                last_message: thread.content,
                last_message_date: thread.created_date,
                is_read: thread.sender_id === currentUser.id || thread.is_read
            };
        });

        return [...directConversations, ...bookingConversations].sort(
            (left, right) => new Date(right.last_message_date) - new Date(left.last_message_date)
        );
    }

    const [clientBookings, coachBookings] = await Promise.all([
        Booking.filter({ client_id: currentUser.id }, '-created_at'),
        Booking.filter({ coach_id: currentUser.id }, '-created_at')
    ]);

    const allBookingsMap = new Map();
    [...clientBookings, ...coachBookings].forEach((booking) => {
        allBookingsMap.set(booking.id, booking);
    });
    const combinedBookings = Array.from(allBookingsMap.values());

    const bookingIds = combinedBookings.map((booking) => booking.id);
    const messages = bookingIds.length
        ? await Message.filter({ booking_id: { in: bookingIds } }, '-created_date')
        : [];

    const lastMessages = {};
    messages.forEach((message) => {
        if (!lastMessages[message.booking_id]) {
            lastMessages[message.booking_id] = message;
        }
    });

    const bookingConversations = combinedBookings.map((booking) => {
        const lastMessage = lastMessages[booking.id];
        const isClientView = booking.client_id === currentUser.id;
        const otherName = isClientView ? (booking.coach_name || 'Coach') : (booking.client_name || 'Client');
        const otherAvatar = isClientView ? booking.coach_avatar : booking.client_avatar;

        return {
            type: 'booking',
            booking_id: booking.id,
            direct_user_id: null,
            other_user_name: otherName,
            other_user_avatar: otherAvatar,
            last_message: lastMessage?.content || 'Start a conversation',
            last_message_date: lastMessage?.created_date || booking.created_at,
            is_read: lastMessage ? (lastMessage.sender_id === currentUser.id || lastMessage.is_read) : true
        };
    });

    try {
        const directThreads = await apiClient.getDirectThreads();

        if (!directThreads.length) {
            return bookingConversations;
        }

        let directUserMap = {};
        try {
            const otherIds = Array.from(new Set(directThreads.map((thread) => thread.other_user_id).filter(Boolean)));
            const directUsers = otherIds.length ? await User.filter({ id: { in: otherIds } }) : [];
            directUserMap = directUsers.reduce((accumulator, user) => ({ ...accumulator, [user.id]: user }), {});
        } catch (error) {
            console.warn('Direct thread user lookup denied; using fallback labels', error);
        }

        const directConversations = directThreads.map((thread) => {
            const other = directUserMap[thread.other_user_id];
            const isAdminOther = other?.user_type === 'admin';

            return {
                type: 'direct',
                booking_id: null,
                direct_user_id: thread.other_user_id,
                other_user_name: isAdminOther ? 'Support Team' : (other?.full_name || 'Support Team'),
                other_user_avatar: other?.profile_picture,
                last_message: thread.content,
                last_message_date: thread.created_date,
                is_read: thread.sender_id === currentUser.id || thread.is_read
            };
        });

        return [...directConversations, ...bookingConversations].sort(
            (left, right) => new Date(right.last_message_date) - new Date(left.last_message_date)
        );
    } catch (error) {
        console.warn('Failed to load direct threads for user', error);
        return bookingConversations;
    }
}

export default function Messages() {
    const location = useLocation();
    const queryClient = useQueryClient();

    const currentUserQuery = useQuery({
        queryKey: MESSAGES_CURRENT_USER_QUERY_KEY,
        queryFn: () => User.me(),
        staleTime: 5 * 60 * 1000,
    });

    const conversationsQuery = useQuery({
        queryKey: ['messages', 'conversations', currentUserQuery.data?.id, location.key],
        queryFn: () => loadConversations(currentUserQuery.data),
        enabled: Boolean(currentUserQuery.data?.id),
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
    });

    useEffect(() => {
        if (!conversationsQuery.error) {
            return;
        }

        console.error('Failed to fetch conversations', conversationsQuery.error);
        showError('Messages Failed', conversationsQuery.error.message || 'Failed to load conversations.');
    }, [conversationsQuery.error]);

    useEffect(() => {
        const handleFocus = () => {
            queryClient.invalidateQueries({ queryKey: ['messages', 'conversations'] });
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                queryClient.invalidateQueries({ queryKey: ['messages', 'conversations'] });
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [queryClient]);

    const conversations = conversationsQuery.data || [];
    const isLoading = currentUserQuery.isLoading || conversationsQuery.isLoading;

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