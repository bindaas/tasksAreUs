const { execSync } = require('child_process');

let gitHash = 'unknown';
try {
  gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {}

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    gitHash,
  },
});
