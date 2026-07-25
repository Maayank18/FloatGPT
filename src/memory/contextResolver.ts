import { useWorkspaceStore } from '../state/workspaceStore';

export const contextResolver = {
  resolveMemoryCapsule() {
    const memory = useWorkspaceStore.getState().memory;
    
    const activeGoalsText = memory.activeGoals.map(g => `- ${g.title}`).join('\n');
    const recentSummariesText = memory.recentSummaries.slice(-5).map(s => `[${s.source}] ${s.topic}: ${s.summary}`).join('\n');
    const decisionsText = memory.importantDecisions.map(d => `- ${d}`).join('\n');

    return `
[WORKSPACE MEMORY CAPSULE]
Active Goals:
${activeGoalsText || 'None'}

Recent Shared Activity:
${recentSummariesText || 'None'}

Important Decisions:
${decisionsText || 'None'}

Current Execution Status: ${memory.executionStatus}
`;
  }
};
