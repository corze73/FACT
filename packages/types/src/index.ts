export type UserType = 'admin' | 'coach' | 'client' | 'user' | string;

export type AdminScope = 'full' | 'support' | 'compliance' | 'ops' | 'read_only';

export interface RoleLikeUser {
  user_type?: UserType | null;
  admin_scope?: AdminScope | string | null;
}
