export type TaskStatus = 'Inbox' | 'Planned' | 'Active' | 'In Progress' | 'Completed' | 'Archived';
export type RiskStatus = 'Identified' | 'Mitigated' | 'Realized';

export interface Goal {
  id: string;
  title: string;
  description: string;
  progress: number; // 0-100
  deadlineAt?: number;
  createdAt: number;
  updatedAt?: number;
  completedAt?: number;
  status?: 'Active' | 'Completed' | 'Archived';
}

export interface Project {
  id: string;
  goalId: string;
  title: string;
  description: string;
  progress: number;
  deadlineAt?: number;
  createdAt: number;
  updatedAt?: number;
  completedAt?: number;
  status?: 'Active' | 'Completed' | 'Archived';
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  deadlineAt?: number;
  estimatedEffort?: string;
  priority?: string;
  dependencies?: string[];
  alerted?: boolean;
  createdAt: number;
  updatedAt?: number;
  completedAt?: number;
  recovered?: boolean;
  deferred?: boolean;
  split?: boolean;
  carriedOver?: boolean;
}

export interface Risk {
  id: string;
  relatedId?: string; // e.g., projectId or taskId
  title: string;
  description: string;
  status: RiskStatus;
  createdAt: number;
}

export interface Resource {
  id: string;
  relatedId?: string;
  title: string;
  url?: string;
  type: string;
  createdAt: number;
}

export interface CompletionHistory {
  id: string;
  entityId: string; // taskId or projectId
  entityType: 'Goal' | 'Task' | 'Project' | 'task' | 'project';
  title?: string;
  completedAt: number;
  notes?: string;
  archived?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface HabitProfile {
  focusWindow: string;
  delayRisk: string;
  preferredSession: string;
  activeHours: string;
}

export interface ExecutionProfile {
  averageCompletionTimeMinutes: number;
  planningAccuracyPercent: number;
  completionRatePercent: number;
  averageDelayMinutes: number;
  preferredWorkingHours: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'Unknown';
  preferredTaskSequence: string[];
  frequentlyDelayedCategories: string[];
  averageFocusDurationMinutes: number;
  mostProductiveWeekday: string;
  
  // Internal counters for rolling averages
  _completedTasksCount: number;
  _totalCreatedTasksCount: number;
  _totalDelayMinutes: number;
  _planningAccuracySum: number;
  _planningAccuracyCount: number;
  _totalFocusDurationMinutes: number;
  _focusSessionsCount: number;
  _completedByTimeOfDay: Record<string, number>;
  _completedByWeekday: Record<string, number>;
  _categoryDelays: Record<string, number>;
  _recentCompletedTypes: string[];
  _currentFocusStartTime?: number;
}

export interface Recommendation {
  id: string;
  message: string;
  type: 'coaching' | 'warning' | 'suggestion';
  createdAt: number;
}

export interface FocusModeState {
  active: boolean;
  coachingMessage?: string;
  topTaskIds?: string[];
}

export interface Settings {
  theme: 'dark' | 'light';
  appearance: {
    accentColor: string;
    iconStyle: 'solid' | 'outline';
    panelDensity: 'comfortable' | 'compact';
  };
  features: {
    autoPlanSync: boolean;
    habitMemory: boolean;
    personalizedRecommendations: boolean;
    focusModeEnabled: boolean;
    soundAlerts: boolean;
    experimentalFeatures: boolean;
  };
  accessibility: {
    reducedMotion: boolean;
    largerTextMode: boolean;
    highContrastMode: boolean;
  };
}

export interface DailySession {
  id: string; // date string like '2026-06-24'
  date: number;
  goals: Goal[];
  projects: Project[];
  tasks: Task[];
  risks: Risk[];
  messages: Message[];
  recommendations: Recommendation[];
  history?: CompletionHistory[];
}

export interface RecoveryState {
  status: 'Healthy' | 'Slight Drift' | 'Moderate Delay' | 'Critical Delay' | 'Mission Failure';
  estimatedRecoveryHours: number;
  tasksDeferredCount: number;
  missionConfidencePercent: number;
  isRecovering: boolean;
  lastRecoveredAt?: number;
}

export interface AppState {
  sessionId: string;
  sessionDate: number;
  viewingSessionId?: string | null;
  goals: Goal[];
  projects: Project[];
  tasks: Task[];
  risks: Risk[];
  resources: Resource[];
  history: CompletionHistory[];
  messages: Message[];
  focusMode: boolean; // Deprecated, use focusModeState
  focusModeState: FocusModeState;
  habitProfile: HabitProfile;
  executionProfile: ExecutionProfile;
  recommendations: Recommendation[];
  recoveryState: RecoveryState;
  settings: Settings;
  pastSessions: DailySession[];
}

export const INITIAL_SETTINGS: Settings = {
  theme: 'dark',
  appearance: {
    accentColor: 'indigo',
    iconStyle: 'outline',
    panelDensity: 'comfortable',
  },
  features: {
    autoPlanSync: true,
    habitMemory: true,
    personalizedRecommendations: true,
    focusModeEnabled: true,
    soundAlerts: true,
    experimentalFeatures: false,
  },
  accessibility: {
    reducedMotion: false,
    largerTextMode: false,
    highContrastMode: false,
  }
};

export const INITIAL_EXECUTION_PROFILE: ExecutionProfile = {
  averageCompletionTimeMinutes: 0,
  planningAccuracyPercent: 100,
  completionRatePercent: 100,
  averageDelayMinutes: 0,
  preferredWorkingHours: 'Unknown',
  preferredTaskSequence: [],
  frequentlyDelayedCategories: [],
  averageFocusDurationMinutes: 0,
  mostProductiveWeekday: 'Unknown',
  
  _completedTasksCount: 0,
  _totalCreatedTasksCount: 0,
  _totalDelayMinutes: 0,
  _planningAccuracySum: 0,
  _planningAccuracyCount: 0,
  _totalFocusDurationMinutes: 0,
  _focusSessionsCount: 0,
  _completedByTimeOfDay: { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 },
  _completedByWeekday: { Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0 },
  _categoryDelays: {},
  _recentCompletedTypes: [],
};

export const INITIAL_RECOVERY_STATE: RecoveryState = {
  status: 'Healthy',
  estimatedRecoveryHours: 0,
  tasksDeferredCount: 0,
  missionConfidencePercent: 100,
  isRecovering: false,
};

export const INITIAL_STATE: AppState = {
  sessionId: new Date().toISOString().split('T')[0],
  sessionDate: Date.now(),
  viewingSessionId: null,
  goals: [],
  projects: [],
  tasks: [],
  risks: [],
  resources: [],
  history: [],
  messages: [],
  focusMode: false,
  focusModeState: { active: false },
  habitProfile: {
    focusWindow: 'Unknown',
    delayRisk: 'Unknown',
    preferredSession: 'Unknown',
    activeHours: 'Unknown'
  },
  executionProfile: INITIAL_EXECUTION_PROFILE,
  recommendations: [],
  recoveryState: INITIAL_RECOVERY_STATE,
  settings: INITIAL_SETTINGS,
  pastSessions: [],
};
