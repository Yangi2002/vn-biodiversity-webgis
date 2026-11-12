const path = require('node:path');
const { loadEnvFile } = require('node:process');

loadEnvFile(path.join(__dirname, '.env'));
const target = process.env.API_PROXY_TARGET;
if (!target) throw new Error('API_PROXY_TARGET must be configured in .env');

module.exports = {
  '/api/**': {
    target,
    changeOrigin: true,
    timeout: 660000,
    proxyTimeout: 660000,
    timeout: 660000,
    proxyTimeout: 660000,
    pathRewrite: { '^/api': '' },
  },
};
