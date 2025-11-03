const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * 使用浏览器自动化添加 GitHub Secret
 */

const REPO_OWNER = 'shanddl';
const REPO_NAME = 'lingdong-search';
const SECRET_NAME = 'CRX_PRIVATE_KEY';
const privateKeyPath = path.join(__dirname, '..', 'private-key.pem');

async function addSecret() {
  console.log('🔑 启动浏览器自动化...\n');

  if (!fs.existsSync(privateKeyPath)) {
    console.error('❌ 私钥文件不存在');
    process.exit(1);
  }

  const privateKey = fs.readFileSync(privateKeyPath, 'utf8').trim();

  const browser = await chromium.launch({ 
    headless: false, // 显示浏览器以便用户登录
    slowMo: 1000 // 减慢操作速度，方便观察
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('📡 打开 GitHub Secrets 页面...');
    await page.goto(`https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/secrets/actions`);
    
    // 等待页面加载
    await page.waitForTimeout(2000);

    // 检查是否需要登录
    const currentUrl = page.url();
    if (currentUrl.includes('login')) {
      console.log('⚠️  需要登录 GitHub');
      console.log('请在浏览器中完成登录，然后按回车继续...');
      console.log('（脚本将在 60 秒后继续）\n');
      
      // 等待用户登录（最多60秒）
      for (let i = 0; i < 60; i++) {
        await page.waitForTimeout(1000);
        const url = page.url();
        if (!url.includes('login')) {
          break;
        }
      }
      
      // 重新导航到 Secrets 页面
      await page.goto(`https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/secrets/actions`);
      await page.waitForTimeout(2000);
    }

    // 检查是否已存在该 Secret
    console.log('🔍 检查是否已存在 Secret...');
    await page.waitForTimeout(2000);
    
    const existingSecret = await page.locator(`text=${SECRET_NAME}`).first();
    if (await existingSecret.count() > 0) {
      console.log(`✅ Secret ${SECRET_NAME} 已存在！`);
      console.log('\n如果这是第一次添加，Secret 已成功添加');
      console.log('如果需要更新，请手动操作');
      await browser.close();
      return;
    }

    // 查找 "New repository secret" 按钮 - 尝试多种选择器
    console.log('🔍 查找 "New repository secret" 按钮...');
    let newSecretButton = null;
    
    const buttonSelectors = [
      'a:has-text("New repository secret")',
      'button:has-text("New repository secret")',
      'a[href*="secrets/new"]',
      '[data-testid="new-secret-button"]',
      '.btn-primary:has-text("New")',
      '//a[contains(text(), "New repository secret")]',
      '//button[contains(text(), "New repository secret")]'
    ];
    
    for (const selector of buttonSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.count() > 0) {
          newSecretButton = button;
          console.log(`✅ 找到按钮（使用选择器：${selector}）`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!newSecretButton || await newSecretButton.count() === 0) {
      console.log('⚠️  未找到按钮');
      console.log('可能的原因：');
      console.log('1. 需要登录（请在打开的浏览器中登录）');
      console.log('2. 没有仓库管理员权限');
      console.log('3. Secret 已存在');
      console.log('\n当前页面 URL:', page.url());
      console.log('\n请手动检查：https://github.com/shanddl/lingdong-search/settings/secrets/actions');
      console.log('\n等待 10 秒以便手动操作...');
      await page.waitForTimeout(10000);
      await browser.close();
      return;
    }

    console.log('✅ 找到按钮，点击...');
    await newSecretButton.click();
    await page.waitForTimeout(1000);

    // 填写 Secret 名称
    console.log(`📝 填写 Secret 名称: ${SECRET_NAME}...`);
    const nameInput = page.locator('input[name="Name"]').first();
    await nameInput.fill(SECRET_NAME);
    await page.waitForTimeout(500);

    // 填写 Secret 值
    console.log('📝 填写 Secret 值...');
    const valueInput = page.locator('textarea[name="Value"]').first();
    await valueInput.fill(privateKey);
    await page.waitForTimeout(500);

    // 点击 Add secret 按钮
    console.log('💾 提交 Secret...');
    const addButton = page.locator('button:has-text("Add secret"), button:has-text("Update secret")').first();
    await addButton.click();
    await page.waitForTimeout(2000);

    // 检查是否成功
    const successIndicator = page.locator('text=Secret added, text=Secret updated, text=Success');
    if (await successIndicator.count() > 0) {
      console.log('\n✅ Secret 添加成功！');
      console.log(`验证：https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/secrets/actions`);
    } else {
      console.log('\n⚠️  无法确认是否成功，请手动检查');
      console.log('等待 5 秒后关闭浏览器...');
      await page.waitForTimeout(5000);
    }

    await browser.close();
    console.log('\n✅ 完成！');

  } catch (error) {
    console.error('\n❌ 操作失败：', error.message);
    console.error('\n这可能是因为：');
    console.error('1. 需要登录 GitHub（请先在浏览器中登录）');
    console.error('2. 没有仓库权限');
    console.error('3. 页面结构发生变化');
    console.error('\n建议使用手动方法：');
    console.error('访问：https://github.com/shanddl/lingdong-search/settings/secrets/actions');
    await browser.close();
    process.exit(1);
  }
}

addSecret();

