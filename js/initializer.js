// =================================================================
// 应用初始化模块 - 将main.js的init函数拆分为多个职责单一的函数
// =================================================================

import { STATIC_CONFIG } from './constants.js';
import { dom } from './dom.js';
import { state } from './state.js';
import { logger } from './logger.js';
import { eventManager } from './eventManager.js';
import { core } from './core.js';
import { navigationModule } from './features/navigation.js';
import { searchModule } from './features/search.js';
import { handlers } from './handlers.js';
import { aiSettings } from './features/ai-settings.js';
import { timeRuleHandlers } from './features/timeRuleHandlers.js';
import { managementHandlers } from './features/managementHandlers.js';
import { render } from './ui/render.js';
import { utils } from './utils.js';
import { iconPreviewHelper } from './utils/iconHelper.js';

/**
 * 初始化器类 - 管理应用的各个初始化步骤
 */
export class Initializer {
    constructor() {
        this.globalEventIds = [];
    }

    /**
     * 初始化DOM属性
     */
    initDOMAttributes() {
        // 为建议标签设置 data-action 属性
        if (dom.suggestionTabs) {
            const suggestionTabButtons = dom.suggestionTabs.querySelectorAll('.suggestion-tab');
            suggestionTabButtons.forEach(tab => {
                tab.dataset.action = 'suggestion-tab';
            });
        }

        // 设置各种按钮的data-action属性
        if (dom.searchSubmitBtn) dom.searchSubmitBtn.dataset.action = 'search-submit';
        if (dom.clearHistoryBtn) dom.clearHistoryBtn.dataset.action = 'clear-history';
        if (dom.clearPillsBtn) dom.clearPillsBtn.dataset.action = 'clear-pills';
        if (dom.manageScopesBtn) dom.manageScopesBtn.dataset.action = 'manage-scopes';
        if (dom.addNewScopeBtn) dom.addNewScopeBtn.dataset.action = 'add-new-scope';
        if (dom.cancelScopeEditBtn) dom.cancelScopeEditBtn.dataset.action = 'cancel-scope-edit';
        if (dom.saveScopeBtn) dom.saveScopeBtn.dataset.action = 'save-scope';
        if (dom.engineFormCancel) dom.engineFormCancel.dataset.action = 'engine-form-cancel';
        if (dom.searchScopeBtn) dom.searchScopeBtn.dataset.action = 'toggle-scope-menu';
        if (dom.engineBtn) dom.engineBtn.dataset.action = 'toggle-engine-menu';
        if (dom.suggestionTabs) {
            dom.suggestionTabs.querySelectorAll('.suggestion-tab').forEach(tab => {
                tab.dataset.action = 'suggestion-tab';
            });
        }
    }

    /**
     * 初始化图标预览功能（使用iconPreviewHelper统一管理）
     */
    initIconPreviews() {
        // 使用iconPreviewHelper统一初始化图标预览
        if (dom.scopeEditorIcon && dom.scopeIconPreview) {
            iconPreviewHelper.init(dom.scopeEditorIcon, dom.scopeIconPreview, {
                debounceDelay: 500
            }, this.globalEventIds);
        }
        
        if (dom.engineIconUrl && dom.engineIconPreview) {
            iconPreviewHelper.init(dom.engineIconUrl, dom.engineIconPreview, {
                debounceDelay: 500
            }, this.globalEventIds);
        }
    }

    /**
     * 初始化搜索相关事件
     */
    initSearchEvents() {
        // 搜索表单提交
        this.globalEventIds.push(
            eventManager.add(dom.searchForm, 'submit', (e) => e.preventDefault())
        );

        // 搜索输入框键盘事件
        this.globalEventIds.push(
            eventManager.add(dom.realSearchInput, 'keydown', searchModule.handleInputKeydown)
        );

        // 搜索输入框焦点事件
        this.globalEventIds.push(
            eventManager.add(dom.realSearchInput, 'focus', () => {
                if (dom.searchFormWrapper) dom.searchFormWrapper.classList.add('focused');
                if (state.isInitialLoad) {
                    state.isInitialLoad = false;
                    return;
                }
                searchModule.debouncedShowSuggestions(true);
            })
        );

        this.globalEventIds.push(
            eventManager.add(dom.realSearchInput, 'blur', () => {
                if (dom.searchFormWrapper) dom.searchFormWrapper.classList.remove('focused');
            })
        );

        // 搜索输入事件
        this.globalEventIds.push(
            eventManager.add(dom.realSearchInput, 'input', () => {
                handlers.updateSearchContainerState();
                state.activeSuggestionIndex = -1;
                searchModule.debouncedShowSuggestions(false);
            })
        );

        // 双击搜索框触发AI搜索
        this.initDoubleClickAI();

        // 搜索框失焦处理
        this.initSearchBlurHandling();
    }

