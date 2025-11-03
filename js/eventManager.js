// =================================================================
// 事件管理器 - 统一管理事件监听器，避免内存泄漏
// =================================================================

/**
 * 事件管理器类
 * 用于统一管理DOM元素的事件监听器，防止内存泄漏
 */
class EventManager {
    constructor() {
        // 存储所有注册的事件监听器
        this.listeners = new Map();
        // 事件ID计数器
        this.idCounter = 0;
    }

    /**
     * 添加事件监听器
     * @param {Element} element - DOM元素
     * @param {string} eventType - 事件类型
     * @param {Function} handler - 事件处理函数
     * @param {Object} options - 事件选项
     * @returns {string} 事件ID，用于后续移除
     */
    add(element, eventType, handler, options = false) {
        if (!element || !eventType || !handler) {
            console.warn('EventManager.add: Invalid parameters');
            return null;
        }

        // 检测重复监听器：同一element + eventType + handler + options
        for (const [existingId, listener] of this.listeners) {
            // 简单比较options（对于布尔值和对象的浅比较）
            const optionsMatch = JSON.stringify(listener.options) === JSON.stringify(options);
            
            if (listener.element === element && 
                listener.eventType === eventType && 
                listener.handler === handler &&
                optionsMatch) {
                console.warn(
                    `EventManager: 检测到重复监听器 [${eventType}]`,
                    element,
                    '返回现有ID:',
                    existingId
                );
                return existingId; // 返回现有ID，不重复添加
            }
        }

        const eventId = `event_${this.idCounter++}`;
        const listener = {
            element,
            eventType,
            handler,
            options
        };

        this.listeners.set(eventId, listener);
        element.addEventListener(eventType, handler, options);

        return eventId;
    }

    /**
     * 移除事件监听器
     * @param {string} eventId - 事件ID
     */
    remove(eventId) {
        const listener = this.listeners.get(eventId);
        if (listener) {
            const { element, eventType, handler, options } = listener;
            element.removeEventListener(eventType, handler, options);
            this.listeners.delete(eventId);
        }
    }

    /**
     * 移除指定元素的所有事件监听器
     * @param {Element} element - DOM元素
     */
    removeByElement(element) {
        const idsToRemove = [];
        this.listeners.forEach((listener, eventId) => {
            if (listener.element === element) {
                idsToRemove.push(eventId);
            }
        });
        idsToRemove.forEach(id => this.remove(id));
    }

    /**
     * 移除所有事件监听器
     */
    removeAll() {
        this.listeners.forEach((listener, eventId) => {
            const { element, eventType, handler, options } = listener;
            element.removeEventListener(eventType, handler, options);
        });
        this.listeners.clear();
    }

    /**
     * 为容器添加事件委托
     * @param {Element} container - 容器元素
     * @param {string} eventType - 事件类型
     * @param {string} selector - 子元素选择器
     * @param {Function} handler - 事件处理函数
     * @returns {string} 事件ID
     */
    delegate(container, eventType, selector, handler) {
        const delegateHandler = (e) => {
            const target = e.target.closest(selector);
            if (target && container.contains(target)) {
                handler.call(target, e);
            }
        };

        return this.add(container, eventType, delegateHandler);
    }

    /**
     * 获取当前注册的监听器数量
     */
    getCount() {
        return this.listeners.size;
    }
    
    /**
     * 【新增】重置管理器状态（用于页面刷新时）
     * 清理所有监听器并重置内部状态，但保留实例本身
     */
    reset() {
        this.removeAll();
        this.idCounter = 0;
    }
}

// 创建全局事件管理器实例
export const eventManager = new EventManager();

// 【根本修复】页面加载时立即重置，确保每次刷新都是干净状态
// 在DOMContentLoaded之前执行，避免与页面卸载时的清理冲突
if (typeof window !== 'undefined' && document.readyState === 'loading') {
    // 页面正在加载，重置单例状态
    eventManager.reset();
}

// 【修复】移除这里的beforeunload监听器，统一在main.js中管理
// 避免刷新页面时监听器累积（每次模块加载都会添加新的监听器）
// 统一清理逻辑由main.js的beforeunload处理，确保只添加一次

