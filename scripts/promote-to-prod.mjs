import { execSync } from 'child_process';

function run(cmd, desc) {
  console.log(`\n⏳ ${desc}... (${cmd})`);
  try {
    const out = execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' });
    if (out.trim()) console.log(out.trim());
  } catch (err) {
    console.error(`❌ Error during: ${desc}`);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(1);
  }
}

console.log('🚀 Starting Promotion: Staging ──▶ Production (master)');

// 1. Check working directory status
const status = execSync('git status --porcelain', { encoding: 'utf-8' });
if (status.trim()) {
  console.error('\n⚠️ You have uncommitted changes on staging. Please commit or stash them first before promoting to production.');
  process.exit(1);
}

// 2. Push staging to be 100% up to date on GitHub
run('git push origin staging', 'Pushing staging commits to GitHub');

// 3. Switch to master
run('git checkout master', 'Switching to production branch (master)');

// 4. Pull latest master
run('git pull origin master', 'Pulling latest production changes');

// 5. Merge staging into master
run('git merge staging --no-edit -m "chore(release): promote staging to production"', 'Merging staging into production');

// 6. Push to production remote
run('git push origin master', 'Pushing production release to GitHub');

// 7. Switch back to staging for further development
run('git checkout staging', 'Returning to staging branch for further development');

console.log('\n🎉 SUCCESS! Staging has been successfully merged & promoted to Production (master).');
console.log('🌐 Vercel is now building and deploying the live production release!');
