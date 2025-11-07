const fs = require('fs');
const path = require('path');
const https = require('https');
const sodium = require('sodium-native');

/**
 * 使用 Node.js 和 libsodium 将私钥添加到 GitHub Secrets
 * 需要安装：npm install sodium-native
 */

const REPO_OWNER = 'shanddl';
const REPO_NAME = 'lingdong-search';
const SECRET_NAME = 'CRX_PRIVATE_KEY';
const privateKeyPath = path.join(__dirname, '..', 'private-key.pem');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.argv[2];

if (!GITHUB_TOKEN) {
  console.error('❌ 错误：需要提供 GitHub Personal Access Token');
  console.error('\n使用方法：');
  console.error('  方法1：设置环境变量');
  console.error('    set GITHUB_TOKEN=your_token (Windows)');
  console.error('    export GITHUB_TOKEN=your_token (Linux/macOS)');
  console.error('    node scripts/add-secret-node.js');
  console.error('\n  方法2：直接传递参数');
  console.error('    node scripts/add-secret-node.js your_token');
  console.error('\n如何获取 Token：');
  console.error('1. 访问 https://github.com/settings/tokens');
  console.error('2. 点击 "Generate new token" → "Generate new token (classic)"');
  console.error('3. 勾选权限：repo (所有仓库权限)');
  console.error('4. 生成并复制 Token');
  process.exit(1);
}

// 检查是否安装了 sodium-native
try {
  require.resolve('sodium-native');
} catch (e) {
  console.error('❌ 错误：需要安装 sodium-native');
  console.error('\n请运行：npm install sodium-native');
  console.error('如果安装失败，可以使用其他方法：');
  console.error('1. 使用 GitHub CLI: gh secret set CRX_PRIVATE_KEY --repo shanddl/lingdong-search < private-key.pem');
  console.error('2. 通过网页手动添加');
  process.exit(1);
}

if (!fs.existsSync(privateKeyPath)) {
  console.error('❌ 错误：私钥文件不存在');
  console.error(`文件路径：${privateKeyPath}`);
  console.error('\n请先运行：npm run generate-key');
  process.exit(1);
}

const privateKey = fs.readFileSync(privateKeyPath, 'utf8').trim();

console.log('🔑 准备添加 GitHub Secret...');
console.log(`仓库：${REPO_OWNER}/${REPO_NAME}`);
console.log(`Secret 名称：${SECRET_NAME}`);
console.log(`私钥文件：${privateKeyPath}\n`);

// 1. 获取 repository public key
function getPublicKey() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/actions/secrets/public-key`,
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'Node.js-Script'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (e) {
            reject(new Error('解析响应失败'));
          }
        } else {
          reject(new Error(`API 请求失败: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// 2. 使用 libsodium 加密 secret
function encryptSecret(secret, publicKeyBase64) {
  const publicKey = Buffer.from(publicKeyBase64, 'base64');
  const message = Buffer.from(secret, 'utf8');
  
  // libsodium sealed box: message + ciphertext
  const ciphertext = Buffer.alloc(message.length + sodium.crypto_box_SEALBYTES);
  sodium.crypto_box_seal(ciphertext, message, publicKey);
  
  return ciphertext.toString('base64');
}

// 3. 创建或更新 secret
function createOrUpdateSecret(keyId, encryptedValue) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      encrypted_value: encryptedValue,
      key_id: keyId
    });

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/actions/secrets/${SECRET_NAME}`,
      method: 'PUT',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'Node.js-Script',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 204) {
          resolve();
        } else {
          reject(new Error(`API 请求失败: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// 执行操作
(async () => {
  try {
    console.log('📡 步骤1：获取仓库 Public Key...');
    const publicKeyData = await getPublicKey();
    console.log('✅ 成功获取 Public Key');
    console.log(`Key ID: ${publicKeyData.key_id}\n`);

    console.log('🔐 步骤2：加密私钥...');
    const encryptedValue = encryptSecret(privateKey, publicKeyData.key);
    console.log('✅ 加密完成\n');

    console.log('📤 步骤3：上传 Secret 到 GitHub...');
    await createOrUpdateSecret(publicKeyData.key_id, encryptedValue);
    console.log('✅ Secret 添加成功！\n');

    console.log('🎉 完成！GitHub Actions 现在将使用此私钥进行签名');
    console.log(`验证：https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/secrets/actions`);
  } catch (error) {
    console.error('\n❌ 操作失败：', error.message);
    console.error('\n请检查：');
    console.error('1. Token 是否有正确的权限（需要 repo 和 secrets 权限）');
    console.error('2. 仓库名称是否正确');
    console.error('3. 网络连接是否正常');
    console.error('\n如果继续失败，建议使用以下方法手动添加：');
    console.error('1. 访问：https://github.com/shanddl/lingdong-search/settings/secrets/actions');
    console.error('2. 点击 "New repository secret"');
    console.error('3. Name: CRX_PRIVATE_KEY');
    console.error('4. Secret: 粘贴私钥内容');
    process.exit(1);
  }
})();
























