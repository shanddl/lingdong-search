/**
 * Supabase API 客户端 - 直接使用 REST API（无需 SDK）
 */

import { logger } from '../logger.js';

const log = logger.module('SupabaseClient');

// Supabase 配置
let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';
let currentSession = null;

export const apiClient = {
    /**
     * 初始化 Supabase 客户端
     */
    init(supabaseUrl, supabaseKey) {
        SUPABASE_URL = supabaseUrl.replace(/\/$/, '');
        SUPABASE_ANON_KEY = supabaseKey;
        
        log.info('Supabase 客户端已初始化:', SUPABASE_URL);
        
        // 测试连接
        this.testConnection();
        
        // 尝试恢复会话
        this.restoreSession();
        
        return true;
    },

    /**
     * 测试 Supabase 连接
     */
    async testConnection() {
        try {
            log.info('正在测试 Supabase 连接...');
            
            // 测试 REST API
            const restResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY
                }
            });
            log.info('REST API 测试结果:', restResponse.status, restResponse.statusText);
            
            // 测试 Auth API
            const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY
                }
            });
            log.info('Auth API 测试结果:', authResponse.status, authResponse.statusText);
            
            if (restResponse.ok || authResponse.ok) {
                log.info('✅ Supabase 连接正常');
            } else {
                log.warn('⚠️ Supabase 连接可能有问题');
            }
        } catch (error) {
            log.error('❌ Supabase 连接失败:', error.message);
            log.error('请检查：');
            log.error('1. 网络是否正常');
            log.error('2. Supabase 项目是否已暂停');
            log.error('3. manifest.json 权限是否正确');
        }
    },

    /**
     * 恢复会话
     */
    async restoreSession() {
        const sessionData = localStorage.getItem('supabase.auth.session');
        if (sessionData) {
            try {
                currentSession = JSON.parse(sessionData);
                // 验证 session 是否仍然有效
                const isValid = await this.verifySession();
                if (!isValid) {
                    currentSession = null;
                    localStorage.removeItem('supabase.auth.session');
                }
            } catch (error) {
                log.error('恢复会话失败:', error);
                currentSession = null;
            }
        }
    },

    /**
     * 验证会话
     */
    async verifySession() {
        if (!currentSession || !currentSession.access_token) return false;
        
        try {
            const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                headers: {
                    'Authorization': `Bearer ${currentSession.access_token}`,
                    'apikey': SUPABASE_ANON_KEY
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    },

    /**
     * 保存会话
     */
    saveSession(session) {
        currentSession = session;
        localStorage.setItem('supabase.auth.session', JSON.stringify(session));
    },

    /**
     * 用户注册
     */
    async register(email, password) {
        try {
            log.info('开始注册，URL:', `${SUPABASE_URL}/auth/v1/signup`);
            
            const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY
                },
                body: JSON.stringify({ email, password })
            });

            log.info('注册响应状态:', response.status);

            const data = await response.json();
            log.info('注册响应数据:', data);

            if (!response.ok) {
                const errorMsg = data.error_description || data.msg || data.message || '注册失败';
                log.error('注册失败详情:', errorMsg);
                throw new Error(errorMsg);
            }

            if (data.access_token) {
                this.saveSession({
                    access_token: data.access_token,
                    refresh_token: data.refresh_token,
                    user: data.user
                });
            }

            log.info('注册成功:', email);
            return {
                success: true,
                data: {
                    token: data.access_token,
                    user: {
                        id: data.user.id,
                        email: data.user.email
                    }
                }
            };
        } catch (error) {
            log.error('注册失败完整错误:', error);
            // 提供更友好的错误消息
            let errorMessage = error.message;
            if (error.message === 'Failed to fetch') {
                errorMessage = '网络连接失败，请检查：\n1. 是否能访问 Supabase\n2. manifest.json 中是否添加了权限\n3. Supabase 项目是否暂停';
            }
            return { success: false, error: errorMessage };
        }
    },

    /**
     * 用户登录
     */
    async login(email, password) {
        try {
            const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error_description || data.msg || '登录失败');
            }

            this.saveSession({
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                user: data.user
            });

            log.info('登录成功:', email);
            return {
                success: true,
                data: {
                    token: data.access_token,
                    user: {
                        id: data.user.id,
                        email: data.user.email
                    }
                }
            };
        } catch (error) {
            log.error('登录失败:', error.message);
            return { success: false, error: error.message };
        }
    },

    /**
     * 用户登出
     */
    async logout() {
        try {
            if (currentSession && currentSession.access_token) {
                await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${currentSession.access_token}`,
                        'apikey': SUPABASE_ANON_KEY
                    }
                });
            }

            currentSession = null;
            localStorage.removeItem('supabase.auth.session');
            
            log.info('登出成功');
            return { success: true };
        } catch (error) {
            log.error('登出失败:', error.message);
            return { success: false, error: error.message };
        }
    },

    /**
     * 获取当前用户
     */
    async getCurrentUser() {
        try {
            if (!currentSession || !currentSession.access_token) {
                return { success: false, error: '未登录' };
            }

            const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                headers: {
                    'Authorization': `Bearer ${currentSession.access_token}`,
                    'apikey': SUPABASE_ANON_KEY
                }
            });

            if (!response.ok) {
                throw new Error('获取用户信息失败');
            }

            const user = await response.json();

            return {
                success: true,
                data: {
                    user: {
                        id: user.id,
                        email: user.email
                    }
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /**
     * 推送数据到云端
     */
    async pushData(userData) {
        try {
            if (!currentSession || !currentSession.user) {
                throw new Error('未登录');
            }

            const userId = currentSession.user.id;
            const version = (await this.getDataVersion()) + 1;

            // 使用 Supabase REST API 的 upsert 功能
            const response = await fetch(`${SUPABASE_URL}/rest/v1/user_sync_data?user_id=eq.${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentSession.access_token}`,
                    'apikey': SUPABASE_ANON_KEY,
                    'Prefer': 'resolution=merge-duplicates,return=representation'
                },
                body: JSON.stringify({
                    user_id: userId,
                    data: userData,
                    version: version
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || '数据推送失败');
            }

            const data = await response.json();

            log.info('数据推送成功');
            return { success: true, data: data[0] };
        } catch (error) {
            log.error('数据推送失败:', error.message);
            return { success: false, error: error.message };
        }
    },

    /**
     * 从云端拉取数据
     */
    async pullData() {
        try {
            if (!currentSession || !currentSession.user) {
                throw new Error('未登录');
            }

            const userId = currentSession.user.id;

            const response = await fetch(`${SUPABASE_URL}/rest/v1/user_sync_data?user_id=eq.${userId}&select=*`, {
                headers: {
                    'Authorization': `Bearer ${currentSession.access_token}`,
                    'apikey': SUPABASE_ANON_KEY
                }
            });

            if (!response.ok) {
                throw new Error('数据拉取失败');
            }

            const data = await response.json();

            if (data.length === 0) {
                return { success: true, data: { hasData: false } };
            }

            log.info('数据拉取成功');
            return {
                success: true,
                data: {
                    hasData: true,
                    data: data[0].data,
                    version: data[0].version,
                    updated_at: data[0].updated_at
                }
            };
        } catch (error) {
            log.error('数据拉取失败:', error.message);
            return { success: false, error: error.message };
        }
    },

    /**
     * 获取数据版本
     */
    async getDataVersion() {
        try {
            if (!currentSession || !currentSession.user) return 0;

            const userId = currentSession.user.id;

            const response = await fetch(`${SUPABASE_URL}/rest/v1/user_sync_data?user_id=eq.${userId}&select=version`, {
                headers: {
                    'Authorization': `Bearer ${currentSession.access_token}`,
                    'apikey': SUPABASE_ANON_KEY
                }
            });

            if (!response.ok) return 0;

            const data = await response.json();
            if (data.length === 0) return 0;

            return data[0].version || 0;
        } catch (error) {
            return 0;
        }
    },

    /**
     * 删除云端数据
     */
    async deleteData() {
        try {
            if (!currentSession || !currentSession.user) {
                throw new Error('未登录');
            }

            const userId = currentSession.user.id;

            const response = await fetch(`${SUPABASE_URL}/rest/v1/user_sync_data?user_id=eq.${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${currentSession.access_token}`,
                    'apikey': SUPABASE_ANON_KEY
                }
            });

            if (!response.ok) {
                throw new Error('删除云端数据失败');
            }

            log.info('云端数据已删除');
            return { success: true };
        } catch (error) {
            log.error('删除云端数据失败:', error.message);
            return { success: false, error: error.message };
        }
    },

    /**
     * 检查服务健康状态
     */
    async checkHealth() {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
                headers: { 'apikey': SUPABASE_ANON_KEY }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    },

    // 兼容旧接口
    async getToken() {
        return currentSession?.access_token || null;
    },

    async saveToken(token) {
        log.debug('Token 自动管理');
    },

    async clearToken() {
        log.debug('Token 清理由 logout 处理');
    }
};
