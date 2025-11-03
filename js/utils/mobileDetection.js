// =================================================================
// 移动端检测和响应式工具（已优化：使用eventManager和timerManager统一管理，避免内存泄漏）
// =================================================================

import { eventManager } from '../eventManager.js';
import { timerManager } from './timerManager.js';

/**
 * 响应式断点配置
 * 统一管理所有媒体查询断点，便于维护
 */
export const BREAKPOINTS = {
    // 移动端断点
    MOBILE: 480,        // 小屏手机
    TABLET: 768,        // 平板
    DESKTOP: 1024,      // 桌面端
    LARGE_DESKTOP: 1440, // 大桌面
    
    // 获取断点宽度（用于JS判断）
    get isMobile() {
        return window.innerWidth <= this.MOBILE;
    },
    
    get isTablet() {
        return window.innerWidth > this.MOBILE && window.innerWidth <= this.TABLET;
    },
    
    get isDesktop() {
        return window.innerWidth > this.TABLET;
    },
    
    get isSmallScreen() {
        return window.innerWidth <= this.TABLET;
    }
};

/**
 * 设备类型检测
 */
export const deviceDetection = {
    /**
     * 是否为移动设备（基于User Agent）
     */
    isMobileDevice: () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        );
    },
    
    /**
     * 是否为触摸设备
     */
    isTouchDevice: () => {
        return 'ontouchstart' in window || 
               navigator.maxTouchPoints > 0 || 
               navigator.msMaxTouchPoints > 0;
    },
    
    /**
     * 是否为iOS设备
     */
    isIOS: () => {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    },
    
    /**
     * 是否为Android设备
     */
    isAndroid: () => {
        return /Android/.test(navigator.userAgent);
    }
};

/**
 * 响应式工具函数
 */
export const responsiveUtils = {
    /**
     * 监听窗口大小变化
     * @param {Function} callback - 回调函数
     * @param {number} debounceMs - 防抖延迟（毫秒）
     * @returns {Function} 清理函数
     */
    onResize: (callback, debounceMs = 150) => {
        const handlerId = `responsive-resize-${Math.random().toString(36).slice(2, 11)}`;
        const handler = () => {
            timerManager.clearTimeout(handlerId);
            timerManager.setTimeout(handlerId, () => {
                callback({
                    width: window.innerWidth,
                    height: window.innerHeight,
                    breakpoint: BREAKPOINTS,
                    isMobile: BREAKPOINTS.isMobile,
                    isTablet: BREAKPOINTS.isTablet,
                    isDesktop: BREAKPOINTS.isDesktop,
                    isSmallScreen: BREAKPOINTS.isSmallScreen
                });
            }, debounceMs);
        };
        
        // 使用eventManager统一管理，避免内存泄漏
        const eventId = eventManager.add(window, 'resize', handler);
        // 立即执行一次
        handler();
        
        // 返回清理函数
        return () => {
            timerManager.clearTimeout(handlerId);
            eventManager.remove(eventId);
        };
    },
    
    /**
     * 添加移动端类名到body
     */
    addMobileClasses: () => {
        const body = document.body;
        const isTouch = deviceDetection.isTouchDevice();
        const isMobile = BREAKPOINTS.isMobile;
        const isTablet = BREAKPOINTS.isTablet;
        const isSmallScreen = BREAKPOINTS.isSmallScreen;
        
        // 添加基础类名
        if (isTouch) body.classList.add('touch-device');
        if (isMobile) body.classList.add('mobile');
        if (isTablet) body.classList.add('tablet');
        if (isSmallScreen) body.classList.add('small-screen');
        if (!isSmallScreen) body.classList.add('large-screen');
    },
    
    /**
     * 移除所有响应式类名
     */
    removeMobileClasses: () => {
        const body = document.body;
        body.classList.remove('touch-device', 'mobile', 'tablet', 'small-screen', 'large-screen');
    },
    
    /**
     * 更新响应式类名（在窗口大小变化时调用）
     */
    updateMobileClasses: () => {
        responsiveUtils.removeMobileClasses();
        responsiveUtils.addMobileClasses();
    },
    
    /**
     * 初始化响应式系统
     */
    init: () => {
        responsiveUtils.addMobileClasses();
        
        // 监听窗口大小变化，更新类名
        const cleanupResize = responsiveUtils.onResize(() => {
            responsiveUtils.updateMobileClasses();
        });
        
        // 监听横竖屏切换（移动端重要）（使用eventManager统一管理，避免内存泄漏）
        const orientationHandlerId = 'responsive-orientation';
        const handleOrientationChange = () => {
            // 延迟执行，等待浏览器完成布局更新（使用timerManager统一管理）
            timerManager.clearTimeout(orientationHandlerId);
            timerManager.setTimeout(orientationHandlerId, () => {
                responsiveUtils.updateMobileClasses();
            }, 100);
        };
        
        const orientationEventId = eventManager.add(window, 'orientationchange', handleOrientationChange);
        
        // 返回清理函数
        return () => {
            cleanupResize();
            timerManager.clearTimeout(orientationHandlerId);
            eventManager.remove(orientationEventId);
        };
    }
};

/**
 * 触摸事件辅助工具
 */
export const touchUtils = {
    /**
     * 为元素添加触摸反馈
     * @param {HTMLElement} element - 目标元素
     * @param {Object} options - 配置选项
     */
    addTouchFeedback: (element, options = {}) => {
        const {
            activeClass = 'touch-active',
            removeDelay = 150
        } = options;
        
        const touchTimeoutId = `touch-feedback-${element.id || Math.random().toString(36).slice(2, 11)}`;
        
        const addActive = () => {
            timerManager.clearTimeout(touchTimeoutId);
            element.classList.add(activeClass);
        };
        
        const removeActive = () => {
            timerManager.clearTimeout(touchTimeoutId);
            timerManager.setTimeout(touchTimeoutId, () => {
                element.classList.remove(activeClass);
            }, removeDelay);
        };
        
        // 使用eventManager统一管理，避免内存泄漏
        const touchstartId = eventManager.add(element, 'touchstart', addActive, { passive: true });
        const touchendId = eventManager.add(element, 'touchend', removeActive, { passive: true });
        const touchcancelId = eventManager.add(element, 'touchcancel', removeActive, { passive: true });
        
        // 返回清理函数
        return () => {
            timerManager.clearTimeout(touchTimeoutId);
            eventManager.remove(touchstartId);
            eventManager.remove(touchendId);
            eventManager.remove(touchcancelId);
        };
    },
    
    /**
     * 检测是否为点击（而非拖拽）
     * @param {TouchEvent} startEvent - touchstart事件
     * @param {TouchEvent} endEvent - touchend事件
     * @param {number} maxDistance - 最大移动距离（像素）
     * @returns {boolean}
     */
    isClick: (startEvent, endEvent, maxDistance = 10) => {
        if (!startEvent.touches || !endEvent.changedTouches) return false;
        
        const start = startEvent.touches[0];
        const end = endEvent.changedTouches[0];
        
        const distance = Math.sqrt(
            Math.pow(end.clientX - start.clientX, 2) + 
            Math.pow(end.clientY - start.clientY, 2)
        );
        
        return distance <= maxDistance;
    }
};

// 导出默认对象
export default {
    BREAKPOINTS,
    deviceDetection,
    responsiveUtils,
    touchUtils
};
