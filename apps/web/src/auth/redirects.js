import { getStoredCurrentUser } from '@/api/databaseClient.js';
import { User } from '@/api/entities.jsx';
import { createLoginUrl, createPageUrl, isAdminUser, normalizeUserType } from '@/utils';
import { showSuccess } from '@/utils/notifications';

export const getDefaultPostLoginPath = (user) => {
  if (isAdminUser(user)) {
    return createPageUrl('AdminDashboard');
  }

  if (normalizeUserType(user?.user_type) === 'coach') {
    return createPageUrl('CoachDashboard');
  }

  return createPageUrl('FindCoaches');
};

export const getSafeNextPath = (nextPath) => {
  if (!nextPath || typeof nextPath !== 'string') {
    return null;
  }

  if (!nextPath.startsWith('/')) {
    return null;
  }

  if (nextPath.startsWith('//') || nextPath.startsWith('/login')) {
    return null;
  }

  return nextPath;
};

export const buildAbsoluteLoginRedirect = (nextPath) => {
  if (typeof window === 'undefined') {
    return createLoginUrl(nextPath);
  }

  return `${window.location.origin}${createLoginUrl(nextPath)}`;
};

export const waitForAuthenticatedUser = async ({ maxAttempts = 10 } = {}) => {
  let user = await getStoredCurrentUser();
  if (user) {
    return user;
  }

  let attempts = 0;
  while (attempts < maxAttempts && !user) {
    try {
      user = await User.me();
      break;
    } catch (error) {
      attempts += 1;
      if (attempts >= maxAttempts) {
        throw error;
      }

      const delay = Math.min(100 * Math.pow(2, attempts - 1), 2000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  if (!user) {
    throw new Error('Failed to establish authenticated session');
  }

  return user;
};

const consumePendingProfileData = () => {
  try {
    const pendingData = sessionStorage.getItem('pendingProfileData');
    if (!pendingData) {
      return null;
    }

    return JSON.parse(pendingData);
  } catch {
    return null;
  }
};

const clearPendingProfileData = () => {
  try {
    sessionStorage.removeItem('pendingProfileData');
  } catch {
    // Ignore sessionStorage failures.
  }
};

export const completePostLoginNavigation = async ({ navigate, nextPath } = {}) => {
  const me = await waitForAuthenticatedUser();
  const pendingProfileData = consumePendingProfileData();

  if (pendingProfileData) {
    try {
      const sanitizedProfileData = { ...pendingProfileData };
      const isCoachSignup = normalizeUserType(pendingProfileData.user_type) === 'coach';
      const missingQualificationUpload = !sanitizedProfileData.qualification_file_url;
      const missingBackgroundUpload = sanitizedProfileData.has_background_check && !sanitizedProfileData.background_check_file_url;
      const requiresPostLoginCompliance = isCoachSignup && (missingQualificationUpload || missingBackgroundUpload);

      if (requiresPostLoginCompliance) {
        delete sanitizedProfileData.qualification_type;
        delete sanitizedProfileData.qualification_file_url;
        delete sanitizedProfileData.has_background_check;
        delete sanitizedProfileData.background_check_type;
        delete sanitizedProfileData.background_check_file_url;
        delete sanitizedProfileData.background_check_expires_at;
      }

      await User.updateMyUserData(sanitizedProfileData);
      clearPendingProfileData();

      if (isCoachSignup) {
        if (requiresPostLoginCompliance) {
          showSuccess('Coach account created', 'Complete your compliance uploads in your coach profile to enter the verification queue.');
          const target = createPageUrl('CoachProfile');
          navigate?.(target, { replace: true });
          return target;
        }

        const target = createPageUrl('CoachDashboard');
        navigate?.(target, { replace: true });
        return target;
      }

      const target = createPageUrl('FindCoaches');
      navigate?.(target, { replace: true });
      return target;
    } catch (error) {
      console.error('Error applying pending profile data:', error);
      clearPendingProfileData();
    }
  }

  const target = getSafeNextPath(nextPath) || getDefaultPostLoginPath(me);
  navigate?.(target, { replace: true });
  return target;
};