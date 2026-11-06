/**
 * DevDesk Synthesizer
 * Deterministic and AI-assisted synthesis for Git conflict recovery,
 * PR review generation, and stack trace bug resolution.
 */

import { BugDiagnosisResult, GitRepoStatus, PRReviewResult } from './types';
import { AppState } from '../types';

export function synthesizeGitDiagnosis(status: GitRepoStatus, customInput?: string): string {
  const lines: string[] = [];

  if (status.hasConflicts) {
    lines.push(`### ⚠️ Merge Conflict Detected (${status.conflictedFiles.length} file${status.conflictedFiles.length > 1 ? 's' : ''})`);
    lines.push('');
    lines.push('Conflicted files requiring resolution:');
    for (const f of status.conflictedFiles) {
      lines.push(`• \`${f.path}\` (${f.conflictType.replace('_', ' ')})`);
    }
    lines.push('');
    lines.push('#### 🛠️ Recommended Safe Resolution Steps:');
    lines.push('1. Open each conflicted file in VS Code or your editor and search for `<<<<<<< HEAD`.');
    lines.push('2. Select whether to accept Current Change, Incoming Change, or Both.');
    lines.push('3. Stage the resolved files:');
    lines.push('   ```bash\n   git add ' + status.conflictedFiles.map((c) => c.path).join(' ') + '\n   ```');
    lines.push('4. Complete the merge or rebase:');
    lines.push('   ```bash\n   git commit -m "chore: resolve merge conflicts"\n   # Or if in a rebase:\n   git rebase --continue\n   ```');
    lines.push('5. *(Emergency abort if needed)*: `git merge --abort` or `git rebase --abort`');
    return lines.join('\n');
  }

  if (status.behind > 0 && status.ahead > 0) {
    lines.push(`### 🔀 Branch Diverged: ${status.branch}`);
    lines.push(`• **${status.ahead} commit(s) ahead** of ${status.tracking || 'origin'}`);
    lines.push(`• **${status.behind} commit(s) behind** ${status.tracking || 'origin'}`);
    lines.push('');
    lines.push('#### 🛠️ Recommended Reconciliation:');
    lines.push('To safely incorporate remote updates without creating messy merge bubbles:');
    lines.push('```bash\ngit pull --rebase origin ' + status.branch + '\n```');
    lines.push('If conflicts arise during the rebase, resolve them and run `git rebase --continue`.');
    return lines.join('\n');
  }

  if (status.behind > 0) {
    lines.push(`### ⬇️ Local Branch is Behind: ${status.branch}`);
    lines.push(`Your local branch is **${status.behind} commit(s) behind** ${status.tracking || 'origin'}.`);
    lines.push('');
    lines.push('#### 🛠️ Fast-Forward:');
    lines.push('```bash\ngit pull origin ' + status.branch + '\n```');
    return lines.join('\n');
  }

  if (status.ahead > 0) {
    lines.push(`### ⬆️ Unpushed Commits: ${status.branch}`);
    lines.push(`You have **${status.ahead} unpushed commit(s)** ready to push to ${status.tracking || 'remote'}.`);
    lines.push('');
    lines.push('#### 🛠️ Push to Remote:');
    lines.push('```bash\ngit push origin ' + status.branch + '\n```');
    return lines.join('\n');
  }

  if (!status.clean) {
    lines.push(`### 📝 Uncommitted Working Tree Changes: ${status.branch}`);
    lines.push(`• Staged files ready for commit: **${status.stagedCount}**`);
    lines.push(`• Modified unstaged files: **${status.modifiedCount}**`);
    lines.push(`• Untracked files: **${status.untrackedCount}**`);
    lines.push('');
    lines.push('#### 🛠️ Common Workflows:');
    lines.push('• **Stage & commit all**: `git add . && git commit -m "feat: your message"`');
    lines.push('• **Stash for later**: `git stash -u`');
    lines.push('• **Discard unstaged modifications**: `git restore .` *(Warning: uncommitted edits will be lost)*');
    return lines.join('\n');
  }

  if (status.isRepo) {
    lines.push(`### ✅ Clean Working Tree: ${status.branch}`);
    lines.push('No uncommitted modifications, no merge conflicts, and your branch is in sync with remote.');
    if (customInput) {
      lines.push('');
      lines.push(`**Query Note**: "${customInput}"`);
    }
    return lines.join('\n');
  }

  return `### ℹ️ DevDesk Git Diagnostics\n${status.rawOutput || 'Paste your git status or diff to analyze.'}`;
}

