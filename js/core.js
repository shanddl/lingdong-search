import { STATIC_CONFIG } from './constants.js';
import { state } from './state.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { utils } from './utils.js';
import { render } from './ui/render.js';
import { navigationModule } from './features/navigation.js';
import { logger } from './logger.js';
import { timerManager } from './utils/timerManager.js';

// =================================================================
// 核心功能模块 - 数据加载、保存、设置应用、搜索执行
// =================================================================

const log = logger.module('Core');

/**
 * 简单的字符串哈希函数（用于数据变化检测）
 * @param {string} str - 要哈希的字符串
 * @returns {number} 哈希值
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

// 保存操作的防抖机制，防止并发saveUserData调用导致数据覆盖（使用timerManager统一管理）
let pendingCallbacks = [];
const SAVE_DEBOUNCE_DELAY = 300; // 【修复】减少防抖延迟从800ms到300ms，加快保存速度
let lastSavedDataHash = null; // 上次保存的数据哈希，用于检测变化

/**
 * 核心功能模块
 * 负责用户数据的加载、保存、设置应用和搜索执行
 */
export const core = {
    /**
     * 从存储加载用户数据
     * 会合并默认数据和存储数据，并进行数据验证和迁移
     */
    loadUserData: () => {
        storage.get((storedData) => {
            // 延迟深拷贝：仅在需要恢复默认值时才创建副本，减少内存占用
            let defaultDataCache = null;
            const getDefaultData = () => {
                if (!defaultDataCache) {
                    defaultDataCache = JSON.parse(JSON.stringify(STATIC_CONFIG.DEFAULT_USER_DATA));
                }
                return defaultDataCache;
            };
            
            log.debug('Loading user data, storedData:', storedData);
            
            // 修复数据合并逻辑 - 确保分类数据正确保留
            if (storedData) {
                const defaultData = getDefaultData();
                // 【关键修复】直接使用storedData.navigationGroups，不要用默认值覆盖
                // 深度合并导航组数据，确保用户创建的分类不会丢失
                state.userData = {
                    ...defaultData,
                    ...storedData,
                    // 【关键修复】确保使用存储的navigationGroups，保持items顺序
                    navigationGroups: storedData.navigationGroups ? [...storedData.navigationGroups] : [...defaultData.navigationGroups],
                    dynamicFilters: { 
                        ...defaultData.dynamicFilters, 
                        ...(storedData.dynamicFilters || {})
                    }
                };
                
                // 验证和修复动态过滤器（仅在需要恢复时深拷贝）
                if (!state.userData.dynamicFilters || !state.userData.dynamicFilters.timeRange || 
                    state.userData.dynamicFilters.timeRange.some(r => typeof r === 'object' && r.hasOwnProperty('value'))) {
                    state.userData.dynamicFilters = getDefaultData().dynamicFilters;
                }
                
                // 验证搜索引擎（添加完整性检查）
                if (!storedData.searchEngines || !Array.isArray(storedData.searchEngines) || storedData.searchEngines.length === 0) {
                    state.userData.searchEngines = [...getDefaultData().searchEngines];
                    log.debug('Restored default search engines');
                }
                
                // 确保活跃搜索引擎存在（添加null检查）
                if (state.userData.searchEngines && state.userData.searchEngines.length > 0) {
                    const activeEngineExists = state.userData.searchEngines.some(e => e && e.id === state.userData.activeSearchEngineId);
                    if (!activeEngineExists) {
                        state.userData.activeSearchEngineId = state.userData.searchEngines[0].id;
                        log.debug('Reset active search engine to first engine');
                    }
                } else {
                    // 极端情况：searchEngines为空，重置为默认值
                    const defaultEngines = getDefaultData().searchEngines;
                    state.userData.searchEngines = [...defaultEngines];
                    state.userData.activeSearchEngineId = defaultEngines[0].id;
                    log.warn('Search engines was empty, reset to defaults');
                }
                
                // 注意：搜索引擎菜单会在 applyAllSettings() 中统一渲染，此处无需重复调用
                
                // 验证导航组（添加完整性检查）
                if (!state.userData.navigationGroups || !Array.isArray(state.userData.navigationGroups) || state.userData.navigationGroups.length === 0) {
                    const defaultGroups = getDefaultData().navigationGroups;
                    state.userData.navigationGroups = [...defaultGroups];
                    state.userData.activeNavigationGroupId = getDefaultData().activeNavigationGroupId;
                    log.warn('Navigation groups was empty, reset to defaults');
                } else {
                    // 【关键修复】验证每个group的items数组，确保顺序保持
                    state.userData.navigationGroups.forEach((group) => {
                        if (!group.items || !Array.isArray(group.items)) {
                            group.items = [];
                        }
                    });
                    
                    // 验证活跃导航组ID
                    const activeGroupExists = state.userData.navigationGroups.some(g => g && g.id === state.userData.activeNavigationGroupId);
                    if (!activeGroupExists) {
                        state.userData.activeNavigationGroupId = state.userData.navigationGroups[0].id;
                        log.debug('Auto-corrected active group ID to:', state.userData.activeNavigationGroupId);
                    }
                }
                
                // 验证引擎设置（确保旧版本数据兼容）
                if (!state.userData.engineSettings || typeof state.userData.engineSettings !== 'object') {
                    const defaultSettings = getDefaultData().engineSettings;
                    state.userData.engineSettings = defaultSettings ? { ...defaultSettings } : { size: 16, spacing: 8 };
                    log.debug('Initialized default engine settings');
                } else {
                    // 确保 size 和 spacing 字段存在
                    if (typeof state.userData.engineSettings.size !== 'number') {
                        state.userData.engineSettings.size = 16;
                    }
                    if (typeof state.userData.engineSettings.spacing !== 'number') {
                        state.userData.engineSettings.spacing = 8;
                    }
                }
                
                // AI数据迁移：为旧版本的AI数据添加websiteUrl字段
                if (state.userData.aiSettings && Array.isArray(state.userData.aiSettings)) {
                    let needsSave = false;
                    state.userData.aiSettings = state.userData.aiSettings.map(ai => {
                        if (!ai.websiteUrl && ai.url) {
                            // 如果没有websiteUrl，使用url作为websiteUrl
                            ai.websiteUrl = ai.url.replace('{query}', '');
                            needsSave = true;
                        }
                        return ai;
                    });
                    
                    // 如果进行了数据迁移，保存更新后的数据
                    if (needsSave) {
                        log.info('AI data migrated, saving updated data');
                        core.saveUserData((error) => {
                            if (error) {
                                log.error('Failed to save migrated AI data:', error);
                            }
                        });
                    }
                }
                

            } else {
                // 没有存储数据时使用默认数据并保存
                state.userData = getDefaultData();
                log.debug('No stored data, using default data');
                core.saveUserData((error) => {
                    if (error) {
                        log.error('Failed to save default user data:', error);
                    }
                });
            }
            
            // activeNavigationGroupId 现在通过 Proxy 自动同步，无需手动赋值
            core.applyAllSettings();
        });
    },
    
    /**
     * 保存用户数据到存储（带防抖和变化检测）
     * - 在300ms内的多次调用会合并为一次，防止数据覆盖和频繁I/O
     * - 数据未变化时跳过保存，避免不必要的I/O操作
     * - 性能监控：记录保存时间和数据大小
     * @param {Function} callback - 保存完成后的回调函数，参数为error
     * @param {Object} options - 保存选项 { immediate: boolean } - immediate为true时立即保存，不防抖
     */
    saveUserData: (callback, options = {}) => {
        const { immediate = false } = options;
        
        // 收集callback
        if (callback) {
            pendingCallbacks.push(callback);
        }
        
        // 如果要求立即保存，直接执行保存逻辑
        if (immediate) {
            // 立即执行保存，但先清空防抖队列
            timerManager.clearTimeout('saveUserData');
            const callbacks = [...pendingCallbacks];
            pendingCallbacks = [];
            
            // 【关键修复】立即保存时，强制重置哈希，确保数据变化能被检测到
            // 因为立即保存通常用于关键操作（如拖拽排序），需要确保保存
            log.debug('Immediate save requested, forcing save execution');
            
            // 直接执行保存逻辑（复用下面的代码）
            // 注意：_executeSave内部会进行哈希检测，但立即保存时我们希望强制保存
            core._executeSave(callbacks, true); // 传入force参数
            return;
        }
        
        // 使用timerManager统一管理防抖定时器，避免内存泄漏
        timerManager.clearTimeout('saveUserData');
        
        // 设置新的定时器（减少防抖延迟从800ms到300ms，加快保存速度）
        timerManager.setTimeout('saveUserData', () => {
            // 保存当前的callbacks列表
            const callbacks = [...pendingCallbacks];
            pendingCallbacks = [];
            
            // 执行保存逻辑
            core._executeSave(callbacks);
        }, 300); // 【修复】减少防抖延迟从800ms到300ms
    },
    
    /**
     * 内部方法：执行实际的保存操作
     * @private
     * @param {Array<Function>} callbacks - 回调函数数组
     * @param {boolean} force - 是否强制保存（忽略哈希检测）
     */
    _executeSave: (callbacks, force = false) => {
        // activeNavigationGroupId 通过 Proxy 自动同步，无需手动操作
        
        // 运行时数据验证：在保存前检查数据完整性
        try {
            // 验证searchEngines数组（仅在需要恢复时才深拷贝部分数据）
            if (!Array.isArray(state.userData.searchEngines) || state.userData.searchEngines.length === 0) {
                log.warn('Invalid searchEngines detected, restoring defaults');
                const defaultEngines = JSON.parse(JSON.stringify(STATIC_CONFIG.DEFAULT_USER_DATA.searchEngines));
                state.userData.searchEngines = defaultEngines;
                state.userData.activeSearchEngineId = defaultEngines[0].id;
            }
            
            // 验证navigationGroups数组（仅在需要恢复时才深拷贝部分数据）
            if (!Array.isArray(state.userData.navigationGroups) || state.userData.navigationGroups.length === 0) {
                log.warn('Invalid navigationGroups detected, restoring defaults');
                const defaultGroups = JSON.parse(JSON.stringify(STATIC_CONFIG.DEFAULT_USER_DATA.navigationGroups));
                const defaultActiveId = STATIC_CONFIG.DEFAULT_USER_DATA.activeNavigationGroupId;
                state.userData.navigationGroups = defaultGroups;
                state.userData.activeNavigationGroupId = defaultActiveId;
            }
            
            // 验证engineSettings对象
            if (!state.userData.engineSettings || typeof state.userData.engineSettings !== 'object') {
                log.warn('Invalid engineSettings detected, using defaults');
                state.userData.engineSettings = { size: 16, spacing: 8 };
            } else {
                if (typeof state.userData.engineSettings.size !== 'number' || state.userData.engineSettings.size < 10 || state.userData.engineSettings.size > 32) {
                    log.warn('Invalid engineSettings.size, resetting to 16');
                    state.userData.engineSettings.size = 16;
                }
                if (typeof state.userData.engineSettings.spacing !== 'number' || state.userData.engineSettings.spacing < 0 || state.userData.engineSettings.spacing > 20) {
                    log.warn('Invalid engineSettings.spacing, resetting to 8');
                    state.userData.engineSettings.spacing = 8;
                }
            }
        } catch (validationError) {
            log.error('Data validation error:', validationError);
        }
        
        // 【修复】数据变化检测 - 确保包含navigationGroups.items的完整顺序
        // 使用增量序列化避免全量JSON.stringify占用大量内存
        let currentHash;
        try {
            // 【关键修复】确保navigationGroups包含完整的items数组顺序
            // 序列化每个group的items数组的id顺序，确保能检测到排序变化
            const navigationGroupsForHash = state.userData.navigationGroups?.map(group => {
                // 【修复】确保items数组存在且正确序列化
                const items = group.items || [];
                return {
                    id: group.id,
                    name: group.name,
                    // 【关键修复】包含items的完整顺序（通过id数组表示）
                    // 使用slice()确保是新的数组引用，避免引用问题
                    itemsOrder: items.map(item => item?.id).filter(id => id !== undefined)
                };
            }) || [];
            
            // 优化：只序列化可能变化的字段，减少内存占用
            const keyFields = {
                navigationGroups: navigationGroupsForHash, // 【修复】使用包含items顺序的版本
                searchEngines: state.userData.searchEngines,
                activeNavigationGroupId: state.userData.activeNavigationGroupId,
                activeSearchEngineId: state.userData.activeSearchEngineId,
                engineSettings: state.userData.engineSettings,
                searchboxTop: state.userData.searchboxTop,
                searchboxWidth: state.userData.searchboxWidth,
                navigationShape: state.userData.navigationShape,
                navigationAlignment: state.userData.navigationAlignment
            };
            const keyFieldsStr = JSON.stringify(keyFields);
            currentHash = simpleHash(keyFieldsStr);
            
            // 【调试】记录哈希计算详情
            log.debug('Hash calculation:', {
                hash: currentHash,
                lastHash: lastSavedDataHash,
                navigationGroups: navigationGroupsForHash.map(g => ({
                    id: g.id,
                    itemsOrder: g.itemsOrder
                }))
            });
        } catch (hashError) {
            // 降级：如果增量序列化失败，使用全量（但应该很少发生）
            log.warn('Incremental hash failed, using full hash:', hashError);
            const dataStr = JSON.stringify(state.userData);
            currentHash = simpleHash(dataStr);
        }
        
        // 【关键修复】立即保存时强制保存，跳过哈希检测
        if (!force && lastSavedDataHash === currentHash) {
            log.debug('Data unchanged, skipping save');
            // 数据未变化，直接调用callbacks（返回成功）
            callbacks.forEach(cb => {
                try {
                    cb(null);
                } catch (e) {
                    log.error('Callback error in saveUserData:', e);
                }
            });
            return;
        }
        
        if (force) {
            log.debug('Force save: ignoring hash check');
        }
        
        // 【P0内存优化】延迟序列化 - 只在确认需要保存时才序列化完整数据
        // 避免在防抖期间重复序列化占用内存
        let dataStr;
        let dataSize = 0;
        try {
            // 【优化】序列化数据（已移除冗余的验证日志，保留关键日志）
            dataStr = JSON.stringify(state.userData);
            dataSize = dataStr.length;
            
            // [性能监控] 检测数据大小
            if (dataSize > 1024 * 1024) { // 大于1MB
                log.warn('User data size is large:', Math.round(dataSize / 1024), 'KB');
            }
        } catch (stringifyError) {
            log.error('Failed to stringify user data:', stringifyError);
            // 序列化失败，调用callbacks返回错误
            callbacks.forEach(cb => {
                try {
                    cb(stringifyError);
                } catch (e) {
                    log.error('Callback error in saveUserData:', e);
                }
            });
            return;
        }
        
        // 执行实际的保存操作
        const saveStartTime = performance.now();
        // 【修复】storage.set内部会再次序列化，所以传递原始对象即可
        // dataStr在这里已经不再需要，可以立即释放
        const dataToSave = state.userData;
        // 注意：不在这里释放dataStr，因为它可能在某些错误场景下还需要
        // 但可以在storage.set调用后立即释放（通过作用域自然释放）
        
        storage.set(dataToSave, (error) => {
            if (!error) {
                lastSavedDataHash = currentHash; // 保存成功，更新哈希
                const saveTime = Math.round(performance.now() - saveStartTime);
                if (saveTime > 100) {
                    log.warn('Slow save operation:', saveTime, 'ms');
                }
            }
            
            // 依次调用所有pending的callbacks
            callbacks.forEach(cb => {
                try {
                    cb(error);
                } catch (e) {
                    log.error('Callback error in saveUserData:', e);
                }
            });
        });
    },
    
    /**
     * 应用所有用户设置到UI
     * 包括搜索框位置、宽度、导航样式等
     */
    applyAllSettings: () => {
        render.searchPills();
        render.searchEngineSwitcher(true); // 跳过菜单渲染，稍后统一渲染
        core.applySearchboxPosition(state.userData.searchboxTop);
        if (dom.positionSlider) dom.positionSlider.value = state.userData.searchboxTop;
        if (dom.positionValue) dom.positionValue.textContent = state.userData.searchboxTop;
        core.applySearchboxWidth(state.userData.searchboxWidth);
        if (dom.widthSlider) dom.widthSlider.value = state.userData.searchboxWidth;
        if (dom.widthValue) dom.widthValue.textContent = state.userData.searchboxWidth;
        core.applyScopeMenuWidth(state.userData.scopeMenuWidth);
        if (dom.scopeWidthSlider) dom.scopeWidthSlider.value = state.userData.scopeMenuWidth;
        if (dom.scopeWidthValue) dom.scopeWidthValue.textContent = state.userData.scopeMenuWidth;
        render.scopeMenu();
        render.customFilters();
        render.searchEngineMenu(); // 统一在此处渲染一次

        navigationModule.utils.applyAppearanceSettings(state.userData.navigationItemSize, state.userData.navigationGridGap);
        if(dom.navItemSizeSlider) {
            dom.navItemSizeSlider.value = state.userData.navigationItemSize;
            dom.navItemSizeValue.textContent = state.userData.navigationItemSize;
            dom.navGridGapSlider.value = state.userData.navigationGridGap;
            dom.navGridGapValue.textContent = state.userData.navigationGridGap;
        }
        
        // 应用引擎设置滑块值（确保使用实际加载的数据）
        if (state.userData.engineSettings) {
            const engineSize = state.userData.engineSettings.size || 16;
            const engineSpacing = state.userData.engineSettings.spacing || 8;
            
            if (dom.engineSizeSlider) {
                dom.engineSizeSlider.value = engineSize;
                if (dom.engineSizeValue) {
                    dom.engineSizeValue.textContent = `${engineSize}px`;
                }
            }
            
            if (dom.engineSpacingSlider) {
                dom.engineSpacingSlider.value = engineSpacing;
                if (dom.engineSpacingValue) {
                    dom.engineSpacingValue.textContent = `${engineSpacing}px`;
                }
            }
        }

            // [新增] dock栏缩放
            if (typeof state.userData.dockScale !== 'number') state.userData.dockScale = 1.0;
            document.documentElement.style.setProperty('--dock-scale', state.userData.dockScale);
            if (dom.dockScaleSlider) dom.dockScaleSlider.value = state.userData.dockScale;
            if (dom.dockScaleValue) dom.dockScaleValue.textContent = Number(state.userData.dockScale).toFixed(2);
        
        // Apply saved navigation shape
        if (state.userData.navigationShape && state.userData.navigationShape !== 'square') {
            document.body.classList.add(`shape-${state.userData.navigationShape}`);
        }
        
        // 【优化】批量应用导航对齐和密度设置（减少重排）
        // 修改对齐方式：在父容器上使用justify-content控制对齐（grid宽度为fit-content）
        if (dom.navigationContainer) {
            const alignmentMap = {
                'left': 'flex-start',
                'center': 'center',
                'right': 'flex-end'
            };
            
            // 批量应用对齐样式
            if (state.userData.navigationAlignment && alignmentMap[state.userData.navigationAlignment]) {
                dom.navigationContainer.style.justifyContent = alignmentMap[state.userData.navigationAlignment];
            }
        }
            
            // 应用密度设置
        if (dom.navigationGrid && state.userData.navigationItemMinWidth) {
                dom.navigationGrid.style.setProperty('--nav-item-min-width', `${state.userData.navigationItemMinWidth}px`);
        }
        
        navigationModule.render.all();
        
        // 应用保存的外观设置CSS变量（wallpaperEffects等）
        // 使用timerManager确保effects-panel已初始化（延迟执行，避免初始化顺序问题）
        timerManager.setTimeout('applyEffectsCSSVariables', () => {
            if (typeof window.applyEffectsCSSVariables === 'function') {
                window.applyEffectsCSSVariables();
            }
        }, 0);
    },
    
    /**
     * 应用搜索框垂直位置
     * @param {number} v - 位置百分比值（vh）
     */
    applySearchboxPosition: v => {
        const body = dom.body || document.getElementById('body') || document.body;
        if (body) {
            body.style.paddingTop = `${v}vh`;
        } else {
            log.error('applySearchboxPosition: body元素未找到');
        }
    },
    
    /**
     * 应用搜索框宽度
     * @param {number} v - 宽度像素值
     */
    applySearchboxWidth: v => {
        const main = dom.main || document.getElementById('main');
        const navGrid = dom.navigationGrid || document.getElementById('navigation-grid');
        
        if (main) {
            main.style.maxWidth = `${v}px`;
        } else {
            log.error('applySearchboxWidth: main元素未找到');
        }
        
        if (navGrid) {
            navGrid.style.maxWidth = `${v}px`;
        }
    },
    
    /**
     * 应用搜索范围菜单宽度
     * @param {number} v - 宽度像素值
     */
    applyScopeMenuWidth: v => {
        document.documentElement.style.setProperty('--scope-menu-width', `${v}px`);
    },
    
    /**
     * 发起搜索（从搜索框触发）
     * 获取搜索框内容并执行搜索
     */
    initiateSearch: () => {
        let q = dom.realSearchInput.value.trim();
        if (!q && state.activeSearchPills.length === 0) return;
        core.performSearch(q);
    },
    
    /**
     * 执行搜索
     * @param {string} query - 搜索查询字符串
     * 会组合所有激活的搜索条件（pills），保存搜索历史，并在新标签页打开搜索结果
     */
    performSearch: (query) => {
        if (query) {
            state.userData.searchHistory.unshift(query);
            state.userData.searchHistory = [...new Set(state.userData.searchHistory)].slice(0, 20);
            core.saveUserData((error) => {
                if (error) {
                    log.error('Failed to save search history:', error);
                    // 搜索历史保存失败不影响搜索功能，仅记录日志
                }
            });
        }
        const engine = state.userData.searchEngines.find(e => e.id === state.userData.activeSearchEngineId);

        const sitePills = state.activeSearchPills.filter(p => p.type === 'site');
        const scopePills = state.activeSearchPills.filter(p => p.type === 'scope');
        const otherPills = state.activeSearchPills.filter(p => p.type !== 'site' && p.type !== 'scope');
        const otherPillsQuery = otherPills.map(p => p.queryPart).join(' ');

        let siteQuery = '';
        if (sitePills.length > 0) {
            siteQuery = sitePills.map(p => p.queryPart).join(' OR ');
            if (sitePills.length > 1) {
                siteQuery = `(${siteQuery})`;
            }
        }

        let scopeQuery = '';
        if (scopePills.length > 0) {
            scopeQuery = scopePills.map(p => p.queryPart).join(' OR ');
            if (scopePills.length > 1) {
                scopeQuery = `(${scopeQuery})`;
            }
        }

        const finalQuery = `${query} ${otherPillsQuery} ${siteQuery} ${scopeQuery}`.trim().replace(/\s+/g, ' ');
        if (engine) window.open(engine.url.replace(/\{query\}/gi, encodeURIComponent(finalQuery)), '_blank');
        if (dom.realSearchInput) dom.realSearchInput.blur();
        utils.closeAllDropdowns();
    },
    
    /**
     * 更新时钟显示
     * 显示当前时间和星期几
     */
    updateClock: () => {
        if (!dom.searchClock) return;
        const n = new Date();
        dom.searchClock.innerHTML = `${n.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}<div class="day">${n.toLocaleDateString('zh-CN',{weekday:'long'})}</div>`;
    },
};

