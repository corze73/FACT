
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User } from '@/api/entities.jsx';
import { Message } from '@/api/entities.jsx';
import { Booking } from '@/api/entities.jsx';
import { apiClient } from '@/api/apiClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl, isAdminUser } from '@/utils';
import MessageBubble from '../components/messaging/MessageBubble';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateAndSanitize, messageSchema, formatValidationErrors } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rateLimiter";
import { alertToast, showError } from '@/utils/notifications';

async function loadConversationData(mode, bookingId, directUserId) {
    const user = await User.me();
    let conversationMessages = [];
    let booking = null;
    let otherUser = null;
    let participants = null;
    let directUser = null;

    if (mode === 'booking') {
        booking = await Booking.get(bookingId);

        if (isAdminUser(user)) {
            const [clientData, coachData] = await Promise.all([
                User.get(booking.client_id),
                User.get(booking.coach_id)
            ]);
            participants = { client: clientData, coach: coachData };
        } else {
            const otherUserId = booking.client_id === user.id ? booking.coach_id : booking.client_id;
            otherUser = await User.get(otherUserId);
        }

        const allMessages = await Message.filter({ booking_id: bookingId }, 'created_date');
        conversationMessages = isAdminUser(user)
            ? allMessages
            : allMessages.filter((message) => message.sender_id === user.id || message.receiver_id === user.id);
    } else {
        directUser = await User.get(directUserId);
        conversationMessages = await apiClient.getDirectMessages(directUserId);
    }

    const unreadMessages = conversationMessages.filter((message) => message.receiver_id === user.id && !message.is_read);
    if (unreadMessages.length > 0) {
        await Promise.all(unreadMessages.map((message) => Message.update(message.id, { is_read: true })));
        conversationMessages = conversationMessages.map((message) => (
            unreadMessages.some((unread) => unread.id === message.id)
                ? { ...message, is_read: true }
                : message
        ));
    }

    return {
        currentUser: user,
        booking,
        otherUser,
        participants,
        directUser,
        messages: conversationMessages,
    };
}

async function loadDeletedMessages(mode, bookingId, directUserId) {
    return Message.listDeleted(
        mode === 'direct'
            ? { direct_user_id: directUserId, limit: 100 }
            : { booking_id: bookingId, limit: 100 }
    );
}

