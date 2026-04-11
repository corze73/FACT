import { normalizeUserType } from '../authz/index';

export const normalizeUserRecord = <T extends { user_type?: string | null } | null | undefined>(user: T) => {
  if (!user) return user;
  return { ...user, user_type: normalizeUserType(user.user_type) };
};

export const normalizeUserList = <T extends { user_type?: string | null }>(list?: T[] | null) => (
  Array.isArray(list) ? list.map((user) => normalizeUserRecord(user)) : list
);

export const normalizeUserListResponse = <T extends { user_type?: string | null }>(response: T[] | { data?: T[] } | null | undefined) => {
  if (response && Array.isArray((response as { data?: T[] }).data)) {
    return {
      ...(response as { data: T[] }),
      data: (response as { data: T[] }).data.map((user) => normalizeUserRecord(user))
    };
  }

  if (Array.isArray(response)) {
    return response.map((user) => normalizeUserRecord(user));
  }

  return response;
};
