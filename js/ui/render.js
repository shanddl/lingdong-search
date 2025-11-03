import { state } from '../state.js';
import { STATIC_CONFIG } from '../constants.js';
import { dom } from '../dom.js';
import { utils } from '../utils.js';
import { handlers } from '../handlers.js';
import { sanitizer, domSafe, validator } from '../security.js';
import { logger } from '../logger.js';
import { eventManager } from '../eventManager.js';

// 搜索引擎菜单样式调整 - 已移至 utils.engineStyle 统一管理

// 存储渲染相关的事件监听器ID，用于清理
const renderEventIds = {
    engineMenu: [],
    scopeMenu: [],
    engineManagement: [],
    scopeManagement: []
};

// 统一清理函数，防止内存泄漏
const cleanupEventIds = (category) => {
    if (renderEventIds[category] && renderEventIds[category].length > 0) {
        renderEventIds[category].forEach(id => {
            try {
                eventManager.remove(id);
            } catch (e) {
                logger.warn(`Failed to remove event listener ${id}:`, e);
            }
        });
        renderEventIds[category] = [];
    }
};

// =================================================================
// UI 渲染函数
// =================================================================
export const render = {
    /**
     * 统一的建议渲染函数 - 支持历史记录、搜索建议和书签
     * @param {Array} items - 要渲染的项目列表
     * @param {string} type - 类型：'history', 'suggestion', 'bookmarks'
     * @param {Element} container - 目标容器，默认为dom.suggestionContent
     */
    suggestions: (items, type, container = null) => {
        const targetContainer = container || dom.suggestionContent;
        if (!targetContainer) return;
        
        targetContainer.innerHTML = '';
        // 保持固定的最小高度，避免切换标签时容器大小变化
        const minItems = 10;
        const itemHeight = 44;
        targetContainer.style.minHeight = `${itemHeight * minItems}px`;
        
        if (!items || items.length === 0) {
            const emptyMessage = type === 'history' ? '无历史记录' : 
                                type === 'bookmarks' ? '无匹配的书签' : '无相关建议';
            targetContainer.innerHTML = `<div class="dropdown-item" style="justify-content:center;color:var(--text-secondary);">${emptyMessage}</div>`;
            return;
        }
        
        const fragment = document.createDocumentFragment();
        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'dropdown-item suggestion-item';
            
            // 处理书签类型
            if (type === 'bookmarks') {
                div.dataset.value = item.url || '';
                div.dataset.action = 'select-bookmark';
                div.dataset.bookmarkId = item.id || '';
                div.classList.add('bookmark-item');
                if(index === state.activeSuggestionIndex) div.classList.add('active');
                
                // 左侧容器：图标 + 书签名称
                const leftDiv = document.createElement('div');
                leftDiv.className = 'bookmark-left';
                leftDiv.style.cssText = 'display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;';
                
                // 创建图标 - 使用统一的图标源方案
                let iconUrl = item.favicon;
                // 如果没有favicon但有URL，使用统一的图标源方案从URL获取
                if (!iconUrl && item.url) {
                    iconUrl = utils.getIconUrlFromUrl(item.url);
                }
                
                if (iconUrl) {
                    const safeIconUrl = sanitizer.sanitizeIconUrl(iconUrl);
                    const img = utils.dom.createIcon(STATIC_CONFIG.STYLES.ICON_SIZES.SMALL, safeIconUrl, '', { sanitize: false });
                    leftDiv.appendChild(img);
                } else {
                    const iconSpan = utils.dom.createStyledElement('span', STATIC_CONFIG.STYLES.ICON_STYLES.SMALL_ICON, {}, '🔖');
                    leftDiv.appendChild(iconSpan);
                }
                
                // 书签标题（靠左）
                const titleSpan = document.createElement('span');
                titleSpan.className = 'bookmark-title';
                titleSpan.textContent = item.title || '未命名书签';
                titleSpan.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary);';
                leftDiv.appendChild(titleSpan);
                
                div.appendChild(leftDiv);
                
                // 右侧：书签路径
                const pathSpan = document.createElement('span');
                pathSpan.className = 'bookmark-path';
                pathSpan.textContent = '📁 ' + (item.path || item.domain || '');
                pathSpan.style.cssText = 'font-size: 12px; color: var(--text-secondary); white-space: nowrap; flex-shrink: 0; margin-left: 12px;';
                div.appendChild(pathSpan);
            } else {
                // 处理历史记录和普通建议
                div.dataset.value = item;
                // 不在容器上设置 data-action，避免整个容器都可点击
                if(index === state.activeSuggestionIndex) div.classList.add('active');
                
                // 左侧容器：图标 + 文本
                const leftDiv = document.createElement('div');
                leftDiv.style.cssText = 'display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;';
                
                // 尝试从item中提取URL并获取图标（适用于历史记录）
                let iconUrl = null;
                if (item && typeof item === 'string') {
                    // 检查是否是URL格式
                    try {
                        const testUrl = new URL(item);
                        // 如果是有效URL，获取图标
                        iconUrl = utils.getIconUrlFromUrl(item);
                    } catch (e) {
                        // 不是URL，可能是搜索关键词，不显示图标
                        iconUrl = null;
                    }
                }
                
                // 创建图标（如果有）
                if (iconUrl) {
                    const safeIconUrl = sanitizer.sanitizeIconUrl(iconUrl);
                    const img = utils.dom.createIcon(STATIC_CONFIG.STYLES.ICON_SIZES.SMALL, safeIconUrl, '', { sanitize: false });
                    leftDiv.appendChild(img);
                } else {
                    // 没有图标时，根据类型显示不同的占位符
                    const placeholder = type === 'history' ? '🕒' : '🔍';
                    const iconSpan = utils.dom.createStyledElement('span', STATIC_CONFIG.STYLES.ICON_STYLES.SMALL_ICON, {}, placeholder);
                    leftDiv.appendChild(iconSpan);
                }
                
                // 使用文本容器包裹，确保样式正确应用
                const textSpan = document.createElement('span');
                textSpan.className = 'suggestion-text';
                textSpan.textContent = item;
                // 将 data-action 设置在文本元素上，只有点击文本才触发搜索
                textSpan.dataset.action = 'select-suggestion';
                leftDiv.appendChild(textSpan);
                
                div.appendChild(leftDiv);

                if (type === 'history') {
                    const button = document.createElement('button');
                    button.className = 'remove-history-btn';
                    button.dataset.action = 'remove-history-item';
                    button.dataset.index = String(index);
                    button.innerHTML = '&times;';
                    button.title = '删除此历史记录'; // 添加提示文本
                    div.appendChild(button);
                }
            }
            
            fragment.appendChild(div);
        });
        
        targetContainer.appendChild(fragment);
        utils.alignPanelHeights();
    },
    searchPills: () => {
        if (!dom.activeScopePillsContainer) return;
        dom.activeScopePillsContainer.innerHTML = state.activeSearchPills.length > 0 ? `<span class="scope-pills-label">范围:</span>` : '';
        state.activeSearchPills.forEach((p, i) => {
            const pillWrapper = document.createElement('div');
            pillWrapper.className = 'search-pill';
            pillWrapper.dataset.index = i;
            
            // 安全创建pill内容
            const span = document.createElement('span');
            span.textContent = p.label; // 使用textContent避免XSS
            
            const button = document.createElement('button');
            button.className = 'pill-close-btn';
            button.dataset.action = 'remove-pill';
            button.dataset.index = i;
            button.innerHTML = '&times;';
            
            pillWrapper.appendChild(span);
            pillWrapper.appendChild(button);
            dom.activeScopePillsContainer.appendChild(pillWrapper);
        });
        handlers.updateSearchContainerState();
    },
    searchEngineSwitcher: (skipMenuRender = false) => {
        // 如果没有搜索引擎数据，使用默认数据
        const enginesToUse = state.userData.searchEngines && state.userData.searchEngines.length > 0 ? 
            state.userData.searchEngines : STATIC_CONFIG.DEFAULT_USER_DATA.searchEngines;
        logger.debug('Switching engine, enginesToUse:', enginesToUse);
        logger.debug('Active engine ID:', state.userData.activeSearchEngineId);
        const e = enginesToUse.find(e => e.id === state.userData.activeSearchEngineId);
        logger.debug('Found engine:', e);
        if (e && dom.activeEngineName) dom.activeEngineName.textContent = e.name;
        // 仅在需要时刷新菜单（避免重复渲染）
        if (!skipMenuRender) {
            render.searchEngineMenu();
        }
    },
    searchEngineMenu: () => {
        // 检查必要的DOM元素是否存在
        if (!dom.engineTabButtonsContainer || !dom.engineMenuContentContainer) {
            logger.error('Required DOM elements for engine menu not found');
            return;
        }
        
        // 确保userData已初始化
        if (!state.userData) {
            logger.error('User data not initialized');
            return;
        }
        
        // 清理之前的事件监听器（使用统一清理函数）
        cleanupEventIds('engineMenu');
        
        const { searchEngines } = state.userData;
        logger.debug('Rendering search engine menu, searchEngines:', searchEngines);
        
        // 如果没有搜索引擎数据，使用默认数据
        const enginesToUse = (searchEngines && searchEngines.length > 0) ? searchEngines : STATIC_CONFIG.DEFAULT_USER_DATA.searchEngines;
        logger.debug('Engines to use:', enginesToUse);
        
        // 获取所有唯一的分类标签
        const engineTabs = enginesToUse && enginesToUse.length > 0 
            ? [...new Set(enginesToUse.map(e => e.tab || '通用'))] 
            : ['通用'];
        logger.debug('Engine tabs:', engineTabs);
        
        // 渲染分类标签按钮
        const tabButtonsFragment = document.createDocumentFragment();
        engineTabs.forEach(tab => {
            const button = document.createElement('button');
            button.className = 'tab-btn';
            button.dataset.action = 'switch-engine-tab';
            button.dataset.tabId = tab;
            button.textContent = tab;
            // 添加拖拽属性
            button.draggable = true;
            tabButtonsFragment.appendChild(button);
        });
        dom.engineTabButtonsContainer.innerHTML = '';
        dom.engineTabButtonsContainer.appendChild(tabButtonsFragment);
        
        // 使用事件委托在容器级别处理拖拽事件，避免为每个按钮单独绑定
        renderEventIds.engineMenu.push(
            eventManager.delegate(dom.engineTabButtonsContainer, 'dragstart', '.tab-btn', handlers.onEngineTabDragStart)
        );
        renderEventIds.engineMenu.push(
            eventManager.delegate(dom.engineTabButtonsContainer, 'dragend', '.tab-btn', handlers.onEngineTabDragEnd)
        );
        renderEventIds.engineMenu.push(
            eventManager.delegate(dom.engineTabButtonsContainer, 'dragover', '.tab-btn', handlers.onEngineTabDragOver)
        );
        renderEventIds.engineMenu.push(
            eventManager.delegate(dom.engineTabButtonsContainer, 'drop', '.tab-btn', handlers.onEngineTabDrop)
        );
        renderEventIds.engineMenu.push(
            eventManager.delegate(dom.engineTabButtonsContainer, 'dragenter', '.tab-btn', (e) => {
                // 检查拖拽的是否是引擎选项
                if (e.dataTransfer.types.includes('text/plain')) {
                    e.preventDefault();
                    e.target.closest('.tab-btn').classList.add('drag-target');
                }
            })
        );
        renderEventIds.engineMenu.push(
            eventManager.delegate(dom.engineTabButtonsContainer, 'dragleave', '.tab-btn', (e) => {
                const button = e.target.closest('.tab-btn');
                // 检查鼠标是否真的离开了按钮
                if (!button.contains(e.relatedTarget)) {
                    button.classList.remove('drag-target');
                }
            })
        );

        // 渲染引擎内容网格
        const contentFragment = document.createDocumentFragment();
        engineTabs.forEach(tab => {
            const tabContent = document.createElement('div');
            tabContent.id = `engine-tab-${tab.replace(/\s+/g, '-')}`;
            tabContent.className = 'tab-content';
            
            // 为分类内容容器添加拖拽事件监听器，支持拖拽到空分类
            const handleDragOver = (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                // 添加视觉反馈
                tabContent.classList.add('drag-over');
            };
            
            const handleDragLeave = (e) => {
                // 检查鼠标是否真的离开了容器
                if (!tabContent.contains(e.relatedTarget)) {
                    tabContent.classList.remove('drag-over');
                }
            };
            
            const handleDrop = (e) => {
                tabContent.classList.remove('drag-over');
                handlers.onEngineOptionDrop(e);
            };
            
            tabContent.addEventListener('dragover', handleDragOver);
            tabContent.addEventListener('dragleave', handleDragLeave);
            tabContent.addEventListener('drop', handleDrop);
            
            const engineGrid = document.createElement('div');
            engineGrid.className = 'scope-options-grid';  // 复用搜索范围的网格样式
            
            // 过滤出属于当前分类的搜索引擎
            const tabEngines = enginesToUse.filter(e => (e.tab || '通用') === tab);
            
            if (tabEngines.length === 0) {
                // 如果当前分类没有搜索引擎，显示提示信息
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'empty-message';
                emptyMessage.textContent = '该分类下暂无搜索引擎';
                emptyMessage.style.textAlign = 'center';
                emptyMessage.style.color = 'var(--text-secondary)';
                emptyMessage.style.padding = '20px';
                tabContent.appendChild(emptyMessage);
            } else {
                tabEngines.forEach(engine => {
                    const optionDiv = document.createElement('div');
                    optionDiv.className = 'option';
                    optionDiv.dataset.action = 'switch-engine';
                    optionDiv.dataset.engineId = engine.id;
                    // 添加拖拽属性
                    optionDiv.draggable = true;
                    optionDiv.dataset.tab = tab; // 记录所属分类
                    
                    // 添加图标
                    if (engine.icon && (engine.icon.includes('.') || engine.icon.startsWith('data:'))) {
                        const img = document.createElement('img');
                        img.src = engine.icon;
                        img.alt = '';
                        optionDiv.appendChild(img);
                    } else {
                        const placeholder = document.createElement('div');
                        placeholder.className = 'icon-placeholder';
                        placeholder.textContent = engine.icon || '🔍';
                        optionDiv.appendChild(placeholder);
                    }
                    
                    // 添加引擎名称
                    const optionText = document.createElement('div');
                    optionText.className = 'option-text';
                    const p = document.createElement('p');
                    p.textContent = engine.name;
                    optionText.appendChild(p);
                    optionDiv.appendChild(optionText);
                    
                    engineGrid.appendChild(optionDiv);
                });
            }

            tabContent.appendChild(engineGrid);
            contentFragment.appendChild(tabContent);
        });
        
        dom.engineMenuContentContainer.innerHTML = '';
        dom.engineMenuContentContainer.appendChild(contentFragment);
        
        // 使用事件委托处理引擎选项的拖拽事件
        const engineDragHandlers = utils.events.createDragHandlers(
            handlers.onEngineOptionDragStart,
            handlers.onEngineOptionDragOver,
            handlers.onEngineOptionDragEnd,
            handlers.onEngineOptionDrop
        );
        utils.events.bindDragEvents(dom.engineMenuContentContainer, '.option', engineDragHandlers, renderEventIds.engineMenu);
        
        // 设置激活状态
        if (engineTabs.length > 0) {
            state.activeEngineTabId = state.activeEngineTabId && engineTabs.includes(state.activeEngineTabId) ? state.activeEngineTabId : engineTabs[0];
            const activeTabButton = dom.engineTabButtonsContainer.querySelector(`[data-tab-id="${state.activeEngineTabId}"]`);
            if (activeTabButton) activeTabButton.classList.add('active');
            
            const activeTabContent = dom.engineMenuContentContainer.querySelector(`#engine-tab-${state.activeEngineTabId.replace(/\s+/g, '-')}`);
            if (activeTabContent) activeTabContent.classList.add('active');
        }
        
        // 应用引擎大小和间距设置
        logger.debug('Applying engine settings in render function');
        if (state.userData && state.userData.engineSettings) {
            logger.debug('Engine settings found:', state.userData.engineSettings);
            if (state.userData.engineSettings.size) {
                utils.engineStyle.applySize(state.userData.engineSettings.size);
                // 【修复】同步更新滑块的值和显示
                if (dom.engineSizeSlider) {
                    dom.engineSizeSlider.value = state.userData.engineSettings.size;
                }
                if (dom.engineSizeValue) {
                    dom.engineSizeValue.textContent = `${state.userData.engineSettings.size}px`;
                }
            }
            if (state.userData.engineSettings.spacing) {
                utils.engineStyle.applySpacing(state.userData.engineSettings.spacing);
                // 【修复】同步更新滑块的值和显示
                if (dom.engineSpacingSlider) {
                    dom.engineSpacingSlider.value = state.userData.engineSettings.spacing;
                }
                if (dom.engineSpacingValue) {
                    dom.engineSpacingValue.textContent = `${state.userData.engineSettings.spacing}px`;
                }
            }
        } else {
            // 使用默认设置
            logger.debug('Applying default engine settings in render function');
            utils.engineStyle.applySize(16);
            utils.engineStyle.applySpacing(8);
            // 【修复】同步更新滑块的值和显示
            if (dom.engineSizeSlider) {
                dom.engineSizeSlider.value = 16;
            }
            if (dom.engineSizeValue) {
                dom.engineSizeValue.textContent = '16px';
            }
            if (dom.engineSpacingSlider) {
                dom.engineSpacingSlider.value = 8;
            }
            if (dom.engineSpacingValue) {
                dom.engineSpacingValue.textContent = '8px';
            }
        }
    },
    scopeMenu: () => {
        if (!dom.tabButtonsContainer || !dom.scopeMenuContentContainer) return;
        const { scopes } = state.userData;
        const scopeTabs = [...new Set(scopes.map(s => s.tab || '常用'))];

        // Render tab buttons
        const tabButtonsFragment = document.createDocumentFragment();
        scopeTabs.forEach(tab => {
            const button = document.createElement('button');
            button.className = 'tab-btn';
            button.dataset.action = 'switch-scope-tab';
            button.dataset.tabId = tab;
            button.textContent = tab;
            tabButtonsFragment.appendChild(button);
        });
        dom.tabButtonsContainer.innerHTML = '';
        dom.tabButtonsContainer.appendChild(tabButtonsFragment);

        try {
            dom.tabButtonsContainer.style.display = 'flex';
            dom.tabButtonsContainer.style.alignItems = 'center';
            if (dom.clearPillsBtn) {
                if (dom.clearPillsBtn.parentElement !== dom.tabButtonsContainer) {
                    dom.clearPillsBtn.style.marginLeft = 'auto';
                    dom.clearPillsBtn.classList.add('tab-clear-pills-btn');
                    dom.tabButtonsContainer.appendChild(dom.clearPillsBtn);
                }
            }
        } catch (err) {
            
        }

        // Render scope content
        const contentFragment = document.createDocumentFragment();
        scopeTabs.forEach(tab => {
            const tabContent = document.createElement('div');
            tabContent.id = `tab-${tab.replace(/\s+/g, '-')}`;
            tabContent.className = 'tab-content';
            
            const scopeGrid = document.createElement('div');
            scopeGrid.className = 'scope-options-grid';
            
            scopes.filter(s => (s.tab || '常用') === tab).forEach(option => {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'option';
                optionDiv.draggable = true;
                optionDiv.dataset.action = 'select-scope-option';
                optionDiv.dataset.id = option.id;
                
                if (option.icon && (option.icon.includes('.') || option.icon.startsWith('data:'))) {
                    const img = document.createElement('img');
                    img.src = option.icon;
                    img.alt = '';
                    optionDiv.appendChild(img);
                } else {
                    const placeholder = document.createElement('div');
                    placeholder.className = 'icon-placeholder';
                    placeholder.textContent = option.icon || '🔗';
                    optionDiv.appendChild(placeholder);
                }
                
                const optionText = document.createElement('div');
                optionText.className = 'option-text';
                const p = document.createElement('p');
                p.textContent = option.title;
                optionText.appendChild(p);
                optionDiv.appendChild(optionText);
                
                scopeGrid.appendChild(optionDiv);
            });
            
            tabContent.appendChild(scopeGrid);
            contentFragment.appendChild(tabContent);
        });
        
        dom.scopeMenuContentContainer.innerHTML = '';
        dom.scopeMenuContentContainer.appendChild(contentFragment);

        if (scopeTabs.length > 0) {
            state.activeScopeTabId = state.activeScopeTabId && scopeTabs.includes(state.activeScopeTabId) ? state.activeScopeTabId : scopeTabs[0];
            const activeTabButton = dom.tabButtonsContainer.querySelector(`[data-tab-id="${state.activeScopeTabId}"]`);
            if (activeTabButton) activeTabButton.classList.add('active');

            const activeTabContent = dom.scopeMenuContentContainer.querySelector(`#tab-${state.activeScopeTabId.replace(/\s+/g, '-')}`);
            if (activeTabContent) activeTabContent.classList.add('active');
        }
        render.favorites();
    },
    favorites: () => {
        if (!dom.favoritesBar || !dom.favoritesPlaceholder) return;
        const bar = dom.favoritesBar;
        
        // Remove existing chips
        bar.querySelectorAll('.favorite-chip').forEach(chip => chip.remove());
        
        dom.favoritesPlaceholder.style.display = state.userData.favoriteScopes.length === 0 ? 'block' : 'none';
        
        const fragment = document.createDocumentFragment();
        state.userData.favoriteScopes.forEach(favId => {
            const fav = state.userData.scopes.find(s => s.id === favId);
            if (fav) {
                const chip = document.createElement('div');
                chip.className = 'favorite-chip';
                chip.dataset.id = fav.id;
                chip.dataset.action = 'select-scope-option';
                
                if (fav.icon && (fav.icon.includes('.') || fav.icon.startsWith('data:'))) {
                    const img = document.createElement('img');
                    img.src = fav.icon;
                    img.alt = '';
                    chip.appendChild(img);
                } else {
                    const placeholder = document.createElement('div');
                    placeholder.className = 'icon-placeholder';
                    placeholder.textContent = fav.icon || '⭐';
                    chip.appendChild(placeholder);
                }
                
                const span = document.createElement('span');
                span.textContent = fav.title;
                chip.appendChild(span);
                
                const removeBtn = document.createElement('button');
                removeBtn.dataset.action = 'remove-favorite';
                removeBtn.dataset.id = fav.id;
                removeBtn.innerHTML = '&times;';
                chip.appendChild(removeBtn);
                
                fragment.appendChild(chip);
            }
        });
        
        bar.appendChild(fragment);
    },
    customFilters: () => {
        if (!dom.customFiltersContainer) return;
        const container = dom.customFiltersContainer;
        container.innerHTML = '';
        
        const timeFilterContainer = document.createElement('div');
        timeFilterContainer.className = 'custom-select-container';
        const timeFilterBtn = document.createElement('button');
        timeFilterBtn.id = 'time-filter-trigger';
        timeFilterBtn.className = 'custom-select-trigger';
        timeFilterBtn.dataset.dynamicMenu = 'timeRange';
        timeFilterBtn.textContent = '时间';
        timeFilterContainer.appendChild(timeFilterBtn);
        container.appendChild(timeFilterContainer);
        
        const fileFilterContainer = document.createElement('div');
        fileFilterContainer.className = 'custom-select-container';
        const fileFilterBtn = document.createElement('button');
        fileFilterBtn.id = 'file-filter-trigger';
        fileFilterBtn.className = 'custom-select-trigger';
        fileFilterBtn.dataset.dynamicMenu = 'filetype';
        fileFilterBtn.textContent = '文件';
        fileFilterContainer.appendChild(fileFilterBtn);
        container.appendChild(fileFilterContainer);
    },
    scopeManagementModal: () => {
        const manageScopesTabs = document.getElementById('manage-scopes-tabs');
        const manageScopesList = document.getElementById('manage-scopes-list');
        if (!manageScopesTabs || !manageScopesList) {
            console.error('[Render] Scopes elements not found');
            return;
        }
        // 更新dom引用
        dom.manageScopesTabs = manageScopesTabs;
        dom.manageScopesList = manageScopesList;
        
        // 清理之前的事件监听器（使用统一清理函数）
        cleanupEventIds('scopeManagement');
        
        const tabs = [...new Set(state.userData.scopes.map(s => s.tab || '常用'))];
        state.activeScopeManagementTabId = state.activeScopeManagementTabId && tabs.includes(state.activeScopeManagementTabId) ? state.activeScopeManagementTabId : (tabs[0] || '常用');

        // Render tabs
        const tabsFragment = document.createDocumentFragment();
        tabs.forEach(tab => {
            const button = document.createElement('button');
            button.className = `tab-btn ${tab === state.activeScopeManagementTabId ? 'active' : ''}`;
            button.dataset.action = 'switch-scope-management-tab';
            button.dataset.tabId = tab;
            button.textContent = tab;
            tabsFragment.appendChild(button);
        });
        dom.manageScopesTabs.innerHTML = '';
        dom.manageScopesTabs.appendChild(tabsFragment);

        // Render scope list
        const activeScopes = state.userData.scopes.filter(s => (s.tab || '常用') === state.activeScopeManagementTabId);
        const listFragment = document.createDocumentFragment();
        
        activeScopes.forEach((opt, index) => {
            const listItem = document.createElement('div');
            listItem.className = 'list-item';
            listItem.dataset.id = opt.id;
            // 添加 draggable 属性以支持拖放
            listItem.draggable = true;
            
            const itemInfo = document.createElement('div');
            itemInfo.className = 'list-item-info';
            
            const iconPlaceholder = document.createElement('span');
            iconPlaceholder.className = 'icon-placeholder';
            
            if (opt.icon && (opt.icon.includes('.') || opt.icon.startsWith('data:'))) {
                const img = document.createElement('img');
                img.src = opt.icon;
                img.width = 24;
                iconPlaceholder.appendChild(img);
            } else {
                iconPlaceholder.textContent = opt.icon || '🔗';
            }
            
            const title = document.createElement('p');
            title.title = opt.title;
            title.textContent = opt.title;
            
            itemInfo.appendChild(iconPlaceholder);
            itemInfo.appendChild(title);
            
            const actions = document.createElement('div');
            actions.className = 'list-item-actions';
            
            const sortButtons = document.createElement('div');
            sortButtons.className = 'sort-buttons';
            
            const upBtn = document.createElement('button');
            upBtn.className = 'sort-btn';
            upBtn.dataset.action = 'move-scope';
            upBtn.dataset.direction = 'up';
            upBtn.disabled = index === 0;
            upBtn.textContent = '▲';
            
            const downBtn = document.createElement('button');
            downBtn.className = 'sort-btn';
            downBtn.dataset.action = 'move-scope';
            downBtn.dataset.direction = 'down';
            downBtn.disabled = index === activeScopes.length - 1;
            downBtn.textContent = '▼';
            
            sortButtons.appendChild(upBtn);
            sortButtons.appendChild(downBtn);
            
            const editBtn = document.createElement('button');
            editBtn.className = 'footer-btn';
            editBtn.dataset.action = 'edit-scope';
            editBtn.textContent = '编辑';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'footer-btn';
            deleteBtn.dataset.action = 'delete-scope';
            deleteBtn.textContent = '删除';
            
            actions.appendChild(sortButtons);
            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);
            
            listItem.appendChild(itemInfo);
            listItem.appendChild(actions);
            
            listFragment.appendChild(listItem);
        });
        
        // 【P0内存优化】清理旧的图片资源（Blob URL）后再清空innerHTML
        const oldImages = dom.manageScopesList.querySelectorAll('img');
        oldImages.forEach(img => {
            if (img.src && img.src.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(img.src);
                } catch (e) {
                    // ignore
                }
            }
        });
        
        dom.manageScopesList.innerHTML = '';
        dom.manageScopesList.appendChild(listFragment);
        
        // 使用事件委托处理拖拽事件
        const scopeDragHandlers = utils.events.createDragHandlers(
            handlers.onScopeDragStart,
            handlers.onScopeDragOver,
            handlers.onScopeDragEnd,
            handlers.onScopeDrop
        );
        utils.events.bindDragEvents(dom.manageScopesList, '.list-item', scopeDragHandlers, renderEventIds.scopeManagement);
    },
    engineManagementModal: () => {
        const engineList = document.getElementById('engine-list');
        if (!engineList) {
            console.error('[Render] Engine list element not found');
            logger.error('Engine list element not found');
            return;
        }
        // 更新dom引用以使用实时获取的元素
        dom.engineList = engineList;
        
        // 确保userData已初始化
        if (!state.userData) {
            logger.error('User data not initialized');
            return;
        }
        
        // 清理之前的事件监听器（使用统一清理函数）
        cleanupEventIds('engineManagement');
        
        // 如果没有搜索引擎数据，使用默认数据
        const enginesToUse = (state.userData.searchEngines && state.userData.searchEngines.length > 0) ? 
            state.userData.searchEngines : STATIC_CONFIG.DEFAULT_USER_DATA.searchEngines;
        logger.debug('Rendering engine management modal, enginesToUse:', enginesToUse);
        
        // 获取所有唯一的分类标签
        const engineTabs = enginesToUse && enginesToUse.length > 0 ? 
            [...new Set(enginesToUse.map(e => e.tab || '通用'))] : ['通用'];
        state.activeEngineManagementTabId = state.activeEngineManagementTabId && engineTabs.includes(state.activeEngineManagementTabId) ? 
            state.activeEngineManagementTabId : (engineTabs[0] || '通用');
        
        // 渲染分类标签
        const tabsFragment = document.createDocumentFragment();
        engineTabs.forEach(tab => {
            const button = document.createElement('button');
            button.className = `tab-btn ${tab === state.activeEngineManagementTabId ? 'active' : ''}`;
            button.dataset.action = 'switch-engine-management-tab';
            button.dataset.tabId = tab;
            button.textContent = tab;
            tabsFragment.appendChild(button);
        });
        
        // 创建或更新标签容器
        let manageEnginesTabs = document.getElementById('manage-engines-tabs');
        if (!manageEnginesTabs) {
            manageEnginesTabs = document.createElement('div');
            manageEnginesTabs.id = 'manage-engines-tabs';
            manageEnginesTabs.className = 'modal-tabs';
            if (dom.engineList.parentNode) {
                dom.engineList.parentNode.insertBefore(manageEnginesTabs, dom.engineList);
            }
        }
        manageEnginesTabs.innerHTML = '';
        manageEnginesTabs.appendChild(tabsFragment);
        
        // 过滤出当前激活分类的搜索引擎
        const activeEngines = enginesToUse.filter(e => (e.tab || '通用') === state.activeEngineManagementTabId);
        
        // 渲染引擎列表
        const fragment = document.createDocumentFragment();
        activeEngines.forEach((engine, index) => {
            const listItem = document.createElement('div');
            listItem.className = 'list-item';
            listItem.dataset.id = engine.id;
            // 添加 draggable 属性以支持拖放
            listItem.draggable = true;
            
            const itemInfo = document.createElement('div');
            itemInfo.className = 'list-item-info';
            
            const favicon = document.createElement('img');
            favicon.src = engine.icon || 'https://placehold.co/24x24/3c4043/e8eaed?text=?';
            favicon.className = 'dropdown-item-favicon';
            favicon.alt = '';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = engine.name;
            
            itemInfo.appendChild(favicon);
            itemInfo.appendChild(nameSpan);
            
            const actions = document.createElement('div');
            actions.className = 'list-item-actions';
            
            // 添加排序按钮
            const { sortButtons } = utils.modal.createSortButtons(index, activeEngines.length, 'move-engine');
            
            const editBtn = document.createElement('button');
            editBtn.className = 'footer-btn';
            editBtn.dataset.action = 'edit-engine';
            editBtn.textContent = '编辑';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'footer-btn';
            deleteBtn.dataset.action = 'delete-engine';
            deleteBtn.textContent = '删除';
            
            actions.appendChild(sortButtons);
            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);
            
            listItem.appendChild(itemInfo);
            listItem.appendChild(actions);
            
            fragment.appendChild(listItem);
        });
        
        // 【P0内存优化】清理旧的图片资源（Blob URL）后再清空innerHTML
        const oldImages = dom.engineList.querySelectorAll('img');
        oldImages.forEach(img => {
            if (img.src && img.src.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(img.src);
                } catch (e) {
                    // ignore
                }
            }
        });
        
        dom.engineList.innerHTML = '';
        dom.engineList.appendChild(fragment);
        
        // 使用事件委托处理拖拽事件，避免内存泄漏
        renderEventIds.engineManagement.push(
            eventManager.delegate(dom.engineList, 'dragstart', '.list-item', handlers.onEngineDragStart)
        );
        renderEventIds.engineManagement.push(
            eventManager.add(dom.engineList, 'dragover', e => e.preventDefault())
        );
        renderEventIds.engineManagement.push(
            eventManager.delegate(dom.engineList, 'dragend', '.list-item', handlers.onEngineDragEnd)
        );
        renderEventIds.engineManagement.push(
            eventManager.add(dom.engineList, 'drop', handlers.onEngineDrop)
        );
    },
    dynamicFilterManagement: (type) => {
        const listContainer = type === 'timeRange' ? dom.manageTimeFiltersList : dom.manageFileFiltersList;
        if (!listContainer) return;
        const filters = state.userData.dynamicFilters[type];
        const isTime = type === 'timeRange';

        const fragment = document.createDocumentFragment();
        filters.filter(f => f.id !== 'any' && f.value !== 'any').forEach(filter => {
            const id = isTime ? filter.id : filter.value;
            const text = isTime ? filter.name : `${filter.text} (${filter.value})`;
            
            const listItem = document.createElement('div');
            listItem.className = 'list-item';
            listItem.dataset.id = id;
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = text;
            
            const actions = document.createElement('div');
            actions.className = 'list-item-actions';
            
            if (isTime) {
                const editBtn = document.createElement('button');
                editBtn.className = 'footer-btn';
                editBtn.dataset.action = 'edit-time-rule';
                editBtn.textContent = '编辑';
                actions.appendChild(editBtn);
            }
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'footer-btn';
            deleteBtn.dataset.action = 'delete-dynamic-filter';
            deleteBtn.dataset.type = type;
            deleteBtn.textContent = '删除';
            actions.appendChild(deleteBtn);
            
            listItem.appendChild(nameSpan);
            listItem.appendChild(actions);
            
            fragment.appendChild(listItem);
        });
        
        listContainer.innerHTML = '';
        listContainer.appendChild(fragment);
    },

    /**
     * 渲染AI列表
     */
    aiList() {
        const aiList = document.getElementById('ai-list');
        if (!aiList) return;

        // 默认AI数据
        const defaultAIs = [
            {
                id: 'metaso',
                name: '秘塔',
                description: 'AI搜索引擎',
                url: 'https://www.metaso.cn/search?q={query}',
                icon: '🔍',
                showInSearch: true,
                showInFavorites: true
            },
            {
                id: 'kimi',
                name: 'Kimi',
                description: '月之暗面AI助手',
                url: 'https://kimi.moonshot.cn/chat/new?q={query}',
                icon: '🤖',
                showInSearch: true,
                showInFavorites: true
            }
        ];

        // 从用户数据中获取AI设置，如果没有则使用默认值
        const userAIs = state.userData.aiSettings || defaultAIs;

        const fragment = document.createDocumentFragment();

        userAIs.forEach(ai => {
            const listItem = document.createElement('div');
            listItem.className = 'list-item';
            listItem.dataset.id = ai.id;
            
            const info = document.createElement('div');
            info.className = 'list-item-info';
            
            const icon = document.createElement('div');
            icon.className = 'ai-list-icon';
            icon.textContent = ai.icon;
            icon.style.cssText = 'width: 24px; height: 24px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 16px; margin-right: 12px;';
            
            const text = document.createElement('div');
            text.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';
            
            const name = document.createElement('p');
            name.textContent = ai.name;
            name.style.cssText = 'margin: 0; font-weight: 500; font-size: 14px;';
            
            const desc = document.createElement('p');
            desc.textContent = ai.description;
            desc.style.cssText = 'margin: 0; font-size: 12px; color: var(--text-secondary);';
            
            text.appendChild(name);
            text.appendChild(desc);
            
            info.appendChild(icon);
            info.appendChild(text);
            
            const actions = document.createElement('div');
            actions.className = 'list-item-actions';
            
            const visibilityBtn = document.createElement('button');
            visibilityBtn.className = 'footer-btn';
            visibilityBtn.dataset.action = 'toggle-ai-visibility';
            visibilityBtn.dataset.id = ai.id;
            visibilityBtn.textContent = ai.showInSearch ? '隐藏' : '显示';
            actions.appendChild(visibilityBtn);
            
            const editBtn = document.createElement('button');
            editBtn.className = 'footer-btn';
            editBtn.dataset.action = 'edit-ai';
            editBtn.dataset.id = ai.id;
            editBtn.textContent = '编辑';
            actions.appendChild(editBtn);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'footer-btn';
            deleteBtn.dataset.action = 'delete-ai';
            deleteBtn.dataset.id = ai.id;
            deleteBtn.textContent = '删除';
            actions.appendChild(deleteBtn);
            
            listItem.appendChild(info);
            listItem.appendChild(actions);
            
            fragment.appendChild(listItem);
        });
        
        aiList.innerHTML = '';
        aiList.appendChild(fragment);
    }
};