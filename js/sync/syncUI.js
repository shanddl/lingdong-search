/**
 * 同步 UI 界面 - 登录/注册/状态显示
 */

import { authManager } from './authManager.js';
import { syncManager } from './syncManager.js';
import { logger } from '../logger.js';

const log = logger.module('SyncUI');

export const syncUI = {
    statusIntervalId: null,
    /**
     * 创建登录/注册模态框
     */
    createAuthModal() {
        const modal = document.createElement('div');
        modal.id = 'sync-auth-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="
                background: var(--bg-primary, #1e1e1e);
                border-radius: 12px;
                padding: 30px;
                width: 400px;
                max-width: 90%;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            ">
                <h2 style="margin: 0 0 20px 0; color: var(--text-primary, #fff); font-size: 24px;">
                    数据同步
                </h2>
                
                <div id="sync-auth-tabs" style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <button class="sync-tab active" data-tab="login" style="
                        flex: 1;
                        padding: 10px;
                        border: none;
                        background: var(--accent-color, #4a9eff);
                        color: white;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">登录</button>
                    <button class="sync-tab" data-tab="register" style="
                        flex: 1;
                        padding: 10px;
                        border: none;
                        background: var(--bg-secondary, #2d2d2d);
                        color: var(--text-secondary, #aaa);
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">注册</button>
                </div>

                <form id="sync-auth-form">
                    <div style="margin-bottom: 15px;">
                        <input 
                            type="email" 
                            id="sync-email" 
                            placeholder="邮箱地址"
                            required
                            style="
                                width: 100%;
                                padding: 12px;
                                border: 1px solid var(--border-color, #444);
                                border-radius: 6px;
                                background: var(--bg-secondary, #2d2d2d);
                                color: var(--text-primary, #fff);
                                font-size: 14px;
                                box-sizing: border-box;
                            "
                        />
                    </div>

                    <div style="margin-bottom: 20px;">
                        <input 
                            type="password" 
                            id="sync-password" 
                            placeholder="密码（至少6位）"
                            required
                            minlength="6"
                            style="
                                width: 100%;
                                padding: 12px;
                                border: 1px solid var(--border-color, #444);
                                border-radius: 6px;
                                background: var(--bg-secondary, #2d2d2d);
                                color: var(--text-primary, #fff);
                                font-size: 14px;
                                box-sizing: border-box;
                            "
                        />
                    </div>

                    <div id="sync-error-message" style="
                        color: #ff4444;
                        margin-bottom: 15px;
                        font-size: 13px;
                        display: none;
                    "></div>

                    <div style="display: flex; gap: 10px;">
                        <button 
                            type="submit" 
                            style="
                                flex: 1;
                                padding: 12px;
                                border: none;
                                background: var(--accent-color, #4a9eff);
                                color: white;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 14px;
                                font-weight: 500;
                            "
                        >
                            <span id="sync-submit-text">登录</span>
                        </button>
                        <button 
                            type="button" 
                            id="sync-cancel-btn"
                            style="
                                padding: 12px 20px;
                                border: 1px solid var(--border-color, #444);
                                background: transparent;
                                color: var(--text-secondary, #aaa);
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 14px;
                            "
                        >取消</button>
                    </div>
                </form>

                <div style="
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid var(--border-color, #444);
                    font-size: 12px;
                    color: var(--text-secondary, #888);
                ">
                    <p style="margin: 0;">💡 提示：</p>
                    <ul style="margin: 5px 0; padding-left: 20px;">
                        <li>注册后可实现跨设备同步</li>
                        <li>数据加密传输，安全可靠</li>
                        <li>随时可以删除云端数据</li>
                    </ul>
                </div>
            </div>
        `;

        // 绑定事件
        this.bindAuthModalEvents(modal);

        return modal;
    },

    /**
     * 绑定模态框事件
     */
    bindAuthModalEvents(modal) {
        // 标签切换
        const tabs = modal.querySelectorAll('.sync-tab');
        const submitText = modal.querySelector('#sync-submit-text');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.background = 'var(--bg-secondary, #2d2d2d)';
                    t.style.color = 'var(--text-secondary, #aaa)';
                });
                tab.classList.add('active');
                tab.style.background = 'var(--accent-color, #4a9eff)';
                tab.style.color = 'white';
                
                const isLogin = tab.dataset.tab === 'login';
                submitText.textContent = isLogin ? '登录' : '注册';
            });
        });

        // 表单提交
        const form = modal.querySelector('#sync-auth-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAuthSubmit(modal);
        });

        // 取消按钮
        const cancelBtn = modal.querySelector('#sync-cancel-btn');
        cancelBtn.addEventListener('click', () => {
            modal.remove();
        });

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    },

    /**
     * 处理登录/注册提交
     */
    async handleAuthSubmit(modal) {
        const email = modal.querySelector('#sync-email').value;
        const password = modal.querySelector('#sync-password').value;
        const isLogin = modal.querySelector('.sync-tab.active').dataset.tab === 'login';
        const errorMsg = modal.querySelector('#sync-error-message');
        const submitBtn = modal.querySelector('button[type="submit"]');

        // 显示加载状态
        submitBtn.disabled = true;
        submitBtn.textContent = isLogin ? '登录中...' : '注册中...';
        errorMsg.style.display = 'none';

        try {
            const result = isLogin 
                ? await authManager.login(email, password)
                : await authManager.register(email, password);

            if (result.success) {
                // 登录成功
                modal.remove();
                await syncManager.init();
                await syncManager.fullSync();
                this.showToast('✓ ' + (isLogin ? '登录成功' : '注册成功'), 'success');
                this.updateSyncStatus();
            } else {
                // 显示错误
                errorMsg.textContent = result.error || '操作失败';
                errorMsg.style.display = 'block';
            }
        } catch (error) {
            errorMsg.textContent = '网络错误，请检查后端是否启动';
            errorMsg.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = isLogin ? '登录' : '注册';
        }
    },

    /**
     * 显示登录/注册界面
     */
    showAuthModal() {
        // 删除已存在的模态框
        const existingModal = document.getElementById('sync-auth-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = this.createAuthModal();
        document.body.appendChild(modal);
    },

    /**
     * 创建同步状态指示器
     */
    createSyncIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'sync-status-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            background: var(--bg-secondary, #2d2d2d);
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13px;
            color: var(--text-primary, #fff);
            cursor: pointer;
            z-index: 9999;
            transition: transform 0.2s;
        `;

        indicator.innerHTML = `
            <span id="sync-status-icon">☁️</span>
            <span id="sync-status-text">未登录</span>
        `;

        // 点击显示菜单
        indicator.addEventListener('click', () => {
            this.showSyncMenu();
        });

        // 悬停效果
        indicator.addEventListener('mouseenter', () => {
            indicator.style.transform = 'scale(1.05)';
        });
        indicator.addEventListener('mouseleave', () => {
            indicator.style.transform = 'scale(1)';
        });

        return indicator;
    },

    /**
     * 更新同步状态显示
     */
    updateSyncStatus() {
        const indicator = document.getElementById('sync-status-indicator');
        if (!indicator) return;

        const icon = indicator.querySelector('#sync-status-icon');
        const text = indicator.querySelector('#sync-status-text');
        const status = syncManager.getSyncStatus();

        if (!status.isLoggedIn) {
            icon.textContent = '☁️';
            text.textContent = '未登录';
        } else if (status.status === 'syncing') {
            icon.textContent = '⟳';
            text.textContent = '同步中...';
        } else if (status.status === 'success') {
            icon.textContent = '✓';
            text.textContent = '已同步';
        } else if (status.status === 'error') {
            icon.textContent = '✗';
            text.textContent = '同步失败';
        }
    },

    /**
     * 显示同步菜单
     */
    showSyncMenu() {
        const status = syncManager.getSyncStatus();
        
        if (!status.isLoggedIn) {
            // 未登录时显示测试和登录选项
            const menu = `
数据同步功能

1. 测试 Supabase 连接
2. 登录/注册
            `;
            
            const action = prompt(menu, '1');
            
            if (action === '1') {
                this.testSupabaseConnection();
            } else if (action === '2') {
                this.showAuthModal();
            }
        } else {
            const menu = `
当前用户: ${status.user.email}
最后同步: ${status.lastSyncTime ? status.lastSyncTime.toLocaleString() : '未同步'}

1. 手动同步
2. 测试连接
3. 登出
4. 删除云端数据
            `;
            
            const action = prompt(menu, '1');
            
            if (action === '1') {
                this.manualSync();
            } else if (action === '2') {
                this.testSupabaseConnection();
            } else if (action === '3') {
                this.logout();
            } else if (action === '4') {
                this.deleteCloudData();
            }
        }
    },

    /**
     * 测试 Supabase 连接
     */
    async testSupabaseConnection() {
        this.showToast('正在测试连接...', 'info');
        
        try {
            // 从 apiClient 获取配置
            const SUPABASE_URL = 'https://obfwbvnqtuktkadbikc.supabase.co';
            const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iZndidm5xdHVrdGthZGJpa2NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTUxMDMsImV4cCI6MjA3NzMzMTEwM30.rZklS9PHbiOyeFRxho4lncjb1p1yGar3OKB4p4NI_Rw';
            
            // 测试 REST API
            const restResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
                headers: { 'apikey': SUPABASE_ANON_KEY }
            });
            
            // 测试 Auth API
            const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
                headers: { 'apikey': SUPABASE_ANON_KEY }
            });
            
            let message = '测试结果：\n\n';
            message += `REST API: ${restResponse.ok ? '✅ 成功 (' + restResponse.status + ')' : '❌ 失败 (' + restResponse.status + ')'}\n`;
            message += `Auth API: ${authResponse.ok ? '✅ 成功 (' + authResponse.status + ')' : '❌ 失败 (' + authResponse.status + ')'}\n\n`;
            
            if (restResponse.ok && authResponse.ok) {
                message += '🎉 Supabase 连接正常！\n可以正常使用同步功能。';
                this.showToast('✅ 连接测试成功', 'success');
            } else {
                message += '⚠️ 连接存在问题。\n\n可能原因：\n1. 代理未生效\n2. 项目已暂停\n3. 网络限制';
                this.showToast('❌ 连接测试失败', 'error');
            }
            
            alert(message);
            
            // 在控制台输出详细信息
            console.log('[连接测试] REST API 状态:', restResponse.status, restResponse.statusText);
            console.log('[连接测试] Auth API 状态:', authResponse.status, authResponse.statusText);
            
        } catch (error) {
            const message = `❌ 连接测试失败\n\n错误：${error.message}\n\n请检查：\n1. 代理是否正常工作\n2. Supabase 项目是否可访问\n3. 浏览器控制台的详细错误`;
            alert(message);
            this.showToast('❌ 连接失败: ' + error.message, 'error');
            console.error('[连接测试] 错误:', error);
        }
    },

    /**
     * 手动同步
     */
    async manualSync() {
        this.showToast('开始同步...', 'info');
        const result = await syncManager.pushToCloud(state.userData);
        
        if (result.success) {
            this.showToast('✓ 同步成功', 'success');
        } else {
            this.showToast('✗ 同步失败: ' + result.error, 'error');
        }
        
        this.updateSyncStatus();
    },

    /**
     * 登出
     */
    async logout() {
        if (confirm('确定要登出吗？登出后将停止数据同步。')) {
            await authManager.logout();
            syncManager.stopAutoSync();
            this.stopStatusInterval();
            this.showToast('已登出', 'info');
            this.updateSyncStatus();
        }
    },

    /**
     * 删除云端数据
     */
    async deleteCloudData() {
        if (confirm('⚠️ 警告：此操作将永久删除云端数据，无法恢复！\n\n确定要删除吗？')) {
            const result = await syncManager.deleteCloudData();
            
            if (result.success) {
                this.showToast('✓ 云端数据已删除', 'success');
            } else {
                this.showToast('✗ 删除失败: ' + result.error, 'error');
            }
        }
    },

    /**
     * 显示 Toast 提示
     */
    showToast(message, type = 'info') {
        const colors = {
            success: '#4caf50',
            error: '#ff4444',
            info: '#4a9eff'
        };

        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 12px 20px;
            background: ${colors[type] || colors.info};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10001;
            font-size: 14px;
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = message;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    /**
     * 初始化UI
     */
    init() {
        // 添加同步状态指示器
        const indicator = this.createSyncIndicator();
        document.body.appendChild(indicator);

        // 更新状态
        this.updateSyncStatus();

        // 监听同步状态变化
        this.startStatusInterval();

        log.info('同步UI已初始化');

        // 页面可见性变更：隐藏时暂停轮询，可见时恢复
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopStatusInterval();
            } else {
                this.startStatusInterval();
            }
        });
    }
};

// 辅助方法：管理状态轮询定时器
syncUI.startStatusInterval = function() {
    if (this.statusIntervalId) {
        clearInterval(this.statusIntervalId);
    }
    this.statusIntervalId = setInterval(() => {
        this.updateSyncStatus();
    }, 1000);
};

syncUI.stopStatusInterval = function() {
    if (this.statusIntervalId) {
        clearInterval(this.statusIntervalId);
        this.statusIntervalId = null;
    }
};

// 暴露轮询控制到全局，便于性能监视器控制
try {
    window.syncUIControls = {
        startStatusInterval: () => syncUI.startStatusInterval(),
        stopStatusInterval: () => syncUI.stopStatusInterval(),
    };
} catch (e) { /* noop */ }

