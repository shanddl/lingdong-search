// 壁纸应用公共模块
// 统一 instantWallpaper.js 和 wallpaper-standalone.js 的壁纸应用逻辑

/**
 * 应用壁纸到页面
 * @param {Object} wallpaper - 壁纸对象 { url, timestamp, source, color }
 * @param {boolean} isLocked - 是否锁定壁纸
 * @param {boolean} saveToStorage - 是否保存到localStorage (默认true)
 */
function applyWallpaperToPage(wallpaper, isLocked = false, saveToStorage = true) {
    try {
        // 保存到localStorage
        if (saveToStorage) {
            localStorage.setItem('currentWallpaper', JSON.stringify(wallpaper));
            localStorage.setItem('wallpaperLocked', isLocked ? 'true' : 'false');
        }
        
        // 检查是否是纯色/渐变背景
        const isSolidColor = wallpaper.url && wallpaper.url.startsWith('solid-color:');
        const color = isSolidColor ? wallpaper.url.replace('solid-color:', '') : null;
        
        if (isSolidColor) {
            // 纯色或渐变背景
            const isGradient = color && color.includes('gradient');
            
            if (isGradient) {
                // 渐变背景
                document.body.style.backgroundImage = color;
                document.body.style.backgroundColor = '';
            } else {
                // 纯色背景
                document.body.style.backgroundImage = 'none';
                document.body.style.backgroundColor = color;
            }
        } else {
            // 图片背景
            document.body.style.backgroundImage = `url("${wallpaper.url}")`;
            document.body.style.backgroundColor = '';
        }
        
        // 应用通用样式
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.style.backgroundAttachment = 'fixed';
        
        console.log(isLocked ? '🔒 壁纸已锁定:' : '✅ 壁纸已应用:', wallpaper.url);
        return true;
    } catch (error) {
        console.error('应用壁纸失败:', error);
        return false;
    }
}

/**
 * 从localStorage加载并应用壁纸
 * @returns {boolean} 是否成功加载并应用
 */
function loadAndApplyWallpaper() {
    try {
        const isLocked = localStorage.getItem('wallpaperLocked') === 'true';
        const savedWallpaper = localStorage.getItem('currentWallpaper');
        
        if (savedWallpaper) {
            const wallpaper = JSON.parse(savedWallpaper);
            return applyWallpaperToPage(wallpaper, isLocked, false);
        }
        
        return false;
    } catch (error) {
        console.warn('加载壁纸失败:', error);
        return false;
    }
}

// 导出函数（如果是模块环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        applyWallpaperToPage,
        loadAndApplyWallpaper
    };
}

