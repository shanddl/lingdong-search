// 预加载壁纸图片，确保缓存（在 <head> 中以外部脚本方式执行，兼容扩展CSP）
// 修复：添加超时控制，避免慢速图片阻塞页面加载指示器
(function () {
	try {
		// 检查壁纸锁定状态
		const isLocked = localStorage.getItem('wallpaperLocked') === 'true';
		
		const savedWallpaper = localStorage.getItem('currentWallpaper');
		if (savedWallpaper) {
			const wallpaper = JSON.parse(savedWallpaper);
			
			// 使用异步方式预加载，不阻塞页面
			// 延迟到 DOMContentLoaded 之后执行，不影响页面加载状态
			const preloadImage = () => {
				const img = new Image();
				
				// 设置超时，避免长时间等待
				const timeout = setTimeout(() => {
					console.warn('⏱️ 壁纸预加载超时（5秒），取消加载');
					img.src = ''; // 取消加载
				}, 5000);
				
				img.addEventListener('load', function () {
					clearTimeout(timeout);
					console.log(isLocked ? '🔒 锁定壁纸预加载完成' : '✅ 壁纸预加载完成');
				});
				
				img.addEventListener('error', function () {
					clearTimeout(timeout);
					console.warn('壁纸预加载失败:', wallpaper.url);
				});
				
				img.src = wallpaper.url;
			};
			
			// 延迟到页面加载后执行，不影响加载指示器
			if (document.readyState === 'loading') {
				document.addEventListener('DOMContentLoaded', preloadImage);
			} else {
				// 如果 DOM 已经加载，使用 setTimeout 确保异步执行
				setTimeout(preloadImage, 0);
			}
		}
	} catch (error) {
		console.warn('壁纸预加载失败:', error);
	}
})();

