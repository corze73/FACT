/**
 * Toast notification utility
 * Centralized wrapper around the toast component for consistent UX
 */

import { toast } from "@/components/ui/use-toast";

const isDev = import.meta.env.DEV;

/**
 * Development-only console logging
 * Only logs in development environment
 */
export const devLog = (...args) => {
  if (isDev) {
    console.log(...args);
  }
};

export const devWarn = (...args) => {
  if (isDev) {
    console.warn(...args);
  }
};

export const devError = (...args) => {
  if (isDev) {
    console.error(...args);
  }
};

/**
 * Show success toast notification
 */
export const showSuccess = (title, description) => {
  toast({
    title,
    description,
    variant: "default",
  });
};

/**
 * Show error toast notification
 */
export const showError = (title, description) => {
  toast({
    title,
    description,
    variant: "destructive",
  });
};

/**
 * Show warning toast notification
 */
export const showWarning = (title, description) => {
  toast({
    title: "⚠️ " + title,
    description,
  });
};

/**
 * Show info toast notification
 */
export const showInfo = (title, description) => {
  toast({
    title,
    description,
  });
};

/**
 * Handle API errors with appropriate user feedback
 */
export const handleApiError = (error, context = "Operation") => {
  devError(`[${context}]`, error);
  
  if (error.status === 401) {
    showError("Authentication Required", "Please log in to continue");
    return;
  }
  
  if (error.status === 403) {
    showError("Permission Denied", "You don't have permission for this action");
    return;
  }
  
  if (error.status === 404) {
    showError("Not Found", "The requested resource was not found");
    return;
  }
  
  if (error.status >= 500) {
    showError("Server Error", "Something went wrong on our end. Please try again later");
    return;
  }
  
  // Generic error
  showError(
    `${context} Failed`,
    error.message || "An unexpected error occurred"
  );
};

/**
 * Replace window.alert with toast
 * Use this to gradually migrate away from alerts
 */
export const alertToast = (message) => {
  // Check if it's a success message (contains ✅ or "success")
  if (message.includes("✅") || message.toLowerCase().includes("success")) {
    const cleanMessage = message.replace("✅", "").trim();
    showSuccess("Success", cleanMessage);
  } else if (message.toLowerCase().includes("error") || message.toLowerCase().includes("failed")) {
    showError("Error", message);
  } else {
    showInfo("Notice", message);
  }
};

export default {
  success: showSuccess,
  error: showError,
  warning: showWarning,
  info: showInfo,
  handleApiError,
  devLog,
  devWarn,
  devError,
};
