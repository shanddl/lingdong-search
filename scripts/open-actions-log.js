const { execSync } = require('child_process');
const { platform } = require('os');

/**
 * 打开 GitHub Actions 日志页面
 */

const REPO_OWNER = 'shanddl';
const REPO_NAME = 'lingdong-search';
const WORKFLOW_RUN_ID = 22; // 从图片中看到是 #22

const url = `https://github.com/${REPO_OWNER}/${REPO_NAME}/actions/runs/${WORKFLOW_RUN_ID}`;

console.log('📋 正在打开 GitHub Actions 运行日志...\n');
console.log(`URL: ${url}\n`);

try {
  if (platform() === 'win32') {
    execSync(`start "" "${url}"`, { stdio: 'ignore' });
  } else if (platform() === 'darwin') {
    execSync(`open "${url}"`, { stdio: 'ignore' });
  } else {
    execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
  }
  console.log('✅ 已在浏览器中打开工作流日志页面');
  console.log('\n请查找 "Setup private key from secrets" 步骤，查看是否显示：');
  console.log('✅ "🔑 从 GitHub Secrets 恢复私钥..."');
  console.log('✅ "✅ 私钥已恢复"');
} catch (error) {
  console.log('⚠️  无法自动打开浏览器，请手动访问：');
  console.log(url);
}























