import { state } from '../state.js';
import { dom } from '../dom.js';
import { STATIC_CONFIG } from '../constants.js';
import { utils } from '../utils.js';
import { render } from '../ui/render.js';
import { domSafe } from '../security.js';
import { core } from '../core.js';

// =================================================================
// 搜索范围、搜索引擎、文件过滤管理处理器
// =================================================================
export const managementHandlers = {
    showScopeList: () => {
        if (dom.scopesListView) dom.scopesListView.classList.remove('hidden');
        if (dom.scopeEditorView) dom.scopeEditorView.classList.add('hidden');
        if (dom.manageScopesTitle) dom.manageScopesTitle.textContent = '管理搜索范围';
    },
    showScopeEditor: (scope = null) => {
        if (dom.scopeEditorForm) dom.scopeEditorForm.reset();
        if (dom.scopesListView) dom.scopesListView.classList.add('hidden');
        if (dom.scopeEditorView) dom.scopeEditorView.classList.remove('hidden');

        const tabSelectBtn = dom.scopeEditorTabSelect;
        tabSelectBtn.textContent = '常用';
        tabSelectBtn.dataset.value = '常用';
        if (dom.scopeEditorTabNew) dom.scopeEditorTabNew.classList.add('hidden');

        const filetypeBtn = dom.scopeEditorFiletype;
        filetypeBtn.textContent = state.userData.dynamicFilters.filetype[0].text;
        filetypeBtn.dataset.value = state.userData.dynamicFilters.filetype[0].value;

        const timeRangeBtn = dom.scopeEditorTimeRange;
        timeRangeBtn.textContent = state.userData.dynamicFilters.timeRange[0].name;
        timeRangeBtn.dataset.value = state.userData.dynamicFilters.timeRange[0].id;

        if (scope) {
            if (dom.manageScopesTitle) dom.manageScopesTitle.textContent = '编辑搜索范围';
            dom.scopeEditorId.value = scope.id;
            dom.scopeEditorTitle.value = scope.title || '';
            dom.scopeEditorIcon.value = scope.icon || '';
            // 更新预览图
            if (dom.scopeIconPreview) {
                dom.scopeIconPreview.src = scope.icon || 'https://placehold.co/24x24/3c4043/e8eaed?text=?';
            }
            tabSelectBtn.textContent = scope.tab || '常用';
            tabSelectBtn.dataset.value = scope.tab || '常用';
            dom.scopeEditorSites.value = scope.sites ? scope.sites.join('\n') : '';
            dom.scopeEditorExcludeKeywords.value = scope.excludeKeywords || '';

            const filetype = state.userData.dynamicFilters.filetype.find(f => f.value === scope.filetype) || state.userData.dynamicFilters.filetype[0];
            filetypeBtn.textContent = filetype.text;
            filetypeBtn.dataset.value = filetype.value;

            const timeRange = state.userData.dynamicFilters.timeRange.find(f => f.id === scope.timeRange) || state.userData.dynamicFilters.timeRange[0];
            timeRangeBtn.textContent = timeRange.name;
            timeRangeBtn.dataset.value = timeRange.id;

            dom.scopeEditorAfter.value = scope.after || '';
            dom.scopeEditorBefore.value = scope.before || '';
            dom.scopeEditorIntitle.value = scope.intitle || '';
            dom.scopeEditorIntext.value = scope.intext || '';
        } else {
            if (dom.manageScopesTitle) dom.manageScopesTitle.textContent = '新增搜索范围';
            dom.scopeEditorId.value = '';
            // 重置预览图为默认图
            if (dom.scopeIconPreview) {
                dom.scopeIconPreview.src = 'https://placehold.co/24x24/3c4043/e8eaed?text=?';
            }
        }
    },
    saveScope: () => {
        if (!dom.scopeEditorForm.checkValidity()) {
            dom.scopeEditorForm.reportValidity();
            return;
        }

        let tabValue = dom.scopeEditorTabSelect.dataset.value;
        if (tabValue === STATIC_CONFIG.CONSTANTS.NEW_TAB_VALUE) {
            const newTabName = dom.scopeEditorTabNew ? dom.scopeEditorTabNew.value.trim() : '';
            if (!newTabName) {
                // 使用安全的错误提示对话框
                domSafe.showAlert('请输入新标签页的名称。', 'error');
                return;
            }
            tabValue = newTabName;
        }

        const scopeData = {
            id: dom.scopeEditorId.value || `scope_${Date.now()}`,
            title: dom.scopeEditorTitle.value.trim(),
            icon: dom.scopeEditorIcon.value.trim(),
            tab: tabValue,
            sites: dom.scopeEditorSites.value.split('\n').map(s => s.trim()).filter(Boolean),
            excludeKeywords: dom.scopeEditorExcludeKeywords.value.trim(),
            filetype: dom.scopeEditorFiletype.dataset.value,
            timeRange: dom.scopeEditorTimeRange.dataset.value,
            after: dom.scopeEditorAfter.value,
            before: dom.scopeEditorBefore.value,
            intitle: dom.scopeEditorIntitle.value.trim(),
            intext: dom.scopeEditorIntext.value.trim()
        };

        const existingIndex = state.userData.scopes.findIndex(s => s.id === scopeData.id);
        if (existingIndex > -1) {
            state.userData.scopes[existingIndex] = scopeData;
        } else {
            state.userData.scopes.push(scopeData);
        }

        core.saveUserData(err => {
            if (err) return utils.showToast('保存失败', 'error');
            utils.showToast('保存成功!', 'success');
            render.scopeManagementModal();
            render.scopeMenu();
            managementHandlers.showScopeList();
        });
    },
    deleteScope: (id) => {
        // 使用安全的确认对话框
        domSafe.showConfirm(
            '您确定要删除这个搜索范围吗？',
            () => {
                state.userData.scopes = state.userData.scopes.filter(s => s.id !== id);
                state.userData.favoriteScopes = state.userData.favoriteScopes.filter(favId => favId !== id);
                core.saveUserData(err => {
                    if(err) return utils.showToast('删除失败', 'error');
                    utils.showToast('删除成功', 'success');
                    render.scopeManagementModal();
                    render.scopeMenu();
                });
            }
        );
    },
    moveScope: (id, direction) => {
        const tabScopes = state.userData.scopes.filter(s => (s.tab || '常用') === state.activeScopeManagementTabId);
        const otherScopes = state.userData.scopes.filter(s => (s.tab || '常用') !== state.activeScopeManagementTabId);

        const index = tabScopes.findIndex(s => s.id === id);
        if (index === -1) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= tabScopes.length) return;

        [tabScopes[index], tabScopes[newIndex]] = [tabScopes[newIndex], tabScopes[index]]; // Swap

        state.userData.scopes = [...otherScopes, ...tabScopes];
        core.saveUserData(() => render.scopeManagementModal());
    },
    // 添加移动搜索引擎的函数
    moveEngine: (id, direction) => {
        const index = state.userData.searchEngines.findIndex(e => e.id === id);
        if (index === -1) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= state.userData.searchEngines.length) return;

        // 交换位置
        [state.userData.searchEngines[index], state.userData.searchEngines[newIndex]] = 
        [state.userData.searchEngines[newIndex], state.userData.searchEngines[index]];

        core.saveUserData(() => {
            render.engineManagementModal();
            render.searchEngineSwitcher();
        });
    },
    resetEngineForm: () => {
        dom.manageEnginesForm.reset();
        dom.engineEditId.value = '';
        dom.engineTab.value = '通用';  // 重置分类输入框
        dom.engineFormTitle.textContent = '添加新引擎';
        dom.engineFormCancel.classList.add('hidden');
        // 重置预览图为默认图
        if (dom.engineIconPreview) {
            dom.engineIconPreview.src = 'https://placehold.co/24x24/3c4043/e8eaed?text=?';
        }
    },
    handleEngineFormSubmit: (e) => {
        e.preventDefault();
        const id = dom.engineEditId.value || `engine_${Date.now()}`;
        const newEngine = {
            id: id,
            name: dom.engineName.value.trim(),
            url: dom.engineUrl.value.trim(),
            icon: dom.engineIconUrl.value.trim(),
            tab: dom.engineTab.value.trim() || '通用'  // 获取分类信息
        };
        if (!newEngine.name || !newEngine.url) {
            // 使用安全的错误提示对话框
            domSafe.showAlert('引擎名称和搜索网址不能为空。', 'error');
            return;
        }

        const existingIndex = state.userData.searchEngines.findIndex(eng => eng.id === id);
        if (existingIndex > -1) {
            state.userData.searchEngines[existingIndex] = newEngine;
        } else {
            state.userData.searchEngines.push(newEngine);
        }
        core.saveUserData(err => {
            if(err) return utils.showToast('保存引擎失败', 'error');
            utils.showToast('引擎已保存', 'success');
            render.engineManagementModal();
            render.searchEngineSwitcher();
            managementHandlers.resetEngineForm();
        });
    },
    saveFileFilter: (form) => {
        const text = dom.addFileFilterText.value.trim();
        const value = dom.addFileFilterValue.value.trim();
        if(!text || !value) return;

        const exists = state.userData.dynamicFilters.filetype.some(f => f.value === value);
        if (exists) {
            // 使用安全的错误提示对话框
            domSafe.showAlert('该文件后缀已存在。', 'error');
            return;
        }

        state.userData.dynamicFilters.filetype.push({ value, text });
        core.saveUserData(() => {
            render.dynamicFilterManagement('filetype');
            form.reset();
        });
    },
    deleteFileFilter: (value) => {
        state.userData.dynamicFilters.filetype = state.userData.dynamicFilters.filetype.filter(f => f.value !== value);
        core.saveUserData(() => render.dynamicFilterManagement('filetype'));
    }
};

