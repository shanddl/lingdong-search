// =================================================================
// DOM操作工具 - 统一DOM类名、显示隐藏等操作
// =================================================================

/**
 * DOM操作辅助工具
 */
export const DOMHelper = {
    /**
     * 切换按钮组状态（单选模式）
     * @param {HTMLElement|NodeList} container - 容器元素或按钮列表
     * @param {string} selector - 按钮选择器（如果container是容器）
     * @param {HTMLElement} activeElement - 激活的元素
     * @param {string[]} classes - 要切换的类名数组，默认['active', 'selected']
     * @returns {void}
     */
    toggleButtonGroup(container, selector, activeElement, classes = ['active', 'selected']) {
        if (!container || !activeElement) return;
        
        // 获取所有按钮
        const buttons = selector 
            ? container.querySelectorAll(selector)
            : (container instanceof NodeList || Array.isArray(container) ? container : [container]);
        
        // 移除所有按钮的激活状态
        buttons.forEach(btn => {
            if (btn && btn.classList) {
                classes.forEach(cls => btn.classList.remove(cls));
            }
        });
        
        // 添加激活元素的激活状态
        if (activeElement && activeElement.classList) {
            classes.forEach(cls => activeElement.classList.add(cls));
        }
    },
    
    /**
     * 切换元素可见性
     * @param {HTMLElement} element - 目标元素
     * @param {boolean} visible - 是否显示
     * @param {Object} options - 选项
     * @param {boolean} options.useOpacity - 是否使用透明度（默认true）
     * @param {boolean} options.useVisibility - 是否使用visibility（默认true）
     * @param {boolean} options.useDisplay - 是否使用display（默认false）
     * @param {string} options.className - 切换的类名（如'visible'）
     * @returns {void}
     */
    toggleVisibility(element, visible, options = {}) {
        if (!element) return;
        
        const {
            useOpacity = true,
            useVisibility = true,
            useDisplay = false,
            className = null
        } = options;
        
        if (className) {
            element.classList.toggle(className, visible);
        }
        
        if (useOpacity) {
            element.style.opacity = visible ? '1' : '0';
        }
        
        if (useVisibility) {
            element.style.visibility = visible ? 'visible' : 'hidden';
        }
        
        if (useDisplay) {
            element.style.display = visible ? '' : 'none';
        }
    },
    
    /**
     * 批量设置元素文本内容
     * @param {Array<{element: HTMLElement, value: string|number}>} items - 元素和值的数组
     * @param {Function} formatter - 格式化函数（可选）
     * @returns {void}
     */
    setTextContent(items, formatter = null) {
        if (!Array.isArray(items)) return;
        
        items.forEach(({ element, value }) => {
            if (element) {
                const text = formatter ? formatter(value) : String(value);
                element.textContent = text;
            }
        });
    },
    
    /**
     * 查找并返回元素（带缓存）
     * @param {Function} queryFn - 查询函数
     * @param {Map} cache - 缓存Map
     * @param {string} key - 缓存键
     * @returns {NodeList|HTMLElement|null}
     */
    cachedQuery(queryFn, cache, key) {
        if (!cache.has(key)) {
            const result = queryFn();
            if (result) {
                cache.set(key, result);
            }
        }
        return cache.get(key);
    },
    
    /**
     * 移除所有动态菜单
     * @param {string} selector - 菜单选择器（默认'.is-dynamic-menu'）
     * @returns {void}
     */
    removeDynamicMenus(selector = '.is-dynamic-menu') {
        document.querySelectorAll(selector).forEach(menu => {
            if (menu.parentNode) {
                menu.parentNode.removeChild(menu);
            }
        });
    }
};



