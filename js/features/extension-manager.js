import { logger } from '../logger.js';
import { eventManager } from '../eventManager.js';
import { timerManager } from '../utils/timerManager.js';
import { state } from '../state.js';
import { core } from '../core.js';

// =================================================================
// 扩展管理模块
// =================================================================
export const extensionManager = {
    // 事件监听器ID存储
    eventIds: [],
    
    // 图标缓存（避免重复请求）
    iconCache: new Map(),
    
    // 当前视图模式：'list' 或 'icon' (默认使用图标视图)
    currentView: 'icon',
    
    // 是否使用分组视图
    useGroupView: false,
    
    /**
     * 初始化扩展管理模块
     */
    init() {
        logger.debug('[ExtensionManager] 初始化扩展管理模块');
        
        // 从userData加载保存的视图偏好
        if (state.userData && state.userData.extensionSettings) {
            if (state.userData.extensionSettings.viewMode) {
                this.currentView = state.userData.extensionSettings.viewMode;
            }
            if (state.userData.extensionSettings.useGroupView !== undefined) {
                this.useGroupView = state.userData.extensionSettings.useGroupView;
            }
        }
        
        // 初始化分组数据
        this.initGroups();
        
        // 绑定视图切换按钮事件
        this.bindViewToggleEvents();
        
        // 绑定分组管理按钮事件
        this.bindGroupManagementEvents();
    },
    
    /**
     * 初始化情景模式数据（原分组数据）
     */
    initGroups() {
        if (!state.userData) {
            state.userData = {};
        }
        if (!state.userData.extensionSettings) {
            state.userData.extensionSettings = {};
        }
        // 【情景模式】强制迁移旧数据：如果存在groups，迁移到scenarios
        if (state.userData.extensionSettings.groups) {
            // 【关键修复】强制迁移，即使scenarios已存在也要迁移（确保数据一致性）
            if (!state.userData.extensionSettings.scenarios || state.userData.extensionSettings.scenarios.length === 0) {
                state.userData.extensionSettings.scenarios = JSON.parse(JSON.stringify(state.userData.extensionSettings.groups));
                logger.debug('[ExtensionManager] 迁移旧分组数据到情景模式:', state.userData.extensionSettings.scenarios.length);
            }
            // 删除旧的groups数据
            delete state.userData.extensionSettings.groups;
            // 强制保存迁移后的数据
            core.saveUserData(() => {});
        }
        if (!Array.isArray(state.userData.extensionSettings.scenarios)) {
            state.userData.extensionSettings.scenarios = [];
        }
        // 【情景模式】初始化未分组扩展列表
        if (!Array.isArray(state.userData.extensionSettings.ungroupedExtensions)) {
            state.userData.extensionSettings.ungroupedExtensions = [];
        }
        // 【情景模式】初始化当前启用的情景模式ID
        if (!state.userData.extensionSettings.activeScenarioId) {
            state.userData.extensionSettings.activeScenarioId = null;
        }
    },
    
    /**
     * 获取所有情景模式（原分组）
     */
    getGroups() {
        this.initGroups();
        const scenarios = state.userData.extensionSettings.scenarios || [];
        // 【调试】验证数据迁移
        if (state.userData.extensionSettings.groups) {
            logger.warn('[ExtensionManager] 警告：检测到旧的groups数据，应该已迁移到scenarios');
        }
        logger.debug(`[ExtensionManager] 获取情景模式列表，数量: ${scenarios.length}`);
        return scenarios;
    },
    
    /**
     * 获取未分组扩展列表
     */
    getUngroupedExtensions() {
        this.initGroups();
        return state.userData.extensionSettings.ungroupedExtensions || [];
    },
    
    /**
     * 检查扩展是否在未分组中（优先权最大）
     */
    isUngrouped(extensionId) {
        const ungrouped = this.getUngroupedExtensions();
        return ungrouped.includes(extensionId);
    },
    
    /**
     * 将扩展添加到未分组（优先权最大）
     */
    addToUngrouped(extensionId) {
        const ungrouped = this.getUngroupedExtensions();
        if (!ungrouped.includes(extensionId)) {
            ungrouped.push(extensionId);
            this.saveGroups();
        }
    },
    
    /**
     * 从未分组中移除扩展
     */
    removeFromUngrouped(extensionId) {
        const ungrouped = this.getUngroupedExtensions();
        const index = ungrouped.indexOf(extensionId);
        if (index !== -1) {
            ungrouped.splice(index, 1);
            this.saveGroups();
        }
    },
    
    /**
     * 获取当前启用的情景模式ID
     */
    getActiveScenarioId() {
        this.initGroups();
        return state.userData.extensionSettings.activeScenarioId || null;
    },
    
    /**
     * 设置当前启用的情景模式ID
     */
    setActiveScenarioId(scenarioId) {
        this.initGroups();
        state.userData.extensionSettings.activeScenarioId = scenarioId;
        this.saveGroups();
    },
    
    /**
     * 保存分组
     */
    saveGroups() {
        core.saveUserData(() => {});
    },
    
    /**
     * 创建新情景模式（原分组）
     * @param {string} name - 情景模式名称
     * @returns {Object} 新情景模式对象
     */
    createGroup(name) {
        const groups = this.getGroups();
        const newGroup = {
            id: `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name || '未命名情景模式',
            extensionIds: []
        };
        groups.push(newGroup);
        this.saveGroups();
        return newGroup;
    },
    
    /**
     * 删除分组
     * @param {string} groupId - 分组ID
     */
    deleteGroup(groupId) {
        const groups = this.getGroups();
        const index = groups.findIndex(g => g.id === groupId);
        if (index !== -1) {
            groups.splice(index, 1);
            this.saveGroups();
        }
    },
    
    /**
     * 更新分组
     * @param {string} groupId - 分组ID
     * @param {Object} updates - 更新内容
     */
    updateGroup(groupId, updates) {
        const groups = this.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (group) {
            Object.assign(group, updates);
            this.saveGroups();
        }
    },
    
    /**
     * 将扩展添加到情景模式（允许一个扩展属于多个情景模式）
     * @param {string} extensionId - 扩展ID
     * @param {string} groupId - 情景模式ID
     */
    addExtensionToGroup(extensionId, groupId) {
        // 【情景模式】允许扩展属于多个情景模式，不再从其他模式中移除
        // 【关键修复】扩展可以同时在未分组和情景模式中，未分组只是优先权最大
        const groups = this.getGroups();
        const targetGroup = groups.find(g => g.id === groupId);
        if (!targetGroup) {
            logger.warn(`[ExtensionManager] 找不到情景模式: ${groupId}`);
            return;
        }
        
        // 【关键修复】检查扩展是否已经在其他情景模式中
        const existingScenarios = this.getExtensionScenarios(extensionId);
        const isUngrouped = this.isUngrouped(extensionId);
        
        logger.debug(`[ExtensionManager] 添加扩展到情景模式:`, {
            extensionId,
            targetScenario: targetGroup.name,
            alreadyInScenarios: existingScenarios.map(s => s.name),
            isUngrouped,
            willAddToScenario: !targetGroup.extensionIds.includes(extensionId)
        });
        
        if (!targetGroup.extensionIds.includes(extensionId)) {
            targetGroup.extensionIds.push(extensionId);
            // 【情景模式】不再自动从未分组中移除，允许扩展同时存在
            // 【验证】确保扩展仍然在未分组中（如果之前就在）
            if (isUngrouped && !this.isUngrouped(extensionId)) {
                logger.error(`[ExtensionManager] 错误：扩展 ${extensionId} 在添加到情景模式后从未分组中丢失！`);
                this.addToUngrouped(extensionId);
            }
            this.saveGroups();
            logger.debug(`[ExtensionManager] 扩展已添加到情景模式，当前所属情景模式:`, this.getExtensionScenarios(extensionId).map(s => s.name));
        } else {
            logger.debug(`[ExtensionManager] 扩展已在情景模式中: ${targetGroup.name}`);
        }
    },
    
    /**
     * 从情景模式中移除扩展
     * @param {string} extensionId - 扩展ID
     * @param {string|null} groupId - 情景模式ID，如果为null则从所有模式中移除
     */
    removeExtensionFromGroup(extensionId, groupId = null) {
        const groups = this.getGroups();
        if (groupId) {
            // 从指定情景模式中移除
            const group = groups.find(g => g.id === groupId);
            if (group) {
                const index = group.extensionIds.indexOf(extensionId);
                if (index !== -1) {
                    group.extensionIds.splice(index, 1);
                    this.saveGroups();
                }
            }
        } else {
            // 从所有情景模式中移除
            groups.forEach(group => {
                const index = group.extensionIds.indexOf(extensionId);
                if (index !== -1) {
                    group.extensionIds.splice(index, 1);
                }
            });
            // 【情景模式】从所有模式中移除后，自动添加到未分组（优先权最大）
            this.addToUngrouped(extensionId);
            this.saveGroups();
        }
    },
    
    /**
     * 获取扩展所属的情景模式（兼容旧接口）
     * @param {string} extensionId - 扩展ID
     * @returns {Object|null} 第一个找到的情景模式对象（用于兼容）
     */
    getExtensionGroup(extensionId) {
        const scenarios = this.getExtensionScenarios(extensionId);
        return scenarios.length > 0 ? scenarios[0] : null;
    },
    
    /**
     * 获取扩展所属的所有情景模式
     * @param {string} extensionId - 扩展ID
     * @returns {Array<Object>} 情景模式对象数组
     */
    getExtensionScenarios(extensionId) {
        const groups = this.getGroups();
        return groups.filter(g => g.extensionIds.includes(extensionId));
    },
    
    /**
     * 启用/禁用情景模式（原一键启用/禁用分组）
     * @param {string} groupId - 情景模式ID
     * @param {boolean} enabled - 是否启用
     */
    async toggleGroup(groupId, enabled) {
        const groups = this.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        
        try {
            if (enabled) {
                // 【情景模式】启用情景模式：设置当前启用的模式ID
                this.setActiveScenarioId(groupId);
                
                // 收集所有情景模式中的扩展ID（用于判断哪些扩展应该被禁用）
                const allScenarioExtensionIds = new Set();
                groups.forEach(g => {
                    g.extensionIds.forEach(id => allScenarioExtensionIds.add(id));
                });
                
                // 获取未分组扩展列表（优先权最大，不受情景模式控制）
                const ungroupedExtensionIds = new Set(this.getUngroupedExtensions());
                
                // 1. 启用当前情景模式下的所有扩展
                // 【修复】即使扩展在未分组中，如果它在当前情景模式中，也应该被启用
                // 未分组扩展的"优先权"是指不会被自动禁用，但仍应能被启用
                const enablePromises = group.extensionIds
                    .map(extId => 
                        this.setEnabled(extId, true).catch(err => {
                            logger.warn(`[ExtensionManager] 无法启用扩展 ${extId}:`, err);
                        })
                    );
                
                // 2. 禁用所有不在当前情景模式中的扩展（跳过未分组扩展）
                // 【关键修复】只处理情景模式中的扩展，不影响不在任何情景模式中的扩展
                // 即使扩展在其他情景模式中，只要不在当前模式中，就应该禁用
                const disablePromises = [];
                allScenarioExtensionIds.forEach(extId => {
                    // 跳过未分组扩展（优先权最大）
                    if (ungroupedExtensionIds.has(extId)) {
                        return;
                    }
                    // 如果扩展不在当前情景模式中，则禁用
                    // 【修复】只处理在情景模式中的扩展，不在任何情景模式中的扩展保持原状
                    if (!group.extensionIds.includes(extId)) {
                        disablePromises.push(
                            this.setEnabled(extId, false).catch(err => {
                                logger.warn(`[ExtensionManager] 无法禁用扩展 ${extId}:`, err);
                            })
                        );
                    }
                });
                
                await Promise.all([...enablePromises, ...disablePromises]);
            } else {
                // 【情景模式】禁用情景模式：清除当前启用的模式ID
                if (this.getActiveScenarioId() === groupId) {
                    this.setActiveScenarioId(null);
                }
                
                // 【修复】禁用该模式下的所有扩展（跳过未分组扩展）
                // 禁用情景模式时，只禁用该模式下的扩展，不影响其他扩展的状态
                const promises = group.extensionIds
                    .filter(extId => !this.isUngrouped(extId)) // 【优先权】跳过未分组扩展
                    .map(extId => 
                        this.setEnabled(extId, false).catch(err => {
                            logger.warn(`[ExtensionManager] 无法禁用扩展 ${extId}:`, err);
                        })
                    );
                
                await Promise.all(promises);
            }
            
            // 重新渲染列表
            const searchInput = document.getElementById('extension-search-input');
            const searchQuery = searchInput ? searchInput.value.trim() : '';
            await this.renderExtensionList(searchQuery);
        } catch (error) {
            logger.error(`[ExtensionManager] ${enabled ? '启用' : '禁用'}情景模式失败:`, error);
            throw error;
        }
    },
    
    /**
     * 获取当前视图模式
     */
    getCurrentView() {
        return this.currentView;
    },
    
    /**
     * 设置视图模式
     * @param {string} view - 'list' 或 'icon'
     */
    setView(view) {
        if (view !== 'list' && view !== 'icon') {
            logger.warn('[ExtensionManager] 无效的视图模式:', view);
            return;
        }
        
        this.currentView = view;
        
        // 保存到userData
        if (!state.userData) {
            state.userData = {};
        }
        if (!state.userData.extensionSettings) {
            state.userData.extensionSettings = {};
        }
        state.userData.extensionSettings.viewMode = view;
        core.saveUserData(() => {});
        
        // 更新按钮状态
        this.updateViewToggleButtons();
        
        // 重新渲染列表（使用当前搜索关键词）
        const searchInput = document.getElementById('extension-search-input');
        const searchQuery = searchInput ? searchInput.value.trim() : '';
        this.renderExtensionList(searchQuery);
    },
    
    /**
     * 更新视图切换按钮状态
     */
    updateViewToggleButtons() {
        const listBtn = document.getElementById('extension-view-list-btn');
        const iconBtn = document.getElementById('extension-view-icon-btn');
        
        if (listBtn && iconBtn) {
            if (this.currentView === 'list') {
                listBtn.classList.add('active');
                iconBtn.classList.remove('active');
            } else {
                listBtn.classList.remove('active');
                iconBtn.classList.add('active');
            }
        }
    },
    
    /**
     * 绑定视图切换按钮事件
     */
    bindViewToggleEvents() {
        const listBtn = document.getElementById('extension-view-list-btn');
        const iconBtn = document.getElementById('extension-view-icon-btn');
        
        if (listBtn) {
            const eventId = eventManager.add(listBtn, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.setView('list');
            });
            this.eventIds.push(eventId);
        }
        
        if (iconBtn) {
            const eventId = eventManager.add(iconBtn, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.setView('icon');
            });
            this.eventIds.push(eventId);
        }
        
        // 初始化按钮状态
        this.updateViewToggleButtons();
    },
    
    /**
     * 绑定分组管理按钮事件
     */
    bindGroupManagementEvents() {
        const manageGroupsBtn = document.getElementById('extension-manage-groups-btn');
        const toggleGroupViewBtn = document.getElementById('extension-toggle-group-view-btn');
        
        if (manageGroupsBtn) {
            const eventId = eventManager.add(manageGroupsBtn, 'click', () => {
                this.showGroupManagementModal();
            });
            this.eventIds.push(eventId);
        }
        
        if (toggleGroupViewBtn) {
            const eventId = eventManager.add(toggleGroupViewBtn, 'click', () => {
                this.useGroupView = !this.useGroupView;
                if (!state.userData.extensionSettings) {
                    state.userData.extensionSettings = {};
                }
                state.userData.extensionSettings.useGroupView = this.useGroupView;
                core.saveUserData(() => {});
                
                // 更新按钮状态
                toggleGroupViewBtn.classList.toggle('active', this.useGroupView);
                
                // 重新渲染
                const searchInput = document.getElementById('extension-search-input');
                const searchQuery = searchInput ? searchInput.value.trim() : '';
                this.renderExtensionList(searchQuery);
            });
            this.eventIds.push(eventId);
            
            // 初始化按钮状态
            toggleGroupViewBtn.classList.toggle('active', this.useGroupView);
        }
    },
    
    /**
     * 显示分组管理模态框
     */
    showGroupManagementModal() {
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'modal-overlay visible';
        modal.style.cssText = 'z-index: 10000;';
        
        const groups = this.getGroups();
        const allExtensions = []; // 需要异步获取，先显示UI
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>管理情景模式</h3>
                    <button class="modal-close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 16px;">
                        <button id="extension-create-group-btn" class="effects-btn effects-btn-sm">
                            + 新建情景模式
                        </button>
                    </div>
                    <div id="extension-groups-list"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 关闭按钮
        const closeBtn = modal.querySelector('.modal-close-btn');
        const closeModal = () => {
            modal.remove();
        };
        closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // 新建情景模式按钮
        const createBtn = modal.querySelector('#extension-create-group-btn');
        createBtn.addEventListener('click', () => {
            const name = prompt('请输入情景模式名称：');
            if (name && name.trim()) {
                this.createGroup(name.trim());
                this.renderGroupsList(modal.querySelector('#extension-groups-list'));
            }
        });
        
        // 渲染分组列表
        this.renderGroupsList(modal.querySelector('#extension-groups-list'));
    },
    
    /**
     * 渲染分组列表
     * @param {HTMLElement} container - 容器元素
     */
    async renderGroupsList(container) {
        const groups = this.getGroups();
        const allExtensions = await this.getAllExtensions();
        const extMap = new Map(allExtensions.map(ext => [ext.id, ext]));
        
        container.innerHTML = '';
        
        if (groups.length === 0) {
            container.innerHTML = '<p style="color: rgba(255,255,255,0.6); text-align: center; padding: 20px;">暂无情景模式，点击"新建情景模式"创建</p>';
            return;
        }
        
        groups.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'extension-group-item';
            groupDiv.style.cssText = `
                padding: 12px;
                margin-bottom: 12px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
            `;
            
            const extensions = group.extensionIds.map(id => extMap.get(id)).filter(Boolean);
            const enabledCount = extensions.filter(ext => ext.enabled).length;
            
            groupDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div>
                        <strong style="color: rgba(255,255,255,0.9);">${this.escapeHtml(group.name)}</strong>
                        <span style="font-size: 11px; color: rgba(255,255,255,0.6); margin-left: 8px;">
                            (${extensions.length} 个扩展, ${enabledCount} 已启用)
                        </span>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="extension-group-enable-btn effects-btn effects-btn-sm" 
                                data-group-id="${group.id}" 
                                title="一键启用">
                            启用
                        </button>
                        <button class="extension-group-disable-btn effects-btn effects-btn-sm" 
                                data-group-id="${group.id}"
                                title="一键禁用">
                            禁用
                        </button>
                        <button class="extension-group-edit-btn effects-btn effects-btn-sm" 
                                data-group-id="${group.id}">
                            编辑
                        </button>
                        <button class="extension-group-delete-btn effects-btn effects-btn-sm effects-btn-danger" 
                                data-group-id="${group.id}">
                            删除
                        </button>
                    </div>
                </div>
                <div class="extension-group-extensions" style="font-size: 11px; color: rgba(255,255,255,0.7);">
                    ${extensions.length > 0 
                        ? extensions.map(ext => `<span style="margin-right: 8px;">${this.escapeHtml(ext.name)}</span>`).join('')
                        : '<span style="color: rgba(255,255,255,0.4);">暂无扩展</span>'
                    }
                </div>
            `;
            
            container.appendChild(groupDiv);
        });
        
        // 绑定事件
        container.querySelectorAll('.extension-group-enable-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const groupId = btn.dataset.groupId;
                btn.disabled = true;
                btn.textContent = '启用中...';
                try {
                    await this.toggleGroup(groupId, true);
                } catch (error) {
                    alert(`启用失败: ${error.message}`);
                } finally {
                    btn.disabled = false;
                    btn.textContent = '启用';
                }
            });
        });
        
        container.querySelectorAll('.extension-group-disable-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const groupId = btn.dataset.groupId;
                btn.disabled = true;
                btn.textContent = '禁用中...';
                try {
                    await this.toggleGroup(groupId, false);
                } catch (error) {
                    alert(`禁用失败: ${error.message}`);
                } finally {
                    btn.disabled = false;
                    btn.textContent = '禁用';
                }
            });
        });
        
        container.querySelectorAll('.extension-group-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const groupId = btn.dataset.groupId;
                const group = groups.find(g => g.id === groupId);
                if (group) {
                    const newName = prompt('请输入新名称：', group.name);
                    if (newName && newName.trim()) {
                        this.updateGroup(groupId, { name: newName.trim() });
                        this.renderGroupsList(container);
                    }
                }
            });
        });
        
        container.querySelectorAll('.extension-group-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const groupId = btn.dataset.groupId;
                const group = groups.find(g => g.id === groupId);
                if (group && confirm(`确定要删除情景模式 "${group.name}" 吗？\n扩展不会被卸载，只是从情景模式中移除。`)) {
                    this.deleteGroup(groupId);
                    this.renderGroupsList(container);
                }
            });
        });
    },
    
    /**
     * 获取所有已安装的扩展
     * @returns {Promise<Array>} 扩展列表
     */
    async getAllExtensions() {
        try {
            if (!chrome || !chrome.management) {
                logger.warn('[ExtensionManager] Chrome management API 不可用');
                return [];
            }
            
            const extensions = await chrome.management.getAll();
            // 过滤掉自身
            const currentId = chrome.runtime.id;
            const filtered = extensions.filter(ext => ext.id !== currentId);
            
            // 调试：检查第一个扩展的icons属性
            if (filtered.length > 0) {
                const firstExt = filtered[0];
                console.log('[ExtensionManager] 🔍 调试扩展对象:', {
                    id: firstExt.id,
                    name: firstExt.name,
                    hasIcons: !!firstExt.icons,
                    iconsType: typeof firstExt.icons,
                    iconsIsArray: Array.isArray(firstExt.icons),
                    iconsLength: firstExt.icons?.length,
                    icons: firstExt.icons
                });
            }
            
            return filtered;
        } catch (error) {
            logger.error('[ExtensionManager] 获取扩展列表失败:', error);
            return [];
        }
    },
    
    /**
     * 启用/禁用扩展
     * @param {string} extensionId - 扩展ID
     * @param {boolean} enabled - 是否启用
     */
    async setEnabled(extensionId, enabled) {
        try {
            if (!chrome || !chrome.management) {
                throw new Error('Chrome management API 不可用');
            }
            
            await chrome.management.setEnabled(extensionId, enabled);
            logger.debug(`[ExtensionManager] 扩展 ${extensionId} ${enabled ? '已启用' : '已禁用'}`);
            return true;
        } catch (error) {
            logger.error(`[ExtensionManager] ${enabled ? '启用' : '禁用'}扩展失败:`, error);
            throw error;
        }
    },
    
    /**
     * 卸载扩展
     * @param {string} extensionId - 扩展ID
     */
    async uninstall(extensionId) {
        try {
            if (!chrome || !chrome.management) {
                throw new Error('Chrome management API 不可用');
            }
            
            await chrome.management.uninstall(extensionId);
            logger.debug(`[ExtensionManager] 扩展 ${extensionId} 已卸载`);
            return true;
        } catch (error) {
            logger.error(`[ExtensionManager] 卸载扩展失败:`, error);
            throw error;
        }
    },
    
    /**
     * 打开扩展详情页面
     * @param {string} extensionId - 扩展ID
     */
    openExtensionDetails(extensionId) {
        try {
            chrome.tabs.create({
                url: `chrome://extensions/?id=${extensionId}`
            });
        } catch (error) {
            logger.error('[ExtensionManager] 打开扩展详情失败:', error);
        }
    },
    
    /**
     * 搜索扩展
     * @param {string} query - 搜索关键词
     * @param {Array} extensions - 扩展列表
     * @returns {Array} 搜索结果
     */
    searchExtensions(query, extensions) {
        if (!query || !query.trim()) {
            return extensions;
        }
        
        const lowerQuery = query.toLowerCase().trim();
        return extensions.filter(ext => {
            const name = (ext.name || '').toLowerCase();
            const description = (ext.description || '').toLowerCase();
            const version = (ext.version || '').toLowerCase();
            return name.includes(lowerQuery) || 
                   description.includes(lowerQuery) || 
                   version.includes(lowerQuery);
        });
    },
    
    /**
     * 渲染扩展列表
     * @param {string} searchQuery - 可选的搜索关键词
     * @param {HTMLElement} container - 可选的容器元素（如果提供，将使用此容器而不是查找ID）
     */
    async renderExtensionList(searchQuery = '', container = null) {
        const listContainer = container || document.getElementById('extension-list');
        if (!listContainer) {
            logger.warn('[ExtensionManager] 扩展列表容器未找到', {
                hasContainer: !!container,
                containerId: container?.id,
                elementExists: !!document.getElementById('extension-list')
            });
            return;
        }
        
        // 清空现有内容
        listContainer.innerHTML = '';
        
        // 检查API是否可用
        if (!chrome || !chrome.management) {
            listContainer.innerHTML = `
                <div class="effects-empty-state">
                    <p style="color: rgba(255,255,255,0.6); text-align: center; padding: 20px;">
                        扩展管理功能需要 management 权限，请检查扩展权限设置。
                    </p>
                </div>
            `;
            return;
        }
        
        try {
            // 显示加载状态
            listContainer.innerHTML = `
                <div class="effects-empty-state">
                    <p style="color: rgba(255,255,255,0.6); text-align: center; padding: 20px;">
                        正在加载扩展列表...
                    </p>
                </div>
            `;
            
            let extensions = await this.getAllExtensions();
            
            // 如果有关键词，进行搜索过滤
            if (searchQuery && searchQuery.trim()) {
                extensions = this.searchExtensions(searchQuery, extensions);
            }
            
            if (extensions.length === 0) {
                listContainer.innerHTML = `
                    <div class="effects-empty-state">
                        <p style="color: rgba(255,255,255,0.6); text-align: center; padding: 20px;">
                            没有找到已安装的扩展。
                        </p>
                    </div>
                `;
                return;
            }
            
            // 清空加载状态
            listContainer.innerHTML = '';
            
            // 强制使用图标视图
            this.currentView = 'icon';
            listContainer.classList.add('extension-icon-view');
            listContainer.classList.remove('extension-list-view');
            
            // 计算统计数据用于日志
            const enabledCount = extensions.filter(ext => ext.enabled).length;
            const disabledCount = extensions.length - enabledCount;
            
            // 根据是否使用分组视图渲染
            if (this.useGroupView) {
                await this.renderGroupView(listContainer, extensions);
            } else {
                // 强制使用图标视图
                await this.renderIconView(listContainer, extensions);
            }
            
            // 绑定事件
            this.bindExtensionListEvents();
            this.bindSearchEvents();
            
            logger.debug(`[ExtensionManager] 已渲染 ${extensions.length} 个扩展 (${enabledCount} 已启用, ${disabledCount} 已禁用)`);
        } catch (error) {
            logger.error('[ExtensionManager] 渲染扩展列表失败:', error);
            listContainer.innerHTML = `
                <div class="effects-empty-state">
                    <p style="color: rgba(255,100,100,0.8); text-align: center; padding: 20px;">
                        加载扩展列表失败: ${error.message}
                    </p>
                </div>
            `;
        }
    },
    
    /**
     * 直接从扩展对象的 icons 数组获取图标（最优先）
     * chrome.management 返回的图标URL格式是 chrome://extension-icon/{id}/{size}/0
     * 需要通过 background script 转换为 data URL 才能在 img 标签中使用
     * @param {Object} ext - 扩展对象（包含 icons 数组）
     * @returns {Promise<string|null>} 图标data URL，失败返回null
     */
    async getIconFromExtensionObject(ext) {
        if (!ext || !ext.icons || !Array.isArray(ext.icons) || ext.icons.length === 0) {
            console.log(`[ExtensionManager] ⚠️ 扩展 ${ext.id} 没有icons属性或icons为空`);
            return null;
        }
        
        // 检查缓存
        const cacheKey = `direct-${ext.id}`;
        if (this.iconCache.has(cacheKey)) {
            const cached = this.iconCache.get(cacheKey);
            if (cached.success && cached.dataUrl) {
                // 验证缓存的dataUrl不是chrome://extension-icon/（防止缓存了错误的URL）
                if (cached.dataUrl.startsWith('chrome://extension-icon/')) {
                    console.warn(`[ExtensionManager] ⚠️ 缓存中包含chrome://extension-icon/ URL，清除缓存: ${ext.id}`);
                    this.iconCache.delete(cacheKey);
                    return null;
                }
                console.log(`[ExtensionManager] ✅ 使用缓存的图标: ${ext.id}`, cached.dataUrl.substring(0, 50));
                return cached.dataUrl;
            }
            return null;
        }
        
        try {
            // 优先选择最大尺寸的图标（128x128或更大）
            const sortedIcons = ext.icons.sort((a, b) => (b.size || 0) - (a.size || 0));
            const iconUrl = sortedIcons[0].url;
            
            console.log(`[ExtensionManager] 📋 扩展图标URL: ${ext.id}`, iconUrl);
            
            // chrome://extension-icon/ 格式需要通过 background script 转换为 data URL
            if (iconUrl && (iconUrl.startsWith('chrome://extension-icon/') || iconUrl.startsWith('chrome-extension://'))) {
                try {
                    // 通过 background script 获取图标（使用回调方式）
                    const dataUrl = await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            reject(new Error('Background script响应超时'));
                        }, 5000);
                        
                        chrome.runtime.sendMessage({
                            action: 'getExtensionIconFromUrl',
                            iconUrl: iconUrl,
                            extensionId: ext.id
                        }, (response) => {
                            clearTimeout(timeout);
                            
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                                return;
                            }
                            
                            if (response && response.success && response.dataUrl) {
                                // 验证返回的dataUrl确实是data URL格式，不是chrome://extension-icon/
                                const dataUrl = response.dataUrl;
                                if (dataUrl.startsWith('data:image/')) {
                                    console.log(`[ExtensionManager] ✅ 收到有效的data URL: ${ext.id}`, dataUrl.substring(0, 50));
                                    resolve(dataUrl);
                                } else if (dataUrl.startsWith('chrome://extension-icon/')) {
                                    // 如果返回的还是chrome://extension-icon/，说明转换失败
                                    console.error(`[ExtensionManager] ❌ Background返回了chrome://extension-icon/ URL，转换失败: ${ext.id}`);
                                    reject(new Error('Background script未正确转换图标URL'));
                                } else {
                                    // 其他格式（如HTTP URL）也可以接受
                                    console.log(`[ExtensionManager] ✅ 收到其他格式URL: ${ext.id}`, dataUrl.substring(0, 50));
                                    resolve(dataUrl);
                                }
                            } else {
                                reject(new Error(response?.error || '未知错误'));
                            }
                        });
                    });
                    
                    // 再次验证dataUrl格式（确保不是chrome://extension-icon/）
                    if (dataUrl && dataUrl.startsWith('data:image/')) {
                        // 缓存成功的图标
                        this.iconCache.set(cacheKey, {
                            success: true,
                            dataUrl: dataUrl,
                            timestamp: Date.now()
                        });
                        
                        console.log(`[ExtensionManager] ✅ 成功获取扩展图标(data URL): ${ext.id}`, dataUrl.substring(0, 50));
                        return dataUrl;
                    } else {
                        console.error(`[ExtensionManager] ❌ 获取到的不是data URL格式: ${ext.id}`, dataUrl?.substring(0, 100));
                        // 缓存失败的结果
                        this.iconCache.set(cacheKey, {
                            success: false,
                            timestamp: Date.now()
                        });
                        return null;
                    }
                } catch (error) {
                    console.error(`[ExtensionManager] ❌ 通过background script获取图标失败: ${ext.id}`, error);
                    // 缓存失败的结果
                    this.iconCache.set(cacheKey, {
                        success: false,
                        timestamp: Date.now()
                    });
                    return null;
                }
            } else if (iconUrl && (iconUrl.startsWith('http://') || iconUrl.startsWith('https://'))) {
                // HTTP(S) URL可以直接使用
                this.iconCache.set(cacheKey, {
                    success: true,
                    dataUrl: iconUrl, // 存储为dataUrl字段以保持一致性
                    timestamp: Date.now()
                });
                return iconUrl;
            }
            
            return null;
        } catch (error) {
            console.error(`[ExtensionManager] ❌ 从扩展对象获取图标异常: ${ext.id}`, error);
            // 缓存失败的结果
            this.iconCache.set(cacheKey, {
                success: false,
                timestamp: Date.now()
            });
            return null;
        }
    },
    
    /**
     * 从 crxsoso.com 获取扩展图标（备选方案）
     * 参考 one-click-extensions-manager：直接使用HTTP URL，让img标签加载
     * @param {string} extensionId - 扩展ID
     * @returns {Promise<string|null>} 图标URL，失败返回null
     */
    async getIconFromCrxsoso(extensionId) {
        // 检查缓存
        if (this.iconCache.has(extensionId)) {
            const cached = this.iconCache.get(extensionId);
            if (cached.success && cached.iconUrl) {
                return cached.iconUrl;
            }
            return null;
        }
        
        try {
            // crxsoso.com的图标URL格式
            const iconUrl = `https://www.crxsoso.com/webstore/icons/${extensionId}/128/0`;
            
            // 直接返回URL，让img标签加载（如果失败会触发onerror，使用占位图标）
            // 缓存图标URL
                this.iconCache.set(extensionId, {
                    success: true,
                iconUrl: iconUrl,
                    timestamp: Date.now()
                });
            
            return iconUrl;
        } catch (error) {
            console.error(`[ExtensionManager] ❌ 从 crxsoso.com 获取图标失败: ${extensionId}`, error);
            // 缓存失败的结果
            this.iconCache.set(extensionId, {
                success: false,
                timestamp: Date.now()
            });
            return null;
        }
    },
    
    /**
     * 从扩展的 homepageUrl 通过第三方图标服务获取图标
     * @param {Object} ext - 扩展信息（可能包含 homepageUrl）
     * @returns {Promise<string|null>} 图标URL，失败返回null
     */
    async getIconFromHomepageUrl(ext) {
        if (!ext || !ext.homepageUrl) {
            return null;
        }
        
        try {
            // 动态导入 aiManager 避免循环依赖
            const { aiManager } = await import('./ai-manager.js');
            const sources = aiManager.getIconSources(ext.homepageUrl);
            
            if (sources && sources.length > 0) {
                // 使用第一个图标源（icon.bqb.cool，首选）
                const iconUrl = sources[0].url;
                console.log(`[ExtensionManager] ✅ 使用第三方图标服务获取图标: ${ext.id}`, iconUrl);
                return iconUrl;
            }
        } catch (error) {
            console.warn(`[ExtensionManager] ⚠️ 通过第三方图标服务获取图标失败: ${ext.id}`, error);
        }
        
        return null;
    },
    
    /**
     * 获取扩展图标（优先使用扩展对象本身的图标，然后 crxsoso.com，然后 homepageUrl，最后使用占位图标）
     * 参考 one-click-extensions-manager 项目：直接使用图标URL，不需要转换为data URL
     * @param {Object} ext - 扩展信息（应包含 icons 数组）
     * @returns {Promise<string>} 图标URL（chrome-extension:// URL、HTTP URL或占位图标）
     */
    async getExtensionIcon(ext) {
        // 最优先：直接从扩展对象的 icons 数组获取（Chrome 官方提供的数据）
        const directIcon = await this.getIconFromExtensionObject(ext);
        if (directIcon) {
            console.log(`[ExtensionManager] ✅ 使用扩展对象图标: ${ext.id}`);
            return directIcon;
        }
        
        // 如果失败，尝试从 crxsoso.com 获取
        const crxsosoIcon = await this.getIconFromCrxsoso(ext.id);
        if (crxsosoIcon) {
            console.log(`[ExtensionManager] ✅ 使用crxsoso图标: ${ext.id}`);
            return crxsosoIcon;
        }
        
        // 如果 crxsoso 也失败，尝试通过扩展的 homepageUrl 使用第三方图标服务
        const homepageIcon = await this.getIconFromHomepageUrl(ext);
        if (homepageIcon) {
            console.log(`[ExtensionManager] ✅ 使用homepageUrl第三方图标服务: ${ext.id}`);
            return homepageIcon;
        }
        
        // 如果都失败，返回null（不使用占位图标）
        console.warn(`[ExtensionManager] ⚠️ 无法获取图标: ${ext.id}`);
        return null;
    },
    
    /**
     * 渲染列表视图
     * @param {HTMLElement} container - 容器元素
     * @param {Array} extensions - 扩展列表
     */
    async renderListView(container, extensions) {
        // 按启用状态分组
        const enabledExtensions = extensions.filter(ext => ext.enabled).sort((a, b) => a.name.localeCompare(b.name));
        const disabledExtensions = extensions.filter(ext => !ext.enabled).sort((a, b) => a.name.localeCompare(b.name));
        
        // 渲染已启用的扩展
        if (enabledExtensions.length > 0) {
            const enabledGroup = document.createElement('div');
            enabledGroup.className = 'extension-group';
            enabledGroup.innerHTML = `
                <div class="extension-group-header">
                    <span class="extension-group-title">已启用 (${enabledExtensions.length})</span>
                </div>
                <div class="extension-group-list"></div>
            `;
            const enabledList = enabledGroup.querySelector('.extension-group-list');
            container.appendChild(enabledGroup);
            
            // 异步创建扩展项（因为需要获取图标）
            for (const ext of enabledExtensions) {
                const item = await this.createExtensionItem(ext);
                enabledList.appendChild(item);
            }
        }
        
        // 渲染已禁用的扩展
        if (disabledExtensions.length > 0) {
            const disabledGroup = document.createElement('div');
            disabledGroup.className = 'extension-group';
            disabledGroup.innerHTML = `
                <div class="extension-group-header">
                    <span class="extension-group-title">已禁用 (${disabledExtensions.length})</span>
                </div>
                <div class="extension-group-list"></div>
            `;
            const disabledList = disabledGroup.querySelector('.extension-group-list');
            container.appendChild(disabledGroup);
            
            // 异步创建扩展项（因为需要获取图标）
            for (const ext of disabledExtensions) {
                const item = await this.createExtensionItem(ext);
                disabledList.appendChild(item);
            }
        }
    },
    
    /**
     * 渲染图标视图
     * @param {HTMLElement} container - 容器元素
     * @param {Array} extensions - 扩展列表
     */
    async renderIconView(container, extensions) {
        // 按启用状态分组
        const enabledExtensions = extensions.filter(ext => ext.enabled).sort((a, b) => a.name.localeCompare(b.name));
        const disabledExtensions = extensions.filter(ext => !ext.enabled).sort((a, b) => a.name.localeCompare(b.name));
        
        // 渲染已启用的扩展
        if (enabledExtensions.length > 0) {
            const enabledGroup = document.createElement('div');
            enabledGroup.className = 'extension-group';
            enabledGroup.innerHTML = `
                <div class="extension-group-header">
                    <span class="extension-group-title">已启用 (${enabledExtensions.length})</span>
                </div>
                <div class="extension-icon-grid"></div>
            `;
            const enabledGrid = enabledGroup.querySelector('.extension-icon-grid');
            container.appendChild(enabledGroup);
            
            // 异步创建扩展图标项
            for (const ext of enabledExtensions) {
                const item = await this.createExtensionIconItem(ext);
                enabledGrid.appendChild(item);
            }
        }
        
        // 渲染已禁用的扩展
        if (disabledExtensions.length > 0) {
            const disabledGroup = document.createElement('div');
            disabledGroup.className = 'extension-group';
            disabledGroup.innerHTML = `
                <div class="extension-group-header">
                    <span class="extension-group-title">已禁用 (${disabledExtensions.length})</span>
                </div>
                <div class="extension-icon-grid"></div>
            `;
            const disabledGrid = disabledGroup.querySelector('.extension-icon-grid');
            container.appendChild(disabledGroup);
            
            // 异步创建扩展图标项
            for (const ext of disabledExtensions) {
                const item = await this.createExtensionIconItem(ext);
                disabledGrid.appendChild(item);
            }
        }
    },
    
    /**
     * 渲染分组视图
     * @param {HTMLElement} container - 容器元素
     * @param {Array} extensions - 扩展列表
     */
    async renderGroupView(container, extensions) {
        const groups = this.getGroups();
        const extMap = new Map(extensions.map(ext => [ext.id, ext]));
        const activeScenarioId = this.getActiveScenarioId();
        
        // 【情景模式】渲染每个情景模式
        for (const group of groups) {
            const groupExtensions = group.extensionIds.map(id => extMap.get(id)).filter(Boolean);
            
            if (groupExtensions.length === 0) continue;
            
            const enabledCount = groupExtensions.filter(ext => ext.enabled).length;
            const isActive = group.id === activeScenarioId;
            
            const groupDiv = document.createElement('div');
            groupDiv.className = 'extension-group';
            groupDiv.innerHTML = `
                <div class="extension-group-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span class="extension-group-title">${this.escapeHtml(group.name)}</span>
                        ${isActive ? '<span style="font-size: 11px; color: #4CAF50; margin-left: 8px;">[已启用]</span>' : ''}
                        <span style="font-size: 11px; color: rgba(255,255,255,0.6); margin-left: 8px;">
                            (${groupExtensions.length} 个扩展, ${enabledCount} 已启用)
                        </span>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="extension-group-toggle-btn effects-btn effects-btn-sm" 
                                data-group-id="${group.id}"
                                data-enabled="${isActive}"
                                title="${isActive ? '禁用情景模式' : '启用情景模式'}">
                            ${isActive ? '禁用' : '启用'}
                        </button>
                    </div>
                </div>
                ${this.currentView === 'icon' ? '<div class="extension-icon-grid"></div>' : '<div class="extension-group-list"></div>'}
            `;
            
            const contentContainer = groupDiv.querySelector(this.currentView === 'icon' ? '.extension-icon-grid' : '.extension-group-list');
            container.appendChild(groupDiv);
            
            // 【情景模式】绑定情景模式切换按钮
            const toggleBtn = groupDiv.querySelector('.extension-group-toggle-btn');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', async () => {
                    const shouldEnable = !isActive;
                    toggleBtn.disabled = true;
                    toggleBtn.textContent = shouldEnable ? '启用中...' : '禁用中...';
                    try {
                        await this.toggleGroup(group.id, shouldEnable);
                    } catch (error) {
                        alert(`操作失败: ${error.message}`);
                    } finally {
                        toggleBtn.disabled = false;
                    }
                });
            }
            
            // 渲染扩展
            for (const ext of groupExtensions.sort((a, b) => a.name.localeCompare(b.name))) {
                if (this.currentView === 'icon') {
                    const item = await this.createExtensionIconItem(ext);
                    contentContainer.appendChild(item);
                } else {
                    const item = await this.createExtensionItem(ext);
                    contentContainer.appendChild(item);
                }
            }
        }
        
        // 【情景模式】渲染未分组的扩展（优先权最大）
        const ungroupedExtensionIds = new Set(this.getUngroupedExtensions());
        // 【调试】记录未分组扩展ID列表
        logger.debug(`[ExtensionManager] 渲染未分组扩展，ID列表:`, Array.from(ungroupedExtensionIds));
        const ungroupedExtensions = extensions.filter(ext => {
            const isUngrouped = ungroupedExtensionIds.has(ext.id);
            if (isUngrouped) {
                logger.debug(`[ExtensionManager] 扩展 ${ext.id} (${ext.name}) 在未分组中`);
            }
            return isUngrouped;
        });
        
        if (ungroupedExtensions.length > 0) {
            const ungroupedGroup = document.createElement('div');
            ungroupedGroup.className = 'extension-group';
            const enabledCount = ungroupedExtensions.filter(ext => ext.enabled).length;
            ungroupedGroup.innerHTML = `
                <div class="extension-group-header">
                    <span class="extension-group-title">未分组 (${ungroupedExtensions.length})</span>
                </div>
                ${this.currentView === 'icon' ? '<div class="extension-icon-grid"></div>' : '<div class="extension-group-list"></div>'}
            `;
            
            const contentContainer = ungroupedGroup.querySelector(this.currentView === 'icon' ? '.extension-icon-grid' : '.extension-group-list');
            container.appendChild(ungroupedGroup);
            
            for (const ext of ungroupedExtensions.sort((a, b) => a.name.localeCompare(b.name))) {
                if (this.currentView === 'icon') {
                    const item = await this.createExtensionIconItem(ext);
                    contentContainer.appendChild(item);
                } else {
                    const item = await this.createExtensionItem(ext);
                    contentContainer.appendChild(item);
                }
            }
        }
    },
    
    /**
     * 创建扩展列表项
     * @param {Object} ext - 扩展信息
     * @returns {HTMLElement} 列表项元素
     */
    async createExtensionItem(ext) {
        const item = document.createElement('div');
        item.className = 'effects-list-item';
        item.dataset.extensionId = ext.id;
        
        // 获取扩展图标（优先从 crxsoso.com，失败则使用占位图标）
        const iconUrl = await this.getExtensionIcon(ext);
        
        // 状态标识
        const statusBadge = ext.enabled 
            ? '<span class="extension-status enabled" title="已启用">●</span>'
            : '<span class="extension-status disabled" title="已禁用">○</span>';
        
        // 类型标识
        const typeLabel = ext.type === 'hosted_app' ? '应用' : 
                          ext.type === 'legacy_packaged_app' ? '打包应用' :
                          ext.type === 'theme' ? '主题' : '扩展';
        
        // 创建图标容器
        const iconContainer = document.createElement('div');
        iconContainer.className = 'effects-list-item-icon';
        
        // 创建图片元素
        const img = document.createElement('img');
        
        // 直接使用获取到的图标URL，不做任何验证和回退
        if (iconUrl) {
            console.log(`[ExtensionManager] 🖼️ 设置图标URL (列表视图): ${ext.id}`, iconUrl.substring(0, 100));
        img.src = iconUrl;
        } else {
            console.warn(`[ExtensionManager] ⚠️ 图标URL为空: ${ext.id}`);
            // 不设置src，让img保持空白
        }
        
        img.alt = this.escapeHtml(ext.name);
        img.loading = 'lazy';
        img.title = ext.name;
        img.className = 'extension-icon';
        
        // 只添加日志，不做任何回退处理
        img.onerror = () => {
            console.error(`[ExtensionManager] ❌ 图标加载失败: ${ext.id}`, `URL: ${iconUrl?.substring(0, 100)}`, `当前src: ${img.src?.substring(0, 100)}`);
        };
        
        img.onload = () => {
            console.log(`[ExtensionManager] ✅ 图标加载成功: ${ext.id}`, `URL: ${iconUrl?.substring(0, 50)}`);
        };
        
        iconContainer.appendChild(img);
        
        // 创建内容区域
        const contentDiv = document.createElement('div');
        contentDiv.className = 'effects-list-item-content';
        contentDiv.innerHTML = `
            <div class="effects-list-item-title">
                ${statusBadge}
                <span>${this.escapeHtml(ext.name)}</span>
            </div>
            <div class="effects-list-item-description">
                ${this.escapeHtml(ext.version || '未知版本')} • ${typeLabel}
            </div>
        `;
        
        // 创建操作按钮区域
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'effects-list-item-actions';
        actionsDiv.innerHTML = `
            <button class="effects-btn effects-btn-sm" 
                    data-action="toggle-extension" 
                    data-extension-id="${ext.id}"
                    data-enabled="${ext.enabled}"
                    title="${ext.enabled ? '禁用' : '启用'}">
                ${ext.enabled ? '禁用' : '启用'}
            </button>
            <button class="effects-btn effects-btn-sm" 
                    data-action="extension-details" 
                    data-extension-id="${ext.id}"
                    title="查看详情">
                详情
            </button>
            ${!ext.mayDisable ? '' : `
                <button class="effects-btn effects-btn-sm effects-btn-danger" 
                        data-action="uninstall-extension" 
                        data-extension-id="${ext.id}"
                        title="卸载">
                    卸载
                </button>
            `}
        `;
        
        // 组装item
        item.appendChild(iconContainer);
        item.appendChild(contentDiv);
        item.appendChild(actionsDiv);
        
        return item;
    },
    
    /**
     * 创建扩展图标项（用于图标视图）
     * @param {Object} ext - 扩展信息
     * @returns {HTMLElement} 图标项元素
     */
    async createExtensionIconItem(ext) {
        const item = document.createElement('div');
        item.className = 'extension-icon-item';
        item.dataset.extensionId = ext.id;
        
        // 获取扩展图标
        const iconUrl = await this.getExtensionIcon(ext);
        
        // 创建图标容器（更小的尺寸）
        const iconContainer = document.createElement('div');
        iconContainer.className = 'extension-icon-item-icon';
        iconContainer.style.cssText = `
            width: 48px;
            height: 48px;
            border-radius: 8px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.05);
            margin-bottom: 6px;
            position: relative;
        `;
        if (!ext.enabled) {
            iconContainer.classList.add('disabled');
        }
        
        // 创建图片元素（更小的尺寸）
        const img = document.createElement('img');
        img.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: contain;
        `;
        
        // 只设置真实图标URL，如果获取失败则不显示图标
        if (iconUrl) {
            console.log(`[ExtensionManager] 🖼️ 设置图标URL (图标视图): ${ext.id}`, iconUrl.substring(0, 100));
            img.src = iconUrl;
        } else {
            console.warn(`[ExtensionManager] ⚠️ 图标URL为空: ${ext.id}，不显示图标`);
            // 不设置src，让图标保持空白
        }
        
        img.alt = this.escapeHtml(ext.name);
        img.loading = 'lazy';
        img.title = `${ext.name}\n版本: ${ext.version || '未知'}\n${ext.enabled ? '已启用' : '已禁用'}`;
        
        // 图标加载失败时记录错误，但不使用占位图标
        img.onerror = () => {
            console.error(`[ExtensionManager] ❌ 图标加载失败: ${ext.id}`, `URL: ${iconUrl?.substring(0, 100)}`, `当前src: ${img.src?.substring(0, 100)}`);
            // 清空src，不显示图标
            img.src = '';
            img.style.display = 'none';
        };
        
        img.onload = () => {
            console.log(`[ExtensionManager] ✅ 图标加载成功: ${ext.id}`, `URL: ${iconUrl?.substring(0, 50)}`);
        };
        
        iconContainer.appendChild(img);
        
        // 状态指示器
        const statusIndicator = document.createElement('div');
        statusIndicator.className = `extension-icon-status ${ext.enabled ? 'enabled' : 'disabled'}`;
        statusIndicator.title = ext.enabled ? '已启用' : '已禁用';
        iconContainer.appendChild(statusIndicator);
        
        // 创建名称标签
        const nameLabel = document.createElement('div');
        nameLabel.className = 'extension-icon-item-name';
        nameLabel.textContent = ext.name;
        nameLabel.title = ext.name;
        
        // 组装item
        item.appendChild(iconContainer);
        item.appendChild(nameLabel);
        
        // 右键菜单支持
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showIconContextMenu(e, ext, item);
        });
        
        // 点击打开详情
        item.addEventListener('click', (e) => {
            if (e.target.closest('.extension-icon-context-menu')) {
                return; // 如果点击的是右键菜单，不触发
            }
            this.openExtensionDetails(ext.id);
        });
        
        return item;
    },
    
    /**
     * 显示图标视图的右键菜单
     * @param {Event} e - 事件对象
     * @param {Object} ext - 扩展信息
     * @param {HTMLElement} item - 图标项元素
     */
    showIconContextMenu(e, ext, item) {
        // 移除现有的菜单
        const existingMenu = document.querySelector('.extension-icon-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // 计算菜单位置，确保菜单完整显示
        const menuWidth = 150;
        const menuHeight = 300; // 估算菜单高度
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = e.pageX;
        let top = e.pageY;
        
        // 如果右侧空间不足，从左侧显示
        if (left + menuWidth > viewportWidth) {
            left = e.pageX - menuWidth;
            if (left < 0) left = 10; // 至少留10px边距
        }
        
        // 如果下方空间不足，从上方显示
        if (top + menuHeight > viewportHeight) {
            top = e.pageY - menuHeight;
            if (top < 0) top = 10; // 至少留10px边距
        }
        
        // 创建菜单
        const menu = document.createElement('div');
        menu.className = 'extension-icon-context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${left}px;
            top: ${top}px;
            background: rgba(30, 30, 30, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 4px;
            z-index: 10000;
            min-width: 150px;
            max-width: 250px;
            max-height: ${viewportHeight - top - 20}px;
            overflow-y: auto;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        const groups = this.getGroups();
        const currentScenarios = this.getExtensionScenarios(ext.id);
        const isUngrouped = this.isUngrouped(ext.id);
        const activeScenarioId = this.getActiveScenarioId();
        
        const menuItems = [
            {
                text: ext.enabled ? '禁用' : '启用',
                action: () => this.handleToggleExtension(ext.id, null)
            },
            {
                text: '查看详情',
                action: () => this.openExtensionDetails(ext.id)
            },
            {
                type: 'divider'
            },
            {
                text: '分配到情景模式',
                submenu: true,
                items: [
                    ...groups.map(group => {
                        const isInScenario = currentScenarios.some(s => s.id === group.id);
                        const isActive = group.id === activeScenarioId;
                        let text = group.name;
                        if (isInScenario) text += ' ✓';
                        if (isActive) text += ' [已启用]';
                        return {
                            text: text,
                            action: () => {
                                if (isInScenario) {
                                    // 【情景模式】如果已经在当前情景模式，则从该模式移除
                                    this.removeExtensionFromGroup(ext.id, group.id);
                                    // 如果从所有模式中移除，自动添加到未分组
                                    const remainingScenarios = this.getExtensionScenarios(ext.id);
                                    if (remainingScenarios.length === 0) {
                                        this.addToUngrouped(ext.id);
                                    }
                                } else {
                                    // 【情景模式】添加到情景模式（允许属于多个模式）
                                    // 【关键修复】确保添加到情景模式时，不会从未分组中移除
                                    const wasUngrouped = this.isUngrouped(ext.id);
                                    const existingScenarios = this.getExtensionScenarios(ext.id);
                                    
                                    logger.debug(`[ExtensionManager] 右键菜单：添加扩展到情景模式`, {
                                        extensionId: ext.id,
                                        extensionName: ext.name,
                                        targetScenario: group.name,
                                        wasUngrouped,
                                        existingScenarios: existingScenarios.map(s => s.name)
                                    });
                                    
                                    this.addExtensionToGroup(ext.id, group.id);
                                    
                                    // 【验证】确保扩展仍然在未分组中（如果之前就在）
                                    const stillUngrouped = this.isUngrouped(ext.id);
                                    if (wasUngrouped && !stillUngrouped) {
                                        logger.error(`[ExtensionManager] 严重错误：扩展 ${ext.id} 在添加到情景模式后从未分组中丢失，正在恢复`);
                                        this.addToUngrouped(ext.id);
                                    }
                                    
                                    // 【验证】确保扩展可以添加到多个情景模式
                                    const finalScenarios = this.getExtensionScenarios(ext.id);
                                    logger.debug(`[ExtensionManager] 添加后，扩展所属的情景模式:`, finalScenarios.map(s => s.name));
                                }
                                // 重新渲染列表
                                const searchInput = document.getElementById('extension-search-input');
                                const searchQuery = searchInput ? searchInput.value.trim() : '';
                                this.renderExtensionList(searchQuery);
                            }
                        };
                    }),
                    {
                        text: '新建情景模式...',
                        action: () => {
                            const name = prompt('请输入情景模式名称：');
                            if (name && name.trim()) {
                                const newGroup = this.createGroup(name.trim());
                                this.addExtensionToGroup(ext.id, newGroup.id);
                                // 重新渲染列表
                                const searchInput = document.getElementById('extension-search-input');
                                const searchQuery = searchInput ? searchInput.value.trim() : '';
                                this.renderExtensionList(searchQuery);
                            }
                        }
                    }
                ]
            }
        ];
        
        // 【情景模式】显示未分组状态
        if (isUngrouped) {
            menuItems.push({
                text: '从未分组移除',
                action: () => {
                    this.removeFromUngrouped(ext.id);
                    // 重新渲染列表
                    const searchInput = document.getElementById('extension-search-input');
                    const searchQuery = searchInput ? searchInput.value.trim() : '';
                    this.renderExtensionList(searchQuery);
                }
            });
        } else {
            menuItems.push({
                text: '添加到未分组（优先权最大）',
                action: () => {
                    this.addToUngrouped(ext.id);
                    // 重新渲染列表
                    const searchInput = document.getElementById('extension-search-input');
                    const searchQuery = searchInput ? searchInput.value.trim() : '';
                    this.renderExtensionList(searchQuery);
                }
            });
        }
        
        if (currentScenarios.length > 0) {
            menuItems.push({
                text: '从所有情景模式移除',
                action: () => {
                    this.removeExtensionFromGroup(ext.id);
                    // 重新渲染列表
                    const searchInput = document.getElementById('extension-search-input');
                    const searchQuery = searchInput ? searchInput.value.trim() : '';
                    this.renderExtensionList(searchQuery);
                }
            });
        }
        
        if (ext.mayDisable) {
            menuItems.push({
                type: 'divider'
            });
            menuItems.push({
                text: '卸载',
                action: () => this.handleUninstallExtension(ext.id, null),
                danger: true
            });
        }
        
        menuItems.forEach(menuItem => {
            if (menuItem.type === 'divider') {
                const divider = document.createElement('div');
                divider.style.cssText = `
                    height: 1px;
                    background: rgba(255, 255, 255, 0.1);
                    margin: 4px 0;
                `;
                menu.appendChild(divider);
                return;
            }
            
            if (menuItem.submenu) {
                // 子菜单项
                const submenuItem = document.createElement('div');
                submenuItem.style.cssText = `
                    position: relative;
                `;
                
                const button = document.createElement('button');
                button.textContent = menuItem.text + ' ▶';
                button.style.cssText = `
                    width: 100%;
                    padding: 8px 12px;
                    text-align: left;
                    background: transparent;
                    border: none;
                    color: rgba(255, 255, 255, 0.9);
                    cursor: pointer;
                    border-radius: 4px;
                    font-size: 13px;
                    transition: background 0.2s;
                `;
                
                const submenu = document.createElement('div');
                // 计算子菜单位置，确保完整显示
                const submenuWidth = 150;
                const submenuHeight = 200; // 估算子菜单高度
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                // 先添加到DOM以便获取位置
                submenuItem.appendChild(button);
                menu.appendChild(submenuItem);
                
                // 获取菜单位置
                const menuRect = menu.getBoundingClientRect();
                
                let submenuLeft = '100%';
                let submenuRight = 'auto';
                let submenuTop = '0';
                let submenuMarginLeft = '4px';
                let submenuMarginRight = 'auto';
                
                // 如果右侧空间不足，从左侧显示
                if (menuRect.right + submenuWidth + 4 > viewportWidth) {
                    submenuLeft = 'auto';
                    submenuRight = '100%';
                    submenuMarginLeft = 'auto';
                    submenuMarginRight = '4px';
                }
                
                submenu.style.cssText = `
                    position: absolute;
                    left: ${submenuLeft};
                    right: ${submenuRight};
                    top: ${submenuTop};
                    margin-left: ${submenuMarginLeft};
                    margin-right: ${submenuMarginRight};
                    background: rgba(30, 30, 30, 0.95);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 4px;
                    min-width: 150px;
                    max-width: 200px;
                    max-height: ${Math.min(viewportHeight - menuRect.top - 20, 300)}px;
                    overflow-y: auto;
                    display: none;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                `;
                
                menuItem.items.forEach(subItem => {
                    const subButton = document.createElement('button');
                    subButton.textContent = subItem.text;
                    subButton.style.cssText = `
                        width: 100%;
                        padding: 8px 12px;
                        text-align: left;
                        background: transparent;
                        border: none;
                        color: rgba(255, 255, 255, 0.9);
                        cursor: pointer;
                        border-radius: 4px;
                        font-size: 13px;
                        transition: background 0.2s;
                    `;
                    subButton.addEventListener('mouseenter', () => {
                        subButton.style.background = 'rgba(255, 255, 255, 0.1)';
                    });
                    subButton.addEventListener('mouseleave', () => {
                        subButton.style.background = 'transparent';
                    });
                    subButton.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        menu.remove();
                        await subItem.action();
                    });
                    submenu.appendChild(subButton);
                });
                
                button.addEventListener('mouseenter', () => {
                    button.style.background = 'rgba(255, 255, 255, 0.1)';
                    submenu.style.display = 'block';
                });
                button.addEventListener('mouseleave', () => {
                    button.style.background = 'transparent';
                    // 延迟隐藏，允许鼠标移动到子菜单
                    setTimeout(() => {
                        if (!submenu.matches(':hover')) {
                            submenu.style.display = 'none';
                        }
                    }, 100);
                });
                submenu.addEventListener('mouseleave', () => {
                    submenu.style.display = 'none';
                });
                
                // submenuItem和submenu已在上面添加到DOM，这里只需要添加submenu到submenuItem
                submenuItem.appendChild(submenu);
            } else {
                // 普通菜单项
                const button = document.createElement('button');
                button.textContent = menuItem.text;
                button.style.cssText = `
                    width: 100%;
                    padding: 8px 12px;
                    text-align: left;
                    background: transparent;
                    border: none;
                    color: ${menuItem.danger ? 'rgba(255, 100, 100, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
                    cursor: pointer;
                    border-radius: 4px;
                    font-size: 13px;
                    transition: background 0.2s;
                `;
                button.addEventListener('mouseenter', () => {
                    button.style.background = menuItem.danger ? 'rgba(255, 100, 100, 0.2)' : 'rgba(255, 255, 255, 0.1)';
                });
                button.addEventListener('mouseleave', () => {
                    button.style.background = 'transparent';
                });
                button.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    menu.remove();
                    await menuItem.action();
                });
                menu.appendChild(button);
            }
        });
        
        document.body.appendChild(menu);
        
        // 点击其他地方关闭菜单
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    },
    
    /**
     * 检测输入是否为扩展商店链接
     * @param {string} input - 用户输入
     * @returns {Object|null} 如果是链接，返回 {type, url, extensionId}，否则返回null
     */
    detectExtensionStoreLink(input) {
        if (!input || !input.trim()) return null;
        
        const trimmed = input.trim();
        
        // Chrome Web Store 链接格式
        const chromeWebStorePattern = /^https?:\/\/(?:chrome|chromewebstore)\.google\.com\/webstore\/.+?\/([a-z]{32})(?=[\/#?]|$)/i;
        const chromeMatch = trimmed.match(chromeWebStorePattern);
        if (chromeMatch) {
            return {
                type: 'chrome',
                url: trimmed,
                extensionId: chromeMatch[1],
                crxsosoUrl: `https://www.crxsoso.com/?auto=1&link=${encodeURIComponent(trimmed)}`
            };
        }
        
        // Edge Addons 链接格式
        const edgePattern = /^https?:\/\/microsoftedge\.microsoft\.com\/addons\/.+?\/([a-z]{32})(?=[\/#?]|$)/i;
        const edgeMatch = trimmed.match(edgePattern);
        if (edgeMatch) {
            return {
                type: 'edge',
                url: trimmed,
                extensionId: edgeMatch[1],
                crxsosoUrl: `https://www.crxsoso.com/?auto=1&link=${encodeURIComponent(trimmed)}`
            };
        }
        
        // Firefox Addons 链接格式
        const firefoxPattern = /^https?:\/\/addons\.mozilla\.org\/.+?addon\/([^\/<>"'?#]+)/i;
        const firefoxMatch = trimmed.match(firefoxPattern);
        if (firefoxMatch) {
            return {
                type: 'firefox',
                url: trimmed,
                extensionId: firefoxMatch[1],
                crxsosoUrl: `https://www.crxsoso.com/?auto=1&link=${encodeURIComponent(trimmed)}`
            };
        }
        
        // Microsoft Store 链接格式
        const msStorePattern = /^https?:\/\/(?:apps|www)\.microsoft\.com\/(?:store|p)\/.+?\/([a-zA-Z\d]{10,})(?=[\/#?]|$)/i;
        const msStoreMatch = trimmed.match(msStorePattern);
        if (msStoreMatch) {
            return {
                type: 'microsoft',
                url: trimmed,
                extensionId: msStoreMatch[1],
                crxsosoUrl: `https://www.crxsoso.com/?auto=1&link=${encodeURIComponent(trimmed)}`
            };
        }
        
        // Opera Addons 链接格式
        const operaPattern = /^https?:\/\/addons\.opera\.com\/.*?extensions\/(?:details|download)\/([^\/?#]+)/i;
        const operaMatch = trimmed.match(operaPattern);
        if (operaMatch) {
            return {
                type: 'opera',
                url: trimmed,
                extensionId: operaMatch[1],
                crxsosoUrl: `https://www.crxsoso.com/?auto=1&link=${encodeURIComponent(trimmed)}`
            };
        }
        
        // crxsoso.com 链接（直接支持）
        if (trimmed.includes('crxsoso.com')) {
            return {
                type: 'crxsoso',
                url: trimmed,
                extensionId: null,
                crxsosoUrl: trimmed
            };
        }
        
        return null;
    },
    
    /**
     * 绑定搜索框事件
     */
    bindSearchEvents() {
        const searchInput = document.getElementById('extension-search-input');
        if (!searchInput) return;
        
        // 清理旧的事件监听器
        const oldEventId = searchInput._searchEventId;
        if (oldEventId) {
            eventManager.remove(oldEventId);
        }
        
        // 绑定回车键事件（用于处理链接跳转）
        const enterEventId = eventManager.add(searchInput, 'keydown', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (!query) return;
                
                // 检测是否为扩展商店链接
                const linkInfo = this.detectExtensionStoreLink(query);
                if (linkInfo) {
                    e.preventDefault();
                    // 打开 crxsoso.com 链接
                    chrome.tabs.create({ url: linkInfo.crxsosoUrl });
                    // 清空输入框
                    searchInput.value = '';
                    return;
                }
            }
        });
        this.eventIds.push(enterEventId);
        
        // 使用防抖搜索（用于本地搜索）
        const eventId = eventManager.add(searchInput, 'input', (e) => {
            const query = e.target.value.trim();
            
            // 如果输入的是链接，不进行本地搜索（等待回车键）
            if (this.detectExtensionStoreLink(query)) {
                return;
            }
            
            // 清除之前的定时器
            timerManager.clearTimeout('extension-search');
            
            // 防抖：延迟300ms后执行搜索
            timerManager.setTimeout('extension-search', async () => {
                await this.renderExtensionList(query);
            }, 300);
        });
        
        searchInput._searchEventId = eventId;
        this.eventIds.push(eventId);
        
        // 绑定"搜索扩展"按钮事件
        const searchBtn = document.getElementById('extension-search-crxsoso-btn');
        if (searchBtn) {
            const btnEventId = eventManager.add(searchBtn, 'click', () => {
                const query = searchInput.value.trim();
                
                if (!query) {
                    // 如果输入框为空，直接打开 crxsoso.com 首页
                    chrome.tabs.create({ url: 'https://www.crxsoso.com/' });
                    return;
                }
                
                // 检测是否为扩展商店链接
                const linkInfo = this.detectExtensionStoreLink(query);
                if (linkInfo) {
                    // 打开 crxsoso.com 链接
                    chrome.tabs.create({ url: linkInfo.crxsosoUrl });
                } else {
                    // 按名称搜索
                    const searchUrl = `https://www.crxsoso.com/search?keyword=${encodeURIComponent(query)}`;
                    chrome.tabs.create({ url: searchUrl });
                }
                
                // 清空输入框
                searchInput.value = '';
            });
            this.eventIds.push(btnEventId);
        }
    },
    
    /**
     * 绑定扩展列表事件
     */
    bindExtensionListEvents() {
        // 清理旧的事件监听器
        this.eventIds.forEach(id => {
            if (id) eventManager.remove(id);
        });
        this.eventIds = [];
        
        const listContainer = document.getElementById('extension-list');
        if (!listContainer) return;
        
        // 使用事件委托处理所有按钮点击
        const eventId = eventManager.delegate(listContainer, 'click', '[data-action]', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const target = e.target.closest('[data-action]');
            if (!target) return;
            
            const action = target.dataset.action;
            const extensionId = target.dataset.extensionId;
            
            if (!extensionId) return;
            
            try {
                switch (action) {
                    case 'toggle-extension':
                        await this.handleToggleExtension(extensionId, target);
                        break;
                    case 'extension-details':
                        this.openExtensionDetails(extensionId);
                        break;
                    case 'uninstall-extension':
                        await this.handleUninstallExtension(extensionId, target);
                        break;
                }
            } catch (error) {
                logger.error(`[ExtensionManager] 处理操作失败:`, error);
                alert(`操作失败: ${error.message}`);
            }
        });
        
        this.eventIds.push(eventId);
    },
    
    /**
     * 处理启用/禁用扩展
     * @param {string} extensionId - 扩展ID
     * @param {HTMLElement|null} button - 按钮元素（列表视图中使用，图标视图可能为null）
     */
    async handleToggleExtension(extensionId, button) {
        // 获取当前状态（从按钮或扩展对象）
        let currentEnabled = false;
        if (button && button.dataset.enabled) {
            currentEnabled = button.dataset.enabled === 'true';
        } else {
            // 从扩展对象获取状态
            try {
                const extensions = await this.getAllExtensions();
                const ext = extensions.find(e => e.id === extensionId);
                if (ext) {
                    currentEnabled = ext.enabled;
                }
            } catch (error) {
                logger.warn('[ExtensionManager] 无法获取扩展状态:', error);
            }
        }
        
        const newEnabled = !currentEnabled;
        
        // 【情景模式】如果扩展在未分组中，手动操作时确保保持在未分组（优先权最大）
        const isUngrouped = this.isUngrouped(extensionId);
        if (!isUngrouped) {
            // 如果扩展不在未分组中，手动操作时将其添加到未分组（获得优先权）
            this.addToUngrouped(extensionId);
        }
        
        // 更新按钮状态（如果存在）
        if (button) {
        button.disabled = true;
        button.textContent = newEnabled ? '启用中...' : '禁用中...';
        }
        
        try {
            await this.setEnabled(extensionId, newEnabled);
            
            // 更新按钮状态（如果存在）
            if (button) {
            button.dataset.enabled = newEnabled.toString();
            button.textContent = newEnabled ? '禁用' : '启用';
            button.disabled = false;
            }
            
            // 重新渲染整个列表（因为需要重新分组）
            const searchInput = document.getElementById('extension-search-input');
            const searchQuery = searchInput ? searchInput.value.trim() : '';
            await this.renderExtensionList(searchQuery);
        } catch (error) {
            if (button) {
            button.disabled = false;
            button.textContent = currentEnabled ? '禁用' : '启用';
            }
            throw error;
        }
    },
    
    /**
     * 处理卸载扩展
     * @param {string} extensionId - 扩展ID
     * @param {HTMLElement|null} button - 按钮元素（列表视图中使用，图标视图可能为null）
     */
    async handleUninstallExtension(extensionId, button) {
        // 获取扩展名称（从DOM或扩展对象）
        let extensionName = '此扩展';
        if (button) {
        const listItem = button.closest('.effects-list-item');
            extensionName = listItem?.querySelector('.effects-list-item-title span')?.textContent || '此扩展';
        } else {
            // 从扩展对象获取名称
            try {
                const extensions = await this.getAllExtensions();
                const ext = extensions.find(e => e.id === extensionId);
                if (ext) {
                    extensionName = ext.name;
                }
            } catch (error) {
                logger.warn('[ExtensionManager] 无法获取扩展名称:', error);
            }
        }
        
        if (!confirm(`确定要卸载 "${extensionName}" 吗？\n\n此操作无法撤销。`)) {
            return;
        }
        
        // 更新按钮状态（如果存在）
        if (button) {
        button.disabled = true;
        button.textContent = '卸载中...';
        }
        
        try {
            await this.uninstall(extensionId);
            
            // 重新渲染整个列表（因为需要更新分组）
            // 保持搜索关键词
            const searchInput = document.getElementById('extension-search-input');
            const searchQuery = searchInput ? searchInput.value.trim() : '';
            await this.renderExtensionList(searchQuery);
        } catch (error) {
            if (button) {
            button.disabled = false;
            button.textContent = '卸载';
            }
            throw error;
        }
    },
    
    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    /**
     * 生成基于扩展名称的占位图标（SVG data URL）
     * @param {string} name - 扩展名称
     * @param {string} id - 扩展ID
     * @returns {string} data URL
     */
    generatePlaceholderIcon(name, id) {
        // 参考auto-extension-manager项目：生成基于扩展名称的占位图标
        // 获取扩展名称的首字母或首字符（优先中文，否则英文）
        let initial = '';
        if (name) {
            // 如果是中文，取第一个字符
            if (/[\u4e00-\u9fa5]/.test(name)) {
                initial = name.charAt(0);
            } else {
                // 否则取第一个大写英文字母
                const match = name.match(/[a-zA-Z]/);
                initial = match ? match[0].toUpperCase() : '?';
            }
        } else {
            // 如果没有名称，使用ID的前两个字符
            initial = id.substring(0, 2).toUpperCase();
        }
        
        // 生成颜色（基于ID的哈希值，确保每个扩展有唯一颜色）
        // 使用预定义的颜色方案，确保颜色既美观又易区分
        const hash = this.simpleHash(id || name);
        const hue = hash % 360;
        
        // 使用更丰富的颜色方案，参考auto-extension-manager的视觉设计
        const colorSchemes = [
            { bg: `hsl(${hue}, 70%, 50%)`, text: '#ffffff' },      // 深色背景
            { bg: `hsl(${hue}, 65%, 55%)`, text: '#ffffff' },      // 中等深色
            { bg: `hsl(${hue}, 60%, 60%)`, text: '#ffffff' },      // 中等
        ];
        const scheme = colorSchemes[hash % colorSchemes.length];
        
        // 创建SVG图标 - 使用圆形设计，尺寸为48x48以匹配图标容器
        const svg = `
            <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="grad-${hash}" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:${scheme.bg};stop-opacity:1" />
                        <stop offset="100%" style="stop-color:hsl(${(hue + 20) % 360}, 70%, 45%);stop-opacity:1" />
                    </linearGradient>
                </defs>
                <circle cx="24" cy="24" r="22" fill="url(#grad-${hash})" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
                <text x="24" y="30" font-family="Arial, sans-serif" font-size="20" font-weight="bold" 
                      fill="${scheme.text}" text-anchor="middle" dominant-baseline="middle">${this.escapeHtml(initial)}</text>
            </svg>
        `.trim();
        
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    },
    
    /**
     * 简单哈希函数（用于生成颜色）
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash);
    },
    
    /**
     * 清理资源
     */
    cleanup() {
        this.eventIds.forEach(id => {
            if (id) eventManager.remove(id);
        });
        this.eventIds = [];
        
        // 清理图标缓存（可选：保留最近使用的图标，这里简单清理）
        // 可以设置缓存大小限制，这里暂时保留所有缓存
    }
};

