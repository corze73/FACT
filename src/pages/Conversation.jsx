
import { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '@/api/entities.jsx';
import { Message } from '@/api/entities.jsx';
import { Booking } from '@/api/entities.jsx';
import { apiClient } from '@/api/apiClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl, isAdminUser } from '@/utils';
import MessageBubble from '../components/messaging/MessageBubble';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateAndSanitize, messageSchema, formatValidationErrors } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rateLimiter";

export default function Conversation() {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [failedMessageData, setFailedMessageData] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [otherUser, setOtherUser] = useState(null);
    const [participants, setParticipants] = useState(null); // {client, coach} for admin
    const [recipientForAdmin, setRecipientForAdmin] = useState('client');
    const [booking, setBooking] = useState(null);
    const [bookingId, setBookingId] = useState(null);
    const [mode, setMode] = useState('booking'); // 'booking' | 'direct'
    const [directUserId, setDirectUserId] = useState(null);
    const [directUser, setDirectUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [validationError, setValidationError] = useState('');
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('booking_id');
        const directId = params.get('direct_user_id');

        if (id) {
            setBookingId(id);
            setMode('booking');
        } else if (directId) {
            setDirectUserId(directId);
            setMode('direct');
        }
    }, []);

    const loadConversation = useCallback(async () => {
        if (mode === 'booking' && !bookingId) return;
        if (mode === 'direct' && !directUserId) return;

        try {
            setIsLoading(true);
            const user = await User.me();
            setCurrentUser(user);
            let conversationMessages = [];

            if (mode === 'booking') {
                const currentBooking = await Booking.get(bookingId);
                setBooking(currentBooking);

                // Admin: load both client and coach as participants; Non-admin: load the other user only
                if (isAdminUser(user)) {
                    const clientData = await User.get(currentBooking.client_id);
                    const coachData = await User.get(currentBooking.coach_id);
                    setParticipants({ client: clientData, coach: coachData });
                    setOtherUser(null);
                } else {
                    const otherUserId = currentBooking.client_id === user.id ? currentBooking.coach_id : currentBooking.client_id;
                    const otherUserData = await User.get(otherUserId);
                    setOtherUser(otherUserData);
                }

                const allMessages = await Message.filter({ booking_id: bookingId }, 'created_date');

                // Filter messages based on user role
                if (isAdminUser(user)) {
                    // Admin sees all messages for this booking
                    conversationMessages = allMessages;
                } else {
                    // Non-admin users only see messages where they are sender or receiver
                    conversationMessages = allMessages.filter(msg =>
                        msg.sender_id === user.id || msg.receiver_id === user.id
                    );
                }
            } else {
                // Direct admin ↔ user conversation (no booking)
                const targetUser = await User.get(directUserId);
                setDirectUser(targetUser);
                setBooking(null);
                setParticipants(null);
                setOtherUser(null);

                const allMessages = await apiClient.getDirectMessages(directUserId);
                // RLS already scopes messages to the current user; just use them as-is
                conversationMessages = allMessages;
            }

            setMessages(conversationMessages);
            
            const unreadMessages = conversationMessages.filter(m => m.receiver_id === user.id && !m.is_read);
            for (const msg of unreadMessages) {
                await Message.update(msg.id, { is_read: true });
            }

        } catch (error) {
            console.error("Failed to load conversation", error);
        } finally {
            setIsLoading(false);
        }
    }, [bookingId, directUserId, mode]);

    useEffect(() => {
        loadConversation();
    }, [loadConversation]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const isTransientNetworkError = (error) => {
        const message = String(error?.message || '').toLowerCase();
        return error instanceof TypeError && (
            message.includes('load failed') ||
            message.includes('failed to fetch') ||
            message.includes('networkerror')
        );
    };

    const sendPreparedMessage = async (preparedMessage, shouldClearInput = false) => {
        setIsSending(true);
        setValidationError('');

        for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
                const sentMessage = await Message.create(preparedMessage);
                setMessages(prev => [...prev, sentMessage]);
                setFailedMessageData(null);

                if (shouldClearInput) {
                    setNewMessage('');
                }
                setIsSending(false);
                return;
            } catch (error) {
                const shouldRetry = attempt === 1 && isTransientNetworkError(error);
                if (shouldRetry) {
                    await new Promise((resolve) => setTimeout(resolve, 300));
                    continue;
                }

                console.error('Failed to send message:', error);
                setFailedMessageData(preparedMessage);
                setValidationError('Failed to send message. Please try again or tap Retry send.');
                setIsSending(false);
                return;
            }
        }
    };
    
    const handleSendMessage = async (e) => {
        e.preventDefault();
        setValidationError('');

        if (!newMessage.trim() || !currentUser) return;
        if (mode === 'booking' && !booking) return;
        if (mode === 'direct' && !directUser) return;

        // Check rate limit
        const rateLimitCheck = checkRateLimit('messages');
        if (!rateLimitCheck.allowed) {
            setValidationError(`Too many messages. Please wait until ${new Date(rateLimitCheck.resetTime).toLocaleTimeString()}`);
            return;
        }

        const receiverId = mode === 'direct'
            ? directUser?.id
            : isAdminUser(currentUser)
                ? (recipientForAdmin === 'coach' ? booking.coach_id : booking.client_id)
                : otherUser?.id;

        if (!receiverId) return;

        const draftMessage = newMessage;

        // Prepare message data for validation
        const messageData = {
            booking_id: mode === 'booking' ? booking.id : null,
            sender_id: currentUser.id,
            receiver_id: receiverId,
            content: draftMessage
        };

        try {
            // Validate and sanitize message content
            const validatedData = validateAndSanitize(messageSchema, messageData);

            // Use validated and sanitized data
            const sanitizedMessageData = {
                ...messageData,
                ...validatedData,
                is_read: false
            };
            await sendPreparedMessage(sanitizedMessageData, true);
        } catch (error) {
            if (error && error.errors) {
                const errors = formatValidationErrors(error);
                const firstError = Object.values(errors)[0];
                setFailedMessageData(null);
                setValidationError(firstError || 'Invalid message content');
            }
        }
    };

    const handleRetrySend = async () => {
        if (!failedMessageData || isSending) return;
        await sendPreparedMessage(failedMessageData, false);
    };

    if (isLoading) return <div className="h-screen flex items-center justify-center">Loading conversation...</div>;
    if (!currentUser) return <div className="h-screen flex items-center justify-center">Conversation not found.</div>;

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 p-4 flex items-center gap-4 sticky top-0 z-10">
                <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Messages'))}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>

                {/* Avatar */}
                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                    <span className="text-lg font-bold text-slate-600">
                        {mode === 'direct'
                                                    ? directUser?.full_name?.charAt(0)
                                                    : isAdminUser(currentUser)
                            ? (recipientForAdmin === 'coach'
                                ? participants?.coach?.full_name?.charAt(0)
                                : participants?.client?.full_name?.charAt(0))
                            : otherUser?.full_name?.charAt(0)}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <h2 className="font-semibold text-slate-900">
                        {mode === 'direct'
                                                    ? (isAdminUser(currentUser)
                              ? `Message ${directUser?.full_name || 'User'}`
                              : directUser?.full_name || 'Conversation')
                                                    : isAdminUser(currentUser)
                            ? `Chat for ${booking.service_type.replace(/_/g, ' ')}`
                            : otherUser?.full_name}
                    </h2>
                                        {isAdminUser(currentUser) && participants && mode === 'booking' && (
                        <Select value={recipientForAdmin} onValueChange={setRecipientForAdmin}>
                            <SelectTrigger className="w-44 h-8">
                                <SelectValue placeholder="Send to" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="client">Message Client: {participants.client?.full_name}</SelectItem>
                                <SelectItem value="coach">Message Coach: {participants.coach?.full_name}</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                    {!isAdminUser(currentUser) && mode === 'booking' && (
                        <p className="text-xs text-slate-500">
                            Re: {booking.service_type.replace(/_/g, ' ')} Session
                        </p>
                    )}
                </div>
            </header>

            {/* Messages */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {messages.map(msg => (
                    <MessageBubble key={msg.id} message={msg} currentUser={currentUser} />
                ))}
                <div ref={messagesEndRef} />
            </main>

            {/* Input Form */}
            <footer className="bg-white p-4 border-t border-slate-200 sticky bottom-0">
                {isSending && (
                    <div className="mb-2 text-xs text-slate-500">Sending message...</div>
                )}
                {validationError && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600 flex items-center justify-between gap-3">
                        <span>{validationError}</span>
                        {failedMessageData && (
                            <Button type="button" variant="outline" size="sm" onClick={handleRetrySend} disabled={isSending}>
                                Retry send
                            </Button>
                        )}
                    </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        className={`flex-1 ${validationError ? 'border-red-500' : ''}`}
                        autoComplete="off"
                        maxLength={5000}
                        disabled={isSending}
                    />
                    <Button type="submit" size="icon" disabled={!newMessage.trim() || isSending}>
                        <Send className="w-5 h-5" />
                    </Button>
                </form>
            </footer>
        </div>
    );
}
