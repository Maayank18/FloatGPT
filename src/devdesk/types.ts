/**
 * DevDesk — Git Doctor, PR Copilot & Bug Healer Types
 */

export interface GitConflictFile {
  path: string;
  conflictType: 'both_modified' | 'both_added' | 'deleted_by_us' | 'deleted_by_them' | 'other';
}

export interface GitRepoStatus {
  isRepo: boolean;
  branch: string;
  tracking?: string;
  ahead: number;
  behind: number;
  hasConflicts: boolean;
  conflictedFiles: GitConflictFile[];
  stagedCount: number;
  modifiedCount: number;
  untrackedCount: number;
  clean: boolean;
  rawOutput: string;
}

export interface PRReviewResult {
  title: string;
  executiveSummary: string;
  whatChanged: string[];
  architecturalImpact: string;
  breakingChanges: string[];
  risksAndGotchas: string[];
  verificationChecklist: string[];
}

export interface BugDiagnosisResult {
  errorType: string;
  errorMessage: string;
  fileLocation?: string;
  lineLocation?: number;
  rootCause: string;
  explanation: string;
  suggestedPatch: string;
  defensiveRecommendations: string[];
}

export interface DevDeskItem {
  id: string;
  mode: 'git' | 'pr' | 'bug';
  title: string;
  input: string;
  summary: string;
  createdAt: number;
  gitStatus?: GitRepoStatus;
  prReview?: PRReviewResult;
  bugDiagnosis?: BugDiagnosisResult;
}

