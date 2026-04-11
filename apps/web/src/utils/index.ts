
import {
    canExportAuditData,
    canHardDeleteUsers,
    canManageAdminRoles,
    canManageCasesAndDisputes,
    canManageCompliance,
    canManageUserLifecycle,
    getAdminScope,
    isAdminUser,
    normalizeUserType,
} from '@fact/domain';

export function createPageUrl(pageName: string) {
    return '/' + pageName.toLowerCase().replace(/ /g, '-');
}

export function createLoginUrl(nextPath?: string) {
    const loginPath = createPageUrl('Login');
    if (!nextPath) {
        return loginPath;
    }

    const params = new URLSearchParams({ next: nextPath });
    return `${loginPath}?${params.toString()}`;
}

export {
    normalizeUserType,
    isAdminUser,
    getAdminScope,
    canManageUserLifecycle,
    canHardDeleteUsers,
    canManageAdminRoles,
    canManageCompliance,
    canManageCasesAndDisputes,
    canExportAuditData,
};