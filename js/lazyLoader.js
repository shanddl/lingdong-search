// =================================================================
// 懒加载模块 - 优化图片和资源加载
// =================================================================

import { config } from './config.js';
import { logger } from './logger.js';

/**
 * 懒加载管理器类
 * 使用Intersection Observer API实现高性能的懒加载
 */
export class LazyLoader {
    constructor(options = {}) {
        // 【P1内存优化】Image对象池 - 复用Image对象，避免频繁创建
        this._imagePool = []; // Image对象池
        this._poolSize = 3; // 池大小限制（最多3个Image对象）
        this._poolIndex = 0; // 当前使用的池索引（循环使用）
        this.config = {
            rootMargin: options.rootMargin || config.performance.lazyLoad.rootMargin,
            threshold: options.threshold || config.performance.lazyLoad.threshold,
            loadingClass: options.loadingClass || 'lazy-loading',
            loadedClass: options.loadedClass || 'lazy-loaded',
            errorClass: options.errorClass || 'lazy-error'
        };
        
        this.observer = null;
        this.images = new Set();
        
        if (config.performance.lazyLoad.enabled) {
            this.init();
        }
    }
    
    /**
     * 初始化Intersection Observer
     */
    init() {
        if (!('IntersectionObserver' in window)) {
            logger.warn('[LazyLoader] 浏览器不支持IntersectionObserver，回退到原生loading="lazy"');
            return;
        }
        
        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            {
                rootMargin: this.config.rootMargin,
                threshold: this.config.threshold
            }
        );
        
