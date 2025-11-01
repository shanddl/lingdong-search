import { logger } from './js/logger.js';
import { STATIC_CONFIG } from './js/constants.js';
import { utils } from './js/utils.js';

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
        statusMessage: document.getElementById('status-message')
    };

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

            // 自动生成图标链接
            let iconUrl = '';
            try {
                const hostname = new URL(url).hostname;
                iconUrl = `https://icon.bqb.cool/?url=${hostname}`;
            } catch (e) {
                
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

})();