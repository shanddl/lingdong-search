import { state } from './state.js';
import { utils } from './utils.js';
import { render } from './ui/render.js';
import { modalManager } from './ui/modalManager.js';
import { navigationModule } from './features/navigation.js';
import { searchModule } from './features/search.js';
import { aiManager } from './features/ai-manager.js';
import { aiSettings } from './features/ai-settings.js';
import { STATIC_CONFIG } from './constants.js';
import { dom } from './dom.js';
import { core } from './core.js';
import { managementHandlers } from './features/managementHandlers.js';
import { timeRuleHandlers } from './features/timeRuleHandlers.js';
import { sanitizer, domSafe, validator } from './security.js';
import { logger } from './logger.js';
import { openEffectsPanel } from './features/effects-panel.js';
import { timerManager } from './utils/timerManager.js';

// =================================================================
// 事件处理器
// =================================================================
export const handlers = {
    /**
     * 全局按键处理器
     */
    globalKeydownHandler: (e) => {
        // Alt+A 快捷键 - 切换AI搜索（在任何地方都可用，包括输入框内）
        if (e.altKey && (e.key === 'a' || e.key === 'A')) {
            e.preventDefault();
            searchModule.toggleAiSearch();
            return;
        }
        
        // 在输入框、文本域等区域，其他快捷键不生效
        if (e.target.closest('input, textarea, [contenteditable]')) return;
        
        if (e.key === 'Delete' && state.activeSearchPills.length > 0) {
            e.preventDefault();
            state.activeSearchPills.pop();
            render.searchPills();
        }
         if (e.key === 'Escape') {
            // 如果处于批量编辑模式，优先退出批量编辑
            if (navigationModule.state.isBatchEditMode) {
                navigationModule.utils.toggleBatchEditMode();
                return;
            }
            utils.closeAllDropdowns();
            modalManager.hideAll();
        }
    },
    
    /**
     * 全局右键菜单处理器
     */
    globalContextMenuHandler: (e) => {
        // 在输入框、文本域等可编辑区域保留默认右键菜单
        if (e.target.closest('input, textarea, [contenteditable]')) {
            return;
        }
        // 如果点击的是导航项或导航标签，则使用它们自己的专用右键菜单
        if (e.target.closest('.nav-item, .nav-tab')) {
            return; 
        }

        logger.debug('[ContextMenu] Right click detected at:', e.clientX, e.clientY);

        e.preventDefault();
        e.stopPropagation();
        
        // 先关闭其他菜单，但不包括即将显示的右键菜单
        utils.closeAllDropdowns();
        
        // 显示主右键菜单
        if (dom.mainContextMenu) {
            logger.debug('[ContextMenu] Creating menu items...');
            
            // 创建菜单项
            const menuItems = [
                { text: '外观设置', action: 'open-appearance-settings', elementType: 'div' },
                { type: 'divider' },
                { text: navigationModule.state.isBatchEditMode ? '退出批量编辑' : '批量编辑', action: 'toggle-batch-edit', elementType: 'div' },
                { type: 'divider' },
                { text: '刷新页面', action: 'refresh-page', elementType: 'div' }
            ];
            
            // 【优化】使用统一的菜单创建工具函数
            dom.mainContextMenu.innerHTML = '';
            dom.mainContextMenu.appendChild(utils.dom.createContextMenuItems(menuItems));
            utils.dom.applyContextMenuStyle(dom.mainContextMenu, e.clientX, e.clientY);
            
            logger.debug('[ContextMenu] Menu displayed with', menuItems.length - 1, 'items');
        } else {
            logger.error('[ContextMenu] mainContextMenu element not found!');
        }
        
        // 先关闭其他菜单，但不包括即将显示的右键菜单
        utils.closeVisibleMenus(dom.mainContextMenu);
    },
    
    /**
     * 搜索引擎拖拽相关处理函数
     */
    onEngineDragStart: (e) => {
        const item = e.target.closest('.list-item');
        if (item) {
            // 添加拖拽样式
            item.classList.add('dragging');
            // 设置拖拽数据
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.dataset.id);
        }
    },
    
    onEngineDragOver: (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const targetItem = e.target.closest('.list-item');
        if (!targetItem) return;
        
        // 获取拖拽的元素
        const draggedId = e.dataTransfer.getData('text/plain');
        const draggedItem = document.querySelector(`.list-item[data-id="${draggedId}"]`);
        if (!draggedItem || draggedItem === targetItem) return;
        
        // 计算鼠标位置在目标元素的上半部分还是下半部分
        const rect = targetItem.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        
        // 添加视觉指示器
        if (e.clientY < midpoint) {
            // 在目标元素上方插入指示器
            targetItem.classList.add('drag-over-top');
            targetItem.classList.remove('drag-over-bottom');
        } else {
            // 在目标元素下方插入指示器
            targetItem.classList.add('drag-over-bottom');
            targetItem.classList.remove('drag-over-top');
        }
    },
    
    onEngineDragEnd: (e) => {
        // 清理样式
        const items = document.querySelectorAll('.list-item');
        items.forEach(item => {
            item.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
        });
    },
    
    onEngineDrop: (e) => {
        e.preventDefault();
        
        // 清理所有视觉指示器
        const items = document.querySelectorAll('.list-item');
        items.forEach(item => {
            item.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        
        const targetItem = e.target.closest('.list-item');
        if (!targetItem) return;
        
        // 获取拖拽的元素ID
        const draggedId = e.dataTransfer.getData('text/plain');
        if (!draggedId) return;
        
        // 如果拖拽元素和目标元素相同，则不处理
        if (draggedId === targetItem.dataset.id) return;
        
        // 查找拖拽元素和目标元素在数组中的位置
        const engines = state.userData.searchEngines;
        const draggedIndex = engines.findIndex(engine => engine.id === draggedId);
        const targetIndex = engines.findIndex(engine => engine.id === targetItem.dataset.id);
        
        if (draggedIndex === -1 || targetIndex === -1) return;
        
        // 移动元素
        const [movedEngine] = engines.splice(draggedIndex, 1);
        
        // 计算插入位置
        const insertIndex = e.clientY < (targetItem.getBoundingClientRect().top + targetItem.getBoundingClientRect().height / 2) 
            ? targetIndex 
            : targetIndex + 1;
        
        engines.splice(insertIndex, 0, movedEngine);
        
        // 保存并重新渲染
        core.saveUserData(() => {
            render.engineManagementModal();
            render.searchEngineSwitcher();
        });
    },
    
    /**
     * 范围拖拽相关处理函数
     */
    onScopeDragStart: (e) => {
        const item = e.target.closest('.list-item');
        if (item) {
            // 添加拖拽样式
            item.classList.add('dragging');
            // 设置拖拽数据
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.dataset.id);
        }
    },
    
    onScopeDragOver: (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const targetItem = e.target.closest('.list-item');
        if (!targetItem) return;
        
        // 获取拖拽的元素
        const draggedId = e.dataTransfer.getData('text/plain');
        const draggedItem = document.querySelector(`.list-item[data-id="${draggedId}"]`);
        if (!draggedItem || draggedItem === targetItem) return;
        
        // 计算鼠标位置在目标元素的上半部分还是下半部分
        const rect = targetItem.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        
        // 添加视觉指示器
        if (e.clientY < midpoint) {
            // 在目标元素上方插入指示器
            targetItem.classList.add('drag-over-top');
            targetItem.classList.remove('drag-over-bottom');
        } else {
            // 在目标元素下方插入指示器
            targetItem.classList.add('drag-over-bottom');
            targetItem.classList.remove('drag-over-top');
        }
    },
    
    onScopeDragEnd: (e) => {
        // 清理样式
        const items = document.querySelectorAll('.list-item');
        items.forEach(item => {
            item.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
        });
    },
    
    onScopeDrop: (e) => {
        e.preventDefault();
        
        // 清理所有视觉指示器
        const items = document.querySelectorAll('.list-item');
        items.forEach(item => {
            item.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        
        const targetItem = e.target.closest('.list-item');
        if (!targetItem) return;
        
        // 获取拖拽的元素ID
        const draggedId = e.dataTransfer.getData('text/plain');
        if (!draggedId) return;
        
        // 如果拖拽元素和目标元素相同，则不处理
        if (draggedId === targetItem.dataset.id) return;
        
        // 查找拖拽元素和目标元素在数组中的位置
        // 注意：这里需要考虑标签页的过滤
        const activeTabId = state.activeScopeManagementTabId || '常用';
        const tabScopes = state.userData.scopes.filter(s => (s.tab || '常用') === activeTabId);
        const otherScopes = state.userData.scopes.filter(s => (s.tab || '常用') !== activeTabId);
        
        const draggedIndex = tabScopes.findIndex(scope => scope.id === draggedId);
        const targetIndex = tabScopes.findIndex(scope => scope.id === targetItem.dataset.id);
        
        if (draggedIndex === -1 || targetIndex === -1) return;
        
        // 移动元素
        const [movedScope] = tabScopes.splice(draggedIndex, 1);
        
        // 计算插入位置
        const insertIndex = e.clientY < (targetItem.getBoundingClientRect().top + targetItem.getBoundingClientRect().height / 2) 
            ? targetIndex 
            : targetIndex + 1;
        
        tabScopes.splice(insertIndex, 0, movedScope);
        
        // 保存并重新渲染
        core.saveUserData(() => render.scopeManagementModal());
    },
    
    /**
     * 搜索引擎分类标签拖拽相关处理函数
     */
    onEngineTabDragStart: (e) => {
        const tab = e.target.closest('.tab-btn');
        if (tab) {
            // 存储被拖拽的标签元素
            handlers.state = handlers.state || {};
            handlers.state.draggedEngineTab = tab;
            
            // 计算并存储初始位置
            const container = document.getElementById('engine-tab-buttons-container');
            if (container) {
                const tabs = Array.from(container.querySelectorAll('.tab-btn'));
                handlers.state.startingEngineTabIndex = tabs.indexOf(tab);
            }
            
            // 设置拖拽效果
            e.dataTransfer.effectAllowed = 'move';
            
            // 立即添加拖拽样式以提供即时视觉反馈
            tab.classList.add('dragging');
        }
    },
    
    onEngineTabDragEnd: (e) => {
        const tab = e.target.closest('.tab-btn');
        if (tab) {
            // 执行清理：移除拖拽样式
            tab.classList.remove('dragging');
        }
        
        // 重置变量
        if (handlers.state) {
            handlers.state.draggedEngineTab = null;
            handlers.state.startingEngineTabIndex = null;
        }
    },
    
    onEngineTabDragOver: (e) => {
        e.preventDefault();
        
        const tab = e.target.closest('.tab-btn');
        if (!tab) return;
        
        // 检查是否是引擎选项拖拽（通过检查dataTransfer中是否有引擎数据）
        const draggedEngineId = e.dataTransfer.getData('text/plain');
        if (draggedEngineId && draggedEngineId.startsWith('engine_')) {
            // 这是引擎选项拖拽到分类标签上
            e.dataTransfer.dropEffect = 'move';
            return;
        }
        
        // 原有的分类标签拖拽逻辑
        if (!handlers.state || !handlers.state.draggedEngineTab) return;
        
        // 阻止在自身上放置
        if (tab === handlers.state.draggedEngineTab) return;
        
        // 获取目标元素的边界矩形
        const rect = tab.getBoundingClientRect();
        
        // 确定光标在目标元素的左侧还是右侧
        const midpoint = rect.left + rect.width / 2;
        
        // 根据光标位置决定插入位置
        if (e.clientX < midpoint) {
            // 光标在左侧，将拖拽元素插入到目标元素之前
            tab.parentNode.insertBefore(handlers.state.draggedEngineTab, tab);
        } else {
            // 光标在右侧，将拖拽元素插入到目标元素之后
            tab.parentNode.insertBefore(handlers.state.draggedEngineTab, tab.nextSibling);
        }
    },
    
    onEngineTabDrop: (e) => {
        e.preventDefault();
        
        const tab = e.target.closest('.tab-btn');
        if (!tab) return;
        
        // 清理所有分类标签的拖拽高亮效果
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('drag-target');
        });
        
        // 检查是否是引擎选项拖拽到分类标签上
        const draggedEngineId = e.dataTransfer.getData('text/plain');
        const originalTab = e.dataTransfer.getData('application/x-engine-tab');
        
        if (draggedEngineId && draggedEngineId.startsWith('engine_')) {
            // 这是引擎选项拖拽到分类标签上
            const targetTabId = tab.dataset.tabId;
            
            // 查找拖拽的引擎
            const engines = state.userData.searchEngines;
            const draggedIndex = engines.findIndex(engine => engine.id === draggedEngineId);
            if (draggedIndex === -1) return;
            
            // 检查是否跨分类拖拽
            if (originalTab !== targetTabId) {
                // 更新引擎的分类
                engines[draggedIndex].tab = targetTabId;
                
                // 保存并重新渲染
                core.saveUserData(() => {
                    render.searchEngineMenu();
                    render.engineManagementModal();
                    // 切换到目标分类显示结果
                    state.activeEngineTabId = targetTabId;
                    const targetTabButton = dom.engineTabButtonsContainer.querySelector(`[data-tab-id="${targetTabId}"]`);
                    if (targetTabButton) {
                        targetTabButton.click();
                    }
                });
            }
            return;
        }
        
        // 原有的分类标签拖拽逻辑
        if (!handlers.state || !handlers.state.draggedEngineTab || handlers.state.startingEngineTabIndex === null) return;
        
        // 计算最终索引
        const container = document.getElementById('engine-tab-buttons-container');
        if (!container) return;
        
        const tabs = Array.from(container.querySelectorAll('.tab-btn'));
        const finalIndex = tabs.indexOf(handlers.state.draggedEngineTab);
        
        // 比较起始索引和最终索引
        if (handlers.state.startingEngineTabIndex !== finalIndex) {
            // 获取所有搜索引擎
            const engines = state.userData.searchEngines || [];
            
            // 获取所有唯一的分类标签
            const engineTabs = engines && engines.length > 0 ? 
                [...new Set(engines.map(e => e.tab || '通用'))] : ['通用'];
            
            // 使用splice方法移动数组中的元素以匹配新的DOM顺序
            if (engineTabs.length > finalIndex && engineTabs.length > handlers.state.startingEngineTabIndex) {
                const [movedTab] = engineTabs.splice(handlers.state.startingEngineTabIndex, 1);
                engineTabs.splice(finalIndex, 0, movedTab);
                
                // 重新排序搜索引擎，使它们按照新的标签顺序排列
                const reorderedEngines = [];
                engineTabs.forEach(tab => {
                    const tabEngines = engines.filter(e => (e.tab || '通用') === tab);
                    reorderedEngines.push(...tabEngines);
                });
                
                // 更新搜索引擎顺序
                state.userData.searchEngines = reorderedEngines;
                
                // 保存数据
                core.saveUserData(() => {
                    // 重新渲染搜索引擎菜单和管理模态框
                    render.searchEngineMenu();
                    render.engineManagementModal();
                });
            }
        }
    },
    
    /**
     * 搜索引擎选项拖拽相关处理函数
     */
    onEngineOptionDragStart: (e) => {
        const option = e.target.closest('.option');
        if (option) {
            // 添加拖拽样式
            option.classList.add('dragging');
            // 设置拖拽数据
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', option.dataset.engineId);
            // 存储原始分类
            e.dataTransfer.setData('application/x-engine-tab', option.dataset.tab);
        }
    },
    
    onEngineOptionDragOver: (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const targetOption = e.target.closest('.option');
        if (!targetOption) return;
        
        // 获取拖拽的元素
        const draggedId = e.dataTransfer.getData('text/plain');
        const draggedOption = document.querySelector(`.option[data-engine-id="${draggedId}"]`);
        if (!draggedOption || draggedOption === targetOption) return;
        
        // 计算鼠标位置在目标元素的上半部分还是下半部分
        const rect = targetOption.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        
        // 添加视觉指示器
        if (e.clientY < midpoint) {
            // 在目标元素上方插入指示器
            targetOption.classList.add('drag-over-top');
            targetOption.classList.remove('drag-over-bottom');
        } else {
            // 在目标元素下方插入指示器
            targetOption.classList.add('drag-over-bottom');
            targetOption.classList.remove('drag-over-top');
        }
    },
    
    onEngineOptionDragEnd: (e) => {
        // 清理样式
        const options = document.querySelectorAll('.option');
        options.forEach(option => {
            option.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
        });
        
        // 清理所有分类标签和分类内容的高亮效果
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('drag-target');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('drag-over');
        });
    },
    
    onEngineOptionDrop: (e) => {
        e.preventDefault();
        
        // 清理所有视觉指示器
        const options = document.querySelectorAll('.option');
        options.forEach(option => {
            option.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        
        const targetOption = e.target.closest('.option');
        const targetTabContent = e.target.closest('.tab-content');
        
        // 如果没有目标选项但有目标分类容器，说明是拖拽到空分类
        if (!targetOption && targetTabContent) {
            // 获取拖拽的元素ID和原始分类
            const draggedId = e.dataTransfer.getData('text/plain');
            const originalTab = e.dataTransfer.getData('application/x-engine-tab');
            if (!draggedId) return;
            
            // 查找拖拽元素
            const engines = state.userData.searchEngines;
            const draggedIndex = engines.findIndex(engine => engine.id === draggedId);
            if (draggedIndex === -1) return;
            
            // 获取目标分类
            const targetTabId = targetTabContent.id.replace('engine-tab-', '').replace(/-/g, ' ');
            
            // 更新引擎的分类
            engines[draggedIndex].tab = targetTabId;
            
            // 保存并重新渲染
            core.saveUserData(() => {
                render.searchEngineMenu();
                render.engineManagementModal();
            });
            return;
        }
        
        if (!targetOption) return;
        
        // 获取拖拽的元素ID和原始分类
        const draggedId = e.dataTransfer.getData('text/plain');
        const originalTab = e.dataTransfer.getData('application/x-engine-tab');
        if (!draggedId) return;
        
        // 如果拖拽元素和目标元素相同，则不处理
        if (draggedId === targetOption.dataset.engineId) return;
        
        // 查找拖拽元素和目标元素在数组中的位置
        const engines = state.userData.searchEngines;
        const draggedIndex = engines.findIndex(engine => engine.id === draggedId);
        const targetIndex = engines.findIndex(engine => engine.id === targetOption.dataset.engineId);
        
        if (draggedIndex === -1 || targetIndex === -1) return;
        
        // 检查是否跨分类拖拽
        const targetTabId = targetOption.dataset.tab;
        const isCrossTab = originalTab !== targetTabId;
        
        if (isCrossTab) {
            // 跨分类拖拽：更新引擎的分类属性
            engines[draggedIndex].tab = targetTabId;
            
            // 重新排序：将元素移动到目标位置
            const [movedEngine] = engines.splice(draggedIndex, 1);
            
            // 计算插入位置
            const insertIndex = e.clientY < (targetOption.getBoundingClientRect().top + targetOption.getBoundingClientRect().height / 2) 
                ? targetIndex 
                : targetIndex + 1;
            
            engines.splice(insertIndex, 0, movedEngine);
        } else {
            // 同分类拖拽：仅重新排序
            const [movedEngine] = engines.splice(draggedIndex, 1);
            
            // 计算插入位置
            const insertIndex = e.clientY < (targetOption.getBoundingClientRect().top + targetOption.getBoundingClientRect().height / 2) 
                ? targetIndex 
                : targetIndex + 1;
            
            engines.splice(insertIndex, 0, movedEngine);
        }
        
        // 保存并重新渲染
        core.saveUserData(() => {
            render.searchEngineMenu();
            render.engineManagementModal();
        });
    },

    /**
     * 范围选项点击处理器
     */
    handleScopeOptionClick: (scope, event) => {
        if (event.altKey) {
            if (scope.sites && scope.sites.length > 0) {
                scope.sites.forEach(site => utils.addPill({ type: 'site', label: `网站:${site}`, queryPart: `site:${site}` }));
            }
            if (scope.excludeKeywords) {
                scope.excludeKeywords.split(/\s+/).filter(Boolean).forEach(k => utils.addPill({ type: 'exclude', label: `排除:${k}`, queryPart: `-${k}` }));
            }
            if (scope.filetype && scope.filetype !== 'any') {
                const filetypeOption = state.userData.dynamicFilters.filetype.find(f => f.value === scope.filetype);
                utils.addPill({ type: 'filetype', label: `文件:${filetypeOption ? filetypeOption.text : scope.filetype}`, queryPart: `filetype:${scope.filetype}` });
            }
            if (scope.timeRange && scope.timeRange !== 'any') {
                utils.applyTimeRule(scope.timeRange);
            }
            if (scope.after) utils.addPill({ type: 'after', label: `之后:${scope.after}`, queryPart: `after:${scope.after}` });
            if (scope.before) utils.addPill({ type: 'before', label: `之前:${scope.before}`, queryPart: `before:${scope.before}` });
            if (scope.intitle) utils.addPill({ type: 'intitle', label: `标题含:${scope.intitle}`, queryPart: `intitle:"${scope.intitle}"` });
            if (scope.intext) utils.addPill({ type: 'intext', label: `正文含:${scope.intext}`, queryPart: `intext:"${scope.intext}"` });
            return;
        }

        const queryParts = [];
        if (scope.sites && scope.sites.length > 0) {
            const siteQuery = scope.sites.map(s => `site:${s}`).join(' OR ');
            queryParts.push(scope.sites.length > 1 ? `(${siteQuery})` : siteQuery);
        }
        if (scope.excludeKeywords) {
            queryParts.push(...scope.excludeKeywords.split(/\s+/).filter(Boolean).map(k => `-${k}`));
        }
        if (scope.filetype && scope.filetype !== 'any') queryParts.push(`filetype:${scope.filetype}`);
        if (scope.after) queryParts.push(`after:${scope.after}`);
        if (scope.before) queryParts.push(`before:${scope.before}`);
        if (scope.intitle) queryParts.push(`intitle:"${scope.intitle}"`);
        if (scope.intext) queryParts.push(`intext:"${scope.intext}"`);

        utils.addPill({ type: 'scope', scopeId: scope.id, label: scope.title, queryPart: queryParts.join(' ')});

        if (scope.timeRange && scope.timeRange !== 'any') {
            utils.applyTimeRule(scope.timeRange);
        }
    },
    
    /**
     * 更新搜索容器状态
     */
    updateSearchContainerState: searchModule.updateSearchContainerState,

    /**
     * 全局拖拽相关处理函数
     */
    globalDragOverHandler: (e) => {
        // 检查是否是书签拖拽
        const dataTransfer = e.dataTransfer;
        if (dataTransfer && dataTransfer.types) {
            const types = Array.from(dataTransfer.types);
            
            // 检查是否是书签类型（text/uri-list 或 text/html）
            const isBookmark = types.some(type => 
                type === 'text/uri-list' || 
                type === 'text/html' || 
                type === 'text/x-moz-url' ||
                type === 'text/plain'
            );
            
            if (isBookmark && dom.navigationGrid) {
                // 使用坐标检查是否在导航网格上
                const rect = dom.navigationGrid.getBoundingClientRect();
                const isOverNavGrid = e.clientX >= rect.left && 
                                      e.clientX <= rect.right && 
                                      e.clientY >= rect.top && 
                                      e.clientY <= rect.bottom;
                
                if (isOverNavGrid) {
                    // 允许放置书签
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    
                    // 在导航网格上添加视觉反馈
                    dom.navigationGrid.classList.add('drag-over-bookmark');
                } else {
                    // 如果不在导航网格上，清理样式
                    dom.navigationGrid.classList.remove('drag-over-bookmark');
                }
            }
        }
    },
    
    globalDragLeaveHandler: (e) => {
        // 当鼠标离开页面时清理样式
        if (!e.relatedTarget || !document.body.contains(e.relatedTarget)) {
            if (dom.navigationGrid) {
                dom.navigationGrid.classList.remove('drag-over-bookmark');
            }
        }
    },
    
    globalDropHandler: async (e) => {
        // 清理视觉反馈
        if (dom.navigationGrid) {
            dom.navigationGrid.classList.remove('drag-over-bookmark');
        }
        
        // 检查是否是书签拖拽
        const dataTransfer = e.dataTransfer;
        if (!dataTransfer || !dataTransfer.types) return;
        
        const types = Array.from(dataTransfer.types);
        const isBookmark = types.some(type => 
            type === 'text/uri-list' || 
            type === 'text/html' || 
            type === 'text/x-moz-url' ||
            type === 'text/plain'
        );
        
        if (!isBookmark) return;
        
        // 检查是否在导航容器内（使用坐标检查更准确）
        const navGrid = dom.navigationGrid;
        if (!navGrid) return;
        
        const rect = navGrid.getBoundingClientRect();
        const isOverNavGrid = e.clientX >= rect.left && 
                              e.clientX <= rect.right && 
                              e.clientY >= rect.top && 
                              e.clientY <= rect.bottom;
        
        if (!isOverNavGrid) return;
        
        // 阻止默认行为
        e.preventDefault();
        
        // 尝试获取URL
        let url = null;
        let title = '';
        
        try {
            // 优先尝试从 text/html 中解析
            const html = dataTransfer.getData('text/html');
            if (html) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const link = doc.querySelector('a[href]');
                if (link && link.href) {
                    url = link.href;
                    title = link.textContent.trim();
                }
            }
            
            // 如果没有从HTML获取到，尝试直接获取URL
            if (!url) {
                url = dataTransfer.getData('text/x-moz-url') || 
                      dataTransfer.getData('text/uri-list') || 
                      dataTransfer.getData('url');
            }
            
            // 如果还是没有，尝试获取文本内容
            if (!url) {
                url = dataTransfer.getData('text/plain');
            }
            
            // 清理URL（移除换行符和多余的空白）
            if (url) {
                // 移除可能的URL标题分隔符（格式: URL\ntitle）
                url = url.split('\n')[0].trim();
            }
            
            // 如果没有标题，尝试从书签API获取（支持中文标题）
            if ((!title || title.trim() === '') && url) {
                try {
                    // 使用书签API查询，与扩展图标添加原理相同
                    if (typeof chrome !== 'undefined' && chrome.bookmarks) {
                        const bookmarks = await chrome.bookmarks.search({url: url});
                        if (bookmarks && bookmarks.length > 0 && bookmarks[0].title) {
                            title = bookmarks[0].title;
                            logger.info('从书签API获取到标题:', title);
                        }
                    }
                } catch (err) {
                    logger.warn('书签API查询失败:', err);
                }
            }
            
            // 如果还是没有标题，从URL中提取（降级方案）
            if (!title && url) {
                try {
                    const urlObj = new URL(url);
                    title = urlObj.hostname.replace('www.', '').split('.')[0];
                } catch (err) {
                    title = '新网站';
                }
            }
            
            // 验证URL
            if (!url) {
                logger.warn('无法从拖拽数据中获取URL');
                return;
            }
            
            // 如果URL不包含协议，添加https://
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            
            // 验证URL格式
            try {
                new URL(url); // 如果URL无效会抛出异常
            } catch (urlErr) {
                logger.warn('无效的URL格式:', url);
                return;
            }
            
            // 调用书签处理函数
            handlers.handleBookmarkDrop(url, title);
            
        } catch (err) {
            logger.error('书签拖拽处理失败:', err);
        }
    },
    
    /**
     * 处理从书签栏拖拽到导航的书签
     */
    handleBookmarkDrop: (url, title) => {
        // 使用安全工具转义标题
        const safeTitle = sanitizer.escapeHtml(title) || '新网站';
        
        // 获取当前活跃的导航组
        const currentGroup = state.userData.navigationGroups.find(
            g => g.id === state.activeNavigationGroupId
        );
        
        if (!currentGroup) {
            return;
        }
        
        // 检查是否已存在相同的URL
        const isDuplicate = currentGroup.items.some(item => item.url === url);
        
        if (isDuplicate) {
            // 使用安全的提示对话框
            return;
        }
        
        // 直接添加，无需确认
        // 生成图标URL（使用AI管理器获取第一个推荐的图标源）
        let iconUrl = '';
        try {
            const urlObj = new URL(url);
            // 使用AI管理器的图标源，获取第一个（首选icon.bqb.cool）
            const sources = aiManager.getIconSources(url);
            if (sources && sources.length > 0) {
                iconUrl = sources[0].url; // 使用第一个图标源（icon.bqb.cool，首选）
            } else {
                // 如果获取失败，使用直链favicon作为fallback
                iconUrl = `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
            }
            // 使用安全工具清理图标URL
            iconUrl = sanitizer.sanitizeIconUrl(iconUrl);
        } catch (err) {
            logger.warn('无法生成图标URL:', err);
            // 使用默认占位图标作为fallback
            iconUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHJ4PSI0IiBmaWxsPSIjNEE1NTY4Ii8+PHBhdGggZD0iTTEyIDdWMTdNNyAxMkgxNyIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=';
        }
        
        // 创建新的导航项
        const newNavItem = {
            id: `nav_item_${Date.now()}`,
            title: safeTitle,
            url: url,
            icon: iconUrl
        };
        
        // 添加到当前导航组
        currentGroup.items.push(newNavItem);
        
        // 保存数据
        core.saveUserData((err) => {
            if (!err) {
                navigationModule.render.grid();
            }
        });
    },

};

// =================================================================
// 辅助函数 - Helper Functions
// =================================================================

/**
 * 通用的图标源测试函数（使用iconSourceTester统一处理）
 * @param {string} urlInputId - URL输入框的ID
 * @param {string} iconSourcesListId - 图标源列表容器的ID
 * @param {string} iconSourcesContentId - 图标源内容容器的ID
 * @param {string} iconUrlInputId - 图标URL输入框的ID
 * @param {string} iconPreviewId - 图标预览的ID
 */
async function testIconSourcesCommon(urlInputId, iconSourcesListId, iconSourcesContentId, iconUrlInputId, iconPreviewId) {
    const urlInput = document.getElementById(urlInputId);
    
    if (!urlInput || !urlInput.value.trim()) {
        return;
    }
    
    // 使用统一的iconSourceTester
    try {
        const { iconSourceTester } = await import('./utils/iconHelper.js');
        await iconSourceTester.test(
            urlInput.value.trim(),
            urlInputId,
            iconSourcesListId,
            iconSourcesContentId,
            iconUrlInputId,
            iconPreviewId
        );
    } catch (importError) {
        logger.error('导入iconHelper模块失败:', importError);
        console.error('[ERROR] 导入iconHelper模块失败:', importError);
        throw importError;
    }
}

// =================================================================
// Action Handler Map - maps data-action values to handler functions
// =================================================================
const actionHandlers = {
    // Pill actions
    'remove-pill': (target) => {
        const index = target.dataset.index;
        if (index) {
            state.activeSearchPills.splice(parseInt(index, 10), 1);
            render.searchPills();
        }
    },
    'remove-history-item': (target) => {
        const index = target.dataset.index;
        if (index) {
            state.userData.searchHistory.splice(parseInt(index, 10), 1);
            core.saveUserData(() => render.suggestions(state.userData.searchHistory, 'history'));
        }
    },
    'select-suggestion': (target) => {
        // target 现在是文本元素，需要找到父容器获取 value
        const suggestionItem = target.closest('.suggestion-item');
        if (dom.realSearchInput && suggestionItem) {
            dom.realSearchInput.value = suggestionItem.dataset.value;
        }
        utils.closeAllDropdowns();
        core.initiateSearch();
    },
    'select-bookmark': (target) => {
        const bookmarkUrl = target.closest('.suggestion-item').dataset.value;
        if (bookmarkUrl) {
            window.open(bookmarkUrl, '_blank');
            utils.closeAllDropdowns();
        }
    },
    
    // Engine actions
    'switch-engine': (target) => {
        state.userData.activeSearchEngineId = target.dataset.engineId;
        core.saveUserData(() => render.searchEngineSwitcher());
        utils.closeAllDropdowns();
    },
    'manage-engines': async () => {
        logger.debug('[manage-engines] Handler called');
        // 【修复】先打开面板，再关闭菜单，避免面板被关闭
        try {
            // 打开统一设置面板并切换到搜索Tab
            const { openEffectsPanel } = await import('./features/effects-panel.js');
            logger.debug('[manage-engines] Opening effects panel');
            openEffectsPanel();
            
            // 切换到搜索Tab并展开引擎管理手风琴（使用timerManager统一管理，避免内存泄漏）
            timerManager.clearTimeout('handlers-manage-engines-tab');
            timerManager.setTimeout('handlers-manage-engines-tab', () => {
                const panel = document.getElementById('effectsSettingsPanel');
                logger.debug('[manage-engines] Panel found:', !!panel);
                if (panel) {
                    const searchTab = panel.querySelector('[data-tab="search"]');
                    logger.debug('[manage-engines] Search tab found:', !!searchTab);
                    if (searchTab) {
                        searchTab.click();
                        
                        // 展开引擎管理手风琴（数据渲染由面板自动处理）
                        timerManager.clearTimeout('handlers-manage-engines-accordion');
                        timerManager.setTimeout('handlers-manage-engines-accordion', () => {
                            const engineAccordion = panel.querySelector('[data-accordion="engine-management"]');
                            logger.debug('[manage-engines] Engine accordion found:', !!engineAccordion);
                            if (engineAccordion && !engineAccordion.classList.contains('expanded')) {
                                const header = engineAccordion.querySelector('.effects-accordion-header');
                                if (header) {
                                    header.click();
                                }
                            }
                        }, 100);
                    }
                }
            }, 100);
            
            // 最后关闭下拉菜单
            utils.closeAllDropdowns();
        } catch (error) {
            logger.error('[manage-engines] Error:', error);
        }
    },
    'open-settings': () => {
        logger.debug('[open-settings] Handler called');
        // 【修复】先打开面板，再关闭菜单，避免面板被关闭
        try {
            // 打开统一设置面板并切换到系统Tab
            import('./features/effects-panel.js').then(module => {
                logger.debug('[open-settings] Opening effects panel');
                module.openEffectsPanel();
                
                // 切换到系统Tab（使用timerManager统一管理，避免内存泄漏）
                timerManager.clearTimeout('handlers-open-settings-tab');
                timerManager.setTimeout('handlers-open-settings-tab', () => {
                    const panel = document.getElementById('effectsSettingsPanel');
                    logger.debug('[open-settings] Panel found:', !!panel);
                    if (panel) {
                        const systemTab = panel.querySelector('[data-tab="system"]');
                        logger.debug('[open-settings] System tab found:', !!systemTab);
                        if (systemTab) {
                            systemTab.click();
                        }
                    }
                }, 100);
            }).catch(error => {
                logger.error('[open-settings] Error:', error);
            });
            
            // 最后关闭下拉菜单
            utils.closeAllDropdowns();
        } catch (error) {
            logger.error('[open-settings] Error:', error);
        }
    },
    
    // Settings actions
    'import-settings': () => {
        const input = document.createElement('input');
        input.type = 'file'; 
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0]; 
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);
                    
                    // 数据迁移：为旧版本的AI数据添加websiteUrl字段
                    if (importedData.aiSettings && Array.isArray(importedData.aiSettings)) {
                        importedData.aiSettings = importedData.aiSettings.map(ai => {
                            if (!ai.websiteUrl && ai.url) {
                                // 如果没有websiteUrl，使用url作为websiteUrl
                                ai.websiteUrl = ai.url.replace('{query}', '');
                            }
                            return ai;
                        });
                    }
                    
                    // 使用与 loadUserData 相同的合并策略，确保数据一致性
                    const defaultData = JSON.parse(JSON.stringify(STATIC_CONFIG.DEFAULT_USER_DATA));
                    
                    // 先进行基础合并（与 loadUserData 保持一致）
                    const mergedData = {
                        ...defaultData,
                        ...importedData,
                        // 深度合并导航组，确保用户创建的分类不会丢失
                        navigationGroups: importedData.navigationGroups || [...defaultData.navigationGroups],
                        // 深度合并动态过滤器
                        dynamicFilters: { 
                            ...defaultData.dynamicFilters, 
                            ...(importedData.dynamicFilters || {})
                        }
                    };
                    
                    // 验证和修复动态过滤器（与 loadUserData 保持一致）
                    if (!mergedData.dynamicFilters || !mergedData.dynamicFilters.timeRange || 
                        mergedData.dynamicFilters.timeRange.some(r => typeof r === 'object' && r.hasOwnProperty('value'))) {
                        mergedData.dynamicFilters = defaultData.dynamicFilters;
                    }
                    
                    // 验证搜索引擎（与 loadUserData 保持一致）
                    if (!mergedData.searchEngines || !Array.isArray(mergedData.searchEngines) || mergedData.searchEngines.length === 0) {
                        mergedData.searchEngines = [...defaultData.searchEngines];
                    }
                    
                    // 确保活跃搜索引擎存在（与 loadUserData 保持一致）
                    if (mergedData.searchEngines && mergedData.searchEngines.length > 0) {
                        const activeEngineExists = mergedData.searchEngines.some(e => e && e.id === mergedData.activeSearchEngineId);
                        if (!activeEngineExists) {
                            mergedData.activeSearchEngineId = mergedData.searchEngines[0].id;
                        }
                    } else {
                        // 极端情况：searchEngines为空，重置为默认值
                        mergedData.searchEngines = [...defaultData.searchEngines];
                        mergedData.activeSearchEngineId = defaultData.searchEngines[0].id;
                    }
                    
                    // 验证导航组（与 loadUserData 保持一致）
                    if (!mergedData.navigationGroups || !Array.isArray(mergedData.navigationGroups) || mergedData.navigationGroups.length === 0) {
                        mergedData.navigationGroups = [...defaultData.navigationGroups];
                        mergedData.activeNavigationGroupId = defaultData.activeNavigationGroupId;
                    } else {
                        // 验证活跃导航组ID
                        const activeGroupExists = mergedData.navigationGroups.some(g => g && g.id === mergedData.activeNavigationGroupId);
                        if (!activeGroupExists) {
                            mergedData.activeNavigationGroupId = mergedData.navigationGroups[0].id;
                        }
                    }
                    
                    // 验证引擎设置（与 loadUserData 保持一致）
                    if (!mergedData.engineSettings || typeof mergedData.engineSettings !== 'object') {
                        mergedData.engineSettings = defaultData.engineSettings ? { ...defaultData.engineSettings } : { size: 16, spacing: 8 };
                    } else {
                        // 确保 size 和 spacing 字段存在
                        if (typeof mergedData.engineSettings.size !== 'number') {
                            mergedData.engineSettings.size = 16;
                        }
                        if (typeof mergedData.engineSettings.spacing !== 'number') {
                            mergedData.engineSettings.spacing = 8;
                        }
                    }
                    
                    // AI数据迁移：为旧版本的AI数据添加websiteUrl字段（与 loadUserData 保持一致）
                    if (mergedData.aiSettings && Array.isArray(mergedData.aiSettings)) {
                        mergedData.aiSettings = mergedData.aiSettings.map(ai => {
                            if (!ai.websiteUrl && ai.url) {
                                // 如果没有websiteUrl，使用url作为websiteUrl
                                ai.websiteUrl = ai.url.replace('{query}', '');
                            }
                            return ai;
                        });
                    }
                    
                    // 使用安全的确认对话框
                    domSafe.showConfirm(
                        '您确定要导入设置吗？\n当前设置将被覆盖。',
                        () => {
                            state.userData = mergedData;
                            core.saveUserData(err => {
                                if (err) {
                                    domSafe.showAlert('导入失败：保存数据时出错。', 'error');
                                    return;
                                }
                                core.loadUserData(); // Reload all settings and UI
                                domSafe.showAlert('导入成功！', 'success');
                            });
                        }
                    );
                } catch (err) { 
                    // 使用安全的错误提示对话框
                    logger.error('导入失败:', err);
                    domSafe.showAlert('导入失败：文件无法解析。请确保文件格式正确。', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    },
    'export-settings': () => {
        const dataStr = JSON.stringify(state.userData, null, 2);
        const blob = new Blob([dataStr], {type: "application/json"});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `灵动搜索备份_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    },
    
    // Scope management actions
    'edit-scope': (target) => {
        const listItem = target.closest('.list-item');
        if(listItem) {
            managementHandlers.showScopeEditor(state.userData.scopes.find(s => s.id === listItem.dataset.id));
        }
    },
    'delete-scope': (target) => {
        const listItem = target.closest('.list-item');
        if(listItem) {
            managementHandlers.deleteScope(listItem.dataset.id);
        }
    },
    'move-scope': (target) => {
        const listItem = target.closest('.list-item');
        const direction = target.dataset.direction;
        if(listItem) {
            managementHandlers.moveScope(listItem.dataset.id, direction);
        }
    },
    
    // Engine management actions
    'edit-engine': (target) => {
        const listItem = target.closest('.list-item');
        if(listItem) {
            const engine = state.userData.searchEngines.find(eng => eng.id === listItem.dataset.id);
            if (engine) {
                // 先重置表单
                managementHandlers.resetEngineForm();
                
                // 然后填充表单数据
                dom.engineEditId.value = engine.id;
                dom.engineName.value = engine.name;
                dom.engineUrl.value = engine.url;
                dom.engineIconUrl.value = engine.icon || '';
                dom.engineTab.value = engine.tab || '通用';  // 填充分类信息
                
                // 更新表单标题和取消按钮状态
                dom.engineFormTitle.textContent = '编辑引擎';
                dom.engineFormCancel.classList.remove('hidden');
                
                // 更新预览图
                if (dom.engineIconPreview) {
                    dom.engineIconPreview.src = engine.icon || 'https://placehold.co/24x24/3c4043/e8eaed?text=?';
                }
            }
        }
    },
    'delete-engine': (target) => {
        const listItem = target.closest('.list-item');
        if(listItem) {
            const id = listItem.dataset.id;
            const engine = state.userData.searchEngines.find(eng => eng.id === id);
            if(engine) {
                // 使用安全的确认对话框（转义用户输入）
                domSafe.showConfirm(
                    `确定要删除搜索引擎\n"${sanitizer.escapeHtml(engine.name)}"\n吗？`,
                    () => {
                        state.userData.searchEngines = state.userData.searchEngines.filter(eng => eng.id !== id);
                        core.saveUserData(err => {
                            if(err) return;
                            render.engineManagementModal();
                            render.searchEngineSwitcher();
                        });
                    }
                );
            }
        }
    },
    // 添加移动搜索引擎的处理器
    'move-engine': (target) => {
        const listItem = target.closest('.list-item');
        if (listItem) {
            const id = listItem.dataset.id;
            const direction = target.closest('[data-direction]').dataset.direction;
            managementHandlers.moveEngine(id, direction);
        }
    },
    
    // Favorite actions
    'remove-favorite': (target) => {
        const id = target.dataset.id;
        if (id) {
            state.userData.favoriteScopes = state.userData.favoriteScopes.filter(favId => favId !== id);
            core.saveUserData(err => {
                if (err) return;
                render.favorites();
            });
        }
    },
    
    // Time filter actions
    'edit-time-rule': (target) => {
        const listItem = target.closest('.list-item');
        if(listItem) {
            timeRuleHandlers.editRule(listItem.dataset.id);
        }
    },
    'delete-dynamic-filter': (target) => {
        const listItem = target.closest('.list-item');
        const type = target.dataset.type;
        if (listItem) {
            if (type === 'timeRange') timeRuleHandlers.deleteRule(listItem.dataset.id);
            if (type === 'filetype') managementHandlers.deleteFileFilter(listItem.dataset.id);
        }
    },
    
    // Modal actions
    'close-modal': (target) => {
        const modal = target.closest('.modal-overlay');
        if (modal) modal.classList.remove('visible');
    },
    
    // Search actions
    'search-submit': () => {
        core.initiateSearch();
    },
    'clear-history': () => {
        state.userData.searchHistory = [];
        core.saveUserData(() => searchModule.debouncedShowSuggestions(true));
    },
    'clear-pills': () => {
        state.activeSearchPills = [];
        render.searchPills();
    },
    'manage-scopes': async () => {
        utils.closeAllDropdowns();
        
        // 打开统一设置面板并切换到搜索Tab
        const { openEffectsPanel } = await import('./features/effects-panel.js');
        openEffectsPanel();
        
        // 切换到搜索Tab并展开范围管理手风琴（使用timerManager统一管理，避免内存泄漏）
        timerManager.clearTimeout('handlers-manage-scopes-tab');
        timerManager.setTimeout('handlers-manage-scopes-tab', () => {
            const panel = document.getElementById('effectsSettingsPanel');
            const searchTab = panel?.querySelector('[data-tab="search"]');
            if (searchTab) searchTab.click();
            
            // 展开范围管理手风琴（数据渲染由面板自动处理）
            timerManager.clearTimeout('handlers-manage-scopes-accordion');
            timerManager.setTimeout('handlers-manage-scopes-accordion', () => {
                const scopeAccordion = panel?.querySelector('[data-accordion="scope-management"]');
                if (scopeAccordion && !scopeAccordion.classList.contains('expanded')) {
                    scopeAccordion.querySelector('.effects-accordion-header').click();
                }
            }, 100);
        }, 100);
    },
    'add-new-scope': () => {
        managementHandlers.showScopeEditor();
    },
    'cancel-scope-edit': () => {
        managementHandlers.showScopeList();
    },
    'save-scope': () => {
        managementHandlers.saveScope();
    },
    'engine-form-cancel': () => {
        managementHandlers.resetEngineForm();
    },
    
    'test-icon-sources': async () => {
        // AI设置的图标源测试
        logger.debug('test-icon-sources handler 被调用');
        console.log('[DEBUG] test-icon-sources handler 开始执行');
        try {
            const urlInput = document.getElementById('ai-search-url');
            logger.debug('AI搜索URL输入框:', { 
                exists: !!urlInput, 
                value: urlInput?.value,
                trimmed: urlInput?.value?.trim()
            });
            await testIconSourcesCommon('ai-search-url', 'icon-sources-list', 'icon-sources-content', 'ai-icon-url', 'ai-icon-preview');
            console.log('[DEBUG] test-icon-sources handler 执行完成');
        } catch (error) {
            logger.error('test-icon-sources 执行失败:', error);
            console.error('[ERROR] test-icon-sources 执行失败:', error);
        }
    },
    
    'test-engine-icon-sources': async () => {
        // 搜索引擎的图标源测试（使用iconSourceTester）
        logger.debug('test-engine-icon-sources handler 被调用');
        console.log('[DEBUG] test-engine-icon-sources handler 开始执行');
        const engineUrl = document.getElementById('engine-url');
        
        if (!engineUrl || !engineUrl.value.trim()) {
            return;
        }
        
        try {
            // 从搜索网址中提取基础URL（移除{query}等参数）
            let searchUrl = engineUrl.value.trim();
            
            // 移除查询参数部分（包括{query}占位符）
            if (searchUrl.includes('?')) {
                searchUrl = searchUrl.split('?')[0];
            }
            
            // 如果URL不完整，尝试补全
            if (!searchUrl.startsWith('http://') && !searchUrl.startsWith('https://')) {
                searchUrl = 'https://' + searchUrl;
            }
            
            // 解析URL获取origin（协议+域名+端口）
            const urlObj = new URL(searchUrl);
            const baseUrl = urlObj.origin;
            
            try {
                const { iconSourceTester } = await import('./utils/iconHelper.js');
                await iconSourceTester.test(
                    baseUrl,
                    'engine-url',
                    'engine-icon-sources-list',
                    'engine-icon-sources-content',
                    'engine-icon-url',
                    'engine-icon-preview'
                );
            } catch (importError) {
                logger.error('导入iconHelper模块失败:', importError);
                console.error('[ERROR] 导入iconHelper模块失败:', importError);
                throw importError;
            }
        } catch (error) {
            logger.error('获取图标源失败:', error);
            
            // 显示错误信息，并尝试使用原始URL
            try {
                let searchUrl = engineUrl.value.trim();
                // 移除查询参数
                if (searchUrl.includes('?')) {
                    searchUrl = searchUrl.split('?')[0];
                }
                // 尝试使用完整的URL（包括路径）
                try {
                    const { iconSourceTester } = await import('./utils/iconHelper.js');
                    await iconSourceTester.test(
                        searchUrl,
                        'engine-url',
                        'engine-icon-sources-list',
                        'engine-icon-sources-content',
                        'engine-icon-url',
                        'engine-icon-preview'
                    );
                } catch (importError) {
                    logger.error('导入iconHelper模块失败:', importError);
                    console.error('[ERROR] 导入iconHelper模块失败:', importError);
                    // 已移除提示
                    throw importError;
                }
            } catch (retryError) {
                // 已移除提示
            }
        }
    },
    
    'test-scope-icon-sources': async () => {
        // 搜索范围的图标源测试 - 使用sites字段来获取图标（使用iconSourceTester）
        logger.debug('test-scope-icon-sources handler 被调用');
        console.log('[DEBUG] test-scope-icon-sources handler 开始执行');
        const scopeSitesInput = document.getElementById('scope-editor-sites');
        if (!scopeSitesInput || !scopeSitesInput.value.trim()) {
            return;
        }
        
        // 获取第一个网站域名
        const sites = scopeSitesInput.value.trim().split('\n').filter(s => s.trim());
        if (sites.length === 0) {
            return;
        }
        
        const firstSite = sites[0].trim();
        // 构建完整URL（如果不是完整URL）
        let testUrl = firstSite;
        if (!firstSite.startsWith('http://') && !firstSite.startsWith('https://')) {
            testUrl = 'https://' + firstSite;
        }
        
        try {
            const { iconSourceTester } = await import('./utils/iconHelper.js');
            await iconSourceTester.test(
                testUrl,
                'scope-editor-sites', // urlInputId（虽然这里是sites输入框，但用于标识）
                'scope-icon-sources-list',
                'scope-icon-sources-content',
                'scope-editor-icon',
                'scope-icon-preview'
            );
        } catch (importError) {
            logger.error('导入iconHelper模块失败:', importError);
            console.error('[ERROR] 导入iconHelper模块失败:', importError);
            throw importError;
        }
    },
    'toggle-scope-menu': (target, e) => {
        e.stopPropagation();
        utils.closeVisibleMenus(dom.searchScopeMenu);
        const shouldOpen = !dom.searchScopeMenu.classList.contains('visible');
        utils.setDropdownsVisibility(shouldOpen, shouldOpen || (dom.realSearchInput && !!dom.realSearchInput.value));
        if (shouldOpen) searchModule.debouncedShowSuggestions(true);
    },
    'toggle-engine-menu': (target, e) => {
        // 【修复】阻止事件冒泡，避免触发document.body的点击事件
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        
        // 先关闭其他菜单
        utils.closeVisibleMenus(dom.searchEngineMenu);
        
        // 切换搜索引擎菜单的显示状态
        if (dom.searchEngineMenu) {
            const shouldOpen = !dom.searchEngineMenu.classList.contains('visible');
            dom.searchEngineMenu.classList.toggle('visible');
            
            // 确保菜单内容已渲染
            if (shouldOpen) {
                render.searchEngineMenu();
            }
        } else {
            logger.error('Engine menu element not found');
        }
    },
    'suggestion-tab': (target) => {
        const tabType = target.dataset.type;
        // 设置当前激活的标签类型
        state.suggestionViewMode = tabType;
        // 刷新建议列表
        // 对于历史记录和书签，视为焦点事件以确保显示内容
        const isFocusLike = (tabType === 'history' || tabType === 'bookmarks');
        searchModule.debouncedShowSuggestions(isFocusLike);
    },
    'select-scope-option': (target) => {
        const scope = state.userData.scopes.find(s => s.id === target.closest('[data-id]').dataset.id);
        if (scope) handlers.handleScopeOptionClick(scope, event);
    },
    'switch-scope-tab': (target) => {
        // 移除所有标签的active类
        document.querySelectorAll('[data-action="switch-scope-tab"]').forEach(btn => {
            btn.classList.remove('active');
        });
        // 为当前标签添加active类
        target.classList.add('active');
        state.activeScopeTabId = target.dataset.tabId;
        render.scopeMenu();
    },
    'switch-scope-management-tab': (target) => {
        // 移除所有标签的active类
        document.querySelectorAll('[data-action="switch-scope-management-tab"]').forEach(btn => {
            btn.classList.remove('active');
        });
        // 为当前标签添加active类
        target.classList.add('active');
        state.activeScopeManagementTabId = target.dataset.tabId;
        render.scopeManagementModal();
    },
    'switch-engine-tab': (target) => {
        // 移除所有标签的active类
        document.querySelectorAll('[data-action="switch-engine-tab"]').forEach(btn => {
            btn.classList.remove('active');
        });
        // 为当前标签添加active类
        target.classList.add('active');
        state.activeEngineTabId = target.dataset.tabId;
        render.searchEngineMenu();
    },
    'switch-engine-management-tab': (target) => {
        // 移除所有标签的active类
        document.querySelectorAll('[data-action="switch-engine-management-tab"]').forEach(btn => {
            btn.classList.remove('active');
        });
        // 为当前标签添加active类
        target.classList.add('active');
        state.activeEngineManagementTabId = target.dataset.tabId;
        render.engineManagementModal();
    },
    'open-appearance-settings': () => {
        utils.closeAllDropdowns();
        // 【修复】打开效果面板并切换到外观设置Tab
        openEffectsPanel();
        
        // 切换到外观Tab（使用timerManager统一管理，避免内存泄漏）
        timerManager.clearTimeout('handlers-open-appearance-tab');
        timerManager.setTimeout('handlers-open-appearance-tab', () => {
            const panel = document.getElementById('effectsSettingsPanel');
            if (panel) {
                const appearanceTab = panel.querySelector('[data-tab="appearance"]');
                if (appearanceTab) {
                    appearanceTab.click();
                }
            }
        }, 100);
    },
    'set-nav-alignment': (target) => {
        const align = target.dataset.align;
        // 移除所有按钮的active和selected状态
        document.querySelectorAll('[data-action="set-nav-alignment"]').forEach(btn => {
            btn.classList.remove('active', 'selected');
        });
        // 为当前按钮添加active和selected状态
        target.classList.add('active', 'selected');
        // 应用对齐方式到导航网格
        if (dom.navigationGrid) {
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
        core.saveUserData((error) => {
            if (error) {
                logger.error('Failed to save navigation alignment:', error);
            }
        });
    },
    'set-nav-shape': (target) => {
        const shape = target.dataset.shape;
        // 移除所有形状按钮的active和selected状态
        document.querySelectorAll('.shape-choice').forEach(btn => {
            btn.classList.remove('active', 'selected');
        });
        // 为当前按钮添加active和selected状态
        target.classList.add('active', 'selected');
        
        document.body.className = document.body.className.replace(/shape-\w+/g, '');
        if (shape !== 'square') {
            document.body.classList.add(`shape-${shape}`);
        }
        state.userData.navigationShape = shape;
        core.saveUserData((error) => {
            if (error) {
                logger.error('Failed to save navigation shape:', error);
            }
        });
    },
    'set-panel-theme': (target) => {
        const theme = target.dataset.theme;
        // 移除所有按钮的active状态
        document.querySelectorAll('[data-action="set-panel-theme"]').forEach(btn => {
            btn.classList.remove('active');
        });
        // 添加active到当前按钮
        target.classList.add('active');
        
        // 应用主题
        const panel = document.getElementById('effectsSettingsPanel');
        if (panel) {
            if (theme === 'dark') {
                panel.classList.add('dark-theme');
            } else {
                panel.classList.remove('dark-theme');
            }
        }
        
        // 保存设置
        if (!state.userData.panelSettings) {
            state.userData.panelSettings = {};
        }
        state.userData.panelSettings.theme = theme;
        core.saveUserData((error) => {
            if (error) {
                logger.error('Failed to save panel theme:', error);
            }
        });
    },
    'set-panel-position': (target) => {
        const position = target.dataset.position;
        // 移除所有按钮的active状态
        document.querySelectorAll('[data-action="set-panel-position"]').forEach(btn => {
            btn.classList.remove('active');
        });
        // 添加active到当前按钮
        target.classList.add('active');
        
        // 应用位置
        const panel = document.getElementById('effectsSettingsPanel');
        if (panel) {
            if (position === 'left') {
                panel.classList.add('panel-left');
            } else {
                panel.classList.remove('panel-left');
            }
        }
        
        // 保存设置
        localStorage.setItem('panel-position', position);
    },
    'manage-nav-groups': async () => {
        navigationModule.handlers.onManageGroups();
        
        // 打开统一设置面板并切换到导航Tab
        const { openEffectsPanel } = await import('./features/effects-panel.js');
        openEffectsPanel();
        
        // 切换到导航Tab并展开导航组管理手风琴（使用timerManager统一管理，避免内存泄漏）
        timerManager.clearTimeout('handlers-manage-nav-groups-tab');
        timerManager.setTimeout('handlers-manage-nav-groups-tab', () => {
            const panel = document.getElementById('effectsSettingsPanel');
            const navTab = panel.querySelector('[data-tab="navigation"]');
            if (navTab) navTab.click();
            
            // 展开导航组管理手风琴
            timerManager.clearTimeout('handlers-manage-nav-groups-accordion');
            timerManager.setTimeout('handlers-manage-nav-groups-accordion', () => {
                const navGroupAccordion = panel.querySelector('[data-accordion="nav-group-management"]');
                if (navGroupAccordion && !navGroupAccordion.classList.contains('expanded')) {
                    navGroupAccordion.querySelector('.effects-accordion-header').click();
                }
            }, 100);
        }, 100);
    },
    'refresh-page': () => {
        window.location.reload();
    },
    'toggle-batch-edit': () => {
        navigationModule.utils.toggleBatchEditMode();
    },
    
    // AI设置动作处理器
    'open-ai-settings': () => {
        aiSettings.open();
    },
    
    // AI搜索动作处理器 - 2点前版本
    'ai-search': (target) => {
        const aiType = target.dataset.ai;
        const query = dom.realSearchInput ? dom.realSearchInput.value.trim() : '';
        if (query) {
            searchModule.performAiSearch(aiType, query);
        }
    },
    'ai-favorite-click': (target) => {
        const aiId = target.dataset.ai;
        const ai = aiManager.getAIById(aiId);
        if (ai && ai.websiteUrl) {
            // 直接打开AI网站，不进行搜索
            window.open(ai.websiteUrl, '_blank');
        }
    }
};

/**
 * 主事件处理器 - 使用事件委托处理所有点击事件
 */
export function handleActionClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) {
        logger.debug('handleActionClick: 未找到data-action元素');
        return;
    }
    
    const action = target.dataset.action;
    logger.debug('handleActionClick 被调用', { 
        action, 
        targetId: target.id, 
        className: target.className, 
        tagName: target.tagName 
    });
    console.log('[DEBUG] handleActionClick 被调用', { action, targetId: target.id });
    
    // 对于按钮类型的元素，阻止表单提交（如果是button且在form中）
    if (target.tagName === 'BUTTON' && target.closest('form')) {
        // type="button"的按钮不应该触发表单提交，但为了安全还是阻止默认行为
        if (target.type === 'button') {
            e.preventDefault();
        }
    }
    
    // 对于删除操作，立即阻止事件冒泡和默认行为，避免触发父元素的点击事件
    const preventBubbleActions = ['remove-history-item', 'remove-pill', 'remove-favorite'];
    if (preventBubbleActions.includes(action)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation(); // 也阻止同一元素上的其他监听器
        
        // 执行删除操作
        if (actionHandlers[action]) {
            actionHandlers[action](target);
        }
        return; // 立即返回，不执行后续代码
    }
    
    if (actionHandlers[action]) {
        // Special case for toggle actions that need the event object
        if (action === 'toggle-scope-menu' || action === 'toggle-engine-menu') {
            actionHandlers[action](target, e);
        } else {
            // 【修复】对于其他action，根据handler的参数数量调用
            const handler = actionHandlers[action];
            try {
                // 阻止默认行为和事件冒泡，避免影响其他逻辑
                e.preventDefault();
                e.stopPropagation();
                
                // 检查handler的函数签名长度
                // async函数的length可能不准确，需要特殊处理
                // 检查是否是异步函数（图标源测试相关的都是异步的）
                const asyncActions = ['test-icon-sources', 'test-engine-icon-sources', 'test-scope-icon-sources'];
                const isAsyncAction = asyncActions.includes(action);
                
                logger.debug('准备执行handler', { action, isAsyncAction, handlerLength: handler.length });
                
                if (action === 'manage-engines' || action === 'open-settings') {
                    // 这些handler明确不需要参数
                    handler();
                } else if (isAsyncAction) {
                    // 异步handler，需要await处理
                    logger.debug(`执行异步action: ${action}`);
                    console.log(`[DEBUG] 执行异步action: ${action}`);
                    handler().catch(error => {
                        logger.error(`Error in async action handler "${action}":`, error);
                        console.error(`[ERROR] 异步action handler "${action}" 执行失败:`, error);
                    });
                } else if (handler.length > 1) {
                    // handler需要多个参数（包括event）
                    handler(target, e);
                } else if (handler.length === 1) {
                    // handler只需要target
                    handler(target);
                } else {
                    // handler不需要参数
                    handler();
                }
            } catch (error) {
                logger.error(`Error executing action handler for "${action}":`, error);
            }
        }
        
        // 点击菜单项后关闭主右键菜单
        if (target.closest('#main-context-menu')) {
            const mainContextMenu = document.getElementById('main-context-menu');
            if (mainContextMenu) {
                mainContextMenu.classList.remove('visible');
                mainContextMenu.style.opacity = '0';
                mainContextMenu.style.visibility = 'hidden';
            }
        }
        
        // 【修复】点击搜索引擎菜单内的按钮后，延迟关闭搜索引擎菜单
        // 注意：对于manage-engines和open-settings，先让handler执行，再关闭菜单
        const isInEngineMenu = target.closest('#search-engine-menu');
        if (isInEngineMenu && action !== 'manage-engines' && action !== 'open-settings') {
            const searchEngineMenu = document.getElementById('search-engine-menu');
            if (searchEngineMenu) {
                searchEngineMenu.classList.remove('visible');
            }
        } else if (isInEngineMenu && (action === 'manage-engines' || action === 'open-settings')) {
            // 延迟关闭菜单，确保handler能正常执行（使用timerManager统一管理，避免内存泄漏）
            timerManager.clearTimeout('handlers-close-engine-menu');
            timerManager.setTimeout('handlers-close-engine-menu', () => {
                const searchEngineMenu = document.getElementById('search-engine-menu');
                if (searchEngineMenu) {
                    searchEngineMenu.classList.remove('visible');
                }
            }, 50);
        }
    }
    
    // Prevent default for buttons and links, but allow form submit buttons
    // 【修复】对于manage-engines和open-settings，不要阻止默认行为，确保能正常打开面板
    if (target.tagName === 'A' || (target.tagName === 'BUTTON' && !target.closest('.custom-select-wrapper') && target.type !== 'submit')) {
        // 但不要阻止manage-engines和open-settings按钮的默认行为
        if (action !== 'manage-engines' && action !== 'open-settings') {
            e.preventDefault();
        }
    }
}