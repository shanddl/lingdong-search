// 外观设置 Web Component
class AppearanceSettings extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          background-color: #202124;
          color: #e8eaed;
          border-radius: 8px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .settings-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          max-height: 80vh; /* 限制最大高度 */
        }

        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #5F6368;
          flex-shrink: 0; /* 防止头部被压缩 */
        }

        .settings-title {
          font-size: 16px;
          font-weight: 500;
          margin: 0;
        }

        .close-button {
          background: none;
          border: none;
          color: #9aa0a6;
          font-size: 20px;
          cursor: pointer;
          width: 32px;
          height: 32px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-button:hover {
          background-color: #3c4043;
        }

        .settings-content {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
          /* 添加自定义滚动条样式 */
          scrollbar-width: thin;
          scrollbar-color: #5F6368 #202124;
        }

        /* Webkit浏览器的滚动条样式 */
        .settings-content::-webkit-scrollbar {
          width: 8px;
        }

        .settings-content::-webkit-scrollbar-track {
          background: #202124;
        }

        .settings-content::-webkit-scrollbar-thumb {
          background-color: #5F6368;
          border-radius: 4px;
        }

        .settings-content::-webkit-scrollbar-thumb:hover {
          background-color: #9aa0a6;
        }

        .settings-section {
          margin-bottom: 24px;
          border: 2px solid #5F6368;
          border-radius: 8px;
          padding: 20px;
          background-color: rgba(60, 64, 67, 0.3);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .section-title {
          font-size: 14px;
          font-weight: 500;
          margin: 0 0 16px 0;
          color: #9aa0a6;
        }

        .setting-item {
          margin-bottom: 20px;
        }

        .setting-label {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .slider-container {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .slider {
          flex: 1;
          height: 4px;
          background: #5F6368;
          border-radius: 2px;
          outline: none;
          -webkit-appearance: none;
        }

        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #4285F4;
          cursor: pointer;
        }

        .slider-value {
          min-width: 50px;
          text-align: right;
          font-size: 13px;
          color: #9aa0a6;
        }

        .button-group {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .button-option {
          flex: 1;
          min-width: 80px;
          padding: 8px 12px;
          background: #3c4043;
          border: 1px solid #5F6368;
          border-radius: 4px;
          color: #e8eaed;
          font-size: 13px;
          cursor: pointer;
          text-align: center;
        }

        .button-option.selected {
          background: #4285F4;
          border-color: #4285F4;
        }

        .divider {
          height: 1px;
          background: #5F6368;
          margin: 24px 0;
        }


        /* 弹出按钮样式 */
        .popout-btn {
          background: #3c4043;
          border: 1px solid #5F6368;
          border-radius: 4px;
          color: #e8eaed;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 12px;
        }

        .popout-btn:hover {
          background: #4a4d51;
        }
      </style>

      <div class="settings-panel">
        <div class="settings-header">
          <h2 class="settings-title">外观设置</h2>
          <button class="close-button" id="closeButton">×</button>
        </div>
        
        <div class="settings-content">
          <div class="settings-section">
            <h3 class="section-title">搜索框</h3>
            
            <div class="setting-item">
              <div class="setting-label">
                <span>垂直位置</span>
                <span id="positionValue" class="slider-value">1%</span>
              </div>
              <div class="slider-container">
                <input type="range" class="slider" id="positionSlider" min="0" max="100" value="1">
                <button class="popout-btn" data-slider="positionSlider">↗</button>
              </div>
            </div>
            
            <div class="setting-item">
              <div class="setting-label">
                <span>搜索框宽度</span>
                <span id="widthValue" class="slider-value">1715px</span>
              </div>
              <div class="slider-container">
                <input type="range" class="slider" id="widthSlider" min="300" max="2000" value="1715">
                <button class="popout-btn" data-slider="widthSlider">↗</button>
              </div>
            </div>
            
            <div class="setting-item">
              <div class="setting-label">
                <span>范围菜单宽度</span>
                <span id="menuWidthValue" class="slider-value">638px</span>
              </div>
              <div class="slider-container">
                <input type="range" class="slider" id="menuWidthSlider" min="200" max="1000" value="638">
                <button class="popout-btn" data-slider="menuWidthSlider">↗</button>
              </div>
            </div>
            
            <div class="setting-item">
              <label>
                <input type="checkbox" id="search-box-rounded">
                圆角搜索框
              </label>
            </div>
            <div class="setting-item">
              <label>
                <input type="checkbox" id="search-box-shadow">
                搜索框阴影
              </label>
            </div>
            <div class="setting-item">
              <label>
                <input type="checkbox" id="search-box-glow">
                搜索框发光效果
              </label>
            </div>
          </div>
          
          <div class="divider"></div>
          
          <div class="settings-section">
            <h3 class="section-title">图标</h3>
            
            <div class="setting-item">
              <div class="setting-label">
                <span>图标大小</span>
                <span id="navSizeValue" class="slider-value">62px</span>
              </div>
              <div class="slider-container">
                <input type="range" class="slider" id="navSizeSlider" min="30" max="100" value="62">
                <button class="popout-btn" data-slider="navSizeSlider">↗</button>
              </div>
            </div>
            
            <div class="setting-item">
              <div class="setting-label">
                <span>图标间距</span>
                <span id="spacingValue" class="slider-value">19px</span>
              </div>
              <div class="slider-container">
                <input type="range" class="slider" id="spacingSlider" min="5" max="50" value="19">
                <button class="popout-btn" data-slider="spacingSlider">↗</button>
              </div>
            </div>
            
            <div class="setting-item">
              <div class="setting-label">
                <span>图标对齐方式</span>
              </div>
              <div class="button-group" id="alignmentGroup">
                <div class="button-option selected" data-value="left">左对齐</div>
                <div class="button-option" data-value="center">居中</div>
                <div class="button-option" data-value="right">右对齐</div>
              </div>
            </div>
            
            <div class="setting-item">
              <div class="setting-label">
                <span>图标密度</span>
                <span id="densityValue" class="slider-value">每项最小宽度 120px</span>
              </div>
              <div class="slider-container">
                <input type="range" class="slider" id="densitySlider" min="80" max="200" value="120">
                <button class="popout-btn" data-slider="densitySlider">↗</button>
              </div>
            </div>
            
            <div class="setting-item">
              <div class="setting-label">
                <span>图标形状</span>
              </div>
              <div class="button-group" id="shapeGroup">
                <div class="button-option selected" data-value="square">方形</div>
                <div class="button-option" data-value="capsule">横向胶囊</div>
              </div>
            </div>
            
            <div class="setting-item">
              <label>
                图标形状
                <select id="icon-shape">
                  <option value="square">方形</option>
                  <option value="capsule">横向胶囊</option>
                </select>
              </label>
            </div>
            <div class="setting-item">
              <label>
                图标圆角
                <input type="range" id="icon-radius" min="0" max="24" value="0" class="slider">
                <span id="icon-radius-value">0px</span>
              </label>
            </div>
            <div class="setting-item">
              <label>
                <input type="checkbox" id="show-icon-text">
                显示图标文字
              </label>
            </div>
            <div class="setting-item">
              <label>
                <input type="checkbox" id="icon-text-bold">
                图标文字加粗
              </label>
            </div>
            <div class="setting-item">
              <label>
                图标文字大小
                <input type="range" id="icon-text-size" min="10" max="18" value="14" class="slider">
                <span id="icon-text-size-value">14px</span>
              </label>
            </div>
            <div class="setting-item">
              <label>
                <input type="checkbox" id="icon-shadow">
                图标阴影
              </label>
            </div>
            <div class="setting-item">
              <label>
                <input type="checkbox" id="icon-glow">
                图标发光效果
              </label>
            </div>
            <div class="setting-item">
              <label>
                图标密度（最小宽度）
                <input type="range" id="icon-min-width" min="80" max="200" value="120" class="slider">
                <span id="icon-min-width-value">120px</span>
              </label>
            </div>
          </div>
          
          <div class="divider"></div>
          
          <div class="settings-section">
            <h3 class="section-title">Dock 栏</h3>
            <div class="setting-item">
              <div class="setting-label">
                <span>底部dock栏缩放</span>
                <span id="dockScaleValue" class="slider-value">1.31x</span>
              </div>
              <div class="slider-container">
                <input type="range" class="slider" id="dockScaleSlider" min="0.5" max="2" step="0.01" value="1.31">
                <button class="popout-btn" data-slider="dockScaleSlider">↗</button>
              </div>
            </div>
            <div class="setting-item">
              <label>
                <input type="checkbox" id="dock-enabled">
                启用 Dock 栏
              </label>
            </div>
            <div class="setting-item">
              <label>
                <input type="checkbox" id="dock-auto-hide">
                Dock 栏自动隐藏
              </label>
            </div>
            <div class="setting-item">
              <label>
                <input type="checkbox" id="dock-show-on-hover">
                鼠标悬停显示 Dock 栏
              </label>
            </div>
            <div class="setting-item">
              <label>
                <input type="checkbox" id="dock-show-on-scroll">
                滚动时显示 Dock 栏
              </label>
            </div>
            <div class="setting-item">
              <label>
                Dock 栏位置
                <select id="dock-position">
                  <option value="bottom">底部</option>
                  <option value="top">顶部</option>
                  <option value="left">左侧</option>
                  <option value="right">右侧</option>
                </select>
              </label>
            </div>
            <div class="setting-item">
              <label>
                Dock 栏透明度
                <input type="range" id="dock-opacity" min="0" max="100" value="100" class="slider">
                <span id="dock-opacity-value">100%</span>
              </label>
            </div>
            <div class="setting-item">
              <label>
                Dock 栏模糊
                <input type="range" id="dock-blur" min="0" max="20" value="0" class="slider">
                <span id="dock-blur-value">0px</span>
              </label>
            </div>
          </div>
        </div>
        
      </div>
    `;
  }

  attachEventListeners() {
    // 关闭按钮事件
    const closeButton = this.shadowRoot.getElementById('closeButton');
    closeButton.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    });


    // 滑块弹出按钮事件
    const popoutButtons = this.shadowRoot.querySelectorAll('.popout-btn');
    popoutButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const sliderId = e.target.dataset.slider;
        this.dispatchEvent(new CustomEvent('popout-slider', {
          bubbles: true,
          composed: true,
          detail: { sliderId }
        }));
      });
    });

    // 滑块事件监听器
    this.attachSliderListener('positionSlider', 'positionValue', '%');
    this.attachSliderListener('widthSlider', 'widthValue', 'px');
    this.attachSliderListener('menuWidthSlider', 'menuWidthValue', 'px');
    this.attachSliderListener('navSizeSlider', 'navSizeValue', 'px');
    this.attachSliderListener('spacingSlider', 'spacingValue', 'px');
    this.attachSliderListener('densitySlider', 'densityValue', 'px', '每项最小宽度 ');
    this.attachSliderListener('dockScaleSlider', 'dockScaleValue', 'x');

    // 按钮组事件监听器
    this.attachButtonGroupListener('alignmentGroup');
    this.attachButtonGroupListener('shapeGroup');
  }

  attachSliderListener(sliderId, valueId, unit, prefix = '') {
    const slider = this.shadowRoot.getElementById(sliderId);
    const valueDisplay = this.shadowRoot.getElementById(valueId);
    
    // 初始化显示
    valueDisplay.textContent = prefix + slider.value + unit;
    
    slider.addEventListener('input', () => {
      valueDisplay.textContent = prefix + slider.value + unit;
      this.dispatchEvent(new CustomEvent('setting-change', {
        bubbles: true,
        composed: true,
        detail: { setting: sliderId, value: slider.value }
      }));
    });
  }

  attachButtonGroupListener(groupId) {
    const group = this.shadowRoot.getElementById(groupId);
    group.addEventListener('click', (e) => {
      if (e.target.classList.contains('button-option')) {
        // 移除同组其他按钮的选中状态
        const buttons = group.querySelectorAll('.button-option');
        buttons.forEach(button => button.classList.remove('selected'));
        
        // 添加当前按钮的选中状态
        e.target.classList.add('selected');
        
        this.dispatchEvent(new CustomEvent('setting-change', {
          bubbles: true,
          composed: true,
          detail: { 
            setting: groupId, 
            value: e.target.dataset.value 
          }
        }));
      }
    });
  }
}

// 定义自定义元素
customElements.define('appearance-settings', AppearanceSettings);

export default AppearanceSettings;