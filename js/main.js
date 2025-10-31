import { STATIC_CONFIG } from './constants.js';
import { state } from './state.js';
import { dom, cacheDOMElements } from './dom.js';
import { utils } from './utils.js';
import { render } from './ui/render.js';
import { modalManager } from './ui/modalManager.js';
import { navigationModule } from './features/navigation.js';
import { searchModule } from './features/search.js';
import { handlers, handleActionClick } from './handlers.js';
import { aiSettings } from './features/ai-settings.js';
import { sanitizer, domSafe, validator } from './security.js';
import { managementHandlers } from './features/managementHandlers.js';
import { timeRuleHandlers } from './features/timeRuleHandlers.js';
import { core } from './core.js';
import { logger } from './logger.js';
import { eventManager } from './eventManager.js';
import { errorHandler } from './errorHandler.js';
import { initializer } from './initializer.js';
import { initNestedSlider } from './sliderHelper.js'; // initSliders 已移除，外观设置由 effects-panel.js 管理
import { initEffectsPanel, openEffectsPanel, applyEffectsCSSVariables } from './features/effects-panel.js';

// 存储全局事件监听器ID
const globalEventIds = [];

// Initialize state with default data
state.userData = JSON.parse(JSON.stringify(STATIC_CONFIG.DEFAULT_USER_DATA));

// =================================================================
// 初始化函数
// =================================================================
/**
 * 应用初始化主函数
 * 负责协调各个模块的初始化顺序
 */
