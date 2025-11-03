/**
 * 同步管理器 - 核心同步逻辑
 */

import { apiClient } from './apiClient.js';
import { authManager } from './authManager.js';
import { storage } from '../storage.js';
import { logger } from '../logger.js';
import { state } from '../state.js';
import { timerManager } from '../utils/timerManager.js';

const log = logger.module('SyncManager');

export const syncManager = {
    syncStatus: 'idle', // idle, syncing, success, error
    lastSyncTime: null,
    syncError: null,
    autoSyncEnabled: true,
    // syncInterval已移除，现在使用timerManager统一管理

    /**
     * 初始化同步管理器
     */
    async init() {
        log.info('初始化同步管理器');
        
        // 检查登录状态
        const isLoggedIn = await authManager.checkLoginStatus();
        
        if (isLoggedIn) {
            log.info('用户已登录，启动自动同步');
            this.startAutoSync();
        } else {
            log.info('用户未登录，同步功能未启用');
        }
        
        return isLoggedIn;
    },

    /**
     * 推送数据到云端
     */
    async pushToCloud(userData) {
        if (!authManager.isLoggedIn()) {
            return { success: false, error: '未登录' };
        }

        log.info('推送数据到云端');
        this.syncStatus = 'syncing';
        
        // 使用新的 Supabase API
        const result = await apiClient.pushData(userData);
        
        if (result.success) {
            this.syncStatus = 'success';
            this.lastSyncTime = new Date();
            this.syncError = null;
            log.info('数据推送成功');
        } else {
            this.syncStatus = 'error';
            this.syncError = result.error;
            log.error('数据推送失败:', result.error);
        }
        
        return result;
    },

    /**
     * 从云端拉取数据
     */
    async pullFromCloud() {
        if (!authManager.isLoggedIn()) {
            return { success: false, error: '未登录' };
        }

        log.info('从云端拉取数据');
        this.syncStatus = 'syncing';
        
        // 使用新的 Supabase API
        const result = await apiClient.pullData();
        
        if (result.success) {
            this.syncStatus = 'success';
            this.lastSyncTime = new Date();
            this.syncError = null;
            
            if (result.data.hasData) {
                log.info('云端数据拉取成功');
                return { success: true, data: result.data.data };
            } else {
                log.info('云端暂无数据');
                return { success: true, data: null };
            }
        } else {
            this.syncStatus = 'error';
            this.syncError = result.error;
            log.error('数据拉取失败:', result.error);
            return result;
        }
    },

    /**
     * 检查云端版本
     */
    async checkCloudVersion() {
        if (!authManager.isLoggedIn()) {
            return { success: false, error: '未登录' };
        }

        // 使用拉取数据来检查版本
        const result = await apiClient.pullData();
        
        if (result.success) {
            return {
                success: true,
                data: {
                    hasData: result.data.hasData,
                    version: result.data.version || 0
                }
            };
        }
        
        return result;
    },

    /**
     * 执行完整同步
     * 策略：先拉取云端数据，如果本地更新则推送
     */
    async fullSync() {
        if (!authManager.isLoggedIn()) {
            log.warn('未登录，跳过同步');
            return { success: false, error: '未登录' };
        }

        log.info('开始完整同步');
        
        try {
            // 1. 检查云端版本
            const checkResult = await this.checkCloudVersion();
            
            if (!checkResult.success) {
                return checkResult;
            }

            // 2. 如果云端有数据，先拉取
            if (checkResult.data.hasData) {
                const pullResult = await this.pullFromCloud();
                
                if (pullResult.success && pullResult.data) {
                    // 询问用户是否要使用云端数据
                    const useCloud = await this.askUserForConflictResolution(pullResult.data);
                    
                    if (useCloud) {
                        // 使用云端数据覆盖本地
                        storage.set(pullResult.data, () => {
                            state.userData = pullResult.data;
                            log.info('已使用云端数据');
                        });
                    } else {
                        // 使用本地数据覆盖云端
                        await this.pushToCloud(state.userData);
                    }
                }
            } else {
                // 云端无数据，推送本地数据
                await this.pushToCloud(state.userData);
            }

            return { success: true };
            
        } catch (error) {
            log.error('同步失败:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * 询问用户解决冲突
     */
    async askUserForConflictResolution(cloudData) {
        // 简单策略：使用确认对话框
        return confirm('检测到云端数据，是否要使用云端数据覆盖本地？\n\n点击"确定"使用云端数据\n点击"取消"使用本地数据');
    },

    /**
     * 启动自动同步（使用timerManager统一管理）
     */
    startAutoSync() {
        // 使用timerManager统一管理定时器，避免内存泄漏
        timerManager.clearInterval('syncAutoSync');

        // 每5分钟检查一次
        timerManager.setInterval('syncAutoSync', async () => {
            if (this.autoSyncEnabled && authManager.isLoggedIn()) {
                log.debug('执行自动同步');
                await this.pushToCloud(state.userData);
            }
        }, 5 * 60 * 1000);

        log.info('自动同步已启动');
    },

    /**
     * 停止自动同步（使用timerManager统一管理）
     */
    stopAutoSync() {
        timerManager.clearInterval('syncAutoSync');
        log.info('自动同步已停止');
    },

    /**
     * 获取同步状态
     */
    getSyncStatus() {
        return {
            status: this.syncStatus,
            lastSyncTime: this.lastSyncTime,
            error: this.syncError,
            isLoggedIn: authManager.isLoggedIn(),
            user: authManager.getCurrentUser()
        };
    },

    /**
     * 删除云端数据
     */
    async deleteCloudData() {
        if (!authManager.isLoggedIn()) {
            return { success: false, error: '未登录' };
        }

        log.warn('删除云端数据');
        const result = await apiClient.deleteData();
        
        if (result.success) {
            log.info('云端数据已删除');
        }
        
        return result;
    }
};

