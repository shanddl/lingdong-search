import { dom } from './dom.js';
import { state } from './state.js';
import { render } from './ui/render.js';
import { STATIC_CONFIG } from './constants.js';
import { eventManager } from './eventManager.js';
import { sanitizer } from './security.js';
import { URLFormatter } from './utils/urlFormatter.js';
import { NotificationService } from './utils/notificationService.js';

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
                // 【安全修复】使用createElement替代innerHTML，避免XSS风险
                const divider = document.createElement('div');
                divider.className = 'context-menu-divider';
                scrollableArea.appendChild(divider);
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
        // 向后兼容：使用URLFormatter
        return URLFormatter.formatScopeSite(url);
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
        // 提示框功能已禁用
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
         * 创建图标元素（带错误处理和占位符支持）
         * @param {string} size - 图标大小
         * @param {string} src - 图标源
         * @param {string} alt - 替代文本
         * @param {Object} options - 选项：{fallbackChar: string, sanitize: boolean}
         * @returns {HTMLElement} 图标元素
         */
        createIcon: (size = STATIC_CONFIG.STYLES.ICON_SIZES.SMALL, src = '', alt = '', options = {}) => {
            const { fallbackChar, sanitize = true } = options;
            
            // 如果需要清理图标URL，使用sanitizer
            const safeSrc = (sanitize && src) ? sanitizer.sanitizeIconUrl(src) : src;
            
            const icon = utils.dom.createStyledElement('img', 
                `width: ${size}; height: ${size}; flex-shrink: 0;`,
                { src: safeSrc, alt, loading: 'lazy' }
            );
            
            // 统一的错误处理逻辑
            icon.addEventListener('error', function handleError() {
                this.removeEventListener('error', handleError);
                if (fallbackChar) {
                    // 使用占位符图片
                    const firstChar = fallbackChar.charAt(0).toUpperCase();
                    const iconSize = size.replace(/\D/g, '') || '32';
                    this.src = `https://placehold.co/${iconSize}x${iconSize}/f0f0f0/000000?text=${encodeURIComponent(firstChar)}`;
                } else {
                    // 隐藏图标
                    this.style.display = 'none';
                }
            });
            
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
        },

        /**
         * 创建上下文菜单项
         * @param {Object} item - 菜单项配置 {text: string, action: string, color?: string, type?: 'button'|'divider'}
         * @returns {HTMLElement} 菜单项元素
         */
        createContextMenuItem: (item) => {
            if (item.type === 'divider') {
                const divider = document.createElement('div');
                divider.className = 'context-menu-divider';
                return divider;
            }
            
            if (!item || !item.text) {
                return document.createElement('div');
            }
            
            const menuItem = document.createElement(item.elementType || 'button');
            menuItem.className = 'dropdown-item';
            if (item.action) menuItem.dataset.action = item.action;
            menuItem.textContent = item.text || '';
            if (item.color) menuItem.style.color = item.color;
            if (!item.elementType) menuItem.style.cursor = 'pointer';
            
            return menuItem;
        },

        /**
         * 批量创建上下文菜单
         * @param {Array} items - 菜单项配置数组
         * @param {DocumentFragment} fragment - 目标fragment（可选，不提供则创建新的）
         * @returns {DocumentFragment} 包含菜单项的fragment
         */
        createContextMenuItems: (items, fragment = null) => {
            const targetFragment = fragment || document.createDocumentFragment();
            items.forEach(item => {
                targetFragment.appendChild(utils.dom.createContextMenuItem(item));
            });
            return targetFragment;
        },

        /**
         * 应用上下文菜单样式
         * @param {HTMLElement} menu - 菜单元素
         * @param {number} x - X坐标
         * @param {number} y - Y坐标
         * @param {Object} options - 选项：{opensUp: boolean, centerX: boolean}
         */
        applyContextMenuStyle: (menu, x, y, options = {}) => {
            const { opensUp, centerX, rect } = options;
            
            // 【修复】确保菜单可测量尺寸
            // 菜单内容已添加，但可能CSS设置了visibility: hidden，需要临时显示以测量
            // 保存并临时设置样式以便测量
            const originalPosition = menu.style.position;
            const originalTop = menu.style.top;
            const originalLeft = menu.style.left;
            const originalVisibility = menu.style.visibility;
            
            // 临时移到屏幕外并设置为可见以测量尺寸（但不显示给用户）
            menu.style.position = 'fixed';
            menu.style.top = '-9999px';
            menu.style.left = '-9999px';
            menu.style.visibility = 'hidden'; // 保持hidden但允许布局计算
            menu.style.display = 'block'; // 确保可以测量
            menu.style.opacity = '0'; // 不可见但可测量
            
            // 强制浏览器重排以获取准确尺寸
            void menu.offsetHeight;
            
            // 获取菜单尺寸（此时菜单已在DOM中且有内容）
            const menuHeight = menu.offsetHeight || 0;
            const menuWidth = menu.offsetWidth || 0;
            
            // 计算位置
            let top = y;
            let left = x;
            
            if (opensUp && rect && menuHeight > 0) {
                top = rect.top - menuHeight - 8;
            }
            
            if (centerX && rect && menuWidth > 0) {
                left = rect.left + (rect.width / 2) - (menuWidth / 2);
            }
            
            // 应用最终位置和样式（批量操作减少重排）
            // 【修复】移除backgroundColor，避免覆盖CSS的backdrop-filter效果
            // CSS中已有背景样式（带backdrop-filter），只需设置位置和可见性
            Object.assign(menu.style, {
                position: 'fixed', // 右键菜单使用fixed定位
                top: `${top}px`,
                left: `${left}px`,
                visibility: 'visible',
                opacity: '1',
                display: '' // 使用CSS默认值
                // 注意：不设置background/backgroundColor，使用CSS中的样式（带backdrop-filter）
            });
            
            if (opensUp) {
                menu.classList.add('opens-up');
            }
            menu.classList.add('visible');
        }
    },

    // =================================================================
    // 表单验证工具 - 统一验证逻辑，减少重复代码
    // =================================================================
    validator: {
        /**
         * 验证必填字段
         * @param {string} value - 字段值
         * @param {string} fieldName - 字段名称（用于错误消息）
         * @returns {Object} {valid: boolean, message: string}
         */
        validateRequired: (value, fieldName = '字段') => {
            const trimmed = typeof value === 'string' ? value.trim() : '';
            if (!trimmed) {
                return {
                    valid: false,
                    message: `请输入${fieldName}`
                };
            }
            return { valid: true, message: '' };
        },

        /**
         * 验证URL格式
         * @param {string} url - URL字符串
         * @returns {Object} {valid: boolean, message: string}
         */
        validateUrl: (url) => {
            const trimmed = typeof url === 'string' ? url.trim() : '';
            if (!trimmed) {
                return {
                    valid: false,
                    message: '请输入网站地址'
                };
            }
            
            // 使用security.js中的验证逻辑
            try {
                const testUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
                if (!sanitizer.isValidUrl(testUrl)) {
                    return {
                        valid: false,
                        message: '无效的网址格式'
                    };
                }
            } catch (e) {
                return {
                    valid: false,
                    message: '无效的网址格式'
                };
            }
            
            return { valid: true, message: '' };
        },

        /**
         * 批量验证表单字段
         * @param {Array} fields - 字段配置数组 [{input, name, required, type, customValidator}]
         * @returns {Object} {valid: boolean, errors: Array}
         */
        validateForm: (fields) => {
            const errors = [];
            
            fields.forEach(field => {
                const { input, name, required = false, type = 'text', customValidator } = field;
                
                if (!input) return;
                
                // 【修复】正确处理select元素和其他输入元素的值
                let value = input.value;
                // select元素的值可能是空字符串，需要在验证中处理
                if (typeof value === 'string') {
                    value = value.trim();
                }
                
                // 必填验证（包括select元素）
                if (required) {
                    // select元素的空值验证（value为空字符串或未选择）
                    if (input.tagName === 'SELECT' && (value === '' || value === null)) {
                        errors.push({ field: name, message: `请选择${name}` });
                        return;
                    }
                    const result = utils.validator.validateRequired(value, name);
                    if (!result.valid) {
                        errors.push({ field: name, message: result.message });
                        return;
                    }
                }
                
                // 类型验证
                if (value && type === 'url') {
                    const result = utils.validator.validateUrl(value);
                    if (!result.valid) {
                        errors.push({ field: name, message: result.message });
                        return;
                    }
                }
                
                // 自定义验证（允许检查空值，用于条件验证）
                if (customValidator) {
                    const result = customValidator(value);
                    if (!result || !result.valid) {
                        errors.push({ 
                            field: name, 
                            message: result?.message || `${name}验证失败` 
                        });
                    }
                }
            });
            
            return {
                valid: errors.length === 0,
                errors: errors
            };
        }
    },

    // =================================================================
    // 表单工具函数 - 统一表单操作
    // =================================================================
    form: {
        /**
         * 获取表单字段值（自动trim）
         * @param {HTMLElement} input - 输入框元素
         * @param {boolean} required - 是否必填
         * @returns {string|null} 字段值或null（如果必填但为空）
         */
        getFieldValue: (input, required = false) => {
            if (!input) return null;
            const value = input.value?.trim() || '';
            if (required && !value) return null;
            return value || null;
        },

        /**
         * 设置按钮加载状态
         * @param {HTMLElement} button - 按钮元素
         * @param {boolean} loading - 是否加载中
         * @param {string} loadingText - 加载中文本
         * @param {string} normalText - 正常文本
         */
        setButtonLoading: (button, loading, loadingText = '保存中...', normalText = '保存') => {
            if (!button) return;
            button.disabled = loading;
            button.textContent = loading ? loadingText : normalText;
        },

        /**
         * 重置表单
         * @param {HTMLFormElement} form - 表单元素
         * @param {Object} defaultValues - 默认值对象 {fieldId: value}
         */
        resetForm: (form, defaultValues = {}) => {
            if (!form) return;
            form.reset();
            Object.entries(defaultValues).forEach(([id, value]) => {
                const input = form.querySelector(`#${id}`);
                if (input) input.value = value;
            });
        },

        /**
         * 带提示的保存操作
         * @param {Function} saveFn - 保存函数，参数为callback(err)
         * @param {string} successMsg - 成功消息
         * @param {string} errorMsg - 错误消息
         */
        saveWithToast: (saveFn, successMsg = '保存成功', errorMsg = '保存失败') => {
            if (typeof saveFn !== 'function') return;
            saveFn((err) => {
                // 提示框已移除，仅执行保存操作
            });
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
         * 创建模态框头部
         * @param {string} titleText - 标题文本
         * @param {Function} onClose - 关闭回调函数
         * @returns {Object} 包含header、title、closeBtn的对象
         */
        createModalHeader: (titleText, onClose) => {
            const header = document.createElement('div');
            header.className = 'modal-header';
            
            const title = document.createElement('h3');
            title.className = 'modal-title';
            title.textContent = titleText;
            
            const closeBtn = document.createElement('button');
            closeBtn.className = 'modal-close-btn';
            closeBtn.textContent = '×';
            closeBtn.setAttribute('data-action', 'close-modal');
            
            if (typeof onClose === 'function') {
                closeBtn.addEventListener('click', onClose);
            }
            
            header.appendChild(title);
            header.appendChild(closeBtn);
            
            return { header, title, closeBtn };
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
        },

        /**
         * 从URL获取图标源URL（使用统一的图标源方案）
         * @param {string} url - 网站URL
         * @returns {string} 图标URL，如果失败则返回默认占位符URL
         */
        getIconUrlFromUrl: (url) => {
            if (!url || typeof url !== 'string') {
                return 'https://placehold.co/24x24/3c4043/e8eaed?text=?';
            }
            
            try {
                // 使用icon.bqb.cool作为首选图标源
                const urlObj = new URL(url);
                const origin = urlObj.origin;
                
                // 首选使用icon.bqb.cool
                return `https://icon.bqb.cool/?url=${encodeURIComponent(origin)}`;
            } catch (error) {
                // URL解析失败，返回默认占位符
                return 'https://placehold.co/24x24/3c4043/e8eaed?text=?';
            }
        },

        /**
         * 从URL获取所有可用的图标源（使用aiManager.getIconSources）
         * @param {string} url - 网站URL
         * @returns {Promise<string>} 图标URL，返回第一个（首选icon.bqb.cool）图标源，如果失败则返回默认占位符URL
         */
        getIconUrlFromUrlAsync: async (url) => {
            if (!url || typeof url !== 'string') {
                return 'https://placehold.co/24x24/3c4043/e8eaed?text=?';
            }
            
            try {
                // 动态导入aiManager避免循环依赖
                const { aiManager } = await import('./features/ai-manager.js');
                const sources = aiManager.getIconSources(url);
                
                if (sources && sources.length > 0) {
                    // 使用第一个图标源（icon.bqb.cool，首选）
                    return sources[0].url;
                } else {
                    // 如果获取失败，使用直链favicon作为fallback
                    const urlObj = new URL(url);
                    return `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
                }
            } catch (error) {
                // URL解析失败，返回默认占位符
                try {
                    const urlObj = new URL(url);
                    return `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
                } catch (e) {
                    return 'https://placehold.co/24x24/3c4043/e8eaed?text=?';
                }
            }
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