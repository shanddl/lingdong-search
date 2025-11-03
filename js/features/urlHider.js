// URL显示屏蔽功能模块
import { eventManager } from '../eventManager.js';
import { timerManager } from '../utils/timerManager.js';

export const urlHider = {
    // 存储事件监听器ID，用于清理
    eventIds: [],
    
    // 跟踪已添加监听器的链接元素（使用WeakSet避免内存泄漏）
    trackedLinks: new WeakSet(),
    
    // 存储链接元素的事件监听器引用（使用WeakMap避免内存泄漏）
    linkEventHandlers: new WeakMap(),
    
    // 【修复】额外的Set用于跟踪所有已添加监听器的元素，以便在destroy时能够遍历清理
    // 使用WeakSet无法遍历，所以使用普通Set（元素被删除时会自动GC，Set中的引用不会阻止GC）
    trackedLinksSet: new Set(),
    
    // 【修复】为每个元素生成唯一的定时器ID（使用WeakMap避免内存泄漏）
    elementTimerIds: new WeakMap(),

    /**
     * 初始化URL屏蔽功能
     */
    init: () => {
        console.log('初始化URL屏蔽功能');
        urlHider.setupEventListeners();
        urlHider.observeNewElements();
    },

    /**
     * 设置事件监听器（使用eventManager统一管理，避免内存泄漏）
     */
    setupEventListeners: () => {
        // 如果已经初始化过，先清理
        if (urlHider.eventIds.length > 0) {
            urlHider.eventIds.forEach(id => eventManager.remove(id));
            urlHider.eventIds = [];
        }
        
        // 使用eventManager统一管理所有监听器
        urlHider.eventIds.push(
            eventManager.add(document, 'mouseover', urlHider.handleMouseOver),
            eventManager.add(document, 'mouseout', urlHider.handleMouseOut),
            eventManager.add(document, 'mousemove', urlHider.handleMouseMove),
            eventManager.add(document, 'contextmenu', urlHider.handleContextMenu),
            eventManager.add(document, 'click', urlHider.handleLinkClick)
        );
    },

    /**
     * 处理鼠标悬停事件
     */
    handleMouseOver: (event) => {
        const target = event.target;
        
        // 检查是否是链接元素
        if (urlHider.isLinkElement(target)) {
            console.log('检测到链接悬停，屏蔽URL显示');
            // 立即屏蔽URL显示
            urlHider.hideUrlForElement(target);
        }
    },

    /**
     * 处理鼠标离开事件
     */
    handleMouseOut: (event) => {
        const target = event.target;
        
        if (urlHider.isLinkElement(target)) {
            console.log('链接悬停结束');
        }
    },

    /**
     * 处理鼠标移动事件
     */
    handleMouseMove: (event) => {
        const target = event.target;
        
        if (urlHider.isLinkElement(target)) {
            // 持续屏蔽URL显示
            urlHider.hideUrlForElement(target);
        }
    },

    /**
     * 处理右键菜单事件
     */
    handleContextMenu: (event) => {
        const target = event.target;
        
        if (urlHider.isLinkElement(target)) {
            console.log('检测到链接右键菜单，屏蔽URL显示');
            urlHider.hideUrlDisplay();
        }
    },

    /**
     * 处理链接点击事件
     */
    handleLinkClick: (event) => {
        const target = event.target.closest('a');
        
        if (target && urlHider.isLinkElement(target)) {
            console.log('检测到链接点击，屏蔽URL显示');
            urlHider.hideUrlDisplay();
        }
    },

    /**
     * 检查是否是链接元素
     */
    isLinkElement: (element) => {
        if (!element) return false;
        
        // 检查元素本身或父元素是否是链接
        const linkElement = element.closest('a, .nav-item, .dropdown-item, .favorite-chip, .suggestion-item') || element;
        
        // 检查是否是a标签且有href属性
        if (linkElement.tagName === 'A' && linkElement.href && linkElement.href !== '#') {
            return !linkElement.href.startsWith('javascript:');
        }
        
        // 检查是否是带有URL数据的div元素
        if (linkElement.dataset.url || linkElement.dataset.hideUrl === 'true') {
            return true;
        }
        
        // 检查是否是特定类名的元素
        return linkElement.classList.contains('nav-item') ||
               linkElement.classList.contains('dropdown-item') ||
               linkElement.classList.contains('favorite-chip') ||
               linkElement.classList.contains('suggestion-item');
    },

    /**
     * 为特定元素屏蔽URL显示
     */
    hideUrlForElement: (element) => {
        const linkElement = element.closest('a, .nav-item, .dropdown-item, .favorite-chip, .suggestion-item') || element;
        
        // 对于a标签，临时移除href属性
        if (linkElement.tagName === 'A' && linkElement.href && linkElement.href !== '#') {
            // 保存原始URL
            if (!linkElement.dataset.originalHref) {
                linkElement.dataset.originalHref = linkElement.href;
            }
            
            // 临时移除href属性
            linkElement.removeAttribute('href');
            
            // 【内存优化】使用timerManager统一管理定时器，避免内存泄漏
            // 【修复】为每个元素创建固定的唯一ID，避免同一元素多次调用时生成不同ID导致定时器无法清理
            let elementId = urlHider.elementTimerIds.get(linkElement);
            if (!elementId) {
                elementId = linkElement.id || 
                           linkElement.getAttribute('data-id') || 
                           `urlhider-${linkElement.tagName}-${Math.random().toString(36).slice(2, 11)}`;
                urlHider.elementTimerIds.set(linkElement, elementId);
            }
            timerManager.clearTimeout(`urlhider-${elementId}`);
            timerManager.setTimeout(`urlhider-${elementId}`, () => {
                if (linkElement.dataset.originalHref) {
                    linkElement.href = linkElement.dataset.originalHref;
                }
            }, 200);
        }
        
        // 对于div元素，由于没有href属性，不需要特殊处理
        // 但可以添加视觉反馈
        if (linkElement.classList.contains('nav-item') || 
            linkElement.classList.contains('dropdown-item') ||
            linkElement.classList.contains('favorite-chip') ||
            linkElement.classList.contains('suggestion-item')) {
            
            // 添加悬停效果，但不显示URL
            linkElement.style.cursor = 'pointer';
        }
    },

    /**
     * 屏蔽URL显示（已优化：避免重复添加事件监听器导致内存泄漏）
     */
    hideUrlDisplay: () => {
        // 现代浏览器已经不支持通过JavaScript修改状态栏
        // 使用更有效的方法：临时移除href属性，避免URL显示
        
        try {
            const links = document.querySelectorAll('a[data-hide-url="true"], .nav-item, .dropdown-item, .favorite-chip, .suggestion-item');
            
            // 【内存优化】只处理尚未处理过的链接，避免重复操作
            links.forEach(link => {
                // 临时移除href属性（不添加事件监听器，避免累积）
                if (link.tagName === 'A' && link.href && link.href !== '#') {
                    if (!link.dataset.originalHref) {
                        link.dataset.originalHref = link.href;
                    }
                    link.removeAttribute('href');
                }
            });
            
            // 使用timerManager统一管理定时器，避免内存泄漏
            timerManager.clearTimeout('urlHider-restore-href');
            timerManager.setTimeout('urlHider-restore-href', () => {
                links.forEach(link => {
                    if (link.dataset.originalHref) {
                        link.href = link.dataset.originalHref;
                        // 可选：清理data属性以减少内存占用
                        // delete link.dataset.originalHref;
                    }
                });
            }, 100);
            
        } catch (error) {
            console.log('URL屏蔽方法执行失败:', error);
        }
    },

    /**
     * 观察新添加的元素
     */
    observer: null, // 【内存优化】保存observer引用以便清理
    
    observeNewElements: () => {
        // 如果已存在observer，先断开连接（防止重复创建）
        if (urlHider.observer) {
            urlHider.observer.disconnect();
        }
        
        urlHider.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 为新添加的链接元素添加事件监听
                        const links = node.querySelectorAll('a');
                        links.forEach(link => {
                            if (urlHider.isLinkElement(link)) {
                                urlHider.addLinkEventListeners(link);
                            }
                        });
                        
                        // 如果节点本身是链接
                        if (urlHider.isLinkElement(node)) {
                            urlHider.addLinkEventListeners(node);
                        }
                    }
                });
            });
        });

        urlHider.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    },

    /**
     * 为链接元素添加事件监听器（已优化：避免重复添加导致内存泄漏）
     */
    addLinkEventListeners: (linkElement) => {
        // 【内存优化】检查是否已经为这个元素添加过监听器
        if (urlHider.trackedLinks.has(linkElement)) {
            return; // 已添加，跳过
        }
        
        // 创建事件处理函数
        const handlers = {
            mouseover: () => urlHider.hideUrlDisplay(),
            mouseout: () => urlHider.hideUrlDisplay(),
            mousemove: () => urlHider.hideUrlDisplay()
        };
        
        // 使用eventManager统一管理，避免内存泄漏
        const eventIds = [
            eventManager.add(linkElement, 'mouseover', handlers.mouseover),
            eventManager.add(linkElement, 'mouseout', handlers.mouseout),
            eventManager.add(linkElement, 'mousemove', handlers.mousemove)
        ];
        
        // 保存事件ID引用以便清理（存储在WeakMap中，元素被GC时自动清理）
        urlHider.linkEventHandlers.set(linkElement, eventIds);
        
        // 标记为已跟踪（WeakSet用于快速检查，Set用于遍历清理）
        urlHider.trackedLinks.add(linkElement);
        urlHider.trackedLinksSet.add(linkElement);
    },

    /**
     * 销毁URL屏蔽功能（已优化：完整清理所有资源）
     */
    destroy: () => {
        // 【内存优化】使用eventManager统一清理所有监听器
        urlHider.eventIds.forEach(id => {
            if (id) eventManager.remove(id);
        });
        urlHider.eventIds = [];
        
        // 【修复】清理所有链接元素的事件监听器
        // 使用trackedLinksSet遍历所有已跟踪的元素，清理其事件监听器
        urlHider.trackedLinksSet.forEach(linkElement => {
            const eventIds = urlHider.linkEventHandlers.get(linkElement);
            if (eventIds && Array.isArray(eventIds)) {
                eventIds.forEach(id => {
                    if (id) eventManager.remove(id);
                });
            }
        });
        
        // 重新初始化WeakMap和WeakSet
        urlHider.linkEventHandlers = new WeakMap();
        urlHider.trackedLinks = new WeakSet();
        urlHider.trackedLinksSet.clear();
        
        // 【内存优化】断开MutationObserver连接
        if (urlHider.observer) {
            urlHider.observer.disconnect();
            urlHider.observer = null;
        }
        
        // 清理定时器
        timerManager.clearTimeout('urlHider-restore-href');
        
        // 移除覆盖层
        const overlay = document.getElementById('url-hider-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
};
