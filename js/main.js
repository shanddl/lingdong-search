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
import { initNestedSlider } from './sliderHelper.js';
import { initEffectsPanel, openEffectsPanel, applyEffectsCSSVariables } from './features/effects-panel.js';
import { config } from './config.js';
import { DOMHelper } from './utils/domHelper.js';
import { ButtonGroupHelper } from './utils/buttonGroupHelper.js';
import { URLFormatter } from './utils/urlFormatter.js';
import { Formatter } from './utils/formatter.js';
import { timerManager } from './utils/timerManager.js';
import { getLazyLoader, resetLazyLoader } from './lazyLoader.js';

// 存储全局事件监听器ID
const globalEventIds = [];

// 缓存DOM查询结果，避免重复查询
const cachedDOMQueries = {
    shapeButtons: null
};

// 【修复】防止重复初始化的标记
let isInitialized = false;
let unloadCleanupHandler = null;

// 【根本修复】页面加载时立即重置所有单例状态
// 在模块加载时执行，确保每次刷新页面都是干净状态（而非等到卸载时清理）
(function resetSingletonsOnPageLoad() {
    if (typeof window === 'undefined') return;
    
    // 只在新页面加载时执行（document.readyState === 'loading'）
    // 如果页面已经加载完成，说明是正常使用，不重置
    if (document.readyState === 'loading') {
        try {
            // 重置事件管理器（清理可能残留的监听器）
            eventManager.reset();
            // 重置定时器管理器（清理可能残留的定时器）
            timerManager.reset();
            // 重置全局懒加载器（使用resetLazyLoader函数）
            resetLazyLoader();
            
            // 【修复】清理main.js中的全局数组和缓存对象
            globalEventIds.length = 0;
            cachedDOMQueries.shapeButtons = null;
            
            // 【修复】重置initializer单例的内部状态
            if (initializer && typeof initializer.reset === 'function') {
                initializer.reset();
            }
            
            // 【修复】重置errorHandler（移除可能累积的事件监听器）
            if (errorHandler && typeof errorHandler.reset === 'function') {
                errorHandler.reset();
            }
            
            // 清理可能残留的window全局变量
            if (window.state && window.state.userData) {
                window.state.userData = null;
            }
        } catch (error) {
            console.warn('⚠️ 重置单例状态失败:', error);
        }
    }
})();

// Initialize state with default data (使用浅拷贝，后续会被loadUserData替换)
state.userData = { ...STATIC_CONFIG.DEFAULT_USER_DATA };

// =================================================================
// 初始化函数
// =================================================================
/**
 * 应用初始化主函数
 * 负责协调各个模块的初始化顺序
 */
