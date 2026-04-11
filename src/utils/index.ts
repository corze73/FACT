
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