import { logger } from '../logger.js';
import { eventManager } from '../eventManager.js';
import { state } from '../state.js';
import { core } from '../core.js';
import { STATIC_CONFIG } from '../constants.js';
import { utils } from '../utils.js';
// 注意：extension-manager.js 已删除，扩展管理功能已迁移到 popup.js
// add-navigation-modal 中的扩展管理功能已禁用

// =================================================================
// 添加到灵动导航 / 扩展管理 集成对话框模块
// =================================================================
export const addNavigationModal = {
    // 事件监听器ID存储
    eventIds: [],
    
    // 当前模式：'website' 或 'extension'
    currentMode: 'website',
    
    // DOM元素缓存
    dom: null,
    
    /**
     * 初始化对话框
     */
    init() {
        logger.debug('[AddNavigationModal] 初始化对话框');
        
        // 缓存DOM元素
        this.dom = {
            modal: document.getElementById('add-navigation-modal'),
            tabWebsite: document.getElementById('modal-tab-website'),
            tabExtension: document.getElementById('modal-tab-extension'),
            contentWebsite: document.getElementById('modal-content-website'),
            contentExtension: document.getElementById('modal-content-extension'),
            form: document.getElementById('add-nav-form-modal'),
            titleInput: document.getElementById('modal-nav-title'),
            urlInput: document.getElementById('modal-nav-url'),
            groupSelect: document.getElementById('modal-nav-group'),
            newGroupContainer: document.getElementById('modal-new-group-container'),
            newGroupInput: document.getElementById('modal-nav-new-group'),
            statusMessage: document.getElementById('modal-status-message'),
            extensionSearch: document.getElementById('modal-extension-search'),
            extensionList: document.getElementById('modal-extension-list'),
            extensionLoading: document.getElementById('modal-extension-loading'),
            extensionViewList: document.getElementById('modal-extension-view-list'),
            extensionViewIcon: document.getElementById('modal-extension-view-icon'),
            extensionManageGroups: document.getElementById('modal-extension-manage-groups'),
            extensionGroupView: document.getElementById('modal-extension-group-view'),
            // 内部Tab切换
            innerTabExtension: document.getElementById('extension-inner-tab-extension'),
            innerTabBookmarks: document.getElementById('extension-inner-tab-bookmarks'),
            extensionContent: document.getElementById('extension-content-extension'),
            bookmarksContent: document.getElementById('extension-content-bookmarks'),
            bookmarksList: document.getElementById('modal-bookmarks-list'),
            extensionViewControls: document.getElementById('extension-view-controls')
        };
        
        // 当前内部模式：'extension' 或 'bookmarks'
        this.currentInnerMode = 'extension';
        
        if (!this.dom.modal) {
            logger.error('[AddNavigationModal] 对话框元素未找到');
            return;
        }
        
        // 绑定事件
        this.bindEvents();
        
        // 初始化添加网站表单
        this.initWebsiteForm();
    },
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 模式切换标签
        if (this.dom.tabWebsite) {
            this.eventIds.push(
                eventManager.add(this.dom.tabWebsite, 'click', () => {
                    this.switchMode('website');
                })
            );
        }
        
        if (this.dom.tabExtension) {
            this.eventIds.push(
                eventManager.add(this.dom.tabExtension, 'click', () => {
                    this.switchMode('extension');
                })
            );
        }
        
        // 添加网站表单提交
        if (this.dom.form) {
            this.eventIds.push(
                eventManager.add(this.dom.form, 'submit', (e) => {
                    e.preventDefault();
                    this.handleWebsiteFormSubmit();
                })
            );
        }
        
        // 分组选择变化
        if (this.dom.groupSelect) {
            this.eventIds.push(
                eventManager.add(this.dom.groupSelect, 'change', () => {
                    this.handleGroupSelectChange();
                })
            );
        }
        
        // 扩展搜索
        if (this.dom.extensionSearch) {
            this.eventIds.push(
                eventManager.add(this.dom.extensionSearch, 'input', (e) => {
                    const query = e.target.value.trim();
                    this.renderExtensionsInModal(query);
                })
            );
        }
        
        // 扩展视图切换（已禁用，扩展管理功能已迁移到 popup.js）
        // 如需使用扩展管理功能，请使用 popup 窗口中的扩展管理
        if (this.dom.extensionViewList) {
            this.eventIds.push(
                eventManager.add(this.dom.extensionViewList, 'click', () => {
                    logger.warn('[AddNavigationModal] 扩展管理功能已迁移到 popup 窗口');
                    if (this.dom.extensionList) {
                        this.dom.extensionList.innerHTML = `
                            <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.6);">
                                <p>扩展管理功能已迁移到 popup 窗口</p>
                                <p style="font-size: 12px; margin-top: 8px; color: rgba(255,255,255,0.4);">
                                    请使用扩展图标右键菜单中的"扩展管理"功能
                                </p>
                            </div>
                        `;
                    }
                })
            );
        }
        
        if (this.dom.extensionViewIcon) {
            this.eventIds.push(
                eventManager.add(this.dom.extensionViewIcon, 'click', () => {
                    logger.warn('[AddNavigationModal] 扩展管理功能已迁移到 popup 窗口');
                    if (this.dom.extensionList) {
                        this.dom.extensionList.innerHTML = `
                            <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.6);">
                                <p>扩展管理功能已迁移到 popup 窗口</p>
                                <p style="font-size: 12px; margin-top: 8px; color: rgba(255,255,255,0.4);">
                                    请使用扩展图标右键菜单中的"扩展管理"功能
                                </p>
                            </div>
                        `;
                    }
                })
            );
        }
        
        // 扩展分组管理（已禁用）
        if (this.dom.extensionManageGroups) {
            this.eventIds.push(
                eventManager.add(this.dom.extensionManageGroups, 'click', () => {
                    logger.warn('[AddNavigationModal] 扩展管理功能已迁移到 popup 窗口');
                })
            );
        }
        
        if (this.dom.extensionGroupView) {
            this.eventIds.push(
                eventManager.add(this.dom.extensionGroupView, 'click', () => {
                    logger.warn('[AddNavigationModal] 扩展管理功能已迁移到 popup 窗口');
                })
            );
        }
        
        // 内部Tab切换事件
        if (this.dom.innerTabExtension) {
            this.eventIds.push(
                eventManager.add(this.dom.innerTabExtension, 'click', () => {
                    this.switchInnerMode('extension');
                })
            );
        }
        
        if (this.dom.innerTabBookmarks) {
            this.eventIds.push(
                eventManager.add(this.dom.innerTabBookmarks, 'click', () => {
                    this.switchInnerMode('bookmarks');
                })
            );
        }
        
        // 关闭按钮（通过事件委托处理）
        this.eventIds.push(
            eventManager.delegate(this.dom.modal, 'click', '[data-action="close-modal"]', () => {
                this.close();
            })
        );
        
        // 点击遮罩关闭
        this.eventIds.push(
            eventManager.add(this.dom.modal, 'click', (e) => {
                if (e.target === this.dom.modal) {
                    this.close();
                }
            })
        );
    },
    
    /**
     * 切换模式
     */
    switchMode(mode) {
        if (mode === this.currentMode) return;
        
        this.currentMode = mode;
        
        // 更新标签状态
        if (mode === 'website') {
            this.dom.tabWebsite?.classList.add('active');
            this.dom.tabExtension?.classList.remove('active');
            this.dom.contentWebsite?.classList.remove('hidden');
            this.dom.contentExtension?.classList.add('hidden');
        } else {
            this.dom.tabWebsite?.classList.remove('active');
            this.dom.tabExtension?.classList.add('active');
            this.dom.contentWebsite?.classList.add('hidden');
            this.dom.contentExtension?.classList.remove('hidden');
            
            // 确保内部Tab状态正确初始化
            this.switchInnerMode(this.currentInnerMode || 'extension');
        }
    },
    
    /**
     * 切换内部模式（扩展管理 / 收藏网站）
     */
    switchInnerMode(mode) {
        if (mode === this.currentInnerMode) return;
        
        this.currentInnerMode = mode;
        
        // 更新内部Tab状态
        if (mode === 'extension') {
            this.dom.innerTabExtension?.classList.add('active');
            this.dom.innerTabBookmarks?.classList.remove('active');
            this.dom.extensionContent?.classList.remove('hidden');
            this.dom.bookmarksContent?.classList.add('hidden');
            // 显示扩展管理控制栏
            if (this.dom.extensionViewControls) {
                this.dom.extensionViewControls.style.display = 'flex';
            }
            // 加载扩展列表
            this.loadExtensions();
        } else {
            this.dom.innerTabExtension?.classList.remove('active');
            this.dom.innerTabBookmarks?.classList.add('active');
            this.dom.extensionContent?.classList.add('hidden');
            this.dom.bookmarksContent?.classList.remove('hidden');
            // 隐藏扩展管理控制栏
            if (this.dom.extensionViewControls) {
                this.dom.extensionViewControls.style.display = 'none';
            }
            // 渲染收藏网站列表
            this.renderBookmarks();
        }
    },
    
    /**
     * 初始化添加网站表单
     */
    async initWebsiteForm() {
        try {
            // 加载分类列表
            const result = await chrome.storage.local.get(STATIC_CONFIG.CONSTANTS.STORAGE_KEY);
            const userData = result[STATIC_CONFIG.CONSTANTS.STORAGE_KEY] || null;
            
            if (this.dom.groupSelect) {
                this.dom.groupSelect.innerHTML = '<option value="">请选择分类...</option>';
                
                if (userData && userData.navigationGroups && userData.navigationGroups.length > 0) {
                    userData.navigationGroups.forEach(group => {
                        const option = document.createElement('option');
                        option.value = group.id;
                        option.textContent = group.name;
                        this.dom.groupSelect.appendChild(option);
                    });
                }
                
                // 添加"创建新分类"选项
                const newGroupOption = document.createElement('option');
                newGroupOption.value = STATIC_CONFIG.CONSTANTS.NEW_GROUP_VALUE;
                newGroupOption.textContent = '+ 创建新分类...';
                this.dom.groupSelect.appendChild(newGroupOption);
            }
        } catch (error) {
            logger.error('[AddNavigationModal] 初始化表单失败:', error);
        }
    },
    
    /**
     * 处理分组选择变化
     */
    handleGroupSelectChange() {
        const value = this.dom.groupSelect?.value;
        if (value === STATIC_CONFIG.CONSTANTS.NEW_GROUP_VALUE) {
            this.dom.newGroupContainer?.classList.remove('hidden');
            if (this.dom.newGroupInput) {
                this.dom.newGroupInput.required = true;
            }
        } else {
            this.dom.newGroupContainer?.classList.add('hidden');
            if (this.dom.newGroupInput) {
                this.dom.newGroupInput.required = false;
            }
        }
    },
    
    /**
     * 处理表单提交
     */
    async handleWebsiteFormSubmit() {
        const title = this.dom.titleInput?.value.trim();
        const url = this.dom.urlInput?.value.trim();
        let groupId = this.dom.groupSelect?.value;
        const newGroupName = this.dom.newGroupInput?.value.trim();
        
        // 验证
        const validation = utils.validator.validateForm([
            { input: this.dom.titleInput, name: '网站标题', required: true },
            { input: this.dom.urlInput, name: '网站地址', required: true, type: 'url' },
            { input: this.dom.groupSelect, name: '分类', required: true },
            {
                input: this.dom.newGroupInput,
                name: '新分类名称',
                required: false,
                customValidator: (val) => {
                    if (groupId === STATIC_CONFIG.CONSTANTS.NEW_GROUP_VALUE && !val) {
                        return { valid: false, message: '请输入新分类的名称' };
                    }
                    return { valid: true };
                }
            }
        ]);
        
        if (!validation.valid) {
            this.showStatus(validation.errors[0].message, true);
            return;
        }
        
        // 如果是创建新分类
        if (groupId === STATIC_CONFIG.CONSTANTS.NEW_GROUP_VALUE) {
            if (!newGroupName) {
                this.showStatus('请输入新分类名称', true);
                return;
            }
            
            // 创建新分组
            const newGroup = {
                id: `nav_group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: newGroupName,
                items: []
            };
            
            if (!state.userData.navigationGroups) {
                state.userData.navigationGroups = [];
            }
            state.userData.navigationGroups.push(newGroup);
            groupId = newGroup.id;
        }
        
        // 生成图标URL
        let iconUrl = '';
        try {
            const urlObj = new URL(url);
            const sources = window.aiManager?.getIconSources(url) || [];
            if (sources.length > 0) {
                iconUrl = sources[0].url;
            } else {
                iconUrl = `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
            }
        } catch (err) {
            logger.warn('无法生成图标URL:', err);
            iconUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHJ4PSI0IiBmaWxsPSIjNEE1NTY4Ii8+PHBhdGggZD0iTTEyIDdWMTdNNyAxMkgxNyIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=';
        }
        
        // 创建导航项
        const newNavItem = {
            id: `nav_item_${Date.now()}`,
            title: title,
            url: url,
            icon: iconUrl
        };
        
        // 添加到对应的分组
        const group = state.userData.navigationGroups.find(g => g.id === groupId);
        if (group) {
            group.items.push(newNavItem);
            
            // 保存数据
            core.saveUserData((err) => {
                if (err) {
                    this.showStatus('保存失败: ' + err.message, true);
                } else {
                    this.showStatus('添加成功！', false);
                    
                    // 刷新导航网格
                    if (window.navigationModule) {
                        window.navigationModule.render.grid();
                    }
                    
                    // 清空表单
                    this.resetForm();
                    
                    // 2秒后关闭
                    setTimeout(() => {
                        this.close();
                    }, 2000);
                }
            });
        } else {
            this.showStatus('分类不存在', true);
        }
    },
    
    /**
     * 重置表单
     */
    resetForm() {
        if (this.dom.form) {
            this.dom.form.reset();
        }
        if (this.dom.newGroupContainer) {
            this.dom.newGroupContainer.classList.add('hidden');
        }
        if (this.dom.statusMessage) {
            this.dom.statusMessage.textContent = '';
            this.dom.statusMessage.className = 'status-message';
        }
    },
    
    /**
     * 显示状态消息
     */
    showStatus(message, isError = false) {
        if (this.dom.statusMessage) {
            this.dom.statusMessage.textContent = message;
            this.dom.statusMessage.className = `status-message ${isError ? 'error' : 'success'}`;
        }
    },
    
    /**
     * 在对话框中渲染扩展列表
     */
    async renderExtensionsInModal(searchQuery = '') {
        if (!this.dom.extensionList) {
            logger.error('[AddNavigationModal] 扩展列表容器未找到');
            return;
        }
        
        // 扩展管理功能已迁移到 popup.js
        if (this.dom.extensionList) {
            this.dom.extensionList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.6);">
                    <p style="font-size: 14px; margin-bottom: 12px;">扩展管理功能已迁移</p>
                    <p style="font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 16px;">
                        扩展管理功能已迁移到 popup 窗口，提供更完整的扩展管理体验
                    </p>
                    <p style="font-size: 12px; color: rgba(255,255,255,0.4);">
                        请使用扩展图标右键菜单中的"扩展管理"功能
                    </p>
                </div>
            `;
        }
    },
    
    /**
     * 加载扩展列表
     */
    async loadExtensions() {
        // 扩展管理功能已迁移到 popup.js
        if (this.dom.extensionLoading) {
            this.dom.extensionLoading.classList.add('hidden');
        }
        if (this.dom.extensionList) {
            this.dom.extensionList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.6);">
                    <p style="font-size: 14px; margin-bottom: 12px;">扩展管理功能已迁移</p>
                    <p style="font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 16px;">
                        扩展管理功能已迁移到 popup 窗口，提供更完整的扩展管理体验
                    </p>
                    <p style="font-size: 12px; color: rgba(255,255,255,0.4);">
                        请使用扩展图标右键菜单中的"扩展管理"功能
                    </p>
                </div>
            `;
        }
    },
    
    /**
     * 更新扩展视图切换按钮状态（已禁用）
     */
    updateExtensionViewButtons() {
        // 扩展管理功能已迁移到 popup.js
        // 此方法保留以避免调用错误，但不执行任何操作
    },
    
    /**
     * 打开对话框
     * @param {string} mode - 'website' 或 'extension'，默认 'website'
     */
    open(mode = 'website') {
        if (!this.dom.modal) {
            logger.error('[AddNavigationModal] 对话框元素未找到');
            return;
        }
        
        // 切换到指定模式
        this.switchMode(mode);
        
        // 显示对话框
        this.dom.modal.classList.add('visible');
        
        // 如果是网站模式，尝试获取当前标签页信息
        if (mode === 'website') {
            this.loadCurrentTabInfo();
        }
    },
    
    /**
     * 关闭对话框
     */
    close() {
        if (this.dom.modal) {
            this.dom.modal.classList.remove('visible');
        }
        
        // 重置表单
        this.resetForm();
        
        // 重置模式
        this.currentMode = 'website';
    },
    
    /**
     * 加载当前标签页信息
     */
    async loadCurrentTabInfo() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && this.dom.titleInput && this.dom.urlInput) {
                this.dom.titleInput.value = tab.title || '';
                this.dom.urlInput.value = tab.url || '';
            }
        } catch (error) {
            logger.warn('[AddNavigationModal] 无法获取当前标签页信息:', error);
        }
    },
    
    /**
     * 渲染收藏网站列表
     */
    async renderBookmarks() {
        if (!this.dom.bookmarksList) {
            logger.error('[AddNavigationModal] 收藏网站列表容器未找到');
            return;
        }
        
        try {
            // 获取所有导航组
            const groups = state.userData?.navigationGroups || [];
            
            if (groups.length === 0) {
                this.dom.bookmarksList.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.6);">
                        <p>还没有收藏任何网站</p>
                        <p style="font-size: 12px; margin-top: 8px; color: rgba(255,255,255,0.4);">
                            点击"添加网站"标签来添加第一个网站
                        </p>
                    </div>
                `;
                return;
            }
            
            // 收集所有网站项
            const allItems = [];
            groups.forEach(group => {
                if (group.items && Array.isArray(group.items)) {
                    group.items.forEach(item => {
                        allItems.push({
                            ...item,
                            groupName: group.name,
                            groupId: group.id
                        });
                    });
                }
            });
            
            if (allItems.length === 0) {
                this.dom.bookmarksList.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.6);">
                        <p>还没有收藏任何网站</p>
                        <p style="font-size: 12px; margin-top: 8px; color: rgba(255,255,255,0.4);">
                            点击"添加网站"标签来添加第一个网站
                        </p>
                    </div>
                `;
                return;
            }
            
            // 按分组渲染
            let html = '';
            groups.forEach(group => {
                if (!group.items || group.items.length === 0) return;
                
                html += `
                    <div class="bookmarks-group" style="margin-bottom: 24px;">
                        <div class="bookmarks-group-header" style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <h4 style="color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 600; margin: 0;">
                                ${this.escapeHtml(group.name)}
                            </h4>
                            <span style="color: rgba(255,255,255,0.5); font-size: 12px; margin-left: 8px;">
                                (${group.items.length} 个网站)
                            </span>
                        </div>
                        <div class="bookmarks-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px;">
                `;
                
                group.items.forEach(item => {
                    const iconUrl = item.icon || '';
                    html += `
                        <div class="bookmark-item" 
                             style="display: flex; flex-direction: column; align-items: center; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; cursor: pointer; transition: all 0.2s ease;"
                             data-url="${this.escapeHtml(item.url)}"
                             title="${this.escapeHtml(item.title)}">
                            <div class="bookmark-icon" style="width: 48px; height: 48px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); border-radius: 8px;">
                                ${iconUrl ? 
                                    `<img src="${this.escapeHtml(iconUrl)}" alt="${this.escapeHtml(item.title)}" style="width: 32px; height: 32px; object-fit: contain;" onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\\'color: rgba(255,255,255,0.5); font-size: 20px;\\'>🌐</span>';">` :
                                    `<span style="color: rgba(255,255,255,0.5); font-size: 20px;">🌐</span>`
                                }
                            </div>
                            <div class="bookmark-title" style="font-size: 12px; color: rgba(255,255,255,0.8); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">
                                ${this.escapeHtml(item.title)}
                            </div>
                        </div>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
            });
            
            this.dom.bookmarksList.innerHTML = html;
            
            // 绑定点击事件：打开网站
            const bookmarkItems = this.dom.bookmarksList.querySelectorAll('.bookmark-item');
            bookmarkItems.forEach(item => {
                item.addEventListener('click', () => {
                    const url = item.dataset.url;
                    if (url) {
                        chrome.tabs.create({ url: url });
                    }
                });
            });
            
        } catch (error) {
            logger.error('[AddNavigationModal] 渲染收藏网站列表失败:', error);
            if (this.dom.bookmarksList) {
                this.dom.bookmarksList.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #f48fb1;">
                        <p>加载失败: ${error.message}</p>
                    </div>
                `;
            }
        }
    },
    
    /**
     * HTML转义
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    /**
     * 清理事件监听器
     */
    destroy() {
        this.eventIds.forEach(id => eventManager.remove(id));
        this.eventIds = [];
    }
};

