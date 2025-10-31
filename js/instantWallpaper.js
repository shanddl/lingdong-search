// 立即设置壁纸，消除白屏（完全模仿壁纸库2.5的DOM操作方式）
(function () {
	// 公共壁纸应用函数
	function applyWallpaper(wallpaper, isLocked) {
		// 【修复】检查是否是纯色背景
		const isSolidColor = wallpaper.url && wallpaper.url.startsWith('solid-color:');
		const color = isSolidColor ? wallpaper.url.replace('solid-color:', '') : null;
		
		// 关键方案：同时使用CSS注入（瞬时）+ DOM操作（确保生效）
		// 方案1：CSS注入（在body解析前就生效）
		const styleTag = document.createElement('style');
		if (isSolidColor) {
			// 检查是否是渐变色
			const isGradient = color && color.includes('gradient');
			
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
		} else {
			// 图片背景
			styleTag.textContent = `
				body {
					background-image: url("${wallpaper.url}") !important;
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
				if (isSolidColor) {
					// 检查是否是渐变色
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
				document.body.style.backgroundSize = 'cover';
				document.body.style.backgroundPosition = 'center';
				document.body.style.backgroundRepeat = 'no-repeat';
				document.body.style.backgroundAttachment = 'fixed';
			}
		};
		
		// 立即尝试应用（可能body还未存在）
		applyBodyStyle();
		
		// 确保在body创建后也应用
		if (!document.body) {
			// 使用MutationObserver监听body的创建
			const observer = new MutationObserver(() => {
				if (document.body) {
					applyBodyStyle();
					observer.disconnect();
					console.log(isLocked ? '🔒 壁纸已锁定（body就绪）:' : '⚡ 壁纸已应用（body就绪）:', wallpaper.url);
				}
			});
			observer.observe(document.documentElement, { childList: true });
			
			// 设置超时断开observer，防止内存泄漏
			setTimeout(() => {
				if (observer) observer.disconnect();
			}, 5000);
		} else {
			console.log(isLocked ? '🔒 壁纸已锁定（立即应用）:' : '⚡ 壁纸已应用（立即）:', wallpaper.url);
		}
		
		// 同时隐藏CSS中的默认背景，避免闪烁
		const style = document.createElement('style');
		style.textContent = 'body::before { display: none !important; }';
		(document.head || document.documentElement).appendChild(style);
	}

	try {
		// 检查壁纸锁定状态
		const isLocked = localStorage.getItem('wallpaperLocked') === 'true';
		
		if (isLocked) {
			// 如果壁纸已锁定，恢复保存的壁纸
			const savedWallpaper = localStorage.getItem('currentWallpaper');
			if (savedWallpaper) {
				const wallpaper = JSON.parse(savedWallpaper);
				applyWallpaper(wallpaper, true);
			}
		} else {
			// 如果壁纸未锁定，可以选择随机壁纸或恢复保存的壁纸
			const savedWallpaper = localStorage.getItem('currentWallpaper');
			if (savedWallpaper) {
				const wallpaper = JSON.parse(savedWallpaper);
				applyWallpaper(wallpaper, false);
			}
		}
	} catch (error) {
		console.warn('壁纸瞬间加载失败:', error);
	}
})();
