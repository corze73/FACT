// React import removed as unused with modern JSX transform
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function MessageBubble({ message, currentUser, selectionMode = false, isSelected = false, onToggleSelect }) {
    const isCurrentUser = message.sender_id === currentUser.id;

    return (
        <div className={cn("flex items-end gap-2", isCurrentUser ? "justify-end" : "justify-start")}>
            {selectionMode && (
                <button
                    type="button"
                    onClick={() => onToggleSelect?.(message.id)}
                    className={cn(
                        "h-5 w-5 rounded-full border transition",
                        isSelected ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"
                    )}
                    aria-label={isSelected ? "Deselect message" : "Select message"}
                    title={isSelected ? "Deselect message" : "Select message"}
                >
                    <span className="sr-only">{isSelected ? "Selected" : "Not selected"}</span>
                </button>
            )}
            <div className={cn(
                "max-w-[75%] p-3 rounded-2xl",
                selectionMode && isSelected && "ring-2 ring-blue-300",
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