// URL显示屏蔽功能模块
export const urlHider = {
    /**
     * 初始化URL屏蔽功能
     */
    init: () => {
        console.log('初始化URL屏蔽功能');
        urlHider.setupEventListeners();
        urlHider.observeNewElements();
    },

    /**
     * 设置事件监听器
     */
    setupEventListeners: () => {
        // 监听所有链接元素的鼠标事件
        document.addEventListener('mouseover', urlHider.handleMouseOver);
        document.addEventListener('mouseout', urlHider.handleMouseOut);
        document.addEventListener('mousemove', urlHider.handleMouseMove);
        
        // 监听右键菜单事件
        document.addEventListener('contextmenu', urlHider.handleContextMenu);
        
        // 监听链接点击事件
        document.addEventListener('click', urlHider.handleLinkClick);
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
            
            // 短暂延迟后恢复href属性
            setTimeout(() => {
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
     * 屏蔽URL显示
     */
    hideUrlDisplay: () => {
        // 现代浏览器已经不支持通过JavaScript修改状态栏
        // 使用更有效的方法：阻止默认的链接行为
        
        try {
            // 方法1: 阻止所有链接的默认行为
            const links = document.querySelectorAll('a[data-hide-url="true"], .nav-item, .dropdown-item, .favorite-chip, .suggestion-item');
            links.forEach(link => {
                // 添加事件监听器阻止默认行为
                link.addEventListener('mouseover', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
                
                link.addEventListener('mousemove', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });
            
            // 方法2: 使用CSS pointer-events 和 JavaScript 结合
            links.forEach(link => {
                // 临时移除href属性
                if (link.href && link.href !== '#') {
                    if (!link.dataset.originalHref) {
                        link.dataset.originalHref = link.href;
                    }
                    link.removeAttribute('href');
                }
            });
            
            // 短暂延迟后恢复href属性
            setTimeout(() => {
                links.forEach(link => {
                    if (link.dataset.originalHref) {
                        link.href = link.dataset.originalHref;
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
     * 为链接元素添加事件监听器
     */
    addLinkEventListeners: (linkElement) => {
        linkElement.addEventListener('mouseover', () => {
            urlHider.hideUrlDisplay();
        });
        
        linkElement.addEventListener('mouseout', () => {
            urlHider.hideUrlDisplay();
        });
        
        linkElement.addEventListener('mousemove', () => {
            urlHider.hideUrlDisplay();
        });
    },

    /**
     * 销毁URL屏蔽功能
     */
    destroy: () => {
        document.removeEventListener('mouseover', urlHider.handleMouseOver);
        document.removeEventListener('mouseout', urlHider.handleMouseOut);
        document.removeEventListener('mousemove', urlHider.handleMouseMove);
        document.removeEventListener('contextmenu', urlHider.handleContextMenu);
        document.removeEventListener('click', urlHider.handleLinkClick);
        
        // 【内存优化】断开MutationObserver连接
        if (urlHider.observer) {
            urlHider.observer.disconnect();
            urlHider.observer = null;
        }
        
        // 移除覆盖层
        const overlay = document.getElementById('url-hider-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
};
