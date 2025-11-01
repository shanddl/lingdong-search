// 页面加载动画 - 俏皮、连贯、顺滑的多组件动画效果
// 支持配置文件自定义（如果存在 animationConfig.js）
(function() {
    // 默认配置
    let config = {
        speedMultiplier: 1.0,
        durations: {
            searchBox: 900,
            pills: 700,
            navItems: 800,
            dock: 900,
            wallpaperBtn: 900,
            pageTitle: 600
        },
        delays: {
            searchBox: 150,
            pills: 300,
            navItems: 550,
            navItemStagger: 45,
            dock: 1000,
            wallpaperBtn: 250,
            pageTitle: 200
        },
        easings: {
            bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
            smooth: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            ease: 'ease-out'
        },
        navAnimation: {
            type: 'spiral',
            spiralAngle: 137.5,
            spiralDistance: 30,
            randomRange: 60
        },
        enabled: {
            searchBox: true,
            pills: true,
            navItems: true,
            dock: true,
            wallpaperBtn: true,
            pageTitle: true
        }
    };
    
    // 尝试加载外部配置（如果存在）
    try {
        if (typeof ANIMATION_CONFIG !== 'undefined') {
            config = Object.assign({}, config, ANIMATION_CONFIG);
        }
    } catch (e) {
        // 配置文件不存在，使用默认配置
    }
    
    // 等待DOM加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPageAnimation);
    } else {
        initPageAnimation();
    }
    
    function initPageAnimation() {
        const speed = config.speedMultiplier;
        const dur = config.durations;
        const delay = config.delays;
        const easing = config.easings;
        const enabled = config.enabled;
        
        // ========== 1. 搜索框 - 从斜上方旋转飞入（俏皮效果，增强版）==========
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            if (enabled.searchBox) {
                headerContainer.style.opacity = '0';
                headerContainer.style.transform = 'translateY(-150px) translateX(-100px) scale(0.6) rotate(-20deg)';
                headerContainer.style.filter = 'blur(10px)';
                
                setTimeout(() => {
                    headerContainer.style.transition = `all ${dur.searchBox * speed}ms ${easing.bounce}, filter ${dur.searchBox * speed * 0.8}ms ${easing.ease}`;
                    headerContainer.style.opacity = '1';
                    headerContainer.style.transform = 'translateY(0) translateX(0) scale(1) rotate(0deg)';
                    headerContainer.style.filter = 'blur(0px)';
                }, delay.searchBox);
            } else {
                // 动画禁用时立即显示
                headerContainer.style.opacity = '1';
            }
        }
        
        // ========== 2. Pills容器 - 从左侧弹性滑入并摇摆（增强版）==========
        const pillsContainer = document.getElementById('active-scope-pills-container');
        if (pillsContainer) {
            if (enabled.pills) {
                pillsContainer.style.opacity = '0';
                pillsContainer.style.transform = 'translateX(-120px) rotate(-10deg) scale(0.75)';
                pillsContainer.style.filter = 'blur(8px)';
                
                setTimeout(() => {
                    pillsContainer.style.transition = `all ${dur.pills * speed}ms ${easing.smooth}, filter ${dur.pills * speed * 0.8}ms ${easing.ease}`;
                    pillsContainer.style.opacity = '1';
                    pillsContainer.style.transform = 'translateX(0) rotate(0deg) scale(1)';
                    pillsContainer.style.filter = 'blur(0px)';
                    
                    // 摇摆效果：到位后轻微晃动
                    setTimeout(() => {
                        pillsContainer.style.transition = 'transform 0.35s ease-in-out';
                        pillsContainer.style.transform = 'rotate(4deg)';
                        setTimeout(() => {
                            pillsContainer.style.transform = 'rotate(-3deg)';
                            setTimeout(() => {
                                pillsContainer.style.transform = 'rotate(0deg)';
                            }, 170);
                        }, 170);
                    }, dur.pills * speed);
                }, delay.pills);
            } else {
                // 动画禁用时立即显示
                pillsContainer.style.opacity = '1';
            }
        }
        
        // ========== 3. 导航图标 - 多种动画效果 ==========
        if (enabled.navItems) {
        setTimeout(() => {
            const navItems = document.querySelectorAll('.nav-item');
                const navConfig = config.navAnimation;
                
            navItems.forEach((item, index) => {
                    let initialTransform = '';
                    
                    // 根据配置选择不同的动画效果
                    switch (navConfig.type) {
                        case 'spiral': // 螺旋展开
                            const angle = (index * navConfig.spiralAngle) * (Math.PI / 180);
                            const distance = Math.sqrt(index) * navConfig.spiralDistance;
                            initialTransform = `
                                translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)
                                scale(0.3)
                                rotate(${angle * 2}rad)
                            `;
                            break;
                            
                        case 'wave': // 波浪效果
                            const wave = Math.sin(index * 0.5) * 40;
                            initialTransform = `translateY(${wave}px) scale(0.5) rotate(${wave}deg)`;
                            break;
                            
                        case 'random': // 随机方向
                            const rx = (Math.random() - 0.5) * navConfig.randomRange;
                            const ry = (Math.random() - 0.5) * navConfig.randomRange;
                            const rr = (Math.random() - 0.5) * 360;
                            initialTransform = `translate(${rx}px, ${ry}px) scale(0.4) rotate(${rr}deg)`;
                            break;
                            
                        case 'simple': // 简单淡入
                        default:
                            initialTransform = `scale(0.6) translateY(40px) rotate(-5deg)`;
                            break;
                    }
                    
                    // 设置初始状态
                item.style.opacity = '0';
                    item.style.transform = initialTransform;
                    
                    // 交错延迟后展开到正确位置
                    setTimeout(() => {
                        item.style.transition = `all ${dur.navItems * speed}ms ${easing.smooth}`;
                        item.style.opacity = '1';
                        item.style.transform = 'translate(0, 0) scale(1) rotate(0deg)';
                        
                        // ========== 俏皮效果：每隔几个图标添加"眨眼"动画 ==========
                        // 每5个图标中随机1-2个做眨眼效果
                        if (index % 5 === 0 || index % 7 === 0) {
                            setTimeout(() => {
                                // 眨眼动画：快速翻转
                                item.style.transition = 'transform 0.15s ease-in-out';
                                item.style.transform = 'scaleY(0.1) rotate(0deg)'; // 压扁（闭眼）
                                
                                setTimeout(() => {
                                    item.style.transform = 'scaleY(1) rotate(0deg)'; // 恢复（睁眼）
                                    
                                    // 可选：再眨一次
                                    setTimeout(() => {
                                        item.style.transform = 'scaleY(0.1) rotate(0deg)';
                                        setTimeout(() => {
                                            item.style.transform = 'scaleY(1) rotate(0deg)';
                                        }, 100);
                                    }, 200);
                                }, 100);
                            }, 300); // 图标出现后300ms开始眨眼
                        }
                        
                        // ========== 俏皮效果：某些图标做360度旋转 ==========
                        if (index % 8 === 0 && index !== 0) {
                            setTimeout(() => {
                                item.style.transition = 'transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
                                item.style.transform = 'rotate(360deg)';
                                setTimeout(() => {
                                    item.style.transform = 'rotate(0deg)';
                                }, 600);
                            }, 400);
                        }
                    }, index * delay.navItemStagger);
                });
            }, delay.navItems);
        }
        
        // ========== 4. Dock栏 - 从斜下方旋转弹出（俏皮效果，增强版）==========
        const dockContainer = document.getElementById('navigation-tabs-container');
        if (dockContainer) {
            if (enabled.dock) {
                setTimeout(() => {
                    dockContainer.style.opacity = '0';
                    dockContainer.style.transform = 'translateY(180px) translateX(-80px) scale(0.5) rotate(15deg)';
                    dockContainer.style.filter = 'blur(15px)';
                    
                    setTimeout(() => {
                        dockContainer.style.transition = `all ${dur.dock * speed}ms ${easing.bounce}, filter ${dur.dock * speed * 0.75}ms ${easing.ease}`;
                        dockContainer.style.opacity = '1';
                        // 【修复】使用translateZ(0)启用硬件加速，同时避免文字模糊
                        dockContainer.style.transform = 'translateY(0) translateX(0) scale(1) rotate(0deg) translateZ(0)';
                        dockContainer.style.filter = 'blur(0px)';
                        
                        // 弹出后晃动一下（增强版）
                        setTimeout(() => {
                            dockContainer.style.transition = 'transform 0.45s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
                            dockContainer.style.transform = 'scale(1.08) translateZ(0)';
                            setTimeout(() => {
                                dockContainer.style.transform = 'scale(0.98) translateZ(0)';
                                setTimeout(() => {
                                    // 【修复】动画结束后完全重置transform，确保文字清晰
                                    dockContainer.style.transform = 'translateZ(0)';
                                    dockContainer.style.willChange = 'auto';
                                    // 强制重绘以确保清晰度
                                    void dockContainer.offsetHeight;
                                }, 180);
                            }, 220);
                        }, dur.dock * speed);
                    }, 50);
                }, delay.dock);
            } else {
                // 动画禁用时立即显示
                dockContainer.style.opacity = '1';
            }
        }
        
        // ========== 5. 壁纸库按钮 - 多圈旋转+弹跳（超俏皮，增强版）==========
        const wallpaperBtn = document.querySelector('.wallpaper-library-btn');
        if (wallpaperBtn) {
            if (enabled.wallpaperBtn) {
                wallpaperBtn.style.opacity = '0';
                wallpaperBtn.style.transform = 'rotate(-810deg) scale(0.15) translateX(-120px)';
                wallpaperBtn.style.filter = 'blur(12px)';
                
                setTimeout(() => {
                    wallpaperBtn.style.transition = `all ${dur.wallpaperBtn * speed}ms ${easing.bounce}, filter ${dur.wallpaperBtn * speed * 0.7}ms ${easing.ease}`;
                    wallpaperBtn.style.opacity = '0.25'; // 最终透明度为0.25，不是1
                    wallpaperBtn.style.transform = 'rotate(0deg) scale(1) translateX(0)';
                    wallpaperBtn.style.filter = 'blur(0px)';
                    
                    // 到位后做一个"点头"动作
                    setTimeout(() => {
                        wallpaperBtn.style.transition = 'transform 0.35s ease-in-out';
                        wallpaperBtn.style.transform = 'scale(1.2) rotate(12deg)';
                        setTimeout(() => {
                            wallpaperBtn.style.transform = 'scale(0.9) rotate(-8deg)';
                            setTimeout(() => {
                                wallpaperBtn.style.transform = 'scale(1) rotate(0deg)';
                            }, 160);
                        }, 160);
                    }, dur.wallpaperBtn * speed + 250);
                }, delay.wallpaperBtn);
            } else {
                // 动画禁用时立即显示（默认透明度0.25）
                wallpaperBtn.style.opacity = '0.25';
            }
        }
        
        // ========== 6. 页面标题 - 轻微缩放淡入（增强版）==========
        if (enabled.pageTitle) {
            const pageTitle = document.querySelector('.page-title');
            if (pageTitle && pageTitle.textContent.trim()) {
                pageTitle.style.opacity = '0';
                pageTitle.style.transform = 'scale(0.9) translateY(-10px)';
                pageTitle.style.filter = 'blur(5px)';
                
                setTimeout(() => {
                    pageTitle.style.transition = `all ${dur.pageTitle * speed}ms ${easing.smooth}, filter ${dur.pageTitle * speed * 0.8}ms ${easing.ease}`;
                    pageTitle.style.opacity = '1';
                    pageTitle.style.transform = 'scale(1) translateY(0)';
                    pageTitle.style.filter = 'blur(0px)';
                }, delay.pageTitle);
            }
        }
        
        // ========== 7. 标记动画完成 ==========
        // 如果所有主要动画都被禁用，立即标记为完成
        if (!enabled.searchBox && !enabled.pills && !enabled.navItems && !enabled.dock && !enabled.wallpaperBtn) {
            document.body.classList.add('animations-complete');
        } else {
            // 否则，计算最长的固定动画时间（Dock栏动画）并添加缓冲
            const longestAnimationTime = delay.dock + dur.dock * speed + 500; // 额外500ms缓冲
            setTimeout(() => {
                document.body.classList.add('animations-complete');
            }, longestAnimationTime);
        }
    }
})();