    /**
     * 初始化双击AI搜索功能
     */
    initDoubleClickAI() {
        let lastClickTime = 0;
        this.globalEventIds.push(
            eventManager.add(dom.realSearchInput, 'click', () => {
                const now = Date.now();
                if (now - lastClickTime < STATIC_CONFIG.TIMING.DOUBLE_CLICK_THRESHOLD) {
                    searchModule.toggleAiSearch();
                }
                lastClickTime = now;
            })
        );
    }

    /**
     * 初始化搜索框失焦处理
     */
    initSearchBlurHandling() {
        let lastBlurTime = 0;
        let shouldPreventHide = false;

        // 在建议容器内的点击应该阻止隐藏
        this.globalEventIds.push(
            eventManager.add(document, 'mousedown', (e) => {
                if (e.target.closest('#search-suggestions-container') ||
                    e.target.closest('#search-scope-menu') ||
                    e.target.closest('#ai-search-container')) {
                    shouldPreventHide = true;
                    setTimeout(() => {
                        shouldPreventHide = false;
                    }, STATIC_CONFIG.TIMING.PREVENT_HIDE_RESET_DELAY);
                } else {
                    shouldPreventHide = false;
                }
            }, true)
        );

        this.globalEventIds.push(
            eventManager.add(dom.realSearchInput, 'blur', (e) => {
                lastBlurTime = Date.now();
                setTimeout(() => {
                    if (shouldPreventHide) {
                        shouldPreventHide = false;
                        return;
                    }

                    const clickTarget = document.activeElement;
                    const isToggleButtonClicked = document.querySelector('[data-action="toggle-scope-menu"]:focus') ||
                        document.querySelector('[data-action="toggle-engine-menu"]:focus') ||
                        document.querySelector('[data-action="toggle-filter-menu"]:focus');

                    if (isToggleButtonClicked) return;

                    if (clickTarget && (
                        clickTarget.closest('#ai-search-container') ||
                        clickTarget.closest('#search-suggestions-container') ||
                        clickTarget.closest('#search-scope-menu') ||
                        clickTarget.closest('#time-filter-menu') ||
                        clickTarget.closest('#file-filter-menu') ||
                        clickTarget.closest('#image-search-menu')
                    )) {
                        return;
                    }

                    searchModule.hideAllSearchContainers();
                }, STATIC_CONFIG.TIMING.SEARCH_BLUR_DELAY);
            })
        );
    }

    /**
     * 初始化表单事件
     */
    initFormEvents() {
        this.globalEventIds.push(
            eventManager.add(dom.addTimeFilterForm, 'submit', timeRuleHandlers.saveRule)
        );

        this.globalEventIds.push(
            eventManager.add(dom.addFileFilterForm, 'submit', (e) => {
                e.preventDefault();
                managementHandlers.saveFileFilter(e.target);
            })
        );

        this.globalEventIds.push(
            eventManager.add(dom.manageEnginesForm, 'submit', managementHandlers.handleEngineFormSubmit)
        );
    }

    /**
     * 初始化拖拽事件
     */
    initDragEvents() {
        // 范围菜单拖拽
        if (dom.scopeMenuContentContainer) {
            this.globalEventIds.push(
                eventManager.add(dom.scopeMenuContentContainer, 'dragstart', e => {
                    const option = e.target.closest('.option');
                    if (option) e.dataTransfer.setData('text/plain', option.dataset.id);
                })
            );
        }

        // 搜索引擎菜单拖拽
        if (dom.engineMenuContentContainer) {
            this.globalEventIds.push(
                eventManager.add(dom.engineMenuContentContainer, 'dragstart', e => {
                    const option = e.target.closest('.option');
                    if (option) e.dataTransfer.setData('text/plain', option.dataset.engineId);
                })
            );
        }

        // 收藏栏拖放
        this.initFavoritesBarDrop();
    }

    /**
     * 初始化收藏栏拖放功能
     */
    initFavoritesBarDrop() {
        this.globalEventIds.push(
            eventManager.add(dom.favoritesBar, 'dragover', e => {
                e.preventDefault();
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            })
        );

        this.globalEventIds.push(
            eventManager.add(dom.favoritesBar, 'dragleave', e => {
                e.currentTarget.style.background = '';
            })
        );

        this.globalEventIds.push(
            eventManager.add(dom.favoritesBar, 'drop', e => {
                e.preventDefault();
                e.currentTarget.style.background = '';
                const scopeId = e.dataTransfer.getData('text/plain');
                if (scopeId && !state.userData.favoriteScopes.includes(scopeId)) {
                    state.userData.favoriteScopes.push(scopeId);
                    core.saveUserData(err => {
                        if (err) return;
                        render.favorites();
                    });
                }
            })
        );
    }

    /**
     * 返回全局事件ID数组
     */
    getGlobalEventIds() {
        return this.globalEventIds;
    }
    
    /**
     * 【新增】重置初始器状态（用于页面刷新时）
     * 清理所有事件ID，但保留实例本身
     */
    reset() {
        this.globalEventIds.length = 0;
    }
}

// 导出单例
export const initializer = new Initializer();

