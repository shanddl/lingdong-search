import { state } from '../state.js';
import { utils } from '../utils.js';
import { render } from '../ui/render.js';
import { STATIC_CONFIG } from '../constants.js';
import { dom } from '../dom.js';
import { core } from '../core.js';
// modalManager 已不再需要，导航组管理已迁移到侧边面板
import { sanitizer, domSafe, validator } from '../security.js';
import { logger } from '../logger.js';
import { aiManager } from './ai-manager.js';
import { eventManager } from '../eventManager.js';
import { DOMHelper } from '../utils/domHelper.js';
import { ButtonGroupHelper } from '../utils/buttonGroupHelper.js';
import { iconSourceTester } from '../utils/iconHelper.js';
import { timerManager } from '../utils/timerManager.js';
import { NotificationService } from '../utils/notificationService.js';

// 存储导航模块的事件监听器ID
const navigationEventIds = [];

// 【性能优化】缓存导航组Map，避免重复查找
let navigationGroupsMap = null;

/**
 * 更新导航组Map缓存
 */
const updateNavigationGroupsMap = () => {
    if (state.userData?.navigationGroups) {
        navigationGroupsMap = new Map(
            state.userData.navigationGroups.map(g => [g.id, g])
        );
    } else {
        navigationGroupsMap = null;
    }
};

/**
 * 根据ID获取导航组（使用缓存优化性能）
 */
const getGroupById = (groupId) => {
    if (!navigationGroupsMap) {
        updateNavigationGroupsMap();
    }
    return navigationGroupsMap?.get(groupId) || null;
};

/**
 * 根据ID在组中查找导航项
 */
const getItemById = (groupId, itemId) => {
    const group = getGroupById(groupId);
    if (!group?.items) return null;
    return group.items.find(i => i.id === itemId) || null;
};

