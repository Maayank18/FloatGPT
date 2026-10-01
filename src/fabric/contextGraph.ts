/**
 * FloatGPT — Cross-App Workspace Context Graph
 * 
 * Maintains structured contextual state across active desktop applications,
 * browser tabs, open projects, and current goals.
 */

export interface WorkspaceContext {
  activeApplication?: string;
  activeWindow?: string;
  activeWebsite?: string;
  activeProject?: string;
  activeFiles: string[];
  recentActions: string[];
  currentObjective?: string;
  lastUpdated: number;
}

class ContextGraphService {
  private currentContext: WorkspaceContext = {
    activeFiles: [],
    recentActions: [],
    lastUpdated: Date.now()
  };

  updateContext(partial: Partial<WorkspaceContext>) {
    this.currentContext = {
      ...this.currentContext,
      ...partial,
      lastUpdated: Date.now()
    };
  }

  getContext(): WorkspaceContext {
    return { ...this.currentContext };
  }

  recordAction(description: string) {
    this.currentContext.recentActions.push(description);
    if (this.currentContext.recentActions.length > 10) {
      this.currentContext.recentActions.shift();
    }
  }
}

export const ContextGraph = new ContextGraphService();