function init() {
    // 1. 初始化全局错误处理器
    errorHandler.init();
    
    // 2. 缓存DOM元素
    cacheDOMElements();
    
    // 3. 初始化DOM属性
    initializer.initDOMAttributes();
    
    // 4. 初始化图标预览功能
    initializer.initIconPreviews();
    
    // 验证关键DOM元素是否正确缓存（优化：使用循环批量检查）
    const criticalElements = [
        { name: 'Engine size slider', element: dom.engineSizeSlider },
        { name: 'Engine size value', element: dom.engineSizeValue },
        { name: 'Engine spacing slider', element: dom.engineSpacingSlider },
        { name: 'Engine spacing value', element: dom.engineSpacingValue }
    ];
    
    criticalElements.forEach(({ name, element }) => {
        if (element) {
            logger.debug(`${name}:`, element);
        } else {
            logger.error(`${name} not found in DOM cache`);
        }
    });
    
    // 5. 加载用户数据和更新时钟
    core.loadUserData();
    core.updateClock();

    // 6. 初始化导航模块
    navigationModule.handlers.init();

    // 7. 初始化搜索事件
    initializer.initSearchEvents();
    
    // 8. 初始化表单事件
    initializer.initFormEvents();
    
    // 9. 初始化拖拽事件
    initializer.initDragEvents();
    
    // 10. 合并initializer的事件ID到全局数组
    globalEventIds.push(...initializer.getGlobalEventIds());
    
    // 10.5 暴露必要的模块到 window
    window.state = state;
    window.core = core;
    window.navigationModule = navigationModule;
    
    // 10.6 [优化] 效果调节器面板改为懒初始化
    // 不再在页面加载时立即初始化，而是在首次使用时才创建实例
    // - 首次打开面板时（openEffectsPanel）会自动初始化
    // - 应用CSS变量时（applyEffectsCSSVariables）也会自动初始化
    // 预期收益：节省约30ms初始化时间
    
    // 10.7 暴露外观设置CSS变量应用函数（供core.applyAllSettings调用）
    window.applyEffectsCSSVariables = applyEffectsCSSVariables;

    // 11. 使用eventManager管理全局事件监听器
    globalEventIds.push(
        eventManager.add(document, 'keydown', handlers.globalKeydownHandler)
    );

    // 壁纸库按钮点击事件
    const wallpaperLibraryBtn = document.querySelector('.wallpaper-library-btn');
    if (wallpaperLibraryBtn) {
        globalEventIds.push(
            eventManager.add(wallpaperLibraryBtn, 'click', (e) => {
                e.preventDefault();
                window.location.href = 'wallpaper.html';
            })
        );
    }

    globalEventIds.push(
        eventManager.add(document.body, 'click', (e) => {
        const target = e.target;

        // Close context menus if clicking outside
        if (!target.closest('#nav-context-menu')) navigationModule.utils.closeContextMenu();
        if (!target.closest('#nav-tab-context-menu')) navigationModule.utils.closeTabContextMenu();
        if (!target.closest('#main-context-menu') && dom.mainContextMenu) {
             dom.mainContextMenu.classList.remove('visible');
             dom.mainContextMenu.style.opacity = '0';
             dom.mainContextMenu.style.visibility = 'hidden';
        }
        
        // Close all context menus when clicking anywhere
        if (!target.closest('.dropdown-menu')) {
            utils.closeAllDropdowns();
        }

        // [增强] 点击菜单外部关闭自定义选择器菜单（如时间/文件菜单）
        // 如果点击不在.is-dynamic-menu或其trigger上，则关闭所有.is-dynamic-menu
        const isDynamicMenu = target.closest('.is-dynamic-menu');
        // 触发器：带[data-dynamic-menu]或.custom-select-wrapper button
        const isDynamicMenuTrigger = target.closest('[data-dynamic-menu], .custom-select-wrapper button');
        if (!isDynamicMenu && !isDynamicMenuTrigger) {
            document.querySelectorAll('.is-dynamic-menu').forEach(menu => {
                if (menu.parentNode) menu.parentNode.removeChild(menu);
            });
        }

        if (target.closest('.modal-close-btn') || target.classList.contains('modal-overlay')) {
            const modal = target.closest('.modal-overlay');
            if (modal) modal.classList.remove('visible');
            return;
        }

        if (!target.closest('.header-container, .is-dynamic-menu, .modal-content, .dropdown-menu')) {
            utils.closeAllDropdowns();
        }

        const dynamicMenuTrigger = target.closest('[data-dynamic-menu]');
        if (dynamicMenuTrigger) {
            e.preventDefault();
            e.stopPropagation();
            const type = dynamicMenuTrigger.dataset.dynamicMenu;
            const filterOptions = (type === 'timeRange')
                ? state.userData.dynamicFilters.timeRange.map(opt => ({ value: opt.id, text: opt.name }))
                : state.userData.dynamicFilters.filetype;

            const menuOptions = [
                ...filterOptions,
                {type: 'divider'},
                {value: `action-manage-${type}`, text: `管理${type === 'timeRange' ? '规则' : '类型'}...`}
            ];

            utils.createCustomSelect(dynamicMenuTrigger, menuOptions, (value, text) => {
                if (value.startsWith('action-manage-')) {
                    const actionName = value.replace('action-manage-', '');
                    if (actionName === 'timeRange') {
                        render.dynamicFilterManagement('timeRange');
                        timeRuleHandlers.resetForm();
                        modalManager.show('manageTimeFilters');
                    } else if (actionName === 'filetype') {
                        render.dynamicFilterManagement('filetype');
                        modalManager.show('manageFileFilters');
                    }
                } else {
                    if (type === 'timeRange') {
                       utils.applyTimeRule(value);
                    } else if (type === 'filetype') {
                        if (value === 'any') {
                            state.activeSearchPills = state.activeSearchPills.filter(p => p.type !== 'filetype');
                            render.searchPills();
                        } else {
                            utils.addPill({ type: 'filetype', label: `文件: ${text}`, queryPart: `filetype:${value}` });
                        }
                    }
                }
            });
            return;
        }

        const customSelectTrigger = target.closest('.custom-select-wrapper button');
        if (customSelectTrigger) {
            e.preventDefault();
            e.stopPropagation();
            const id = customSelectTrigger.id;
            let options = [];

            let onSelect = (value, text) => {
                customSelectTrigger.dataset.value = value;
                customSelectTrigger.textContent = text;
                const menu = document.querySelector(`[aria-controls*="dynamic-menu-${id}"]`);
                if (menu) {
                    const activeItem = menu.querySelector('.dropdown-item.active');
                    if(activeItem) activeItem.classList.remove('active');
                    const newItem = menu.querySelector(`.dropdown-item[data-value="${value}"]`);
                    if(newItem) newItem.classList.add('active');
                }
            };

            if (id === 'scope-editor-tab-select') {
                const tabs = [...new Set(state.userData.scopes.map(s => s.tab || '常用'))];
                options = tabs.map(t => ({ value: t, text: t }));
                options.push({ value: STATIC_CONFIG.CONSTANTS.NEW_TAB_VALUE, text: '+ 新建标签页...' });
                onSelect = (value, text) => {
                    customSelectTrigger.dataset.value = value;
                    customSelectTrigger.textContent = text;
                    const isNew = value === STATIC_CONFIG.CONSTANTS.NEW_TAB_VALUE;
                    if (dom.scopeEditorTabNew) dom.scopeEditorTabNew.classList.toggle('hidden', !isNew);
                    if (isNew && dom.scopeEditorTabNew) dom.scopeEditorTabNew.focus();
                }
            } else if (id === 'scope-editor-filetype') {
                options = state.userData.dynamicFilters.filetype;
            } else if (id === 'scope-editor-timeRange') {
                options = state.userData.dynamicFilters.timeRange.map(f => ({ value: f.id, text: f.name }));
            } else if (id === 'time-rule-type') {
                options = [{value: 'relative', text: '相对时间'}, {value: 'single', text: '固定日期'}, {value: 'range', text: '日期范围'}];
                onSelect = (value, text) => {
                    customSelectTrigger.dataset.value = value;
                    customSelectTrigger.textContent = text;
                    timeRuleHandlers.updateFormVisibility(value);
                }
            } else if (id === 'time-rule-single-condition') {
                options = [{value: 'after', text: '之后'}, {value: 'before', text: '之前'}];
            }

            utils.createCustomSelect(customSelectTrigger, options.map(opt => ({value: opt.value || opt.id, text: opt.text || opt.name})), onSelect);
            return;
        }

        // Handle actions using the centralized action handler
        handleActionClick(e);
    }));

    // 右键菜单事件
    globalEventIds.push(
        eventManager.add(document.body, 'contextmenu', handlers.globalContextMenuHandler)
    );

    // ===================================================================
    // [已移除] 旧的外观设置滑块绑定代码
    // 外观设置已迁移到侧边面板（effects-panel.js），由该模块自行管理滑块绑定
    // ===================================================================

    // 节流函数（用于引擎滑块）
    let pendingUpdate = false;
    const throttleSliderUpdate = (applyFunc, value) => {
        if (!pendingUpdate) {
            pendingUpdate = true;
            requestAnimationFrame(() => {
                applyFunc(value);
                pendingUpdate = false;
            });
        }
    };

    // 初始化嵌套对象的滑块（引擎设置）
    logger.debug('Setting up engine slider event listeners...');
    if (dom.engineSizeSlider && dom.engineSizeValue) {
        logger.debug('Engine size slider found, adding event listeners');
        initNestedSlider({
            slider: dom.engineSizeSlider,
            valueDisplay: dom.engineSizeValue,
            applyFunction: (size) => utils.engineStyle.applySize(Number(size)),
            parentKey: 'engineSettings',
            childKey: 'size',
            successMessage: '引擎大小已保存',
            formatValue: (v) => `${v}px`,
            useThrottle: false
        }, globalEventIds, throttleSliderUpdate);
    } else {
        logger.warn('Engine size slider or value element not found');
    }
    
    if (dom.engineSpacingSlider && dom.engineSpacingValue) {
        logger.debug('Engine spacing slider found, adding event listeners');
        initNestedSlider({
            slider: dom.engineSpacingSlider,
            valueDisplay: dom.engineSpacingValue,
            applyFunction: (spacing) => utils.engineStyle.applySpacing(Number(spacing)),
            parentKey: 'engineSettings',
            childKey: 'spacing',
            successMessage: '引擎间距已保存',
            formatValue: (v) => `${v}px`,
            useThrottle: false
        }, globalEventIds, throttleSliderUpdate);
    } else {
        logger.warn('Engine spacing slider or value element not found');
    }

    // 范围编辑器站点格式化
    if (dom.scopeEditorSites) {
        const formatScopeSites = () => {
            const lines = dom.scopeEditorSites.value.split('\n');
            const formattedLines = lines.map(line => line.trim() ? utils.formatScopeSite(line) : '');
            dom.scopeEditorSites.value = formattedLines.join('\n');
        };
        globalEventIds.push(
            eventManager.add(dom.scopeEditorSites, 'blur', formatScopeSites)
        );
        globalEventIds.push(
            eventManager.add(dom.scopeEditorSites, 'paste', formatScopeSites)
        );
    }

    if (dom.engineUrl) {
        const formatEngineUrl = () => {
            let url = dom.engineUrl.value.trim();
            if (url) {
                // 如果URL不包含协议，添加https://
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }
                
                // 如果URL以斜杠结尾，移除结尾的斜杠
                if (url.endsWith('/')) {
                    url = url.slice(0, -1);
                }
                
                // 如果URL不包含{query}占位符，根据常见模式添加搜索参数
                if (!url.includes('{query}')) {
                    // 检查是否已经是搜索URL格式
                    if (url.includes('?q=') || url.includes('&q=') || 
                        url.includes('?s=') || url.includes('&s=') ||
                        url.includes('?search=') || url.includes('&search=') ||
                        url.includes('?query=') || url.includes('&query=')) {
                        // 如果已经包含搜索参数，直接添加{query}占位符
                        if (url.includes('?')) {
                            const parts = url.split('?');
                            const baseUrl = parts[0];
                            const queryParams = parts[1];
                            url = `${baseUrl}?${queryParams.replace(/(q|s|search|query)=([^&]*)/, '$1={query}')}`;
                        }
                    } else {
                        // 添加默认的搜索参数
                        url = url + '/search?q={query}';
                    }
                }
                
                // 更新输入框的值
                dom.engineUrl.value = url;
            }
        };
        
        // 引擎URL格式化事件（使用 eventManager）
        globalEventIds.push(
            eventManager.add(dom.engineUrl, 'blur', formatEngineUrl)
        );
        globalEventIds.push(
            eventManager.add(dom.engineUrl, 'change', formatEngineUrl)
        );
        globalEventIds.push(
            eventManager.add(dom.engineUrl, 'paste', () => {
                // 稍微延迟执行，确保粘贴的内容已经到位
                setTimeout(formatEngineUrl, 10);
            })
        );
    }

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
    if (dom.suggestionTabs) dom.suggestionTabs.querySelectorAll('.suggestion-tab').forEach(tab => tab.dataset.action = 'suggestion-tab');

    // Apply saved navigation shape on load
    if (state.userData.navigationShape && state.userData.navigationShape !== 'square') {
        document.body.classList.add(`shape-${state.userData.navigationShape}`);
    }
    
    // 注意：searchEngineMenu 会在 core.applyAllSettings() 中渲染，此处无需重复调用
    
    // Apply saved navigation alignment
    if (dom.navAlignGroup && state.userData.navigationAlignment) {
        const alignButtons = dom.navAlignGroup.querySelectorAll('[data-action="set-nav-alignment"]');
        alignButtons.forEach(btn => {
            btn.classList.remove('active', 'selected');
            if (btn.dataset.align === state.userData.navigationAlignment) {
                btn.classList.add('active', 'selected');
            }
        });
    }
    
    // Apply saved navigation density (min-width) slider value
    if (dom.navMinWidthSlider && state.userData.navigationItemMinWidth) {
        dom.navMinWidthSlider.value = state.userData.navigationItemMinWidth;
        if (dom.navMinWidthValue) dom.navMinWidthValue.textContent = state.userData.navigationItemMinWidth;
    }

    // [新增] dock栏缩放滑块初始值
    if (dom.dockScaleSlider && typeof state.userData.dockScale === 'number') {
        dom.dockScaleSlider.value = state.userData.dockScale;
        if (dom.dockScaleValue) dom.dockScaleValue.textContent = Number(state.userData.dockScale).toFixed(2);
        document.documentElement.style.setProperty('--dock-scale', state.userData.dockScale);
    }
    
    // 搜索引擎菜单滑块初始值（预设UI，会在数据加载完成后由applyAllSettings更新）
    logger.debug('Applying initial engine slider values...');
    logger.debug('User data engine settings:', state.userData?.engineSettings);
    
    // 确保 engineSettings 存在，否则使用默认值
    // 注意：此时使用的是默认数据，实际值会在loadUserData回调中通过applyAllSettings更新
    if (!state.userData.engineSettings || typeof state.userData.engineSettings !== 'object') {
        state.userData.engineSettings = { size: 16, spacing: 8 };
        logger.debug('Initialized default engine settings');
    }
    
    // 应用引擎大小设置
    const engineSize = state.userData.engineSettings.size || 16;
    if (dom.engineSizeSlider) {
        dom.engineSizeSlider.value = engineSize;
        if (dom.engineSizeValue) {
            dom.engineSizeValue.textContent = `${engineSize}px`;
        }
        utils.engineStyle.applySize(engineSize);
    }
    
    // 应用引擎间距设置
    const engineSpacing = state.userData.engineSettings.spacing || 8;
    if (dom.engineSpacingSlider) {
        dom.engineSpacingSlider.value = engineSpacing;
        if (dom.engineSpacingValue) {
            dom.engineSpacingValue.textContent = `${engineSpacing}px`;
        }
        utils.engineStyle.applySpacing(engineSpacing);
    }

    // Add shape button listeners in appearance settings
    const shapeButtons = document.querySelectorAll('.shape-choice');
    shapeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const shape = e.target.dataset.shape;
            // 移除所有形状按钮的active和selected状态
            shapeButtons.forEach(btn => btn.classList.remove('active', 'selected'));
            // 为当前按钮添加active和selected状态
            e.target.classList.add('active', 'selected');
            
            document.body.className = document.body.className.replace(/shape-\w+/g, '');
            if (shape !== 'square') {
                document.body.classList.add(`shape-${shape}`);
            }
            state.userData.navigationShape = shape;
            core.saveUserData(() => utils.showToast('导航形状已保存', 'success'));
        });
    });
    
    // 应用保存的形状按钮状态
    if (state.userData.navigationShape) {
        shapeButtons.forEach(btn => {
            btn.classList.remove('active', 'selected');
            if (btn.dataset.shape === state.userData.navigationShape) {
                btn.classList.add('active', 'selected');
            }
        });
    } else {
        // 默认选中方形
        const squareBtn = document.querySelector('.shape-choice[data-shape="square"]');
        if (squareBtn) squareBtn.classList.add('active', 'selected');
    }

    // [新增] 导航对齐方式按钮监听器
    if (dom.navAlignGroup) {
        dom.navAlignGroup.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action="set-nav-alignment"]');
            if (target) {
                const align = target.dataset.align;
                // 移除所有按钮的active和selected状态
                dom.navAlignGroup.querySelectorAll('[data-action="set-nav-alignment"]').forEach(btn => {
                    btn.classList.remove('active', 'selected');
                });
                // 为当前按钮添加active和selected状态
                target.classList.add('active', 'selected');
                // 应用对齐方式到导航网格
                if (dom.navigationGrid) {
                    // [修改] 使用不同的对齐方式实现精确对齐
                    switch(align) {
                        case 'left':
                            dom.navigationGrid.style.marginLeft = '0';
                            dom.navigationGrid.style.marginRight = 'auto';
                            break;
                        case 'center':
                            dom.navigationGrid.style.marginLeft = 'auto';
                            dom.navigationGrid.style.marginRight = 'auto';
                            break;
                        case 'right':
                            dom.navigationGrid.style.marginLeft = 'auto';
                            dom.navigationGrid.style.marginRight = '0';
                            break;
                    }
                }
                // 保存用户选择
                state.userData.navigationAlignment = align;
                core.saveUserData(() => utils.showToast('导航对齐已保存', 'success'));
            }
        });
    }

    // 添加拖拽事件监听器
    document.addEventListener('dragover', handlers.globalDragOverHandler);
    document.addEventListener('dragleave', handlers.globalDragLeaveHandler);
    document.addEventListener('drop', handlers.globalDropHandler);
    
    // AI表单事件监听器
    document.addEventListener('click', (e) => {
        // AI表单相关按钮
        if (e.target.id === 'ai-form-cancel') {
            e.preventDefault();
            aiSettings.resetForm();
            return;
        }
        
        // 注意：test-icon-sources-btn 现在由统一的 action handler 处理（data-action="test-icon-sources"）
        
        if (e.target.id === 'ai-show-in-search-btn') {
            e.preventDefault();
            aiSettings.toggleButton('ai-show-in-search-btn');
            return;
        }
        
        if (e.target.id === 'ai-show-in-favorites-btn') {
            e.preventDefault();
            aiSettings.toggleButton('ai-show-in-favorites-btn');
            return;
        }
        
    });
    
    // AI表单提交
    document.addEventListener('submit', (e) => {
        logger.debug('Form submit event detected, target:', e.target);
        if (e.target.id === 'ai-form') {
            logger.debug('AI form submit detected, calling saveAI');
            e.preventDefault();
            aiSettings.saveAI();
        }
    });
    

    if (dom.realSearchInput) {
        dom.realSearchInput.focus();
    }
    handlers.updateSearchContainerState();
    
    // 监听 chrome.storage 变化，当扩展popup添加网站时自动更新
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        logger.debug('Chrome storage change listener registered');
        chrome.storage.onChanged.addListener((changes, areaName) => {
            logger.debug('Storage change detected:', areaName, changes);
            if (areaName === 'local' && changes[STATIC_CONFIG.CONSTANTS.STORAGE_KEY]) {
                const newValue = changes[STATIC_CONFIG.CONSTANTS.STORAGE_KEY].newValue;
                if (newValue && newValue.navigationGroups) {
                    logger.debug('Navigation data changed, updating...');
                    
                    // 只更新导航数据，不重新渲染整个页面
                    state.userData.navigationGroups = newValue.navigationGroups;
                    // 设置 activeNavigationGroupId，Proxy 会自动同步到 userData
                    state.activeNavigationGroupId = newValue.activeNavigationGroupId;
                    
                    // 只重新渲染导航部分
                    navigationModule.render.all();
                }
            }
        });
    } else {
        logger.warn('Chrome storage API not available');
    }
    
    // 注意：右键菜单功能已整合到页面内（handlers.globalContextMenuHandler）
    // 页面已经有完整的右键菜单系统，在空白处右键即可看到"外观设置"选项
};

// Start the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