// =================================================================
// 导航模块
// =================================================================
export const navigationModule = {
    // 【性能优化】暴露缓存更新方法供外部调用
    updateCache: updateNavigationGroupsMap,
    
    state: {
        draggedItemId: null,
        dragOverGroupId: null,
        contextTarget: null,
        contextTargetGroupId: null,
        draggedGroupId: null,
        dragOverTabId: null,
        // 添加拖放相关的状态变量
        draggedTab: null,
        startingIndex: null,
        // 批量编辑模式相关状态
        isBatchEditMode: false,
        selectedItems: new Set(), // 存储选中项ID的Set
        draggedItemIds: [] // 批量拖拽时存储多个选中项ID
    },
    
    utils: {
        applyAppearanceSettings: (size, gap) => {
            document.documentElement.style.setProperty('--nav-item-size', `${size}px`);
            document.documentElement.style.setProperty('--nav-grid-gap', `${gap}px`);
        },
        closeContextMenu: () => {
            // 【修复】统一关闭逻辑，重置样式确保菜单完全隐藏
            if (dom.navContextMenu) {
                DOMHelper.toggleVisibility(dom.navContextMenu, false, { className: 'visible' });
                dom.navContextMenu.style.opacity = '0';
                dom.navContextMenu.style.visibility = 'hidden';
            }
        },
        closeTabContextMenu: () => {
            // 【修复】统一关闭逻辑，重置样式确保菜单完全隐藏
            if (dom.navTabContextMenu) {
                DOMHelper.toggleVisibility(dom.navTabContextMenu, false, { className: 'visible' });
                dom.navTabContextMenu.style.opacity = '0';
                dom.navTabContextMenu.style.visibility = 'hidden';
            }
        },
        /**
         * 切换批量编辑模式
         */
        toggleBatchEditMode: () => {
            const newMode = !navigationModule.state.isBatchEditMode;
            navigationModule.state.isBatchEditMode = newMode;
            
            // 如果退出批量编辑模式，清空选中项
            if (!newMode) {
                navigationModule.state.selectedItems.clear();
            }
            
            navigationModule.utils.updateBatchEditMode();
        },
        /**
         * 更新批量编辑模式的UI状态
         */
        updateBatchEditMode: () => {
            const { isBatchEditMode, selectedItems } = navigationModule.state;
            
            // 延迟执行，确保DOM已更新（在渲染之后）
            requestAnimationFrame(() => {
                const navItems = dom.navigationGrid?.querySelectorAll('.nav-item') || [];
                
                if (isBatchEditMode) {
                    // 进入批量编辑模式
                    document.body.classList.add('batch-edit-mode');
                    navItems.forEach(item => {
                        item.classList.add('batch-editable');
                        // 确保可以拖拽
                        item.draggable = true;
                        // 恢复选中状态的视觉反馈
                        const itemId = item.dataset.itemId;
                        if (itemId && selectedItems.has(itemId)) {
                            item.classList.add('batch-selected');
                        }
                    });
                } else {
                    // 退出批量编辑模式
                    document.body.classList.remove('batch-edit-mode');
                    selectedItems.clear(); // 清空选中项
                    navItems.forEach(item => {
                        item.classList.remove('batch-editable', 'batch-selected');
                        // 保持拖拽功能（原有逻辑中导航项支持拖拽）
                        item.draggable = true;
                    });
                }
            });
        },
        /**
         * 切换导航项的选中状态
         */
        toggleItemSelection: (itemId) => {
            const { selectedItems } = navigationModule.state;
            if (!itemId) return;
            
            const item = Array.from(dom.navigationGrid?.querySelectorAll('.nav-item') || [])
                .find(navItem => navItem.dataset.itemId === itemId);
            
            if (!item) return;
            
            if (selectedItems.has(itemId)) {
                selectedItems.delete(itemId);
                item.classList.remove('batch-selected');
            } else {
                selectedItems.add(itemId);
                item.classList.add('batch-selected');
            }
        },
        // [NEW] Complete rewrite of the edit modal
        createNavItemEditModal: (item, currentGroupId, onSave) => {
            logger.debug('createNavItemEditModal 开始执行');
            logger.debug('参数 - item:', item);
            logger.debug('参数 - currentGroupId:', currentGroupId);
            
            const modalId = `edit-nav-item-modal-${item.id}`;
            logger.debug('模态框ID:', modalId);
            
            if (document.getElementById(modalId)) {
                logger.warn('模态框已存在，跳过创建');
                return;
            }

            const modalOverlay = document.createElement('div');
            modalOverlay.id = modalId;
            modalOverlay.className = 'modal-overlay visible';
            
            // 安全创建模态框内容
            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content';
            modalContent.style.maxWidth = '420px';
            
            // 【优化】使用工具函数创建模态框头部
            // 先定义关闭函数，然后传入工具函数
            let currentIcon = item.icon;
            // 【修复】确保modalOverlay存在且仍在DOM中才移除
            const closeModal = () => {
                if (modalOverlay && modalOverlay.parentNode) {
                    document.body.removeChild(modalOverlay);
                }
            };
            const { header, closeBtn } = utils.modal.createModalHeader('编辑网站', closeModal);
            
            // 创建表单
            const form = document.createElement('form');
            form.id = `edit-nav-item-form-${item.id}`;
            form.autocomplete = 'off';
            
            // 创建表单主体
            const body = document.createElement('div');
            body.className = 'modal-body';
            
            // 网站名称
            const nameGroup = utils.modal.createFormGroup('网站名称', `edit-nav-title-${item.id}`, 'text', true, item.title);
            body.appendChild(nameGroup.formGroup);
            
            // 网站地址
            const urlGroup = utils.modal.createFormGroup('网站地址', `edit-nav-url-${item.id}`, 'text', true, item.url);
            body.appendChild(urlGroup.formGroup);
            
            // 图标地址
            const iconGroup = utils.modal.createFormGroup('图标地址 (可手动修改)', `edit-nav-icon-${item.id}`, 'text', false, item.icon);
            const testIconBtn = utils.modal.createButton('测试图标源', 'input-action-btn', '', { 
                type: 'button', 
                id: `test-edit-nav-icon-sources-btn-${item.id}` 
            });
            iconGroup.inputWrapper.appendChild(testIconBtn);
            body.appendChild(iconGroup.formGroup);
            
            // 添加图标源列表容器
            const iconSourcesListDiv = utils.dom.createStyledElement('div', 'margin-top: 8px; display: none;', 
                { id: `edit-nav-icon-sources-list-${item.id}` });
            const sourcesTitle = utils.dom.createTextElement('可用的图标源：', STATIC_CONFIG.STYLES.FONT_SIZES.SECONDARY, STATIC_CONFIG.STYLES.COLORS.SECONDARY, STATIC_CONFIG.STYLES.FONT_WEIGHTS.NORMAL);
            sourcesTitle.style.marginBottom = STATIC_CONFIG.STYLES.SPACING.XS;
            const iconSourcesContent = utils.dom.createStyledElement('div', STATIC_CONFIG.STYLES.CONTAINER_STYLES.FLEX_WRAP, 
                { id: `edit-nav-icon-sources-content-${item.id}` });
            iconSourcesListDiv.appendChild(sourcesTitle);
            iconSourcesListDiv.appendChild(iconSourcesContent);
            iconGroup.formGroup.appendChild(iconSourcesListDiv);
            
            // 图标预览
            const previewGroup = document.createElement('div');
            previewGroup.className = 'form-group';
            const previewLabel = document.createElement('label');
            previewLabel.textContent = '图标预览';
            const previewDiv = utils.dom.createPreviewContainer(STATIC_CONFIG.STYLES.SPACING.MD);
            const previewImg = utils.dom.createStyledElement('img', STATIC_CONFIG.STYLES.ICON_STYLES.MEDIUM_ICON, 
                { id: `edit-nav-icon-preview-${item.id}`, src: sanitizer.sanitizeIconUrl(item.icon) });
            const previewText = utils.dom.createTextElement('预览', STATIC_CONFIG.STYLES.FONT_SIZES.SECONDARY, STATIC_CONFIG.STYLES.COLORS.SECONDARY, STATIC_CONFIG.STYLES.FONT_WEIGHTS.NORMAL);
            previewDiv.appendChild(previewImg);
            previewDiv.appendChild(previewText);
            previewGroup.appendChild(previewLabel);
            previewGroup.appendChild(previewDiv);
            
            // 网站分类
            const groupGroup = document.createElement('div');
            groupGroup.className = 'form-group';
            const groupLabel = document.createElement('label');
            groupLabel.setAttribute('for', `edit-nav-group-${item.id}`);
            groupLabel.textContent = '网站分类';
            const groupSelect = document.createElement('select');
            groupSelect.id = `edit-nav-group-${item.id}`;
            
            // 安全创建选项
            state.userData.navigationGroups.forEach(g => {
                const option = document.createElement('option');
                option.value = g.id;
                option.textContent = g.name; // 安全设置文本
                if (g.id === currentGroupId) {
                    option.selected = true;
                }
                groupSelect.appendChild(option);
            });
            
            groupGroup.appendChild(groupLabel);
            groupGroup.appendChild(groupSelect);
            
            body.appendChild(previewGroup);
            body.appendChild(groupGroup);
            
            // 【优化】使用工具函数创建按钮
            const footer = document.createElement('div');
            footer.className = 'modal-footer justify-end';
            const cancelBtn = utils.modal.createButton('取消', 'modal-btn modal-btn-secondary', '', {
                type: 'button',
                id: `cancel-edit-nav-${item.id}`
            });
            const submitBtn = utils.modal.createButton('保存更改', 'modal-btn modal-btn-primary', '', {
                type: 'submit'
            });
            footer.appendChild(cancelBtn);
            footer.appendChild(submitBtn);
            
            // 组装表单
            form.appendChild(body);
            form.appendChild(footer);
            
            // 组装模态框
            modalContent.appendChild(header);
            modalContent.appendChild(form);
            modalOverlay.appendChild(modalContent);
            document.body.appendChild(modalOverlay);
            logger.debug('模态框已添加到DOM');

            // 【修复】closeBtn 已在 createModalHeader 中绑定关闭事件，无需重复绑定
            cancelBtn.addEventListener('click', closeModal);
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) closeModal();
            });

            // 添加图标输入框的实时预览功能（安全版本）
            iconGroup.input.addEventListener('input', () => {
                const iconUrl = iconGroup.input.value.trim();
                currentIcon = iconUrl;
                if (iconUrl) {
                    previewImg.src = sanitizer.sanitizeIconUrl(iconUrl); // 安全设置图标URL
                } else {
                    previewImg.src = 'https://placehold.co/24x24/3c4043/e8eaed?text=?';
                }
            });

            // 添加测试图标源按钮事件（使用iconSourceTester统一处理）
            testIconBtn.addEventListener('click', async () => {
                const urlValue = urlGroup.input.value.trim();
                if (!urlValue) {
                    return;
                }

                await iconSourceTester.test(
                    urlValue,
                    urlGroup.input.id || `edit-nav-url-${item.id}`,
                    `edit-nav-icon-sources-list-${item.id}`,
                    `edit-nav-icon-sources-content-${item.id}`,
                    iconGroup.input.id || `edit-nav-icon-${item.id}`,
                    previewImg.id || `edit-nav-icon-preview-${item.id}`
                );
                
                // 监听图标选择事件（如果iconSourceTester未自动处理）
                const iconSourcesContent = document.getElementById(`edit-nav-icon-sources-content-${item.id}`);
                if (iconSourcesContent) {
                    iconSourcesContent.addEventListener('click', (e) => {
                        const sourceItem = e.target.closest('.icon-source-item');
                        if (sourceItem) {
                            // iconSourceTester已经处理了点击事件，这里只需要更新currentIcon
                            const img = sourceItem.querySelector('img');
                            if (img && img.src) {
                                currentIcon = img.src;
                            }
                        }
                    }, { once: true });
                }
            });

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                
                // 【优化】使用统一验证工具
                const validation = utils.validator.validateForm([
                    { input: nameGroup.input, name: '网站名称', required: true },
                    { input: urlGroup.input, name: '网站地址', required: true, type: 'url' }
                ]);
                
                if (!validation.valid) {
                    return;
                }
                
                const newTitle = nameGroup.input.value.trim();
                const newUrl = urlGroup.input.value.trim();
                const newGroupId = groupSelect.value;
                
                onSave({
                    ...item,
                    title: newTitle,
                    url: newUrl,
                    icon: currentIcon
                }, currentGroupId, newGroupId);
                closeModal();
            });
        }
    },

    render: {
        all: () => {
            navigationModule.render.tabs();
            navigationModule.render.grid();
        },
        tabs: () => {
            if (!dom.navigationTabs) return;
            
            if (!state.userData.navigationGroups || state.userData.navigationGroups.length === 0) {
                dom.navigationTabs.innerHTML = '';
                return;
            }
            
            // 【性能优化】增量更新tabs，避免全量重建
            const existingTabs = new Map();
            const existingTabsOrder = [];
            Array.from(dom.navigationTabs.querySelectorAll('.nav-tab')).forEach(tab => {
                const groupId = tab.dataset.groupId;
                if (groupId) {
                    existingTabs.set(groupId, tab);
                    existingTabsOrder.push(groupId);
                }
            });
            
            // 检查是否需要重建（数量变化或顺序变化）
            const currentGroupIds = state.userData.navigationGroups.map(g => g.id);
            const needsRebuild = currentGroupIds.length !== existingTabsOrder.length ||
                !currentGroupIds.every((id, index) => id === existingTabsOrder[index]);
            
            if (needsRebuild) {
                // 【修复】需要重建：清空并重新创建（数量或顺序变化）
                const fragment = document.createDocumentFragment();
                state.userData.navigationGroups.forEach(group => {
                    const tab = document.createElement('button');
                    tab.className = 'nav-tab';
                    tab.textContent = group.name;
                    tab.dataset.groupId = group.id;
                    tab.draggable = true;
                    if (group.id === state.activeNavigationGroupId) {
                        tab.classList.add('active');
                    }
                    fragment.appendChild(tab);
                });
                dom.navigationTabs.innerHTML = '';
                dom.navigationTabs.appendChild(fragment);
            } else {
                // 【修复】增量更新：只更新变化的tab（数量和顺序都未变化）
                state.userData.navigationGroups.forEach((group, index) => {
                    let tab = existingTabs.get(group.id);
                    if (tab) {
                        // 更新文本（如果变化）
                        if (tab.textContent !== group.name) {
                            tab.textContent = group.name;
                        }
                        // 更新active状态
                        // 使用ButtonGroupHelper统一管理active状态
                        if (group.id === state.activeNavigationGroupId) {
                            tab.classList.add('active');
                        } else {
                            tab.classList.remove('active');
                        }
                    }
                });
                
                // 移除不存在的tabs（理论上不应该发生，但作为安全措施）
                existingTabs.forEach((tab, groupId) => {
                    if (!currentGroupIds.includes(groupId)) {
                        tab.remove();
                    }
                });
            }
        },
        grid: () => {
            if (!dom.navigationGrid) return;
            
            // 【性能优化】标记正在更新，禁用所有动画
            document.body.setAttribute('data-updating', 'true');
            
            // 获取旧项目用于CSS过渡（已简化：不再需要清理滚动监听器，因为使用了原生懒加载）
            const oldNavItems = dom.navigationGrid.querySelectorAll('.nav-item');
            
            logger.debug('=== Rendering Navigation Grid ===');
            logger.debug('Total navigation groups:', state.userData?.navigationGroups?.length || 0);
            logger.debug('Active navigation group ID:', state.activeNavigationGroupId);
            
            // 添加userData完整性检查
            if (!state.userData || !state.userData.navigationGroups) {
                logger.error('userData or navigationGroups is null/undefined');
                dom.navigationGrid.style.display = 'block';
                dom.navigationGrid.innerHTML = '';
                document.body.removeAttribute('data-updating');
                return;
            }
            
            // 验证导航组数据
            if (state.userData.navigationGroups.length === 0) {
                dom.navigationGrid.style.display = 'block';
                dom.navigationGrid.innerHTML = '';
                logger.debug('No navigation groups available');
                document.body.removeAttribute('data-updating');
                return;
            }
            
            // 【性能优化】使用缓存查找活动组
            updateNavigationGroupsMap(); // 确保缓存最新
            let activeGroup = getGroupById(state.activeNavigationGroupId);
            
            // 如果找不到活动组，静默切换到第一个组（这是正常的恢复机制）
            if (!activeGroup) {
                state.activeNavigationGroupId = state.userData.navigationGroups[0].id;
                // Proxy 会自动同步到 userData，无需手动赋值
                activeGroup = state.userData.navigationGroups[0];
                logger.debug('Auto-switched to first group:', activeGroup.name);
                
                // 异步保存更新后的活动组 ID
                import('../core.js').then(({ core }) => {
                    core.saveUserData((error) => {
                        if (error) {
                            logger.error('Failed to save auto-switched group:', error);
                        }
                    });
                });
            }
            
            logger.debug('Active group name:', activeGroup.name);
            logger.debug('Items in active group:', activeGroup.items?.length || 0);
            
            // 确保items数组存在
            if (!activeGroup.items || !Array.isArray(activeGroup.items)) {
                activeGroup.items = [];
                logger.warn('Active group items was null/undefined, initialized to empty array');
            }
            
            if (activeGroup.items.length === 0) {
                dom.navigationGrid.style.display = 'block';
                dom.navigationGrid.innerHTML = '';
                logger.debug('No items to display');
                document.body.removeAttribute('data-updating');
                return;
            }
            
            // 【优化】使用CSS过渡替代直接清空，减少视觉闪烁
            // 批量应用样式（减少重排）
            if (oldNavItems.length > 0) {
                Object.assign(dom.navigationGrid.style, {
                    opacity: '0.3',
                    transition: 'opacity 0.1s ease-out'
                });
            }
            
            // 在下一个动画帧清空并重建，给CSS过渡时间
            requestAnimationFrame(() => {
                dom.navigationGrid.innerHTML = '';
                Object.assign(dom.navigationGrid.style, {
                    display: 'flex',
                    opacity: '0',
                    transition: 'opacity 0.2s ease-in'
                });

                const fragment = document.createDocumentFragment();
                
                activeGroup.items.forEach(item => {
                    // 使用div而不是a标签，完全隐藏URL显示
                    const navItem = document.createElement('div');
                    navItem.className = 'nav-item';
                    navItem.dataset.url = item.url;
                    navItem.draggable = true;
                    navItem.dataset.itemId = item.id;
                    navItem.style.cursor = 'pointer';
                    
                    const iconWrapper = document.createElement('div');
                    iconWrapper.className = 'nav-item-icon-wrapper';
                    
                    // 【优化】使用统一的图标创建工具函数，减少重复代码
                    const icon = utils.dom.createIcon(
                        '32px',
                        item.icon,
                        item.title,
                        { fallbackChar: item.title, sanitize: true }
                    );
                    icon.className = 'nav-item-icon';
                    
                    iconWrapper.appendChild(icon);
                    
                    const title = document.createElement('span');
                    title.className = 'nav-item-title';
                    title.textContent = item.title;
                    
                    navItem.appendChild(iconWrapper);
                    navItem.appendChild(title);
                    
                    // 【性能优化】不再为每个项单独添加点击监听器，使用事件委托在grid容器上统一处理
                    // 点击事件已通过init()中的事件委托统一处理
                    
                    fragment.appendChild(navItem);
                });
                
                dom.navigationGrid.appendChild(fragment);
                
                // 淡入效果
                requestAnimationFrame(() => {
                    dom.navigationGrid.style.opacity = '1';
                    
                    // 批量移除过渡和更新标志（减少重排）（使用timerManager统一管理，避免内存泄漏）
                    timerManager.clearTimeout('navigation-grid-style-reset');
                    timerManager.setTimeout('navigation-grid-style-reset', () => {
                        Object.assign(dom.navigationGrid.style, {
                            opacity: '',
                            transition: ''
                        });
                        document.body.removeAttribute('data-updating');
                        
                        // 如果处于批量编辑模式，在渲染完成后更新批量编辑状态
                        if (navigationModule.state.isBatchEditMode) {
                            navigationModule.utils.updateBatchEditMode();
                        }
                    }, 200);
                });
            });
        },
        contextMenu: (x, y) => {
            if (!dom.navContextMenu) return;
            const menu = dom.navContextMenu;
            
            const { isBatchEditMode, selectedItems } = navigationModule.state;
            const selectedCount = selectedItems.size;
            
            const menuItems = [];
            
            // 批量编辑模式下，如果有选中项，显示批量删除选项
            if (isBatchEditMode && selectedCount > 0) {
                menuItems.push({ 
                    text: `批量删除 (${selectedCount})`, 
                    action: 'delete-nav-item', 
                    elementType: 'button', 
                    color: 'var(--red)' 
                });
            } else if (!isBatchEditMode) {
                // 普通模式下显示编辑和删除
                menuItems.push(
                    { text: '编辑', action: 'edit-nav-item', elementType: 'button' },
                    { type: 'divider' },
                    { text: '删除', action: 'delete-nav-item', elementType: 'button', color: 'var(--red)' }
                );
            }
            
            if (menuItems.length === 0) return;
            
            menu.innerHTML = '';
            menu.appendChild(utils.dom.createContextMenuItems(menuItems));
            utils.dom.applyContextMenuStyle(menu, x, y);
        },
        tabContextMenu: (x, y, tab) => {
            if (!dom.navTabContextMenu) return;
            const menu = dom.navTabContextMenu;
            
            const menuItems = [
                { text: '重命名分类', action: 'rename-nav-group', elementType: 'button' },
                { text: '删除分类', action: 'delete-nav-group', elementType: 'button', color: 'var(--red)' },
                { type: 'divider' },
                { text: '管理所有分类...', action: 'manage-nav-groups', elementType: 'button' }
            ];
            
            menu.innerHTML = '';
            menu.appendChild(utils.dom.createContextMenuItems(menuItems));
            
            const rect = tab.getBoundingClientRect();
            utils.dom.applyContextMenuStyle(menu, x, y, { opensUp: true, centerX: true, rect });
        },
        groupManagementModal: () => {
            if (!dom.navGroupsList) return;
            
            const fragment = document.createDocumentFragment();
            state.userData.navigationGroups.forEach((group, index) => {
                const listItem = document.createElement('div');
                listItem.className = 'list-item';
                listItem.dataset.id = group.id;
                
                const itemInfo = document.createElement('div');
                itemInfo.className = 'list-item-info';
                
                const name = document.createElement('p');
                name.textContent = group.name;
                itemInfo.appendChild(name);
                
                const actions = document.createElement('div');
                actions.className = 'list-item-actions';
                
                const sortButtons = document.createElement('div');
                sortButtons.className = 'sort-buttons';
                
                const upBtn = document.createElement('button');
                upBtn.className = 'sort-btn';
                upBtn.dataset.action = 'move-nav-group';
                upBtn.dataset.direction = 'up';
                upBtn.disabled = index === 0;
                upBtn.textContent = '▲';
                
                const downBtn = document.createElement('button');
                downBtn.className = 'sort-btn';
                downBtn.dataset.action = 'move-nav-group';
                downBtn.dataset.direction = 'down';
                downBtn.disabled = index === state.userData.navigationGroups.length - 1;
                downBtn.textContent = '▼';
                
                sortButtons.appendChild(upBtn);
                sortButtons.appendChild(downBtn);
                
                const editBtn = document.createElement('button');
                editBtn.className = 'footer-btn';
                editBtn.dataset.action = 'edit-nav-group';
                editBtn.textContent = '编辑';
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'footer-btn';
                deleteBtn.dataset.action = 'delete-nav-group';
                deleteBtn.textContent = '删除';
                
                actions.appendChild(sortButtons);
                actions.appendChild(editBtn);
                actions.appendChild(deleteBtn);
                
                listItem.appendChild(itemInfo);
                listItem.appendChild(actions);
                
                fragment.appendChild(listItem);
            });
            
            dom.navGroupsList.innerHTML = '';
            dom.navGroupsList.appendChild(fragment);
            
            // 【性能优化】不再为每个按钮单独添加监听器，使用事件委托在init()中统一处理
            // 事件委托已通过init()中的eventManager.delegate统一管理，避免内存泄漏
        }
    },

    handlers: {
        init: () => {
            // 导航网格事件（使用 eventManager 管理）
            if (dom.navigationGrid) {
                // 【性能优化】使用事件委托处理导航项点击，避免为每个项单独添加监听器
                navigationEventIds.push(
                    eventManager.delegate(dom.navigationGrid, 'click', '.nav-item', (e) => {
                        e.preventDefault();
                        const navItem = e.target.closest('.nav-item');
                        if (!navItem) return;
                        
                        // 批量编辑模式：切换选中状态
                        if (navigationModule.state.isBatchEditMode) {
                            const itemId = navItem.dataset.itemId;
                            if (itemId) {
                                navigationModule.utils.toggleItemSelection(itemId);
                            }
                            return;
                        }
                        
                        // 普通模式：打开链接
                        const url = navItem.dataset.url;
                        if (url) {
                            window.open(url, '_blank');
                        }
                    })
                );
                
                navigationEventIds.push(
                    eventManager.add(dom.navigationGrid, 'contextmenu', navigationModule.handlers.onItemContextMenu)
                );
                navigationEventIds.push(
                    eventManager.add(dom.navigationGrid, 'dragstart', navigationModule.handlers.onDragStart)
                );
                navigationEventIds.push(
                    eventManager.add(dom.navigationGrid, 'dragover', navigationModule.handlers.onDragOver)
                );
                navigationEventIds.push(
                    eventManager.add(dom.navigationGrid, 'drop', navigationModule.handlers.onDrop)
                );
                // 清理拖拽样式
                navigationEventIds.push(
                    eventManager.add(dom.navigationGrid, 'dragend', (e) => {
                        const item = e.target.closest('.nav-item');
                        if (item) {
                            item.classList.remove('dragging');
                            // 恢复pointer-events
                            item.style.pointerEvents = '';
                        }
                        
                        // 清理拖拽标记
                        document.body.removeAttribute('data-dragging');
                        if (dom.navigationGrid) {
                            dom.navigationGrid.removeAttribute('data-dragging');
                        }
                        
                        // 清理所有transform和样式
                        const allItems = dom.navigationGrid.querySelectorAll('.nav-item');
                        allItems.forEach(item => {
                            if (item.style.transform) {
                                item.style.transform = '';
                                item.style.willChange = '';
                            }
                            // 确保pointer-events恢复
                            if (item.style.pointerEvents === 'none') {
                                item.style.pointerEvents = '';
                            }
                        });
                        
                        // 重置状态
                        navigationModule.state.draggedItemIds = [];
                        navigationModule.state.draggedItemId = null;
                        navigationModule.state.draggedItem = null;
                    })
                );
            }
            // 导航标签事件（使用 eventManager 管理）
            if (dom.navigationTabs) {
                // 基本交互事件
                navigationEventIds.push(
                    eventManager.add(dom.navigationTabs, 'click', navigationModule.handlers.onTabClick)
                );
                navigationEventIds.push(
                    eventManager.add(dom.navigationTabs, 'contextmenu', navigationModule.handlers.onTabContextMenu)
                );
                
                // 导航项跨分类拖拽事件（将导航项拖拽到其他分类标签）
                navigationEventIds.push(
                    eventManager.add(dom.navigationTabs, 'dragover', navigationModule.handlers.onDragOverTab)
                );
                navigationEventIds.push(
                    eventManager.add(dom.navigationTabs, 'dragleave', navigationModule.handlers.onTabDragLeave)
                );
                navigationEventIds.push(
                    eventManager.add(dom.navigationTabs, 'drop', navigationModule.handlers.onDropOnTab)
                );
                
                // 导航标签本身拖拽事件（重排序导航标签）
                navigationEventIds.push(
                    eventManager.add(dom.navigationTabs, 'dragstart', navigationModule.handlers.onTabDragStart)
                );
                navigationEventIds.push(
                    eventManager.add(dom.navigationTabs, 'dragend', navigationModule.handlers.onTabDragEnd)
                );
                navigationEventIds.push(
                    eventManager.add(dom.navigationTabs, 'dragover', navigationModule.handlers.onTabDragOver)
                );
                navigationEventIds.push(
                    eventManager.add(dom.navigationTabs, 'drop', navigationModule.handlers.onTabDrop)
                );
            }
            // 上下文菜单事件（使用 eventManager 管理）
            if (dom.navContextMenu) {
                navigationEventIds.push(
                    eventManager.add(dom.navContextMenu, 'click', navigationModule.handlers.onContextMenuItemClick)
                );
            }
            if (dom.navTabContextMenu) {
                navigationEventIds.push(
                    eventManager.add(dom.navTabContextMenu, 'click', navigationModule.handlers.onTabContextMenuItemClick)
                );
            }
            
            // 表单事件（使用 eventManager 管理）
            if (dom.addNavGroupForm) {
                navigationEventIds.push(
                    eventManager.add(dom.addNavGroupForm, 'submit', navigationModule.handlers.onGroupFormSubmit)
                );
                navigationEventIds.push(
                    eventManager.add(dom.cancelNavGroupEditBtn, 'click', navigationModule.handlers.onCancelGroupEdit)
                );
            }
            
            // 【性能优化】使用事件委托处理导航组管理列表中的按钮点击，避免每次渲染时重复添加监听器
            if (dom.navGroupsList) {
                navigationEventIds.push(
                    eventManager.delegate(dom.navGroupsList, 'click', '[data-action="edit-nav-group"]', (e) => {
                        const groupId = e.target.closest('.list-item')?.dataset.id;
                        if (groupId) {
                            navigationModule.handlers.onEditGroupStart(groupId);
                        }
                    })
                );
                navigationEventIds.push(
                    eventManager.delegate(dom.navGroupsList, 'click', '[data-action="delete-nav-group"]', (e) => {
                        const groupId = e.target.closest('.list-item')?.dataset.id;
                        if (groupId) {
                            navigationModule.handlers.onDeleteGroup(groupId);
                        }
                    })
                );
                navigationEventIds.push(
                    eventManager.delegate(dom.navGroupsList, 'click', '[data-action="move-nav-group"]', (e) => {
                        const groupId = e.target.closest('.list-item')?.dataset.id;
                        const direction = e.target.dataset.direction;
                        if (groupId && direction) {
                            navigationModule.handlers.onMoveGroup(groupId, direction);
                        }
                    })
                );
            }
        },
        
        onTabClick: (e) => {
            const tab = e.target.closest('.nav-tab');
            if (tab && tab.dataset.groupId) {
                // 【性能优化】立即更新UI，不等待保存完成
                const targetGroupId = tab.dataset.groupId;
                state.activeNavigationGroupId = targetGroupId;
                
                // 【性能优化】立即更新tabs的active状态（避免闪烁）
                // 使用事件目标而非查询所有tabs，减少DOM操作
                if (dom.navigationTabs) {
                    const allTabs = dom.navigationTabs.querySelectorAll('.nav-tab');
                    // 使用ButtonGroupHelper统一管理tab状态
                    const activeTab = Array.from(allTabs).find(t => t.dataset.groupId === targetGroupId);
                    if (activeTab) {
                        ButtonGroupHelper.updateActiveState(allTabs, null, activeTab, ['active'], (btn) => btn.dataset.groupId);
                    }
                }
                
                // 切换分类时，如果处于批量编辑模式，清空选中项（因为选中项属于不同的分类）
                if (navigationModule.state.isBatchEditMode) {
                    navigationModule.state.selectedItems.clear();
                }
                
                // 立即渲染grid（异步执行以避免阻塞）
                requestAnimationFrame(() => {
                    navigationModule.render.grid();
                    // 如果处于批量编辑模式，重新应用批量编辑样式
                    if (navigationModule.state.isBatchEditMode) {
                        navigationModule.utils.updateBatchEditMode();
                    }
                });
                
                // 异步保存，不阻塞UI更新
                core.saveUserData((error) => {
                    if (error) {
                        logger.warn('保存导航组切换失败:', error);
                        // 保存失败不影响UI，静默处理或显示轻量提示
                    }
                });
            }
        },
        onItemContextMenu: (e) => {
            const item = e.target.closest('.nav-item');
            if (item) {
                e.preventDefault();
                e.stopPropagation();
                utils.closeAllDropdowns();
                navigationModule.state.contextTarget = item;
                navigationModule.render.contextMenu(e.clientX, e.clientY);
            }
        },
        onTabContextMenu: (e) => {
            const tab = e.target.closest('.nav-tab');
            if(tab) {
                e.preventDefault();
                e.stopPropagation();
                utils.closeAllDropdowns();
                navigationModule.state.contextTargetGroupId = tab.dataset.groupId;
                navigationModule.render.tabContextMenu(e.clientX, e.clientY, tab);
            }
        },
        onContextMenuItemClick: (e) => {
            e.preventDefault();
            const target = e.target.closest('[data-action]');
            if (!target) return;
            
            const action = target.dataset.action;
            const itemElem = navigationModule.state.contextTarget;
            if (!itemElem || !action) return;
            
            const itemId = itemElem.dataset.itemId;
            if (action === 'delete-nav-item') {
                navigationModule.handlers.onItemDelete(itemId);
            } else if (action === 'edit-nav-item') {
                navigationModule.handlers.onItemEdit(itemId);
            }
            navigationModule.utils.closeContextMenu();
        },
        onTabContextMenuItemClick: (e) => {
            e.preventDefault();
            const target = e.target.closest('[data-action]');
            if (!target) return;
            
            const action = target.dataset.action;
            const groupId = navigationModule.state.contextTargetGroupId;
            if (!groupId || !action) return;

            switch(action) {
                case 'rename-nav-group':
                    navigationModule.handlers.onRenameGroup(groupId);
                    break;
                case 'delete-nav-group':
                    navigationModule.handlers.onDeleteGroup(groupId);
                    break;
                case 'manage-nav-groups':
                    navigationModule.handlers.onManageGroups();
                    break;
            }
            navigationModule.utils.closeTabContextMenu();
        },
        onItemDelete: (itemId) => {
            const { isBatchEditMode, selectedItems } = navigationModule.state;
            
            // 批量编辑模式：批量删除选中的项
            if (isBatchEditMode && selectedItems.size > 0) {
                const itemsToDelete = Array.from(selectedItems);
                const count = itemsToDelete.length;
                
                // 使用安全的确认对话框
                domSafe.showConfirm(
                    `您确定要删除 ${count} 个导航项吗？\n此操作无法撤销。`,
                    () => {
                        const group = getGroupById(state.activeNavigationGroupId);
                        if (group) {
                            group.items = group.items.filter(i => !itemsToDelete.includes(i.id));
                            updateNavigationGroupsMap(); // 更新缓存
                            core.saveUserData((error) => {
                                if (error) {
                                } else {
                                    navigationModule.render.grid();
                                    
                                    // 完成操作后自动退出批量编辑模式
                                    navigationModule.utils.toggleBatchEditMode();
                                }
                            });
                        }
                    }
                );
                return;
            }
            
            // 普通模式：删除单个项
            domSafe.showConfirm(
                '您确定要删除这个导航项吗？\n此操作无法撤销。',
                () => {
                    const group = getGroupById(state.activeNavigationGroupId);
                    if (group) {
                        group.items = group.items.filter(i => i.id !== itemId);
                        updateNavigationGroupsMap(); // 更新缓存
                        core.saveUserData((error) => {
                            if (error) {
                                NotificationService.showToast('删除失败: ' + error.message, 'error');
                            } else {
                                NotificationService.showToast('删除成功', 'success');
                                navigationModule.render.grid();
                            }
                        });
                    }
                }
            );
        },
        onItemEdit: (itemId) => {
            logger.debug('onItemEdit 被调用, itemId:', itemId);
            const currentGroupId = state.activeNavigationGroupId;
            logger.debug('当前分组ID:', currentGroupId);
            const group = getGroupById(currentGroupId);
            logger.debug('找到的分组:', group);
            const item = getItemById(currentGroupId, itemId);
            logger.debug('找到的导航项:', item);
            if (!item) {
                logger.warn('未找到导航项, itemId:', itemId);
                return;
            }

            logger.debug('准备创建编辑模态框');
            navigationModule.utils.createNavItemEditModal(item, currentGroupId, (updatedItem, oldGroupId, newGroupId) => {
                if (oldGroupId === newGroupId) {
                    const groupToUpdate = getGroupById(oldGroupId);
                    if (groupToUpdate) {
                        const itemIndex = groupToUpdate.items.findIndex(i => i.id === updatedItem.id);
                        if (itemIndex > -1) {
                            groupToUpdate.items[itemIndex] = updatedItem;
                        }
                    }
                } else {
                    const oldGroup = getGroupById(oldGroupId);
                    const newGroup = getGroupById(newGroupId);
                    if (oldGroup && newGroup) {
                        oldGroup.items = oldGroup.items.filter(i => i.id !== updatedItem.id);
                        newGroup.items.push(updatedItem);
                    }
                }
                
                updateNavigationGroupsMap(); // 更新缓存
                core.saveUserData((error) => {
                    if (error) {
                            NotificationService.showToast('保存失败: ' + error.message, 'error');
                        
                    } else {
                            NotificationService.showToast('保存成功', 'success');
                        navigationModule.render.all();
                    }
                });
            });
        },
        onDragStart: (e) => {
            const item = e.target.closest('.nav-item');
            if (item) {
                const { isBatchEditMode, selectedItems } = navigationModule.state;
                const itemId = item.dataset.itemId;
                
                // 批量编辑模式：如果当前项未选中，则将其加入选中列表并拖拽所有选中项；如果已选中，拖拽所有选中项
                if (isBatchEditMode) {
                    // 如果拖拽的项未在选中列表中，将其加入选中列表（不清空其他选中项）
                    if (!selectedItems.has(itemId)) {
                        selectedItems.add(itemId);
                        navigationModule.utils.toggleItemSelection(itemId);
                    }
                    // 批量拖拽：存储所有选中项的ID（至少包含当前项）
                    navigationModule.state.draggedItemIds = Array.from(selectedItems);
                    // 确保当前项在列表中（防止selectedItems为空的情况）
                    if (navigationModule.state.draggedItemIds.length === 0) {
                        navigationModule.state.draggedItemIds = [itemId];
                    }
                } else {
                    // 单项目拖拽
                    navigationModule.state.draggedItemIds = [itemId];
                }
                
                navigationModule.state.draggedItemId = itemId; // 保持向后兼容
                navigationModule.state.draggedItem = item;
                e.dataTransfer.effectAllowed = 'move';
                
                // Infinity风格：创建美观的拖拽图像
                const rect = item.getBoundingClientRect();
                const itemWidth = item.offsetWidth || rect.width || 80;
                const itemHeight = item.offsetHeight || rect.height || 80;
                
                const dragImage = item.cloneNode(true);
                dragImage.style.position = 'absolute';
                dragImage.style.top = '-9999px';
                dragImage.style.left = '-9999px';
                dragImage.style.width = itemWidth + 'px';
                dragImage.style.height = itemHeight + 'px';
                dragImage.style.opacity = '0.9';
                dragImage.style.transform = 'scale(1.05) rotate(2deg)';
                dragImage.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.4)';
                dragImage.style.pointerEvents = 'none';
                dragImage.style.zIndex = '9999';
                document.body.appendChild(dragImage);
                
                // 强制重排，确保dragImage已渲染
                void dragImage.offsetHeight;
                
                // 计算偏移量，让鼠标在图标中心
                const offsetX = itemWidth / 2;
                const offsetY = itemHeight / 2;
                
                // 设置拖拽图像（必须在dragstart中同步调用）
                try {
                    e.dataTransfer.setDragImage(dragImage, offsetX, offsetY);
                } catch (err) {
                    logger.warn('设置拖拽预览图像失败:', err);
                }
                
                // 标记整个页面正在拖拽
                document.body.setAttribute('data-dragging', 'true');
                if (dom.navigationGrid) {
                    dom.navigationGrid.setAttribute('data-dragging', 'true');
                }
                
                // 延迟添加 dragging 样式，避免影响拖拽事件
                // 使用setTimeout确保拖拽事件已经正常触发（使用timerManager统一管理，避免内存泄漏）
                const dragItemId = item.dataset.itemId || 'default';
                timerManager.clearTimeout(`navigation-drag-start-${dragItemId}`);
                timerManager.setTimeout(`navigation-drag-start-${dragItemId}`, () => {
                    item.classList.add('dragging');
                    // 此时添加pointer-events: none不会影响已经开始的拖拽
                    item.style.pointerEvents = 'none';
                }, 0);
                
                // 延迟移除临时拖拽图像元素
                requestAnimationFrame(() => {
                    if (dragImage.parentNode) {
                        try {
                            document.body.removeChild(dragImage);
                        } catch (err) {
                            // 忽略移除错误
                        }
                    }
                });
            }
        },
        onDragOver: (() => {
            // Infinity风格：实时移动DOM，让CSS Grid自动布局
            let rafId = null;
            let lastTargetKey = null;
            
            const processDragOver = (e) => {
                if (!navigationModule.state.draggedItemId || !navigationModule.state.draggedItem) {
                    e.preventDefault();
                    return;
                }
                
                e.preventDefault();
                
                const draggedItem = navigationModule.state.draggedItem;
                draggedItem.style.pointerEvents = 'none';
                
                // 获取鼠标下的元素
                const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
                const targetItem = elementUnderMouse?.closest('.nav-item');
                
                if (!targetItem || targetItem === draggedItem) {
                    lastTargetKey = null;
                    draggedItem.style.pointerEvents = '';
                    return;
                }
                
                const targetItemId = targetItem.dataset.itemId;
                const targetRect = targetItem.getBoundingClientRect();
                const midpoint = targetRect.top + targetRect.height / 2;
                const insertBefore = e.clientY < midpoint;
                const targetKey = `${targetItemId}_${insertBefore}`;
                
                // 只有目标改变时才移动DOM，避免重复操作
                if (targetKey !== lastTargetKey) {
                    lastTargetKey = targetKey;
                    
                    // Infinity风格：直接移动DOM，让CSS Grid自动布局
                    // Grid会自动让其他图标移动，不需要手动计算
                    if (insertBefore) {
                        // 插入到目标元素之前
                        if (draggedItem.parentNode === targetItem.parentNode) {
                            targetItem.parentNode.insertBefore(draggedItem, targetItem);
                        }
                    } else {
                        // 插入到目标元素之后
                        const nextSibling = targetItem.nextSibling;
                        if (nextSibling && nextSibling !== draggedItem) {
                            if (draggedItem.parentNode === targetItem.parentNode) {
                                targetItem.parentNode.insertBefore(draggedItem, nextSibling);
                            }
                        } else {
                            if (draggedItem.parentNode === targetItem.parentNode) {
                                targetItem.parentNode.appendChild(draggedItem);
                            }
                        }
                    }
                }
                
                // 恢复pointerEvents
                draggedItem.style.pointerEvents = '';
            };
            
            return (e) => {
                if (rafId) {
                    cancelAnimationFrame(rafId);
                }
                rafId = requestAnimationFrame(() => {
                    processDragOver(e);
                    rafId = null;
                });
            };
        })(),
        onDrop: (e) => {
            e.preventDefault();
            
            // 清理所有视觉指示器
            const allItems = dom.navigationGrid.querySelectorAll('.nav-item');
            allItems.forEach(item => {
                item.classList.remove('drag-over-top', 'drag-over-bottom');
            });
            
            const draggedId = navigationModule.state.draggedItemId;
            const draggedItem = navigationModule.state.draggedItem;
            
            if (!draggedId || !draggedItem) {
                // 清理状态
                document.body.removeAttribute('data-dragging');
                if (dom.navigationGrid) {
                    dom.navigationGrid.removeAttribute('data-dragging');
                }
                return;
            }

            const group = getGroupById(state.activeNavigationGroupId);
            if (!group) {
                // 清理状态
                document.body.removeAttribute('data-dragging');
                if (dom.navigationGrid) {
                    dom.navigationGrid.removeAttribute('data-dragging');
                }
                navigationModule.state.draggedItemId = null;
                navigationModule.state.draggedItem = null;
                return;
            }
            
            // Infinity风格：拖拽过程中DOM已经实时移动到目标位置
            // 释放时只需要清理状态，图标已经在正确位置
            
            // 移除拖拽样式，恢复可见性和pointer-events
            draggedItem.classList.remove('dragging');
            draggedItem.style.pointerEvents = '';
            
            // 移除拖拽标记，恢复动画
            document.body.removeAttribute('data-dragging');
            if (dom.navigationGrid) {
                dom.navigationGrid.removeAttribute('data-dragging');
            }
            
            // Infinity风格：等待CSS transition完成，然后更新数据
            // 由于拖拽过程中DOM已经实时移动，释放后图标已经在目标位置（使用timerManager统一管理，避免内存泄漏）
            timerManager.clearTimeout('navigation-drag-end-update');
            timerManager.setTimeout('navigation-drag-end-update', () => {
                const currentItems = Array.from(dom.navigationGrid.querySelectorAll('.nav-item'));
                const currentItemIds = currentItems.map(item => item.dataset.itemId);
                
                const originalItems = [...group.items];
                const reorderedItems = currentItemIds
                    .map(id => originalItems.find(item => item.id === id))
                    .filter(item => item !== undefined);
                
                if (reorderedItems.length === originalItems.length) {
                    group.items = reorderedItems;
                    updateNavigationGroupsMap();
                    core.saveUserData(() => {
                        // Infinity风格：平滑更新
                        navigationModule.render.grid();
                    });
                } else {
                    // 如果顺序有问题，重新渲染
                    navigationModule.render.grid();
                }
                
                navigationModule.state.draggedItemIds = [];
                navigationModule.state.draggedItemId = null;
                navigationModule.state.draggedItem = null;
            }, 300);
        },
        onDragOverTab: (e) => {
            // 【修复】只处理导航项拖拽到标签的情况，忽略标签自身拖拽
            const { draggedItemId, draggedItemIds } = navigationModule.state;
            if (draggedItemId || (draggedItemIds && draggedItemIds.length > 0)) {
                e.preventDefault();
                const tab = e.target.closest('.nav-tab');
                if (tab && !tab.classList.contains('active')) {
                    tab.classList.add('drag-over');
                    navigationModule.state.dragOverGroupId = tab.dataset.groupId;
                }
            }
        },
        onTabDragLeave: (e) => {
            // 【修复】添加缺失的onTabDragLeave处理函数
            const tab = e.target.closest('.nav-tab');
            if (tab) {
                tab.classList.remove('drag-over');
            }
        },
        onDropOnTab: (e) => {
            e.preventDefault();
            const tab = e.target.closest('.nav-tab');
            if (!tab) return;
            tab.classList.remove('drag-over');
            
            const { draggedItemIds, draggedItemId, isBatchEditMode } = navigationModule.state;
            const targetGroupId = navigationModule.state.dragOverGroupId;

            // 使用批量拖拽的ID列表，如果没有则使用单个ID
            const itemIdsToMove = draggedItemIds && draggedItemIds.length > 0 
                ? draggedItemIds 
                : (draggedItemId ? [draggedItemId] : []);

            if (itemIdsToMove.length === 0 || !targetGroupId || targetGroupId === state.activeNavigationGroupId) {
                // 清理状态
                navigationModule.state.draggedItemIds = [];
                navigationModule.state.draggedItemId = null;
                navigationModule.state.dragOverGroupId = null;
                return;
            }

            const sourceGroup = getGroupById(state.activeNavigationGroupId);
            const targetGroup = getGroupById(targetGroupId);
            if (!sourceGroup || !targetGroup) {
                // 清理状态
                navigationModule.state.draggedItemIds = [];
                navigationModule.state.draggedItemId = null;
                navigationModule.state.dragOverGroupId = null;
                return;
            }

            // 批量移动项目
            const movedItems = [];
            itemIdsToMove.forEach(itemId => {
                const itemIndex = sourceGroup.items.findIndex(i => i.id === itemId);
                if (itemIndex > -1) {
                    const [movedItem] = sourceGroup.items.splice(itemIndex, 1);
                    targetGroup.items.push(movedItem);
                    movedItems.push(movedItem);
                }
            });

            if (movedItems.length === 0) {
                // 清理状态
                navigationModule.state.draggedItemIds = [];
                navigationModule.state.draggedItemId = null;
                navigationModule.state.dragOverGroupId = null;
                return;
            }

            updateNavigationGroupsMap(); // 更新缓存
            core.saveUserData(() => {
                const count = movedItems.length;
                navigationModule.render.grid();
                
                // 批量编辑模式下，完成操作后自动退出
                if (isBatchEditMode) {
                    navigationModule.utils.toggleBatchEditMode();
                }
            });
            
            // 清理状态
            navigationModule.state.draggedItemIds = [];
            navigationModule.state.draggedItemId = null;
            navigationModule.state.dragOverGroupId = null;
        },
        onManageGroups: () => {
            // 渲染数据（在侧边面板展开时会自动调用）
            navigationModule.render.groupManagementModal();
            navigationModule.handlers.onCancelGroupEdit(); // Reset form
            // 注意：不再使用modalManager，由handlers.js中的'manage-nav-groups'处理面板打开
        },
        onRenameGroup: (groupId) => {
            const group = getGroupById(groupId);
            if (!group) return;
            const newName = prompt('请输入新的分类名称:', group.name);
            if (newName && newName.trim() !== '') {
                group.name = newName.trim();
                updateNavigationGroupsMap(); // 更新缓存
                core.saveUserData(() => {
                        NotificationService.showToast('重命名成功', 'success');
                    navigationModule.render.tabs();
                });
            }
        },
        onDeleteGroup: (groupId) => {
            if (state.userData.navigationGroups.length <= 1) {
                // 使用安全的错误提示对话框
                domSafe.showAlert('请至少保留一个分类。', 'error');
                return;
            }
            const group = getGroupById(groupId);
            if (group) {
                // 使用安全的确认对话框（转义用户输入）
                domSafe.showConfirm(
                    `您确定要删除分类\n"${sanitizer.escapeHtml(group.name)}"\n吗？\n此操作无法撤销。`,
                    () => {
                    state.userData.navigationGroups = state.userData.navigationGroups.filter(g => g.id !== groupId);
                    updateNavigationGroupsMap(); // 更新缓存
                    if (state.activeNavigationGroupId === groupId) {
                        state.activeNavigationGroupId = state.userData.navigationGroups[0]?.id || null;
                    }
                    core.saveUserData(() => {
                                NotificationService.showToast('删除成功', 'success');
                        navigationModule.render.all();
                        // 检查侧边面板的导航组管理手风琴是否展开
                        const navGroupAccordion = document.querySelector('[data-accordion="nav-group-management"]');
                        if (navGroupAccordion && navGroupAccordion.classList.contains('expanded')) {
                           navigationModule.render.groupManagementModal();
                        }
                    });
                    }
                );
            }
        },
        onEditGroupStart: (groupId) => {
            const group = getGroupById(groupId);
            if(!group) return;
            dom.navGroupFormTitle.textContent = '编辑分类';
            dom.navGroupEditId.value = groupId;
            dom.navGroupNameInput.value = group.name;
            dom.cancelNavGroupEditBtn.classList.remove('hidden');
            dom.navGroupNameInput.focus();
        },
        onCancelGroupEdit: () => {
            dom.navGroupFormTitle.textContent = '添加新分类';
            dom.addNavGroupForm.reset();
            dom.navGroupEditId.value = '';
            dom.cancelNavGroupEditBtn.classList.add('hidden');
        },
        onGroupFormSubmit: (e) => {
            e.preventDefault();
            const name = dom.navGroupNameInput.value.trim();
            if (!name) return;
            const id = dom.navGroupEditId.value;

            if (id) { // Editing existing group
                const group = getGroupById(id);
                if (group) group.name = name;
            } else { // Adding new group
                const newGroup = { id: `group_${Date.now()}`, name: name, items: [] };
                state.userData.navigationGroups.push(newGroup);
            }
            
            updateNavigationGroupsMap(); // 更新缓存
            core.saveUserData((error) => {
                if (error) {
                            NotificationService.showToast('保存失败: ' + error.message, 'error');
                    
                } else {
                        NotificationService.showToast('分类已保存', 'success');
                    navigationModule.render.all();
                    navigationModule.render.groupManagementModal();
                    navigationModule.handlers.onCancelGroupEdit();
                }
            });
        },
        onMoveGroup: (groupId, direction) => {
            const groups = state.userData.navigationGroups;
            const index = groups.findIndex(g => g.id === groupId);
            if (index === -1) return;

            const newIndex = direction === 'up' ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= groups.length) return;

            [groups[index], groups[newIndex]] = [groups[newIndex], groups[index]];

            // 【修复】更新缓存
            updateNavigationGroupsMap();
            
            core.saveUserData(() => {
                navigationModule.render.tabs();
                navigationModule.render.groupManagementModal();
            });
        },
        
        // 新增导航标签拖放相关处理函数
        onTabDragStart: (e) => {
            const tab = e.target.closest('.nav-tab');
            if (tab) {
                // 存储被拖拽的标签元素
                navigationModule.state.draggedTab = tab;
                
                // 计算并存储初始位置
                const tabs = Array.from(dom.navigationTabs.querySelectorAll('.nav-tab'));
                navigationModule.state.startingIndex = tabs.indexOf(tab);
                
                // 设置拖拽效果
                e.dataTransfer.effectAllowed = 'move';
                
                // 立即添加拖拽样式以提供即时视觉反馈
                tab.classList.add('dragging');
                
                // 为容器添加拖拽操作样式
                if (dom.navigationTabsContainer) {
                    dom.navigationTabsContainer.classList.add('drag-operation');
                }
            }
        },
        
        onTabDragEnd: (e) => {
            const tab = e.target.closest('.nav-tab');
            if (tab) {
                // 执行清理：移除拖拽样式
                tab.classList.remove('dragging');
            }
            
            // 重置变量
            navigationModule.state.draggedTab = null;
            navigationModule.state.startingIndex = null;
            
            // 移除容器的拖拽操作样式
            if (dom.navigationTabsContainer) {
                dom.navigationTabsContainer.classList.remove('drag-operation');
            }
        },
        
        onTabDragOver: (() => {
            // 【修复】延迟创建throttle函数，避免模块初始化时访问未初始化的utils
            let throttledHandler = null;
            
            const createThrottledHandler = () => {
                if (!throttledHandler) {
                    throttledHandler = utils.throttle((e, tab) => {
                        if (!tab || !navigationModule.state.draggedTab) return;
                        
                        // 阻止在自身上放置
                        if (tab === navigationModule.state.draggedTab) return;
                        
                        // 获取目标元素的边界矩形
                        const rect = tab.getBoundingClientRect();
                        
                        // 确定光标在目标元素的左侧还是右侧
                        const midpoint = rect.left + rect.width / 2;
                        
                        // 根据光标位置决定插入位置
                        if (e.clientX < midpoint) {
                            // 光标在左侧，将拖拽元素插入到目标元素之前
                            tab.parentNode.insertBefore(navigationModule.state.draggedTab, tab);
                        } else {
                            // 光标在右侧，将拖拽元素插入到目标元素之后
                            tab.parentNode.insertBefore(navigationModule.state.draggedTab, tab.nextSibling);
                        }
                    }, 50); // 每50ms最多执行一次
                }
                return throttledHandler;
            };
            
            return (e) => {
                // 【修复】只处理导航标签本身的拖拽，忽略导航项的拖拽
                // 如果正在拖拽导航项，让onDragOverTab处理
                if (navigationModule.state.draggedItemId) return;
                
                // 如果不在拖拽标签，也不处理
                if (!navigationModule.state.draggedTab) return;
                
                e.preventDefault(); // preventDefault必须立即执行，不能被节流
                
                const tab = e.target.closest('.nav-tab');
                if (tab) {
                    createThrottledHandler()(e, tab);
                }
            };
        })(),
        
        onTabDrop: (e) => {
            // 只处理导航标签本身的拖拽，忽略导航项的拖拽
            if (navigationModule.state.draggedItemId) return;
            
            e.preventDefault();
            
            if (!navigationModule.state.draggedTab || navigationModule.state.startingIndex === null) return;
            
            // 计算最终索引
            const tabs = Array.from(dom.navigationTabs.querySelectorAll('.nav-tab'));
            const finalIndex = tabs.indexOf(navigationModule.state.draggedTab);
            
            // 比较起始索引和最终索引
            if (navigationModule.state.startingIndex !== finalIndex) {
                // 获取所有导航组
                const groups = state.userData.navigationGroups;
                
                // 使用splice方法移动数组中的元素以匹配新的DOM顺序
                const [movedGroup] = groups.splice(navigationModule.state.startingIndex, 1);
                groups.splice(finalIndex, 0, movedGroup);
                
                // 更新缓存
                updateNavigationGroupsMap();
                
                // 保存数据
                core.saveUserData(() => {
                    // 重新渲染标签以确保UI与数据一致
                    navigationModule.render.tabs();
                });
            }
        },
        
        /**
         * 清理所有导航模块的事件监听器
         */
        cleanup: () => {
            navigationEventIds.forEach(id => eventManager.remove(id));
            navigationEventIds.length = 0;
            logger.debug('Navigation module events cleaned up');
        }
    }
};
