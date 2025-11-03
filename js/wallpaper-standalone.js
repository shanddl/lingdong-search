// 壁纸库脚本
// 【P0内存优化】动态导入LRU缓存工具（兼容非模块环境）
let LRUCache;
(async () => {
    try {
        const module = await import('./utils/lruCache.js');
        LRUCache = module.LRUCache;
    } catch (error) {
        console.error('⚠️ 无法加载LRU缓存模块:', error);
        // 降级：使用原生Map（但不具备LRU功能）
        LRUCache = class {
            constructor(maxSize, onEvict) {
                this.maxSize = maxSize;
                this.cache = new Map();
                this.onEvict = onEvict;
            }
            get(key) { return this.cache.get(key); }
            set(key, value) {
                if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
                    const firstKey = this.cache.keys().next().value;
                    if (this.onEvict) {
                        try { this.onEvict(firstKey, this.cache.get(firstKey)); } catch (e) {}
                    }
                    this.cache.delete(firstKey);
                }
                this.cache.set(key, value);
            }
            has(key) { return this.cache.has(key); }
            delete(key) { return this.cache.delete(key); }
            clear() { this.cache.clear(); }
            get size() { return this.cache.size; }
            keys() { return this.cache.keys(); }
            evict(count) {
                let deleted = 0;
                const entries = Array.from(this.cache.entries());
                for (let i = 0; i < Math.min(count, entries.length); i++) {
                    const [key, value] = entries[i];
                    if (this.onEvict) {
                        try { this.onEvict(key, value); } catch (e) {}
                    }
                    this.cache.delete(key);
                    deleted++;
                }
                return deleted;
            }
        };
    }
})();

