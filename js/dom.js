// =================================================================
// DOM 元素缓存
// =================================================================
import { logger } from './logger.js';

const log = logger.module('DOM');

export const dom = {};

export const DOMElementsToCache = [
    'body','main', 'header-container',
    'search-clock', 'search-container', 'search-form', 'search-form-wrapper',
    'search-input-container', 'real-search-input', 'search-submit-btn',
    'search-suggestions-container', 'suggestion-tabs', 'suggestion-content', 'clear-history-btn',
    'search-scope-btn', 'search-scope-menu',
    'engine-btn', 'active-engine-name', 'search-engine-menu',
    'active-scope-pills-container', 'favorites-bar', 'favorites-placeholder', 'tab-buttons-container',
    'scope-menu-content-container', 'custom-filters-container',
    'clear-pills-btn', 'manage-scopes-btn',
    'scopes-list-view', 'manage-scopes-tabs', 'manage-scopes-list',
    'scope-editor-view', 'scope-editor-form', 'scope-editor-id', 'scope-editor-tab-select', 'scope-editor-tab-new',
    'scope-editor-title', 'scope-editor-icon', 'scope-icon-preview', 'scope-editor-excludeKeywords',
    'scope-editor-sites', 'scope-editor-filetype', 'scope-editor-timeRange',
    'scope-editor-after', 'scope-editor-before', 'scope-editor-intitle', 'scope-editor-intext',
    'manage-time-filters-modal', 'manage-time-filters-list', 'add-time-filter-form', 'time-rule-editor-title',
    'time-rule-id', 'time-rule-name', 'time-rule-type', 'time-rule-relative-panel', 'time-rule-relative-value',
    'time-rule-single-panel', 'time-rule-single-condition', 'time-rule-single-date', 'time-rule-range-panel',
    'time-rule-range-start', 'time-rule-range-end', 'cancel-time-rule-edit-btn',
    'manage-file-filters-modal', 'manage-file-filters-list', 'add-file-filter-form', 'add-file-filter-text', 'add-file-filter-value',
    'engine-list', 'engine-form-title', 'manage-engines-form',
    'engine-edit-id', 'engine-name', 'engine-url', 'engine-icon-url', 'engine-icon-preview', 'engine-form-cancel',
    'toast-notification',
    'navigation-container', 'navigation-grid', 'navigation-tabs',
    'nav-context-menu', 'nav-tab-context-menu', 'main-context-menu',
    'nav-groups-list', 'nav-group-form-title', 'add-nav-group-form',
    'nav-group-edit-id', 'nav-group-name-input', 'cancel-nav-group-edit-btn',
    // [已移除] 旧的外观设置模态框元素
    // 外观设置已迁移到侧边面板，元素由 effects-panel.js 直接访问

    'engine-tab-buttons-container',  // 添加引擎菜单分类标签容器
    'engine-menu-content-container',  // 添加引擎菜单内容容器
    'engine-tab',  // 添加引擎分类输入框
    'engine-size-slider',  // 引擎大小滑块
    'engine-size-value',  // 引擎大小值显示
    'engine-spacing-slider',  // 引擎间距滑块
    'engine-spacing-value'  // 引擎间距值显示
];

export function cacheDOMElements() {
    try {
        // 核心元素 - 必须在页面加载时就存在
        const coreElements = new Set([
            'body', 'main', 'header-container',
            'search-clock', 'search-container', 'search-form', 'search-form-wrapper',
            'search-input-container', 'real-search-input', 'search-submit-btn',
            'search-scope-btn', 'search-scope-menu', 'search-engine-menu',
            'engine-btn', 'active-engine-name',
            'active-scope-pills-container', 'favorites-bar', 'favorites-placeholder',
            'tab-buttons-container', 'scope-menu-content-container',
            'engine-tab-buttons-container', 'engine-menu-content-container',
            'custom-filters-container', 'clear-pills-btn', 'manage-scopes-btn',
            'navigation-container', 'navigation-grid', 'navigation-tabs'
        ]);
        
        let missingCoreElements = [];
        
        // 优化：批量处理DOM元素缓存，减少重复操作，保持错误处理
        DOMElementsToCache.forEach(id => {
            try {
                const camelCaseId = id.replace(/-(\w)/g, (_, l) => l.toUpperCase());
                const element = document.getElementById(id);
                
                if (element) {
                    dom[camelCaseId] = element;
                } else if (coreElements.has(id)) {
                    missingCoreElements.push(id);
                }
            } catch (error) {
                log.warn('Error caching element:', id, error);
            }
        });
        
        if (missingCoreElements.length > 0) {
            log.warn('Missing core DOM elements:', missingCoreElements);
        }
        
        log.debug('DOM elements cached:', Object.keys(dom).length, 'total elements');
    } catch (error) {
        log.error('Error in cacheDOMElements:', error);
    }
}

// 动态缓存特定元素（用于模态框中的元素）
export function cacheModalElements() {
    const modalElements = ['header-add-btn', 'modal-save-btn'];
    modalElements.forEach(id => {
        const camelCaseId = id.replace(/-(\w)/g, (_, l) => l.toUpperCase());
        const element = document.getElementById(id);
        if (element && !dom[camelCaseId]) {
            dom[camelCaseId] = element;
        }
    });
}