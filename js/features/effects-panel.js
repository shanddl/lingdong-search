// 外观设置面板管理（优化版）

/**
 * 滑块配置
 * 统一管理所有滑块的配置信息
 */
const SLIDER_CONFIG = {
    // 壁纸背景适配滑块
    wallpaper: [
        {
            id: 'overlay-opacity-slider',
            valueId: 'effects-val-overlay',
            cssVar: '--overlay-opacity',
            storageKey: 'wallpaperEffects.overlayOpacity',
            format: (v) => `${v}%`,
            toCSS: (v) => v / 100,
        },
        {
            id: 'search-bg-opacity-slider',
            valueId: 'effects-val-search-bg',
            cssVar: '--search-bg-opacity',
            storageKey: 'wallpaperEffects.searchBgOpacity',
            format: (v) => `${v}%`,
            toCSS: (v) => v / 100,
            applyFn: (value) => {
                // 动态调整搜索框文字和按钮颜色
                // 当背景不透明度为0时，使用白色；不透明度增加时，逐渐变为深色
                const opacity = value / 100;
                
                // 计算文字颜色：从白色渐变到深灰色
                const textLightness = Math.max(240 - opacity * 190, 50); // 240 -> 50
                const textColor = `rgba(${textLightness}, ${textLightness}, ${textLightness + 10}, 0.9)`;
                
                // 计算按钮颜色：从白色渐变到深灰色
                const btnLightness = Math.max(235 - opacity * 175, 60); // 235 -> 60
                const btnColor = `rgba(${btnLightness}, ${btnLightness}, ${btnLightness + 10}, 0.8)`;
                
                // 计算时钟颜色：从浅金色到深金色
                const clockBrightness = Math.max(226 - opacity * 26, 200); // 226 -> 200
                const clockColor = `rgb(${clockBrightness}, ${Math.floor(clockBrightness * 0.69)}, ${Math.floor(clockBrightness * 0.36)})`;
                
                // 应用颜色
                document.documentElement.style.setProperty('--search-text-color', textColor);
                document.documentElement.style.setProperty('--search-btn-color', btnColor);
                document.documentElement.style.setProperty('--search-clock-color', clockColor);
            },
        },
        {
            id: 'search-blur-slider',
            valueId: 'effects-val-search-blur',
            cssVar: '--search-blur',
            storageKey: 'wallpaperEffects.searchBlur',
            format: (v) => `${v}px`,
            toCSS: (v) => `${v}px`,
        },
        {
            id: 'search-border-opacity-slider',
            valueId: 'effects-val-search-border',
            cssVar: '--search-border-opacity',
            storageKey: 'wallpaperEffects.searchBorderOpacity',
            format: (v) => `${v}%`,
            toCSS: (v) => v / 100,
        },
        {
            id: 'icon-bg-opacity-slider',
            valueId: 'effects-val-icon-bg',
            cssVar: '--icon-bg-opacity',
            storageKey: 'wallpaperEffects.iconBgOpacity',
            format: (v) => `${v}%`,
            toCSS: (v) => v / 100,
        },
        {
            id: 'icon-blur-slider',
            valueId: 'effects-val-icon-blur',
            cssVar: '--icon-blur',
            storageKey: 'wallpaperEffects.iconBlur',
            format: (v) => `${v}px`,
            toCSS: (v) => `${v}px`,
        },
        {
            id: 'text-shadow-opacity-slider',
            valueId: 'effects-val-text-shadow',
            cssVar: '--text-shadow-opacity',
            storageKey: 'wallpaperEffects.textShadowOpacity',
            format: (v) => `${v}%`,
            toCSS: (v) => v / 100,
        },
    ],
    
    // 搜索框滑块
    searchbox: [
        {
            id: 'position-slider',
            valueId: 'effects-val-pos',
            storageKey: 'searchboxTop',
            format: (v) => `${v}%`,
            applyFn: (value) => window.core?.applySearchboxPosition(value),
        },
        {
            id: 'width-slider',
            valueId: 'effects-val-width',
            storageKey: 'searchboxWidth',
            format: (v) => `${v}px`,
            applyFn: (value) => window.core?.applySearchboxWidth(value),
        },
        {
            id: 'scope-width-slider',
            valueId: 'effects-val-scope',
            storageKey: 'scopeMenuWidth',
            format: (v) => `${v}px`,
            applyFn: (value) => window.core?.applyScopeMenuWidth(value),
        },
    ],
    
    // 图标滑块
    navigation: [
        {
            id: 'nav-item-size-slider',
            valueId: 'effects-val-size',
            storageKey: 'navigationItemSize',
            format: (v) => `${v}px`,
            applyFn: (value, state) => {
                const gap = state?.userData?.navigationGridGap;
                window.navigationModule?.utils?.applyAppearanceSettings(value, gap);
            },
        },
        {
            id: 'nav-grid-gap-slider',
            valueId: 'effects-val-gap',
            storageKey: 'navigationGridGap',
            format: (v) => `${v}px`,
            applyFn: (value, state) => {
                const size = state?.userData?.navigationItemSize;
                window.navigationModule?.utils?.applyAppearanceSettings(size, value);
            },
        },
        {
            id: 'nav-min-width-slider',
            valueId: 'effects-val-min',
            storageKey: 'navigationSettings.minWidth',
            format: (v) => `${v}px`,
            applyFn: (value) => {
                const navGrid = document.getElementById('navigation-grid');
                navGrid?.style.setProperty('--nav-item-min-width', `${value}px`);
            },
        },
        {
            id: 'dock-scale-slider',
            valueId: 'effects-val-dock',
            cssVar: '--dock-scale',
            storageKey: 'dockSettings.scale',
            format: (v) => `${v.toFixed(1)}x`,
            toCSS: (v) => v,
        },
    ],
};

