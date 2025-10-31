// =================================================================
// 应用状态管理
// =================================================================

/**
 * 内部状态存储（私有）
 * 使用下划线前缀表示内部变量
 */
const _internalState = {
    activeSuggestionIndex: -1,
    activeAiIndex: -1,
    suggestionViewMode: 'suggestion',
    userData: null,
    activeSearchPills: [],
    isInitialLoad: true,
    activeScopeTabId: null,
    activeScopeManagementTabId: null,
    activeEngineTabId: null,
    activeEngineManagementTabId: null,
    _activeNavigationGroupId: null, // 内部变量，通过getter/setter访问
};

/**
 * 应用状态对象
 * 使用Proxy确保activeNavigationGroupId始终同步到userData
 */
export const state = new Proxy(_internalState, {
    get(target, prop) {
        // 当访问activeNavigationGroupId时，优先返回userData中的值（如果存在）
        if (prop === 'activeNavigationGroupId') {
            return target.userData?.activeNavigationGroupId ?? target._activeNavigationGroupId;
        }
        return target[prop];
    },
    set(target, prop, value) {
        // 当设置activeNavigationGroupId时，同时更新userData中的值
        if (prop === 'activeNavigationGroupId') {
            target._activeNavigationGroupId = value;
            if (target.userData) {
                target.userData.activeNavigationGroupId = value;
            }
            return true;
        }
        target[prop] = value;
        return true;
    }
});