/**
 * FloatGPT — Skill System Subsystem
 */

export * from './types';
export * from './registry';
export * from './firstParty/weeklyReportSkill';
export * from './firstParty/documentSummarizerSkill';
export * from './firstParty/meetingPrepSkill';
export * from './firstParty/taskCleanupSkill';

import { SkillRegistry } from './registry';
import { weeklyReportSkill } from './firstParty/weeklyReportSkill';
import { documentSummarizerSkill } from './firstParty/documentSummarizerSkill';
import { meetingPrepSkill } from './firstParty/meetingPrepSkill';
import { taskCleanupSkill } from './firstParty/taskCleanupSkill';

/**
 * Initializes and registers all first-party production skills into the registry.
 */
export function initializeSkills(): void {
  SkillRegistry.register(weeklyReportSkill);
  SkillRegistry.register(documentSummarizerSkill);
  SkillRegistry.register(meetingPrepSkill);
  SkillRegistry.register(taskCleanupSkill);
}
