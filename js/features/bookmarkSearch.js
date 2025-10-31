// 书签搜索功能模块
import { logger } from '../logger.js';

const log = logger.module('BookmarkSearch');

export const bookmarkSearch = {
    /**
     * 搜索书签
     * @param {string} query - 搜索查询
     * @returns {Promise<Array>} 书签列表
     */
    searchBookmarks: async (query) => {
        try {
            log.debug('🔍 开始搜索书签，查询词:', query);
            
            // 检查Chrome书签API是否可用
            if (typeof chrome === 'undefined' || !chrome.bookmarks) {
                log.error('❌ Chrome书签API不可用');
                log.debug('Chrome对象:', typeof chrome);
                log.debug('chrome.bookmarks:', chrome?.bookmarks);
                return [];
            }
            
            log.debug('✅ Chrome书签API可用');
            
            let bookmarks;
            if (!query || query.trim() === '') {
                // 空查询时获取所有书签
                log.debug('📚 获取所有书签...');
                bookmarks = await chrome.bookmarks.getTree();
                log.debug('原始书签树:', bookmarks);
                
                // 展平树形结构
                const flattenBookmarks = (nodes) => {
                    let result = [];
                    for (const node of nodes) {
                        if (node.url) {
                            result.push(node);
                        }
                        if (node.children) {
                            result = result.concat(flattenBookmarks(node.children));
                        }
                    }
                    return result;
                };
                bookmarks = flattenBookmarks(bookmarks);
                log.debug('✅ 展平后的书签数量:', bookmarks.length);
            } else {
                log.debug('🔎 使用查询词搜索书签...');
                bookmarks = await chrome.bookmarks.search(query);
                log.debug('✅ 搜索结果数量:', bookmarks.length);
            }
            
            log.debug('📋 搜索到的书签:', bookmarks);
            return bookmarks;
        } catch (error) {
            log.error('❌ 书签搜索失败:', error);
            log.error('错误堆栈:', error.stack);
            return [];
        }
    },
    
    /**
     * 获取书签路径
     * @param {string} parentId - 父书签ID
     * @returns {Promise<string>} 书签路径
     */
    getBookmarkPath: async (parentId) => {
        try {
            log.debug('获取书签路径，parentId:', parentId);
            
            // 检查是否有Chrome书签API
            if (typeof chrome === 'undefined' || !chrome.bookmarks) {
                log.debug('Chrome书签API不可用，使用默认路径');
                return '书签';
            }
            
            const pathParts = [];
            let currentId = parentId;
            
            while (currentId && currentId !== '0') {
                log.debug('获取父文件夹，ID:', currentId);
                const [parent] = await chrome.bookmarks.get(currentId);
                log.debug('父文件夹信息:', parent);
                
                if (parent) {
                    pathParts.unshift(parent.title);
                    currentId = parent.parentId;
                } else {
                    break;
                }
            }
            
            const result = pathParts.length > 0 ? pathParts.join(' / ') : '书签';
            log.debug('书签路径结果:', result);
            return result;
        } catch (error) {
            log.error('获取书签路径失败:', error);
            return '书签';
        }
    },

    /**
     * 获取书签显示信息
     * @param {Object} bookmark - 书签对象
     * @returns {Promise<Object>} 格式化的书签信息
     */
    getBookmarkDisplayInfo: async (bookmark) => {
        try {
            // 解析URL获取域名和路径
            let domain = '';
            let path = '';
            let favicon = '';
            
            if (bookmark.url) {
                try {
                    const url = new URL(bookmark.url);
                    domain = url.hostname;
                    path = url.pathname + url.search;
                    // 如果路径为空或只有根路径，显示域名
                    if (!path || path === '/' || path === '') {
                        path = domain;
                    }
                    // 生成favicon URL
                    favicon = `${url.protocol}//${url.hostname}/favicon.ico`;
                } catch (e) {
                    // 如果URL解析失败，使用默认值
                    domain = bookmark.url;
                    path = bookmark.url;
                    favicon = '';
                }
            }
            
            // 处理书签路径（文件夹结构）
            let bookmarkPath = '';
            if (bookmark.parentId && bookmark.parentId !== '0') {
                try {
                    // 获取书签的完整路径
                    bookmarkPath = await bookmarkSearch.getBookmarkPath(bookmark.parentId);
                } catch (error) {
                    log.warn('获取书签路径失败:', error);
                    bookmarkPath = '书签';
                }
            } else {
                bookmarkPath = '书签栏';
            }
            
            // 如果路径获取失败，使用默认值
            if (!bookmarkPath) {
                bookmarkPath = '书签';
            }
            
            const result = {
                title: bookmark.title || '未命名书签',
                url: bookmark.url || '',
                domain: domain,
                path: bookmarkPath, // 使用书签路径而不是URL路径
                bookmarkPath: bookmarkPath,
                favicon: favicon,
                id: bookmark.id
            };
            
            log.debug('书签显示信息:', result);
            return result;
        } catch (error) {
            log.error('获取书签显示信息失败:', error);
            return {
                title: bookmark.title || '未命名书签',
                url: bookmark.url || '',
                domain: '',
                path: '',
                bookmarkPath: '',
                favicon: '',
                id: bookmark.id
            };
        }
    },

    /**
     * 格式化书签搜索结果用于显示
     * @param {Array} bookmarks - 书签列表
     * @returns {Promise<Array>} 格式化的书签列表
     */
    formatBookmarkResults: async (bookmarks) => {
        try {
            const formattedResults = [];
            
            for (const bookmark of bookmarks) {
                // 只处理有URL的书签（排除文件夹）
                if (bookmark.url) {
                    const displayInfo = await bookmarkSearch.getBookmarkDisplayInfo(bookmark);
                    formattedResults.push({
                        ...displayInfo,
                        type: 'bookmark',
                        action: 'open-bookmark'
                    });
                }
            }
            
            return formattedResults;
        } catch (error) {
            log.error('格式化书签结果失败:', error);
            return [];
        }
    },

    /**
     * 搜索并格式化书签
     * @param {string} query - 搜索查询
     * @returns {Promise<Array>} 格式化的书签结果
     */
    searchAndFormatBookmarks: async (query) => {
        try {
            log.debug('🎯 searchAndFormatBookmarks 被调用，查询词:', query);
            
            let bookmarks;
            if (!query || query.trim() === '') {
                // 空查询时获取所有书签
                log.debug('获取所有书签...');
                bookmarks = await bookmarkSearch.searchBookmarks('');
            } else {
                log.debug('搜索书签，查询词:', query);
                bookmarks = await bookmarkSearch.searchBookmarks(query);
            }
            
            log.debug('📊 获取到的书签数量:', bookmarks.length);
            log.debug('原始书签数据示例:', bookmarks.slice(0, 2));
            
            const formattedResults = await bookmarkSearch.formatBookmarkResults(bookmarks);
            
            log.debug('✨ 格式化后的结果数量:', formattedResults.length);
            log.debug('格式化结果示例:', formattedResults.slice(0, 2));
            
            // 限制结果数量 - 增加到50条，支持滚动查看
            const finalResults = formattedResults.slice(0, 50);
            log.info('🎉 最终返回结果数量:', finalResults.length);
            
            return finalResults;
        } catch (error) {
            log.error('❌ 搜索和格式化书签失败:', error);
            log.error('错误详情:', error.stack);
            return [];
        }
    }
};
