/**
 * 壁纸库面板模块
 * 负责壁纸库面板的打开、关闭和基本交互
 * 整合了wallpaper-standalone.js的核心功能
 */

import { logger } from '../logger.js';
import { timerManager } from '../utils/timerManager.js';

const log = logger.module('WallpaperLibraryPanel');

let wallpaperPanelInstance = null;

// 延迟加载IndexedDB存储管理器
let indexedDBStorage = null;

/**
 * 壁纸库面板类
 */
class WallpaperLibraryPanel {
    constructor() {
        this.panel = document.getElementById('wallpaperLibraryPanel');
        this.closeBtn = document.getElementById('wallpaper-close-btn');
        this.fullscreenView = document.getElementById('wallpaper-fullscreen-view');
        this.fullscreenImg = document.getElementById('wallpaper-fullscreen-img');
        this.setBgBtn = document.getElementById('wallpaper-set-bg-btn');
        this.downloadBtn = document.getElementById('wallpaper-download-btn');
        this.grid = document.getElementById('wallpaper-library-grid');
        this.navItems = document.querySelectorAll('.wallpaper-nav-item');
        this.subnav360 = document.getElementById('wallpaper-360-subnav');
        this.subnavBing = document.getElementById('wallpaper-bing-date-nav');
        this.searchInput = document.getElementById('wallpaper-360-search-input');
        this.searchBtn = document.getElementById('wallpaper-360-search-btn');
        this.uploadArea = document.getElementById('wallpaper-upload-area');
        this.uploadDropzone = document.getElementById('wallpaper-upload-dropzone');
        this.fileInput = document.getElementById('wallpaper-file-input');
        this.pagination = document.getElementById('wallpaper-pagination');
        this.pagePrevBtn = document.getElementById('wallpaper-page-prev');
        this.pageNextBtn = document.getElementById('wallpaper-page-next');
        this.pageCurrent = document.getElementById('wallpaper-page-current');
        this.pageTotal = document.getElementById('wallpaper-page-total');
        
        if (!this.panel) {
            log.error('壁纸库面板元素未找到');
            return;
        }
        
        // 初始化状态变量（来自wallpaper-standalone.js）
        this.activeSource = 'bing'; // 默认必应壁纸
        this.currentPage = 1;
        this.isLoading = false;
        this.qihu360ActiveCategoryId = '10'; // 默认分类ID '编辑推荐'
        this.bingDaysRange = 7; // 必应历史默认显示最近7天
        this.qihu360SearchKeyword = ''; // 360壁纸搜索关键词
        this.ITEMS_PER_PAGE = 24;
        this.MY_UPLOADS_KEY = 'my_uploaded_wallpapers';
        this.totalPages = 1; // 总页数
        this.totalItems = 0; // 总数量
        this._lastBingImages = null; // 【修复】初始化必应壁纸缓存，避免未定义错误
        
        // 图片懒加载优化
        this.imageObserver = null;
        this.loadingQueue = []; // 待加载队列
        this.loadingCount = 0; // 当前正在加载的图片数量
        this.maxParallelLoads = 10; // 【优化】最大并发加载数从6提升到10，加快加载速度
        this.imageCache = new Map(); // 图片缓存
        this.initImageLazyLoad(); // 初始化懒加载
        
        // 初始化IndexedDB存储管理器
        this.initStorage();
        
        // 初始化网格点击事件（委托）
        if (this.grid) {
            this.grid.addEventListener('click', (e) => {
                this.handleGridClick(e);
            });
        }

        // 分页功能将在updatePagination中动态绑定

        // 初始化360搜索功能
        if (this.searchBtn && this.searchInput) {
            this.searchBtn.addEventListener('click', () => this.handle360Search());
            this.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handle360Search();
                }
            });
            this.searchInput.addEventListener('input', (e) => {
                if (e.target.value.trim() === '') {
                    this.qihu360SearchKeyword = '';
                    this.currentPage = 1;
                    this.grid.innerHTML = '';
                    this.loadWallpapers(this.activeSource);
                }
            });
        }

        // 初始化必应日期导航
        if (this.subnavBing) {
            this.subnavBing.addEventListener('click', (e) => {
                const btn = e.target.closest('.wallpaper-subnav-btn');
                if (btn) {
                    this.subnavBing.querySelectorAll('.wallpaper-subnav-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.bingDaysRange = parseInt(btn.dataset.days) || 7;
                    this.currentPage = 1;
                    this.grid.innerHTML = '';
                    this.loadWallpapers('bing');
                }
            });
        }

        // 初始化文件上传功能
        if (this.uploadDropzone && this.fileInput) {
            // 点击上传区域打开文件选择器
            this.uploadDropzone.addEventListener('click', () => {
                this.fileInput.click();
            });

            // 文件选择
            this.fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    this.handleFileUpload(Array.from(e.target.files));
                    e.target.value = ''; // 重置input
                }
            });

            // 拖拽上传
            this.uploadDropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                this.uploadDropzone.classList.add('drag-over');
            });

            this.uploadDropzone.addEventListener('dragleave', () => {
                this.uploadDropzone.classList.remove('drag-over');
            });

            this.uploadDropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                this.uploadDropzone.classList.remove('drag-over');
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    this.handleFileUpload(Array.from(e.dataTransfer.files));
                }
            });
        }
        
        this.initEventListeners();
    }

    /**
     * 初始化图片懒加载（Intersection Observer）
     */
    initImageLazyLoad() {
        if (typeof IntersectionObserver === 'undefined') {
            log.warn('浏览器不支持IntersectionObserver，使用原生懒加载');
            return;
        }
        
        // 注意：由于禁用了滚动，当前页的所有图片都应该可见
        // 使用较大的rootMargin确保所有图片都能被检测到
        this.imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const item = entry.target.closest('.wallpaper-item');
                    
                    if (img && img.dataset.src && !img.src && !img.classList.contains('loading')) {
                        // 标记为加载中，避免重复加载
                        img.classList.add('loading');
                        
                        // 如果正在加载的图片数量未达到上限，立即加载
                        if (this.loadingCount < this.maxParallelLoads) {
                            this.loadImage(img, item);
                        } else {
                            // 否则加入队列
                            this.loadingQueue.push({ img, item });
                        }
                        
                        // 停止观察（已开始加载或加入队列）
                        this.imageObserver.unobserve(img);
                    }
                }
            });
        }, {
            root: null, // 使用viewport作为root
            rootMargin: '2000px 500px 2000px 500px', // 上下各2000px，左右各500px，确保所有图片都能被检测到
            threshold: [0, 0.01, 0.1, 0.5, 1.0] // 多个阈值，提高检测灵敏度
        });
        
        log.debug('图片懒加载Observer已初始化');
    }

    /**
     * 【优化】统一的URL有效性处理函数，避免代码重复
     * @param {string} thumbnailUrl - 缩略图URL
     * @param {string} fullUrl - 完整URL
     * @returns {string} 有效的URL（如果缩略图与完整URL相同，直接返回完整URL）
     */
    getEffectiveImageUrl(thumbnailUrl, fullUrl) {
        if (thumbnailUrl && thumbnailUrl === fullUrl) {
            // 如果缩略图和完整URL相同，直接使用完整URL
            return fullUrl;
        }
        return thumbnailUrl || fullUrl;
    }

    /**
     * 加载图片（带并发控制）
     */
    loadImage(img, item) {
        if (!img || !img.dataset.src) return;
        
        const src = img.dataset.src;
        
        // 【修复】快速检测：如果缩略图URL和完整URL相同，直接使用完整URL
        const fullUrl = item?.dataset.fullUrl || '';
        const thumbnailUrl = item?.dataset.thumbnailUrl || '';
        // 【优化】移除重复判断，简化逻辑
        if (thumbnailUrl && thumbnailUrl === fullUrl && src === thumbnailUrl) {
            log.debug(`ℹ️ 快速检测：缩略图URL与完整URL相同，直接使用完整URL`);
            // 直接设置完整URL，跳过网络加载尝试
            img.src = fullUrl;
            img.dataset.src = fullUrl;
            img.classList.remove('loading');
            img.classList.add('loaded');
            img.style.opacity = '1';
            img.style.display = 'block';
            img.style.visibility = 'visible';
            // 缓存URL
            if (fullUrl) {
                this.imageCache.set(fullUrl, fullUrl);
            }
            return;
        }
        
        // 如果已经有src且与data-src相同，说明已经加载过了，只需确保loaded类存在
        if (img.src && img.src === src) {
            if (!img.classList.contains('loaded')) {
                img.classList.add('loaded');
            }
            return;
        }
        
        // 如果正在加载中，跳过（避免重复加载）
        if (img.classList.contains('loading')) {
            return;
        }
        
        if (this.loadingCount >= this.maxParallelLoads) {
            this.loadingQueue.push({ img, item });
            log.debug(`图片加入队列，当前加载中: ${this.loadingCount}, 队列长度: ${this.loadingQueue.length}`);
            return;
        }
        
        // 检查缓存（检查URL是否在缓存中，而不是检查src）
        if (this.imageCache.has(src)) {
            // 直接从缓存设置，不占用并发数
            img.src = src;
            img.classList.remove('loading');
            img.classList.add('loaded');
            // 即使从缓存获取，也需要处理队列，因为可能还有其他图片在等待
            setTimeout(() => {
                this.processNextInQueue();
            }, 0);
            return;
        }
        
        // 标记为加载中
        img.classList.add('loading');
        this.loadingCount++;
        log.debug(`开始加载图片，当前加载中: ${this.loadingCount}, 队列长度: ${this.loadingQueue.length}`);
        
        const imageLoader = new Image();
        
        // 保存图片元素的引用，避免在回调中丢失
        const targetImg = img;
        const targetItem = item;
        
        // 【优化】设置加载超时（缩短到5秒，提升用户体验）
        const loadTimeout = setTimeout(() => {
            if (!imageLoader.complete) {
                log.warn(`图片加载超时（5秒）: ${src.substring(0, 50)}...`);
                imageLoader.onerror();
            }
        }, 5000);
        
        imageLoader.onload = () => {
            clearTimeout(loadTimeout);
            this.loadingCount--;
            
            // 确保目标元素仍然存在（只要元素在DOM中就设置）
            if (targetImg && targetImg.isConnected) {
                try {
                    // 直接设置src，触发浏览器加载（不管dataset.src是否匹配）
                    // 因为可能在某些情况下dataset.src已经被修改（比如失败后使用fullUrl）
                    targetImg.src = src;
                    targetImg.classList.remove('loading');
                    targetImg.classList.add('loaded');
                    
                    // 确保图片可见（多重保障）
                    targetImg.style.opacity = '1';
                    targetImg.style.display = 'block';
                    targetImg.style.visibility = 'visible';
                    
                    // 强制触发重绘
                    void targetImg.offsetHeight;
                    
                    // 验证是否成功设置
                    const index = targetItem?.dataset.index || targetImg.dataset.originalIndex || '?';
                    if (targetImg.src && targetImg.classList.contains('loaded')) {
                        log.debug(`✅ 图片加载成功 [索引: ${index}]: ${src.substring(0, 50)}...`);
                    } else {
                        log.warn(`⚠️ 图片加载成功但设置可能失败 [索引: ${index}], src=${!!targetImg.src}, loaded=${targetImg.classList.contains('loaded')}`);
                        // 强制重新设置
                        if (!targetImg.src) targetImg.src = src;
                        if (!targetImg.classList.contains('loaded')) {
                            targetImg.classList.add('loaded');
                            targetImg.style.opacity = '1';
                        }
                    }
                } catch (error) {
                    log.error(`❌ 设置图片显示时出错 [索引: ${targetItem?.dataset.index || '?'}]:`, error);
                }
            } else {
                log.warn(`⚠️ 图片加载成功但元素已失效: ${src.substring(0, 50)}...`);
            }
            
            // 缓存图片URL
            this.imageCache.set(src, src);
            
            // 处理队列中的下一个（使用setTimeout确保在当前执行完成后执行）
            setTimeout(() => {
                this.processNextInQueue();
            }, 0);
        };
        
        imageLoader.onerror = () => {
            clearTimeout(loadTimeout);
            this.loadingCount--;
            
            if (targetImg && targetImg.isConnected) {
                targetImg.classList.remove('loading');
                // 加载失败时，立即尝试使用完整URL作为备用
                const fullUrl = targetItem?.dataset.fullUrl;
                const thumbnailUrl = targetItem?.dataset.thumbnailUrl;
                
                // 如果失败的是缩略图，且有完整URL可用，立即使用完整URL
                if (fullUrl && fullUrl !== src && src === thumbnailUrl) {
                    const index = targetItem?.dataset.index || targetImg.dataset.originalIndex || '?';
                    log.warn(`🔴 缩略图加载失败 [索引 ${index}]，立即使用完整URL: ${fullUrl.substring(0, 50)}...`);
                    
                    // 立即使用完整URL，不再重试
                    targetImg.src = fullUrl;
                    targetImg.dataset.src = fullUrl;
                    targetImg.classList.remove('loading');
                    targetImg.classList.add('loaded');
                    targetImg.style.setProperty('opacity', '1', 'important');
                    targetImg.style.setProperty('display', 'block', 'important');
                    targetImg.style.setProperty('visibility', 'visible', 'important');
                    void targetImg.offsetHeight;
                    
                    // 缓存完整URL
                    this.imageCache.set(fullUrl, fullUrl);
                    log.debug(`✅ 缩略图失败后使用完整URL成功 [索引 ${index}]`);
                } else if (fullUrl && fullUrl !== src) {
                    // 如果完整URL也不同，尝试加载完整URL
                    log.warn(`图片加载失败，尝试使用完整URL: ${src.substring(0, 50)}... -> ${fullUrl.substring(0, 50)}...`);
                    // 立即重试，不延迟
                    if (targetImg && targetImg.isConnected && !targetImg.src) {
                        targetImg.src = fullUrl;
                        targetImg.dataset.src = fullUrl;
                        // 再次尝试加载
                        this.loadImage(targetImg, targetItem);
                    }
                } else {
                    log.warn(`图片加载失败且无备用URL: ${src.substring(0, 50)}...`);
                }
            }
            
            // 处理队列中的下一个（使用setTimeout确保在当前执行完成后执行）
            setTimeout(() => {
                this.processNextInQueue();
            }, 0);
        };
        
        imageLoader.src = src;
    }

    /**
     * 处理队列中的下一个图片
     */
    processNextInQueue() {
        // 循环处理队列，直到队列为空或达到并发上限
        let processed = 0;
        let skipped = 0;
        while (this.loadingQueue.length > 0 && this.loadingCount < this.maxParallelLoads) {
            const next = this.loadingQueue.shift();
            
            // 检查图片是否仍然有效且需要加载
            if (!next || !next.img || !next.img.dataset.src) {
                skipped++;
                continue;
            }
            
            // 如果图片已经有src或正在加载，跳过（可能已经被其他方式处理了）
            if (next.img.src || next.img.classList.contains('loading')) {
                skipped++;
                continue;
            }
            
            // 确保图片还在DOM中（避免已移除的图片）
            if (!next.img.isConnected) {
                skipped++;
                continue;
            }
            
            this.loadImage(next.img, next.item);
            processed++;
        }
        
        if (processed > 0 || skipped > 0) {
            log.debug(`从队列中处理了 ${processed} 张图片，跳过 ${skipped} 张，剩余队列: ${this.loadingQueue.length}, 当前加载中: ${this.loadingCount}`);
        }
        
        // 如果队列还有剩余且并发数未满，继续处理（可能是某些图片加载完成后的回调）
        // 使用 requestAnimationFrame 确保在下一帧继续处理，避免阻塞
        if (this.loadingQueue.length > 0 && this.loadingCount < this.maxParallelLoads) {
            requestAnimationFrame(() => {
                this.processNextInQueue();
            });
        }
    }

    /**
     * 初始化存储管理器
     */
    async initStorage() {
        try {
            // 尝试动态导入或使用全局实例
            if (typeof indexedDBStorage !== 'undefined') {
                // 已通过script标签加载
                await indexedDBStorage.init();
            } else {
                // 尝试ES模块导入
                const storageModule = await import('../utils/indexeddb-storage.js');
                indexedDBStorage = storageModule.default || storageModule.indexedDBStorage;
                if (indexedDBStorage && typeof indexedDBStorage.init === 'function') {
                    await indexedDBStorage.init();
                }
            }
        } catch (error) {
            log.warn('IndexedDB存储初始化失败，将使用localStorage降级:', error);
        }
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 关闭按钮
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => {
                this.closePanel();
            });
        }

        // 导航切换
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const source = e.currentTarget.dataset.source;
                this.switchSource(source);
            });
        });

        // 全屏预览相关
        if (this.fullscreenView && this.fullscreenImg) {
            // 点击背景或图片关闭预览
            this.fullscreenView.addEventListener('click', (e) => {
                if (!e.target.closest('.wallpaper-fullscreen-controls')) {
                    this.closeFullscreen();
                }
            });

            this.fullscreenImg.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeFullscreen();
            });
        }

        // 设为背景按钮
        if (this.setBgBtn) {
            this.setBgBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setAsBackground();
            });
        }

        // 下载按钮
        if (this.downloadBtn) {
            this.downloadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.downloadImage();
            });
        }

        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.panel.classList.contains('visible')) {
                if (this.fullscreenView && this.fullscreenView.classList.contains('visible')) {
                    this.closeFullscreen();
                } else {
                    this.closePanel();
                }
            }
        });
    }

    /**
     * 打开面板
     */
    openPanel() {
        if (!this.panel) return;
        
        log.debug('打开壁纸库面板');
        
        // 显示面板
        this.panel.style.display = 'flex';
        
        // 使用requestAnimationFrame确保样式应用后再添加visible类
        requestAnimationFrame(() => {
            this.panel.classList.add('visible');
        });

        // 加载默认壁纸源
        const activeNav = document.querySelector('.wallpaper-nav-item.active');
        if (activeNav) {
            const source = activeNav.dataset.source;
            this.loadWallpapers(source);
        }
    }

    /**
     * 关闭面板
     */
    closePanel() {
        if (!this.panel) return;
        
        log.debug('关闭壁纸库面板');
        
        this.panel.classList.remove('visible');
        
        // 延迟隐藏，等待过渡动画完成
        timerManager.setTimeout('wallpaper-panel-hide', () => {
            this.panel.style.display = 'none';
            // 关闭全屏预览（如果打开）
            if (this.fullscreenView) {
                this.closeFullscreen();
            }
        }, 300);
    }

    /**
     * 切换壁纸源
     */
    switchSource(source) {
        log.debug('切换壁纸源:', source);
        
        // 重置到第一页
        this.currentPage = 1;
        
        // 清空图片缓存和加载队列（切换源时）
        this.imageCache.clear();
        this.loadingQueue = [];
        this.loadingCount = 0;
        
        // 更新导航状态
        this.navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.source === source) {
                item.classList.add('active');
            }
        });

        // 隐藏所有子导航和上传区域
        if (this.subnav360) this.subnav360.style.display = 'none';
        if (this.subnavBing) this.subnavBing.style.display = 'none';
        if (this.uploadArea) this.uploadArea.style.display = 'none';

        // 根据源显示对应的子导航或上传区域
        if (source === 'qihu360' || source === 'official') {
            if (this.subnav360) {
                this.subnav360.style.display = 'flex';
                this.fetchAndDisplay360Categories();
            }
        } else if (source === 'bing') {
            if (this.subnavBing) {
                this.subnavBing.style.display = 'flex';
            }
        } else if (source === 'myuploads') {
            // 显示上传区域
            if (this.uploadArea) {
                this.uploadArea.style.display = 'block';
            }
        }

        // 加载壁纸
        this.loadWallpapers(source);
    }

    /**
     * 处理360搜索
     */
    handle360Search() {
        const keyword = this.searchInput ? this.searchInput.value.trim() : '';
        if (keyword) {
            if (keyword.length > 50) {
                alert('搜索关键词不能超过50个字符！');
                return;
            }
            this.qihu360SearchKeyword = keyword;
            log.debug('智能搜索360壁纸:', keyword);
            this.currentPage = 1;
            this.grid.innerHTML = '';
            this.loadWallpapers(this.activeSource);
        } else {
            this.qihu360SearchKeyword = '';
            this.currentPage = 1;
            this.grid.innerHTML = '';
            this.loadWallpapers(this.activeSource);
        }
    }

    /**
     * 获取并显示360分类
     */
    fetchAndDisplay360Categories() {
        if (!this.subnav360) return;

        if (typeof chrome === 'undefined' || !chrome.runtime) {
            log.warn('Chrome API不可用');
            return;
        }

        chrome.runtime.sendMessage(
            { action: 'fetch360Categories' },
            (response) => {
                if (chrome.runtime.lastError) {
                    log.warn('⚠️ 360分类获取失败:', chrome.runtime.lastError.message);
                    return;
                }
                
                if (response && response.success && response.data) {
                    const fragment = document.createDocumentFragment();
                    response.data.forEach(cat => {
                        const btn = document.createElement('button');
                        btn.className = 'wallpaper-subnav-btn';
                        btn.dataset.cid = cat.id;
                        btn.textContent = cat.name;
                        if (cat.id === this.qihu360ActiveCategoryId) {
                            btn.classList.add('active');
                        }
                        btn.addEventListener('click', () => {
                            this.subnav360.querySelectorAll('.wallpaper-subnav-btn').forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                            this.qihu360ActiveCategoryId = cat.id;
                            this.qihu360SearchKeyword = '';
                            if (this.searchInput) this.searchInput.value = '';
                            this.currentPage = 1;
                            this.grid.innerHTML = '';
                            this.loadWallpapers(this.activeSource);
                        });
                        fragment.appendChild(btn);
                    });
                    
                    // 保存搜索框
                    const searchBox = this.subnav360.querySelector('.wallpaper-search-box');
                    
                    // 清空并重新添加内容
                    this.subnav360.innerHTML = '';
                    this.subnav360.appendChild(fragment);
                    
                    // 重新添加搜索框
                    if (searchBox) {
                        this.subnav360.appendChild(searchBox);
                    }
                    
                    // 重新绑定搜索事件
                    this.searchBtn = document.getElementById('wallpaper-360-search-btn');
                    this.searchInput = document.getElementById('wallpaper-360-search-input');
                    if (this.searchBtn && this.searchInput) {
                        this.searchBtn.addEventListener('click', () => this.handle360Search());
                        this.searchInput.addEventListener('keypress', (e) => {
                            if (e.key === 'Enter') {
                                this.handle360Search();
                            }
                        });
                    }
                } else {
                    log.error('获取360壁纸分类失败:', response?.error);
                }
            }
        );
    }

    /**
     * 加载壁纸（分页模式，非无限滚动）
     */
    async loadWallpapers(source) {
        if (!this.grid) return;
        
        // 更新当前源
        this.activeSource = source;
        
        log.debug('加载壁纸:', source, '页码:', this.currentPage);
        
        if (this.isLoading) {
            log.debug('正在加载中，跳过');
            return;
        }
        
        this.isLoading = true;
        
        // 清空网格（不再显示加载中文字）
        this.grid.innerHTML = '';
        // 重置必应壁纸缓存（切换源或重置页码时）
        if (this.currentPage === 1) {
            this._lastBingImages = null;
        }

        try {
            let images = [];
            let isMyUploads = false;
            
            switch (source) {
                case 'bing':
                    images = await this.fetchBingHistory();
                    // 计算总页数（每天1张，最多加载到日期范围内的所有壁纸）
                    this.totalItems = this.bingDaysRange;
                    this.totalPages = Math.max(1, Math.ceil(this.totalItems / this.ITEMS_PER_PAGE));
                    break;
                case 'qihu360':
                case 'official': // 官方壁纸使用360壁纸
                    images = await this.fetch360Wallpapers();
                    // 360壁纸通常有很多页，假设至少有100页（可以根据实际情况调整）
                    // 如果没有返回数据，说明可能是最后一页
                    if (images.length === 0 && this.currentPage > 1) {
                        // 已经到最后一页了
                        this.currentPage--;
                        this.isLoading = false;
                        return;
                    }
                    // 360壁纸页数较多，动态显示更多页数（至少显示20页）
                    // 如果当前页小于10，显示到第20页；否则显示当前页+10页
                    this.totalPages = Math.max(20, this.currentPage + 10);
                    break;
                case 'myuploads':
                    images = await this.getMyUploadedImages();
                    isMyUploads = true;
                    // 我的上传不需要分页（显示所有）
                    this.totalItems = images.length;
                    this.totalPages = 1;
                    break;
                case 'solidcolor':
                    // 纯色壁纸需要特殊处理（支持分页）
                    await this.loadSolidColors();
                    // loadSolidColors中已经计算了totalPages，直接更新分页
                    this.updatePagination();
                    this.isLoading = false;
                    return;
                default:
                    log.warn('未知的壁纸源:', source);
                    this.grid.innerHTML = '<div style="padding: 40px; text-align: center; color: #a0a0a0;">未知的壁纸源</div>';
                    if (this.pagination) this.pagination.style.display = 'none';
                    this.isLoading = false;
                    return;
            }
            
            log.debug('获取到壁纸数量:', images.length);
            
            // 如果没有数据且不是第一页，回到上一页
            if (images.length === 0 && this.currentPage > 1) {
                this.currentPage--;
                this.grid.innerHTML = '<div style="padding: 40px; text-align: center; color: #a0a0a0;">没有更多壁纸了</div>';
                this.updatePagination();
                this.isLoading = false;
                return;
            }
            
            this.renderWallpapers(images, isMyUploads, false);
            this.updatePagination();
            
        } catch (error) {
            log.error(`加载 ${source} 壁纸失败:`, error);
            this.grid.innerHTML = '<div style="padding: 40px; text-align: center; color: #f5576c;">加载失败，请检查网络或稍后再试。</div>';
            if (this.pagination) this.pagination.style.display = 'none';
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * 更新分页控件（显示10个页码，超出用箭头）
     */
    updatePagination() {
        if (!this.pagination) return;
        
        // 我的上传不需要分页（显示所有）
        if (this.activeSource === 'myuploads') {
            this.pagination.style.display = 'none';
            return;
        }
        
        // 显示分页控件（包括纯色壁纸）
        this.pagination.style.display = 'flex';
        
        // 调试日志
        log.debug(`updatePagination: source=${this.activeSource}, currentPage=${this.currentPage}, totalPages=${this.totalPages}, totalItems=${this.totalItems}`);
        
        // 清空现有内容（除了左右箭头按钮）
        const prevBtn = this.pagePrevBtn;
        const nextBtn = this.pageNextBtn;
        const currentSpan = this.pageCurrent;
        const totalSpan = this.pageTotal;
        
        // 保存左右箭头
        this.pagination.innerHTML = '';
        
        const maxVisiblePages = 20; // 增加到20个页码
        let startPage = 1;
        let endPage = this.totalPages;
        
        // 计算显示的页面范围
        if (this.totalPages > maxVisiblePages) {
            const half = Math.floor(maxVisiblePages / 2);
            if (this.currentPage <= half) {
                startPage = 1;
                endPage = maxVisiblePages;
            } else if (this.currentPage >= this.totalPages - half) {
                startPage = this.totalPages - maxVisiblePages + 1;
                endPage = this.totalPages;
            } else {
                startPage = this.currentPage - half;
                endPage = this.currentPage + half;
            }
        }
        
        // 跳转到第一页按钮（双左箭头）
        const firstPageBtn = document.createElement('button');
        firstPageBtn.className = 'wallpaper-page-btn';
        firstPageBtn.id = 'wallpaper-page-first';
        firstPageBtn.disabled = this.currentPage <= 1;
        firstPageBtn.title = '第一页';
        firstPageBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6zM6 6h2v12H6z"/></svg>';
        firstPageBtn.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage = 1;
                this.grid.innerHTML = '';
                this.loadWallpapers(this.activeSource);
                // 【优化】已隐藏滚动条，无需重置scrollTop
            }
        });
        this.pagination.appendChild(firstPageBtn);
        
        // 左箭头（上一页）
        const leftArrow = document.createElement('button');
        leftArrow.className = 'wallpaper-page-btn';
        leftArrow.id = 'wallpaper-page-prev';
        leftArrow.disabled = this.currentPage <= 1;
        leftArrow.title = '上一页';
        leftArrow.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';
        leftArrow.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.grid.innerHTML = '';
                this.loadWallpapers(this.activeSource);
                // 【优化】已隐藏滚动条，无需重置scrollTop
            }
        });
        this.pagination.appendChild(leftArrow);
        this.pagePrevBtn = leftArrow;
        
        // 页码按钮
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = 'wallpaper-page-btn';
            pageBtn.style.cssText = 'min-width: 36px; padding: 0 12px;';
            if (i === this.currentPage) {
                pageBtn.style.background = '#8ab4f8';
                pageBtn.style.borderColor = '#8ab4f8';
                pageBtn.style.color = '#fff';
            }
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => {
                this.currentPage = i;
                this.grid.innerHTML = '';
                this.loadWallpapers(this.activeSource);
                // 【优化】已隐藏滚动条，无需重置scrollTop
            });
            this.pagination.appendChild(pageBtn);
        }
        
        // 页码信息
        const pageInfo = document.createElement('div');
        pageInfo.className = 'wallpaper-page-info';
        pageInfo.innerHTML = `
            <span id="wallpaper-page-current">${this.currentPage}</span>
            <span class="wallpaper-page-separator">/</span>
            <span id="wallpaper-page-total">${this.totalPages > 0 ? this.totalPages : '-'}</span>
        `;
        this.pagination.appendChild(pageInfo);
        this.pageCurrent = pageInfo.querySelector('#wallpaper-page-current');
        this.pageTotal = pageInfo.querySelector('#wallpaper-page-total');
        
        // 右箭头（下一页）
        const rightArrow = document.createElement('button');
        rightArrow.className = 'wallpaper-page-btn';
        rightArrow.id = 'wallpaper-page-next';
        if (this.activeSource === 'qihu360' || this.activeSource === 'official') {
            // 360壁纸可以继续尝试加载
            rightArrow.disabled = false;
        } else {
            rightArrow.disabled = this.currentPage >= this.totalPages;
        }
        rightArrow.title = '下一页';
        rightArrow.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';
        rightArrow.addEventListener('click', () => {
            if (this.activeSource === 'qihu360' || this.activeSource === 'official') {
                // 360壁纸可以继续尝试
                this.currentPage++;
                this.grid.innerHTML = '';
                this.loadWallpapers(this.activeSource);
                // 【优化】已隐藏滚动条，无需重置scrollTop
            } else if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.grid.innerHTML = '';
                this.loadWallpapers(this.activeSource);
                // 【优化】已隐藏滚动条，无需重置scrollTop
            }
        });
        this.pagination.appendChild(rightArrow);
        this.pageNextBtn = rightArrow;
        
        // 跳转到最后一页按钮（双右箭头）
        const lastPageBtn = document.createElement('button');
        lastPageBtn.className = 'wallpaper-page-btn';
        lastPageBtn.id = 'wallpaper-page-last';
        if (this.activeSource === 'qihu360' || this.activeSource === 'official') {
            // 360壁纸禁用跳转最后一页（因为不知道总页数）
            lastPageBtn.disabled = true;
        } else {
            lastPageBtn.disabled = this.currentPage >= this.totalPages;
        }
        lastPageBtn.title = '最后一页';
        lastPageBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6zM16 6h2v12h-2z"/></svg>';
        lastPageBtn.addEventListener('click', () => {
            if (this.currentPage < this.totalPages) {
                this.currentPage = this.totalPages;
                this.grid.innerHTML = '';
                this.loadWallpapers(this.activeSource);
                const contentMain = document.querySelector('.wallpaper-content-main');
                if (contentMain) contentMain.scrollTop = 0;
            }
        });
        this.pagination.appendChild(lastPageBtn);
    }

    /**
     * 获取必应历史壁纸（支持分页）
     */
    async fetchBingHistory() {
        log.debug(`开始获取必应历史壁纸（最近${this.bingDaysRange}天），页码: ${this.currentPage}...`);

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                log.error('⏱️ 获取必应壁纸超时（10秒）');
                resolve([]);
            }, 10000);
            
            try {
                if (typeof chrome === 'undefined' || !chrome.runtime) {
                    log.warn('Chrome API不可用');
                    clearTimeout(timeout);
                    resolve([]);
                    return;
                }
                
                // 计算需要加载的总数量（累积加载）
                const totalCount = this.currentPage * this.ITEMS_PER_PAGE;
                // 但不超过日期范围的最大数量（每天1张）
                const maxCount = Math.min(totalCount, this.bingDaysRange);
                
                chrome.runtime.sendMessage(
                    {
                        action: 'fetchBingHistory',
                        count: maxCount
                    },
                    (response) => {
                        clearTimeout(timeout);
                        
                        if (chrome.runtime.lastError) {
                            log.error('❌ Chrome运行时错误:', chrome.runtime.lastError);
                            resolve([]);
                            return;
                        }
                        
                        if (response && response.success) {
                            try {
                                const allImages = response.data.map(item => ({
                                    thumbnailUrl: item.thumbnail,
                                    fullUrl: item.url,
                                    info: item.title
                                }));
                                
                                // 分页模式：根据当前页码返回对应页的数据
                                const startIndex = (this.currentPage - 1) * this.ITEMS_PER_PAGE;
                                const endIndex = startIndex + this.ITEMS_PER_PAGE;
                                const pageImages = allImages.slice(startIndex, endIndex);
                                
                                log.debug(`获取到必应壁纸数量: ${pageImages.length} (页码: ${this.currentPage}, 范围: ${startIndex}-${endIndex}, 总数: ${allImages.length})`);
                                
                                // 缓存所有图片以便后续分页使用
                                this._lastBingImages = allImages;
                                resolve(pageImages);
                            } catch (error) {
                                log.error('❌ 处理必应壁纸数据失败:', error);
                                resolve([]);
                            }
                        } else {
                            log.error('获取必应历史壁纸失败:', response?.error);
                            resolve([]);
                        }
                    }
                );
            } catch (error) {
                clearTimeout(timeout);
                log.error('❌ 发送消息失败:', error);
                resolve([]);
            }
        });
    }

    /**
     * 获取360壁纸
     */
    async fetch360Wallpapers() {
        log.debug('开始获取360壁纸...', this.qihu360SearchKeyword ? `搜索: ${this.qihu360SearchKeyword}` : `分类: ${this.qihu360ActiveCategoryId}`);
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                log.error('⏱️ 获取360壁纸超时（10秒）');
                resolve([]);
            }, 10000);
            
            try {
                if (typeof chrome === 'undefined' || !chrome.runtime) {
                    log.warn('Chrome API不可用');
                    clearTimeout(timeout);
                    resolve([]);
                    return;
                }
                
                chrome.runtime.sendMessage(
                    {
                        action: 'fetch360Wallpapers',
                        categoryId: this.qihu360ActiveCategoryId,
                        page: this.currentPage,
                        count: this.ITEMS_PER_PAGE,
                        keyword: this.qihu360SearchKeyword
                    },
                    (response) => {
                        clearTimeout(timeout);
                        
                        if (chrome.runtime.lastError) {
                            log.error('❌ Chrome运行时错误:', chrome.runtime.lastError);
                            resolve([]);
                            return;
                        }
                        
                        if (response && response.success) {
                            try {
                                const images = response.data.map((item, index) => {
                                    const imageData = {
                                        thumbnailUrl: item.thumbnail,
                                        fullUrl: item.url,
                                        info: item.title
                                    };
                                    
                                    // 验证数据完整性
                                    if (!imageData.thumbnailUrl && !imageData.fullUrl) {
                                        log.warn(`⚠️ 360壁纸数据异常 [索引 ${index}]: 缺少URL`, item);
                                    } else if (!imageData.thumbnailUrl) {
                                        log.debug(`ℹ️ 360壁纸 [索引 ${index}]: 缺少缩略图，将使用完整URL`, item.url?.substring(0, 50));
                                        imageData.thumbnailUrl = imageData.fullUrl; // 使用完整URL作为缩略图
                                    }
                                    
                                    return imageData;
                                });
                                
                                // 验证所有图片数据
                                const validImages = images.filter(img => img.thumbnailUrl || img.fullUrl);
                                if (validImages.length !== images.length) {
                                    log.warn(`⚠️ 360壁纸数据过滤：${images.length} -> ${validImages.length}`);
                                }
                                
                                // 360壁纸API已经按page返回了对应页的数据，直接返回即可
                                log.debug(`获取到360壁纸数量: ${images.length} (页码: ${this.currentPage}), 有效: ${validImages.length}`);
                                resolve(validImages.length > 0 ? validImages : images); // 优先返回有效数据
                            } catch (error) {
                                log.error('❌ 处理360壁纸数据失败:', error);
                                resolve([]);
                            }
                        } else {
                            log.error('获取360壁纸失败:', response?.error);
                            resolve([]);
                        }
                    }
                );
            } catch (error) {
                clearTimeout(timeout);
                log.error('❌ 发送消息失败:', error);
                resolve([]);
            }
        });
    }

    /**
     * 获取我的上传
     */
    async getMyUploadedImages() {
        try {
            // 尝试使用IndexedDB（全局变量或导入的实例）
            const storage = typeof indexedDBStorage !== 'undefined' ? indexedDBStorage : 
                           (typeof window !== 'undefined' && window.indexedDBStorage) ? window.indexedDBStorage : null;
            
            if (storage && typeof storage.getItem === 'function') {
                const stored = await storage.getItem(this.MY_UPLOADS_KEY);
                if (stored) {
                    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
                    return Array.isArray(parsed) ? parsed : [];
                }
            }
            
            // 降级到localStorage
            const fallback = localStorage.getItem(this.MY_UPLOADS_KEY);
            return fallback ? JSON.parse(fallback) : [];
        } catch (error) {
            log.error('读取上传图片失败:', error);
            return [];
        }
    }

    /**
     * 加载纯色壁纸（支持分页）
     */
    async loadSolidColors() {
        try {
            const response = await fetch('data/wallpaper-colors.json');
            if (!response.ok) {
                throw new Error('Failed to load colors data');
            }
            const defaultColors = await response.json();
            
            // 先计算总页数（在分页计算之前）
            this.totalItems = defaultColors.length;
            this.totalPages = Math.max(1, Math.ceil(defaultColors.length / this.ITEMS_PER_PAGE));
            
            log.debug(`✅ 纯色壁纸：总数量=${this.totalItems}，每页${this.ITEMS_PER_PAGE}个，总页数=${this.totalPages}，当前页=${this.currentPage}`);
            
            // 计算分页范围
            const startIndex = (this.currentPage - 1) * this.ITEMS_PER_PAGE;
            const endIndex = startIndex + this.ITEMS_PER_PAGE;
            const pageColors = defaultColors.slice(startIndex, endIndex);
            
            this.grid.innerHTML = '';
            
            // 直接添加，不显示加载中
            pageColors.forEach((colorData) => {
                const item = document.createElement('div');
                item.className = 'wallpaper-item';
                item.dataset.color = colorData.color;
                item.dataset.type = 'solid-color';
                item.title = colorData.name || colorData.color;
                
                const isGradient = colorData.color.includes('gradient');
                const bgStyle = isGradient 
                    ? `background-image: ${colorData.color}; background-size: cover; background-position: center;` 
                    : `background-color: ${colorData.color}`;
                
                item.style.cssText = bgStyle + '; border-radius: 12px; width: 100%; height: 100%; display: block; cursor: pointer;';
                
                item.addEventListener('click', () => {
                    this.showSolidColorPreview(colorData.color, colorData.name || colorData.color);
                });
                
                this.grid.appendChild(item);
            });
            
            log.debug(`✅ 已加载 ${pageColors.length} 个颜色（第${this.currentPage}页，共${this.totalPages}页）`);
        } catch (error) {
            log.error('加载颜色数据失败:', error);
            this.grid.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">颜色数据加载失败，请刷新页面重试</div>';
            // 出错时也设置默认值
            this.totalItems = 0;
            this.totalPages = 1;
        }
    }

    // 【优化】已删除废弃的addSolidColorToGrid方法，功能已整合到loadSolidColors中

    /**
     * 显示纯色预览
     */
    showSolidColorPreview(color, colorName) {
        // 生成纯色图片
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        const isGradient = color.includes('gradient');
        if (isGradient) {
            // 解析渐变色
            const gradient = this.parseGradient(color);
            if (gradient) {
                const canvasGradient = this.createCanvasGradient(ctx, gradient, canvas.width, canvas.height);
                ctx.fillStyle = canvasGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else {
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        } else {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        const imageUrl = canvas.toDataURL('image/png');
        this.openFullscreen(imageUrl, { 
            filename: `${colorName || 'color'}.png`,
            color: color,
            colorName: colorName
        });
    }

    /**
     * 解析渐变字符串
     */
    parseGradient(gradientStr) {
        const match = gradientStr.match(/linear-gradient\(([^)]+)\)/);
        if (!match) return null;
        
        const parts = match[1].split(',').map(s => s.trim());
        const direction = parts[0];
        const colors = parts.slice(1);
        
        return { direction, colors };
    }

    /**
     * 在canvas上创建渐变
     */
    createCanvasGradient(ctx, gradient, width, height) {
        let x0 = 0, y0 = 0, x1 = width, y1 = height;
        
        // 解析方向
        if (gradient.direction.includes('135deg')) {
            x0 = 0; y0 = height; x1 = width; y1 = 0;
        } else if (gradient.direction.includes('to right')) {
            x0 = 0; y0 = 0; x1 = width; y1 = 0;
        } else if (gradient.direction.includes('to bottom')) {
            x0 = 0; y0 = 0; x1 = 0; y1 = height;
        }
        
        const canvasGradient = ctx.createLinearGradient(x0, y0, x1, y1);
        
        // 添加颜色停止点
        gradient.colors.forEach((colorStop, index) => {
            const parts = colorStop.trim().split(/\s+/);
            const color = parts[0];
            const position = parts[1] ? parseFloat(parts[1]) / 100 : (index / (gradient.colors.length - 1));
            
            canvasGradient.addColorStop(position !== null && !isNaN(position) ? position : index / (gradient.colors.length - 1), color);
        });
        
        return canvasGradient;
    }

    /**
     * 渲染壁纸网格
     */
    renderWallpapers(images, isMyUploads = false, append = false) {
        if (!images || images.length === 0) {
            if (!append) {
                this.grid.innerHTML = '<div style="padding: 40px; text-align: center; color: #a0a0a0;">未找到任何壁纸。</div>';
            }
            return;
        }
        
        // 如果不是追加模式，清空网格
        if (!append) {
            this.grid.innerHTML = '';
        }
        
        const fragment = document.createDocumentFragment();
        images.forEach((imgData, index) => {
            // 验证数据有效性
            if (!imgData) {
                log.error(`❌ 图片数据无效 [索引 ${index}]`);
                return;
            }
            
            const item = document.createElement('div');
            item.className = 'wallpaper-item';
            item.title = imgData.info || '点击查看原图';
            item.dataset.fullUrl = imgData.fullUrl || '';
            item.dataset.thumbnailUrl = imgData.thumbnailUrl || '';
            item.dataset.info = imgData.info || '';
            item.dataset.index = index; // 添加索引以便调试
            if (imgData.id) {
                item.dataset.imageId = imgData.id;
            }
            
            const imgElement = document.createElement('img');
            imgElement.alt = imgData.info || '';
            
            // 确定使用的图片URL（优先使用缩略图，如果没有则使用完整URL）
            // 但都保存完整URL和缩略图URL，以便失败时回退
            const thumbnailUrl = imgData.thumbnailUrl || '';
            const fullUrl = imgData.fullUrl || '';
            
            if (!fullUrl) {
                log.error(`❌ 图片 ${index + 1}/${images.length} 缺少完整URL，跳过渲染`);
                return; // 跳过无效数据
            }
            
            // 【优化】使用统一的URL处理函数
            const effectiveUrl = this.getEffectiveImageUrl(thumbnailUrl, fullUrl);
            if (thumbnailUrl && thumbnailUrl === fullUrl) {
                log.debug(`ℹ️ 图片 ${index + 1}: 缩略图URL与完整URL相同，直接使用完整URL`);
            }
            
            // 优先使用缩略图，但如果缩略图无效或与完整URL相同，直接使用完整URL
            // 由于已禁用滚动，当前页所有图片都可见，直接加载
            const imageUrl = effectiveUrl;
            imgElement.dataset.src = imageUrl; // 使用有效的URL（可能是缩略图或完整URL）
            // 设置一个占位背景色（避免闪烁）
            imgElement.style.backgroundColor = '#2a343f';
            imgElement.style.opacity = '0'; // 初始不可见
            
            // 记录图片URL用于调试
            imgElement.dataset.originalIndex = index;
            
            item.appendChild(imgElement);
            
            // 如果是"我的上传"，添加删除按钮
            if (isMyUploads && imgData.id) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'wallpaper-item-delete';
                deleteBtn.title = '删除图片';
                deleteBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                `;
                deleteBtn.dataset.imageId = imgData.id;
                deleteBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await this.deleteUploadedImage(imgData.id);
                });
                item.appendChild(deleteBtn);
            }
            
            fragment.appendChild(item);
        });
        
        // 使用requestAnimationFrame优化批量DOM操作
        requestAnimationFrame(() => {
            this.grid.appendChild(fragment);
            
            // 由于已禁用滚动，所有图片都可见，立即加载所有图片
            requestAnimationFrame(() => {
                const allItems = this.grid.querySelectorAll('.wallpaper-item');
                const newImages = this.grid.querySelectorAll('img[data-src]:not([src])');
                
                log.debug(`✅ 已添加 ${images.length} 个壁纸项到DOM，实际DOM中有 ${allItems.length} 个项，准备加载 ${newImages.length} 张图片`);
                
                // 验证所有图片项是否都在DOM中
                if (allItems.length !== images.length) {
                    log.warn(`⚠️ DOM项数量不匹配：期望 ${images.length}，实际 ${allItems.length}`);
                }
                
                // 立即强制检查所有图片的显示状态
                this.forceCheckAllImages();
                
                // 由于已禁用滚动，所有图片都在视口内，直接强制加载所有图片
                // 不使用Observer检测，直接调用loadImage处理所有图片
                const imagesToLoad = Array.from(newImages).filter(img => 
                    img.dataset.src && !img.src && !img.classList.contains('loading')
                );
                
                log.debug(`准备直接加载 ${imagesToLoad.length} 张图片（不使用Observer检测）`);
                
                // 【优化】记录每张图片的索引和URL，按优先级分类
                // 优先级：前两排（0-7）> 第三排（8-11）> 其他（12+）
                const imagesToLoadArray = Array.from(imagesToLoad);
                
                // 分离不同优先级的图片
                const firstTwoRows = []; // 前两排（0-7）- 最高优先级
                const thirdRowImages = []; // 第三排（8-11）- 高优先级
                const otherImages = []; // 其他（12+）- 普通优先级
                
                imagesToLoadArray.forEach((img, arrayIndex) => {
                    const item = img.closest('.wallpaper-item');
                    if (!item || !img) {
                        log.warn(`⚠️ 图片元素或容器无效 [数组索引 ${arrayIndex}]`);
                        return;
                    }
                    
                    const domIndex = item?.dataset.index !== undefined ? parseInt(item.dataset.index) : arrayIndex;
                    
                    if (domIndex >= 0 && domIndex <= 7) {
                        // 前两排（最高优先级）
                        firstTwoRows.push({img, item, domIndex, arrayIndex});
                    } else if (domIndex >= 8 && domIndex <= 11) {
                        // 第三排（高优先级）
                        thirdRowImages.push({img, item, domIndex, arrayIndex});
                    } else {
                        // 其他（普通优先级）
                        otherImages.push({img, item, domIndex, arrayIndex});
                    }
                });
                
                // 【优化】按优先级加载：先加载前两排，然后第三排，最后其他
                // 1. 最高优先级：前两排图片（立即加载，不等待）
                log.debug(`🟢 最高优先级：前两排图片，共 ${firstTwoRows.length} 张`);
                firstTwoRows.forEach(({img, item, domIndex, arrayIndex}) => {
                    const thumbnailUrl = item.dataset.thumbnailUrl || '';
                    const fullUrl = item.dataset.fullUrl || '';
                    
                    if (!fullUrl || fullUrl.trim() === '') {
                        log.error(`❌ 前两排图片 ${domIndex + 1} 缺少完整URL`);
                        return;
                    }
                    
                    // 【优化】使用统一的URL处理函数
                    const effectiveUrl = this.getEffectiveImageUrl(thumbnailUrl, fullUrl);
                    if (thumbnailUrl && thumbnailUrl === fullUrl) {
                        log.debug(`🟢 前两排 [索引 ${domIndex}]: 缩略图URL与完整URL相同，直接使用完整URL`);
                    }
                    
                    img.dataset.src = effectiveUrl;
                    
                    if (!img.isConnected || !item.isConnected) {
                        log.warn(`⚠️ 前两排图片 ${domIndex + 1} 不在DOM中`);
                        return;
                    }
                    
                    // 立即加载，最高优先级
                    try {
                        this.loadImage(img, item);
                        log.debug(`🟢✅ 已请求加载前两排图片 ${domIndex + 1}/${images.length}: ${effectiveUrl.substring(0, 50)}...`);
                    } catch (error) {
                        log.error(`❌ 加载前两排图片 ${domIndex + 1} 时出错:`, error);
                    }
                });
                
                // 2. 高优先级：第三排图片
                log.debug(`🔴 高优先级：第三排图片，共 ${thirdRowImages.length} 张`);
                thirdRowImages.forEach(({img, item, domIndex, arrayIndex}) => {
                    const thumbnailUrl = item.dataset.thumbnailUrl || '';
                    const fullUrl = item.dataset.fullUrl || '';
                    
                    if (!fullUrl || fullUrl.trim() === '') {
                        log.error(`❌ 第三排图片 ${domIndex + 1} 缺少完整URL`);
                        return;
                    }
                    
                    // 【优化】使用统一的URL处理函数
                    const effectiveUrl = this.getEffectiveImageUrl(thumbnailUrl, fullUrl);
                    if (thumbnailUrl && thumbnailUrl === fullUrl) {
                        log.debug(`🔴 第三排 [索引 ${domIndex}]: 缩略图URL与完整URL相同，直接使用完整URL`);
                    }
                    
                    img.dataset.src = effectiveUrl;
                    if (thumbnailUrl && thumbnailUrl !== fullUrl) {
                        log.debug(`🔴 第三排 [索引 ${domIndex}] 使用缩略图: ${effectiveUrl.substring(0, 50)}...`);
                    } else {
                        log.debug(`🔴 第三排 [索引 ${domIndex}] 直接使用完整URL: ${effectiveUrl.substring(0, 50)}...`);
                    }
                    
                    // 验证元素是否在DOM中
                    if (!img.isConnected || !item.isConnected) {
                        log.warn(`⚠️ 第三排图片 ${domIndex + 1} 不在DOM中`);
                        return;
                    }
                    
                    // 【优化】直接加载，不绕过并发限制（因为并发数已增加到10）
                    try {
                        this.loadImage(img, item);
                        log.debug(`🔴✅ 已请求加载第三排图片 ${domIndex + 1}/${images.length}: ${effectiveUrl.substring(0, 50)}...`);
                    } catch (error) {
                        log.error(`❌ 加载第三排图片 ${domIndex + 1} 时出错:`, error);
                    }
                });
                
                // 3. 普通优先级：其他图片（按顺序加载）
                log.debug(`⚪ 普通优先级：其他图片，共 ${otherImages.length} 张`);
                otherImages.forEach(({img, item, domIndex, arrayIndex}) => {
                    const thumbnailUrl = item.dataset.thumbnailUrl || '';
                    const fullUrl = item.dataset.fullUrl || '';
                    
                    // 【优化】使用统一的URL处理函数
                    const effectiveUrl = this.getEffectiveImageUrl(thumbnailUrl, fullUrl);
                    if (thumbnailUrl && thumbnailUrl === fullUrl) {
                        log.debug(`⚪ 其他图片 [索引 ${domIndex}]: 缩略图URL与完整URL相同，直接使用完整URL`);
                    }
                    
                    // 验证图片URL是否有效
                    if (!effectiveUrl || effectiveUrl.trim() === '') {
                        log.error(`❌ 图片 ${domIndex + 1}/${images.length} 完全没有可用URL，跳过`);
                        return;
                    }
                    
                    img.dataset.src = effectiveUrl;
                    
                    // 验证元素是否在DOM中
                    if (!img.isConnected || !item.isConnected) {
                        log.warn(`⚠️ 图片 ${domIndex + 1} 不在DOM中，跳过加载`);
                        return;
                    }
                    
                    // 直接调用loadImage，它会自动处理并发和队列
                    try {
                        this.loadImage(img, item);
                        log.debug(`✅ 已请求加载图片 ${domIndex + 1}/${images.length} (数组索引 ${arrayIndex}): ${(img.dataset.src || '').substring(0, 50)}...`);
                    } catch (error) {
                        log.error(`❌ 加载图片 ${domIndex + 1} 时出错:`, error);
                    }
                });
                
                // 作为备用，也添加到Observer（但主要依赖直接加载）
                if (this.imageObserver) {
                    imagesToLoad.forEach(img => {
                        this.imageObserver.observe(img);
                    });
                }
                
                log.debug(`当前加载中: ${this.loadingCount}, 队列中: ${this.loadingQueue.length}`);
                
                // 【优化】统一处理队列和检查，避免重复的延迟调用
                // 如果队列不为空，启动队列处理
                if (this.loadingQueue.length > 0) {
                    // 立即处理队列（如果并发数未满）
                    this.processNextInQueue();
                    
                    // 延迟处理队列（100ms后），作为备用
                    setTimeout(() => {
                        if (this.loadingQueue.length > 0 && this.loadingCount < this.maxParallelLoads) {
                            log.debug(`备用队列处理触发：队列长度=${this.loadingQueue.length}, 加载中=${this.loadingCount}`);
                            this.processNextInQueue();
                        }
                    }, 100);
                    
                    // 最终处理（500ms后），确保所有图片都能被处理
                    setTimeout(() => {
                        if (this.loadingQueue.length > 0 && this.loadingCount < this.maxParallelLoads) {
                            log.debug(`最终队列处理触发：队列长度=${this.loadingQueue.length}, 加载中=${this.loadingCount}`);
                            this.processNextInQueue();
                        }
                        
                        // 最终检查：确保所有图片都已加载
                        const finalCheck = this.grid.querySelectorAll('img[data-src]:not([src]):not(.loading)');
                        if (finalCheck.length > 0) {
                            log.warn(`⚠️ 最终检查：仍有 ${finalCheck.length} 张图片未加载，强制处理`);
                            finalCheck.forEach(img => {
                                const item = img.closest('.wallpaper-item');
                                if (item && img.dataset.src) {
                                    this.loadImage(img, item);
                                }
                            });
                        }
                        
                        // 最终检查：确保已加载的图片都显示
                        const finalVisibleCheck = this.grid.querySelectorAll('img[src]:not(.loaded)');
                        if (finalVisibleCheck.length > 0) {
                            log.warn(`⚠️ 最终检查：仍有 ${finalVisibleCheck.length} 张图片未显示，强制显示`);
                            finalVisibleCheck.forEach((img, idx) => {
                                const item = img.closest('.wallpaper-item');
                                const index = item?.dataset.index || img.dataset.originalIndex || idx;
                                try {
                                    img.classList.add('loaded');
                                    img.style.opacity = '1';
                                    img.style.display = 'block';
                                    img.style.visibility = 'visible';
                                    void img.offsetHeight; // 强制重绘
                                    log.debug(`✅ 强制显示图片 [索引: ${index}]`);
                                } catch (error) {
                                    log.error(`❌ 强制显示图片失败 [索引: ${index}]:`, error);
                                }
                            });
                        }
                        
                        // 专门检查第三排的状态（假设每排3列）
                        const allItems = Array.from(this.grid.querySelectorAll('.wallpaper-item'));
                        const thirdRowItems = allItems.filter((item, idx) => {
                            const index = parseInt(item.dataset.index) || idx;
                            return index >= 8 && index <= 11; // 第三排（第9-12张）
                        });
                        
                        log.debug(`🔍 第三排专项检查: 找到 ${thirdRowItems.length} 个项`);
                        thirdRowItems.forEach((item, idx) => {
                            const img = item.querySelector('img');
                            const index = parseInt(item.dataset.index) || (8 + idx);
                            const hasSrc = img && img.src && img.src !== '';
                            const hasLoaded = img && img.classList.contains('loaded');
                            const computedOpacity = img ? window.getComputedStyle(img).opacity : '?';
                            const display = img ? window.getComputedStyle(img).display : '?';
                            
                            log.debug(`  第三排 [索引 ${index}]: src=${hasSrc}, loaded=${hasLoaded}, opacity=${computedOpacity}, display=${display}`);
                            
                            // 如果第三排图片有问题，强制修复
                            if (img) {
                                if (!hasSrc && img.dataset.src) {
                                    log.warn(`    ⚠️ 第三排 [索引 ${index}] 未加载，强制加载`);
                                    this.loadImage(img, item);
                                }
                                if (hasSrc && !hasLoaded) {
                                    log.warn(`    ⚠️ 第三排 [索引 ${index}] 未显示，强制显示`);
                                    img.classList.add('loaded');
                                    img.style.opacity = '1';
                                    img.style.display = 'block';
                                    img.style.visibility = 'visible';
                                    void img.offsetHeight;
                                }
                            }
                        });
                        
                        // 最终统计和全面检查（整合forceCheckAllImages的功能）
                        this.forceCheckAllImages();
                        
                        const allLoaded = this.grid.querySelectorAll('img.loaded').length;
                        const allWithSrc = this.grid.querySelectorAll('img[src]').length;
                        const totalItems = this.grid.querySelectorAll('.wallpaper-item').length;
                        log.debug(`📊 最终统计: 总项=${totalItems}, 有src=${allWithSrc}, 已显示=${allLoaded}, 未显示=${allWithSrc - allLoaded}`);
                    }, 2000);
                } else {
                    // 【优化】如果队列为空，仍然进行一次检查（500ms后）
                    setTimeout(() => {
                        this.forceCheckAllImages();
                    }, 500);
                }
            });
        });
    }

    /**
     * 强制检查并修复所有图片的显示状态
     */
    forceCheckAllImages() {
        const allItems = Array.from(this.grid.querySelectorAll('.wallpaper-item'));
        log.debug(`🔍 强制检查所有图片，总数: ${allItems.length}`);
        
        let fixedCount = 0;
        let loadedCount = 0;
        let thirdRowFixed = 0;
        
        // 先处理第三排，再处理其他
        const thirdRowItems = [];
        const otherItems = [];
        
        // 【优化】使用统一的isThirdRow判断函数，避免重复定义
        allItems.forEach((item, idx) => {
            const index = parseInt(item.dataset.index) || idx;
            const isThirdRow = index >= 8 && index <= 11;
            if (isThirdRow) {
                thirdRowItems.push({item, index, idx});
            } else {
                otherItems.push({item, index, idx});
            }
        });
        
        // 优先处理第三排
        [...thirdRowItems, ...otherItems].forEach(({item, index, idx}) => {
            const img = item.querySelector('img');
            if (!img) return;
            
            // 【优化】使用统一的URL处理函数
            const thumbnailUrl = item.dataset.thumbnailUrl || '';
            const fullUrl = item.dataset.fullUrl || '';
            const dataSrc = img.dataset.src || this.getEffectiveImageUrl(thumbnailUrl, fullUrl) || '';
            const currentSrc = img.src || '';
            
            // 检查状态
            const needsLoad = dataSrc && !currentSrc && !img.classList.contains('loading');
            const needsDisplay = currentSrc && !img.classList.contains('loaded');
            
            // 第三排特殊标记（索引8-11）- 使用已计算的index判断
            const isThirdRow = index >= 8 && index <= 11;
            const label = isThirdRow ? `🔴第三排` : `   `;
            
            if (needsLoad && dataSrc) {
                log.warn(`${label} [索引 ${index}] 需要加载: ${dataSrc.substring(0, 50)}...`);
                // 确保URL正确
                if (img.dataset.src !== dataSrc) {
                    img.dataset.src = dataSrc;
                }
                // 对于第三排，即使并发已满也强制加载
                if (isThirdRow && this.loadingCount >= this.maxParallelLoads) {
                    log.warn(`${label} [索引 ${index}] 并发已满，但第三排图片强制加载`);
                    // 临时绕过并发限制
                    const originalMax = this.maxParallelLoads;
                    this.maxParallelLoads = this.loadingCount + 1;
                    this.loadImage(img, item);
                    setTimeout(() => {
                        this.maxParallelLoads = originalMax;
                    }, 100);
                } else {
                    this.loadImage(img, item);
                }
                fixedCount++;
                if (isThirdRow) thirdRowFixed++;
            }
            
            if (needsDisplay && currentSrc) {
                log.warn(`${label} [索引 ${index}] 需要显示: src已设置但无loaded类`);
                img.classList.remove('loading');
                img.classList.add('loaded');
                img.style.setProperty('opacity', '1', 'important');
                img.style.setProperty('display', 'block', 'important');
                img.style.setProperty('visibility', 'visible', 'important');
                void img.offsetHeight;
                fixedCount++;
                if (isThirdRow) thirdRowFixed++;
            }
            
            if (currentSrc && img.classList.contains('loaded')) {
                loadedCount++;
                if (isThirdRow) {
                    const computedOpacity = window.getComputedStyle(img).opacity;
                    log.debug(`${label} [索引 ${index}] ✅ 已加载并显示, opacity=${computedOpacity}`);
                }
            }
        });
        
        log.debug(`📊 强制检查完成: 修复=${fixedCount} (第三排=${thirdRowFixed}), 已加载=${loadedCount}/${allItems.length}`);
        
        // 如果第三排还有问题，立即再次检查
        if (thirdRowFixed > 0) {
            setTimeout(() => {
                log.debug(`🔴 第三排有修复，500ms后再次检查`);
                this.forceCheckAllImages();
            }, 500);
        } else if (fixedCount > 0) {
            setTimeout(() => {
                this.forceCheckAllImages();
            }, 1000);
        }
    }

    /**
     * 处理网格点击事件
     */
    handleGridClick(e) {
        const item = e.target.closest('.wallpaper-item');
        if (!item) return;
        
        e.preventDefault();
        
        // 检查是否是纯色
        if (item.dataset.type === 'solid-color') {
            const color = item.dataset.color;
            this.showSolidColorPreview(color, item.title);
            return;
        }
        
        // 普通壁纸
        const fullUrl = item.dataset.fullUrl || item.dataset.thumbnailUrl;
        const thumbnailUrl = item.dataset.thumbnailUrl;
        const info = item.dataset.info || '';
        
        if (fullUrl) {
            this.openFullscreen(fullUrl, { 
                filename: info || 'wallpaper.jpg',
                info: info,
                thumbnailUrl: thumbnailUrl
            });
        }
    }

    /**
     * 打开全屏预览
     */
    openFullscreen(imageUrl, imageInfo = {}) {
        if (!this.fullscreenView || !this.fullscreenImg) return;
        
        log.debug('打开全屏预览:', imageUrl);
        
        // 存储当前图片信息
        this.currentImageUrl = imageUrl;
        this.currentImageInfo = imageInfo;
        
        // 如果是纯色，直接显示
        if (imageInfo.color) {
            this.fullscreenImg.src = imageUrl;
            // 纯色下载文件名
            const colorName = imageInfo.colorName || 'color';
            const isGradient = imageInfo.color.includes('gradient');
            const downloadFilename = isGradient 
                ? `${colorName}.png`
                : `${colorName}_${imageInfo.color.replace('#', '') || 'color'}.png`;
            if (this.downloadBtn) {
                this.downloadBtn.href = imageUrl;
                this.downloadBtn.download = downloadFilename;
            }
            this.fullscreenView.classList.add('visible');
            return;
        }
        
        // 对于普通壁纸，先显示缩略图（如果可用）
        const thumbnailUrl = imageInfo.thumbnailUrl || imageUrl;
        this.fullscreenImg.src = thumbnailUrl;
        this.fullscreenImg.style.opacity = '0.5';
        this.fullscreenImg.style.filter = 'blur(5px)';
        
        // 显示全屏预览
        this.fullscreenView.classList.add('visible');
        
        // 异步加载原图
        if (imageUrl !== thumbnailUrl && imageUrl.startsWith('http')) {
            const fullImg = new Image();
            fullImg.onload = () => {
                this.fullscreenImg.src = imageUrl;
                this.fullscreenImg.style.opacity = '1';
                this.fullscreenImg.style.filter = 'none';
                this.fullscreenImg.style.transition = 'all 0.3s ease';
            };
            fullImg.onerror = () => {
                log.warn('原图加载失败，使用缩略图');
                this.fullscreenImg.style.opacity = '1';
                this.fullscreenImg.style.filter = 'none';
            };
            fullImg.src = imageUrl;
        } else {
            // 已经是完整URL或data URL，直接显示
            this.fullscreenImg.style.opacity = '1';
            this.fullscreenImg.style.filter = 'none';
        }
        
        // 设置下载链接（默认值，实际下载时会使用currentImageInfo）
        if (this.downloadBtn) {
            this.downloadBtn.href = imageUrl;
            this.downloadBtn.download = imageInfo.filename || 'wallpaper.jpg';
        }
        
        // 确保下载按钮有正确的文件名（从imageInfo中获取）
        if (this.downloadBtn && imageInfo.filename) {
            this.downloadBtn.download = imageInfo.filename;
        }
    }

    /**
     * 关闭全屏预览
     */
    closeFullscreen() {
        if (!this.fullscreenView) return;
        
        log.debug('关闭全屏预览');
        
        this.fullscreenView.classList.remove('visible');
        
        // 延迟清空src，让淡出效果更平滑
        timerManager.setTimeout('wallpaper-fullscreen-clear', () => {
            if (this.fullscreenImg) {
                this.fullscreenImg.src = '';
            }
            this.currentImageUrl = null;
            this.currentImageInfo = null;
        }, 300);
    }

    /**
     * 设为背景
     */
    async setAsBackground() {
        if (!this.currentImageUrl) return;
        
        log.debug('设为背景:', this.currentImageUrl);
        
        // 检查是否是纯色/渐变色
        if (this.currentImageInfo && this.currentImageInfo.color) {
            // 纯色或渐变色
            await this.applySolidColorBackground(this.currentImageInfo.color);
        } else {
            // 图片壁纸
            await this.setWallpaperAsBackground(this.currentImageUrl);
        }
        
        // 关闭全屏预览
        this.closeFullscreen();
    }

    /**
     * 应用纯色背景（使用与instantWallpaper.js相同的逻辑）
     * 【修复】确保首次安装扩展时设置壁纸也能立即生效
     */
    async applySolidColorBackground(color) {
        try {
            log.debug('应用纯色背景:', color);
            
            // 检查是否是渐变色
            const isGradient = color.includes('gradient');
            
            // 创建壁纸对象（使用solid-color:前缀标识纯色）
            const wallpaper = {
                url: `solid-color:${color}`,
                timestamp: Date.now(),
                source: 'wallpaper-library',
                color: color
            };
            
            // 保存到localStorage
            localStorage.setItem('currentWallpaper', JSON.stringify(wallpaper));
            localStorage.setItem('wallpaperLocked', 'true');
            
            // 【修复】使用与instantWallpaper.js完全相同的应用方式，确保首次安装时也能生效
            // 方案1：CSS注入（在body解析前就生效，确保优先级）
            const styleTag = document.createElement('style');
            if (isGradient) {
                // 渐变背景
                styleTag.textContent = `
                    body {
                        background-image: ${color} !important;
                        background-color: transparent !important;
                        background-size: cover !important;
                        background-position: center !important;
                        background-repeat: no-repeat !important;
                        background-attachment: fixed !important;
                    }
                `;
            } else {
                // 纯色背景
                styleTag.textContent = `
                    body {
                        background-image: none !important;
                        background-color: ${color} !important;
                        background-size: cover !important;
                        background-position: center !important;
                        background-repeat: no-repeat !important;
                        background-attachment: fixed !important;
                    }
                `;
            }
            document.head.appendChild(styleTag);
            
            // 方案2：DOM直接操作（body解析后立即覆盖，确保最高优先级）
            const applyBodyStyle = () => {
                if (document.body) {
                    if (isGradient) {
                        // 渐变背景
                        document.body.style.backgroundImage = color;
                        document.body.style.backgroundColor = '';
                    } else {
                        // 纯色背景
                        document.body.style.backgroundImage = 'none';
                        document.body.style.backgroundColor = color;
                    }
                    document.body.style.backgroundSize = 'cover';
                    document.body.style.backgroundPosition = 'center';
                    document.body.style.backgroundRepeat = 'no-repeat';
                    document.body.style.backgroundAttachment = 'fixed';
                }
            };
            
            // 【修复】立即尝试应用（可能body还未存在）
            applyBodyStyle();
            
            // 【修复】确保在body创建后也应用（首次安装时可能body还未完全加载）
            if (!document.body) {
                // 使用MutationObserver监听body的创建
                const observer = new MutationObserver(() => {
                    if (document.body) {
                        applyBodyStyle();
                        observer.disconnect();
                        log.debug('⚡ 纯色背景已应用（body就绪）:', color);
                    }
                });
                observer.observe(document.documentElement, { childList: true });
                
                // 设置超时断开observer，防止内存泄漏
                setTimeout(() => {
                    if (observer) observer.disconnect();
                }, 5000);
            } else {
                log.debug('⚡ 纯色背景已应用（立即）:', color);
            }
            
            // 同时隐藏CSS中的默认背景，避免闪烁
            const hideStyle = document.createElement('style');
            hideStyle.textContent = 'body::before { display: none !important; }';
            (document.head || document.documentElement).appendChild(hideStyle);
            
            // 显示成功提示
            this.showNotification('纯色背景已设为背景！', 'success');
            log.debug('纯色背景设置成功');
        } catch (error) {
            log.error('设置纯色背景失败:', error);
            this.showNotification('设置背景失败，请重试', 'error');
        }
    }

    /**
     * 设置图片壁纸为背景（使用与instantWallpaper.js相同的逻辑）
     * 【修复】确保首次安装扩展时设置壁纸也能立即生效
     */
    async setWallpaperAsBackground(imageUrl) {
        try {
            log.debug('设置图片壁纸为背景:', imageUrl);
            
            // 创建壁纸对象
            const wallpaper = {
                url: imageUrl,
                timestamp: Date.now(),
                source: 'wallpaper-library'
            };
            
            // 保存到localStorage
            localStorage.setItem('currentWallpaper', JSON.stringify(wallpaper));
            localStorage.setItem('wallpaperLocked', 'true');
            
            // 【修复】使用与instantWallpaper.js完全相同的应用方式，确保首次安装时也能生效
            // 方案1：CSS注入（在body解析前就生效，确保优先级）
            const styleTag = document.createElement('style');
            styleTag.textContent = `
                body {
                    background-image: url("${imageUrl}") !important;
                    background-size: cover !important;
                    background-position: center !important;
                    background-repeat: no-repeat !important;
                    background-attachment: fixed !important;
                }
            `;
            document.head.appendChild(styleTag);
            
            // 方案2：DOM直接操作（body解析后立即覆盖，确保最高优先级）
            const applyBodyStyle = () => {
                if (document.body) {
                    document.body.style.backgroundImage = `url("${imageUrl}")`;
                    document.body.style.backgroundColor = 'transparent';
                    document.body.style.backgroundSize = 'cover';
                    document.body.style.backgroundPosition = 'center';
                    document.body.style.backgroundRepeat = 'no-repeat';
                    document.body.style.backgroundAttachment = 'fixed';
                }
            };
            
            // 【修复】立即尝试应用（可能body还未存在）
            applyBodyStyle();
            
            // 【修复】确保在body创建后也应用（首次安装时可能body还未完全加载）
            if (!document.body) {
                // 使用MutationObserver监听body的创建
                const observer = new MutationObserver(() => {
                    if (document.body) {
                        applyBodyStyle();
                        observer.disconnect();
                        log.debug('⚡ 壁纸已应用（body就绪）:', imageUrl);
                    }
                });
                observer.observe(document.documentElement, { childList: true });
                
                // 设置超时断开observer，防止内存泄漏
                setTimeout(() => {
                    if (observer) observer.disconnect();
                }, 5000);
            } else {
                log.debug('⚡ 壁纸已应用（立即）:', imageUrl);
            }
            
            // 同时隐藏CSS中的默认背景，避免闪烁
            const hideStyle = document.createElement('style');
            hideStyle.textContent = 'body::before { display: none !important; }';
            (document.head || document.documentElement).appendChild(hideStyle);
            
            // 显示成功提示
            this.showNotification('壁纸已设为背景！', 'success');
            log.debug('壁纸设置成功');
        } catch (error) {
            log.error('设置壁纸失败:', error);
            this.showNotification('设置背景失败，请重试', 'error');
        }
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        const bgColor = type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3';
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            font-weight: 500;
            z-index: 20000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
            background: ${bgColor};
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // 显示动画
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        });
        
        // 3秒后自动移除
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * 处理文件上传（参照原版本的完整限制和验证）
     */
    async handleFileUpload(files) {
        if (!files || files.length === 0) return;

        // 【P0优化】上传前检查存储容量（优先使用IndexedDB）
        try {
            const storage = typeof indexedDBStorage !== 'undefined' ? indexedDBStorage : 
                           (typeof window !== 'undefined' && window.indexedDBStorage) ? window.indexedDBStorage : null;
            
            if (storage && typeof storage.getStorageEstimate === 'function') {
                const storageInfo = await storage.getStorageEstimate();
                
                if (storageInfo.supported) {
                    const percentage = parseFloat(storageInfo.percentage);
                    log.debug(`📊 IndexedDB存储空间: ${storageInfo.usage}MB / ${storageInfo.quota}MB (${percentage}%)`);
                    
                    if (percentage >= 95) {
                        alert(`⚠️ 存储空间严重不足！\n\n` +
                              `已使用：${storageInfo.usage}MB / ${storageInfo.quota}MB (${percentage}%)\n\n` +
                              `无法上传新图片，请先删除一些现有图片！`);
                        return;
                    } else if (percentage >= 85) {
                        const proceed = confirm(`⚠️ 存储空间紧张！\n\n` +
                                               `已使用：${storageInfo.usage}MB / ${storageInfo.quota}MB (${percentage}%)\n\n` +
                                               `是否继续上传？建议删除一些图片以释放空间。`);
                        if (!proceed) return;
                    }
                }
            }
        } catch (error) {
            log.warn('⚠️ 容量检查失败，继续上传:', error);
        }

        // 文件类型和大小验证
        const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const maxFileSize = 10 * 1024 * 1024; // 10MB（上传后自动压缩到1920×1080）
        const maxFileNameLength = 255;

        let successCount = 0;
        let failCount = 0;
        let totalFiles = files.length;
        let processedFiles = 0;

        // 【新增】创建进度提示元素
        const progressDiv = document.createElement('div');
        progressDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 20000;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            min-width: 250px;
        `;
        document.body.appendChild(progressDiv);

        const updateProgress = (current, total, status) => {
            progressDiv.innerHTML = `
                <div style="margin-bottom: 8px; font-weight: bold;">📤 上传进度</div>
                <div style="margin-bottom: 5px;">${status}</div>
                <div style="margin-bottom: 8px;">处理中: ${current} / ${total}</div>
                <div style="background: rgba(255,255,255,0.2); height: 6px; border-radius: 3px; overflow: hidden;">
                    <div style="background: #4CAF50; height: 100%; width: ${(current/total*100).toFixed(0)}%; transition: width 0.3s;"></div>
                </div>
            `;
        };

        for (const file of files) {
            processedFiles++;
            updateProgress(processedFiles, totalFiles, `正在处理: ${file.name}`);
            try {
                // 检查文件类型
                if (!validImageTypes.includes(file.type)) {
                    log.warn('跳过不支持的图片格式:', file.name, file.type);
                    alert(`文件 "${file.name}" 格式不支持！\n支持的格式：JPG、PNG、GIF、WebP`);
                    failCount++;
                    continue;
                }

                // 检查文件大小
                if (file.size > maxFileSize) {
                    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
                    alert(`图片 "${file.name}" 太大了！\n` +
                          `文件大小：${fileSizeMB}MB\n` +
                          `限制大小：10MB 以内\n\n` +
                          `提示：\n` +
                          `- 上传后会自动压缩到1920×1080分辨率\n` +
                          `- 压缩后实际占用约1-2MB存储空间\n` +
                          `- IndexedDB总容量50MB+，可存储大量图片\n` +
                          `- 建议：可使用 tinypng.com 预先压缩`);
                    failCount++;
                    continue;
                }

                // 检查文件名安全性
                if (!file.name || file.name.length > maxFileNameLength) {
                    log.warn('文件名无效:', file.name);
                    alert(`文件名 "${file.name}" 无效！\n文件名长度不能超过255个字符`);
                    failCount++;
                    continue;
                }

                // 【新增】验证文件内容是否真的是图片（通过文件头魔数）
                const isValidImage = await this.validateImageFile(file);
                if (!isValidImage) {
                    log.warn('文件内容验证失败，不是有效的图片文件:', file.name);
                    alert(`文件 "${file.name}" 不是有效的图片文件！\n可能是伪装的恶意文件，已拒绝上传。`);
                    failCount++;
                    continue;
                }

                // 【新增】自动压缩图片
                let fileToUpload = file;
                try {
                    log.debug(`🎨 正在压缩图片: ${file.name}...`);
                    fileToUpload = await this.compressImage(file, {
                        maxWidth: 1920,
                        maxHeight: 1080,
                        quality: 0.85,
                        outputFormat: 'image/jpeg'
                    });
                    log.debug(`✅ 压缩成功，继续上传`);
                } catch (compressError) {
                    log.warn('压缩失败，使用原始文件:', compressError);
                    // 压缩失败时使用原始文件
                    fileToUpload = file;
                }

                // 读取文件为Base64
                const base64 = await this.readFileAsBase64(fileToUpload);

                // 【新增】清理文件名
                const safeName = this.sanitizeFileName(file.name);
                if (!safeName) {
                    log.warn('文件名清理后无效:', file.name);
                    alert(`文件名 "${file.name}" 包含非法字符，无法上传！`);
                    failCount++;
                    continue;
                }

                // 创建图片对象
                const imageData = {
                    id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    thumbnailUrl: base64,
                    fullUrl: base64,
                    info: safeName, // 使用清理后的文件名
                    uploadTime: new Date().toISOString(),
                    fileSize: fileToUpload.size, // 使用压缩后的大小
                    originalSize: file.size, // 保存原始大小用于统计
                    compressed: fileToUpload !== file // 标记是否压缩
                };

                // 保存到IndexedDB
                if (await this.addUploadedImage(imageData)) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                log.error('处理图片失败:', file.name, error);
                failCount++;
            }
        }

        // 移除进度提示
        if (progressDiv.parentNode) {
            progressDiv.parentNode.removeChild(progressDiv);
        }

        // 显示结果
        if (successCount > 0) {
            this.showNotification(`成功上传 ${successCount} 张图片！`, 'success');
            // 重新加载我的上传
            this.grid.innerHTML = '';
            this.currentPage = 1;
            this.loadWallpapers('myuploads');
        }
        if (failCount > 0) {
            this.showNotification(`${failCount} 张图片上传失败`, 'error');
        }
    }

    /**
     * 添加新上传的图片
     */
    async addUploadedImage(imageData) {
        const images = await this.getMyUploadedImages();
        images.unshift(imageData); // 添加到数组开头
        
        // 保存到IndexedDB
        try {
            const storage = typeof indexedDBStorage !== 'undefined' ? indexedDBStorage : 
                           (typeof window !== 'undefined' && window.indexedDBStorage) ? window.indexedDBStorage : null;
            
            if (storage && typeof storage.setItem === 'function') {
                await storage.setItem(this.MY_UPLOADS_KEY, images);
                log.debug('✅ 保存成功（IndexedDB）');
                return true;
            } else {
                // 降级到localStorage
                localStorage.setItem(this.MY_UPLOADS_KEY, JSON.stringify(images));
                log.debug('✅ 保存成功（localStorage降级）');
                return true;
            }
        } catch (error) {
            log.error('保存失败:', error);
            return false;
        }
    }

    /**
     * 删除已上传的图片
     */
    async deleteUploadedImage(imageId) {
        if (!confirm('确定要删除这张图片吗？')) {
            return;
        }

        const images = await this.getMyUploadedImages();
        const filteredImages = images.filter(img => img.id !== imageId);

        // 保存到IndexedDB
        try {
            const storage = typeof indexedDBStorage !== 'undefined' ? indexedDBStorage : 
                           (typeof window !== 'undefined' && window.indexedDBStorage) ? window.indexedDBStorage : null;
            
            if (storage && typeof storage.setItem === 'function') {
                await storage.setItem(this.MY_UPLOADS_KEY, filteredImages);
            } else {
                // 降级到localStorage
                localStorage.setItem(this.MY_UPLOADS_KEY, JSON.stringify(filteredImages));
            }

            this.showNotification('图片删除成功！', 'success');
            
            // 重新加载我的上传页面
            this.grid.innerHTML = '';
            this.currentPage = 1;
            this.loadWallpapers('myuploads');
        } catch (error) {
            log.error('删除失败:', error);
            this.showNotification('删除失败，请重试', 'error');
        }
    }

    /**
     * 将文件读取为Base64
     */
    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * 安全的文件名验证
     */
    sanitizeFileName(fileName) {
        if (!fileName || typeof fileName !== 'string') {
            return null;
        }
        
        // 移除路径遍历字符
        fileName = fileName.replace(/\.\./g, '');
        fileName = fileName.replace(/[\/\\]/g, '');
        
        // 移除危险字符
        fileName = fileName.replace(/[<>:"|?*\x00-\x1f]/g, '');
        
        // 限制长度
        if (fileName.length > 255) {
            fileName = fileName.substring(0, 255);
        }
        
        // 检查是否只剩下空白
        if (fileName.trim().length === 0) {
            return null;
        }
        
        return fileName;
    }

    /**
     * 验证文件是否为真实图片（通过文件头魔数）
     */
    validateImageFile(file) {
        return new Promise((resolve) => {
            // 边界检查：文件太小则无效
            if (!file || file.size < 4) {
                log.warn('文件太小，无法验证文件头');
                resolve(false);
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const arr = new Uint8Array(e.target.result).subarray(0, 4);
                    let header = '';
                    for (let i = 0; i < arr.length; i++) {
                        header += arr[i].toString(16).padStart(2, '0');
                    }
                    
                    // 检查文件头魔数
                    const validHeaders = {
                        '89504e47': 'image/png',
                        'ffd8ffe0': 'image/jpeg',
                        'ffd8ffe1': 'image/jpeg',
                        'ffd8ffe2': 'image/jpeg',
                        'ffd8ffe3': 'image/jpeg',
                        'ffd8ffe8': 'image/jpeg',
                        '47494638': 'image/gif',
                        '52494646': 'image/webp' // RIFF (WebP)
                    };
                    
                    let isValid = false;
                    for (let validHeader in validHeaders) {
                        if (header.startsWith(validHeader)) {
                            isValid = true;
                            break;
                        }
                    }
                    
                    resolve(isValid);
                } catch (error) {
                    log.error('文件头验证出错:', error);
                    resolve(false);
                }
            };
            reader.onerror = () => {
                log.error('读取文件失败');
                resolve(false);
            };
            reader.readAsArrayBuffer(file.slice(0, 4));
        });
    }

    /**
     * 图片压缩函数（使用Canvas API）
     */
    async compressImage(file, options = {}) {
        const {
            maxWidth = 1920,      // 最大宽度
            maxHeight = 1080,     // 最大高度
            quality = 0.85,       // 压缩质量 (0-1)
            outputFormat = 'image/jpeg'  // 输出格式
        } = options;
        
        return new Promise((resolve, reject) => {
            log.debug(`📦 开始压缩图片: ${file.name}`);
            log.debug(`  - 原始大小: ${(file.size / 1024).toFixed(2)}KB`);
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        // 计算缩放比例
                        let width = img.width;
                        let height = img.height;
                        
                        log.debug(`  - 原始尺寸: ${width}x${height}`);
                        
                        // 如果图片超过最大尺寸，按比例缩放
                        if (width > maxWidth || height > maxHeight) {
                            const ratio = Math.min(maxWidth / width, maxHeight / height);
                            width = Math.floor(width * ratio);
                            height = Math.floor(height * ratio);
                            log.debug(`  - 缩放后尺寸: ${width}x${height} (缩放比例: ${(ratio * 100).toFixed(1)}%)`);
                        } else {
                            log.debug(`  - 尺寸未超限，无需缩放`);
                        }
                        
                        // 创建Canvas并绘制图片
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        
                        // 使用高质量绘制
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // 转换为Blob
                        canvas.toBlob(
                            (blob) => {
                                if (!blob) {
                                    reject(new Error('压缩失败：无法生成Blob'));
                                    return;
                                }
                                
                                const compressedSize = blob.size;
                                const compressionRatio = ((1 - compressedSize / file.size) * 100).toFixed(1);
                                
                                log.debug(`✅ 压缩完成: ${file.name}`);
                                log.debug(`  - 压缩后大小: ${(compressedSize / 1024).toFixed(2)}KB`);
                                log.debug(`  - 压缩率: ${compressionRatio}%`);
                                log.debug(`  - 节省空间: ${((file.size - compressedSize) / 1024).toFixed(2)}KB`);
                                
                                // 创建新的File对象
                                const compressedFile = new File(
                                    [blob], 
                                    file.name.replace(/\.[^.]+$/, '.jpg'), // 统一为.jpg
                                    { type: outputFormat }
                                );
                                
                                resolve(compressedFile);
                            },
                            outputFormat,
                            quality
                        );
                    } catch (error) {
                        log.error('Canvas处理失败:', error);
                        reject(error);
                    }
                };
                img.onerror = () => {
                    reject(new Error('图片加载失败'));
                };
                img.src = e.target.result;
            };
            reader.onerror = () => {
                reject(new Error('文件读取失败'));
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * 下载图片
     */
    downloadImage() {
        if (!this.currentImageUrl) return;

        try {
            log.debug('开始下载图片:', this.currentImageUrl);
            const filename = this.currentImageInfo?.filename || `wallpaper_${Date.now()}.jpg`;

            // 如果是data URL（纯色或已上传的图片），直接下载
            if (this.currentImageUrl.startsWith('data:')) {
                const link = document.createElement('a');
                link.href = this.currentImageUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                this.showNotification('图片下载已开始！', 'success');
                return;
            }

            // 对于远程URL，使用fetch获取然后下载
            fetch(this.currentImageUrl)
                .then(response => response.blob())
                .then(blob => {
                    const blobUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(blobUrl);
                    this.showNotification('图片下载已开始！', 'success');
                })
                .catch(error => {
                    log.error('获取图片数据失败:', error);
                    // 如果fetch失败，回退到直接链接方式
                    const link = document.createElement('a');
                    link.href = this.currentImageUrl;
                    link.download = filename;
                    link.target = '_blank';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    this.showNotification('图片下载已开始！', 'success');
                });
        } catch (error) {
            log.error('图片下载失败:', error);
            this.showNotification('下载失败，请重试', 'error');
        }
    }

}

/**
 * 初始化壁纸库面板
 */
export function initWallpaperLibraryPanel() {
    if (!wallpaperPanelInstance) {
        wallpaperPanelInstance = new WallpaperLibraryPanel();
    }
    return wallpaperPanelInstance;
}

/**
 * 打开壁纸库面板（懒初始化）
 */
export function openWallpaperLibraryPanel() {
    // 懒初始化：如果实例不存在，先创建
    if (!wallpaperPanelInstance) {
        initWallpaperLibraryPanel();
    }
    
    if (wallpaperPanelInstance) {
        wallpaperPanelInstance.openPanel();
    }
}