/**
 * 外观设置面板类
 */
class EffectsPanel {
    constructor() {
        this.panel = document.getElementById('effectsSettingsPanel');
        this.overlay = document.getElementById('effectsPanelOverlay');
        this.settingsLoaded = false;
        // 【内存优化】CSS变量更新节流控制
        this._cssVarUpdateTimer = null;
        this._pendingCssVars = new Map(); // 存储待更新的CSS变量
        
        this.init();
    }
    
    init() {
        this.bindPanelEvents();
        this.bindTabs();
        this.bindAccordion();
        this.bindSliders();
        this.bindButtons();
        this.applyCriticalSettings();
        this.loadPanelPosition(); // 加载保存的面板位置
        // 注意：applySavedCSSVariables 在 core.applyAllSettings 中调用（数据加载完成后）
        
        // ESC键关闭 - 使用具名函数以便后续移除，防止内存泄漏
        this.handleEscKey = (e) => {
            if (e.key === 'Escape' && this.panel.classList.contains('visible')) {
                this.closePanel();
            }
        };
        document.addEventListener('keydown', this.handleEscKey);
    }
    
    /**
     * 恢复事件监听器（在openPanel中调用，确保监听器已绑定）
     */
    restoreEventListeners() {
        // 检查并重新绑定事件监听器（如果之前被移除）
        // ESC键监听器
        if (this.handleEscKey) {
            // 先尝试移除（防止重复绑定）
            document.removeEventListener('keydown', this.handleEscKey);
            document.addEventListener('keydown', this.handleEscKey);
        }
        // 遮罩层点击监听器
        if (this.handleOverlayClick) {
            this.overlay.removeEventListener('click', this.handleOverlayClick);
            this.overlay.addEventListener('click', this.handleOverlayClick);
        }
        // 恢复拖动功能的文档级监听器（如果存在）
        // cleanupResize 会移除 mousemove 和 mouseup，但不会移除 handleMouseDown（它在 handle 元素上）
        // 这里恢复文档级的监听器，确保拖动功能正常工作
        if (this.handleMouseMove && this.handleMouseUp) {
            // 先移除（防止重复绑定）
            document.removeEventListener('mousemove', this.handleMouseMove);
            document.removeEventListener('mouseup', this.handleMouseUp);
            // 重新绑定
            document.addEventListener('mousemove', this.handleMouseMove);
            document.addEventListener('mouseup', this.handleMouseUp);
        }
        // 注意：bindAccordion、bindTabs、bindSliders、bindButtons 使用的是直接绑定
        // 它们的监听器绑定在DOM元素上，如果元素不被移除，监听器不会被累积
        // 因此这里不需要恢复（因为它们从未被移除）
    }
    
