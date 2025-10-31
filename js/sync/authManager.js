/**
 * 认证管理器 - 使用 Supabase Auth
 */

import { apiClient } from './apiClient.js';
import { logger } from '../logger.js';

const log = logger.module('AuthManager');

export const authManager = {
    currentUser: null,

    /**
     * 用户注册
     */
    async register(email, password) {
        log.info('尝试注册用户:', email);
        
        const result = await apiClient.register(email, password);
        
        if (result.success) {
            this.currentUser = result.data.user;
            log.info('注册成功:', this.currentUser.email);
        }
        
        return result;
    },

    /**
     * 用户登录
     */
    async login(email, password) {
        log.info('尝试登录用户:', email);
        
        const result = await apiClient.login(email, password);
        
        if (result.success) {
            this.currentUser = result.data.user;
            log.info('登录成功:', this.currentUser.email);
        }
        
        return result;
    },

    /**
     * 用户登出
     */
    async logout() {
        log.info('用户登出');
        
        const result = await apiClient.logout();
        this.currentUser = null;
        
        return result;
    },

    /**
     * 检查登录状态
     */
    async checkLoginStatus() {
        const result = await apiClient.getCurrentUser();
        
        if (result.success) {
            this.currentUser = result.data.user;
            log.debug('已登录:', this.currentUser.email);
            return true;
        } else {
            this.currentUser = null;
            return false;
        }
    },

    /**
     * 获取当前用户
     */
    getCurrentUser() {
        return this.currentUser;
    },

    /**
     * 是否已登录
     */
    isLoggedIn() {
        return this.currentUser !== null;
    }
};
