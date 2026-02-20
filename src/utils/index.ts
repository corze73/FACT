


export function createPageUrl(pageName: string) {
    return '/' + pageName.toLowerCase().replace(/ /g, '-');
}

export function normalizeUserType(value?: string | null) {
    if (value === 'coach' || value === 'client' || value === 'admin') return value;
    if (value === 'user' || !value) return 'client';
    return value;
}

export function isAdminUser(user?: { user_type?: string | null } | null) {
    return normalizeUserType(user?.user_type) === 'admin';
}