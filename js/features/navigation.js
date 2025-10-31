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

// =================================================================
// 导航模块
// =================================================================
export const navigationModule = {
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
            closeBtn.innerHTML = '&times;';
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
                    iconSourcesContent.innerHTML = '<div style="color: var(--text-secondary);">正在测试图标源...</div>';

                    const sources = aiManager.getIconSources(urlValue);
                    
                    if (sources.length === 0) {
                        iconSourcesContent.innerHTML = '<div style="color: var(--text-secondary);">无法获取图标源</div>';
                        utils.showToast('无法获取图标源', 'error');
                        return;
                    }

                    iconSourcesContent.innerHTML = '';

                    sources.forEach((source) => {
                        const sourceItem = document.createElement('div');
                        sourceItem.className = 'icon-source-item';
                        
                        sourceItem.innerHTML = `
                            <img src="${source.url}" 
                                 onerror="this.style.display='none'">
                            <span style="color: var(--text-primary);">${source.name}</span>
                            <span style="color: var(--text-secondary); font-size: 10px;">${source.description}</span>
                        `;
                        
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
                    console.error('测试图标源失败:', error);
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
            
            const fragment = document.createDocumentFragment();
            if (!state.userData.navigationGroups || state.userData.navigationGroups.length === 0) return;
            
            state.userData.navigationGroups.forEach(group => {
                const tab = document.createElement('button');
                tab.className = 'nav-tab';
                tab.textContent = group.name;
                tab.dataset.groupId = group.id;
                // 添加 draggable 属性以支持拖放
                tab.draggable = true;
                if (group.id === state.activeNavigationGroupId) {
                    tab.classList.add('active');
                }
                fragment.appendChild(tab);
            });
            
            dom.navigationTabs.innerHTML = '';
            dom.navigationTabs.appendChild(fragment);
        },
        grid: () => {
            if (!dom.navigationGrid) return;
            
            // 标记正在更新，禁用所有动画
            document.body.setAttribute('data-updating', 'true');
            
            // 【内存优化】清理旧的滚动监听器（如果存在）
            const oldNavItems = dom.navigationGrid.querySelectorAll('.nav-item');
            oldNavItems.forEach(item => {
                if (item._iconScrollHandler) {
                    window.removeEventListener('scroll', item._iconScrollHandler, { passive: true });
                    item._iconScrollHandler = null;
                }
            });
            
            dom.navigationGrid.innerHTML = '';
            
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
            
            // 查找活动组
            let activeGroup = state.userData.navigationGroups.find(g => g.id === state.activeNavigationGroupId);
            
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
            dom.navigationGrid.style.display = 'flex';

            const fragment = document.createDocumentFragment();
            
            activeGroup.items.forEach(item => {
                // 使用div而不是a标签，完全隐藏URL显示
                const navItem = document.createElement('div');
                navItem.className = 'nav-item';
                navItem.dataset.url = item.url; // 将真实URL存储在data属性中
                navItem.draggable = true;
                navItem.dataset.itemId = item.id;
                navItem.style.cursor = 'pointer'; // 添加指针样式
                
                const iconWrapper = document.createElement('div');
                iconWrapper.className = 'nav-item-icon-wrapper';
                
                const icon = document.createElement('img');
                // 【内存优化】使用懒加载，减少初始内存占用
                const iconUrl = sanitizer.sanitizeIconUrl(item.icon);
                icon.className = 'nav-item-icon';
                icon.alt = item.title;
                icon.loading = 'lazy'; // 启用原生懒加载
                
                // 【内存优化】智能懒加载图标：仅当图标进入视口时才加载
                // 检查元素是否在视口内，决定立即加载还是通过滚动监听器加载
                const checkAndLoadIcon = () => {
                    if (!navItem.isConnected || icon.src) return; // 已加载或元素已移除
                    
                    const rect = navItem.getBoundingClientRect();
                    // 检查是否在视口内（上下各200px的缓冲区）
                    const isVisible = rect.top < window.innerHeight + 200 && rect.bottom > -200;
                    
                    if (isVisible) {
                        // 在视口内，立即加载并移除滚动监听器
                        icon.src = iconUrl;
                        if (navItem._iconScrollHandler) {
                            window.removeEventListener('scroll', navItem._iconScrollHandler, { passive: true });
                            navItem._iconScrollHandler = null;
                        }
                    }
                };
                
                // 【内存优化】滚动监听器：当图标进入视口时加载
                // 使用一次性监听器，加载后自动移除
                const scrollHandler = () => {
                    if (!icon.src && navItem.isConnected) {
                        checkAndLoadIcon();
                    } else if (!navItem.isConnected || icon.src) {
                        // 元素已被移除或已加载，清理监听器
                        window.removeEventListener('scroll', scrollHandler, { passive: true });
                        navItem._iconScrollHandler = null;
                    }
                };
                
                // 保存滚动监听器引用以便后续清理
                navItem._iconScrollHandler = scrollHandler;
                
                // 立即检查一次（可能已经在视口内）
                requestAnimationFrame(checkAndLoadIcon);
                
                // 如果不在视口内，添加滚动监听器（被动监听，性能优化）
                // 使用 requestIdleCallback 延迟添加，减少初始开销
                if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(() => {
                        // 再次检查，可能在延迟期间已经加载
                        if (!icon.src && navItem.isConnected && navItem._iconScrollHandler) {
                            window.addEventListener('scroll', scrollHandler, { passive: true });
                        }
                    }, { timeout: 500 });
                } else {
                    // 降级方案：延迟添加滚动监听器
                    setTimeout(() => {
                        if (!icon.src && navItem.isConnected && navItem._iconScrollHandler) {
                            window.addEventListener('scroll', scrollHandler, { passive: true });
                        }
                    }, 100);
                }

                // 使用箭头函数处理图标加载失败
                icon.addEventListener('error', function handleError() {
                    this.removeEventListener('error', handleError);
                    // 生成带首字母的占位符
                    const firstChar = item.title.charAt(0).toUpperCase();
                    this.src = `https://placehold.co/32x32/f0f0f0/000000?text=${encodeURIComponent(firstChar)}`;
                });
                
                iconWrapper.appendChild(icon);
                
                const title = document.createElement('span');
                title.className = 'nav-item-title';
                title.textContent = item.title;
                
                navItem.appendChild(iconWrapper);
                navItem.appendChild(title);
                
                // 添加点击事件处理
                navItem.addEventListener('click', (e) => {
                    e.preventDefault();
                    const url = navItem.dataset.url;
                    if (url) {
                        window.open(url, '_blank');
                    }
                });
                
                fragment.appendChild(navItem);
            });
            
            dom.navigationGrid.appendChild(fragment);
            
            // 立即移除更新标志，恢复正常状态
            requestAnimationFrame(() => {
                document.body.removeAttribute('data-updating');
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
            
            dom.navGroupsList.querySelectorAll('[data-action="edit-nav-group"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const groupId = e.target.closest('.list-item').dataset.id;
                    navigationModule.handlers.onEditGroupStart(groupId);
                });
            });
            dom.navGroupsList.querySelectorAll('[data-action="delete-nav-group"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const groupId = e.target.closest('.list-item').dataset.id;
                    navigationModule.handlers.onDeleteGroup(groupId);
                });
            });
            dom.navGroupsList.querySelectorAll('[data-action="move-nav-group"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const groupId = e.target.closest('.list-item').dataset.id;
                    const direction = e.target.dataset.direction;
                    navigationModule.handlers.onMoveGroup(groupId, direction);
                });
            });
        }
    },

    handlers: {
        init: () => {
            // 导航网格事件（使用 eventManager 管理）
            if (dom.navigationGrid) {
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
        },
        
        onTabClick: (e) => {
            const tab = e.target.closest('.nav-tab');
            if (tab && tab.dataset.groupId) {
                state.activeNavigationGroupId = tab.dataset.groupId;
                core.saveUserData((error) => {
                    if (error) {
                        utils.showToast('保存失败: ' + error.message, 'error');
                        
                    } else {
                        navigationModule.render.all();
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
                const group = state.userData.navigationGroups.find(g => g.id === state.activeNavigationGroupId);
                if (group) {
                    group.items = group.items.filter(i => i.id !== itemId);
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
            const group = state.userData.navigationGroups.find(g => g.id === currentGroupId);
            logger.debug('找到的分组:', group);
            const item = group ? group.items.find(i => i.id === itemId) : null;
            logger.debug('找到的导航项:', item);
            if (!item) {
                logger.warn('未找到导航项, itemId:', itemId);
                return;
            }

            logger.debug('准备创建编辑模态框');
            navigationModule.utils.createNavItemEditModal(item, currentGroupId, (updatedItem, oldGroupId, newGroupId) => {
                if (oldGroupId === newGroupId) {
                    const groupToUpdate = state.userData.navigationGroups.find(g => g.id === oldGroupId);
                    const itemIndex = groupToUpdate.items.findIndex(i => i.id === updatedItem.id);
                    if (itemIndex > -1) {
                        groupToUpdate.items[itemIndex] = updatedItem;
                    }
                } else {
                    const oldGroup = state.userData.navigationGroups.find(g => g.id === oldGroupId);
                    const newGroup = state.userData.navigationGroups.find(g => g.id === newGroupId);
                    oldGroup.items = oldGroup.items.filter(i => i.id !== updatedItem.id);
                    newGroup.items.push(updatedItem);
                }
                
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

            const group = state.userData.navigationGroups.find(g => g.id === state.activeNavigationGroupId);
            if (!group) return;

            const itemIndex = group.items.findIndex(i => i.id === draggedId);
            const [movedItem] = group.items.splice(itemIndex, 1);
            
            if (targetElem) {
                const targetIndex = group.items.findIndex(i => i.id === targetElem.dataset.itemId);
                group.items.splice(targetIndex, 0, movedItem);
            } else {
                group.items.push(movedItem);
            }
            
            core.saveUserData(() => navigationModule.render.grid());
            navigationModule.state.draggedItemId = null;
        },
        onDragOverTab: (e) => {
            e.preventDefault();
            const tab = e.target.closest('.nav-tab');
            if (tab && !tab.classList.contains('active')) {
                tab.classList.add('drag-over');
                navigationModule.state.dragOverGroupId = tab.dataset.groupId;
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

            const sourceGroup = state.userData.navigationGroups.find(g => g.id === state.activeNavigationGroupId);
            const targetGroup = state.userData.navigationGroups.find(g => g.id === targetGroupId);
            if (!sourceGroup || !targetGroup) return;

            const itemIndex = sourceGroup.items.findIndex(i => i.id === draggedId);
            const [movedItem] = sourceGroup.items.splice(itemIndex, 1);
            targetGroup.items.push(movedItem);

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
            const group = state.userData.navigationGroups.find(g => g.id === groupId);
            if (!group) return;
            const newName = prompt('请输入新的分类名称:', group.name);
            if (newName && newName.trim() !== '') {
                group.name = newName.trim();
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
            const group = state.userData.navigationGroups.find(g => g.id === groupId);
            if (group) {
                // 使用安全的确认对话框（转义用户输入）
                domSafe.showConfirm(
                    `您确定要删除分类\n"${sanitizer.escapeHtml(group.name)}"\n吗？\n此操作无法撤销。`,
                    () => {
                    state.userData.navigationGroups = state.userData.navigationGroups.filter(g => g.id !== groupId);
                    if (state.activeNavigationGroupId === groupId) {
                        state.activeNavigationGroupId = state.userData.navigationGroups[0].id;
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
            const group = state.userData.navigationGroups.find(g => g.id === groupId);
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
                const group = state.userData.navigationGroups.find(g => g.id === id);
                if (group) group.name = name;
            } else { // Adding new group
                const newGroup = { id: `group_${Date.now()}`, name: name, items: [] };
                state.userData.navigationGroups.push(newGroup);
            }
            
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
        
        onTabDragOver: (e) => {
            // 只处理导航标签本身的拖拽，忽略导航项的拖拽
            if (navigationModule.state.draggedItemId) return;
            
            e.preventDefault();
            
            const tab = e.target.closest('.nav-tab');
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
        },
        
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
        },
        
        // ===================================================================
        // 导航项跨分类拖拽处理方法
        // ===================================================================
        
        /**
         * 导航项拖拽到标签上时 - 允许放置
         */
        onDragOverTab: (e) => {
            const tab = e.target.closest('.nav-tab');
            if (tab && navigationModule.state.draggedItemId) {
                e.preventDefault(); // 允许放置
                tab.classList.add('drag-over');
                navigationModule.state.dragOverGroupId = tab.dataset.groupId;
            }
        },
        
        /**
         * 导航项离开标签时 - 清除样式
         */
        onTabDragLeave: (e) => {
            const tab = e.target.closest('.nav-tab');
            if (tab) {
                tab.classList.remove('drag-over');
            }
        },
        
        /**
         * 导航项放置到标签上 - 移动到目标分类
         */
        onDropOnTab: (e) => {
            e.preventDefault();
            const tab = e.target.closest('.nav-tab');
            if (tab) {
                tab.classList.remove('drag-over');
            }
            
            const targetGroupId = navigationModule.state.dragOverGroupId;
            const draggedItemId = navigationModule.state.draggedItemId;
            
            if (!targetGroupId || !draggedItemId) return;
            
            // 找到被拖拽的项和目标分类
            let draggedItem = null;
            let sourceGroup = null;
            
            for (const group of state.userData.navigationGroups) {
                const item = group.items.find(i => i.id === draggedItemId);
                if (item) {
                    draggedItem = item;
                    sourceGroup = group;
                    break;
                }
            }
            
            const targetGroup = state.userData.navigationGroups.find(g => g.id === targetGroupId);
            
            if (draggedItem && sourceGroup && targetGroup && sourceGroup.id !== targetGroup.id) {
                // 从源分类移除
                sourceGroup.items = sourceGroup.items.filter(i => i.id !== draggedItemId);
                // 添加到目标分类
                targetGroup.items.push(draggedItem);
                
                // 保存并刷新
                core.saveUserData((error) => {
                    if (error) {
                        utils.showToast('移动失败', 'error');
                    } else {
                        utils.showToast(`已移动到"${targetGroup.name}"`, 'success');
                        navigationModule.render.all();
                    }
                });
            }
            
            // 清除状态
            navigationModule.state.draggedItemId = null;
            navigationModule.state.dragOverGroupId = null;
        },
        
        // ===================================================================
        // 标签拖拽排序处理方法
        // ===================================================================
        
        /**
         * 开始拖拽标签
         */
        onTabDragStart: (e) => {
            const tab = e.target.closest('.nav-tab');
            if (tab && tab.draggable) {
                navigationModule.state.draggedTab = tab;
                navigationModule.state.draggedGroupId = tab.dataset.groupId;
                
                // 查找当前标签的索引
                const tabs = Array.from(dom.navigationTabs.querySelectorAll('.nav-tab'));
                navigationModule.state.startingIndex = tabs.indexOf(tab);
                
                tab.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            }
        },
        
        /**
         * 拖拽标签结束
         */
        onTabDragEnd: (e) => {
            const tab = e.target.closest('.nav-tab');
            if (tab) {
                tab.classList.remove('dragging');
            }
            
            // 清除所有拖拽样式
            document.querySelectorAll('.nav-tab.drag-over').forEach(t => {
                t.classList.remove('drag-over');
            });
            
            navigationModule.state.draggedTab = null;
            navigationModule.state.draggedGroupId = null;
            navigationModule.state.startingIndex = null;
        },
        
        /**
         * 拖拽标签经过其他标签
         */
        onTabDragOver: (e) => {
            const tab = e.target.closest('.nav-tab');
            if (tab && navigationModule.state.draggedTab && tab !== navigationModule.state.draggedTab) {
                e.preventDefault();
                tab.classList.add('drag-over');
                navigationModule.state.dragOverTabId = tab.dataset.groupId;
            }
        },
        
        /**
         * 放置标签到新位置
         */
        onTabDrop: (e) => {
            e.preventDefault();
            
            const targetTab = e.target.closest('.nav-tab');
            if (targetTab) {
                targetTab.classList.remove('drag-over');
            }
            
            const draggedGroupId = navigationModule.state.draggedGroupId;
            const targetGroupId = navigationModule.state.dragOverTabId;
            
            if (!draggedGroupId || !targetGroupId || draggedGroupId === targetGroupId) {
                return;
            }
            
            // 找到两个分类的索引
            const draggedIndex = state.userData.navigationGroups.findIndex(g => g.id === draggedGroupId);
            const targetIndex = state.userData.navigationGroups.findIndex(g => g.id === targetGroupId);
            
            if (draggedIndex > -1 && targetIndex > -1) {
                // 移动分类
                const [draggedGroup] = state.userData.navigationGroups.splice(draggedIndex, 1);
                state.userData.navigationGroups.splice(targetIndex, 0, draggedGroup);
                
                // 保存并刷新
                core.saveUserData((error) => {
                    if (error) {
                        utils.showToast('排序失败', 'error');
                    } else {
                        navigationModule.render.all();
                    }
                });
            }
            
            navigationModule.state.dragOverTabId = null;
        }
    }
};
