// ==================
// 🖼️ 壁纸API处理器
// ==================

// 1. 必应历史壁纸（使用官方API）
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fetchBingHistory') {
    console.log('[Background-Wallpaper] 开始获取必应历史壁纸...');
    (async () => {
      try {
        const count = message.count || 24;
        const wallpapers = [];
        
        console.log(`[Background-Wallpaper] 需要获取 ${count} 张壁纸`);
        
        // 必应API每次返回8张，按需请求
        const requestCount = Math.ceil(count / 8);
        
        for (let i = 0; i < requestCount; i++) {
          const idx = i * 8;
          const url = `https://cn.bing.com/HPImageArchive.aspx?format=js&idx=${idx}&n=8`;
          
          console.log(`[Background-Wallpaper] 请求必应API: ${url}`);
          
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const data = await response.json();
          
          if (data.images && data.images.length > 0) {
            data.images.forEach(img => {
              if (wallpapers.length < count) {
                wallpapers.push({
                  thumbnail: `https://cn.bing.com${img.url}`,
                  url: `https://cn.bing.com${img.url}`,
                  title: img.copyright || '必应壁纸'
                });
              }
            });
          }
        }
        
        console.log(`[Background-Wallpaper] 必应历史壁纸获取成功: ${wallpapers.length} 张`);
        sendResponse({ success: true, data: wallpapers });
      } catch (error) {
        console.error('[Background-Wallpaper] 必应历史壁纸获取失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  // 2. 360壁纸API
  if (message.action === 'fetch360Wallpapers') {
    (async () => {
      try {
        const { categoryId = '10', page = 1, count = 24, keyword = '' } = message;
        const start = (page - 1) * count;
        
        let wallpapers = [];
        
        if (keyword && keyword.trim()) {
          // 搜索模式 - 使用智能分类匹配
          console.log('[Background] 智能搜索模式，关键词:', keyword);
          
          // 关键词到分类ID的映射
          const keywordToCategory = {
            '美女': '1', '模特': '1', '女孩': '1', '女性': '1',
            '风景': '2', '山水': '2', '自然': '2', '景色': '2',
            '动漫': '3', '卡通': '3', '二次元': '3', '动画': '3',
            '汽车': '4', '跑车': '4', '豪车': '4', '车辆': '4',
            '游戏': '5', '电竞': '5', '游戏角色': '5',
            '明星': '6', '演员': '6', '歌手': '6',
            '动物': '7', '宠物': '7', '萌宠': '7', '猫': '7', '狗': '7',
            '军事': '8', '武器': '8', '坦克': '8', '飞机': '8',
            '体育': '9', '运动': '9', '足球': '9', '篮球': '9',
            '4K': '10', '高清': '10', '超清': '10'
          };
          
          // 查找匹配的分类
          let matchedCategoryId = '10'; // 默认分类
          for (const [key, catId] of Object.entries(keywordToCategory)) {
            if (keyword.includes(key)) {
              matchedCategoryId = catId;
              console.log('[Background] 匹配到分类:', key, '->', catId);
              break;
            }
          }
          
          // 使用匹配的分类获取壁纸
          const url = `http://wallpaper.apc.360.cn/index.php?c=WallPaperAndroid&a=getAppsByCategory&cid=${matchedCategoryId}&start=${start}&count=${count}`;
          const response = await fetch(url);
          const data = await response.json();
          
          wallpapers = (data.data || []).map(img => ({
            thumbnail: img.url.replace('http://', 'https://'),
            url: img.url.replace('http://', 'https://'),
            title: img.utag || '360壁纸'
          }));
          
          console.log(`[Background] 智能搜索成功: ${wallpapers.length} 张`);
        } else {
          // 分类模式
          const url = `http://wallpaper.apc.360.cn/index.php?c=WallPaperAndroid&a=getAppsByCategory&cid=${categoryId}&start=${start}&count=${count}`;
          
          const response = await fetch(url);
          const data = await response.json();
          
          wallpapers = (data.data || []).map(img => ({
            thumbnail: img.url.replace('http://', 'https://'),
            url: img.url.replace('http://', 'https://'),
            title: img.utag || '360壁纸'
          }));
        }
        
        console.log(`[Background] 360壁纸获取成功: ${wallpapers.length} 张`);
        sendResponse({ success: true, data: wallpapers });
      } catch (error) {
        console.error('[Background] 360壁纸获取失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  // 3. 360壁纸分类
  if (message.action === 'fetch360Categories') {
    (async () => {
      try {
        const url = 'http://wallpaper.apc.360.cn/index.php?c=WallPaperAndroid&a=getAllCategories';
        const response = await fetch(url);
        const data = await response.json();
        
        const categories = (data.data || []).map(cat => ({
          id: cat.id,
          name: cat.name
        }));
        
        sendResponse({ success: true, data: categories });
      } catch (error) {
        console.error('[Background] 360分类获取失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  // 4. 极简壁纸API
  if (message.action === 'fetchJijianWallpapers') {
    (async () => {
      try {
        const { page = 1, size = 24, order = 'new' } = message;
        const url = `https://api.zzzmh.cn/bz/v3/getWall?current=${page}&size=${size}&order=${order}`;
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.code === 200 && result.result) {
          const wallpapers = result.result.list.map(item => ({
            thumbnail: item.thumb || item.url,
            url: item.url,
            title: item.desc || '极简壁纸'
          }));
          
          sendResponse({ success: true, data: wallpapers });
        } else {
          throw new Error('API返回错误');
        }
      } catch (error) {
        console.error('[Background] 极简壁纸获取失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});