export async function synthesizePRReview(
  diffText: string,
  state?: AppState
): Promise<PRReviewResult> {
  const cleanDiff = (diffText || '').trim();

  // Deterministic summary extraction
  const modifiedFiles = Array.from(
    new Set(
      Array.from(cleanDiff.matchAll(/(?:diff --git a\/|--- a\/|rename to |copy to )([^\s\n]+)/g)).map((m) => m[1])
    )
  );

  const fileCount = modifiedFiles.length || 1;
  const addedLines = (cleanDiff.match(/^\+[^+]/gm) || []).length;
  const removedLines = (cleanDiff.match(/^-[^-]/gm) || []).length;

  const defaultTitle = `feat: updates across ${fileCount} file${fileCount > 1 ? 's' : ''} (+${addedLines} / -${removedLines})`;
  const defaultSummary = `This pull request introduces changes across ${fileCount} file(s), adding ${addedLines} lines and removing ${removedLines} lines.`;

  // If AI config is available and not in test, generate deep review
  if (state?.settings?.aiConfig && process.env.NODE_ENV !== 'test') {
    try {
      const { generateAIResponse } = await import('../ai/orchestrator');
      const prompt = `You are a Principal Software Engineer and PR Reviewer.
Analyze this git diff and synthesize an executive pull request review in JSON format.

GIT DIFF:
\`\`\`diff
${cleanDiff.slice(0, 4000)}
\`\`\`

Return strictly valid JSON with these keys:
{
  "title": "Conventional commit style PR title",
  "executiveSummary": "2-3 sentence overview of why and what was changed",
  "whatChanged": ["Bullet 1", "Bullet 2", "Bullet 3"],
  "architecturalImpact": "1 sentence on module relationships or performance",
  "breakingChanges": ["List any breaking changes or 'None detected'"],
  "risksAndGotchas": ["1-2 subtle edge cases or concurrency/race-condition risks"],
  "verificationChecklist": ["Test step 1", "Test step 2"]
}`;

      const res = await generateAIResponse(state, prompt, undefined, false, { skipHistory: true, isSystemScope: true });
      const text = typeof res === 'string' ? res : res?.message || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title || defaultTitle,
          executiveSummary: parsed.executiveSummary || defaultSummary,
          whatChanged: parsed.whatChanged || modifiedFiles.map((f) => `Modified \`${f}\``),
          architecturalImpact: parsed.architecturalImpact || 'Modular updates within existing boundaries.',
          breakingChanges: parsed.breakingChanges || ['None detected.'],
          risksAndGotchas: parsed.risksAndGotchas || ['Verify regression tests in affected components.'],
          verificationChecklist: parsed.verificationChecklist || ['Run unit test suite', 'Verify production build'],
        };
      }
    } catch (err) {
      console.warn('[DevDesk] AI PR review fallback:', err);
    }
  }

  // Deterministic fallback
  return {
    title: defaultTitle,
    executiveSummary: defaultSummary,
    whatChanged: modifiedFiles.length > 0 ? modifiedFiles.map((f) => `Modified \`${f}\``) : ['Codebase updates'],
    architecturalImpact: `Touches ${fileCount} component(s) with net change of ${addedLines - removedLines} lines.`,
    breakingChanges: ['None automatically detected in public interfaces.'],
    risksAndGotchas: [
      'Ensure state persistence adapters handle backwards-compatible schema transitions.',
      'Check for unintended side effects in downstream consumers.',
    ],
    verificationChecklist: [
      'Verify automated unit tests pass: `npm test`',
      'Verify production build completes without type errors: `npm run build`',
    ],
  };
}