        logger.debug('[LazyLoader] 初始化完成');
    }
    
    /**
     * 处理交叉观察
     */
    handleIntersection(entries) {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const element = entry.target;
                this.loadElement(element);
                this.observer.unobserve(element);
                this.images.delete(element);
            }
        });
    }
    
    /**
     * 加载元素
     */
    loadElement(element) {
        element.classList.add(this.config.loadingClass);
        
        if (element.tagName === 'IMG') {
            this.loadImage(element);
        } else if (element.dataset.bg) {
            this.loadBackground(element);
        } else if (element.dataset.src) {
            this.loadIframe(element);
        }
    }
    
    /**
     * 加载图片
     */
    loadImage(img) {
        const src = img.dataset.src;
        const srcset = img.dataset.srcset;
        
        if (!src && !srcset) {
            logger.warn('[LazyLoader] 图片缺少data-src或data-srcset', img);
            return;
        }
        
        // 【P1内存优化】从对象池获取或创建Image对象
        // 优先使用池中已有的对象，如果没有或池未满则创建新对象
        let tempImg = null;
        
        // 尝试从池中获取一个可用的Image对象（检查是否正在使用）
        for (let i = 0; i < this._imagePool.length; i++) {
            const poolImg = this._imagePool[i];
            // 简单检查：如果src为空或已完成加载，可以复用
            if (!poolImg.src || poolImg.complete) {
                tempImg = poolImg;
                // 清理旧状态
                tempImg.onload = null;
                tempImg.onerror = null;
                tempImg.src = '';
                tempImg.srcset = '';
                break;
            }
        }
        
        // 如果池中没有可用对象，创建新的
        if (!tempImg) {
            tempImg = new Image();
            // 如果池未满，加入池中以便后续复用
            if (this._imagePool.length < this._poolSize) {
                this._imagePool.push(tempImg);
            } else {
                // 池已满，替换最旧的（循环替换）
                const oldImg = this._imagePool[this._poolIndex];
                if (oldImg) {
                    oldImg.onload = null;
                    oldImg.onerror = null;
                    oldImg.src = '';
                }
                this._imagePool[this._poolIndex] = tempImg;
                this._poolIndex = (this._poolIndex + 1) % this._poolSize;
            }
        }
        
        // 【修复】保存当前处理的img引用，防止回调中的img引用错误
        const currentImg = img;
        const currentSrc = src;
        const currentSrcset = srcset;
        
        // 清理之前的事件监听器（防止累积）
        tempImg.onload = null;
        tempImg.onerror = null;
        tempImg.src = ''; // 中断前一个加载（如果有）
        tempImg.srcset = ''; // 清除srcset
        
        tempImg.onload = () => {
            // 加载成功 - 使用保存的引用，确保处理的是正确的图片
            if (!currentImg.isConnected) {
                // 图片元素已被移除，跳过处理
                return;
            }
            
            if (currentSrcset) currentImg.srcset = currentSrcset;
            if (currentSrc) currentImg.src = currentSrc;
            
            currentImg.classList.remove(this.config.loadingClass);
            currentImg.classList.add(this.config.loadedClass);
            
            // 清理临时图片的引用
            tempImg.onload = null;
            tempImg.onerror = null;
            
            logger.debug('[LazyLoader] 图片加载成功', currentSrc);
        };
        
        tempImg.onerror = () => {
            // 加载失败 - 使用保存的引用
            if (!currentImg.isConnected) {
                // 图片元素已被移除，跳过处理
                return;
            }
            
            currentImg.classList.remove(this.config.loadingClass);
            currentImg.classList.add(this.config.errorClass);
            
            // 设置错误占位图
            if (config.performance.lazyLoad.loadingPlaceholder) {
                currentImg.src = config.performance.lazyLoad.loadingPlaceholder;
            }
            
            // 清理临时图片的引用
            tempImg.onload = null;
            tempImg.onerror = null;
            
            logger.warn('[LazyLoader] 图片加载失败', currentSrc);
        };
        
        // 开始预加载
        if (currentSrcset) tempImg.srcset = currentSrcset;
        if (currentSrc) tempImg.src = currentSrc;
    }
    
    /**
     * 加载背景图（已优化：复用Image对象，避免频繁创建导致内存泄漏）
     */
    loadBackground(element) {
        const bgUrl = element.dataset.bg;
        
        if (!bgUrl) return;
        
        // 【P1内存优化】从对象池获取或创建Image对象（与loadImage相同的逻辑）
        let tempImg = null;
        
        // 尝试从池中获取一个可用的Image对象
        for (let i = 0; i < this._imagePool.length; i++) {
            const poolImg = this._imagePool[i];
            if (!poolImg.src || poolImg.complete) {
                tempImg = poolImg;
                tempImg.onload = null;
                tempImg.onerror = null;
                tempImg.src = '';
                break;
            }
        }
        
        // 如果池中没有可用对象，创建新的
        if (!tempImg) {
            tempImg = new Image();
            if (this._imagePool.length < this._poolSize) {
                this._imagePool.push(tempImg);
            } else {
                const oldImg = this._imagePool[this._poolIndex];
                if (oldImg) {
                    oldImg.onload = null;
                    oldImg.onerror = null;
                    oldImg.src = '';
                }
                this._imagePool[this._poolIndex] = tempImg;
                this._poolIndex = (this._poolIndex + 1) % this._poolSize;
            }
        }
        
        // 保存当前处理的element引用，防止回调中的引用错误
        const currentElement = element;
        const currentBgUrl = bgUrl;
        
        // 清理之前的事件监听器（防止累积）
        tempImg.onload = null;
        tempImg.onerror = null;
        tempImg.src = ''; // 中断前一个加载（如果有）
        
        tempImg.onload = () => {
            // 加载成功 - 使用保存的引用，确保处理的是正确的元素
            if (!currentElement.isConnected) {
                // 元素已被移除，跳过处理
                return;
            }
            
            currentElement.style.backgroundImage = `url('${currentBgUrl}')`;
            currentElement.classList.remove(this.config.loadingClass);
            currentElement.classList.add(this.config.loadedClass);
            
            // 清理临时图片的引用
            tempImg.onload = null;
            tempImg.onerror = null;
            
            logger.debug('[LazyLoader] 背景图加载成功', currentBgUrl);
        };
        
        tempImg.onerror = () => {
            // 加载失败 - 使用保存的引用
            if (!currentElement.isConnected) {
                // 元素已被移除，跳过处理
                return;
            }
            
            currentElement.classList.remove(this.config.loadingClass);
            currentElement.classList.add(this.config.errorClass);
            
            // 清理临时图片的引用
            tempImg.onload = null;
            tempImg.onerror = null;
            
            logger.warn('[LazyLoader] 背景图加载失败', currentBgUrl);
        };
        
        // 开始预加载
        tempImg.src = currentBgUrl;
    }
    
    /**
     * 加载iframe
     */
    loadIframe(iframe) {
        const src = iframe.dataset.src;
        
        if (!src) return;
        
        iframe.src = src;
        iframe.classList.remove(this.config.loadingClass);
        iframe.classList.add(this.config.loadedClass);
        
        logger.debug('[LazyLoader] iframe加载', src);
    }
    
    /**
     * 观察元素
     * @param {HTMLElement|NodeList|Array} elements - 要观察的元素
     */
    observe(elements) {
        if (!this.observer) {
            // 如果不支持IntersectionObserver，立即加载所有图片
            this.loadAll(elements);
            return;
        }
        
        const elementsArray = elements instanceof NodeList || Array.isArray(elements)
            ? Array.from(elements)
            : [elements];
        
        elementsArray.forEach((element) => {
            if (element && element.nodeType === 1) {
                this.images.add(element);
                this.observer.observe(element);
            }
        });
        
        logger.debug('[LazyLoader] 观察元素', elementsArray.length);
    }
    
    /**
     * 停止观察元素
     */
    unobserve(elements) {
        if (!this.observer) return;
        
        const elementsArray = elements instanceof NodeList || Array.isArray(elements)
            ? Array.from(elements)
            : [elements];
        
        elementsArray.forEach((element) => {
            if (element && element.nodeType === 1) {
                this.observer.unobserve(element);
                this.images.delete(element);
            }
        });
    }
    
    /**
     * 立即加载所有元素（回退方案）
     */
    loadAll(elements) {
        const elementsArray = elements instanceof NodeList || Array.isArray(elements)
            ? Array.from(elements)
            : [elements];
        
        elementsArray.forEach((element) => {
            if (element && element.nodeType === 1) {
                this.loadElement(element);
            }
        });
        
        logger.debug('[LazyLoader] 立即加载所有元素', elementsArray.length);
    }
    
    /**
     * 销毁懒加载器（已优化：完整清理所有资源）
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        // 【P1内存优化】清理Image对象池
        this._imagePool.forEach(img => {
            if (img) {
                img.onload = null;
                img.onerror = null;
                img.src = '';
            }
        });
        this._imagePool = [];
        this._poolIndex = 0;
        
        this.images.clear();
        logger.debug('[LazyLoader] 已销毁');
    }
}

/**
 * 全局懒加载器实例
 */
