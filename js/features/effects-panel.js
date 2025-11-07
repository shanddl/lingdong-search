// 外观设置面板管理（优化版）

import { Formatter } from '../utils/formatter.js';
import { DOMHelper } from '../utils/domHelper.js';
import { ButtonGroupHelper } from '../utils/buttonGroupHelper.js';
import { iconPreviewHelper } from '../utils/iconHelper.js';
import { timerManager } from '../utils/timerManager.js';
import { eventManager } from '../eventManager.js';
import { state } from '../state.js';
import { core } from '../core.js';
import { logger } from '../logger.js';

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
            format: (v) => Formatter.percentage(v, 0),
            toCSS: (v) => v / 100,
        },
        {
            id: 'search-bg-opacity-slider',
            valueId: 'effects-val-search-bg',
            cssVar: '--search-bg-opacity',
            storageKey: 'wallpaperEffects.searchBgOpacity',
            format: (v) => Formatter.percentage(v, 0),
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
            format: (v) => Formatter.pixels(v),
            toCSS: (v) => `${v}px`,
        },
        {
            id: 'search-border-opacity-slider',
            valueId: 'effects-val-search-border',
            cssVar: '--search-border-opacity',
            storageKey: 'wallpaperEffects.searchBorderOpacity',
            format: (v) => Formatter.percentage(v, 0),
            toCSS: (v) => v / 100,
        },
        {
            id: 'icon-bg-opacity-slider',
            valueId: 'effects-val-icon-bg',
            cssVar: '--icon-bg-opacity',
            storageKey: 'wallpaperEffects.iconBgOpacity',
            format: (v) => Formatter.percentage(v, 0),
            toCSS: (v) => v / 100,
        },
        {
            id: 'icon-blur-slider',
            valueId: 'effects-val-icon-blur',
            cssVar: '--icon-blur',
            storageKey: 'wallpaperEffects.iconBlur',
            format: (v) => Formatter.pixels(v),
            toCSS: (v) => `${v}px`,
        },
        {
            id: 'text-shadow-opacity-slider',
            valueId: 'effects-val-text-shadow',
            cssVar: '--text-shadow-opacity',
            storageKey: 'wallpaperEffects.textShadowOpacity',
            format: (v) => Formatter.percentage(v, 0),
            toCSS: (v) => v / 100,
        },
    ],
    
    // 搜索框滑块（使用模块导入的core，避免window全局变量）
    searchbox: [
        {
            id: 'position-slider',
            valueId: 'effects-val-pos',
            storageKey: 'searchboxTop',
            format: (v) => Formatter.percentage(v, 0),
            applyFn: (value) => core.applySearchboxPosition(value),
        },
        {
            id: 'width-slider',
            valueId: 'effects-val-width',
            storageKey: 'searchboxWidth',
            format: (v) => Formatter.pixels(v),
            applyFn: (value) => core.applySearchboxWidth(value),
        },
        {
            id: 'scope-width-slider',
            valueId: 'effects-val-scope',
            storageKey: 'scopeMenuWidth',
            format: (v) => Formatter.pixels(v),
            applyFn: (value) => core.applyScopeMenuWidth(value),
        },
    ],
    
    // 图标滑块
    navigation: [
        {
            id: 'nav-item-size-slider',
            valueId: 'effects-val-size',
            storageKey: 'navigationItemSize',
            format: (v) => Formatter.pixels(v),
            applyFn: (value, state) => {
                const gap = state?.userData?.navigationGridGap;
                window.navigationModule?.utils?.applyAppearanceSettings(value, gap);
            },
        },
        {
            id: 'nav-grid-gap-slider',
            valueId: 'effects-val-gap',
            storageKey: 'navigationGridGap',
            format: (v) => Formatter.pixels(v),
            applyFn: (value, state) => {
                const size = state?.userData?.navigationItemSize;
                window.navigationModule?.utils?.applyAppearanceSettings(size, value);
            },
        },
        {
            id: 'nav-min-width-slider',
            valueId: 'effects-val-min',
            storageKey: 'navigationSettings.minWidth',
            format: (v) => Formatter.pixels(v),
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
            format: (v) => Formatter.decimal(v, 1) + 'x',
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
        // 【内存优化】CSS变量更新节流控制（使用timerManager统一管理）
        this._pendingCssVars = new Map(); // 存储待更新的CSS变量
        
        // 【P0内存优化】防止重复绑定的标志
        this._bindedAccordion = false;
        this._bindedTabs = false;
        this._bindedSliders = false;
        this._bindedButtons = false;
        
        // 【P0内存优化】记录已渲染的accordion，防止重复渲染
        this._renderedAccordions = new Set();
        
        // Tab切换状态
        this._currentActiveTab = null;
        
        // Tab切换事件ID（用于清理）
        this._tabEventIds = [];
        
        // 【P0内存优化】Accordion、Slider、Button事件ID（用于清理）
        this._accordionEventIds = [];
        this._sliderEventIds = [];
        this._buttonEventIds = [];
        
        // 【P0内存优化】动态导入Promise引用，用于取消未完成的渲染
        this._pendingRenders = new Map(); // accordionType -> AbortController
        
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
        
        // ESC键关闭 - 使用eventManager统一管理，防止内存泄漏
        this.handleEscKey = (e) => {
            if (e.key === 'Escape' && this.panel.classList.contains('visible')) {
                this.closePanel();
            }
        };
        this._escKeyEventId = eventManager.add(document, 'keydown', this.handleEscKey);
    }
    
    /**
     * 恢复事件监听器（在openPanel中调用，确保监听器已绑定）
     * 注意：由于现在使用eventManager统一管理，大部分监听器不需要手动恢复
     * 但ESC键和遮罩层点击需要确保已绑定
     */
    restoreEventListeners() {
        // ESC键监听器（如果不存在则重新绑定）
        if (this.handleEscKey && !this._escKeyEventId) {
            this._escKeyEventId = eventManager.add(document, 'keydown', this.handleEscKey);
        }
        // 遮罩层点击监听器（如果不存在则重新绑定）
        if (this.handleOverlayClick && !this._overlayClickEventId) {
            this._overlayClickEventId = eventManager.add(this.overlay, 'click', this.handleOverlayClick);
        }
        // 注意：bindAccordion、bindTabs、bindSliders、bindButtons 的事件监听器
        // 在 closePanel() 中会被移除（内存优化策略），并在 openPanel() 中通过调用各自的 bind 方法重新绑定
        // 因此这里不需要恢复（它们会在 openPanel() 中统一重新绑定）
        // 拖拽相关的监听器由cleanupResize管理，这里不需要处理
    }
    
    openPanel() {
        // 【内存优化】如果面板正在延迟清理，取消清理（用户快速重新打开了）
        timerManager.clearTimeout('effectsPanelDelayedCleanup');
        
        // 【P0内存优化】打开面板时，立即清理所有非活动Tab的内容（确保干净状态）
        const activeTab = state?.userData?.panelSettings?.activeTab || 'appearance';
        const allTabs = ['appearance', 'search', 'navigation', 'system'];
        allTabs.forEach(tabName => {
            if (tabName !== activeTab) {
                // 取消该Tab的所有pending渲染
                const tabContent = this.panel.querySelector(`[data-tab-content="${tabName}"]`);
                if (tabContent && this._pendingRenders) {
                    const accordions = tabContent.querySelectorAll('.effects-accordion-item[data-accordion]');
                    accordions.forEach(accordion => {
                        const accordionType = accordion.dataset.accordion;
                        if (accordionType && this._pendingRenders.has(accordionType)) {
                            const abortController = this._pendingRenders.get(accordionType);
                            if (abortController) {
                                abortController.abort();
                            }
                            this._pendingRenders.delete(accordionType);
                        }
                    });
                }
                this._cleanupTabContent(tabName);
            }
        });
        
        if (!this.settingsLoaded) {
            this.loadSliderValues();
            this.loadPanelTheme();
            this.loadPanelPosition();
            this.loadActiveTab();
            this.settingsLoaded = true;
        }
        
        // 恢复事件监听器（如果之前被移除）
        this.restoreEventListeners();
        
        // 【修复】强制重新绑定所有事件监听器（因为可能在关闭时被移除了）
        // 由于 closePanel() 中会移除所有事件监听器并重置标志，这里需要重新绑定
        this.bindTabs();
        this.bindAccordion();
        this.bindSliders();
        this.bindButtons();
        
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
        // 从state中读取保存的主题（使用模块导入的state）
        const savedTheme = state?.userData?.panelSettings?.theme || 'light';
        
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
        // 从state中读取保存的Tab（使用模块导入的state）
        const savedTab = state?.userData?.panelSettings?.activeTab || 'appearance';
        
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
        
        // 2.5) 【内存优化】移除所有事件监听器，防止内存泄漏（使用eventManager统一管理）
        try {
            // 移除ESC键监听器
            if (this._escKeyEventId) {
                eventManager.remove(this._escKeyEventId);
                this._escKeyEventId = null;
            }
            // 移除遮罩层点击监听器
            if (this._overlayClickEventId) {
                eventManager.remove(this._overlayClickEventId);
                this._overlayClickEventId = null;
            }
            // 【P0内存优化】移除Tab切换事件监听器
            this._tabEventIds.forEach(id => {
                if (id) eventManager.remove(id);
            });
            this._tabEventIds = [];
            
            // 【P0内存优化】移除Accordion事件监听器
            this._accordionEventIds.forEach(id => {
                if (id) eventManager.remove(id);
            });
            this._accordionEventIds = [];
            
            // 【P0内存优化】移除Slider事件监听器
            this._sliderEventIds.forEach(id => {
                if (id) eventManager.remove(id);
            });
            this._sliderEventIds = [];
            
            // 【P0内存优化】移除Button事件监听器
            this._buttonEventIds.forEach(id => {
                if (id) eventManager.remove(id);
            });
            this._buttonEventIds = [];
            
            // 【P0内存优化】取消所有待执行的渲染Promise
            if (this._pendingRenders) {
                this._pendingRenders.forEach((abortController, accordionType) => {
                    if (abortController) {
                        abortController.abort();
                    }
                });
                this._pendingRenders.clear();
            }
            
            // 清理所有相关定时器（使用timerManager）
            timerManager.clearTimeout('cssVarUpdate');
            timerManager.clearTimeout('effectsPanelCleanup');
            timerManager.clearTimeout('effectsPanelIdleCleanup');
            // 取消之前的延迟清理（如果面板被快速重新打开）
            timerManager.clearTimeout('effectsPanelDelayedCleanup');
            
            // 清空待更新的CSS变量
            if (this._pendingCssVars) {
                this._pendingCssVars.clear();
            }
            
            // 【内存优化】延迟3秒后清理Tab内容（如果用户没有重新打开面板）
            // 这样可以避免用户快速重新打开时的重复渲染开销
            timerManager.setTimeout('effectsPanelDelayedCleanup', () => {
                // 检查面板是否仍然关闭（用户可能已经重新打开了）
                if (!this.panel.classList.contains('visible')) {
                    this._cleanupAllTabContents();
                }
            }, 3000); // 3秒延迟
            
            // 重置状态
            this._currentActiveTab = null;
            
            // 【修复】重置所有绑定标志，允许下次打开时重新绑定事件
            // 因为事件监听器已经在上面被移除了，如果不重置标志，下次打开时不会重新绑定
            this._bindedTabs = false;
            this._bindedAccordion = false;
            this._bindedSliders = false;
            this._bindedButtons = false;
            
            // 注意：bindAccordion、bindSliders、bindButtons 使用的是直接绑定
            // 它们的监听器绑定在DOM元素上，只要元素不被移除，就不会累积
            // 但由于内存优化策略，我们在关闭时会移除这些监听器，所以需要重置标志以便重新绑定
        } catch (e) {
            logger.warn('[Effects Panel] Error removing event listeners:', e);
        }

        // 3) 动画结束后（约300-500ms），清理重内容与预览引用（使用timerManager统一管理）
        timerManager.setTimeout('effectsPanelCleanup', () => {
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
                
                // 【P0内存优化】重置已渲染标志，允许下次重新渲染
                this._renderedAccordions.clear();
                
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
            // 使用timerManager统一管理定时器
            timerManager.setTimeout('effectsPanelIdleCleanup', idleCleanup, 1500);
        }
    }
    
    bindPanelEvents() {
        // 只通过遮罩层关闭 - 使用具名函数以便后续移除
        this.handleOverlayClick = () => this.closePanel();
        // 使用eventManager统一管理遮罩层点击监听器
        this._overlayClickEventId = eventManager.add(this.overlay, 'click', this.handleOverlayClick);
        
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
                logger.warn('[Effects Panel] Error cleaning up old resize listeners:', e);
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
        
        // 绑定事件（使用eventManager统一管理，避免内存泄漏）
        this._resizeMouseDownId = eventManager.add(handle, 'mousedown', this.handleMouseDown);
        this._resizeMouseMoveId = eventManager.add(document, 'mousemove', this.handleMouseMove);
        this._resizeMouseUpId = eventManager.add(document, 'mouseup', this.handleMouseUp);
        
        // 保存handle引用以便清理
        this.resizeHandle = handle;
        
        // 清理函数（移除所有拖动相关监听器，使用eventManager统一管理）
        this.cleanupResize = () => {
            if (this._resizeMouseDownId) {
                eventManager.remove(this._resizeMouseDownId);
                this._resizeMouseDownId = null;
            }
            if (this._resizeMouseMoveId) {
                eventManager.remove(this._resizeMouseMoveId);
                this._resizeMouseMoveId = null;
            }
            if (this._resizeMouseUpId) {
                eventManager.remove(this._resizeMouseUpId);
                this._resizeMouseUpId = null;
            }
        };
    }
    
    /**
     * 绑定Tab切换事件（已优化：使用eventManager统一管理，避免内存泄漏）
     */
    bindTabs() {
        // 【P0内存优化】防止重复绑定
        if (this._bindedTabs) {
            return;
        }
        
        // 【内存优化】清理旧的事件监听器（如果存在）
        this._tabEventIds.forEach(id => {
            if (id) eventManager.remove(id);
        });
        this._tabEventIds = [];
        
        // 使用eventManager统一管理事件，避免内存泄漏
        const tabs = this.panel.querySelectorAll('.effects-tab');
        tabs.forEach(tab => {
            const eventId = eventManager.add(tab, 'click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
            this._tabEventIds.push(eventId);
        });
        
        this._bindedTabs = true;
    }
    
    /**
     * 切换Tab（已优化：立即清理非活动Tab的内容，防止内存泄漏）
     * @param {string} tabName - Tab名称（appearance, search, navigation, system）
     */
    switchTab(tabName) {
        // 如果切换到相同的Tab，直接返回
        if (this._currentActiveTab === tabName) {
            return;
        }
        
        // 【P0内存优化】立即清理之前Tab的内容（如果存在）
        if (this._currentActiveTab) {
            // 取消该Tab相关的所有pending渲染Promise
            const previousTabContent = this.panel.querySelector(`[data-tab-content="${this._currentActiveTab}"]`);
            if (previousTabContent && this._pendingRenders) {
                const accordions = previousTabContent.querySelectorAll('.effects-accordion-item[data-accordion]');
                accordions.forEach(accordion => {
                    const accordionType = accordion.dataset.accordion;
                    if (accordionType && this._pendingRenders.has(accordionType)) {
                        const abortController = this._pendingRenders.get(accordionType);
                        if (abortController) {
                            abortController.abort();
                        }
                        this._pendingRenders.delete(accordionType);
                    }
                });
            }
            this._cleanupTabContent(this._currentActiveTab);
        }
        
        // 更新Tab按钮状态
        this.panel.querySelectorAll('.effects-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // 更新内容区域
        this.panel.querySelectorAll('.effects-tab-content').forEach(content => {
            content.classList.toggle('active', content.dataset.tabContent === tabName);
        });
        
        // 保存当前Tab到userData
        if (state?.userData?.panelSettings) {
            state.userData.panelSettings.activeTab = tabName;
        }
        
        this._currentActiveTab = tabName;
    }
    
    /**
     * 【P0内存优化】清理指定Tab的内容，释放内存
     * @param {string} tabName - 要清理的Tab名称
     */
    _cleanupTabContent(tabName) {
        const tabContent = this.panel.querySelector(`[data-tab-content="${tabName}"]`);
        if (!tabContent) return;
        
        // 清理所有列表内容（最占内存的部分）
        const listSelectors = ['#engine-list', '#scope-list', '#ai-list', '#nav-group-list', '#manage-scopes-list'];
        listSelectors.forEach(selector => {
            const list = tabContent.querySelector(selector);
            if (list && list.children.length > 0) {
                // 清理列表中的图片和Blob URL
                const listImages = list.querySelectorAll('img');
                listImages.forEach(img => {
                    if (img.src && img.src.startsWith('blob:')) {
                        try {
                            URL.revokeObjectURL(img.src);
                        } catch (e) {
                            // ignore
                        }
                    }
                    img.src = '';
                    img.removeAttribute('src');
                    img.removeAttribute('srcset');
                    img.onload = null;
                    img.onerror = null;
                });
                // 清空列表内容
                list.innerHTML = '';
            }
        });
        
        // 清理所有图片资源（包括预览图）
        const images = tabContent.querySelectorAll('img');
        images.forEach(img => {
            if (img.src && !img.src.startsWith('data:')) {
                if (img.src.startsWith('blob:')) {
                    try {
                        URL.revokeObjectURL(img.src);
                    } catch (e) {
                        // ignore
                    }
                }
                img.src = '';
                img.removeAttribute('src');
                img.removeAttribute('srcset');
                img.onload = null;
                img.onerror = null;
            }
        });
        
        // 折叠该Tab内的所有Accordion，并清理已渲染标记和pending渲染
        const accordions = tabContent.querySelectorAll('.effects-accordion-item[data-accordion]');
        accordions.forEach(accordion => {
            const accordionType = accordion.dataset.accordion;
            if (accordionType) {
                // 取消该accordion的pending渲染Promise
                if (this._pendingRenders && this._pendingRenders.has(accordionType)) {
                    const abortController = this._pendingRenders.get(accordionType);
                    if (abortController) {
                        abortController.abort();
                    }
                    this._pendingRenders.delete(accordionType);
                }
                // 如果已展开，清理其内容
                if (accordion.classList.contains('expanded')) {
                    accordion.classList.remove('expanded');
                    // 清理该accordion内的图片资源
                    const accordionImages = accordion.querySelectorAll('img');
                    accordionImages.forEach(img => {
                        if (img.src && !img.src.startsWith('data:')) {
                            if (img.src.startsWith('blob:')) {
                                try {
                                    URL.revokeObjectURL(img.src);
                                } catch (e) {
                                    // ignore
                                }
                            }
                            img.src = '';
                            img.removeAttribute('src');
                            img.removeAttribute('srcset');
                            img.onload = null;
                            img.onerror = null;
                        }
                    });
                    // 清理列表内容（如果存在）
                    const listSelectors = {
                        'scope-management': '#scope-list',
                        'engine-management': '#engine-list',
                        'ai-management': '#ai-list',
                        'nav-group-management': '#nav-group-list'
                    };
                    const listSelector = listSelectors[accordionType];
                    if (listSelector) {
                        const list = accordion.querySelector(listSelector);
                        if (list) {
                            list.innerHTML = '';
                        }
                    }
                }
                this._renderedAccordions.delete(accordionType);
            }
        });
        
        // 内存清理完成（生产环境静默）
    }
    
    /**
     * 【新增】清理所有Tab内容，释放内存（延迟清理，在关闭面板3秒后执行）
     */
    _cleanupAllTabContents() {
        const tabContents = this.panel.querySelectorAll('.effects-tab-content');
        
        tabContents.forEach(content => {
            const tabName = content.dataset.tabContent;
            if (!tabName) return;
            
            // 清理列表内容（最占内存的部分）
            const listSelectors = ['#engine-list', '#scope-list', '#ai-list', '#nav-group-list', '#manage-scopes-list'];
            listSelectors.forEach(selector => {
                const list = content.querySelector(selector);
                if (list && list.children.length > 0) {
                    // 清理列表中的图片和Blob URL
                    const listImages = list.querySelectorAll('img');
                    listImages.forEach(img => {
                        if (img.src && img.src.startsWith('blob:')) {
                            try {
                                URL.revokeObjectURL(img.src);
                            } catch (e) {
                                // ignore
                            }
                        }
                        img.src = '';
                        img.removeAttribute('src');
                        img.removeAttribute('srcset');
                        img.onload = null;
                        img.onerror = null;
                    });
                    // 清空列表内容
                    list.innerHTML = '';
                }
            });
            
            // 清理其他图片资源（包括预览图）
            const images = content.querySelectorAll('img');
            images.forEach(img => {
                if (img.src && !img.src.startsWith('data:')) {
                    if (img.src.startsWith('blob:')) {
                        try {
                            URL.revokeObjectURL(img.src);
                        } catch (e) {
                            // ignore
                        }
                    }
                    img.src = '';
                    img.removeAttribute('src');
                    img.removeAttribute('srcset');
                    img.onload = null;
                    img.onerror = null;
                }
            });
            
            // 折叠所有Accordion
            const accordions = content.querySelectorAll('.effects-accordion-item.expanded');
            accordions.forEach(accordion => {
                const accordionType = accordion.dataset.accordion;
                accordion.classList.remove('expanded');
                if (accordionType) {
                    this._renderedAccordions.delete(accordionType);
                }
            });
        });
        
        // 内存清理完成（生产环境静默）
    }
    
    /**
     * 绑定折叠菜单事件（算盘珠效果）- 已优化：使用eventManager统一管理，避免内存泄漏
     */
    bindAccordion() {
        // 【P0内存优化】防止重复绑定
        if (this._bindedAccordion) {
            return;
        }
        
        // 【P0内存优化】清理旧的事件监听器（如果存在）
        this._accordionEventIds.forEach(id => {
            if (id) eventManager.remove(id);
        });
        this._accordionEventIds = [];
        
        const accordionItems = this.panel.querySelectorAll('.effects-accordion-item');
        
        accordionItems.forEach(item => {
            const header = item.querySelector('.effects-accordion-header');
            if (!header) return;
            
            // 【P0内存优化】使用eventManager统一管理，避免内存泄漏
            const eventId = eventManager.add(header, 'click', () => {
                const isExpanded = item.classList.contains('expanded');
                const accordionType = item.dataset.accordion;
                
                if (isExpanded) {
                    // 【P0内存优化】折叠时清理该accordion内的图片资源
                    const images = item.querySelectorAll('img');
                    images.forEach(img => {
                        if (img.src && !img.src.startsWith('data:')) {
                            // 如果是blob URL，先释放它
                            if (img.src.startsWith('blob:')) {
                                try {
                                    URL.revokeObjectURL(img.src);
                                } catch (e) {
                                    // ignore
                                }
                            }
                            // 清空src和相关属性
                            img.src = '';
                            img.removeAttribute('src');
                            img.removeAttribute('srcset');
                        }
                    });
                    // 从已渲染集合中移除，允许下次重新渲染
                    this._renderedAccordions.delete(accordionType);
                    // 如果已展开，则收起
                    item.classList.remove('expanded');
                } else {
                    // 【P0内存优化】关闭所有其他项时，取消它们的渲染Promise并清理资源
                    accordionItems.forEach(otherItem => {
                        // 关闭其他项时也清理图片资源
                        if (otherItem.classList.contains('expanded')) {
                            const otherType = otherItem.dataset.accordion;
                            
                            // 【P0内存优化】取消该accordion的渲染Promise（如果存在）
                            if (this._pendingRenders && this._pendingRenders.has(otherType)) {
                                const abortController = this._pendingRenders.get(otherType);
                                if (abortController) {
                                    abortController.abort();
                                }
                                this._pendingRenders.delete(otherType);
                            }
                            
                            const otherImages = otherItem.querySelectorAll('img');
                            otherImages.forEach(img => {
                                if (img.src && !img.src.startsWith('data:')) {
                                    if (img.src.startsWith('blob:')) {
                                        try {
                                            URL.revokeObjectURL(img.src);
                                        } catch (e) {
                                            // ignore
                                        }
                                    }
                                    img.src = '';
                                    img.removeAttribute('src');
                                    img.removeAttribute('srcset');
                                    img.onload = null;
                                    img.onerror = null;
                                }
                            });
                            
                            // 【P0内存优化】清理其他accordion的列表内容（如果存在）
                            const listSelectors = {
                                'scope-management': '#scope-list',
                                'engine-management': '#engine-list',
                                'ai-management': '#ai-list',
                                'nav-group-management': '#nav-group-list'
                            };
                            const listSelector = listSelectors[otherType];
                            if (listSelector) {
                                const list = otherItem.querySelector(listSelector);
                                if (list) {
                                    // 清理列表中的图片和Blob URL
                                    const listImages = list.querySelectorAll('img');
                                    listImages.forEach(img => {
                                        if (img.src && !img.src.startsWith('data:')) {
                                            if (img.src.startsWith('blob:')) {
                                                try {
                                                    URL.revokeObjectURL(img.src);
                                                } catch (e) {
                                                    // ignore
                                                }
                                            }
                                            img.src = '';
                                            img.removeAttribute('src');
                                            img.removeAttribute('srcset');
                                            img.onload = null;
                                            img.onerror = null;
                                        }
                                    });
                                    // 清空列表
                                    list.innerHTML = '';
                                }
                            }
                            
                            this._renderedAccordions.delete(otherType);
                        }
                        otherItem.classList.remove('expanded');
                    });
                    
                    // 展开当前项
                    item.classList.add('expanded');
                    
                    // 延迟后渲染对应的数据（使用timerManager统一管理，添加防抖避免频繁切换）
                    // 【内存优化】清理之前的渲染定时器，避免多个定时器同时执行导致内存占用
                    timerManager.clearTimeout(`accordion-render-${accordionType}`);
                    timerManager.setTimeout(`accordion-render-${accordionType}`, () => {
                        this.renderAccordionData(accordionType);
                    }, 50);
                }
            });
            
            // 保存事件ID以便后续清理
            this._accordionEventIds.push(eventId);
        });
        
        this._bindedAccordion = true;
    }
    
    renderAccordionData(accordionType) {
        // 【P0内存优化】防止重复渲染
        if (this._renderedAccordions.has(accordionType)) {
            return;
        }
        
        // 【P0内存优化】取消之前的渲染Promise（如果存在）
        if (this._pendingRenders.has(accordionType)) {
            const abortController = this._pendingRenders.get(accordionType);
            if (abortController) {
                abortController.abort();
            }
            this._pendingRenders.delete(accordionType);
        }
        
        // 【P0内存优化】创建AbortController来标记当前渲染任务
        const abortController = new AbortController();
        this._pendingRenders.set(accordionType, abortController);
        
        // 【P0内存优化】渲染前先清理旧的DOM内容和图片资源
        const listSelectors = {
            'scope-management': '#scope-list',
            'engine-management': '#engine-list',
            'ai-management': '#ai-list',
            'nav-group-management': '#nav-group-list'
        };
        
        const listSelector = listSelectors[accordionType];
        if (listSelector) {
            const listElement = this.panel.querySelector(listSelector);
            if (listElement) {
                // 清理旧的图片资源（blob URL）
                const oldImages = listElement.querySelectorAll('img');
                oldImages.forEach(img => {
                    if (img.src && !img.src.startsWith('data:')) {
                        if (img.src.startsWith('blob:')) {
                            try {
                                URL.revokeObjectURL(img.src);
                            } catch (e) {
                                // ignore
                            }
                        }
                        img.src = '';
                        img.removeAttribute('src');
                        img.removeAttribute('srcset');
                    }
                });
                // 清空内容（会在渲染函数中重新填充）
                listElement.innerHTML = '';
            }
        }
        
        // 动态导入并调用对应的渲染函数
        switch(accordionType) {
            case 'scope-management':
                import('../ui/render.js').then(module => {
                    // 【P0内存优化】检查是否已被取消
                    if (abortController.signal.aborted) return;
                    module.render.scopeManagementModal();
                    return import('./managementHandlers.js');
                }).then(m => {
                    // 【P0内存优化】检查是否已被取消
                    if (abortController.signal.aborted) return;
                    m.managementHandlers.showScopeList();
                    // 【P0内存优化】标记为已渲染，清理pending状态
                    this._renderedAccordions.add(accordionType);
                    this._pendingRenders.delete(accordionType);
                }).catch(error => {
                    // 如果是取消操作，不输出错误
                    if (abortController.signal.aborted) return;
                    logger.error('[Effects Panel] Failed to render scope-management:', error);
                    this._renderedAccordions.delete(accordionType);
                    this._pendingRenders.delete(accordionType);
                });
                break;
            case 'engine-management':
                import('../ui/render.js').then(module => {
                    if (abortController.signal.aborted) return;
                    module.render.engineManagementModal();
                    return import('./managementHandlers.js');
                }).then(m => {
                    if (abortController.signal.aborted) return;
                    m.managementHandlers.resetEngineForm();
                    // 重新绑定图标预览功能
                    this.bindEngineIconPreview();
                    // 渲染完成后标注重内容与预览
                    this.markHeavyContent();
                    // 【P0内存优化】标记为已渲染，清理pending状态
                    this._renderedAccordions.add(accordionType);
                    this._pendingRenders.delete(accordionType);
                }).catch(error => {
                    if (abortController.signal.aborted) return;
                    logger.error('[Effects Panel] Failed to render engine-management:', error);
                    this._renderedAccordions.delete(accordionType);
                    this._pendingRenders.delete(accordionType);
                });
                break;
            case 'ai-management':
                import('./ai-settings.js').then(module => {
                    if (abortController.signal.aborted) return;
                    module.aiSettings.renderAIList();
                    module.aiSettings.resetForm();
                    // 渲染完成后标注
                    this.markHeavyContent();
                    // 【P0内存优化】标记为已渲染，清理pending状态
                    this._renderedAccordions.add(accordionType);
                    this._pendingRenders.delete(accordionType);
                }).catch(error => {
                    if (abortController.signal.aborted) return;
                    logger.error('[Effects Panel] Failed to render ai-management:', error);
                    this._renderedAccordions.delete(accordionType);
                    this._pendingRenders.delete(accordionType);
                });
                break;
            case 'nav-group-management':
                import('./navigation.js').then(module => {
                    if (abortController.signal.aborted) return;
                    module.navigationModule.render.groupManagementModal();
                    module.navigationModule.handlers.onCancelGroupEdit();
                    // 渲染完成后标注
                    this.markHeavyContent();
                    // 【P0内存优化】标记为已渲染，清理pending状态
                    this._renderedAccordions.add(accordionType);
                    this._pendingRenders.delete(accordionType);
                }).catch(error => {
                    if (abortController.signal.aborted) return;
                    logger.error('[Effects Panel] Failed to render nav-group-management:', error);
                    this._renderedAccordions.delete(accordionType);
                    this._pendingRenders.delete(accordionType);
                });
                break;
            case 'about':
                // 更新版本号（如果是异步函数，等待完成）
                try {
                    const result = this.updateVersionInfo();
                    if (result instanceof Promise) {
                        result.then(() => {
                            // 【P0内存优化】标记为已渲染
                            this._renderedAccordions.add(accordionType);
                        }).catch(error => {
                            logger.error('[Effects Panel] Failed to update version info:', error);
                            // 即使失败也标记为已渲染，避免重复尝试
                            this._renderedAccordions.add(accordionType);
                        });
                    } else {
                        // 【P0内存优化】标记为已渲染
                        this._renderedAccordions.add(accordionType);
                    }
                } catch (error) {
                    logger.error('[Effects Panel] Failed to update version info:', error);
                    // 即使失败也标记为已渲染，避免重复尝试
                    this._renderedAccordions.add(accordionType);
                }
                break;
            case 'wallpaper':
            case 'quick-actions':
            case 'search':
            case 'icons':
            case 'data-management':
                // 静态内容，不需要动态渲染，直接标记为已渲染
                this._renderedAccordions.add(accordionType);
                this._pendingRenders.delete(accordionType);
                break;
            default:
                // 未知的 accordion 类型，不进行渲染
                logger.warn(`[Effects Panel] Unknown accordion type: ${accordionType}`);
                break;
        }
    }
    
    /**
     * 更新"关于"部分的版本信息
     */
    async updateVersionInfo() {
        try {
            const versionElement = document.getElementById('extension-version');
            if (!versionElement) return;
            
            // 读取 manifest.json 获取版本号
            const manifest = chrome.runtime.getManifest();
            if (manifest && manifest.version) {
                versionElement.textContent = `版本 v${manifest.version}`;
            } else {
                versionElement.textContent = '版本 v1.0';
            }
        } catch (error) {
            console.warn('[Effects Panel] Failed to update version info:', error);
            const versionElement = document.getElementById('extension-version');
            if (versionElement) {
                versionElement.textContent = '版本 v1.0';
            }
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
     * 绑定引擎图标预览功能（使用iconPreviewHelper统一管理）
     */
    bindEngineIconPreview() {
        const engineIconUrl = document.getElementById('engine-icon-url');
        const engineIconPreview = document.getElementById('engine-icon-preview');
        
        if (engineIconUrl && engineIconPreview) {
            // 使用iconPreviewHelper统一管理，自动处理防抖和清理
            iconPreviewHelper.init(engineIconUrl, engineIconPreview, {
                debounceDelay: 500
            });
        }
    }
    
    /**
     * 绑定所有滑块（统一处理）- 已优化：使用eventManager统一管理，避免内存泄漏
     */
    bindSliders() {
        // 【P0内存优化】防止重复绑定
        if (this._bindedSliders) {
            return;
        }
        
        // 【P0内存优化】清理旧的事件监听器（如果存在）
        this._sliderEventIds.forEach(id => {
            if (id) eventManager.remove(id);
        });
        this._sliderEventIds = [];
        
        // 使用模块导入的state和core，无需检查window
        
        // 合并所有滑块配置
        const allSliders = [
            ...SLIDER_CONFIG.wallpaper,
            ...SLIDER_CONFIG.searchbox,
            ...SLIDER_CONFIG.navigation,
        ];
        
        allSliders.forEach(config => {
            this.bindSlider(config);
        });
        
        this._bindedSliders = true;
    }
    
    /**
     * 绑定单个滑块（通用方法）- 已优化：使用eventManager统一管理，避免内存泄漏
     */
    bindSlider(config) {
        const slider = document.getElementById(config.id);
        if (!slider) return;
        
        const valueDisplay = document.getElementById(config.valueId);
        
        // 【P0内存优化】使用eventManager统一管理input事件
        const inputHandler = (e) => {
            const value = config.format ? parseFloat(e.target.value) : e.target.value;
            
            // 立即更新显示文字（低开销）
            if (valueDisplay) {
                valueDisplay.textContent = config.format(value);
            }
            
            // 【内存优化】CSS变量批量更新（节流，使用timerManager统一管理）
            if (config.cssVar) {
                const cssValue = config.toCSS ? config.toCSS(value) : value;
                this._pendingCssVars.set(config.cssVar, cssValue);
                
                // 节流更新CSS变量（100ms延迟，减少重排/重绘）
                timerManager.setTimeout('cssVarUpdate', () => {
                    // 批量应用所有待更新的CSS变量
                    this._pendingCssVars.forEach((val, varName) => {
                        document.documentElement.style.setProperty(varName, val);
                    });
                    this._pendingCssVars.clear();
                }, 100);
            }
            
            // 调用自定义应用函数（使用模块导入的state）
            if (config.applyFn) {
                config.applyFn(value, state);
            }
        };
        
        const inputEventId = eventManager.add(slider, 'input', inputHandler);
        this._sliderEventIds.push(inputEventId);
        
        // 【P0内存优化】使用eventManager统一管理change事件
        const changeHandler = (e) => {
            const value = config.format ? parseFloat(e.target.value) : e.target.value;
            this.saveSliderValue(config.storageKey, value);
        };
        
        const changeEventId = eventManager.add(slider, 'change', changeHandler);
        this._sliderEventIds.push(changeEventId);
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
                logger.error('Failed to save slider value:', path, error);
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
     * 绑定所有按钮 - 已优化：使用eventManager统一管理，避免内存泄漏
     */
    bindButtons() {
        // 【P0内存优化】防止重复绑定
        if (this._bindedButtons) {
            return;
        }
        
        // 【P0内存优化】清理旧的事件监听器（如果存在）
        this._buttonEventIds.forEach(id => {
            if (id) eventManager.remove(id);
        });
        this._buttonEventIds = [];
        
        // 绑定所有快速操作按钮
        const quickActionBtns = this.panel.querySelectorAll('.effects-btn[data-action]');
        quickActionBtns.forEach(btn => {
            // 【P0内存优化】使用eventManager统一管理
            const clickHandler = () => {
                const action = btn.dataset.action;
                const group = btn.parentElement;
                
                // 切换激活状态（使用ButtonGroupHelper）
                const allBtns = group.querySelectorAll('.effects-btn');
                ButtonGroupHelper.updateActiveState(allBtns, null, btn, ['active']);
                
                // 执行对应操作
                this.handleButtonAction(action, btn.dataset);
            };
            
            const eventId = eventManager.add(btn, 'click', clickHandler);
            this._buttonEventIds.push(eventId);
        });
        
        // 绑定头部的面板位置按钮
        const positionBtns = this.panel.querySelectorAll('.effects-position-btn[data-action]');
        positionBtns.forEach(btn => {
            // 【P0内存优化】使用eventManager统一管理
            const clickHandler = () => {
                const action = btn.dataset.action;
                const group = btn.parentElement;
                
                // 切换激活状态（使用ButtonGroupHelper）
                const allBtns = group.querySelectorAll('.effects-position-btn');
                ButtonGroupHelper.updateActiveState(allBtns, null, btn, ['active']);
                
                // 执行对应操作
                this.handleButtonAction(action, btn.dataset);
            };
            
            const eventId = eventManager.add(btn, 'click', clickHandler);
            this._buttonEventIds.push(eventId);
        });
        
        this._bindedButtons = true;
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
        const savedPosition = localStorage.getItem('panel-position') || 'right';
        if (savedPosition === 'left') {
            this.panel.classList.add('panel-left');
        } else {
            this.panel.classList.remove('panel-left');
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
        const navContainer = document.getElementById('navigation-container');
        if (!navContainer) return;
        
        // 修改对齐方式：在父容器上使用justify-content控制对齐（grid宽度为fit-content）
        const alignmentMap = {
            left: 'flex-start',
            center: 'center',
            right: 'flex-end'
        };
        
        const justifyContent = alignmentMap[align];
        if (justifyContent) {
            navContainer.style.justifyContent = justifyContent;
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
            logger.error('应用关键样式失败:', error);
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
            logger.error('应用保存的CSS变量失败:', error);
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
            logger.error('加载滑块值失败:', error);
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
        
        // 调用自定义应用函数（使用模块导入的state）
        if (config.applyFn) {
            config.applyFn(value, state);
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
        initEffectsPanel();
    }
    effectsPanelInstance.applySavedCSSVariables();
}
