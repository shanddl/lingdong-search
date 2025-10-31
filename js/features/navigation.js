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
        startingIndex: null
    },
    
    utils: {
        applyAppearanceSettings: (size, gap) => {
            document.documentElement.style.setProperty('--nav-item-size', `${size}px`);
            document.documentElement.style.setProperty('--nav-grid-gap', `${gap}px`);
        },
        closeContextMenu: () => {
            if (dom.navContextMenu) {
                dom.navContextMenu.classList.remove('visible');
            }
        },
        closeTabContextMenu: () => {
            if (dom.navTabContextMenu) {
                dom.navTabContextMenu.classList.remove('visible');
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
            
            // 创建头部
            const header = document.createElement('div');
            header.className = 'modal-header';
            const title = document.createElement('h3');
            title.className = 'modal-title';
            title.textContent = '编辑网站';
            const closeBtn = document.createElement('button');
            closeBtn.className = 'modal-close-btn';
            closeBtn.textContent = '×'; // 【安全性优化】使用textContent替代innerHTML
            header.appendChild(title);
            header.appendChild(closeBtn);
            
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
            
            // 组装表单主体（注意：之前已经添加过了，这里不需要再添加）
            // body.appendChild(nameGroup);
            // body.appendChild(urlGroup);
            // body.appendChild(iconGroup);
            body.appendChild(previewGroup);
            body.appendChild(groupGroup);
            
            // 创建底部按钮
            const footer = document.createElement('div');
            footer.className = 'modal-footer justify-end';
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'modal-btn modal-btn-secondary';
            cancelBtn.id = `cancel-edit-nav-${item.id}`;
            cancelBtn.textContent = '取消';
            const submitBtn = document.createElement('button');
            submitBtn.type = 'submit';
            submitBtn.className = 'modal-btn modal-btn-primary';
            submitBtn.textContent = '保存更改';
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

            // 使用已经创建的元素引用（避免重复查询）
            let currentIcon = item.icon;
            const closeModal = () => document.body.removeChild(modalOverlay);
            closeBtn.addEventListener('click', closeModal);
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

            // 添加测试图标源按钮事件
            testIconBtn.addEventListener('click', () => {
                const urlValue = urlGroup.input.value.trim();
                if (!urlValue) {
                    utils.showToast('请先输入网站地址', 'error');
                    return;
                }

                try {
                    const iconSourcesList = document.getElementById(`edit-nav-icon-sources-list-${item.id}`);
                    const iconSourcesContent = document.getElementById(`edit-nav-icon-sources-content-${item.id}`);
                    
                    if (!iconSourcesList || !iconSourcesContent) {
                        utils.showToast('图标源测试界面未找到', 'error');
                        return;
                    }

                    iconSourcesList.style.display = 'block';
                    // 【安全性优化】使用textContent替代innerHTML
                    iconSourcesContent.textContent = '';
                    const loadingDiv = document.createElement('div');
                    loadingDiv.style.color = 'var(--text-secondary)';
                    loadingDiv.textContent = '正在测试图标源...';
                    iconSourcesContent.appendChild(loadingDiv);

                    const sources = aiManager.getIconSources(urlValue);
                    
                    if (sources.length === 0) {
                        iconSourcesContent.textContent = '';
                        const errorDiv = document.createElement('div');
                        errorDiv.style.color = 'var(--text-secondary)';
                        errorDiv.textContent = '无法获取图标源';
                        iconSourcesContent.appendChild(errorDiv);
                        utils.showToast('无法获取图标源', 'error');
                        return;
                    }

                    iconSourcesContent.textContent = '';

                    sources.forEach((source) => {
                        const sourceItem = document.createElement('div');
                        sourceItem.className = 'icon-source-item';
                        
                        // 【安全性优化】使用createElement替代innerHTML
                        const img = document.createElement('img');
                        img.src = sanitizer.sanitizeIconUrl(source.url);
                        img.onerror = function() { this.style.display = 'none'; };
                        
                        const nameSpan = document.createElement('span');
                        nameSpan.style.color = 'var(--text-primary)';
                        nameSpan.textContent = source.name;
                        
                        const descSpan = document.createElement('span');
                        descSpan.style.color = 'var(--text-secondary)';
                        descSpan.style.fontSize = '10px';
                        descSpan.textContent = source.description;
                        
                        sourceItem.appendChild(img);
                        sourceItem.appendChild(nameSpan);
                        sourceItem.appendChild(descSpan);
                        
                        sourceItem.addEventListener('click', () => {
                            iconGroup.input.value = source.url;
                            currentIcon = source.url;
                            previewImg.src = sanitizer.sanitizeIconUrl(source.url);
                            utils.showToast(`已选择: ${source.name}`, 'success');
                        });
                        
                        iconSourcesContent.appendChild(sourceItem);
                    });
                    
                    utils.showToast(`找到 ${sources.length} 个图标源`, 'success');
                } catch (error) {
                    logger.error('测试图标源失败:', error);
                    utils.showToast('测试图标源失败: ' + error.message, 'error');
                }
            });

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const newTitle = nameGroup.input.value.trim();
                const newUrl = urlGroup.input.value.trim();
                const newGroupId = groupSelect.value;
                if (newTitle && newUrl) {
                    onSave({
                        ...item,
                        title: newTitle,
                        url: newUrl,
                        icon: currentIcon
                    }, currentGroupId, newGroupId);
                    closeModal();
                }
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
                        tab.classList.toggle('active', group.id === state.activeNavigationGroupId);
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
            
            // 【性能优化】使用CSS过渡替代直接清空，减少视觉闪烁
            // 先添加淡出效果（如果有旧内容）
            if (oldNavItems.length > 0) {
                dom.navigationGrid.style.opacity = '0.3';
                dom.navigationGrid.style.transition = 'opacity 0.1s ease-out';
            }
            
            // 在下一个动画帧清空并重建，给CSS过渡时间
            requestAnimationFrame(() => {
                dom.navigationGrid.innerHTML = '';
                dom.navigationGrid.style.display = 'flex';
                dom.navigationGrid.style.opacity = '0';
                dom.navigationGrid.style.transition = 'opacity 0.2s ease-in';

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
                    
                    const icon = document.createElement('img');
                    const iconUrl = sanitizer.sanitizeIconUrl(item.icon);
                    icon.className = 'nav-item-icon';
                    icon.alt = item.title;
                    
                    // 【性能优化】切换分类时简化懒加载：直接使用原生懒加载
                    // 浏览器会自动处理视口检测，避免复杂的滚动监听器
                    icon.loading = 'lazy';
                    icon.src = iconUrl;
                    
                    // 使用箭头函数处理图标加载失败
                    icon.addEventListener('error', function handleError() {
                        this.removeEventListener('error', handleError);
                        const firstChar = item.title.charAt(0).toUpperCase();
                        this.src = `https://placehold.co/32x32/f0f0f0/000000?text=${encodeURIComponent(firstChar)}`;
                    });
                    
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
                    
                    // 移除过渡和更新标志
                    setTimeout(() => {
                        dom.navigationGrid.style.opacity = '';
                        dom.navigationGrid.style.transition = '';
                        document.body.removeAttribute('data-updating');
                    }, 200);
                });
            });
        },
        contextMenu: (x, y) => {
            if (!dom.navContextMenu) return;
            const menu = dom.navContextMenu;
            
            const fragment = document.createDocumentFragment();
            
            // 使用button而不是a标签，避免显示URL
            const editItem = document.createElement('button');
            editItem.className = 'dropdown-item';
            editItem.dataset.action = 'edit-nav-item';
            editItem.textContent = '编辑';
            fragment.appendChild(editItem);
            
            const divider = document.createElement('div');
            divider.className = 'context-menu-divider';
            fragment.appendChild(divider);
            
            const deleteItem = document.createElement('button');
            deleteItem.className = 'dropdown-item';
            deleteItem.dataset.action = 'delete-nav-item';
            deleteItem.style.color = 'var(--red)';
            deleteItem.textContent = '删除';
            fragment.appendChild(deleteItem);
            
            menu.innerHTML = '';
            menu.appendChild(fragment);
            
            menu.style.top = `${y}px`;
            menu.style.left = `${x}px`;
            menu.style.background = 'rgba(45, 45, 45, 0.7)';
            menu.style.backgroundColor = 'rgba(45, 45, 45, 0.9)';
            menu.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            menu.style.borderRadius = '16px';
            menu.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
            menu.classList.add('visible');
        },
        tabContextMenu: (x, y, tab) => {
            if (!dom.navTabContextMenu) return;
            const menu = dom.navTabContextMenu;
            
            const fragment = document.createDocumentFragment();
            
            // 使用button而不是a标签，避免显示URL
            const renameItem = document.createElement('button');
            renameItem.className = 'dropdown-item';
            renameItem.dataset.action = 'rename-nav-group';
            renameItem.textContent = '重命名分类';
            fragment.appendChild(renameItem);
            
            const deleteItem = document.createElement('button');
            deleteItem.className = 'dropdown-item';
            deleteItem.dataset.action = 'delete-nav-group';
            deleteItem.style.color = 'var(--red)';
            deleteItem.textContent = '删除分类';
            fragment.appendChild(deleteItem);
            
            const divider = document.createElement('div');
            divider.className = 'context-menu-divider';
            fragment.appendChild(divider);
            
            const manageItem = document.createElement('button');
            manageItem.className = 'dropdown-item';
            manageItem.dataset.action = 'manage-nav-groups';
            manageItem.textContent = '管理所有分类...';
            fragment.appendChild(manageItem);
            
            menu.innerHTML = '';
            menu.appendChild(fragment);
            const rect = tab.getBoundingClientRect();
            const menuHeight = menu.offsetHeight;
            
            menu.style.top = `${rect.top - menuHeight - 8}px`;
            menu.style.left = `${rect.left + (rect.width / 2) - (menu.offsetWidth / 2)}px`;
            menu.style.background = 'rgba(45, 45, 45, 0.7)';
            menu.style.backgroundColor = 'rgba(45, 45, 45, 0.9)';
            menu.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            menu.style.borderRadius = '16px';
            menu.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
            menu.classList.add('visible', 'opens-up');
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
                        const url = e.target.closest('.nav-item')?.dataset.url;
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
                    eventManager.add(dom.navigationGrid, 'dragover', e => e.preventDefault())
                );
                navigationEventIds.push(
                    eventManager.add(dom.navigationGrid, 'drop', navigationModule.handlers.onDrop)
                );
                // 清理拖拽样式
                navigationEventIds.push(
                    eventManager.add(dom.navigationGrid, 'dragend', (e) => {
                        e.target.closest('.nav-item')?.classList.remove('dragging');
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
                    allTabs.forEach(t => {
                        t.classList.toggle('active', t.dataset.groupId === targetGroupId);
                    });
                }
                
                // 立即渲染grid（异步执行以避免阻塞）
                requestAnimationFrame(() => {
                    navigationModule.render.grid();
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
            // 使用安全的确认对话框
            domSafe.showConfirm(
                '您确定要删除这个导航项吗？\n此操作无法撤销。',
                () => {
                const group = getGroupById(state.activeNavigationGroupId);
                if (group) {
                    group.items = group.items.filter(i => i.id !== itemId);
                    updateNavigationGroupsMap(); // 更新缓存
                    core.saveUserData((error) => {
                        if (error) {
                            utils.showToast('删除失败: ' + error.message, 'error');
                        } else {
                            utils.showToast('删除成功', 'success');
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
                        utils.showToast('保存失败: ' + error.message, 'error');
                        
                    } else {
                        utils.showToast('保存成功', 'success');
                        navigationModule.render.all();
                    }
                });
            });
        },
        onDragStart: (e) => {
            const item = e.target.closest('.nav-item');
            if (item) {
                navigationModule.state.draggedItemId = item.dataset.itemId;
                e.dataTransfer.effectAllowed = 'move';
                // 添加 dragging 样式
                item.classList.add('dragging');
            }
        },
        onDrop: (e) => {
            e.preventDefault();
            const targetElem = e.target.closest('.nav-item');
            const draggedId = navigationModule.state.draggedItemId;
            if (!draggedId) return;

            const group = getGroupById(state.activeNavigationGroupId);
            if (!group) return;

            const itemIndex = group.items.findIndex(i => i.id === draggedId);
            const [movedItem] = group.items.splice(itemIndex, 1);
            
            if (targetElem) {
                const targetIndex = group.items.findIndex(i => i.id === targetElem.dataset.itemId);
                group.items.splice(targetIndex, 0, movedItem);
            } else {
                group.items.push(movedItem);
            }
            
            updateNavigationGroupsMap(); // 更新缓存
            core.saveUserData(() => navigationModule.render.grid());
            navigationModule.state.draggedItemId = null;
        },
        onDragOverTab: (e) => {
            // 【修复】只处理导航项拖拽到标签的情况，忽略标签自身拖拽
            if (navigationModule.state.draggedItemId) {
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
            const draggedId = navigationModule.state.draggedItemId;
            const targetGroupId = navigationModule.state.dragOverGroupId;

            if (!draggedId || !targetGroupId || targetGroupId === state.activeNavigationGroupId) return;

            const sourceGroup = getGroupById(state.activeNavigationGroupId);
            const targetGroup = getGroupById(targetGroupId);
            if (!sourceGroup || !targetGroup) return;

            const itemIndex = sourceGroup.items.findIndex(i => i.id === draggedId);
            const [movedItem] = sourceGroup.items.splice(itemIndex, 1);
            targetGroup.items.push(movedItem);

            updateNavigationGroupsMap(); // 更新缓存
            core.saveUserData(() => {
                utils.showToast(`已移动到 "${targetGroup.name}"`, 'success');
                navigationModule.render.grid();
            });
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
                    utils.showToast('重命名成功', 'success');
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
                        utils.showToast('删除成功', 'success');
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
                    utils.showToast('保存失败: ' + error.message, 'error');
                    
                } else {
                    utils.showToast('分类已保存', 'success');
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