let globalLazyLoader = null;

// 【根本修复】页面加载时立即重置全局实例，确保每次刷新都是干净状态
if (typeof window !== 'undefined' && document.readyState === 'loading') {
    // 页面正在加载，清理旧的全局实例（如果存在）
    if (globalLazyLoader) {
        try {
            globalLazyLoader.destroy();
        } catch (e) {
            // 忽略错误，旧实例可能已经无效
        }
        globalLazyLoader = null;
        if (window.__cachedLazyLoader) {
            window.__cachedLazyLoader = null;
        }
    }
}

/**
 * 获取全局懒加载器（已优化：刷新页面时检测并清理旧实例）
 * @returns {LazyLoader}
 */
export function getLazyLoader() {
    // 【修复】如果已存在实例，检查是否需要清理（页面刷新时）
    if (globalLazyLoader) {
        // 检查observer是否已断开或容器已断开连接（可能页面已刷新）
        if (!globalLazyLoader.observer || 
            (globalLazyLoader.container && !globalLazyLoader.container.isConnected)) {
            // 旧实例已失效，清理并创建新实例
            try {
                globalLazyLoader.destroy();
            } catch (e) {
                logger.warn('[LazyLoader] 清理旧实例失败:', e);
            }
            globalLazyLoader = null;
        }
    }
    
    if (!globalLazyLoader) {
        globalLazyLoader = new LazyLoader();
        // 缓存引用，便于清理
        if (typeof window !== 'undefined') {
            window.__cachedLazyLoader = globalLazyLoader;
        }
    }
    return globalLazyLoader;
}

/**
 * 【新增】重置全局懒加载器（用于页面刷新时清理）
 */
export function resetLazyLoader() {
    if (globalLazyLoader) {
        try {
            globalLazyLoader.destroy();
        } catch (e) {
            logger.warn('[LazyLoader] 重置失败:', e);
        }
        globalLazyLoader = null;
        if (typeof window !== 'undefined') {
            window.__cachedLazyLoader = null;
        }
    }
}

/**
 * 便捷函数：为图片元素启用懒加载
 * @param {HTMLImageElement} img - 图片元素
 * @param {string} src - 图片URL
 * @param {string} srcset - srcset属性（可选）
 */
export function makeLazyImage(img, src, srcset = '') {
    if (!config.performance.lazyLoad.enabled) {
        // 懒加载未启用，直接设置src
        if (srcset) img.srcset = srcset;
        if (src) img.src = src;
        return;
    }
    
    // 设置data属性
    img.dataset.src = src;
    if (srcset) img.dataset.srcset = srcset;
    
    // 设置占位图
    if (!img.src && config.performance.lazyLoad.loadingPlaceholder) {
        img.src = config.performance.lazyLoad.loadingPlaceholder;
    }
    
    // 添加loading="lazy"作为后备
    img.loading = 'lazy';
    
    // 添加到懒加载器
    const loader = getLazyLoader();
    loader.observe(img);
}

/**
 * 便捷函数：批量创建懒加载图片
 * @param {Array} imageConfigs - 图片配置数组 [{element, src, srcset?}]
 */
export function makeLazyImages(imageConfigs) {
    const loader = getLazyLoader();
    const images = [];
    
    imageConfigs.forEach((config) => {
        const { element, src, srcset } = config;
        
        if (!element || !src) return;
        
        element.dataset.src = src;
        if (srcset) element.dataset.srcset = srcset;
        
        if (!element.src && config.performance.lazyLoad.loadingPlaceholder) {
            element.src = config.performance.lazyLoad.loadingPlaceholder;
        }
        
        element.loading = 'lazy';
        images.push(element);
    });
    
    loader.observe(images);
}

/**
 * 预加载关键资源
 * @param {Array<string>} urls - 资源URL数组
 * @param {string} type - 资源类型 ('image'|'script'|'style')
 * @returns {Promise<Array>} 加载完成的Promise数组
 */
export function preloadResources(urls, type = 'image') {
    const promises = urls.map((url) => {
        return new Promise((resolve, reject) => {
            if (type === 'image') {
                const img = new Image();
                img.onload = () => resolve(url);
                img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
                img.src = url;
            } else if (type === 'script') {
                const script = document.createElement('script');
                script.onload = () => resolve(url);
                script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
                script.src = url;
                document.head.appendChild(script);
            } else if (type === 'style') {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.onload = () => resolve(url);
                link.onerror = () => reject(new Error(`Failed to load style: ${url}`));
                link.href = url;
                document.head.appendChild(link);
            }
        });
    });
    
    return Promise.allSettled(promises);
}

