import { dom } from './dom.js';
import { state } from './state.js';
import { render } from './ui/render.js';
import { STATIC_CONFIG } from './constants.js';
import { eventManager } from './eventManager.js';

// =================================================================
// 核心及工具函数
// =================================================================
export const utils = {
    /**
     * 防抖函数 - 延迟执行，只执行最后一次
     * @param {Function} f - 要防抖的函数
     * @param {number} d - 延迟时间（毫秒）
     */
    debounce: (f, d) => {
        let t;
        return function(...a) {
            clearTimeout(t);
            t = setTimeout(() => f.apply(this, a), d);
        };
    },
    
    /**
     * 节流函数 - 固定频率执行
     * @param {Function} f - 要节流的函数
     * @param {number} d - 间隔时间（毫秒）
     */
    throttle: (f, d) => {
        let last = 0;
        return function(...a) {
            const now = Date.now();
            if (now - last >= d) {
                last = now;
                f.apply(this, a);
            }
        };
    },
    
    /**
     * 请求动画帧节流 - 使用RAF优化动画性能
     * @param {Function} f - 要执行的函数
     */
    rafThrottle: (f) => {
        let rafId = null;
        return function(...a) {
            if (rafId === null) {
                rafId = requestAnimationFrame(() => {
                    f.apply(this, a);
                    rafId = null;
                });
            }
        };
    },
    closeVisibleMenus: (exception) => {
        document.querySelectorAll('.dropdown-menu.visible').forEach(menu => {
            if (menu !== exception && !exception?.contains(menu) && !menu.contains(exception)) {
                 if (menu.id === 'nav-context-menu') closeContextMenu();
                 else if (menu.id === 'nav-tab-context-menu') closeTabContextMenu();
                 else {
                    menu.classList.remove('visible');
                    if (menu.classList.contains('is-dynamic-menu')) {
                         const trigger = document.querySelector(`[aria-controls="${menu.id}"]`);
                         if(trigger) trigger.classList.remove('active');
                         document.body.removeChild(menu);
                    }
                 }
            }
        });
    },
    setDropdownsVisibility: (scope, suggestions) => {
        if (dom.searchScopeMenu) dom.searchScopeMenu.classList.toggle('visible', scope);
        if (dom.searchSuggestionsContainer) dom.searchSuggestionsContainer.classList.toggle('visible', suggestions);
        if (dom.body) dom.body.classList.toggle('scope-menu-open', scope);
        utils.alignPanelHeights();
    },
    closeAllDropdowns: () => {
        utils.setDropdownsVisibility(false, false);
        utils.closeVisibleMenus();
    },
    addPill: (pillData) => {
        const existingPill = state.activeSearchPills.find(p => p.label === pillData.label && p.queryPart === pillData.queryPart);
        if (existingPill) return;

        const removePillType = (type) => {
             state.activeSearchPills = state.activeSearchPills.filter(p => p.type !== type);
        };
        if (pillData.isRange) {
            removePillType('after');
            removePillType('before');
        } else if (['after', 'before'].includes(pillData.type)) {
            removePillType('after');
            removePillType('before');
        } else if (['filetype', 'intitle', 'intext'].includes(pillData.type)) {
            removePillType(pillData.type);
        }
        state.activeSearchPills.push(pillData);
        render.searchPills();
    },
    createCustomSelect: (trigger, options, onSelect) => {
        utils.closeVisibleMenus(trigger);

        // 查找与触发器关联的动态菜单（而不是触发器本身）
        const existingMenu = document.getElementById(`dynamic-menu-${trigger.id}`);
        if (existingMenu) {
            document.body.removeChild(existingMenu);
            trigger.classList.remove('active');
            return;
        }

        const menu = document.createElement('div');
        menu.id = `dynamic-menu-${trigger.id || Math.random().toString(36).substr(2, 9)}`;
        menu.className = 'dropdown-menu is-dynamic-menu';
        trigger.setAttribute('aria-controls', menu.id);

        // 分离普通选项和管理选项
        const regularOptions = options.filter(opt => !opt.value || !opt.value.startsWith('action-manage-'));
        const managementOptions = options.filter(opt => opt.value && opt.value.startsWith('action-manage-'));
        
        // 创建滚动区域容器
        const scrollableArea = document.createElement('div');
        scrollableArea.className = 'dropdown-scrollable-area';
        
        // 添加普通选项到滚动区域
        regularOptions.forEach(opt => {
            if (opt.type === 'divider') {
                 scrollableArea.innerHTML += `<div class="context-menu-divider"></div>`;
                 return;
            }
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.dataset.value = opt.value;
            item.textContent = opt.text;
            item.style.cursor = 'pointer';
            if (opt.value === trigger.dataset.value) item.classList.add('active');
            scrollableArea.appendChild(item);
        });
        
        menu.appendChild(scrollableArea);
        
        // 如果有管理选项，添加分隔符和管理选项到固定区域
        if (managementOptions.length > 0) {
            // 添加分隔符
            const divider = document.createElement('div');
            divider.className = 'context-menu-divider management-divider';
            menu.appendChild(divider);
            
            // 添加管理选项
            const managementArea = document.createElement('div');
            managementArea.className = 'dropdown-management-area';
            
            managementOptions.forEach(opt => {
                const item = document.createElement('a');
                item.href = '#';
                item.className = 'dropdown-item';
                item.dataset.value = opt.value;
                item.textContent = opt.text;
                managementArea.appendChild(item);
            });
            
            menu.appendChild(managementArea);
        }

        menu.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            const item = e.target.closest('.dropdown-item');
            if (item) {
                onSelect(item.dataset.value, item.textContent, e);
                utils.closeVisibleMenus();
            }
        });

        menu.style.visibility = 'hidden';
        document.body.appendChild(menu);
        const rect = trigger.getBoundingClientRect();
        const menuHeight = menu.offsetHeight;
        menu.style.visibility = '';

        // 使用 getBoundingClientRect 获取相对于视口的位置，并考虑页面滚动
        const triggerRect = trigger.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        // 检查是否有足够的空间在下方显示菜单
        if ((window.innerHeight - triggerRect.bottom) < menuHeight + 10 && triggerRect.top > menuHeight) {
            menu.classList.add('opens-up');
            menu.style.top = `${triggerRect.top + scrollTop - menuHeight - 4}px`;
        } else {
            menu.style.top = `${triggerRect.bottom + scrollTop + 4}px`;
        }

        menu.style.left = `${triggerRect.left + scrollLeft}px`;
        menu.style.minWidth = `${triggerRect.width}px`;

        requestAnimationFrame(() => {
            menu.classList.add('visible');
            trigger.classList.add('active');
        });
    },
    formatScopeSite: (url) => {
        try {
            const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
            return hostname.replace(/^www\./, '');
        } catch (e) { return url; }
    },
    alignPanelHeights: () => {
        if (!dom.searchScopeMenu || !dom.searchSuggestionsContainer) return;
        const scopeMenu = dom.searchScopeMenu;
        const suggestionsMenu = dom.searchSuggestionsContainer;
        scopeMenu.style.height = 'auto';
        suggestionsMenu.style.height = 'auto';
        if (scopeMenu.classList.contains('visible') && suggestionsMenu.classList.contains('visible')) {
            requestAnimationFrame(() => {
                const scopeHeight = scopeMenu.offsetHeight;
                const suggestionsHeight = suggestionsMenu.offsetHeight;
                const maxHeight = Math.max(scopeHeight, suggestionsHeight);
                scopeMenu.style.height = `${maxHeight}px`;
                suggestionsMenu.style.height = `${maxHeight}px`;
            });
        }
    },
    applyTimeRule: (ruleId) => {
        if (ruleId === 'any') {
            state.activeSearchPills = state.activeSearchPills.filter(p => p.type !== 'after' && p.type !== 'before');
            render.searchPills();
            return;
        }
        const rule = state.userData.dynamicFilters.timeRange.find(r => r.id === ruleId);
        if (!rule) return;

        switch (rule.type) {
            case 'relative': {
                const match = rule.params.value.match(/([dwmy])(\d+)/);
                if (!match) return;
                const [, unit, amountStr] = match;
                const amount = parseInt(amountStr, 10);
                const date = new Date();
                if (unit === 'd') date.setDate(date.getDate() - amount);
                if (unit === 'w') date.setDate(date.getDate() - amount * 7);
                if (unit === 'm') date.setMonth(date.getMonth() - amount);
                if (unit === 'y') date.setFullYear(date.getFullYear() - amount);

                utils.addPill({ type: 'after', label: rule.name, queryPart: `after:${date.toISOString().split('T')[0]}` });
                break;
            }
            case 'single': {
                const { condition, date } = rule.params;
                utils.addPill({ type: condition, label: rule.name, queryPart: `${condition}:${date}` });
                break;
            }
            case 'range': {
                const { start, end } = rule.params;
                utils.addPill({ type: 'after', isRange: true, label: `开始: ${start}`, queryPart: `after:${start}` });
                utils.addPill({ type: 'before', isRange: true, label: `结束: ${end}`, queryPart: `before:${end}` });
                break;
            }
        }
    },
    showToast: (message, type = 'success') => {
        if (!dom.toastNotification) return;
        dom.toastNotification.textContent = message;
        dom.toastNotification.className = `toast-notification ${type}`;
        dom.toastNotification.classList.add('show');
        setTimeout(() => {
            dom.toastNotification.classList.remove('show');
        }, 2500);
    },
    
    /**
     * 引擎样式工具 - 统一的引擎图标样式控制
     * 消除main.js和render.js中的重复代码
     */
    engineStyle: {
        /**
         * 应用引擎图标大小
         */
        applySize: (size) => {
            const engineIcons = document.querySelectorAll('#engine-menu-content-container .option img, #engine-menu-content-container .option .icon-placeholder');
            engineIcons.forEach(icon => {
                icon.style.width = `${size}px`;
                icon.style.height = `${size}px`;
            });
            
            // 引擎管理已迁移到侧边面板
            const managementIcons = document.querySelectorAll('#effectsSettingsPanel .dropdown-item-favicon');
            managementIcons.forEach(icon => {
                icon.style.width = `${size}px`;
                icon.style.height = `${size}px`;
            });
        },
        
        /**
         * 应用引擎间距
         */
        applySpacing: (spacing) => {
            const engineGrids = document.querySelectorAll('#engine-menu-content-container .scope-options-grid');
            engineGrids.forEach(grid => {
                grid.style.gap = `${spacing}px`;
            });
            
            // 引擎管理已迁移到侧边面板
            const listItems = document.querySelectorAll('#effectsSettingsPanel .list-item');
            listItems.forEach(item => {
                item.style.marginBottom = `${spacing/2}px`;
            });
        }
    },

    // =================================================================
    // DOM工具函数 - 减少重复的DOM创建代码
    // =================================================================
    dom: {
        /**
         * 创建带样式的元素
         * @param {string} tagName - 标签名
         * @param {string} cssText - CSS样式文本
         * @param {Object} attributes - 属性对象
         * @param {string} textContent - 文本内容
         * @returns {HTMLElement} 创建的元素
         */
        createStyledElement: (tagName, cssText = '', attributes = {}, textContent = '') => {
            const element = document.createElement(tagName);
            if (cssText) element.style.cssText = cssText;
            if (textContent) element.textContent = textContent;
            
            Object.entries(attributes).forEach(([key, value]) => {
                if (key === 'className' || key === 'class') {
                    element.className = value;
                } else {
                    element.setAttribute(key, value);
                }
            });
            
            return element;
        },

        /**
         * 创建Flex容器
         * @param {string} gap - 间距值
         * @param {string} alignItems - 对齐方式
         * @param {string} flex - flex属性
         * @returns {HTMLElement} Flex容器元素
         */
        createFlexContainer: (gap = STATIC_CONFIG.STYLES.SPACING.SM, alignItems = 'center', flex = '1') => {
            return utils.dom.createStyledElement('div', 
                `display: flex; align-items: ${alignItems}; gap: ${gap}; flex: ${flex}; overflow: hidden;`
            );
        },

        /**
         * 创建图标元素
         * @param {string} size - 图标大小
         * @param {string} src - 图标源
         * @param {string} alt - 替代文本
         * @returns {HTMLElement} 图标元素
         */
        createIcon: (size = STATIC_CONFIG.STYLES.ICON_SIZES.SMALL, src = '', alt = '') => {
            const icon = utils.dom.createStyledElement('img', 
                `width: ${size}; height: ${size}; flex-shrink: 0;`,
                { src, alt }
            );
            icon.addEventListener('error', function() { this.style.display = 'none'; });
            return icon;
        },

        /**
         * 创建文本容器
         * @param {string} fontSize - 字体大小
         * @param {string} color - 颜色
         * @param {string} fontWeight - 字体粗细
         * @returns {HTMLElement} 文本容器元素
         */
        createTextContainer: (fontSize = STATIC_CONFIG.STYLES.FONT_SIZES.PRIMARY, color = STATIC_CONFIG.STYLES.COLORS.PRIMARY, fontWeight = STATIC_CONFIG.STYLES.FONT_WEIGHTS.MEDIUM) => {
            return utils.dom.createStyledElement('div', 
                `display: flex; flex-direction: column; overflow: hidden; flex: 1;`
            );
        },

        /**
         * 创建文本元素
         * @param {string} text - 文本内容
         * @param {string} fontSize - 字体大小
         * @param {string} color - 颜色
         * @param {string} fontWeight - 字体粗细
         * @returns {HTMLElement} 文本元素
         */
        createTextElement: (text, fontSize = STATIC_CONFIG.STYLES.FONT_SIZES.PRIMARY, color = STATIC_CONFIG.STYLES.COLORS.PRIMARY, fontWeight = STATIC_CONFIG.STYLES.FONT_WEIGHTS.MEDIUM) => {
            return utils.dom.createStyledElement('span', 
                `font-size: ${fontSize}; color: ${color}; font-weight: ${fontWeight}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`,
                {},
                text
            );
        },

        /**
         * 创建预览容器
         * @param {string} gap - 间距值
         * @returns {HTMLElement} 预览容器元素
         */
        createPreviewContainer: (gap = STATIC_CONFIG.STYLES.SPACING.MD) => {
            return utils.dom.createStyledElement('div', 
                `display: flex; align-items: center; gap: ${gap};`
            );
        }
    },

    // =================================================================
    // 模态框工厂函数 - 减少重复的模态框创建代码
    // =================================================================
    modal: {
        /**
         * 创建表单组
         * @param {string} labelText - 标签文本
         * @param {string} inputId - 输入框ID
         * @param {string} inputType - 输入框类型
         * @param {boolean} required - 是否必填
         * @param {string} defaultValue - 默认值
         * @returns {Object} 包含formGroup和input的对象
         */
        createFormGroup: (labelText, inputId, inputType = 'text', required = false, defaultValue = '') => {
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group';
            
            const label = document.createElement('label');
            label.setAttribute('for', inputId);
            label.textContent = labelText;
            
            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'input-wrapper';
            
            const input = document.createElement('input');
            input.type = inputType;
            input.id = inputId;
            if (required) input.required = true;
            if (defaultValue) input.value = defaultValue;
            
            inputWrapper.appendChild(input);
            formGroup.appendChild(label);
            formGroup.appendChild(inputWrapper);
            
            return { formGroup, input, inputWrapper };
        },

        /**
         * 创建按钮
         * @param {string} text - 按钮文本
         * @param {string} className - CSS类名
         * @param {string} action - 数据动作
         * @param {Object} attributes - 其他属性
         * @returns {HTMLElement} 按钮元素
         */
        createButton: (text, className = '', action = '', attributes = {}) => {
            const button = document.createElement('button');
            button.textContent = text;
            
            if (className) button.className = className;
            if (action) button.setAttribute('data-action', action);
            
            // 设置其他属性
            Object.entries(attributes).forEach(([key, value]) => {
                if (key === 'className' || key === 'class') {
                    button.className = value;
                } else {
                    button.setAttribute(key, value);
                }
            });
            
            return button;
        },

        /**
         * 创建标签
         * @param {string} text - 标签文本
         * @param {string} forId - 关联的输入框ID
         * @returns {HTMLElement} 标签元素
         */
        createLabel: (text, forId = '') => {
            const attributes = {};
            if (forId) attributes.for = forId;
            return utils.dom.createStyledElement('label', '', attributes, text);
        },

        /**
         * 创建输入框
         * @param {string} type - 输入框类型
         * @param {string} id - 输入框ID
         * @param {boolean} required - 是否必填
         * @param {string} defaultValue - 默认值
         * @param {Object} attributes - 其他属性
         * @returns {HTMLElement} 输入框元素
         */
        createInput: (type = 'text', id = '', required = false, defaultValue = '', attributes = {}) => {
            const inputAttrs = { type, ...attributes };
            if (id) inputAttrs.id = id;
            if (required) inputAttrs.required = required;
            if (defaultValue) inputAttrs.value = defaultValue;
            
            return utils.dom.createStyledElement('input', '', inputAttrs);
        },

        /**
         * 创建输入框包装器
         * @param {HTMLElement} input - 输入框元素
         * @returns {HTMLElement} 包装器元素
         */
        createInputWrapper: (input) => {
            const wrapper = utils.dom.createStyledElement('div', '', { className: 'input-wrapper' });
            wrapper.appendChild(input);
            return wrapper;
        },

        /**
         * 创建排序按钮组
         * @param {number} index - 当前索引
         * @param {number} totalItems - 总项目数
         * @param {string} action - 数据动作
         * @returns {Object} 包含upBtn和downBtn的对象
         */
        createSortButtons: (index, totalItems, action = 'move-item') => {
            const sortButtons = utils.dom.createStyledElement('div', '', { className: 'sort-buttons' });
            
            const upBtn = utils.modal.createButton('▲', 'sort-btn', action, {
                'data-direction': 'up',
                disabled: index === 0
            });
            
            const downBtn = utils.modal.createButton('▼', 'sort-btn', action, {
                'data-direction': 'down',
                disabled: index === totalItems - 1
            });
            
            sortButtons.appendChild(upBtn);
            sortButtons.appendChild(downBtn);
            
            return { sortButtons, upBtn, downBtn };
        }
    },

    // =================================================================
    // 事件处理工具函数 - 减少重复的事件绑定代码
    // =================================================================
    events: {
        /**
         * 批量绑定拖拽事件
         * @param {HTMLElement} container - 容器元素
         * @param {string} selector - 选择器
         * @param {Object} handlers - 事件处理器对象
         * @param {Array} eventIds - 事件ID数组
         * @returns {Array} 事件ID数组
         */
        bindDragEvents: (container, selector, handlers, eventIds = []) => {
            const dragEvents = [
                { event: 'dragstart', handler: handlers.onDragStart },
                { event: 'dragover', handler: handlers.onDragOver },
                { event: 'dragend', handler: handlers.onDragEnd },
                { event: 'drop', handler: handlers.onDrop }
            ];
            
            dragEvents.forEach(({ event, handler }) => {
                if (handler) {
                    eventIds.push(eventManager.delegate(container, event, selector, handler));
                }
            });
            
            return eventIds;
        },

        /**
         * 批量绑定事件委托
         * @param {HTMLElement} container - 容器元素
         * @param {Array} eventConfigs - 事件配置数组
         * @param {Array} eventIds - 事件ID数组
         * @returns {Array} 事件ID数组
         */
        bindDelegatedEvents: (container, eventConfigs, eventIds = []) => {
            eventConfigs.forEach(({ event, selector, handler }) => {
                if (handler) {
                    eventIds.push(eventManager.delegate(container, event, selector, handler));
                }
            });
            
            return eventIds;
        },

        /**
         * 批量绑定直接事件
         * @param {HTMLElement} element - 目标元素
         * @param {Array} eventConfigs - 事件配置数组
         * @param {Array} eventIds - 事件ID数组
         * @returns {Array} 事件ID数组
         */
        bindDirectEvents: (element, eventConfigs, eventIds = []) => {
            eventConfigs.forEach(({ event, handler }) => {
                if (handler) {
                    eventIds.push(eventManager.add(element, event, handler));
                }
            });
            
            return eventIds;
        },

        /**
         * 清理事件监听器
         * @param {Array} eventIds - 事件ID数组
         */
        cleanupEvents: (eventIds) => {
            eventIds.forEach(id => eventManager.remove(id));
            eventIds.length = 0;
        },

        /**
         * 创建事件配置对象
         * @param {string} event - 事件名
         * @param {string} selector - 选择器（可选）
         * @param {Function} handler - 事件处理器
         * @returns {Object} 事件配置对象
         */
        createEventConfig: (event, selector = '', handler) => {
            return { event, selector, handler };
        },

        /**
         * 创建拖拽事件处理器对象
         * @param {Function} onDragStart - 拖拽开始处理器
         * @param {Function} onDragOver - 拖拽悬停处理器
         * @param {Function} onDragEnd - 拖拽结束处理器
         * @param {Function} onDrop - 放置处理器
         * @returns {Object} 拖拽事件处理器对象
         */
        createDragHandlers: (onDragStart, onDragOver, onDragEnd, onDrop) => {
            return { onDragStart, onDragOver, onDragEnd, onDrop };
        }
    }
};

// These functions need to be defined outside the utils object to avoid circular dependencies
function closeContextMenu() {
    if (dom.navContextMenu) {
        dom.navContextMenu.classList.remove('visible');
        dom.navContextMenu.style.opacity = '0';
        dom.navContextMenu.style.visibility = 'hidden';
    }
}

function closeTabContextMenu() {
    if (dom.navTabContextMenu) {
        dom.navTabContextMenu.classList.remove('visible');
        dom.navTabContextMenu.style.opacity = '0';
        dom.navTabContextMenu.style.visibility = 'hidden';
    }
}