export default function Conversation() {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [failedMessageData, setFailedMessageData] = useState(null);
    const [recipientForAdmin, setRecipientForAdmin] = useState('client');
    const [bookingId, setBookingId] = useState(null);
    const [mode, setMode] = useState('booking'); // 'booking' | 'direct'
    const [directUserId, setDirectUserId] = useState(null);
    const [validationError, setValidationError] = useState('');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedMessageIds, setSelectedMessageIds] = useState([]);
    const [isClearing, setIsClearing] = useState(false);
    const [showDeletedPanel, setShowDeletedPanel] = useState(false);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
            return;
        }
        navigate(createPageUrl('Messages'));
    };

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

    const isReady = (mode === 'booking' && Boolean(bookingId)) || (mode === 'direct' && Boolean(directUserId));

    const conversationQuery = useQuery({
        queryKey: ['conversation', mode, bookingId, directUserId],
        queryFn: () => loadConversationData(mode, bookingId, directUserId),
        enabled: isReady,
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
    });

    const deletedMessagesQuery = useQuery({
        queryKey: ['conversation', 'deleted', mode, bookingId, directUserId],
        queryFn: () => loadDeletedMessages(mode, bookingId, directUserId),
        enabled: showDeletedPanel && isReady,
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
    });

    useEffect(() => {
        if (!conversationQuery.data?.messages) return;
        setMessages(conversationQuery.data.messages);
    }, [conversationQuery.data]);

    useEffect(() => {
        if (!conversationQuery.error) return;
        console.error("Failed to load conversation", conversationQuery.error);
        showError('Conversation Unavailable', conversationQuery.error.message || 'Failed to load conversation.');
    }, [conversationQuery.error]);

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

    const toggleSelection = (messageId) => {
        setSelectedMessageIds((prev) => (
            prev.includes(messageId)
                ? prev.filter((id) => id !== messageId)
                : [...prev, messageId]
        ));
    };

    const exitSelectionMode = () => {
        setSelectionMode(false);
        setSelectedMessageIds([]);
    };

    const handleClearSelected = async () => {
        if (selectedMessageIds.length === 0) return;
        if (!window.confirm(`Delete ${selectedMessageIds.length} selected message(s)? This cannot be undone.`)) return;
        setIsClearing(true);
        try {
            await Promise.all(selectedMessageIds.map((messageId) => Message.delete(messageId)));
            setMessages((prev) => prev.filter((msg) => !selectedMessageIds.includes(msg.id)));
            exitSelectionMode();
        } catch (error) {
            alertToast(error?.message || 'Failed to delete selected messages');
        } finally {
            setIsClearing(false);
        }
    };

    const handleClearAll = async () => {
        const label = mode === 'direct' ? 'this conversation' : 'all messages for this booking';
        if (!window.confirm(`Clear ${label}? This cannot be undone.`)) return;
        setIsClearing(true);
        try {
            await Message.clearConversation(
                mode === 'direct'
                    ? { direct_user_id: directUserId }
                    : { booking_id: bookingId }
            );
            setMessages([]);
            exitSelectionMode();
        } catch (error) {
            alertToast(error?.message || 'Failed to clear conversation');
        } finally {
            setIsClearing(false);
        }
    };

    const handleToggleDeletedPanel = async () => {
        const next = !showDeletedPanel;
        setShowDeletedPanel(next);
    };

    const handlePermanentDeleteArchived = async (archiveId) => {
        if (!window.confirm('Permanently remove this message from Deleted Messages? This cannot be undone.')) return;
        try {
            await Message.permanentlyDeleteArchived(archiveId);
            await deletedMessagesQuery.refetch();
        } catch (error) {
            alertToast(error?.message || 'Failed to permanently delete archived message');
        }
    };

    const handleRestoreArchived = async (archiveId) => {
        try {
            await Message.restoreArchived(archiveId);
            await conversationQuery.refetch();
            await deletedMessagesQuery.refetch();
        } catch (error) {
            alertToast(error?.message || 'Failed to restore deleted message');
        }
    };

    const currentUser = conversationQuery.data?.currentUser ?? null;
    const otherUser = conversationQuery.data?.otherUser ?? null;
    const participants = conversationQuery.data?.participants ?? null;
    const booking = conversationQuery.data?.booking ?? null;
    const directUser = conversationQuery.data?.directUser ?? null;
    const deletedMessages = Array.isArray(deletedMessagesQuery.data) ? deletedMessagesQuery.data : [];
    const isLoadingDeleted = deletedMessagesQuery.isLoading || deletedMessagesQuery.isFetching;
    const isLoading = !isReady || conversationQuery.isLoading;

    if (isLoading) return <div className="h-screen flex items-center justify-center">Loading conversation...</div>;
    if (!currentUser) return <div className="h-screen flex items-center justify-center">Conversation not found.</div>;

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 p-4 flex items-center gap-4 sticky top-0 z-10">
                <Button variant="ghost" size="icon" onClick={handleBack}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>

                {/* Avatar */}
                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                    <span className="text-lg font-bold text-slate-600">
                        {mode === 'direct'
                                                    ? (isAdminUser(currentUser) ? directUser?.full_name?.charAt(0) : (isAdminUser(directUser) ? 'S' : directUser?.full_name?.charAt(0)))
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
                              : (isAdminUser(directUser) ? 'Support Team' : directUser?.full_name || 'Conversation'))
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
                    {messages.length > 0 && (
                        <div className="flex items-center gap-2 ml-2">
                            {!selectionMode ? (
                                <Button type="button" variant="outline" size="sm" onClick={() => setSelectionMode(true)}>
                                    Select
                                </Button>
                            ) : (
                                <>
                                    <Button type="button" variant="outline" size="sm" onClick={exitSelectionMode} disabled={isClearing}>
                                        <X className="w-4 h-4 mr-1" />
                                        Cancel
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={handleClearSelected} disabled={selectedMessageIds.length === 0 || isClearing}>
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        Clear Selected
                                    </Button>
                                </>
                            )}
                            <Button type="button" variant="outline" size="sm" onClick={handleClearAll} disabled={isClearing}>
                                <Trash2 className="w-4 h-4 mr-1" />
                                Clear All
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={handleToggleDeletedPanel}>
                                {showDeletedPanel ? 'Hide Deleted' : 'Deleted Messages'}
                            </Button>
                        </div>
                    )}
                </div>
            </header>

            {showDeletedPanel && (
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="max-w-5xl mx-auto">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-slate-800">Deleted Messages</h3>
                            <Button type="button" variant="ghost" size="sm" onClick={loadDeletedMessages} disabled={isLoadingDeleted}>
                                Refresh
                            </Button>
                        </div>

                        {isLoadingDeleted ? (
                            <p className="text-sm text-slate-500">Loading deleted messages...</p>
                        ) : deletedMessages.length === 0 ? (
                            <p className="text-sm text-slate-500">No deleted messages in this conversation.</p>
                        ) : (
                            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                {deletedMessages.map((row) => (
                                    <div key={row.id} className="rounded border border-slate-200 bg-white p-2 flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-xs text-slate-500">
                                                Deleted {new Date(row.deleted_at).toLocaleString()}
                                            </p>
                                            <p className="text-sm text-slate-700 break-words whitespace-pre-wrap">{row.content}</p>
                                        </div>
                                        <div className="flex flex-col gap-2 shrink-0">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={!row.message_still_exists}
                                                onClick={() => handleRestoreArchived(row.id)}
                                            >
                                                Restore
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="text-red-700 border-red-200 hover:bg-red-50"
                                                onClick={() => handlePermanentDeleteArchived(row.id)}
                                            >
                                                Permanent Delete
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Messages */}
            <main id="main-content" tabIndex="-1" className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {messages.map(msg => (
                    <MessageBubble
                        key={msg.id}
                        message={msg}
                        currentUser={currentUser}
                        selectionMode={selectionMode}
                        isSelected={selectedMessageIds.includes(msg.id)}
                        onToggleSelect={toggleSelection}
                    />
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
