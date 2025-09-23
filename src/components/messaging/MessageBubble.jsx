// React import removed as unused with modern JSX transform
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function MessageBubble({ message, currentUser }) {
    const isCurrentUser = message.sender_id === currentUser.id;

    return (
        <div className={cn("flex items-end gap-2", isCurrentUser ? "justify-end" : "justify-start")}>
            <div className={cn(
                "max-w-[75%] p-3 rounded-2xl",
                isCurrentUser 
                    ? "bg-blue-600 text-white rounded-br-lg" 
                    : "bg-white text-slate-800 border border-slate-200 rounded-bl-lg"
            )}>
                <p className="text-sm leading-relaxed">{message.content}</p>
                 <p className={cn(
                    "text-xs mt-1.5", 
                    isCurrentUser ? "text-blue-200" : "text-slate-400",
                    "text-right"
                )}>
                    {format(new Date(message.created_date), 'p')}
                </p>
            </div>
        </div>
    );
}