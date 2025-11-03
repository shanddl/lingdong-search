// =================================================================
// 通知服务 - 统一所有通知和Toast显示
// =================================================================

import { timerManager } from './timerManager.js';

/**
 * 通知服务（统一Toast和Notification）
 */
export const NotificationService = {
    /**
     * 显示通知
     * @param {string} message - 消息内容
     * @param {string} type - 类型：'success', 'error', 'info', 'warning'
     * @param {Object} options - 选项
     * @param {number} options.duration - 显示时长（毫秒），默认3000
     * @param {string} options.position - 位置：'top', 'bottom', 'center'（默认'top'）
     * @returns {void}
     */
    show(message, type = 'info', options = {}) {
        if (!message) return;
        
        const {
            duration = 3000,
            position = 'top'
        } = options;
        
        // 尝试使用现有的Toast系统
        const toastElement = document.getElementById('toast-notification');
        if (toastElement) {
            this.showToast(message, type, duration);
            return;
        }
        
        // 如果没有Toast系统，创建临时通知
        this.showNotification(message, type, duration, position);
    },
    
    /**
     * 显示Toast（使用现有DOM元素）
     * @param {string} message - 消息
     * @param {string} type - 类型
     * @param {number} duration - 时长
     * @returns {void}
     */
    showToast(message, type = 'info', duration = 3000) {
        // 尝试使用dom.js中的toastNotification（动态导入避免循环依赖）
        let toast = null;
        try {
            // 尝试从dom.js获取（如果已加载）
            if (typeof window !== 'undefined' && window.dom && window.dom.toastNotification) {
                toast = window.dom.toastNotification;
            } else {
                toast = document.getElementById('toast-notification');
            }
        } catch {
            toast = document.getElementById('toast-notification');
        }
        
        if (!toast) {
            // 回退到临时通知
            this.showNotification(message, type, duration);
            return;
        }
        
        toast.textContent = message;
        toast.className = `toast-notification ${type}`;
        toast.classList.add('show');
        
        // 自动隐藏（保持原有行为：2500ms）
        const actualDuration = duration || 2500;
        // 使用timerManager统一管理定时器，避免内存泄漏
        // 使用固定的ID，因为toast元素是单例
        timerManager.clearTimeout('toast-hide');
        timerManager.setTimeout('toast-hide', () => {
            toast.classList.remove('show');
        }, actualDuration);
    },
    
    /**
     * 显示临时通知（创建新元素）
     * @param {string} message - 消息
     * @param {string} type - 类型
     * @param {number} duration - 时长
     * @param {string} position - 位置
     * @returns {void}
     */
    showNotification(message, type = 'info', duration = 3000, position = 'top') {
        // 移除之前的通知
        const existing = document.getElementById('temp-notification');
        if (existing) {
            existing.remove();
        }
        
        const notification = document.createElement('div');
        notification.id = 'temp-notification';
        notification.textContent = message;
        
        // 样式
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196F3'
        };
        
        const positions = {
            top: { top: '20px', bottom: 'auto' },
            bottom: { top: 'auto', bottom: '20px' },
            center: { top: '50%', bottom: 'auto', transform: 'translateY(-50%)' }
        };
        
        const pos = positions[position] || positions.top;
        
        notification.style.cssText = `
            position: fixed;
            left: 50%;
            ${pos.top ? `top: ${pos.top};` : ''}
            ${pos.bottom ? `bottom: ${pos.bottom};` : ''}
            transform: translateX(-50%) ${pos.transform || ''};
            background-color: ${colors[type] || colors.info};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            white-space: nowrap;
            opacity: 0;
            transition: opacity 0.3s ease, transform 0.3s ease;
            pointer-events: none;
        `;
        
        document.body.appendChild(notification);
        
        // 显示动画
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = `translateX(-50%) ${pos.transform ? pos.transform : ''}`;
        });
        
        // 自动移除（使用timerManager统一管理）
        timerManager.setTimeout('notification-hide', () => {
            notification.style.opacity = '0';
            timerManager.setTimeout('notification-remove', () => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }
};

// 保持向后兼容：导出showToast作为别名
export const showToast = NotificationService.showToast.bind(NotificationService);
export const showNotification = NotificationService.showNotification.bind(NotificationService);