document.addEventListener('DOMContentLoaded', () => {

    // ==================
    // 全局配置和变量
    // ==================
    const ITEMS_PER_PAGE = 24;

    let activeSource = 'qihu360'; // 默认360壁纸（国内最快）
    let currentPage = 1;
    let isLoading = false;
    let qihu360ActiveCategoryId = '10'; // 默认分类ID '编辑推荐'
    let bingDaysRange = 7; // 必应历史默认显示最近7天
    let qihu360SearchKeyword = ''; // 360壁纸搜索关键词

    // 本地存储键名
    const MY_UPLOADS_KEY = 'my_uploaded_wallpapers';
    
    // 【P0内存优化】Blob URL安全释放函数（需要在缓存定义前声明）
    function safeBlobRevoke(url) {
        if (url && typeof url === 'string' && url.startsWith('blob:') && blobUrlTracker.has(url)) {
            try {
                URL.revokeObjectURL(url);
                blobUrlTracker.delete(url);
                console.log('🗑️ Blob URL已释放:', url.substring(0, 50) + '...');
            } catch (error) {
                console.warn('⚠️ Blob URL释放失败:', error);
            }
        }
    }
    
    // 【P0优化】Blob URL跟踪器 - 防止内存泄漏
    const blobUrlTracker = new Set();
    
    // 【修复】等待LRUCache加载完成后再初始化缓存
    // Canvas缓存对象 - 使用LRU缓存，最多缓存50个颜色
    let canvasCache;
    let thumbnailCache;
    
    // 初始化缓存的函数
    function initCaches() {
        if (!LRUCache) {
            console.warn('⚠️ LRUCache未加载，使用原生Map降级');
            canvasCache = new Map();
            thumbnailCache = new Map();
            return;
        }
        
        canvasCache = new LRUCache(50);
        
        // 【P0内存优化】缩略图压缩缓存 - 使用LRU缓存，最多缓存200个
        // onEvict回调：当缓存项被淘汰时，自动清理Blob URL
        thumbnailCache = new LRUCache(
            200,
            (key, value) => {
                // 如果被淘汰的值是Blob URL，自动释放
                if (value && typeof value === 'string' && value.startsWith('blob:')) {
                    safeBlobRevoke(value);
                }
            }
        );
    }
    
    // 延迟初始化（等待LRUCache加载）
    if (LRUCache) {
        initCaches();
    } else {
        // 如果LRUCache还在加载，等待一小段时间后重试
        setTimeout(() => {
            if (!canvasCache) {
                initCaches();
            }
        }, 100);
    }
    
    // 保留常量用于兼容旧代码
    const MAX_CACHE_SIZE = 50;
    const MAX_THUMBNAIL_CACHE = 200;
    const THUMBNAIL_MAX_WIDTH = 400; // 缩略图最大宽度
    const THUMBNAIL_MAX_HEIGHT = 250; // 缩略图最大高度
    const THUMBNAIL_QUALITY = 0.75; // 缩略图质量（JPEG）
    
    
    // 【P0优化】批量释放Blob URLs
    function batchRevokeBlobUrls() {
        let count = 0;
        blobUrlTracker.forEach(url => {
            try {
                URL.revokeObjectURL(url);
                count++;
            } catch (error) {
                console.warn('⚠️ Blob URL释放失败:', error);
            }
        });
        blobUrlTracker.clear();
        if (count > 0) {
            console.log(`🗑️ 批量释放了 ${count} 个Blob URLs`);
        }
    }
    
    // 【新增】虚拟滚动配置（极致优化）
    const VIRTUAL_SCROLL_ENABLED = true; // 是否启用虚拟滚动
    const VISIBLE_ITEMS_BUFFER = 10; // 可见区域缓冲数量（上下各10个）
    const PRELOAD_MARGIN = '1000px'; // 提前加载距离 - 提升到1000px（极致）
    const LOAD_THRESHOLD = 0.01; // 交叉阈值（越小越早触发）
    const MAX_PARALLEL_LOADS = 12; // 最大并行加载数量 - 提升到12张
    const PRELOAD_NEXT_PAGE_DISTANCE = 800; // 提前预加载下一页的距离（距底部800px）
    let allWallpapers = []; // 所有壁纸数据
    let virtualScrollObserver = null; // IntersectionObserver实例
    let imageLoadQueue = []; // 图片加载队列
    let isProcessingQueue = false; // 是否正在处理队列
    let loadingPaused = false; // 页面隐藏时暂停加载
    let lastScrollY = 0; // 上次滚动位置
    let scrollDirection = 'down'; // 滚动方向
    let activeLoads = 0; // 当前活跃的加载数量
    let preloadCache = new Set(); // 预加载缓存，避免重复加载
    let fullImageCache = new Map(); // 原图缓存（用于lightbox）
    
    // ==================
    // 【P0优化】内存监控系统
    // ==================
    const memoryMonitor = {
        intervalId: null,
        paused: false,
        // 检查内存使用情况
        checkMemory: function() {
            if (performance.memory) {
                const used = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
                const total = (performance.memory.totalJSHeapSize / 1048576).toFixed(2);
                const limit = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2);
                const percentage = ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(1);
                
                return {
                    used: used,
                    total: total,
                    limit: limit,
                    percentage: percentage,
                    status: percentage > 90 ? 'critical' : percentage > 70 ? 'warning' : 'ok'
                };
            }
            return null;
        },
        
        // 获取缓存统计
        getCacheStats: function() {
            // 【修复】确保缓存已初始化
            if (!canvasCache || !thumbnailCache) {
                initCaches();
            }
            return {
                canvasCache: canvasCache ? canvasCache.size : 0,
                thumbnailCache: thumbnailCache ? thumbnailCache.size : 0,
                fullImageCache: fullImageCache.size,
                preloadCache: preloadCache.size,
                blobUrlTracker: blobUrlTracker.size,
                totalCacheItems: (canvasCache ? canvasCache.size : 0) + (thumbnailCache ? thumbnailCache.size : 0) + fullImageCache.size + preloadCache.size
            };
        },
        
        // 清理缓存
        cleanupCache: function(aggressive = false) {
            let cleaned = 0;
            
            // 【修复】确保缓存已初始化后再清理
            if (!canvasCache || !thumbnailCache) {
                initCaches();
            }
            
            // 【修复】逻辑运算符优先级修复：使用括号确保正确判断
            // 【P0内存优化】LRU缓存清理：使用evict方法批量清理
            if (canvasCache && (canvasCache.size > MAX_CACHE_SIZE * 0.5 || aggressive)) {
                const toEvict = Math.floor(canvasCache.size * (aggressive ? 0.8 : 0.5));
                cleaned += canvasCache.evict ? canvasCache.evict(toEvict) : 0;
            }
            
            // 清理缩略图缓存（LRU会自动调用onEvict清理Blob URL）
            if (thumbnailCache && (thumbnailCache.size > MAX_THUMBNAIL_CACHE * 0.5 || aggressive)) {
                const toEvict = Math.floor(thumbnailCache.size * (aggressive ? 0.8 : 0.5));
                cleaned += thumbnailCache.evict ? thumbnailCache.evict(toEvict) : 0;
            }
            
            // 清理原图缓存
            if (fullImageCache.size > 50 * 0.5 || aggressive) {
                const toDelete = Math.floor(fullImageCache.size * (aggressive ? 0.8 : 0.5));
                const keys = Array.from(fullImageCache.keys()).slice(0, toDelete);
                keys.forEach(key => {
                    fullImageCache.delete(key);
                    cleaned++;
                });
            }
            
            console.log(`🧹 缓存清理完成，清理了 ${cleaned} 个缓存项`);
            return cleaned;
        },
        
        // 定期监控（每30秒）
        startMonitoring: function() {
            if (this.intervalId) {
                clearInterval(this.intervalId);
            }
            this.paused = false;
            this.intervalId = setInterval(() => {
                const memInfo = this.checkMemory();
                const cacheStats = this.getCacheStats();
                
                if (memInfo) {
                    console.log(`📊 内存监控: ${memInfo.used}MB / ${memInfo.limit}MB (${memInfo.percentage}%)`);
                    
                    // 【P0内存优化】降低阈值，更早触发清理（60-70%警告，80%以上激进清理）
                    if (memInfo.percentage > 70) {
                        console.warn('⚠️ 内存使用率较高，执行缓存清理...');
                        this.cleanupCache(false);
                    }
                    
                    // 内存使用超过80%时激进清理
                    if (memInfo.percentage > 80) {
                        console.error('🔴 内存使用率过高，执行激进清理...');
                        this.cleanupCache(true);
                        batchRevokeBlobUrls();
                    }
                    
                    // 内存使用超过90%时紧急清理
                    if (memInfo.percentage > 90) {
                        console.error('🚨 内存严重不足，执行紧急清理...');
                        this.cleanupCache(true);
                        batchRevokeBlobUrls();
                        // 清理所有缓存（确保已初始化）
                        if (!canvasCache || !thumbnailCache) {
                            initCaches();
                        }
                        if (canvasCache) canvasCache.clear();
                        if (thumbnailCache) thumbnailCache.clear();
                        fullImageCache.clear();
                        preloadCache.clear();
                    }
                }
                
                console.log(`📦 缓存统计:`, cacheStats);
            }, 30000); // 每30秒监控一次
        },
        stopMonitoring: function() {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
        },
        pause: function() {
            this.paused = true;
            this.stopMonitoring();
        },
        resume: function() {
            if (this.paused) {
                this.startMonitoring();
            }
        }
    };
    
    // ==================
    // localStorage 容量监控工具
    // ==================
    const storageMonitor = {
        // 获取localStorage已用空间（字节）
        getUsedSpace: function() {
            // 【修复】添加异常处理，兼容隐私模式
            try {
                let total = 0;
                // 【修复】使用Object.keys代替for...in，更安全
                const keys = Object.keys(localStorage);
                for (let i = 0; i < keys.length; i++) {
                    const key = keys[i];
                    const value = localStorage.getItem(key);
                    if (value !== null) {
                        total += value.length + key.length;
                    }
                }
                return total;
            } catch (error) {
                console.warn('localStorage访问失败（可能是隐私模式）:', error);
                return 0;
            }
        },
        
        // 获取已用空间（MB）
        getUsedSpaceMB: function() {
            return (this.getUsedSpace() / (1024 * 1024)).toFixed(2);
        },
        
        // 获取使用百分比（假设限额为5MB）
        getUsagePercentage: function() {
            const maxSize = 5 * 1024 * 1024; // 5MB
            return Math.round((this.getUsedSpace() / maxSize) * 100);
        },
        
        // 检查是否接近容量上限
        checkCapacity: function() {
            const percentage = this.getUsagePercentage();
            const usedMB = this.getUsedSpaceMB();
            
            if (percentage >= 90) {
                return {
                    status: 'critical',
                    message: `存储空间严重不足！已使用 ${usedMB}MB (${percentage}%)`,
                    shouldWarn: true
                };
            } else if (percentage >= 70) {
                return {
                    status: 'warning',
                    message: `存储空间紧张！已使用 ${usedMB}MB (${percentage}%)`,
                    shouldWarn: true
                };
            }
            
            return {
                status: 'ok',
                message: `存储空间充足 (${usedMB}MB, ${percentage}%)`,
                shouldWarn: false
            };
        }
    };

    // DOM 元素
    const grid = document.getElementById('wallpaper-grid');
    const navButtons = document.querySelectorAll('.nav-btn');
    const qihu360SubNav = document.getElementById('qihu360-subnav');
    const bingDateNav = document.getElementById('bing-date-nav');
    const loader = document.getElementById('loader');
    const controls = document.getElementById('controls');
    const uploadInput = document.getElementById('upload-input');
    const dragDropArea = document.getElementById('drag-drop-area');
    const qihu360SearchInput = document.getElementById('qihu360-search-input');
    const qihu360SearchBtn = document.getElementById('qihu360-search-btn');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const solidColorNav = document.getElementById('solid-color-nav');
    
    // 新增: Lightbox DOM 元素
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const downloadBtn = document.getElementById('download-btn');
    const setBackgroundBtn = document.getElementById('set-background-btn');

    // 检查所有必要的DOM元素是否存在
    if (!grid || !navButtons.length || !qihu360SubNav || !loader || !controls || !lightbox || !lightboxImg || !downloadBtn || !setBackgroundBtn || !uploadInput || !dragDropArea || !qihu360SearchInput || !qihu360SearchBtn || !loadMoreBtn || !solidColorNav) {
        console.error('壁纸库初始化失败：缺少必要的DOM元素');
        console.error('缺少的元素:', {
            grid: !!grid,
            navButtons: navButtons.length,
            qihu360SubNav: !!qihu360SubNav,
            loader: !!loader,
            controls: !!controls,
            lightbox: !!lightbox,
            lightboxImg: !!lightboxImg,
            downloadBtn: !!downloadBtn,
            setBackgroundBtn: !!setBackgroundBtn,
            uploadInput: !!uploadInput,
            dragDropArea: !!dragDropArea,
            qihu360SearchInput: !!qihu360SearchInput,
            qihu360SearchBtn: !!qihu360SearchBtn,
            loadMoreBtn: !!loadMoreBtn,
            solidColorNav: !!solidColorNav
        });
        return;
    }
    
    console.log('✅ 壁纸库初始化成功！');

    // ==================
    // 拖拽上传功能
    // ==================
    
    // 拖拽上传处理函数
    function setupDragDropUpload() {
        // 阻止默认的拖拽行为
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dragDropArea.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        // 高亮拖拽区域
        ['dragenter', 'dragover'].forEach(eventName => {
            dragDropArea.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dragDropArea.addEventListener(eventName, unhighlight, false);
        });

        // 处理文件放置
        dragDropArea.addEventListener('drop', handleDrop, false);
        
        // 点击拖拽区域触发文件选择
        dragDropArea.addEventListener('click', () => {
            uploadInput.click();
        });
    }

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(e) {
        dragDropArea.classList.add('drag-over');
    }

    function unhighlight(e) {
        dragDropArea.classList.remove('drag-over');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files && files.length > 0) {
            console.log('拖拽上传文件:', files.length, '个文件');
            handleFileUpload(files);
        }
    }
    
    // 初始化拖拽上传（仅在"我的上传"页面显示）
    setupDragDropUpload();
    
    // 【P0优化】根据当前页面控制拖拽区域显示（异步版本）
    async function updateDragDropAreaVisibility() {
        if (activeSource === 'myuploads') {
            dragDropArea.classList.add('show');
            
            // 检查是否有上传的图片
            const images = await getMyUploadedImages();
            const emptyHint = dragDropArea.querySelector('.drag-empty-hint');
            
            if (emptyHint) {
                if (images.length === 0) {
                    emptyHint.style.display = 'block';
                } else {
                    emptyHint.style.display = 'none';
                }
            }
            
            // 【P0优化】显示存储容量信息
            await updateStorageCapacityDisplay();
        } else {
            dragDropArea.classList.remove('show');
        }
    }
    
    // 【P0优化】更新存储容量显示（支持IndexedDB）
    async function updateStorageCapacityDisplay() {
        // 【修复】添加DOM元素安全检查
        const dragDropContent = dragDropArea.querySelector('.drag-drop-content');
        if (!dragDropContent) {
            console.warn('未找到.drag-drop-content元素，跳过容量显示更新');
            return;
        }
        
        // 查找或创建容量显示元素
        let capacityDisplay = dragDropArea.querySelector('.storage-capacity-info');
        if (!capacityDisplay) {
            capacityDisplay = document.createElement('p');
            capacityDisplay.className = 'storage-capacity-info';
            capacityDisplay.style.cssText = 'margin: 8px 0 0 0; font-size: 12px; opacity: 0.8;';
            dragDropContent.appendChild(capacityDisplay);
        }
        
        const images = await getMyUploadedImages();
        
        // 【P0优化】优先显示IndexedDB存储信息
        const storageInfo = await indexedDBStorage.getStorageEstimate();
        
        let message = '';
        let color = '#4CAF50'; // 默认绿色
        
        if (storageInfo.supported) {
            // 使用IndexedDB存储信息
            const percentage = parseFloat(storageInfo.percentage);
            
            if (percentage >= 90) {
                color = '#ff4444'; // 红色
                message = `⚠️ 存储空间严重不足！已使用 ${storageInfo.usage}MB / ${storageInfo.quota}MB (${storageInfo.percentage}%)`;
            } else if (percentage >= 70) {
                color = '#ffa500'; // 橙色
                message = `⚠️ 存储空间紧张！已使用 ${storageInfo.usage}MB / ${storageInfo.quota}MB (${storageInfo.percentage}%)`;
            } else {
                color = '#4CAF50'; // 绿色
                message = `存储空间充足 (${storageInfo.usage}MB / ${storageInfo.quota}MB, ${storageInfo.percentage}%)`;
            }
        } else {
            // 降级到localStorage存储信息
            const capacityCheck = storageMonitor.checkCapacity();
            
            if (capacityCheck.status === 'critical') {
                color = '#ff4444';
            } else if (capacityCheck.status === 'warning') {
                color = '#ffa500';
            }
            
            message = capacityCheck.message;
        }
        
        capacityDisplay.style.color = color;
        capacityDisplay.textContent = `📦 已上传 ${images.length} 张图片 | ${message}`;
    }
    
    // 【修复】初始设置（异步调用）
    updateDragDropAreaVisibility().catch(err => {
        console.error('⚠️ 初始化拖拽区域显示失败:', err);
    });
    
    // 360壁纸搜索功能
    function setup360Search() {
        // 搜索按钮点击事件
        qihu360SearchBtn.addEventListener('click', () => {
            const keyword = qihu360SearchInput.value.trim();
            if (keyword) {
                // 输入验证
                if (keyword.length > 50) {
                    alert('搜索关键词不能超过50个字符！');
                    return;
                }
                
                // 检查是否包含特殊字符
                if (/[<>\"'&]/.test(keyword)) {
                    alert('搜索关键词包含非法字符！');
                    return;
                }
                
                qihu360SearchKeyword = keyword;
                console.log('智能搜索360壁纸:', keyword);
                
                // 显示搜索提示
                showSearchHint(keyword);
                
                resetGridAndPagination();
                loadWallpapers();
            } else {
                alert('请输入搜索关键词！\n\n支持的关键词：\n美女、模特、风景、山水、动漫、卡通、汽车、跑车、游戏、明星、动物、宠物、军事、体育等');
            }
        });
        
        // 搜索框回车事件
        qihu360SearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const keyword = qihu360SearchInput.value.trim();
                if (keyword) {
                    // 输入验证
                    if (keyword.length > 50) {
                        alert('搜索关键词不能超过50个字符！');
                        return;
                    }
                    
                    // 检查是否包含特殊字符
                    if (/[<>\"'&]/.test(keyword)) {
                        alert('搜索关键词包含非法字符！');
                        return;
                    }
                    
                    qihu360SearchKeyword = keyword;
                    console.log('智能搜索360壁纸:', keyword);
                    
                    // 显示搜索提示
                    showSearchHint(keyword);
                    
                    resetGridAndPagination();
                    loadWallpapers();
                } else {
                    alert('请输入搜索关键词！\n\n支持的关键词：\n美女、模特、风景、山水、动漫、卡通、汽车、跑车、游戏、明星、动物、宠物、军事、体育等');
                }
            }
        });
        
        // 搜索框清空事件
        qihu360SearchInput.addEventListener('input', (e) => {
            if (e.target.value.trim() === '') {
                qihu360SearchKeyword = '';
                console.log('清空搜索，恢复分类浏览');
                resetGridAndPagination();
                loadWallpapers();
            }
        });
        
        // 搜索框输入限制
        qihu360SearchInput.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value.length > 50) {
                e.target.value = value.substring(0, 50);
                alert('搜索关键词不能超过50个字符！');
            }
        });
    }
    
    // 初始化搜索功能
    setup360Search();
    
    // 显示搜索提示
    function showSearchHint(keyword) {
        const keywordToCategory = {
            '美女': '美女模特', '模特': '美女模特', '女孩': '美女模特', '女性': '美女模特',
            '风景': '风景大片', '山水': '风景大片', '自然': '风景大片', '景色': '风景大片',
            '动漫': '动漫卡通', '卡通': '动漫卡通', '二次元': '动漫卡通', '动画': '动漫卡通',
            '汽车': '汽车天下', '跑车': '汽车天下', '豪车': '汽车天下', '车辆': '汽车天下',
            '游戏': '游戏壁纸', '电竞': '游戏壁纸', '游戏角色': '游戏壁纸',
            '明星': '明星风尚', '演员': '明星风尚', '歌手': '明星风尚',
            '动物': '萌宠动物', '宠物': '萌宠动物', '萌宠': '萌宠动物', '猫': '萌宠动物', '狗': '萌宠动物',
            '军事': '军事天地', '武器': '军事天地', '坦克': '军事天地', '飞机': '军事天地',
            '体育': '劲爆体育', '运动': '劲爆体育', '足球': '劲爆体育', '篮球': '劲爆体育',
            '4K': '4K专区', '高清': '4K专区', '超清': '4K专区'
        };
        
        let matchedCategory = '编辑推荐';
        for (const [key, category] of Object.entries(keywordToCategory)) {
            if (keyword.includes(key)) {
                matchedCategory = category;
                break;
            }
        }
        
        // 显示搜索提示
        const hint = document.createElement('div');
        hint.className = 'search-hint';
        hint.innerHTML = `
            <div style="background: rgba(139, 196, 255, 0.1); border: 1px solid var(--active-blue); border-radius: 8px; padding: 12px; margin: 10px 0; color: var(--text-color);">
                <strong>🔍 智能搜索提示</strong><br>
                关键词 "<strong>${keyword}</strong>" 已匹配到分类：<strong>${matchedCategory}</strong><br>
                <small style="color: var(--text-secondary-color);">正在为您展示相关壁纸...</small>
            </div>
        `;
        
        // 插入到网格前面
        grid.parentNode.insertBefore(hint, grid);
        
        // 3秒后自动移除提示
        setTimeout(() => {
            if (hint.parentNode) {
                hint.parentNode.removeChild(hint);
            }
        }, 3000);
    }
    
    // 加载更多功能
    function setupLoadMore() {
        loadMoreBtn.addEventListener('click', () => {
            if (isLoading) return;
            
            currentPage++;
            console.log('加载更多壁纸，当前页码:', currentPage);
            loadWallpapers(true); // true表示追加模式
        });
    }
    
    // 初始化加载更多功能
    setupLoadMore();
    
    // 纯色壁纸功能
    function setupSolidColor() {
        // 【新增】预设颜色圆点点击事件
        document.addEventListener('click', (e) => {
            const colorDot = e.target.closest('.color-dot[data-color]');
            if (colorDot) {
                const color = colorDot.dataset.color;
                
                // 特殊处理调色板（打开颜色选择器）
                if (color === 'palette') {
                    // 创建临时的颜色选择器
                    const tempColorInput = document.createElement('input');
                    tempColorInput.type = 'color';
                    tempColorInput.style.position = 'absolute';
                    tempColorInput.style.opacity = '0';
                    tempColorInput.style.pointerEvents = 'none';
                    document.body.appendChild(tempColorInput);
                    
                    tempColorInput.addEventListener('change', (e) => {
                        const selectedColor = e.target.value;
                        const colorName = getColorName(selectedColor) || selectedColor;
                        showSolidColorPreview(selectedColor, colorName);
                        addToRecentColors(selectedColor);
                        document.body.removeChild(tempColorInput);
                    });
                    
                    // 触发点击
                    tempColorInput.click();
                } else {
                    const colorName = getColorName(color) || color;
                    showSolidColorPreview(color, colorName);
                    addToRecentColors(color);
                }
            }
        });
        
        // 移除冗余的初始化调用（已在handleNavClick中按需加载）
        // initializeDefaultSolidColors();  // ❌ 冗余：默认activeSource='qihu360'，不需要预加载
        
        // 加载最近使用的颜色
        loadRecentColors();
    }
    
    // 添加到最近使用的颜色
    function addToRecentColors(color) {
        try {
            // 从localStorage读取最近使用的颜色
            let recentColors = JSON.parse(localStorage.getItem('recentColors') || '[]');
            
            // 移除重复的颜色
            recentColors = recentColors.filter(c => c !== color);
            
            // 添加到开头
            recentColors.unshift(color);
            
            // 只保留最近8个
            recentColors = recentColors.slice(0, 8);
            
            // 保存到localStorage
            localStorage.setItem('recentColors', JSON.stringify(recentColors));
            
            // 更新显示
            loadRecentColors();
        } catch (error) {
            console.error('保存最近使用颜色失败:', error);
        }
    }
    
    // 加载最近使用的颜色
    function loadRecentColors() {
        try {
            const recentColors = JSON.parse(localStorage.getItem('recentColors') || '[]');
            const recentColorsRow = document.getElementById('recent-colors-row');
            
            if (!recentColorsRow) return;
            
            if (recentColors.length > 0) {
                recentColorsRow.style.display = 'flex';
                recentColorsRow.innerHTML = '';
                
                recentColors.forEach(color => {
                    const dot = document.createElement('div');
                    dot.className = 'color-dot';
                    dot.dataset.color = color;
                    
                    // 检查是否是渐变色
                    const isGradient = color.includes('gradient');
                    if (isGradient) {
                        dot.style.backgroundImage = color;
                        dot.title = '最近使用的渐变色';
                    } else {
                        dot.style.backgroundColor = color;
                        dot.title = `最近使用: ${getColorName(color) || color}`;
                    }
                    
                    recentColorsRow.appendChild(dot);
                });
            } else {
                recentColorsRow.style.display = 'none';
            }
        } catch (error) {
            console.error('加载最近使用颜色失败:', error);
        }
    }
    
    // 初始化默认纯色和渐变色（从JSON加载）
    async function initializeDefaultSolidColors() {
        try {
            // 从JSON文件加载颜色数据
            const response = await fetch('data/wallpaper-colors.json');
            if (!response.ok) {
                throw new Error('Failed to load colors data');
            }
            const defaultColors = await response.json();
            
            // 清空网格
            grid.innerHTML = '';
            
            // 添加默认纯色和渐变
            defaultColors.forEach(colorData => {
                addSolidColorToGrid(colorData.color, colorData.name);
            });
            
            console.log(`✅ 已加载 ${defaultColors.length} 个颜色`);
        } catch (error) {
            console.error('加载颜色数据失败:', error);
            // 如果加载失败，显示错误信息
            grid.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">颜色数据加载失败，请刷新页面重试</div>';
        }
    }
    
    // 添加纯色到网格 - 纯色块样式（无文字）
    function addSolidColorToGrid(color, name = null) {
        const colorName = name || getColorName(color);
        
        const item = document.createElement('div');
        item.className = 'wallpaper-item solid-color-item';
        item.dataset.color = color;
        item.dataset.type = 'solid-color';
        item.title = colorName; // 鼠标悬停显示颜色名称
        
        // 纯色块样式：支持渐变色和纯色
        const isGradient = color.includes('gradient');
        // 【修复】确保渐变色正确显示，使用backgroundImage而不是background
        const bgStyle = isGradient 
            ? `background-image: ${color}; background-size: cover; background-position: center;` 
            : `background-color: ${color}`;
        
        item.innerHTML = `
            <div class="wallpaper-thumbnail" style="${bgStyle}; border-radius: 12px; width: 100%; height: 100%; display: block;">
            </div>
        `;
        
        // 点击色块直接显示预览（可选择下载或设为壁纸）
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            showSolidColorPreview(color, colorName);
        });
        
        grid.appendChild(item);
    }
    
    // 获取颜色名称
    function getColorName(color) {
        const colorNames = {
            '#ffffff': '纯白', '#000000': '纯黑', '#808080': '灰色', '#c0c0c0': '银色',
            '#0000ff': '蓝色', '#87ceeb': '天蓝', '#00bfff': '深天蓝', '#add8e6': '浅蓝',
            '#00ff00': '绿色', '#32cd32': '草绿', '#90ee90': '浅绿', '#98fb98': '薄荷绿',
            '#ff0000': '红色', '#ff4500': '橙红', '#ff6347': '番茄红', '#ff7f50': '珊瑚红',
            '#ffff00': '黄色', '#ffd700': '金色', '#ffa500': '橙色', '#ff69b4': '粉色',
            '#ff00ff': '紫色', '#800080': '深紫', '#9932cc': '紫罗兰', '#ba55d3': '中紫',
            '#00ffff': '青色', '#008000': '深绿', '#7fffd4': '薄荷绿', '#20b2aa': '深青'
        };
        return colorNames[color.toLowerCase()] || color.toUpperCase();
    }
    
    // Canvas缓存辅助函数 - 生成颜色图片（带缓存）
    function generateColorImage(color) {
        // 【修复】确保缓存已初始化
        if (!canvasCache) {
            initCaches();
        }
        
        // 检查缓存
        if (canvasCache && canvasCache.has(color)) {
            console.log('📦 使用缓存的颜色图片:', color);
            return canvasCache.get(color);
        }
        
        console.log('🎨 生成新的颜色图片:', color);
        const isGradient = color.includes('gradient');
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        if (isGradient) {
            // 渐变背景
            const gradient = parseGradient(color);
            if (gradient) {
                const canvasGradient = createCanvasGradient(ctx, gradient, canvas.width, canvas.height);
                ctx.fillStyle = canvasGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        } else {
            // 纯色背景
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        const imageUrl = canvas.toDataURL('image/png');
        
        // 【修复】确保缓存已初始化后再设置
        if (!canvasCache) {
            initCaches();
        }
        // 【P0内存优化】LRU缓存自动管理，无需手动检查大小
        if (canvasCache) {
            canvasCache.set(color, imageUrl);
        }
        
        return imageUrl;
    }
    
    // 显示纯色预览 - 支持渐变色（使用缓存）
    function showSolidColorPreview(color, name) {
        console.log('显示纯色预览:', color, name);
        
        // 使用缓存函数生成图片
        const imageUrl = generateColorImage(color);
        lightboxImg.src = imageUrl;
        lightboxImg.alt = `${name}`;
        
        // 清空currentImageUrl，表示这是纯色而不是图片
        lightbox.dataset.currentImageUrl = '';
        
        // 设置下载和设为壁纸按钮的数据属性
        downloadBtn.dataset.color = color;
        downloadBtn.dataset.name = name;
        setBackgroundBtn.dataset.color = color;
        setBackgroundBtn.dataset.name = name;
        
        console.log('设置按钮数据:', { color, name });
        
        // 使用visible类显示lightbox（与壁纸预览一致）
        lightbox.classList.add('visible');
    }
    
    // 解析渐变字符串
    function parseGradient(gradientStr) {
        const match = gradientStr.match(/linear-gradient\(([^)]+)\)/);
        if (!match) return null;
        
        const parts = match[1].split(',').map(s => s.trim());
        const direction = parts[0];
        const colors = parts.slice(1);
        
        return { direction, colors };
    }
    
    // 在canvas上创建渐变
    function createCanvasGradient(ctx, gradient, width, height) {
        let x0 = 0, y0 = 0, x1 = width, y1 = height;
        
        // 解析方向
        if (gradient.direction.includes('135deg')) {
            x0 = 0; y0 = height; x1 = width; y1 = 0;
        } else if (gradient.direction.includes('to right')) {
            x0 = 0; y0 = 0; x1 = width; y1 = 0;
        }
        
        const canvasGradient = ctx.createLinearGradient(x0, y0, x1, y1);
        
        // 添加颜色停止点
        gradient.colors.forEach(colorStop => {
            const parts = colorStop.trim().split(/\s+/);
            const color = parts[0];
            const position = parts[1] ? parseFloat(parts[1]) / 100 : null;
            
            if (position !== null) {
                canvasGradient.addColorStop(position, color);
            }
        });
        
        return canvasGradient;
    }
    
    // 下载纯色/渐变色（优化：使用缓存的DataURL转换为Blob）
    function downloadSolidColor(color, name) {
        try {
            console.log('下载纯色/渐变色:', color, name);
            const isGradient = color.includes('gradient');
            
            // 使用缓存的图片URL（如果有），否则生成新的
            const dataUrl = generateColorImage(color);
            
            // 将Data URL转换为Blob
            fetch(dataUrl)
                .then(res => res.blob())
                .then(blob => {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    const fileName = isGradient 
                        ? `${name}.png` 
                        : `${name}_${color.replace('#', '')}.png`;
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    showNotification('壁纸下载已开始！', 'success');
                })
                .catch(error => {
                    console.error('下载失败:', error);
                    showNotification('下载失败，请重试', 'error');
                });
        } catch (error) {
            console.error('下载失败:', error);
            showNotification('下载失败，请重试', 'error');
        }
    }
    
    // 应用纯色/渐变背景
    function applySolidColorBackground(color) {
        try {
            console.log('应用背景:', color);
            
            // 保存到localStorage
            const wallpaper = {
                url: `solid-color:${color}`,
                timestamp: Date.now(),
                source: 'solid-color',
                color: color
            };
            localStorage.setItem('currentWallpaper', JSON.stringify(wallpaper));
            localStorage.setItem('wallpaperLocked', 'true');
            
            const isGradient = color.includes('gradient');
            
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
            
            // 强制刷新样式
            document.body.style.display = 'none';
            document.body.offsetHeight; // 触发重排
            document.body.style.display = '';
            
            showNotification(`背景已应用`, 'success');
            console.log('背景设置成功:', color);
        } catch (error) {
            console.error('设置背景失败:', error);
            showNotification('设置背景失败，请重试', 'error');
        }
    }
    
    // 初始化纯色功能
    setupSolidColor();

    // ==================
    // 虚拟滚动实现
    // ==================
    
    // 【新增】创建占位元素（用于保持滚动高度）
    function createPlaceholderElement(height) {
        const placeholder = document.createElement('div');
        placeholder.className = 'virtual-scroll-placeholder';
        placeholder.style.cssText = `
            height: ${height}px;
            width: 100%;
            visibility: hidden;
        `;
        return placeholder;
    }
    
    // 【新增】创建壁纸元素（虚拟滚动版本 - 只加载缩略图）
    function createWallpaperElement(imgData, isMyUploads = false) {
        const item = document.createElement('a');
        item.href = '#'; // 阻止默认跳转
        item.className = 'wallpaper-item';
        item.title = imgData.info || '点击查看原图';
        item.dataset.virtualIndex = imgData.virtualIndex || 0;
        
        // 【关键】存储原图URL到dataset，而不是href
        item.dataset.fullUrl = imgData.fullUrl;
        item.dataset.thumbnailUrl = imgData.thumbnailUrl;
        item.dataset.info = imgData.info || '';
        
        const imgElement = document.createElement('img');
        imgElement.dataset.src = imgData.thumbnailUrl; // 【只加载缩略图】
        imgElement.alt = imgData.info;
        imgElement.loading = 'lazy';
        imgElement.className = 'virtual-scroll-img';
        item.appendChild(imgElement);
        
        // 如果是"我的上传"，添加删除按钮
        if (isMyUploads) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
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
                await deleteUploadedImage(imgData.id);
            });
            item.appendChild(deleteBtn);
        }
        
        return item;
    }
    
    // 【修复】动态压缩缩略图（智能判断 + Blob URL）
    async function compressThumbnail(imageUrl) {
        // 【修复】确保缓存已初始化
        if (!thumbnailCache) {
            initCaches();
        }
        
        // 检查缓存
        if (thumbnailCache && thumbnailCache.has(imageUrl)) {
            console.log('📦 使用缓存的压缩缩略图');
            return thumbnailCache.get(imageUrl);
        }
        
        return new Promise((resolve) => {
            const img = new Image();
            // 【修复】不设置 crossOrigin，避免CORS阻止（降级策略）
            // img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                try {
                    const originalWidth = img.width;
                    const originalHeight = img.height;
                    
                    // 【优化】智能判断：如果图片已经很小，直接使用原URL
                    if (originalWidth <= THUMBNAIL_MAX_WIDTH && originalHeight <= THUMBNAIL_MAX_HEIGHT) {
                        console.log(`✅ 图片尺寸已适中(${originalWidth}x${originalHeight})，跳过压缩`);
                        if (thumbnailCache) {
                            thumbnailCache.set(imageUrl, imageUrl);
                        }
                        resolve(imageUrl);
                        return;
                    }
                    
                    // 计算压缩后的尺寸
                    const ratio = Math.min(THUMBNAIL_MAX_WIDTH / originalWidth, THUMBNAIL_MAX_HEIGHT / originalHeight);
                    const width = Math.floor(originalWidth * ratio);
                    const height = Math.floor(originalHeight * ratio);
                    
                    // 创建Canvas压缩
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    
                    // 高质量绘制
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);
                    
                        // 【修复】使用 Blob 而不是 DataURL（节省内存）
                        canvas.toBlob((blob) => {
                            if (!blob) {
                                console.warn('⚠️ Blob生成失败，使用原URL');
                                resolve(imageUrl);
                                return;
                            }
                            
                            // 创建 Blob URL
                            const blobUrl = URL.createObjectURL(blob);
                            // 【P0优化】跟踪Blob URL
                            blobUrlTracker.add(blobUrl);
                            
                            const compressedSize = blob.size;
                            const sizeReduction = ((1 - compressedSize / (originalWidth * originalHeight * 0.3)) * 100).toFixed(1);
                            
                            console.log(`🎨 缩略图压缩: ${originalWidth}x${originalHeight} → ${width}x${height}, 体积: ${(compressedSize/1024).toFixed(1)}KB`);
                            
                            // 【修复】确保缓存已初始化
                            if (!thumbnailCache) {
                                initCaches();
                            }
                            // 【P0内存优化】LRU缓存自动管理，onEvict回调会自动清理Blob URL
                            if (thumbnailCache) {
                                thumbnailCache.set(imageUrl, blobUrl);
                            }
                            
                            resolve(blobUrl);
                        }, 'image/jpeg', THUMBNAIL_QUALITY);
                    
                } catch (error) {
                    console.warn('⚠️ 缩略图压缩失败，使用原URL:', error);
                    resolve(imageUrl);
                }
            };
            
            img.onerror = () => {
                // 【修复】CORS或加载失败时，直接使用原URL（不要警告用户）
                console.log('📌 图片加载失败或CORS限制，使用原URL');
                if (thumbnailCache) {
                    thumbnailCache.set(imageUrl, imageUrl); // 缓存原URL，避免重复尝试
                }
                resolve(imageUrl);
            };
            
            img.src = imageUrl;
        });
    }
    
    // 【新增】批量处理图片加载队列
    function processImageLoadQueue() {
        if (loadingPaused || isProcessingQueue || imageLoadQueue.length === 0) return;
        
        isProcessingQueue = true;
        const batchSize = 6; // 每批加载6张图片
        const batch = imageLoadQueue.splice(0, batchSize);
        
        console.log(`🚀 批量加载图片: ${batch.length}张`);
        
        batch.forEach(img => {
            if (img.dataset.src && !img.src) {
                img.src = img.dataset.src;
                // 添加加载完成的回调
                img.onload = () => {
                    img.classList.add('loaded');
                };
                img.onerror = () => {
                    console.warn('图片加载失败:', img.dataset.src);
                };
            }
        });
        
        isProcessingQueue = false;
        
        // 如果队列还有图片，继续处理
        if (!loadingPaused && imageLoadQueue.length > 0) {
            requestIdleCallback(() => processImageLoadQueue(), { timeout: 100 });
        }
    }
    
    // 【修复】智能图片加载函数（修复Promise反模式 + 并发控制 + 缩略图压缩）
    async function loadImageWithPriority(img, priority = 'normal') {
        const src = img.dataset.src;
        
        // 检查是否已在预加载缓存中
        if (preloadCache.has(src)) {
            img.src = src;
            img.classList.add('loaded');
            return;
        }
        
        // 【优化】先尝试压缩缩略图（异步）
        let finalSrc = src;
        try {
            // 只压缩外部URL（http/https开头），跳过data:URL
            if (src.startsWith('http://') || src.startsWith('https://')) {
                finalSrc = await compressThumbnail(src);
                if (finalSrc !== src) {
                    console.log('🚀 使用压缩缩略图');
                }
            }
        } catch (error) {
            console.warn('压缩缩略图失败，使用原图:', error);
            finalSrc = src;
        }
        
        // 等待并发槽位并加载图片
        return new Promise((resolve, reject) => {
            const attemptLoad = () => {
                if (activeLoads >= MAX_PARALLEL_LOADS) {
                    setTimeout(attemptLoad, 50);
                    return;
                }
                
                activeLoads++;
                img.classList.add('loading');
                
                // 创建临时Image对象预加载
                const tempImg = new Image();
                tempImg.onload = () => {
                    img.src = finalSrc; // 使用压缩后的URL
                    img.classList.remove('loading');
                    img.classList.add('loaded');
                    preloadCache.add(src);
                    activeLoads--;
                    resolve();
                };
                tempImg.onerror = () => {
                    img.classList.remove('loading');
                    activeLoads--;
                    reject(new Error('图片加载失败'));
                };
                
                // 设置高优先级（fetch priority）
                if (priority === 'high' && tempImg.fetchPriority) {
                    tempImg.fetchPriority = 'high';
                }
                
                tempImg.src = finalSrc;
            };
            
            attemptLoad();
        });
    }
    
    // 【优化】初始化虚拟滚动Observer（极速加载）
    function initVirtualScrollObserver() {
        if (!VIRTUAL_SCROLL_ENABLED) return;
        
        // 清理旧的observer
        if (virtualScrollObserver) {
            virtualScrollObserver.disconnect();
        }
        
        // 创建新的IntersectionObserver（激进配置）
        virtualScrollObserver = new IntersectionObserver(
            (entries) => {
                // 按距离视口中心排序，优先加载中心附近的图片
                const sortedEntries = entries
                    .filter(entry => entry.isIntersecting)
                    .sort((a, b) => {
                        const aDistance = Math.abs(a.boundingClientRect.top - window.innerHeight / 2);
                        const bDistance = Math.abs(b.boundingClientRect.top - window.innerHeight / 2);
                        return aDistance - bDistance;
                    });
                
                sortedEntries.forEach((entry, index) => {
                    const img = entry.target.querySelector('.virtual-scroll-img');
                    if (!img) return;
                    
                    if (entry.isIntersecting) {
                        // 元素进入视口，智能加载图片
                        if (img.dataset.src && !img.src && !img.classList.contains('loading')) {
                            // 根据距离视口中心的位置确定优先级
                            const priority = index < 6 ? 'high' : 'normal';
                            
                            loadImageWithPriority(img, priority).catch(err => {
                                console.warn('⚠️ 图片加载失败:', err);
                            });
                        }
                    } else {
                        // 元素离开视口很远时，可以卸载（节省内存）
                        const rect = entry.boundingClientRect;
                        const viewportHeight = window.innerHeight;
                        const farAway = Math.abs(rect.top - viewportHeight / 2) > viewportHeight * 2;
                        
                        if (farAway && img.src) {
                            // 超过2屏距离的图片可以卸载
                            // img.src = '';
                            // img.classList.remove('loaded');
                            // 注释：暂时不卸载，保持体验流畅
                        }
                    }
                });
            },
            {
                root: null,
                rootMargin: PRELOAD_MARGIN, // 1000px预加载距离
                threshold: LOAD_THRESHOLD
            }
        );
        
        console.log(`✅ 虚拟滚动Observer已初始化 (预加载距离: ${PRELOAD_MARGIN}, 最大并行: ${MAX_PARALLEL_LOADS})`);
    }
    
    // 【新增】渲染虚拟滚动壁纸
    function renderVirtualWallpapers(images, isMyUploads = false, append = false) {
        console.log('🎯 虚拟滚动渲染:', images.length, '张图片');
        
        if (!images || images.length === 0) {
            if (!append) {
                if (isMyUploads) {
                    grid.innerHTML = '';
                } else {
                    grid.innerHTML = '<p class="loader">未找到任何壁纸。</p>';
                }
            }
            return;
        }
        
        // 如果不是追加模式，清空网格
        if (!append) {
            grid.innerHTML = '';
            allWallpapers = [];
            preloadCache.clear(); // 清空预加载缓存
        }
        
        // 添加虚拟索引
        const startIndex = allWallpapers.length;
        images.forEach((img, index) => {
            img.virtualIndex = startIndex + index;
        });
        
        // 追加到总数据
        allWallpapers.push(...images);
        
        // 创建文档片段
        const fragment = document.createDocumentFragment();
        
        // 渲染所有元素（IntersectionObserver会处理可见性）
        images.forEach((imgData) => {
            const item = createWallpaperElement(imgData, isMyUploads);
            fragment.appendChild(item);
            
            // 观察该元素
            if (virtualScrollObserver) {
                virtualScrollObserver.observe(item);
            }
        });
        
        grid.appendChild(fragment);
        console.log(`✅ 虚拟滚动渲染完成，总数: ${allWallpapers.length}`);
        
        // 【新增】立即触发可见图片的加载（首屏优化）
        if (!append) {
            requestAnimationFrame(() => {
                const visibleItems = Array.from(grid.querySelectorAll('.wallpaper-item'))
                    .filter(item => {
                        const rect = item.getBoundingClientRect();
                        return rect.top < window.innerHeight && rect.bottom > 0;
                    })
                    .slice(0, 12); // 只加载前12张
                
                visibleItems.forEach(item => {
                    const img = item.querySelector('.virtual-scroll-img');
                    if (img && img.dataset.src && !img.src) {
                        loadImageWithPriority(img, 'high').catch(() => {});
                    }
                });
            });
        }
    }

    // ==================
    // 核心功能函数
    // ==================

    function renderWallpapers(images, isMyUploads = false, append = false) {
        // 【新增】如果启用虚拟滚动，使用虚拟滚动渲染
        if (VIRTUAL_SCROLL_ENABLED && activeSource !== 'solidcolor') {
            renderVirtualWallpapers(images, isMyUploads, append);
            return;
        }
        
        // 传统渲染方式（用于纯色或禁用虚拟滚动时）
        if (!images || images.length === 0) {
            if (currentPage === 1 && !append) {
                if (isMyUploads) {
                    // 空状态时只显示拖拽区域，不显示额外的空状态内容
                    grid.innerHTML = '';
                } else {
                    grid.innerHTML = '<p class="loader">未找到任何壁纸。</p>';
                }
            }
            return;
        }
        
        // 如果不是追加模式，清空网格
        if (!append) {
            grid.innerHTML = '';
        }
        
        const fragment = document.createDocumentFragment();
        images.forEach((imgData, index) => {
            const item = document.createElement('a');
            item.href = '#'; // 阻止默认跳转
            item.className = 'wallpaper-item';
            item.title = imgData.info || '点击查看原图';
            
            // 【修复】传统渲染也使用dataset存储URL
            item.dataset.fullUrl = imgData.fullUrl;
            item.dataset.thumbnailUrl = imgData.thumbnailUrl;
            item.dataset.info = imgData.info || '';
            
            const imgElement = document.createElement('img');
            imgElement.src = imgData.thumbnailUrl; // 只加载缩略图
            imgElement.alt = imgData.info;
            imgElement.loading = 'lazy';
            item.appendChild(imgElement);
            
            // 如果是"我的上传"，添加删除按钮
            if (isMyUploads) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.title = '删除图片';
                deleteBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                `;
                deleteBtn.dataset.imageId = imgData.id;
                deleteBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteUploadedImage(imgData.id);
                });
                item.appendChild(deleteBtn);
            }
            
            fragment.appendChild(item);
        });
        grid.appendChild(fragment);
    }

    async function loadWallpapers(append = false) {
        if (loadingPaused || document.hidden) {
            console.log('⏸️ 页面不可见或已暂停，推迟加载壁纸');
            return;
        }
        console.log('开始加载壁纸，源:', activeSource, '页码:', currentPage, '追加模式:', append);
        if (isLoading) {
            console.log('正在加载中，跳过');
            return;
        }
        isLoading = true;
        loader.style.display = 'block';

        // 如果不是追加模式，清空网格并重置页码
        if (!append) {
            grid.innerHTML = '';
            currentPage = 1;
        }

        let images = [];
        let isMyUploads = false;
        try {
            console.log('开始获取壁纸数据...');
            switch (activeSource) {
                case 'bing': 
                    console.log('获取必应历史壁纸...');
                    images = await fetchBingHistory(); 
                    break;
                case 'qihu360': 
                    console.log('获取360壁纸...');
                    images = await fetch360Wallpapers(); 
                    break;
                case 'myuploads':
                    console.log('获取我的上传...');
                    images = await getMyUploadedImages();
                    isMyUploads = true;
                    break;
            }
            console.log('获取到壁纸数量:', images.length);
            renderWallpapers(images, isMyUploads, append);
            
        } catch (error) {
            console.error(`加载 ${activeSource} 壁纸失败:`, error);
            if (!append) {
                grid.innerHTML = `<p class="loader">加载失败，请检查网络或稍后再试。</p>`;
            }
        } finally {
            isLoading = false;
            loader.style.display = 'none';
        }
    }
    
    // ==================
    // 【P0优化】我的上传 - IndexedDB存储管理
    // ==================
    
    // 获取已上传的图片（异步版本）
    async function getMyUploadedImages() {
        try {
            const stored = await indexedDBStorage.getItem(MY_UPLOADS_KEY);
            if (stored) {
                // 如果是字符串，解析JSON
                const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
                return Array.isArray(parsed) ? parsed : [];
            }
            return [];
        } catch (error) {
            console.error('读取上传图片失败:', error);
            // 【降级】尝试从localStorage读取
            try {
                const fallback = localStorage.getItem(MY_UPLOADS_KEY);
                return fallback ? JSON.parse(fallback) : [];
            } catch (fallbackError) {
                console.error('localStorage降级读取也失败:', fallbackError);
                return [];
            }
        }
    }
    
    // 保存上传的图片（异步版本）
    async function saveMyUploadedImages(images) {
        try {
            const dataSizeMB = (JSON.stringify(images).length / (1024 * 1024)).toFixed(2);
            
            console.log(`💾 准备保存 ${images.length} 张图片，数据大小: ${dataSizeMB}MB`);
            
            await indexedDBStorage.setItem(MY_UPLOADS_KEY, images);
            console.log('✅ 保存成功（IndexedDB）');
            return true;
        } catch (error) {
            console.error('❌ IndexedDB保存失败，尝试localStorage降级:', error);
            
            // 【降级】尝试使用localStorage
            try {
                const dataToSave = JSON.stringify(images);
                localStorage.setItem(MY_UPLOADS_KEY, dataToSave);
                console.log('✅ 保存成功（localStorage降级）');
                return true;
            } catch (fallbackError) {
                console.error('❌ localStorage保存也失败:', fallbackError);
                
                if (fallbackError.name === 'QuotaExceededError') {
                    const currentUsedMB = storageMonitor.getUsedSpaceMB();
                    const imageCount = images.length;
                    
                    alert(`❌ 存储空间已满！\n\n` +
                          `当前状态：\n` +
                          `- 已上传图片：${imageCount} 张\n` +
                          `- localStorage使用：${currentUsedMB}MB（降级模式）\n` +
                          `- 浏览器限制：通常为5-10MB\n\n` +
                          `解决方案：\n` +
                          `1. 删除一些已上传的图片\n` +
                          `2. 升级浏览器以使用IndexedDB（50MB+）\n` +
                          `3. 清理浏览器缓存和数据`);
                }
                return false;
            }
        }
    }
    
    // 添加新上传的图片（异步版本）
    async function addUploadedImage(imageData) {
        const images = await getMyUploadedImages();
        
        // 在添加前检查是否会超出限制
        const testImages = [imageData, ...images];
        const testData = JSON.stringify(testImages);
        const testSizeMB = (testData.length / (1024 * 1024)).toFixed(2);
        
        console.log(`🔍 预检查: 添加后总大小约 ${testSizeMB}MB`);
        
        // IndexedDB容量更大，警告阈值提高到30MB
        if (testData.length > 30 * 1024 * 1024) {
            console.warn('⚠️ 数据量较大，可能影响性能');
        }
        
        images.unshift(imageData); // 添加到数组开头
        return await saveMyUploadedImages(images);
    }
    
    // 删除已上传的图片（异步版本）
    async function deleteUploadedImage(imageId) {
        if (!confirm('确定要删除这张图片吗？')) {
            return;
        }
        
        const images = await getMyUploadedImages();
        const filteredImages = images.filter(img => img.id !== imageId);
        
        if (await saveMyUploadedImages(filteredImages)) {
            console.log('图片删除成功');
            // 重新加载我的上传页面
            grid.innerHTML = '';
            currentPage = 1;
            loadWallpapers();
            // 【修复】删除后更新容量显示（异步）
            await updateDragDropAreaVisibility();
        }
    }
    
    // 处理文件上传
    async function handleFileUpload(files) {
        if (!files || files.length === 0) return;
        
        // 输入验证
        if (!files || !files.length) {
            console.warn('无效的文件输入');
            return;
        }
        
        // 【P0优化】上传前检查存储容量（优先使用IndexedDB）
        try {
            const storageInfo = await indexedDBStorage.getStorageEstimate();
            
            if (storageInfo.supported) {
                // 使用IndexedDB容量信息
                const percentage = parseFloat(storageInfo.percentage);
                console.log(`📊 IndexedDB存储空间: ${storageInfo.usage}MB / ${storageInfo.quota}MB (${percentage}%)`);
                
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
            } else {
                // 降级到localStorage容量检查
                const capacityCheck = storageMonitor.checkCapacity();
                const currentUsedMB = storageMonitor.getUsedSpaceMB();
                const percentage = storageMonitor.getUsagePercentage();
                
                console.log(`📊 localStorage存储空间（降级模式）: ${currentUsedMB}MB / 5MB (${percentage}%)`);
                
                if (capacityCheck.status === 'critical') {
                    alert(`⚠️ ${capacityCheck.message}\n\n` +
                          `当前使用降级模式（localStorage）\n` +
                          `已使用：${currentUsedMB}MB / 5MB\n` +
                          `剩余空间：${(5 - parseFloat(currentUsedMB)).toFixed(2)}MB\n\n` +
                          `无法上传新图片，请先删除一些现有图片！\n` +
                          `建议：升级浏览器以使用IndexedDB（50MB+容量）`);
                    return;
                } else if (capacityCheck.shouldWarn) {
                    const proceed = confirm(`⚠️ ${capacityCheck.message}\n\n` +
                                           `当前使用降级模式（localStorage）\n` +
                                           `已使用：${currentUsedMB}MB / 5MB\n` +
                                           `剩余空间：${(5 - parseFloat(currentUsedMB)).toFixed(2)}MB\n\n` +
                                           `是否继续上传？建议删除一些图片或升级浏览器。`);
                    if (!proceed) return;
                }
            }
        } catch (error) {
            console.warn('⚠️ 容量检查失败，继续上传:', error);
        }
        
        // 文件类型和大小验证
        const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const maxFileSize = 10 * 1024 * 1024; // 10MB（上传后自动压缩到1920×1080）
        const maxFileNameLength = 255;
        
        loader.style.display = 'block';
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
            z-index: 10000;
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
                    console.warn('跳过不支持的图片格式:', file.name, file.type);
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
                
                // 【优化】移除冗余的逐文件容量检查
                // 已在上传前统一检查IndexedDB容量（1555-1599行）
                // 详细日志
                console.log(`📁 处理图片: ${file.name}`);
                console.log(`  - 原始大小: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);

                // 检查文件名安全性
                if (!file.name || file.name.length > maxFileNameLength) {
                    console.warn('文件名无效:', file.name);
                    alert(`文件名 "${file.name}" 无效！\n文件名长度不能超过255个字符`);
                    failCount++;
                    continue;
                }
                
                // 【新增】验证文件内容是否真的是图片（通过文件头魔数）
                const isValidImage = await validateImageFile(file);
                if (!isValidImage) {
                    console.warn('文件内容验证失败，不是有效的图片文件:', file.name);
                    alert(`文件 "${file.name}" 不是有效的图片文件！\n可能是伪装的恶意文件，已拒绝上传。`);
                    failCount++;
                    continue;
                }
                
                // 【新增】自动压缩图片
                let fileToUpload = file;
                try {
                    console.log(`🎨 正在压缩图片: ${file.name}...`);
                    fileToUpload = await compressImage(file, {
                        maxWidth: 1920,
                        maxHeight: 1080,
                        quality: 0.85,
                        outputFormat: 'image/jpeg'
                    });
                    console.log(`✅ 压缩成功，继续上传`);
                } catch (compressError) {
                    console.warn('压缩失败，使用原始文件:', compressError);
                    // 压缩失败时使用原始文件
                    fileToUpload = file;
                }
                
                // 读取文件为Base64
                const base64 = await readFileAsBase64(fileToUpload);
                
                // 【新增】清理文件名
                const safeName = sanitizeFileName(file.name);
                if (!safeName) {
                    console.warn('文件名清理后无效:', file.name);
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
                
                // 【修复】保存到IndexedDB（异步）
                if (await addUploadedImage(imageData)) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error('处理图片失败:', file.name, error);
                failCount++;
            }
        }
        
        loader.style.display = 'none';
        
        // 【新增】更新最终进度并延迟移除提示
        updateProgress(totalFiles, totalFiles, `✅ 完成！成功: ${successCount}, 失败: ${failCount}`);
        setTimeout(() => {
            if (progressDiv && progressDiv.parentNode) {
                document.body.removeChild(progressDiv);
            }
        }, 2000);
        
        // 显示结果提示
        if (successCount > 0) {
            alert(`✅ 成功上传 ${successCount} 张图片！${failCount > 0 ? `\n❌ ${failCount} 张上传失败。` : ''}\n\n` +
                  `📊 已自动压缩优化，节省存储空间！`);
            
            // 如果当前就在"我的上传"页面，刷新显示
            if (activeSource === 'myuploads') {
                grid.innerHTML = '';
                currentPage = 1;
                loadWallpapers();
                // 【修复】更新拖拽区域的空状态提示（异步）
                await updateDragDropAreaVisibility();
            }
        } else {
            alert('上传失败！请重试。');
        }
    }
    
    // 【新增】安全的文件名验证
    function sanitizeFileName(fileName) {
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
    
    // 【新增】验证文件是否为真实图片（通过文件头校验）
    function validateImageFile(file) {
        return new Promise((resolve, reject) => {
            // 【修复】边界检查：文件太小则无效
            if (!file || file.size < 4) {
                console.warn('文件太小，无法验证文件头');
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
                    console.error('文件头验证出错:', error);
                    resolve(false);
                }
            };
            reader.onerror = () => {
                console.error('读取文件失败');
                resolve(false);
            };
            reader.readAsArrayBuffer(file.slice(0, 4));
        });
    }
    
    // 【新增】图片压缩函数（使用Canvas API）
    async function compressImage(file, options = {}) {
        const {
            maxWidth = 1920,      // 最大宽度
            maxHeight = 1080,     // 最大高度
            quality = 0.85,       // 压缩质量 (0-1)
            outputFormat = 'image/jpeg'  // 输出格式
        } = options;
        
        return new Promise((resolve, reject) => {
            console.log(`📦 开始压缩图片: ${file.name}`);
            console.log(`  - 原始大小: ${(file.size / 1024).toFixed(2)}KB`);
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        // 计算缩放比例
                        let width = img.width;
                        let height = img.height;
                        
                        console.log(`  - 原始尺寸: ${width}x${height}`);
                        
                        // 如果图片超过最大尺寸，按比例缩放
                        if (width > maxWidth || height > maxHeight) {
                            const ratio = Math.min(maxWidth / width, maxHeight / height);
                            width = Math.floor(width * ratio);
                            height = Math.floor(height * ratio);
                            console.log(`  - 缩放后尺寸: ${width}x${height} (缩放比例: ${(ratio * 100).toFixed(1)}%)`);
                        } else {
                            console.log(`  - 尺寸未超限，无需缩放`);
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
                                
                                console.log(`✅ 压缩完成: ${file.name}`);
                                console.log(`  - 压缩后大小: ${(compressedSize / 1024).toFixed(2)}KB`);
                                console.log(`  - 压缩率: ${compressionRatio}%`);
                                console.log(`  - 节省空间: ${((file.size - compressedSize) / 1024).toFixed(2)}KB`);
                                
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
                        console.error('Canvas处理失败:', error);
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
    
    // 将文件读取为Base64
    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    // ==================
    // 各个源的数据获取逻辑
    // ==================
    
    // 1. 必应历史壁纸（数千张）
    async function fetchBingHistory() {
        console.log(`开始获取必应历史壁纸（最近${bingDaysRange}天）...`);
        controls.style.display = 'none';

        return new Promise((resolve) => {
            // 【P1优化】添加错误处理和超时控制
            const timeout = setTimeout(() => {
                console.error('⏱️ 获取必应壁纸超时（10秒）');
                resolve([]);
            }, 10000);
            
            try {
                chrome.runtime.sendMessage(
                    {
                        action: 'fetchBingHistory',
                        count: bingDaysRange  // 根据选择的天数获取
                    },
                    (response) => {
                        clearTimeout(timeout);
                        
                        // 【P1优化】检查chrome.runtime.lastError
                        if (chrome.runtime.lastError) {
                            console.error('❌ Chrome运行时错误:', chrome.runtime.lastError);
                            resolve([]);
                            return;
                        }
                        
                        if (response && response.success) {
                            try {
                                const images = response.data.map(item => ({
                                    thumbnailUrl: item.thumbnail,
                                    fullUrl: item.url,
                                    info: item.title
                                }));
                                console.log('获取到必应历史壁纸数量:', images.length);
                                resolve(images);
                            } catch (error) {
                                console.error('❌ 处理必应壁纸数据失败:', error);
                                resolve([]);
                            }
                        } else {
                            console.error('获取必应历史壁纸失败:', response?.error);
                            resolve([]);
                        }
                    }
                );
            } catch (error) {
                clearTimeout(timeout);
                console.error('❌ 发送消息失败:', error);
                resolve([]);
            }
        });
    }

    // 2. 360壁纸（国内最快，数量最多）
    async function fetch360Wallpapers() {
        console.log('开始获取360壁纸...', qihu360SearchKeyword ? `搜索: ${qihu360SearchKeyword}` : `分类: ${qihu360ActiveCategoryId}`);
        controls.style.display = 'block';
        
        return new Promise((resolve) => {
            // 【P1优化】添加错误处理和超时控制
            const timeout = setTimeout(() => {
                console.error('⏱️ 获取360壁纸超时（10秒）');
                resolve([]);
            }, 10000);
            
            try {
                chrome.runtime.sendMessage(
                    {
                        action: 'fetch360Wallpapers',
                        categoryId: qihu360ActiveCategoryId,
                        page: currentPage,
                        count: ITEMS_PER_PAGE,
                        keyword: qihu360SearchKeyword
                    },
                    (response) => {
                        clearTimeout(timeout);
                        
                        // 【P1优化】检查chrome.runtime.lastError
                        if (chrome.runtime.lastError) {
                            console.error('❌ Chrome运行时错误:', chrome.runtime.lastError);
                            resolve([]);
                            return;
                        }
                        
                        if (response && response.success) {
                            try {
                                const images = response.data.map(item => ({
                                    thumbnailUrl: item.thumbnail,
                                    fullUrl: item.url,
                                    info: item.title
                                }));
                                console.log('获取到360壁纸数量:', images.length);
                                resolve(images);
                            } catch (error) {
                                console.error('❌ 处理360壁纸数据失败:', error);
                                resolve([]);
                            }
                        } else {
                            console.error('获取360壁纸失败:', response?.error);
                            resolve([]);
                        }
                    }
                );
            } catch (error) {
                clearTimeout(timeout);
                console.error('❌ 发送消息失败:', error);
                resolve([]);
            }
        });
    }
    
    async function fetchAndDisplay360Categories() {
        chrome.runtime.sendMessage(
            { action: 'fetch360Categories' },
            (response) => {
                // 【P1优化】检查chrome.runtime.lastError，静默Service Worker未响应的错误
                if (chrome.runtime.lastError) {
                    console.warn('⚠️ 360分类获取失败（Service Worker未响应）:', chrome.runtime.lastError.message);
                    return;
                }
                
                if (response && response.success && response.data) {
                    const fragment = document.createDocumentFragment();
                    response.data.forEach(cat => {
                        const btn = document.createElement('button');
                        btn.className = 'subnav-btn';
                        btn.dataset.cid = cat.id;
                        btn.textContent = cat.name;
                        if (cat.id === qihu360ActiveCategoryId) {
                            btn.classList.add('active');
                        }
                        fragment.appendChild(btn);
                    });
                    
                    // 保存搜索框
                    const searchBox = qihu360SubNav.querySelector('.search-box');
                    
                    // 清空并重新添加内容
                    qihu360SubNav.innerHTML = '';
                    qihu360SubNav.appendChild(fragment);
                    
                    // 重新添加搜索框到最右侧
                    if (searchBox) {
                        qihu360SubNav.appendChild(searchBox);
                    }
                } else {
                    console.error('获取360壁纸分类失败:', response?.error);
                    qihu360SubNav.innerHTML = '<p>分类加载失败</p>';
                }
            }
        );
    }

    // ==================
    // 壁纸背景设置功能
    // ==================
    
    function setWallpaperAsBackground(imageUrl) {
        try {
            console.log('设置壁纸为背景:', imageUrl);
            
            // 创建壁纸对象
            const wallpaper = {
                url: imageUrl,
                timestamp: Date.now(),
                source: 'wallpaper-library'
            };
            
            // 保存到localStorage
            localStorage.setItem('currentWallpaper', JSON.stringify(wallpaper));
            localStorage.setItem('wallpaperLocked', 'true');
            
            // 使用统一的壁纸应用逻辑
            applyWallpaperStyles(imageUrl);
            
            // 显示成功提示
            showNotification('壁纸已设为背景！', 'success');
            
            console.log('壁纸背景设置成功');
        } catch (error) {
            console.error('设置壁纸背景失败:', error);
            showNotification('设置背景失败，请重试', 'error');
        }
    }
    
    // 统一的壁纸样式应用函数
    function applyWallpaperStyles(imageUrl) {
        // 立即应用背景
        document.body.style.backgroundImage = `url("${imageUrl}")`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundColor = 'transparent';
    }
    
    function showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        // 根据类型设置颜色
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#4CAF50';
                break;
            case 'error':
                notification.style.backgroundColor = '#f44336';
                break;
            default:
                notification.style.backgroundColor = '#2196F3';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // 显示动画
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // 自动隐藏
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
    
    function downloadImage(imageUrl, filename) {
        try {
            console.log('开始下载图片:', imageUrl);
            
            // 使用fetch获取图片数据，然后创建blob URL
            fetch(imageUrl)
                .then(response => response.blob())
                .then(blob => {
                    // 创建blob URL
                    const blobUrl = URL.createObjectURL(blob);
                    
                    // 创建一个临时的a标签来触发下载
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = filename || `wallpaper_${Date.now()}.jpg`;
                    
                    // 添加到DOM并触发点击
                    document.body.appendChild(link);
                    link.click();
                    
                    // 清理
                    document.body.removeChild(link);
                    URL.revokeObjectURL(blobUrl);
                    
                    showNotification('图片下载已开始！', 'success');
                    console.log('图片下载成功');
                })
                .catch(error => {
                    console.error('获取图片数据失败:', error);
                    // 如果fetch失败，回退到直接链接方式
                    const link = document.createElement('a');
                    link.href = imageUrl;
                    link.download = filename || `wallpaper_${Date.now()}.jpg`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showNotification('图片下载已开始！', 'success');
                });
        } catch (error) {
            console.error('图片下载失败:', error);
            showNotification('下载失败，请重试', 'error');
        }
    }

    // ==================
    // 事件处理
    // ==================

    function resetGridAndPagination() {
        currentPage = 1;
        grid.innerHTML = '';
    }

    async function handleNavClick(e) {
        console.log('导航按钮被点击:', e.target);
        const target = e.target;
        if (!target.classList.contains('nav-btn')) {
            console.log('点击的不是导航按钮');
            return;
        }
        
        if (target.classList.contains('active')) {
            console.log('按钮已经是激活状态，无需切换');
            return;
        }

        console.log('开始切换壁纸源...');
        navButtons.forEach(btn => btn.classList.remove('active'));
        target.classList.add('active');

        activeSource = target.dataset.source;
        
        // 【修复】更新拖拽区域显示状态（异步）
        await updateDragDropAreaVisibility();
        console.log('切换到源:', activeSource);
        
        // 隐藏所有子导航
        qihu360SubNav.style.display = 'none';
        bingDateNav.style.display = 'none';
        solidColorNav.style.display = 'none';
        
        // 根据源显示对应的子导航
        if (activeSource === 'qihu360') {
            qihu360SubNav.style.display = 'flex';
            fetchAndDisplay360Categories();
        } else if (activeSource === 'bing') {
            bingDateNav.style.display = 'flex';
        } else if (activeSource === 'solidcolor') {
            solidColorNav.style.display = 'block';
            // 初始化纯色页面
            await initializeDefaultSolidColors();
            isLoading = false;
            loader.style.display = 'none';
            return; // 纯色不需要加载壁纸
        }
        
        resetGridAndPagination();

        if (activeSource === 'qihu360' && qihu360SubNav.children.length === 0) {
            console.log('加载360壁纸分类...');
            fetchAndDisplay360Categories();
        }

        console.log('开始加载壁纸...');
        loadWallpapers();
    }

    function handle360SubNavClick(e) {
        console.log('360子导航被点击:', e.target);
        const target = e.target;
        if (!target.classList.contains('subnav-btn')) {
            console.log('点击的不是360子导航按钮');
            return;
        }
        
        if (target.classList.contains('active')) {
            console.log('360子导航按钮已经是激活状态');
            return;
        }

        console.log('切换360壁纸分类...');
        qihu360SubNav.querySelector('.active')?.classList.remove('active');
        target.classList.add('active');

        qihu360ActiveCategoryId = target.dataset.cid;
        console.log('新的分类ID:', qihu360ActiveCategoryId);
        
        // 清空搜索关键词，恢复分类浏览
        qihu360SearchKeyword = '';
        qihu360SearchInput.value = '';
        
        resetGridAndPagination();
        loadWallpapers();
    }

    function handleBingDateNavClick(e) {
        console.log('必应日期导航被点击:', e.target);
        const target = e.target;
        if (!target.classList.contains('subnav-btn')) {
            console.log('点击的不是日期导航按钮');
            return;
        }
        
        if (target.classList.contains('active')) {
            console.log('日期导航按钮已经是激活状态');
            return;
        }

        console.log('切换必应历史日期范围...');
        bingDateNav.querySelector('.active')?.classList.remove('active');
        target.classList.add('active');

        bingDaysRange = parseInt(target.dataset.days) || 7;
        console.log('新的日期范围:', bingDaysRange, '天');
        resetGridAndPagination();
        loadWallpapers();
    }

    // 绑定事件监听器
    console.log('绑定事件监听器...');
    navButtons.forEach((btn) => {
        btn.onclick = handleNavClick;
    });
    
    qihu360SubNav.onclick = handle360SubNavClick; 
    bingDateNav.onclick = handleBingDateNavClick;
    
    // 文件选择事件
    uploadInput.onchange = (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFileUpload(files);
            // 清空input，允许重复选择相同文件
            e.target.value = '';
        }
    };

    // 【优化】Lightbox 事件处理 - 只在打开时加载原图
    grid.onclick = (e) => {
        const wallpaperItem = e.target.closest('.wallpaper-item');
        if (wallpaperItem) {
            e.preventDefault(); // 阻止 <a> 标签的默认跳转行为
            
            // 【关键】从dataset获取原图URL（而不是立即加载）
            const fullUrl = wallpaperItem.dataset.fullUrl || wallpaperItem.href;
            const thumbnailUrl = wallpaperItem.dataset.thumbnailUrl;
            const info = wallpaperItem.dataset.info || '';
            
            console.log('🖼️ 打开Lightbox，准备加载原图:', fullUrl);
            
            // 先显示缩略图（瞬间显示）
            if (thumbnailUrl) {
                lightboxImg.src = thumbnailUrl;
            }
            
            // 打开lightbox
            lightbox.classList.add('visible');
            
            // 【新增】显示加载指示器
            lightboxImg.style.opacity = '0.5';
            lightboxImg.style.filter = 'blur(5px)';
            
            // 【异步加载原图】
            const loadFullImage = () => {
                // 检查缓存
                if (fullImageCache.has(fullUrl)) {
                    console.log('📦 使用缓存的原图');
                    lightboxImg.src = fullImageCache.get(fullUrl);
                    lightboxImg.style.opacity = '1';
                    lightboxImg.style.filter = 'none';
                    lightboxImg.style.transition = 'all 0.3s ease';
                    downloadBtn.href = fullUrl;
                    lightbox.dataset.currentImageUrl = fullUrl;
                    return;
                }
                
                // 预加载原图
                const fullImg = new Image();
                fullImg.onload = () => {
                    console.log('✅ 原图加载完成');
                    lightboxImg.src = fullUrl;
                    lightboxImg.style.opacity = '1';
                    lightboxImg.style.filter = 'none';
                    lightboxImg.style.transition = 'all 0.3s ease';
                    downloadBtn.href = fullUrl;
                    lightbox.dataset.currentImageUrl = fullUrl;
                    
                    // 缓存原图
                    fullImageCache.set(fullUrl, fullUrl);
                    
                    // 限制缓存大小
                    if (fullImageCache.size > 50) {
                        const firstKey = fullImageCache.keys().next().value;
                        fullImageCache.delete(firstKey);
                    }
                };
                fullImg.onerror = () => {
                    console.warn('⚠️ 原图加载失败，使用缩略图');
                    lightboxImg.style.opacity = '1';
                    lightboxImg.style.filter = 'none';
                };
                fullImg.src = fullUrl;
            };
            
            // 延迟加载原图，让用户先看到界面
            requestAnimationFrame(loadFullImage);
        }
    };

    lightbox.onclick = (e) => {
        // 如果点击的不是控制按钮，则关闭
        if (!e.target.closest('#lightbox-controls')) {
            lightbox.classList.remove('visible');
            // 延迟清空src，让淡出效果更平滑
            setTimeout(() => { lightboxImg.src = ''; }, 300);
        }
    };
    
    // 设为背景按钮事件
    setBackgroundBtn.onclick = (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        
        // 【修复】优先检查是否是纯色/渐变色
        const color = setBackgroundBtn.dataset.color;
        console.log('设为背景按钮点击，color=', color);
        
        if (color) {
            // 纯色或渐变色
            console.log('应用纯色/渐变色背景:', color);
            applySolidColorBackground(color);
            // 设置成功后关闭预览
            lightbox.classList.remove('visible');
            setTimeout(() => { 
                lightboxImg.src = ''; 
                // 清空数据属性
                setBackgroundBtn.dataset.color = '';
                setBackgroundBtn.dataset.name = '';
                downloadBtn.dataset.color = '';
                downloadBtn.dataset.name = '';
            }, 300);
        } else {
            // 图片壁纸
            const imageUrl = lightbox.dataset.currentImageUrl;
            console.log('应用图片背景:', imageUrl);
            if (imageUrl) {
                setWallpaperAsBackground(imageUrl);
                // 关闭预览
                lightbox.classList.remove('visible');
                setTimeout(() => { 
                    lightboxImg.src = ''; 
                    lightbox.dataset.currentImageUrl = '';
                }, 300);
            }
        }
    };
    
    // 下载按钮事件
    downloadBtn.onclick = (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        
        // 【修复】优先检查是否是纯色/渐变色
        const color = downloadBtn.dataset.color;
        const name = downloadBtn.dataset.name;
        console.log('下载按钮点击，color=', color, 'name=', name);
        
        if (color && name) {
            // 纯色或渐变色
            console.log('下载纯色/渐变色:', color, name);
            downloadSolidColor(color, name);
        } else {
            // 图片壁纸
            const imageUrl = lightbox.dataset.currentImageUrl;
            console.log('下载图片:', imageUrl);
            if (imageUrl) {
                // 生成文件名
                const urlParts = imageUrl.split('/');
                const filename = urlParts[urlParts.length - 1] || `wallpaper_${Date.now()}.jpg`;
                downloadImage(imageUrl, filename);
            }
        }
    };

    // ==================
    // 无限滚动功能
    // ==================
    
    function setupInfiniteScroll() {
        let scrollTimeout;
        
        window.addEventListener('scroll', () => {
            // 【新增】检测滚动方向（用于智能预加载）
            const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
            scrollDirection = currentScrollY > lastScrollY ? 'down' : 'up';
            lastScrollY = currentScrollY;
            
            // 防抖处理（更短的延迟）
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                // 检查是否滚动到页面底部
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const windowHeight = window.innerHeight;
                const documentHeight = document.documentElement.scrollHeight;
                
                // 【优化】向下滚动时超激进预加载（距离底部800px）
                const loadDistance = scrollDirection === 'down' ? PRELOAD_NEXT_PAGE_DISTANCE : 300;
                
                // 当滚动到距离底部指定距离时开始加载
                if (scrollTop + windowHeight >= documentHeight - loadDistance) {
                    loadMoreContent();
                }
            }, 100); // 进一步减少防抖延迟到100ms
        }, { passive: true }); // 使用passive监听器提升性能
    }
    
    function loadMoreContent() {
        // 避免重复加载
        if (isLoading) {
            console.log('正在加载中，跳过滚动加载');
            return;
        }
        
        // 我的上传不需要无限滚动（所有图片已加载）
        if (activeSource === 'myuploads') {
            console.log('我的上传页面，无需加载更多');
            return;
        }
        
        // 必应历史支持无限加载
        
        console.log('滚动到底部，开始加载更多内容');
        currentPage++;
        loadWallpapers(true); // 追加模式
    }

    // ==================
    // 初始化
    // ==================
    console.log('壁纸库初始化完成，开始加载壁纸...');
    
    // 【P0优化】初始化IndexedDB并迁移数据
    (async () => {
        try {
            await indexedDBStorage.init();
            console.log('✅ IndexedDB初始化完成');
            
            // 检查是否需要迁移localStorage数据
            const hasIndexedDBData = await indexedDBStorage.getItem(MY_UPLOADS_KEY);
            const hasLocalStorageData = localStorage.getItem(MY_UPLOADS_KEY);
            
            if (!hasIndexedDBData && hasLocalStorageData) {
                console.log('🔄 检测到localStorage数据，开始迁移...');
                await indexedDBStorage.migrateFromLocalStorage();
                
                // 显示存储空间信息
                const storageInfo = await indexedDBStorage.getStorageEstimate();
                if (storageInfo.supported) {
                    console.log(`📊 IndexedDB存储空间: ${storageInfo.usage}MB / ${storageInfo.quota}MB (${storageInfo.percentage}%)`);
                }
            }
        } catch (error) {
            console.error('⚠️ IndexedDB初始化失败，将使用localStorage降级:', error);
        }
    })();
    
    // 【新增】初始化虚拟滚动
    initVirtualScrollObserver();
    
    // 设置无限滚动
    setupInfiniteScroll();
    
    // 【P0优化】启动内存监控
    try {
        memoryMonitor.startMonitoring();
        console.log('✅ 内存监控已启动');
    } catch (error) {
        console.warn('⚠️ 内存监控启动失败:', error);
    }
    
    // 【P0优化】页面卸载时清理资源
    window.addEventListener('beforeunload', () => {
        console.log('🧹 页面即将卸载，清理所有资源...');
        try {
            memoryMonitor.stopMonitoring();
            batchRevokeBlobUrls();
            memoryMonitor.cleanupCache(true);
        } catch (error) {
            console.error('⚠️ 资源清理失败:', error);
        }
    });
    
    // 【P0优化】页面隐藏时清理/暂停资源，可见时恢复
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.log('📱 页面已隐藏，执行轻量清理...');
            try {
                memoryMonitor.pause();
                memoryMonitor.cleanupCache(false);
            } catch (error) {
                console.warn('⚠️ 清理失败:', error);
            }
            loadingPaused = true;
        } else {
            try {
                memoryMonitor.resume();
            } catch (error) {
                console.warn('⚠️ 监控恢复失败:', error);
            }
            loadingPaused = false;
            // 恢复图片加载队列处理
            requestIdleCallback(() => processImageLoadQueue(), { timeout: 100 });
        }
    });
    
    // 初始化360壁纸分类并加载默认壁纸
    fetchAndDisplay360Categories();
    loadWallpapers(false); // 非追加模式，初始加载

    // 暴露性能控制钩子（可选）
    try {
        window.wallpaperPerf = {
            pauseLoading: function() {
                loadingPaused = true;
            },
            resumeLoading: function() {
                loadingPaused = false;
                if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(() => processImageLoadQueue(), { timeout: 100 });
                } else {
                    setTimeout(() => processImageLoadQueue(), 0);
                }
            },
            cleanupCache: function(aggressive) {
                try { return memoryMonitor.cleanupCache(!!aggressive); } catch (e) { return 0; }
            },
            getCacheStats: function() {
                try { return memoryMonitor.getCacheStats(); } catch (e) { return { totalCacheItems: 0 }; }
            },
            batchRevokeBlobUrls: function() {
                try { return batchRevokeBlobUrls(); } catch (e) { return; }
            }
        };
    } catch (e) { /* noop */ }

});
