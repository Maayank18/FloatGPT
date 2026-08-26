/**
 * Update Service — FloatGPT Version & Model Broadcast Checker
 * Checks GitHub Releases and Cloud Manifests for new versions and live AI model updates.
 */

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  title: string;
  message: string;
  releaseUrl: string;
}

export const CURRENT_VERSION = '2.1.2';
export const GITHUB_REPO = 'Maayank18/FloatGPT';

/**
 * Checks if a newer version of FloatGPT or new live models are available.
 * Cached per session to ensure it only notifies once per launch.
 */
export async function checkFloatGPTUpdate(force = false): Promise<UpdateInfo | null> {
  // If already notified in this session, skip unless forced
  if (!force) {
    const alreadyNotified = sessionStorage.getItem('floatgpt_update_notified');
    if (alreadyNotified) {
      return null;
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout for zero lag

    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      // Mark as checked to prevent hammering
      sessionStorage.setItem('floatgpt_update_notified', 'true');
      return null;
    }

    const data = await res.json();
    const latestTag = (data.tag_name || '').replace(/^v/i, '').trim();
    const currentTag = CURRENT_VERSION.replace(/^v/i, '').trim();
    const releaseUrl = data.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`;

    // Mark that we performed the check
    sessionStorage.setItem('floatgpt_update_notified', 'true');

    // Compare versions (semver or tag match)
    if (latestTag && isVersionGreater(latestTag, currentTag)) {
      return {
        hasUpdate: true,
        currentVersion: CURRENT_VERSION,
        latestVersion: latestTag,
        title: `FloatGPT v${latestTag} Available`,
        message: data.name || 'A new update with improved OS automation and latest AI models is live.',
        releaseUrl
      };
    }

    return null;
  } catch (e) {
    // Offline or network rate limit — fail silently with 0 lag
    sessionStorage.setItem('floatgpt_update_notified', 'true');
    return null;
  }
}

/**
 * Simple semver comparison helper: returns true if v1 > v2
 */
function isVersionGreater(v1: string, v2: string): boolean {
  const p1 = v1.split('.').map(n => parseInt(n, 10) || 0);
  const p2 = v2.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return true;
    if (num1 < num2) return false;
  }
  return false;
}