function init() {
    // 【修复】防止重复初始化，避免刷新页面时资源累积
    if (isInitialized) {
        console.warn('⚠️ 应用已初始化，跳过重复初始化。如需重新初始化，请先调用cleanup()');
        return;
    }
    
    // 【修复】清理旧的beforeunload监听器（如果存在），避免重复添加
    if (unloadCleanupHandler) {
        window.removeEventListener('beforeunload', unloadCleanupHandler);
        unloadCleanupHandler = null;
    }
    
    // 【注意】单例重置已在模块加载时完成（上面的resetSingletonsOnPageLoad）
    // 这里只需要确保当前状态是干净的即可
    
    // 【修复】确保全局数组是空的（双重保险）
    globalEventIds.length = 0;
    
    // 标记为已初始化
    isInitialized = true;
    
    // 1. 初始化全局错误处理器
    errorHandler.init();
    
    // 2. 缓存DOM元素
    cacheDOMElements();
    
    // 3. 初始化DOM属性
    initializer.initDOMAttributes();
    
    // 4. 初始化图标预览功能
    initializer.initIconPreviews();
    
    // 验证关键DOM元素是否正确缓存（仅调试模式执行，减少生产环境开销）
    if (config && config.debug && config.debug.enableConsole) {
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
    }
    
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
    
    // 10.6 暴露外观设置CSS变量应用函数（供core.applyAllSettings调用）
    window.applyEffectsCSSVariables = applyEffectsCSSVariables;

    // 11. 使用eventManager管理全局事件监听器
    globalEventIds.push(
        eventManager.add(document, 'keydown', handlers.globalKeydownHandler)
    );

    // 壁纸库按钮点击事件（使用缓存的DOM元素）
    if (dom.wallpaperLibraryBtn) {
        globalEventIds.push(
            eventManager.add(dom.wallpaperLibraryBtn, 'click', async (e) => {
                e.preventDefault();
                // 打开壁纸库面板而不是跳转页面
                const { openWallpaperLibraryPanel } = await import('./features/wallpaper-library-panel.js');
                openWallpaperLibraryPanel();
            })
        );
    }

    globalEventIds.push(
        eventManager.add(document.body, 'click', (e) => {
        const target = e.target;

        // 关闭右键菜单的逻辑：点击菜单外部时关闭，但点击菜单本身或其子元素时不关闭
        // 注意：closest会向上查找，包括元素本身和所有祖先元素
        const isNavContextMenu = target.closest('#nav-context-menu');
        const isNavTabContextMenu = target.closest('#nav-tab-context-menu');
        const isMainContextMenu = target.closest('#main-context-menu');
        
        // 如果点击不在导航项右键菜单内，则关闭
        if (!isNavContextMenu) {
            navigationModule.utils.closeContextMenu();
        }
        // 如果点击不在标签右键菜单内，则关闭
        if (!isNavTabContextMenu) {
            navigationModule.utils.closeTabContextMenu();
        }
        // 如果点击不在主右键菜单内，则关闭（使用DOMHelper）
        if (!isMainContextMenu && dom.mainContextMenu) {
            DOMHelper.toggleVisibility(dom.mainContextMenu, false, {
                useOpacity: true,
                useVisibility: true,
                className: 'visible'
            });
        }
        
        // 批量编辑模式：点击非图标区域时退出
        if (navigationModule.state.isBatchEditMode) {
            const clickedNavItem = target.closest('.nav-item');
            const clickedContextMenu = target.closest('#main-context-menu, #nav-context-menu, #nav-tab-context-menu');
            const clickedNavTab = target.closest('.nav-tab');
            
            // 如果没有点击图标、右键菜单或导航标签，则退出批量编辑模式
            if (!clickedNavItem && !clickedContextMenu && !clickedNavTab) {
                navigationModule.utils.toggleBatchEditMode();
            }
        }
        
        // [增强] 点击菜单外部关闭自定义选择器菜单（如时间/文件菜单）
        // 如果点击不在.is-dynamic-menu或其trigger上，则关闭所有.is-dynamic-menu
        const isDynamicMenu = target.closest('.is-dynamic-menu');
        // 触发器：带[data-dynamic-menu]或.custom-select-wrapper button
        const isDynamicMenuTrigger = target.closest('[data-dynamic-menu], .custom-select-wrapper button');
        if (!isDynamicMenu && !isDynamicMenuTrigger) {
            DOMHelper.removeDynamicMenus();
        }

        if (target.closest('.modal-close-btn') || target.classList.contains('modal-overlay')) {
            const modal = target.closest('.modal-overlay');
            if (modal) DOMHelper.toggleVisibility(modal, false, { className: 'visible' });
            return;
        }

        // 先检查是否有data-action，如果有则优先处理，避免被其他逻辑拦截
        let actionTarget = target.closest('[data-action]');
        if (actionTarget) {
            const action = actionTarget.dataset.action;
            logger.debug('检测到data-action元素', { 
                action, 
                id: actionTarget.id,
                className: actionTarget.className,
                tagName: actionTarget.tagName,
                inPanel: !!target.closest('#effectsSettingsPanel')
            });
            // 对于搜索引擎菜单中的按钮，先处理点击事件，再处理菜单关闭
            if (action === 'manage-engines' || action === 'open-settings') {
                logger.debug('处理manage-engines或open-settings');
                handleActionClick(e);
                return;
            }
            // 对于图标源测试按钮，立即处理并返回，避免被其他逻辑影响
            if (action === 'test-icon-sources' || action === 'test-engine-icon-sources' || action === 'test-scope-icon-sources') {
                logger.debug('处理图标源测试按钮点击', { action, buttonId: actionTarget.id });
                e.preventDefault(); // 阻止默认行为
                e.stopPropagation(); // 阻止事件冒泡
                handleActionClick(e);
                return;
            }
        }

        // 统一的下拉菜单关闭逻辑：点击非菜单区域时关闭
        // 注意：菜单内的按钮点击应该由handleActionClick处理，不要在这里提前关闭菜单
        const isInDropdownMenu = target.closest('.dropdown-menu');
        const isInHeaderContainer = target.closest('.header-container');
        
        // 只有当点击不在下拉菜单内、不在header容器内时，才关闭所有菜单
        // 菜单内的按钮（有data-action）会由handleActionClick处理，不需要在这里关闭菜单
        if (!isInDropdownMenu && 
            !isInHeaderContainer &&
            !isNavContextMenu && 
            !isNavTabContextMenu && 
            !isMainContextMenu) {
            // 但排除动态菜单和模态框
            if (!target.closest('.is-dynamic-menu, .modal-content')) {
                utils.closeAllDropdowns();
            }
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
                    const newItem = menu.querySelector(`.dropdown-item[data-value="${value}"]`);
                    if (activeItem && newItem) {
                        // 使用ButtonGroupHelper统一管理下拉菜单项状态
                        ButtonGroupHelper.updateActiveState(menu, '.dropdown-item', newItem, ['active']);
                    } else if (activeItem) {
                        activeItem.classList.remove('active');
                    } else if (newItem) {
                        newItem.classList.add('active');
                    }
                }
            };

            if (id === 'scope-editor-tab-select') {
                // 优化：使用for循环+Set去重，避免多次数组创建
                const tabsSet = new Set();
                for (let i = 0; i < state.userData.scopes.length; i++) {
                    const tab = state.userData.scopes[i].tab || '常用';
                    tabsSet.add(tab);
                }
                options = Array.from(tabsSet).map(t => ({ value: t, text: t }));
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

            // 优化：使用for循环减少临时数组创建
            const mappedOptions = [];
            for (let i = 0; i < options.length; i++) {
                const opt = options[i];
                mappedOptions.push({ value: opt.value || opt.id, text: opt.text || opt.name });
            }
            utils.createCustomSelect(customSelectTrigger, mappedOptions, onSelect);
            return;
        }

        // Handle actions using the centralized action handler
        // 注意：图标源测试按钮已经在上面优先处理并return了，这里只处理其他data-action
        // 如果上面的actionTarget未定义，重新查找
        if (!actionTarget) {
            actionTarget = target.closest('[data-action]');
        }
        if (actionTarget) {
            const action = actionTarget.dataset.action;
            // 跳过已经处理过的action
            if (action !== 'manage-engines' && 
                action !== 'open-settings' && 
                action !== 'test-icon-sources' && 
                action !== 'test-engine-icon-sources' && 
                action !== 'test-scope-icon-sources') {
                logger.debug('检测到其他data-action按钮，调用handleActionClick', { 
                    action: action, 
                    id: actionTarget.id,
                    className: actionTarget.className 
                });
                handleActionClick(e);
            }
        }
    }));

    // 右键菜单事件
    globalEventIds.push(
        eventManager.add(document.body, 'contextmenu', handlers.globalContextMenuHandler)
    );

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
            formatValue: (v) => Formatter.pixels(v),
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
            formatValue: (v) => Formatter.pixels(v),
            useThrottle: false
        }, globalEventIds, throttleSliderUpdate);
    } else {
        logger.warn('Engine spacing slider or value element not found');
    }

    // 范围编辑器站点格式化
    if (dom.scopeEditorSites) {
        const formatScopeSites = () => {
            const lines = dom.scopeEditorSites.value.split('\n');
            // 优化：使用for循环减少临时数组创建
            const formattedLines = [];
            for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trim();
                formattedLines.push(trimmed ? URLFormatter.formatScopeSite(trimmed) : '');
            }
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
            if (dom.engineUrl && dom.engineUrl.value) {
                // 使用URLFormatter统一格式化
                const formatted = URLFormatter.formatEngineUrl(dom.engineUrl.value);
                if (formatted !== dom.engineUrl.value) {
                    dom.engineUrl.value = formatted;
                }
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
                // 使用timerManager统一管理定时器
                timerManager.setTimeout('pasteTimeout', formatEngineUrl, 10);
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
    
    
    // Apply saved navigation alignment
    // 应用保存的对齐方式按钮状态（使用ButtonGroupHelper）
    if (dom.navAlignGroup && state.userData.navigationAlignment) {
        const alignButtons = dom.navAlignGroup.querySelectorAll('[data-action="set-nav-alignment"]');
        const activeBtn = Array.from(alignButtons).find(btn => btn.dataset.align === state.userData.navigationAlignment);
        if (activeBtn) {
            ButtonGroupHelper.updateActiveState(alignButtons, null, activeBtn, ['active', 'selected']);
        }
    }
    
    // Apply saved navigation density (min-width) slider value
    if (dom.navMinWidthSlider && state.userData.navigationItemMinWidth) {
        dom.navMinWidthSlider.value = state.userData.navigationItemMinWidth;
        if (dom.navMinWidthValue) dom.navMinWidthValue.textContent = state.userData.navigationItemMinWidth;
    }

    // dock栏缩放滑块初始值
    if (dom.dockScaleSlider && typeof state.userData.dockScale === 'number') {
        dom.dockScaleSlider.value = state.userData.dockScale;
        if (dom.dockScaleValue) dom.dockScaleValue.textContent = Formatter.decimal(state.userData.dockScale, 2);
        document.documentElement.style.setProperty('--dock-scale', state.userData.dockScale);
    }
    
    // 搜索引擎菜单滑块初始值
    logger.debug('Applying initial engine slider values...');
    logger.debug('User data engine settings:', state.userData?.engineSettings);
    
    // 确保 engineSettings 存在，否则使用默认值
    if (!state.userData.engineSettings || typeof state.userData.engineSettings !== 'object') {
        state.userData.engineSettings = { size: 16, spacing: 8 };
        logger.debug('Initialized default engine settings');
    }
    
    // 应用引擎大小设置
    const engineSize = state.userData.engineSettings.size || 16;
    if (dom.engineSizeSlider) {
        dom.engineSizeSlider.value = engineSize;
        if (dom.engineSizeValue) {
            dom.engineSizeValue.textContent = Formatter.pixels(engineSize);
        }
        utils.engineStyle.applySize(engineSize);
    }
    
    // 应用引擎间距设置
    const engineSpacing = state.userData.engineSettings.spacing || 8;
    if (dom.engineSpacingSlider) {
        dom.engineSpacingSlider.value = engineSpacing;
        if (dom.engineSpacingValue) {
            dom.engineSpacingValue.textContent = Formatter.pixels(engineSpacing);
        }
        utils.engineStyle.applySpacing(engineSpacing);
    }

    // 使用事件委托处理形状按钮点击（使用ButtonGroupHelper）
    const getShapeButtons = () => {
        if (!cachedDOMQueries.shapeButtons) {
            cachedDOMQueries.shapeButtons = document.querySelectorAll('.shape-choice');
        }
        return cachedDOMQueries.shapeButtons;
    };
    
    globalEventIds.push(
        eventManager.delegate(document.body, 'click', '.shape-choice', (e) => {
            const shape = e.target.dataset.shape;
            if (!shape) return;
            
            const allShapeButtons = getShapeButtons();
            DOMHelper.toggleButtonGroup(allShapeButtons, null, e.target, ['active', 'selected']);
            
            document.body.className = document.body.className.replace(/shape-\w+/g, '');
            if (shape !== 'square') {
                document.body.classList.add(`shape-${shape}`);
            }
            
            state.userData.navigationShape = shape;
            core.saveUserData(() => {});
        })
    );
    
    // 应用保存的形状按钮状态（初始化时执行一次，延迟执行确保DOM已加载）
    timerManager.setTimeout('shapeInit', () => {
        const allShapeButtons = getShapeButtons();
        if (allShapeButtons.length > 0) {
            // 使用for循环替代Array.from().find()，减少内存分配
            let savedShapeBtn = null;
            let squareBtn = null;
            for (let i = 0; i < allShapeButtons.length; i++) {
                const btn = allShapeButtons[i];
                if (state.userData.navigationShape && btn.dataset.shape === state.userData.navigationShape) {
                    savedShapeBtn = btn;
                }
                if (btn.dataset.shape === 'square') {
                    squareBtn = btn;
                }
            }
            
            if (savedShapeBtn) {
                DOMHelper.toggleButtonGroup(allShapeButtons, null, savedShapeBtn, ['active', 'selected']);
            } else if (squareBtn) {
                DOMHelper.toggleButtonGroup(allShapeButtons, null, squareBtn, ['active', 'selected']);
            }
        }
    }, 100);

    // 导航对齐方式按钮监听器（使用ButtonGroupHelper）
    if (dom.navAlignGroup) {
        globalEventIds.push(
            eventManager.delegate(dom.navAlignGroup, 'click', '[data-action="set-nav-alignment"]', (e) => {
                const align = e.target.dataset.align;
                if (!align) return;
                
                const allAlignButtons = dom.navAlignGroup.querySelectorAll('[data-action="set-nav-alignment"]');
                DOMHelper.toggleButtonGroup(allAlignButtons, null, e.target, ['active', 'selected']);
                
                if (dom.navigationGrid) {
                    const alignmentStyles = {
                        'left': { marginLeft: '0', marginRight: 'auto' },
                        'center': { marginLeft: 'auto', marginRight: 'auto' },
                        'right': { marginLeft: 'auto', marginRight: '0' }
                    };
                    
                    const styles = alignmentStyles[align];
                    if (styles) {
                        Object.assign(dom.navigationGrid.style, styles);
                    }
                }
                
                // 保存用户选择
                state.userData.navigationAlignment = align;
                core.saveUserData(() => {});
            })
        );
    }

    // 添加拖拽事件监听器（统一管理，避免内存泄漏）
    globalEventIds.push(
        eventManager.add(document, 'dragover', handlers.globalDragOverHandler)
    );
    globalEventIds.push(
        eventManager.add(document, 'dragleave', handlers.globalDragLeaveHandler)
    );
    globalEventIds.push(
        eventManager.add(document, 'drop', handlers.globalDropHandler)
    );
    
    // AI表单事件监听器（使用事件委托统一管理）
    globalEventIds.push(
        eventManager.delegate(document, 'click', '#ai-form-cancel, #ai-show-in-search-btn, #ai-show-in-favorites-btn', (e) => {
            e.preventDefault();
            if (e.target.id === 'ai-form-cancel') {
                aiSettings.resetForm();
            } else if (e.target.id === 'ai-show-in-search-btn') {
                aiSettings.toggleButton('ai-show-in-search-btn');
            } else if (e.target.id === 'ai-show-in-favorites-btn') {
                aiSettings.toggleButton('ai-show-in-favorites-btn');
            }
        })
    );
    
    // AI表单提交事件（统一管理）
    globalEventIds.push(
        eventManager.delegate(document, 'submit', '#ai-form', (e) => {
            logger.debug('Form submit event detected, target:', e.target);
            logger.debug('AI form submit detected, calling saveAI');
            e.preventDefault();
            aiSettings.saveAI();
        })
    );
    

    if (dom.realSearchInput) {
        dom.realSearchInput.focus();
    }
    handlers.updateSearchContainerState();
    
    // 监听 chrome.storage 变化，当扩展popup添加网站时自动更新（已优化：支持清理，避免内存泄漏）
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        logger.debug('Chrome storage change listener registered');
        
        // 【内存优化】保存监听器引用，便于后续清理
        const storageChangeHandler = (changes, areaName) => {
            logger.debug('Storage change detected:', areaName, changes);
            if (areaName === 'local' && changes[STATIC_CONFIG.CONSTANTS.STORAGE_KEY]) {
                const newValue = changes[STATIC_CONFIG.CONSTANTS.STORAGE_KEY].newValue;
                if (newValue && newValue.navigationGroups) {
                    logger.debug('Navigation data changed, updating...');
                    
                    // 只更新导航数据，不重新渲染整个页面
                    state.userData.navigationGroups = newValue.navigationGroups;
                    // 设置 activeNavigationGroupId，Proxy 会自动同步到 userData
                    state.activeNavigationGroupId = newValue.activeNavigationGroupId;
                    
                    // 【性能优化】更新导航组缓存
                    if (window.navigationModule && typeof window.navigationModule.updateCache === 'function') {
                        window.navigationModule.updateCache();
                    }
                    
                    // 只重新渲染导航部分
                    navigationModule.render.all();
                }
            }
        };
        
        chrome.storage.onChanged.addListener(storageChangeHandler);
        
        // 【内存优化】保存监听器引用到全局清理函数中，以便页面卸载时清理
        if (!window._chromeStorageListeners) {
            window._chromeStorageListeners = [];
        }
        window._chromeStorageListeners.push({
            remove: () => chrome.storage.onChanged.removeListener(storageChangeHandler)
        });
    } else {
        logger.warn('Chrome storage API not available');
    }
    
    // 【P0内存优化】页面卸载时清理所有全局资源（统一管理，只添加一次）
    unloadCleanupHandler = () => {
        console.log('🧹 页面即将卸载，清理所有全局资源...');
        try {
            // 清理所有定时器
            timerManager.clearAll();
            // 清理所有事件监听器
            eventManager.removeAll();
            // 清理全局懒加载器
            try {
                const lazyLoader = getLazyLoader();
                if (lazyLoader && lazyLoader.observer && typeof lazyLoader.destroy === 'function') {
                    lazyLoader.destroy();
                }
            } catch (e) {
                // lazyLoader可能未初始化，忽略错误
            }
            // 【修复】清理URL Hider（如果已初始化，调用destroy方法完整清理）
            try {
                if (window.urlHider && typeof window.urlHider.destroy === 'function') {
                    window.urlHider.destroy();
                } else if (window.urlHider && window.urlHider.observer) {
                    // 降级处理：如果destroy不存在，至少清理observer
                    window.urlHider.observer.disconnect();
                    window.urlHider.observer = null;
                }
            } catch (e) {
                // urlHider可能未初始化
            }
            
            // 【修复】清理window全局变量引用，避免阻止GC
            try {
                if (window.state && window.state.userData) {
                    // 只清理大数据对象，保留state结构
                    window.state.userData = null;
                }
            } catch (e) {
                console.warn('清理window.state失败:', e);
            }
            
            // 【修复】清理Chrome Storage监听器
            try {
                if (window._chromeStorageListeners && Array.isArray(window._chromeStorageListeners)) {
                    window._chromeStorageListeners.forEach(listener => {
                        try {
                            listener.remove();
                        } catch (e) {
                            console.warn('清理Chrome Storage监听器失败:', e);
                        }
                    });
                    window._chromeStorageListeners = [];
                }
            } catch (e) {
                console.warn('清理Chrome Storage监听器失败:', e);
            }
            
            // 【修复】重置初始化标记，允许下次重新初始化
            isInitialized = false;
        } catch (error) {
            console.error('⚠️ 全局资源清理失败:', error);
        }
    };
    
    // 只添加一次beforeunload监听器（使用具名函数，便于后续移除）
    window.addEventListener('beforeunload', unloadCleanupHandler);
    
    // 【新增】使用pagehide作为补充（更可靠，特别是对于bfcache场景）
    window.addEventListener('pagehide', (event) => {
        if (event.persisted) {
            // 页面被放入bfcache（后退/前进缓存），也需要清理资源
            unloadCleanupHandler();
        }
    }, { once: true });
    
    // 【P0内存优化】页面隐藏时清理/暂停资源，可见时恢复
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.log('📱 页面已隐藏，执行轻量清理...');
            try {
                // 清理所有定时器（保留活跃的，仅清理延迟执行的）
                // timerManager.clearAll(); // 注释掉，避免清理活跃定时器
                // 清理全局懒加载器（页面隐藏时不销毁，只暂停，因为可能还会恢复）
                // 注释掉，避免销毁后恢复时出现问题
                // try {
                //     const lazyLoader = getLazyLoader();
                //     if (lazyLoader && typeof lazyLoader.destroy === 'function') {
                //         lazyLoader.destroy();
                //     }
                // } catch (e) {
                //     // lazyLoader可能未初始化
                // }
            } catch (error) {
                console.warn('⚠️ 清理失败:', error);
            }
        }
    });
    
};

// Start the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