    openPanel() {
        if (!this.settingsLoaded) {
            this.loadSliderValues();
            this.loadPanelTheme();
            this.loadActiveTab();
            this.settingsLoaded = true;
        }
        
        // 恢复事件监听器（如果之前被移除）
        this.restoreEventListeners();
        
        // 移除HTML中的内联display:none并添加ready类
        this.panel.style.display = '';
        this.panel.classList.add('ready');
        
        // 使用requestAnimationFrame确保样式应用后再添加visible类
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.panel.classList.add('visible');
            });
        });
        this.overlay.classList.add('visible');
        document.body.style.overflow = 'hidden';

        // 打开后标注面板内的重内容容器与预览图，便于关闭时回收
        this.markHeavyContent();
    }
    
    loadPanelTheme() {
        // 从state中读取保存的主题
        const savedTheme = window.state?.userData?.panelSettings?.theme || 'light';
        
        // 应用主题
        if (savedTheme === 'dark') {
            this.panel.classList.add('dark-theme');
        } else {
            this.panel.classList.remove('dark-theme');
        }
        
        // 更新按钮状态
        document.querySelectorAll('[data-action="set-panel-theme"]').forEach(btn => {
            if (btn.dataset.theme === savedTheme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    loadActiveTab() {
        // 从state中读取保存的Tab
        const savedTab = window.state?.userData?.panelSettings?.activeTab || 'appearance';
        
        // 切换到保存的Tab
        this.switchTab(savedTab);
    }
    
    closePanel() {
        // 1) 立即隐藏视觉层
        this.panel.classList.remove('visible');
        this.overlay.classList.remove('visible');
        document.body.style.overflow = '';

        // 2) 立即停止面板专属的全局/文档级监听（拖拽）
        if (typeof this.cleanupResize === 'function') {
            try { this.cleanupResize(); } catch (e) { /* noop */ }
        }
        
        // 2.5) 【内存优化】移除所有事件监听器，防止内存泄漏
        try {
            // 移除ESC键监听器
            if (this.handleEscKey) {
                document.removeEventListener('keydown', this.handleEscKey);
            }
            // 移除遮罩层点击监听器
            if (this.handleOverlayClick) {
                this.overlay.removeEventListener('click', this.handleOverlayClick);
            }
            // 清理CSS变量更新定时器
            if (this._cssVarUpdateTimer) {
                clearTimeout(this._cssVarUpdateTimer);
                this._cssVarUpdateTimer = null;
            }
            // 清空待更新的CSS变量
            if (this._pendingCssVars) {
                this._pendingCssVars.clear();
            }
            // 注意：bindAccordion、bindTabs、bindSliders、bindButtons 使用的是直接绑定
            // 它们的监听器绑定在DOM元素上，只要元素不被移除，就不会累积
            // 因此这里不需要移除（这些元素不会被移除）
        } catch (e) {
            console.warn('[Effects Panel] Error removing event listeners:', e);
        }

        // 3) 动画结束后（约300-500ms），清理重内容与预览引用
        setTimeout(() => {
            try {
                // 折叠所有手风琴，减少常驻DOM
                this.panel.querySelectorAll('.effects-accordion-item.expanded')
                    .forEach(item => item.classList.remove('expanded'));

                // 仅清空动态列表数据区，保留 Tab/容器结构，避免二次打开界面缺失
                const dynamicListSelectors = ['#engine-list', '#scope-list', '#ai-list'];
                dynamicListSelectors.forEach(sel => {
                    const el = this.panel.querySelector(sel);
                    if (el) el.innerHTML = '';
                });

                // 释放图片解码与内存：移除面板内预览图的 src（需为预览图加 data-preview）
                this.panel.querySelectorAll('img[data-preview]')
                    .forEach(img => { 
                        if (img.src && !img.src.startsWith('data:')) {
                            // 如果是blob URL，先释放它（在清空src之前）
                            const originalSrc = img.src;
                            if (URL.revokeObjectURL && originalSrc.startsWith('blob:')) {
                                try {
                                    URL.revokeObjectURL(originalSrc);
                                } catch (e) { /* ignore */ }
                            }
                            // 清空src和相关属性
                            img.src = '';
                            img.removeAttribute('src');
                            img.removeAttribute('srcset');
                            img.onload = null;
                            img.onerror = null;
                        }
                    });
                
                // 【内存优化】设置display:none以彻底释放内存
                this.panel.style.display = 'none';
                
                // 强制垃圾回收提示（如果可用）
                if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(() => {
                        // 提示GC清理内存
                        if (window.gc) window.gc();
                    }, { timeout: 500 });
                }
            } catch (e) { /* noop */ }
        }, 500);

        // 4) 延迟空闲清理（~1.5s 内分批）：移除委托/缓存等残余引用
        const idleCleanup = () => {
            try {
                // 如果你的渲染层提供了统一事件清理接口，可在此调用对应分类
                if (window.render && typeof window.render.cleanupEventIds === 'function') {
                    window.render.cleanupEventIds('effectsPanel');
                }
                // 清理可能挂在实例上的临时引用
                if (this.iconPreview) this.iconPreview = null;
                if (this._tempImages) this._tempImages = [];
            } catch (e) { /* noop */ }
        };

        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(idleCleanup, { timeout: 1500 });
        } else {
            setTimeout(idleCleanup, 1500);
        }
    }
    
    bindPanelEvents() {
        // 只通过遮罩层关闭 - 使用具名函数以便后续移除
        this.handleOverlayClick = () => this.closePanel();
        this.overlay.addEventListener('click', this.handleOverlayClick);
        
        // 绑定拖动调整宽度功能
        this.bindResizeHandle();
    }
    
    /**
     * 绑定拖动调整宽度的手柄
     */
    bindResizeHandle() {
        const handle = document.getElementById('effectsPanelResizeHandle');
        if (!handle) return;
        
        // 如果已经绑定过，先清理旧的监听器（防止重复绑定导致累积）
        if (this.cleanupResize) {
            try {
                this.cleanupResize();
            } catch (e) {
                console.warn('[Effects Panel] Error cleaning up old resize listeners:', e);
            }
        }
        
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        const minWidth = 280;
        const maxWidth = 600;
        
        // 加载保存的宽度
        const savedWidth = localStorage.getItem('effectsPanelWidth');
        if (savedWidth) {
            const width = parseInt(savedWidth);
            if (width >= minWidth && width <= maxWidth) {
                this.panel.style.width = width + 'px';
            }
        }
        
        const handleMouseDown = (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = this.panel.offsetWidth;
            
            // 添加拖动样式（禁用transition以获得流畅的拖动体验）
            this.panel.classList.add('resizing');
            document.body.classList.add('panel-resizing');
            
            // 临时禁用transform transition，只在拖动时生效
            this.panel.style.transition = 'none';
            
            // 阻止文本选择
            e.preventDefault();
        };
        
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            
            // 根据面板位置调整拖动方向
            // 右侧面板：拖动手柄在左边，向左拖=增加宽度，向右拖=减少宽度（需要取反）
            // 左侧面板：拖动手柄在右边，向右拖=增加宽度，向左拖=减少宽度（正常）
            const isLeftPanel = this.panel.classList.contains('panel-left');
            const deltaX = e.clientX - startX;
            const adjustedDelta = isLeftPanel ? deltaX : -deltaX;
            let newWidth = startWidth + adjustedDelta;
            
            // 限制宽度范围
            newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
            
            // 应用新宽度
            this.panel.style.width = newWidth + 'px';
        };
        
        const handleMouseUp = () => {
            if (!isResizing) return;
            
            isResizing = false;
            
            // 移除拖动样式
            this.panel.classList.remove('resizing');
            document.body.classList.remove('panel-resizing');
            
            // 恢复transition
            this.panel.style.transition = '';
            
            // 保存宽度到localStorage
            const finalWidth = this.panel.offsetWidth;
            localStorage.setItem('effectsPanelWidth', finalWidth.toString());
        };
        
        // 保存引用以便后续移除
        this.handleMouseDown = handleMouseDown;
        this.handleMouseMove = handleMouseMove;
        this.handleMouseUp = handleMouseUp;
        
        // 绑定事件
        handle.addEventListener('mousedown', this.handleMouseDown);
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
        
        // 保存handle引用以便清理
        this.resizeHandle = handle;
        
        // 清理函数（移除所有拖动相关监听器）
        this.cleanupResize = () => {
            if (this.resizeHandle && this.handleMouseDown) {
                this.resizeHandle.removeEventListener('mousedown', this.handleMouseDown);
            }
            if (this.handleMouseMove) {
                document.removeEventListener('mousemove', this.handleMouseMove);
            }
            if (this.handleMouseUp) {
                document.removeEventListener('mouseup', this.handleMouseUp);
            }
        };
    }
    
    /**
     * 绑定Tab切换事件
     */
    bindTabs() {
        const tabs = this.panel.querySelectorAll('.effects-tab');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }
    
    /**
     * 切换Tab
     * @param {string} tabName - Tab名称（appearance, search, navigation, system）
     */
    switchTab(tabName) {
        // 更新Tab按钮状态
        this.panel.querySelectorAll('.effects-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // 更新内容区域
        this.panel.querySelectorAll('.effects-tab-content').forEach(content => {
            content.classList.toggle('active', content.dataset.tabContent === tabName);
        });
        
        // 保存当前Tab到userData
        if (window.state?.userData?.panelSettings) {
            window.state.userData.panelSettings.activeTab = tabName;
        }
    }
    
    /**
     * 绑定折叠菜单事件（算盘珠效果）
     */
    bindAccordion() {
        const accordionItems = this.panel.querySelectorAll('.effects-accordion-item');
        
        accordionItems.forEach(item => {
            const header = item.querySelector('.effects-accordion-header');
            
            header.addEventListener('click', () => {
                const isExpanded = item.classList.contains('expanded');
                const accordionType = item.dataset.accordion;
                
                if (isExpanded) {
                    // 如果已展开，则收起
                    item.classList.remove('expanded');
                } else {
                    // 关闭所有其他项
                    accordionItems.forEach(otherItem => {
                        otherItem.classList.remove('expanded');
                    });
                    
                    // 展开当前项
                    item.classList.add('expanded');
                    
                    // 延迟后渲染对应的数据
                    console.log('[Effects Panel] Accordion expanded:', accordionType);
                    setTimeout(() => {
                        this.renderAccordionData(accordionType);
                    }, 50);
                }
            });
        });
    }
    
    renderAccordionData(accordionType) {
        console.log('[Effects Panel] Rendering data for:', accordionType);
        
        // 动态导入并调用对应的渲染函数
        switch(accordionType) {
            case 'scope-management':
                import('../ui/render.js').then(module => {
                    console.log('[Effects Panel] Rendering scope management');
                    module.render.scopeManagementModal();
                    import('./managementHandlers.js').then(m => m.managementHandlers.showScopeList());
                });
                break;
            case 'engine-management':
                import('../ui/render.js').then(module => {
                    console.log('[Effects Panel] Rendering engine management');
                    module.render.engineManagementModal();
                    import('./managementHandlers.js').then(m => {
                        m.managementHandlers.resetEngineForm();
                        // 重新绑定图标预览功能
                        this.bindEngineIconPreview();
                        // 渲染完成后标注重内容与预览
                        this.markHeavyContent();
                    });
                });
                break;
            case 'ai-management':
                import('./ai-settings.js').then(module => {
                    console.log('[Effects Panel] Rendering AI management');
                    module.aiSettings.renderAIList();
                    module.aiSettings.resetForm();
                    // 渲染完成后标注
                    this.markHeavyContent();
                });
                break;
            case 'nav-group-management':
                import('./navigation.js').then(module => {
                    console.log('[Effects Panel] Rendering nav group management');
                    module.navigationModule.render.groupManagementModal();
                    module.navigationModule.handlers.onCancelGroupEdit();
                    // 渲染完成后标注
                    this.markHeavyContent();
                });
                break;
        }
    }

    /**
     * 标注重内容容器与预览图，便于关闭时快速释放
     */
    markHeavyContent() {
        try {
            // 可能较大的容器：手风琴内容区、列表区、管理面板容器等
            const heavySelectors = [
                // 仅标注真正需要按需清空的数据列表容器
                '#engine-list',
                '#scope-list',
                '#ai-list',
            ];
            heavySelectors.forEach(sel => {
                this.panel.querySelectorAll(sel).forEach(el => el.setAttribute('data-heavy-content', ''));
            });

            // 预览图：已知的引擎图标预览，以及面板中的其他 img 预览
            const previewCandidates = [
                '#engine-icon-preview',
            ];
            previewCandidates.forEach(sel => {
                this.panel.querySelectorAll(sel).forEach(img => img.setAttribute('data-preview', ''));
            });

            // 容错：对可能的通用预览图添加标记（小心范围，仅面板内）
            this.panel.querySelectorAll('img.preview, img[data-role="preview"]').forEach(img => img.setAttribute('data-preview', ''));
        } catch (e) {
            // 忽略标注错误，避免影响功能
        }
    }
    
    /**
     * 绑定引擎图标预览功能
     */
    bindEngineIconPreview() {
        const engineIconUrl = document.getElementById('engine-icon-url');
        const engineIconPreview = document.getElementById('engine-icon-preview');
        
        if (engineIconUrl && engineIconPreview) {
            // 移除旧的事件监听器和定时器（如果存在）
            const oldListener = engineIconUrl._iconPreviewListener;
            const oldBlurHandler = engineIconUrl._iconPreviewBlurHandler;
            const oldTimer = engineIconUrl._iconPreviewTimer;
            
            if (oldListener) {
                engineIconUrl.removeEventListener('input', oldListener);
            }
            if (oldBlurHandler) {
                engineIconUrl.removeEventListener('blur', oldBlurHandler);
            }
            if (oldTimer) {
                clearTimeout(oldTimer);
            }
            
            // 【内存优化】延迟加载预览图，只在用户停止输入后加载
            let previewLoadTimer = null;
            
            // 添加节流的预览图加载
            const newListener = () => {
                const iconUrl = engineIconUrl.value.trim();
                
                // 清除之前的定时器
                if (previewLoadTimer) {
                    clearTimeout(previewLoadTimer);
                }
                
                // 延迟加载预览图（用户停止输入500ms后）
                previewLoadTimer = setTimeout(() => {
                    // 【修复】检查元素是否仍然存在
                    if (engineIconPreview && engineIconUrl) {
                        if (iconUrl) {
                            engineIconPreview.src = iconUrl;
                        } else {
                            engineIconPreview.src = 'https://placehold.co/24x24/3c4043/e8eaed?text=?';
                        }
                    }
                    previewLoadTimer = null;
                    engineIconUrl._iconPreviewTimer = null;
                }, 500);
                
                // 保存定时器引用以便后续清理
                engineIconUrl._iconPreviewTimer = previewLoadTimer;
            };
            
            engineIconUrl.addEventListener('input', newListener);
            engineIconUrl._iconPreviewListener = newListener; // 保存引用以便后续移除
            
            // 【内存优化】输入框失焦时清理定时器
            const blurHandler = () => {
                if (previewLoadTimer) {
                    clearTimeout(previewLoadTimer);
                    previewLoadTimer = null;
                    engineIconUrl._iconPreviewTimer = null;
                }
            };
            engineIconUrl.addEventListener('blur', blurHandler);
            engineIconUrl._iconPreviewBlurHandler = blurHandler; // 保存引用以便后续移除
        }
    }
    
    /**
     * 绑定所有滑块（统一处理）
     */
    bindSliders() {
        const { state, core } = window;
        
        if (!state || !core) {
            console.error('❌ window.state/core 未定义');
            return;
        }
        
        // 合并所有滑块配置
        const allSliders = [
            ...SLIDER_CONFIG.wallpaper,
            ...SLIDER_CONFIG.searchbox,
            ...SLIDER_CONFIG.navigation,
        ];
        
        allSliders.forEach(config => {
            this.bindSlider(config);
        });
    }
    
    /**
     * 绑定单个滑块（通用方法）
     */
    bindSlider(config) {
        const slider = document.getElementById(config.id);
        if (!slider) return;
        
        const valueDisplay = document.getElementById(config.valueId);
        
        // input事件：实时更新显示和CSS（使用节流优化）
        slider.addEventListener('input', (e) => {
            const value = config.format ? parseFloat(e.target.value) : e.target.value;
            
            // 立即更新显示文字（低开销）
            if (valueDisplay) {
                valueDisplay.textContent = config.format(value);
            }
            
            // 【内存优化】CSS变量批量更新（节流）
            if (config.cssVar) {
                const cssValue = config.toCSS ? config.toCSS(value) : value;
                this._pendingCssVars.set(config.cssVar, cssValue);
                
                // 清除之前的定时器
                if (this._cssVarUpdateTimer) {
                    clearTimeout(this._cssVarUpdateTimer);
                }
                
                // 节流更新CSS变量（100ms延迟，减少重排/重绘）
                this._cssVarUpdateTimer = setTimeout(() => {
                    // 批量应用所有待更新的CSS变量
                    this._pendingCssVars.forEach((val, varName) => {
                        document.documentElement.style.setProperty(varName, val);
                    });
                    this._pendingCssVars.clear();
                    this._cssVarUpdateTimer = null;
                }, 100);
            }
            
            // 调用自定义应用函数
            if (config.applyFn) {
                config.applyFn(value, window.state);
            }
        });
        
        // change事件：保存到state
        slider.addEventListener('change', (e) => {
            const value = config.format ? parseFloat(e.target.value) : e.target.value;
            this.saveSliderValue(config.storageKey, value);
        });
    }
    
    /**
     * 保存滑块值到state（支持嵌套路径）
     */
    saveSliderValue(path, value) {
        const { state, core } = window;
        if (!state || !core) return;
        
        const keys = path.split('.');
        let obj = state.userData;
        
        // 遍历路径，创建不存在的对象
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        
        // 设置最终值
        obj[keys[keys.length - 1]] = value;
        core.saveUserData((error) => {
            if (error) {
                console.error('Failed to save slider value:', path, error);
                // 滑块值保存失败，静默处理（已有防抖机制）
            }
        });
    }
    
    /**
     * 从state读取滑块值（支持嵌套路径）
     */
    getSliderValue(path) {
        const { state } = window;
        if (!state?.userData) return undefined;
        
        const keys = path.split('.');
        let value = state.userData;
        
        for (const key of keys) {
            if (value === undefined) return undefined;
            value = value[key];
        }
        
        return value;
    }
    
    /**
     * 绑定所有按钮
     */
    bindButtons() {
        // 绑定所有快速操作按钮
        const quickActionBtns = this.panel.querySelectorAll('.effects-btn[data-action]');
        quickActionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const group = btn.parentElement;
                
                // 切换激活状态
                group.querySelectorAll('.effects-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // 执行对应操作
                this.handleButtonAction(action, btn.dataset);
            });
        });
        
        // 绑定头部的面板位置按钮
        const positionBtns = this.panel.querySelectorAll('.effects-position-btn[data-action]');
        positionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const group = btn.parentElement;
                
                // 切换激活状态
                group.querySelectorAll('.effects-position-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // 执行对应操作
                this.handleButtonAction(action, btn.dataset);
            });
        });
    }
    
    /**
     * 处理按钮操作
     */
    handleButtonAction(action, data) {
        switch(action) {
            case 'set-panel-position':
                this.setPanelPosition(data.position);
                break;
            case 'set-nav-alignment':
                this.setNavAlignment(data.align);
                break;
            case 'set-nav-shape':
                this.setNavShape(data.shape);
                break;
        }
    }
    
    /**
     * 加载保存的面板位置
     */
    loadPanelPosition() {
        const savedPosition = localStorage.getItem('panel-position');
        if (savedPosition === 'left') {
            this.panel.classList.add('panel-left');
        }
        // 更新按钮状态会在打开面板时处理
    }
    
    /**
     * 设置面板位置（左/右）
     */
    setPanelPosition(position) {
        if (position === 'left') {
            this.panel.classList.add('panel-left');
        } else {
            this.panel.classList.remove('panel-left');
        }
        localStorage.setItem('panel-position', position);
    }
    
    /**
     * 设置导航对齐
     */
    setNavAlignment(align) {
        const navGrid = document.getElementById('navigation-grid');
        if (!navGrid) return;
        
        const alignmentMap = {
            left: { marginLeft: '0', marginRight: 'auto' },
            right: { marginLeft: 'auto', marginRight: '0' },
            center: { marginLeft: 'auto', marginRight: 'auto' },
        };
        
        const style = alignmentMap[align];
        if (style) {
            Object.assign(navGrid.style, style);
            localStorage.setItem('nav-alignment', align);
        }
    }
    
    /**
     * 设置导航形状
     */
    setNavShape(shape) {
        document.body.classList.toggle('shape-h-capsule', shape === 'h-capsule');
        localStorage.setItem('nav-shape', shape);
    }
    
    /**
     * 应用关键样式（页面加载时立即执行）
     */
    applyCriticalSettings() {
        try {
            const panelPosition = localStorage.getItem('panel-position');
            const navAlign = localStorage.getItem('nav-alignment');
            const navShape = localStorage.getItem('nav-shape');
            
            if (panelPosition) this.setPanelPosition(panelPosition);
            if (navAlign) this.setNavAlignment(navAlign);
            if (navShape) this.setNavShape(navShape);
        } catch (error) {
            console.error('应用关键样式失败:', error);
        }
    }
    
    /**
     * 应用保存的CSS变量（页面加载时立即执行，不更新UI）
     */
    applySavedCSSVariables() {
        try {
            const { state } = window;
            if (!state?.userData) return;
            
            // 合并所有滑块配置
            const allSliders = [
                ...SLIDER_CONFIG.wallpaper,
                ...SLIDER_CONFIG.searchbox,
                ...SLIDER_CONFIG.navigation,
            ];
            
            // 只应用有CSS变量或applyFn的滑块
            allSliders.forEach(config => {
                const value = this.getSliderValue(config.storageKey);
                
                // 如果没有保存的值，跳过（使用CSS默认值）
                if (value === undefined) return;
                
                // 应用CSS变量
                if (config.cssVar) {
                    document.documentElement.style.setProperty(
                        config.cssVar, 
                        config.toCSS ? config.toCSS(value) : value
                    );
                }
                
                // 调用自定义应用函数
                if (config.applyFn) {
                    config.applyFn(value, state);
                }
            });
        } catch (error) {
            console.error('应用保存的CSS变量失败:', error);
        }
    }
    
    /**
     * 加载滑块值和按钮状态（延迟到打开面板时）
     */
    loadSliderValues() {
        try {
            // 更新按钮状态
            this.updateButtonStates();
            
            // 更新所有滑块值
            const allSliders = [
                ...SLIDER_CONFIG.wallpaper,
                ...SLIDER_CONFIG.searchbox,
                ...SLIDER_CONFIG.navigation,
            ];
            
            allSliders.forEach(config => {
                this.loadSliderValue(config);
            });
        } catch (error) {
            console.error('加载滑块值失败:', error);
        }
    }
    
    /**
     * 加载单个滑块值（通用方法）
     */
    loadSliderValue(config) {
        const slider = document.getElementById(config.id);
        const valueDisplay = document.getElementById(config.valueId);
        
        if (!slider) return;
        
        const value = this.getSliderValue(config.storageKey);
        if (value === undefined) return;
        
        // 设置滑块值
        slider.value = value;
        
        // 更新显示文字
        if (valueDisplay && config.format) {
            valueDisplay.textContent = config.format(value);
        }
        
        // 应用CSS变量
        if (config.cssVar) {
            document.documentElement.style.setProperty(
                config.cssVar, 
                config.toCSS ? config.toCSS(value) : value
            );
        }
        
        // 调用自定义应用函数
        if (config.applyFn) {
            config.applyFn(value, window.state);
        }
    }
    
    /**
     * 更新按钮状态
     */
    updateButtonStates() {
        // 面板位置按钮（系统Tab）
        const panelPosition = localStorage.getItem('panel-position') || 'right';
        document.querySelectorAll('[data-action="set-panel-position"]').forEach(btn => {
            if (btn.dataset.position === panelPosition) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // 导航对齐按钮
        const navAlign = localStorage.getItem('nav-alignment') || 'center';
        this.updateButtonState(`[data-align="${navAlign}"]`, '.effects-btn');
        
        // 导航形状按钮
        const navShape = localStorage.getItem('nav-shape') || 'square';
        this.updateButtonState(`[data-shape="${navShape}"]`, '.effects-btn');
    }
    
    /**
     * 更新按钮激活状态
     */
    updateButtonState(selector, buttonClass = '.effects-btn') {
        const btn = this.panel.querySelector(selector);
        if (btn) {
            btn.parentElement.querySelectorAll(buttonClass).forEach(b => 
                b.classList.remove('active')
            );
            btn.classList.add('active');
        }
    }
}

// 导出函数
let effectsPanelInstance = null;

export function initEffectsPanel() {
    if (!effectsPanelInstance) {
        effectsPanelInstance = new EffectsPanel();
    }
    return effectsPanelInstance;
}

/**
 * 打开效果面板（懒初始化 - 首次调用时才创建实例）
 */
export function openEffectsPanel() {
    // 懒初始化：如果实例不存在，先创建
    if (!effectsPanelInstance) {
        console.log('[LazyInit] Effects panel initialized on first open');
        initEffectsPanel();
    }
    effectsPanelInstance.openPanel();
}

/**
 * 应用保存的CSS变量（从外部调用，在数据加载完成后）
 * 懒初始化：如果实例不存在，先创建
 */
export function applyEffectsCSSVariables() {
    // 懒初始化：如果实例不存在，先创建
    if (!effectsPanelInstance) {
        console.log('[LazyInit] Effects panel initialized for CSS variables');
        initEffectsPanel();
    }
    effectsPanelInstance.applySavedCSSVariables();
}
