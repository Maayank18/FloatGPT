import assert from 'node:assert';
import { parseGitPorcelain } from '../gitService';
import { parseGitHubPRUrl } from '../githubService';
import {
  synthesizeBugHealer,
  synthesizeGitDiagnosis,
  synthesizePRReview,
} from '../devDeskSynthesizer';

console.log('--- Testing DevDesk Git, PR & Bug Healer ---');

// 0. GitHub PR URL and Slug Parsing
function testGitHubPRUrlParsing() {
  const url1 = parseGitHubPRUrl('https://github.com/facebook/react/pull/28000');
  assert.deepStrictEqual(url1, { owner: 'facebook', repo: 'react', pullNumber: 28000 });

  const url2 = parseGitHubPRUrl('github.com/tailwindlabs/tailwindcss/pull/1234');
  assert.deepStrictEqual(url2, { owner: 'tailwindlabs', repo: 'tailwindcss', pullNumber: 1234 });

  const slug = parseGitHubPRUrl('myorg/myrepo#42');
  assert.deepStrictEqual(slug, { owner: 'myorg', repo: 'myrepo', pullNumber: 42 });

  const apiPath = parseGitHubPRUrl('org/repo/pulls/88');
  assert.deepStrictEqual(apiPath, { owner: 'org', repo: 'repo', pullNumber: 88 });

  const invalid = parseGitHubPRUrl('just a random diff text');
  assert.strictEqual(invalid, null);

  console.log('✅ PASS: GitHub PR URL and slug parsing passed');
}

// 1. Git Porcelain Parsing
function testGitPorcelain() {
  const porcelain = [
    '## feature/auth...origin/feature/auth [ahead 2, behind 1]',
    'UU src/App.tsx',
    'M  src/index.ts',
    ' M package.json',
    '?? temp.log',
  ].join('\n');

  const status = parseGitPorcelain(porcelain);
  assert.strictEqual(status.branch, 'feature/auth', 'Branch should match');
  assert.strictEqual(status.ahead, 2, 'Ahead count should be 2');
  assert.strictEqual(status.behind, 1, 'Behind count should be 1');
  assert.strictEqual(status.hasConflicts, true, 'Should detect merge conflict');
  assert.strictEqual(status.conflictedFiles.length, 1, 'One conflicted file');
  assert.strictEqual(status.conflictedFiles[0].path, 'src/App.tsx', 'Conflicted path match');
  assert.strictEqual(status.stagedCount, 1, 'Staged count match');
  assert.strictEqual(status.modifiedCount, 1, 'Modified count match');
  assert.strictEqual(status.untrackedCount, 1, 'Untracked count match');
  console.log('✅ PASS: Git porcelain parser passed');
}

// 2. Git Conflict Recipe Synthesis
function testGitConflictRecipe() {
  const porcelain = [
    '## feature/checkout',
    'UU src/checkout/Cart.tsx',
    'UU src/checkout/Payment.tsx',
  ].join('\n');

  const status = parseGitPorcelain(porcelain);
  const diag = synthesizeGitDiagnosis(status);
  assert(diag.includes('Merge Conflict Detected'), 'Diagnosis should flag merge conflicts');
  assert(diag.includes('src/checkout/Cart.tsx'), 'Should list Cart.tsx');
  assert(diag.includes('git add'), 'Must include git add recommendation');
  assert(diag.includes('git rebase --continue'), 'Must include rebase continuation');
  console.log('✅ PASS: Git conflict diagnosis synthesis passed');
}

// 3. PR Review Synthesis
async function testPRReview() {
  const diff = `diff --git a/src/auth.ts b/src/auth.ts
index 123..456 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,3 +10,6 @@
+export function validateToken(token: string): boolean {
+  return Boolean(token && token.length > 10);
+}`;

  const review = await synthesizePRReview(diff);
  assert(review.title.includes('feat'), 'Title should follow conventional commits');
  assert(review.whatChanged.length > 0, 'What changed should have items');
  assert(review.verificationChecklist.length > 0, 'Must include verification checklist');
  console.log('✅ PASS: PR review synthesis passed');
}

// 4. Bug Healer & Stack Trace Parsing
async function testBugHealer() {
  const trace = `TypeError: Cannot read properties of undefined (reading 'map')
    at renderItems (C:\\Users\\Mayank\\Projects\\FloatGPT\\src\\components\\List.tsx:42:18)
    at App (C:\\Users\\Mayank\\Projects\\FloatGPT\\src\\App.tsx:15:5)`;

  const bug = await synthesizeBugHealer(trace);
  assert.strictEqual(bug.errorType, 'TypeError', 'Should detect TypeError');
  assert(bug.rootCause.includes('undefined') || bug.rootCause.includes('null'), 'Root cause must identify undefined access');
  assert(bug.suggestedPatch.includes('?.') || bug.suggestedPatch.includes('if ('), 'Suggested patch must include defensive guard');
  assert(bug.defensiveRecommendations.length > 0, 'Must include defensive best practices');
  console.log('✅ PASS: Bug healer and patch synthesis passed');
}

async function runAll() {
  testGitHubPRUrlParsing();
  testGitPorcelain();
  testGitConflictRecipe();
  await testPRReview();
  await testBugHealer();
  console.log('All DevDesk tests completed successfully.');
}

runAll();

