const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // Prefer CI-provided commit SHAs, then fall back to git when available.
  const gitSha =
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    execSync('git rev-parse --short HEAD').toString().trim();

  // Path to .env.production file
  const envPath = path.join(__dirname, '..', '.env.production');

  // Write the SHA to .env.production
  const envContent = `NEXT_PUBLIC_GIT_SHA=${gitSha}\n`;
  fs.writeFileSync(envPath, envContent);

  console.log(`✓ Injected git SHA: ${gitSha}`);
} catch (error) {
  console.warn('Warning: Could not inject git SHA:', error.message);
  // Don't fail the build if git is not available
}