export async function synthesizeBugHealer(
  stackTrace: string,
  state?: AppState
): Promise<BugDiagnosisResult> {
  const text = (stackTrace || '').trim();

  // Deterministic stack trace regex parsing
  const typeMatch = text.match(/\b([A-Z][A-Za-z0-9_]*(?:Error|Exception|Panic|Fault))\b/);
  const errorType = typeMatch ? typeMatch[1] : 'Runtime Error';

  const lineMatch = text.match(/(?:at |in |File "|\/|[A-Za-z]:\\)([^\s\(\)\:\"]+)(?:\:(\d+)(?:\:(\d+))?|\", line (\d+))/);
  const fileLocation = lineMatch ? lineMatch[1] : undefined;
  const lineLocation = lineMatch ? parseInt(lineMatch[2] || lineMatch[4] || '0', 10) : undefined;

  const msgLine = text.split('\n').find((l) => l.includes('Error:') || l.includes('Exception:') || l.includes('panic:')) || text.slice(0, 100);
  const errorMessage = msgLine.trim();

  // If AI config is available and not in test, generate deep diagnosis & patch
  if (state?.settings?.aiConfig && process.env.NODE_ENV !== 'test') {
    try {
      const { generateAIResponse } = await import('../ai/orchestrator');
      const prompt = `You are a Principal Software Debugger.
Analyze this error/stack trace and diagnose the exact root cause, providing a defensive code patch.

STACK TRACE / ERROR:
\`\`\`
${text.slice(0, 3000)}
\`\`\`

Return strictly valid JSON with these keys:
{
  "errorType": "${errorType}",
  "errorMessage": "${errorMessage.replace(/"/g, '\\"')}",
  "rootCause": "Direct 1-2 sentence root cause explanation",
  "explanation": "Why this happens in execution runtime",
  "suggestedPatch": "Unified diff or corrected code block demonstrating defensive null-checks or type guard",
  "defensiveRecommendations": ["Recommendation 1", "Recommendation 2"]
}`;

      const res = await generateAIResponse(state, prompt, undefined, false, { skipHistory: true, isSystemScope: true });
      const rawText = typeof res === 'string' ? res : res?.message || '';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          errorType: parsed.errorType || errorType,
          errorMessage: parsed.errorMessage || errorMessage,
          fileLocation,
          lineLocation,
          rootCause: parsed.rootCause || 'Undefined reference or unexpected null value in call chain.',
          explanation: parsed.explanation || 'An unhandled exception occurred when accessing a property or method on an uninitialized object.',
          suggestedPatch: parsed.suggestedPatch || '// Add defensive optional chaining:\nconst value = target?.property ?? fallback;',
          defensiveRecommendations: parsed.defensiveRecommendations || ['Use optional chaining (?.)', 'Add nullish coalescing (??)'],
        };
      }
    } catch (err) {
      console.warn('[DevDesk] AI bug healer fallback:', err);
    }
  }

  // Deterministic fallback
  const isTypeError = errorType.includes('Type') || /undefined|null/i.test(errorMessage);
  const rootCause = isTypeError
    ? 'Attempted to access a property, method, or index on an `undefined` or `null` reference.'
    : `Execution aborted due to an unhandled ${errorType} condition.`;

  const suggestedPatch = isTypeError
    ? `// Defensive fix: Apply optional chaining and nullish coalescing\nconst safeValue = object?.property ?? fallbackValue;\n\n// Or guard clause:\nif (!object) return fallbackValue;`
    : `try {\n  // Protected execution\n  executeOperation();\n} catch (err) {\n  console.error('[Handled ${errorType}]:', err);\n  // Safe fallback\n}`;

  return {
    errorType,
    errorMessage,
    fileLocation,
    lineLocation: lineLocation || undefined,
    rootCause,
    explanation: `The runtime encountered ${errorType} while executing ${fileLocation ? `\`${fileLocation}\`${lineLocation ? ` at line ${lineLocation}` : ''}` : 'the routine'}.`,
    suggestedPatch,
    defensiveRecommendations: [
      'Apply optional chaining (`?.`) when traversing deeply nested response objects.',
      'Check if the upstream async promise resolved or threw before consuming data.',
      'Wrap high-risk native or parsing calls in try/catch blocks.',
    ],
  };
}

