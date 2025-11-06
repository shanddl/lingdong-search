import { logger } from './js/logger.js';
import { STATIC_CONFIG } from './js/constants.js';
import { utils } from './js/utils.js';
import { sanitizer } from './js/security.js';

(() => {
    'use strict';

    // 从统一的常量模块导入
    const STORAGE_KEY = STATIC_CONFIG.CONSTANTS.STORAGE_KEY;
    const NEW_GROUP_VALUE = STATIC_CONFIG.CONSTANTS.NEW_GROUP_VALUE;

    // 缓存DOM元素以提高性能
    const dom = {
        form: document.getElementById('add-nav-form'),
        titleInput: document.getElementById('nav-title'),
        urlInput: document.getElementById('nav-url'),
        groupSelect: document.getElementById('nav-group'),
        newGroupContainer: document.getElementById('new-group-container'),
        newGroupInput: document.getElementById('nav-new-group'),
        saveButton: document.getElementById('save-btn'),
        statusMessage: document.getElementById('status-message'),
        // 扩展管理相关DOM
        tabButtons: document.querySelectorAll('.tab-btn'),
        addNavContent: document.getElementById('add-nav-content'),
        extensionsContent: document.getElementById('extensions-content'),
        extensionSearch: document.getElementById('extension-search'),
        extensionList: document.getElementById('extension-list'),
        extensionCount: document.getElementById('extension-count'),
        searchStoreBtn: document.getElementById('search-store-btn'),
        searchScriptBtn: document.getElementById('search-script-btn'),
        createGroupBtn: document.getElementById('create-group-btn'),
        themeToggle: document.getElementById('theme-toggle')
    };

    // 扩展图标缓存
    const iconCache = new Map();

    // 分组数据结构
    let groups = [];
    let extensionGroups = {}; // extensionId -> groupId 映射

    /**
     * 向用户显示状态消息
     * @param {string} message - 要显示的消息文本
     * @param {boolean} isError - 是否为错误消息
     */
    function showStatus(message, isError = false) {
        dom.statusMessage.textContent = message;
        dom.statusMessage.className = `status-message ${isError ? 'error' : 'success'}`;
    }

    /**
     * 初始化弹出窗口，获取当前标签页信息并加载用户数据
     */
    async function initializePopup() {
        try {
            // 1. 获取当前激活的标签页
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                dom.titleInput.value = tab.title || '';
                dom.urlInput.value = tab.url || '';
            }
        } catch (error) {
            
            showStatus('无法获取当前页面信息', true);
            utils.form.setButtonLoading(dom.saveButton, false, '', '保存');
        }

        // 2. 从 chrome.storage.local 获取用户数据以填充分类列表
        try {
            const result = await chrome.storage.local.get(STORAGE_KEY);
            const userData = result[STORAGE_KEY] || null;
            logger.debug('Popup loaded user data:', userData);
            dom.groupSelect.innerHTML = ''; // 清空旧选项

            if (userData && userData.navigationGroups && userData.navigationGroups.length > 0) {
                // 记录当前激活的分类ID
                const activeGroupId = userData.activeNavigationGroupId;
                logger.debug('Active navigation group ID:', activeGroupId);
                
                userData.navigationGroups.forEach(group => {
                    const option = document.createElement('option');
                    option.value = group.id;
                    option.textContent = group.name;
                    // 默认选中当前激活的分类
                    if (group.id === activeGroupId) {
                        option.selected = true;
                    }
                    dom.groupSelect.appendChild(option);
                });
            } else {
                logger.warn('No navigation groups found in user data');
            }

            // 3. 添加"创建新分类"的选项
            const newGroupOption = document.createElement('option');
            newGroupOption.value = NEW_GROUP_VALUE;
            newGroupOption.textContent = '+ 创建新分类...';
            dom.groupSelect.appendChild(newGroupOption);
        } catch (error) {
            logger.error('Error loading navigation groups:', error);
            // 添加默认选项
            const newGroupOption = document.createElement('option');
            newGroupOption.value = NEW_GROUP_VALUE;
            newGroupOption.textContent = '+ 创建新分类...';
            dom.groupSelect.appendChild(newGroupOption);
        }
    }

    /**
     * 处理表单提交事件，保存新的导航项
     * @param {Event} event - 表单提交事件
     */
    async function handleFormSubmit(event) {
        event.preventDefault();
        logger.debug('Form submit event triggered');
        
        // 【优化】使用统一按钮状态管理
        utils.form.setButtonLoading(dom.saveButton, true);

        const title = dom.titleInput.value.trim();
        const url = dom.urlInput.value.trim();
        let groupId = dom.groupSelect.value;
        const newGroupName = dom.newGroupInput.value.trim();

        logger.debug('Form data:', { title, url, groupId, newGroupName });

        // 【优化】使用统一表单验证工具
        // 【修复】在customValidator中直接读取dom.groupSelect.value，避免闭包变量过期问题
        const validation = utils.validator.validateForm([
            { input: dom.titleInput, name: '网站标题', required: true },
            { input: dom.urlInput, name: '网站地址', required: true, type: 'url' },
            { input: dom.groupSelect, name: '分类', required: true },
            { 
                input: dom.newGroupInput, 
                name: '新分类名称', 
                required: false, // 使用 customValidator 处理条件验证
                customValidator: (val) => {
                    // 【修复】直接从dom元素获取最新值，避免闭包变量过期
                    const currentGroupId = dom.groupSelect.value;
                    if (currentGroupId === NEW_GROUP_VALUE && !val) {
                        return { valid: false, message: '请输入新分类的名称' };
                    }
                    return { valid: true };
                }
            }
        ]);

        if (!validation.valid) {
            const firstError = validation.errors[0];
            showStatus(firstError.message, true);
            utils.form.setButtonLoading(dom.saveButton, false, '', '保存');
            return;
        }

        // 【修复】验证已经检查了 groupSelect 的 required，这里的检查是冗余的
        // 但保留作为额外安全检查，因为 customValidator 的条件验证可能不够严格
        if (!groupId || groupId === '') {
            showStatus('请选择或创建一个分类', true);
            utils.form.setButtonLoading(dom.saveButton, false, '', '保存');
            return;
        }

        // 再次获取最新的用户数据，防止数据覆盖
        try {
            const result = await chrome.storage.local.get(STORAGE_KEY);
            let userData = result[STORAGE_KEY] || {};
            if (!userData.navigationGroups) {
                userData.navigationGroups = [];
            }
            logger.debug('User data before save:', userData);

            // 使用统一的图标源方案自动生成图标链接
            let iconUrl = '';
            try {
                // 使用统一的图标源获取方案
                const { aiManager } = await import('./js/features/ai-manager.js');
                const sources = aiManager.getIconSources(url);
                if (sources && sources.length > 0) {
                    // 使用第一个图标源（icon.bqb.cool，首选）
                    iconUrl = sources[0].url;
                } else {
                    // 如果获取失败，使用直链favicon作为fallback
                    const urlObj = new URL(url);
                    iconUrl = `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
                }
            } catch (e) {
                logger.warn('无法生成图标URL:', e);
                // 如果URL解析失败，尝试使用utils的同步方法作为fallback
                try {
                    iconUrl = utils.getIconUrlFromUrl(url);
                } catch (err) {
                    // 最终fallback为空字符串
                    iconUrl = '';
                }
            }

            const newNavItem = {
                id: `nav_${Date.now()}`,
                title,
                url,
                icon: iconUrl
            };

            if (groupId === NEW_GROUP_VALUE) {
                // 创建一个新分类并添加项目
                const newGroup = {
                    id: `group_${Date.now()}`,
                    name: newGroupName,
                    items: [newNavItem]
                };
                userData.navigationGroups.push(newGroup);
                // 将新创建的分类设为活动分类，以便用户在主页上立即看到
                userData.activeNavigationGroupId = newGroup.id;
            } else {
                // 在现有分类中添加项目
                const targetGroup = userData.navigationGroups.find(g => g.id === groupId);
                if (targetGroup) {
                    targetGroup.items.push(newNavItem);
                } else {
                    // 极端情况下的回退：如果找不到目标分类，则创建一个默认分类
                    const defaultGroup = { id: `group_${Date.now()}`, name: '我的收藏', items: [newNavItem] };
                    userData.navigationGroups.push(defaultGroup);
                    userData.activeNavigationGroupId = defaultGroup.id;
                }
            }

            // 将更新后的数据保存到 chrome.storage.local
            logger.debug('Saving user data:', JSON.stringify(userData, null, 2));
            logger.debug('Navigation groups count:', userData.navigationGroups.length);
            logger.debug('Active group ID:', userData.activeNavigationGroupId);
            
            try {
                await chrome.storage.local.set({ [STORAGE_KEY]: userData });
                logger.info('Save successful to chrome.storage.local');
                
                // 验证保存
                const verifyResult = await chrome.storage.local.get(STORAGE_KEY);
                logger.debug('Verification - data saved:', verifyResult[STORAGE_KEY] ? 'Yes' : 'No');
                
                showStatus('保存成功！窗口将在1.5秒后自动关闭...', false);
                const AUTO_CLOSE_DELAY = 1500; // 自动关闭窗口延迟
                setTimeout(() => {
                    window.close();
                }, AUTO_CLOSE_DELAY);
            } catch (error) {
                logger.error('Storage error:', error);
                showStatus('保存失败，请重试', true);
                utils.form.setButtonLoading(dom.saveButton, false, '', '保存');
            }
        } catch (error) {
            logger.error('Error in save process:', error);
            showStatus('保存失败，请重试', true);
            utils.form.setButtonLoading(dom.saveButton, false, '', '保存');
        }
    }

    // --- 事件监听器 ---

    // 当DOM加载完毕后，初始化窗口
    document.addEventListener('DOMContentLoaded', initializePopup);

    // 监听分类选择框的变化，以显示或隐藏“新分类名称”输入框
    dom.groupSelect.addEventListener('change', () => {
        const isNewGroup = dom.groupSelect.value === NEW_GROUP_VALUE;
        dom.newGroupContainer.classList.toggle('hidden', !isNewGroup);
        if (isNewGroup) {
            dom.newGroupInput.focus();
        }
    });

    // 监听表单的提交事件
    dom.form.addEventListener('submit', handleFormSubmit);

    // ==================== 扩展管理功能 ====================

    /**
     * 标签切换功能
     */
    function initTabs() {
        dom.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                
                // 更新按钮状态
                dom.tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // 切换内容区域并动态调整宽度
                if (tabName === 'add-nav') {
                    dom.addNavContent.classList.remove('hidden');
                    dom.extensionsContent.classList.add('hidden');
                    // 添加导航标签页：窄宽度
                    document.body.style.width = '340px';
                    document.body.style.maxWidth = '340px';
                } else if (tabName === 'extensions') {
                    dom.addNavContent.classList.add('hidden');
                    dom.extensionsContent.classList.remove('hidden');
                    // 扩展管理标签页：宽宽度
                    document.body.style.width = '480px';
                    document.body.style.maxWidth = '480px';
                    // 切换到扩展管理时加载扩展列表
                    loadExtensions();
                }
            });
        });
    }

    /**
     * 获取扩展图标（优先从扩展对象获取，失败则尝试 crxsoso）
     * 优化：尝试多种方式获取真实图标
     */
    async function getExtensionIcon(ext) {
        // 使用扩展ID作为缓存键（简化版本，因为同一扩展的图标URL通常不变）
        const cacheKey = ext.id;
        
        // 检查缓存
        if (iconCache.has(cacheKey)) {
            return iconCache.get(cacheKey);
        }

        // 方法1: 从扩展对象的 icons 数组获取（优先选择最大尺寸）
        if (ext.icons && ext.icons.length > 0) {
            // 选择最大尺寸的图标（通常质量更好）
            const sortedIcons = [...ext.icons].sort((a, b) => (b.size || 0) - (a.size || 0));
            const iconUrl = sortedIcons[0].url;
            
            // chrome://extension-icon/ 格式需要通过 background script 转换
            if (iconUrl.startsWith('chrome://extension-icon/') || iconUrl.startsWith('chrome-extension://')) {
                try {
                    // 先尝试直接使用 URL（某些情况下可以直接加载）
                    // 如果失败，再通过 background script 转换
                    const testImg = new Image();
                    const directLoad = new Promise((resolve) => {
                        testImg.onload = () => resolve(true);
                        testImg.onerror = () => resolve(false);
                        testImg.src = iconUrl;
                        // 设置超时
                        setTimeout(() => resolve(false), 1000);
                    });
                    
                    if (await directLoad) {
                        // 直接使用成功，缓存并返回
                        iconCache.set(cacheKey, iconUrl);
                        return iconUrl;
                    }
                    
                    // 直接加载失败，通过 background script 转换
                    const response = await chrome.runtime.sendMessage({
                        action: 'getExtensionIconFromUrl',
                        iconUrl: iconUrl,
                        extensionId: ext.id
                    });
                    
                    if (!chrome.runtime.lastError && response && response.success && response.dataUrl) {
                        // 验证返回的是有效的 data URL
                        if (response.dataUrl.startsWith('data:image/')) {
                            iconCache.set(cacheKey, response.dataUrl);
                            return response.dataUrl;
                        }
                    }
                } catch (error) {
                    logger.warn('获取扩展图标失败:', error);
                }
            } else if (iconUrl.startsWith('http://') || iconUrl.startsWith('https://')) {
                // HTTP URL 可以直接使用
                iconCache.set(cacheKey, iconUrl);
                return iconUrl;
            }
        }

        // 方法2: 从 crxsoso.com 获取（备选方案）
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getExtensionIconFromCrxsoso',
                extensionId: ext.id
            });
            
            if (!chrome.runtime.lastError && response && response.success && response.dataUrl) {
                if (response.dataUrl.startsWith('data:image/')) {
                    iconCache.set(cacheKey, response.dataUrl);
                    return response.dataUrl;
                }
            }
        } catch (error) {
            logger.warn('从 crxsoso 获取图标失败:', error);
        }

        // 方法3: 生成占位图标（首字母）- 最后回退方案
        const initial = ext.name ? ext.name.charAt(0).toUpperCase() : '?';
        const svg = `
            <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="48" fill="#5f6368" rx="8"/>
                <text x="24" y="32" font-family="Arial" font-size="24" font-weight="bold" fill="#fff" text-anchor="middle">${initial}</text>
            </svg>
        `.trim();
        const placeholderIcon = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
        iconCache.set(cacheKey, placeholderIcon);
        return placeholderIcon;
    }

    /**
     * 创建扩展项DOM元素（网格布局）
     */
    async function createExtensionGridItem(ext) {
        const item = document.createElement('div');
        item.className = `extension-item-grid ${ext.enabled ? 'enabled' : 'disabled'}`;
        item.dataset.extensionId = ext.id;
        item.dataset.extensionEnabled = ext.enabled.toString(); // 存储当前状态
        
        // 获取图标
        const iconUrl = await getExtensionIcon(ext);
        
        item.innerHTML = `
            <div class="extension-grid-icon">
                <img src="${iconUrl}" alt="${sanitizer.escapeHtml(ext.name || '未知扩展')}" loading="lazy" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIGZpbGw9IiM1ZjYzNjgiIHJ4PSI4Ii8+PHRleHQgeD0iMjQiIHk9IjMyIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4/PC90ZXh0Pjwvc3ZnPg=='">
            </div>
            <div class="extension-grid-name">${sanitizer.escapeHtml(ext.name || '未知扩展')}</div>
        `;
        
        // 点击：切换启用/禁用状态
        // 使用防抖和从DOM读取最新状态，避免闭包中的旧值问题
        let isToggling = false;
        item.addEventListener('click', async (e) => {
            // 防止重复点击
            if (isToggling) {
                logger.debug(`扩展 ${ext.id} 正在切换中，忽略重复点击`);
                return;
            }
            
            isToggling = true;
            try {
                // 从DOM读取最新状态，而不是使用闭包中的旧值
                const currentEnabled = item.dataset.extensionEnabled === 'true';
                const newEnabled = !currentEnabled;
                
                await toggleExtension(ext.id, newEnabled);
            } finally {
                // 延迟重置标志，确保loadExtensions完成后再允许点击
                setTimeout(() => {
                    isToggling = false;
                }, 500);
            }
        });
        
        // 右键点击：显示上下文菜单
        item.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            // 重新获取最新的扩展信息
            try {
                const latestExt = await chrome.management.get(ext.id);
                await showContextMenu(e, latestExt);
            } catch (error) {
                logger.error('获取扩展信息失败:', error);
                await showContextMenu(e, ext);
            }
        });
        
        return item;
    }

    /**
     * 切换扩展启用/禁用状态
     */
    async function toggleExtension(extensionId, enabled) {
        try {
            if (!chrome.management) {
                showStatus('扩展管理权限不可用', true);
                return;
            }

            // 先更新对应DOM元素的状态，提供即时反馈
            const item = document.querySelector(`[data-extension-id="${extensionId}"]`);
            if (item) {
                item.dataset.extensionEnabled = enabled.toString();
                item.classList.toggle('enabled', enabled);
                item.classList.toggle('disabled', !enabled);
            }

            await chrome.management.setEnabled(extensionId, enabled);
            logger.info(`扩展 ${extensionId} ${enabled ? '已启用' : '已禁用'}`);
            
            // 重新加载扩展列表，保持当前搜索状态
            // 使用setTimeout确保状态更新完成后再重新加载
            setTimeout(async () => {
                await loadExtensions(getCurrentSearch());
            }, 100);
        } catch (error) {
            logger.error('切换扩展状态失败:', error);
            showStatus(`操作失败: ${error.message}`, true);
            
            // 如果失败，恢复DOM元素状态
            const item = document.querySelector(`[data-extension-id="${extensionId}"]`);
            if (item) {
                const currentEnabled = item.dataset.extensionEnabled === 'true';
                item.classList.toggle('enabled', currentEnabled);
                item.classList.toggle('disabled', !currentEnabled);
            }
        }
    }

    /**
     * 获取当前搜索关键词
     */
    function getCurrentSearch() {
        return dom.extensionSearch ? dom.extensionSearch.value.trim() : '';
    }

    /**
     * 加载分组数据
     */
    async function loadGroupsData() {
        try {
            const result = await chrome.storage.local.get(['extensionGroups', 'groups']);
            // 直接更新数据，确保与storage同步（不使用条件判断，避免数据不同步）
            groups = Array.isArray(result.groups) ? result.groups : [];
            extensionGroups = result.extensionGroups && typeof result.extensionGroups === 'object' ? result.extensionGroups : {};
            
            logger.debug('分组数据已加载:', { 
                groupsCount: groups.length, 
                extensionGroupsCount: Object.keys(extensionGroups).length
            });
        } catch (error) {
            logger.error('加载分组数据失败:', error);
            // 出错时重置为空数据
            groups = [];
            extensionGroups = {};
        }
    }

    /**
     * 保存分组数据
     */
    async function saveGroupsData() {
        try {
            // 先保存数据
            await chrome.storage.local.set({
                extensionGroups: extensionGroups,
                groups: groups
            });
            
            // 验证保存是否成功，并确保数据已写入
            let retryCount = 0;
            const maxRetries = 3;
            while (retryCount < maxRetries) {
                const verify = await chrome.storage.local.get(['extensionGroups', 'groups']);
                if (verify.groups && verify.extensionGroups) {
                    // 验证数据是否匹配
                    const groupsMatch = JSON.stringify(verify.groups) === JSON.stringify(groups);
                    const extensionGroupsMatch = JSON.stringify(verify.extensionGroups) === JSON.stringify(extensionGroups);
                    
                    if (groupsMatch && extensionGroupsMatch) {
                        logger.debug('分组数据已保存并验证:', { 
                            groupsCount: verify.groups.length, 
                            extensionGroupsCount: Object.keys(verify.extensionGroups).length 
                        });
                        return; // 数据已正确保存
                    } else {
                        logger.warn(`数据验证失败 (重试 ${retryCount + 1}/${maxRetries})`);
                        // 如果数据不匹配，等待一小段时间后重试
                        await new Promise(resolve => setTimeout(resolve, 100));
                        // 重新保存
                        await chrome.storage.local.set({
                            extensionGroups: extensionGroups,
                            groups: groups
                        });
                    }
                }
                retryCount++;
            }
            
            // 如果重试后仍然失败，记录警告但继续执行
            if (retryCount >= maxRetries) {
                logger.warn('分组数据保存验证失败，但继续执行');
            }
        } catch (error) {
            logger.error('保存分组数据失败:', error);
            throw error; // 抛出错误以便调用者处理
        }
    }

    /**
     * 加载扩展列表（支持分组）
     */
    async function loadExtensions(searchQuery = '') {
        try {
            if (!chrome.management) {
                dom.extensionList.innerHTML = '<div class="error">扩展管理权限不可用</div>';
                return;
            }

            // 加载分组数据（在开始时加载一次，确保使用最新数据）
            await loadGroupsData();
            // 再次确保数据是最新的（防止storage延迟）
            await new Promise(resolve => setTimeout(resolve, 50));
            await loadGroupsData();

            dom.extensionList.innerHTML = '<div class="loading">加载中...</div>';

            // 获取所有扩展
            const extensions = await chrome.management.getAll();
            const currentId = chrome.runtime.id;
            
            // 过滤掉当前扩展本身和Chrome内置应用
            let filtered = extensions.filter(ext => {
                if (ext.id === currentId) return false;
                // 过滤掉Chrome内置应用
                if (ext.type === 'hosted_app' || ext.type === 'packaged_app') {
                    return false;
                }
                return true;
            });

            // 搜索过滤
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                filtered = filtered.filter(ext => {
                    const name = (ext.name || '').toLowerCase();
                    const desc = (ext.description || '').toLowerCase();
                    return name.includes(query) || desc.includes(query);
                });
            }

            // 按启用状态和名称排序
            filtered.sort((a, b) => {
                if (a.enabled !== b.enabled) {
                    return a.enabled ? -1 : 1;
                }
                return (a.name || '').localeCompare(b.name || '');
            });

            // 更新统计
            dom.extensionCount.textContent = filtered.length;

            // 清空列表
            dom.extensionList.innerHTML = '';

            if (filtered.length === 0) {
                dom.extensionList.innerHTML = '<div class="empty">没有找到扩展</div>';
                return;
            }

            // 按分组组织扩展
            // 注意：在函数开始时已经调用了loadGroupsData()，这里不需要再次调用
            // 直接使用最新的groups和extensionGroups变量
            const groupedExtensions = {};
            const ungroupedExtensions = [];

            // 按order排序分组
            const sortedGroups = [...groups].sort((a, b) => (a.order || 0) - (b.order || 0));

            // 初始化分组
            sortedGroups.forEach(group => {
                groupedExtensions[group.id] = [];
            });

            // 分配扩展到分组
            filtered.forEach(ext => {
                const groupId = extensionGroups[ext.id];
                if (groupId && groupedExtensions[groupId]) {
                    groupedExtensions[groupId].push(ext);
                } else {
                    ungroupedExtensions.push(ext);
                }
            });

            // 渲染分组
            // 如果有搜索查询，只显示包含匹配扩展的分组
            // 如果没有搜索查询，显示所有分组（包括空分组），以便用户可以添加扩展
            for (const group of sortedGroups) {
                const groupExts = groupedExtensions[group.id] || [];
                // 如果有搜索查询，只显示有扩展的分组；否则显示所有分组（包括空分组）
                if (searchQuery.trim()) {
                    // 搜索时只显示有匹配结果的分组
                    if (groupExts.length > 0) {
                        await renderGroup(group, groupExts);
                    }
                } else {
                    // 非搜索时显示所有分组（包括空分组），以便用户可以看到新创建的分组
                    await renderGroup(group, groupExts);
                }
            }

            // 渲染未分组扩展
            if (ungroupedExtensions.length > 0) {
                await renderUngroupedExtensions(ungroupedExtensions);
            }

        } catch (error) {
            logger.error('加载扩展列表失败:', error);
            dom.extensionList.innerHTML = `<div class="error">加载失败: ${error.message}</div>`;
        }
    }

    /**
     * 渲染分组
     */
    async function renderGroup(group, extensions) {
        const groupContainer = document.createElement('div');
        groupContainer.className = 'extension-group-container';
        groupContainer.dataset.groupId = group.id;

        // 检查折叠状态
        const isCollapsed = localStorage.getItem(`group_collapsed_${group.id}`) === 'true';
        if (isCollapsed) {
            groupContainer.classList.add('collapsed');
        }

        // 分组头部
        const header = document.createElement('div');
        header.className = 'group-container-header';
        header.innerHTML = `
            <div class="group-header-left">
                <span class="group-toggle-icon">${isCollapsed ? '▶' : '▼'}</span>
                <span class="group-name">${sanitizer.escapeHtml(group.name)}</span>
                <span class="group-count">(${extensions.length})</span>
            </div>
            <div class="group-header-right">
                <button class="group-btn move-up-btn" data-group-id="${group.id}" title="上移">▲</button>
                <button class="group-btn move-down-btn" data-group-id="${group.id}" title="下移">▼</button>
                <button class="group-btn enable-group-btn" data-group-id="${group.id}" title="启用分组">启用</button>
                <button class="group-btn disable-group-btn" data-group-id="${group.id}" title="禁用分组">禁用</button>
                <button class="group-btn edit-group-btn" data-group-id="${group.id}" title="编辑分组">编辑</button>
                <button class="group-btn delete-group-btn" data-group-id="${group.id}" title="删除分组">删除</button>
            </div>
        `;

        // 分组内容
        const content = document.createElement('div');
        content.className = 'group-container-content extension-grid';

        // 绑定头部事件
        header.querySelector('.group-header-left').addEventListener('click', () => {
            toggleGroupCollapse(group.id);
        });

        // 绑定按钮事件，阻止事件冒泡
        header.querySelector('.move-up-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            moveGroupUp(group.id);
        });

        header.querySelector('.move-down-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            moveGroupDown(group.id);
        });

        header.querySelector('.enable-group-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleGroupExtensions(group.id, true);
        });

        header.querySelector('.disable-group-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleGroupExtensions(group.id, false);
        });

        header.querySelector('.edit-group-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            editGroup(group.id);
        });

        header.querySelector('.delete-group-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteGroup(group.id);
        });

        // 渲染扩展项
        const batchSize = 5;
        for (let i = 0; i < extensions.length; i += batchSize) {
            const batch = extensions.slice(i, i + batchSize);
            const items = await Promise.all(batch.map(ext => createExtensionGridItem(ext)));
            items.forEach(item => content.appendChild(item));
        }

        groupContainer.appendChild(header);
        groupContainer.appendChild(content);
        dom.extensionList.appendChild(groupContainer);
    }

    /**
     * 渲染未分组扩展
     */
    async function renderUngroupedExtensions(extensions) {
        const ungroupedContainer = document.createElement('div');
        ungroupedContainer.className = 'extension-group-container';
        ungroupedContainer.dataset.groupId = 'ungrouped';

        const header = document.createElement('div');
        header.className = 'group-container-header';
        header.innerHTML = `
            <div class="group-header-left">
                <span class="group-toggle-icon">▼</span>
                <span class="group-name">未分组</span>
                <span class="group-count">(${extensions.length})</span>
            </div>
        `;

        const content = document.createElement('div');
        content.className = 'group-container-content extension-grid';

        // 检查未分组扩展的折叠状态
        const isUngroupedCollapsed = localStorage.getItem('group_collapsed_ungrouped') === 'true';
        if (isUngroupedCollapsed) {
            ungroupedContainer.classList.add('collapsed');
            header.querySelector('.group-toggle-icon').textContent = '▶';
        }

        header.querySelector('.group-header-left').addEventListener('click', () => {
            ungroupedContainer.classList.toggle('collapsed');
            const isCollapsed = ungroupedContainer.classList.contains('collapsed');
            localStorage.setItem('group_collapsed_ungrouped', isCollapsed.toString());
            const icon = header.querySelector('.group-toggle-icon');
            icon.textContent = isCollapsed ? '▶' : '▼';
        });

        const batchSize = 5;
        for (let i = 0; i < extensions.length; i += batchSize) {
            const batch = extensions.slice(i, i + batchSize);
            const items = await Promise.all(batch.map(ext => createExtensionGridItem(ext)));
            items.forEach(item => content.appendChild(item));
        }

        ungroupedContainer.appendChild(header);
        ungroupedContainer.appendChild(content);
        dom.extensionList.appendChild(ungroupedContainer);
    }

    /**
     * 切换分组折叠状态
     */
    function toggleGroupCollapse(groupId) {
        const container = document.querySelector(`[data-group-id="${groupId}"]`);
        if (!container) return;

        container.classList.toggle('collapsed');
        const isCollapsed = container.classList.contains('collapsed');
        localStorage.setItem(`group_collapsed_${groupId}`, isCollapsed.toString());

        const icon = container.querySelector('.group-toggle-icon');
        if (icon) {
            icon.textContent = isCollapsed ? '▶' : '▼';
        }
    }

    /**
     * 创建分组
     */
    async function createGroup() {
        const name = prompt('请输入分组名称：');
        if (!name || !name.trim()) return;

        // 计算新的order值
        let newOrder = 0;
        if (groups.length > 0) {
            const maxOrder = Math.max(...groups.map(g => g.order || 0));
            newOrder = maxOrder + 1;
        }

        const newGroup = {
            id: `group_${Date.now()}`,
            name: name.trim(),
            order: newOrder
        };

        groups.push(newGroup);
        // 保存数据（saveGroupsData会验证保存是否成功）
        await saveGroupsData();
        
        // 注意：不要在这里调用loadGroupsData()，因为：
        // 1. 内存中的groups已经包含了newGroup
        // 2. loadGroupsData()可能会从storage读取旧数据（如果storage写入有延迟）
        // 3. 这会覆盖刚刚添加的newGroup
        // 直接调用loadExtensions，它内部会调用loadGroupsData()，但此时storage应该已经更新了
        
        // 确保使用最新数据重新渲染
        // loadExtensions内部会调用loadGroupsData()，但我们会等待确保storage已更新
        await new Promise(resolve => setTimeout(resolve, 100)); // 等待storage写入完成
        await loadExtensions(getCurrentSearch());
    }

    /**
     * 编辑分组
     */
    async function editGroup(groupId) {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;

        const newName = prompt('请输入新分组名称：', group.name);
        if (!newName || !newName.trim()) return;

        group.name = newName.trim();
        await saveGroupsData();
        await loadExtensions(getCurrentSearch());
    }

    /**
     * 删除分组
     */
    async function deleteGroup(groupId) {
        if (!confirm('确定要删除这个分组吗？分组内的扩展将变为未分组。')) return;

        // 从groups中移除
        groups = groups.filter(g => g.id !== groupId);

        // 从extensionGroups中移除所有关联
        Object.keys(extensionGroups).forEach(extId => {
            if (extensionGroups[extId] === groupId) {
                delete extensionGroups[extId];
            }
        });

        await saveGroupsData();
        await loadExtensions(getCurrentSearch());
    }

    /**
     * 上移分组
     */
    async function moveGroupUp(groupId) {
        const index = groups.findIndex(g => g.id === groupId);
        if (index <= 0) return;

        const currentOrder = groups[index].order || 0;
        const prevOrder = groups[index - 1].order || 0;

        groups[index].order = prevOrder;
        groups[index - 1].order = currentOrder;

        groups.sort((a, b) => (a.order || 0) - (b.order || 0));
        await saveGroupsData();
        await loadExtensions(getCurrentSearch());
    }

    /**
     * 下移分组
     */
    async function moveGroupDown(groupId) {
        const index = groups.findIndex(g => g.id === groupId);
        if (index < 0 || index >= groups.length - 1) return;

        const currentOrder = groups[index].order || 0;
        const nextOrder = groups[index + 1].order || 0;

        groups[index].order = nextOrder;
        groups[index + 1].order = currentOrder;

        groups.sort((a, b) => (a.order || 0) - (b.order || 0));
        await saveGroupsData();
        await loadExtensions(getCurrentSearch());
    }

    /**
     * 批量启用/禁用分组
     */
    async function toggleGroupExtensions(groupId, enabled) {
        try {
            const groupExtIds = Object.keys(extensionGroups).filter(
                extId => extensionGroups[extId] === groupId
            );

            for (const extId of groupExtIds) {
                try {
                    await chrome.management.setEnabled(extId, enabled);
                } catch (error) {
                    logger.warn(`无法切换扩展 ${extId}:`, error);
                }
            }

            await loadExtensions(getCurrentSearch());
        } catch (error) {
            logger.error('批量操作失败:', error);
            showStatus(`操作失败: ${error.message}`, true);
        }
    }

    /**
     * 显示右键菜单
     */
    async function showContextMenu(event, ext) {
        // 确保分组数据已加载
        await loadGroupsData();
        
        // 移除现有菜单
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.position = 'fixed';
        
        // 使用pageX/pageY确保位置正确，并检查边界
        const x = event.pageX || event.clientX;
        const y = event.pageY || event.clientY;
        const menuWidth = 130;
        // 动态计算菜单高度（根据实际菜单项数量）
        const menuItemHeight = 28;
        const dividerHeight = 9; // 分隔线高度（1px + 上下各4px margin）
        // 基础菜单项：启用/禁用、查看详情、分隔线、添加到分组（子菜单不计算高度）、选项、分隔线、查看商店来源、删除扩展 = 7项（2个分隔线）
        let menuItemCount = 7;
        // 如果已在分组中，添加"从分组移除"项
        if (extensionGroups[ext.id]) {
            menuItemCount += 1;
        }
        const menuHeight = menuItemCount * menuItemHeight + dividerHeight * 2 + 12;
        
        // 确保菜单不会超出窗口边界
        let left = x;
        let top = y;
        if (x + menuWidth > window.innerWidth) {
            left = Math.max(10, window.innerWidth - menuWidth - 10);
        }
        if (y + menuHeight > window.innerHeight) {
            top = Math.max(10, window.innerHeight - menuHeight - 10);
        }
        
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
        menu.style.zIndex = '10000';

        // 检查扩展是否已在分组中
        const currentGroupId = extensionGroups[ext.id];
        const currentGroup = currentGroupId ? groups.find(g => g.id === currentGroupId) : null;

        // 构建菜单HTML
        let menuHTML = `
            <div class="context-menu-item" data-action="toggle">${ext.enabled ? '禁用' : '启用'}</div>
            <div class="context-menu-item" data-action="details">查看详情</div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item context-menu-parent" data-action="add-to-group">
                <span>添加到分组</span>
                <span class="context-menu-arrow">▶</span>
            </div>
            <div class="context-submenu" data-submenu="add-to-group">
                <div class="context-menu-item context-submenu-item" data-group-id="">未分组${!currentGroupId ? ' ✓' : ''}</div>
        `;

        // 添加所有分组选项（按order排序）
        const sortedGroupsForMenu = [...groups].sort((a, b) => (a.order || 0) - (b.order || 0));
        sortedGroupsForMenu.forEach(group => {
            const isSelected = currentGroupId === group.id;
            menuHTML += `
                <div class="context-menu-item context-submenu-item" data-group-id="${group.id}">${sanitizer.escapeHtml(group.name)}${isSelected ? ' ✓' : ''}</div>
            `;
        });

        menuHTML += `
                <div class="context-menu-divider"></div>
                <div class="context-menu-item context-submenu-item" data-action="create-group">+ 创建新分组</div>
            </div>
        `;

        // 如果已在分组中，显示"从分组移除"
        if (currentGroup) {
            menuHTML += `
                <div class="context-menu-item" data-action="remove-from-group">从分组移除 (${sanitizer.escapeHtml(currentGroup.name)})</div>
            `;
        }

        menuHTML += `
            <div class="context-menu-item" data-action="options">选项</div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" data-action="store">查看商店来源</div>
            <div class="context-menu-item context-menu-danger" data-action="uninstall">删除扩展</div>
        `;

        menu.innerHTML = menuHTML;

        document.body.appendChild(menu);

        // 处理子菜单展开/收起
        const parentItem = menu.querySelector('[data-action="add-to-group"]');
        const submenu = menu.querySelector('[data-submenu="add-to-group"]');
        let isSubmenuOpen = false;

        // 鼠标悬停时展开子菜单
        parentItem.addEventListener('mouseenter', () => {
            if (!isSubmenuOpen) {
                submenu.classList.add('submenu-open');
                isSubmenuOpen = true;
                const arrow = parentItem.querySelector('.context-menu-arrow');
                arrow.textContent = '▼';
                
                // 调整子菜单位置，确保不超出窗口
                const menuRect = menu.getBoundingClientRect();
                const submenuWidth = 140;
                
                // 计算子菜单应该显示的位置
                requestAnimationFrame(() => {
                    // 如果子菜单会超出右边界，则显示在左侧
                    if (menuRect.right + submenuWidth > window.innerWidth) {
                        submenu.style.left = `-${submenuWidth}px`;
                    } else {
                        submenu.style.left = `${menuRect.width - 2}px`;
                    }
                    
                    // 确保子菜单不超出上下边界
                    const submenuRect = submenu.getBoundingClientRect();
                    if (submenuRect.bottom > window.innerHeight) {
                        const overflow = submenuRect.bottom - window.innerHeight;
                        const currentTop = parseFloat(submenu.style.top || '-2');
                        const newTop = currentTop - overflow - 2;
                        // 确保不会超出父菜单的上边界
                        const minTop = -menuRect.top + 10;
                        submenu.style.top = `${Math.max(minTop, newTop)}px`;
                    }
                    
                    // 确保子菜单不超出上边界
                    if (submenuRect.top < 0) {
                        submenu.style.top = `${-menuRect.top + 10}px`;
                    }
                });
            }
        });

        // 鼠标离开时收起子菜单（延迟一点，避免快速切换时闪烁）
        let submenuTimeout;
        let isMouseInSubmenu = false;
        
        parentItem.addEventListener('mouseleave', () => {
            submenuTimeout = setTimeout(() => {
                if (!isMouseInSubmenu) {
                    submenu.classList.remove('submenu-open');
                    isSubmenuOpen = false;
                    const arrow = parentItem.querySelector('.context-menu-arrow');
                    arrow.textContent = '▶';
                }
            }, 150);
        });

        // 子菜单悬停时保持展开
        submenu.addEventListener('mouseenter', () => {
            clearTimeout(submenuTimeout);
            isMouseInSubmenu = true;
        });

        submenu.addEventListener('mouseleave', () => {
            isMouseInSubmenu = false;
            submenuTimeout = setTimeout(() => {
                submenu.classList.remove('submenu-open');
                isSubmenuOpen = false;
                const arrow = parentItem.querySelector('.context-menu-arrow');
                arrow.textContent = '▶';
            }, 150);
        });

        // 点击"启用/禁用"
        menu.querySelector('[data-action="toggle"]').addEventListener('click', async (e) => {
            e.stopPropagation();
            await toggleExtension(ext.id, !ext.enabled);
            menu.remove();
        });

        // 点击"查看详情"
        menu.querySelector('[data-action="details"]').addEventListener('click', (e) => {
            e.stopPropagation();
            // 打开Chrome扩展管理页面
            chrome.tabs.create({ url: `chrome://extensions/?id=${ext.id}` });
            menu.remove();
        });

        // 处理子菜单项点击
        submenu.querySelectorAll('.context-submenu-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                const groupId = item.dataset.groupId;
                
                if (item.dataset.action === 'create-group') {
                    await createGroup();
                    // 重新显示菜单（延迟一点确保分组数据已保存）
                    menu.remove();
                    // 创建一个新的事件对象，使用菜单的原始位置
                    const syntheticEvent = {
                        pageX: event.pageX || event.clientX || 0,
                        pageY: event.pageY || event.clientY || 0,
                        clientX: event.clientX || 0,
                        clientY: event.clientY || 0
                    };
                    // 等待storage写入完成，然后重新显示菜单
                    // 注意：createGroup已经保存了数据，所以不需要再次调用loadGroupsData
                    // showContextMenu内部会调用loadGroupsData()，确保菜单显示最新分组
                    await new Promise(resolve => setTimeout(resolve, 150));
                    try {
                        const latestExt = await chrome.management.get(ext.id);
                        await showContextMenu(syntheticEvent, latestExt);
                    } catch (error) {
                        logger.error('获取扩展信息失败:', error);
                        await showContextMenu(syntheticEvent, ext);
                    }
                } else {
                    // groupId可能是空字符串（未分组）或有效的分组ID
                    // 空字符串表示"未分组"，需要删除映射
                    if (groupId === '' || groupId === undefined) {
                        delete extensionGroups[ext.id];
                    } else if (groupId) {
                        extensionGroups[ext.id] = groupId;
                    }
                    await saveGroupsData();
                    
                    // 注意：不要在这里调用loadGroupsData()，因为：
                    // 1. 内存中的extensionGroups已经更新了
                    // 2. loadGroupsData()可能会从storage读取旧数据（如果storage写入有延迟）
                    // 3. 这会覆盖刚刚更新的映射
                    // 直接调用loadExtensions，它内部会调用loadGroupsData()，但此时storage应该已经更新了
                    
                    // 等待storage写入完成，然后重新渲染
                    await new Promise(resolve => setTimeout(resolve, 100)); // 等待storage写入完成
                    await loadExtensions(getCurrentSearch());
                    menu.remove();
                }
            });
        });

        // 点击"从分组移除"（如果存在）
        const removeFromGroupItem = menu.querySelector('[data-action="remove-from-group"]');
        if (removeFromGroupItem) {
            removeFromGroupItem.addEventListener('click', async (e) => {
                e.stopPropagation();
                delete extensionGroups[ext.id];
                await saveGroupsData();
                // 等待storage写入完成，然后重新渲染
                // 注意：不要调用loadGroupsData()，因为内存中的extensionGroups已经更新了
                await new Promise(resolve => setTimeout(resolve, 100));
                await loadExtensions(getCurrentSearch());
                menu.remove();
            });
        }

        // 点击"选项"
        menu.querySelector('[data-action="options"]').addEventListener('click', (e) => {
            e.stopPropagation();
            if (ext.optionsUrl) {
                chrome.tabs.create({ url: ext.optionsUrl });
            } else {
                showStatus('该扩展没有选项页面', true);
            }
            menu.remove();
        });

        // 点击"查看商店来源"
        const storeItem = menu.querySelector('[data-action="store"]');
        if (storeItem) {
            storeItem.addEventListener('click', (e) => {
                e.stopPropagation();
                // 直接使用crxsoso的详细页面URL格式
                // 格式: https://www.crxsoso.com/webstore/detail/{extensionId}
                const crxsosoUrl = `https://www.crxsoso.com/webstore/detail/${ext.id}`;
                chrome.tabs.create({ url: crxsosoUrl });
                menu.remove();
            });
        }

        // 点击"删除扩展"
        const uninstallItem = menu.querySelector('[data-action="uninstall"]');
        if (uninstallItem) {
            uninstallItem.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                // 确认删除
                const confirmMessage = `确定要删除扩展 "${sanitizer.escapeHtml(ext.name || '未知扩展')}" 吗？\n\n此操作无法撤销！`;
                if (confirm(confirmMessage)) {
                    try {
                        // 先从分组中移除
                        if (extensionGroups[ext.id]) {
                            delete extensionGroups[ext.id];
                            await saveGroupsData();
                            // 确保数据已保存
                            await loadGroupsData();
                        }
                        
                        // 卸载扩展
                        await chrome.management.uninstall(ext.id);
                        
                        showStatus('扩展已删除', false);
                        
                        // 重新加载扩展列表
                        await loadExtensions(getCurrentSearch());
                    } catch (error) {
                        logger.error('删除扩展失败:', error);
                        if (error.message && error.message.includes('not allowed')) {
                            showStatus('无法删除此扩展（可能由企业策略管理）', true);
                        } else {
                            showStatus(`删除失败: ${error.message}`, true);
                        }
                    }
                }
                menu.remove();
            });
        }

        // 点击其他地方关闭菜单
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);
    }


    /**
     * 初始化扩展管理功能
     */
    function initExtensions() {
        // 搜索框防抖
        let searchTimeout;
        dom.extensionSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadExtensions(e.target.value);
            }, 300);
        });

        // 回车搜索
        dom.extensionSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                loadExtensions(e.target.value);
            }
        });

        // 商店搜索按钮
        if (dom.searchStoreBtn) {
            dom.searchStoreBtn.addEventListener('click', () => {
                const keyword = dom.extensionSearch.value.trim();
                let url;
                if (keyword) {
                    // 有搜索关键词时，打开搜索页面
                    url = `https://www.crxsoso.com/search?keyword=${encodeURIComponent(keyword)}`;
                } else {
                    // 搜索框为空时，打开官网首页
                    url = 'https://www.crxsoso.com';
                }
                chrome.tabs.create({ url });
            });
        }

        // 脚本搜索按钮
        if (dom.searchScriptBtn) {
            dom.searchScriptBtn.addEventListener('click', () => {
                const keyword = dom.extensionSearch.value.trim();
                let url;
                if (keyword) {
                    // 有搜索关键词时，打开搜索页面
                    url = `https://gf.qytechs.cn/zh-CN/scripts?q=${encodeURIComponent(keyword)}`;
                } else {
                    // 搜索框为空时，打开官网首页
                    url = 'https://gf.qytechs.cn/zh-CN';
                }
                chrome.tabs.create({ url });
            });
        }

        // 创建分组按钮
        if (dom.createGroupBtn) {
            dom.createGroupBtn.addEventListener('click', async () => {
                await createGroup();
            });
        }
    }

    /**
     * 初始化主题
     */
    async function initTheme() {
        // 从storage加载主题设置
        try {
            const result = await chrome.storage.local.get(['popupTheme']);
            const theme = result.popupTheme || 'dark';
            if (theme === 'light') {
                document.body.classList.add('light-mode');
            } else {
                document.body.classList.remove('light-mode');
            }
        } catch (error) {
            logger.warn('加载主题设置失败:', error);
        }

        // 主题切换按钮
        if (dom.themeToggle) {
            dom.themeToggle.addEventListener('click', async () => {
                const isLight = document.body.classList.toggle('light-mode');
                const theme = isLight ? 'light' : 'dark';
                
                try {
                    await chrome.storage.local.set({ popupTheme: theme });
                } catch (error) {
                    logger.warn('保存主题设置失败:', error);
                }
            });
        }
    }

    // 初始化主题
    initTheme();
    
    // 初始化标签切换
    initTabs();
    
    // 初始化扩展管理（延迟加载，避免影响添加导航功能）
    initExtensions();

})();