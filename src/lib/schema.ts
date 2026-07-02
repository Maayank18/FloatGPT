import { z } from 'zod';

const dateTransform = z.union([z.string(), z.number()]).transform((val) => {
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return isNaN(parsed) ? Date.now() : parsed;
  }
  return val;
});

export const ZGoal = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  progress: z.number().min(0).max(100).default(0),
  deadlineAt: dateTransform.optional(),
  createdAt: dateTransform,
  updatedAt: dateTransform.optional(),
  completedAt: dateTransform.optional(),
  status: z.enum(['Active', 'Completed', 'Archived']).optional(),
});

export const ZProject = z.object({
  id: z.string(),
  goalId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  progress: z.number().min(0).max(100).default(0),
  deadlineAt: dateTransform.optional(),
  createdAt: dateTransform,
  updatedAt: dateTransform.optional(),
  completedAt: dateTransform.optional(),
  status: z.enum(['Active', 'Completed', 'Archived']).optional(),
});

export const ZTask = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  status: z.enum(['Inbox', 'Planned', 'Active', 'In Progress', 'Completed', 'Archived']).default('Planned'),
  deadlineAt: dateTransform.optional(),
  estimatedEffort: z.string().optional(),
  priority: z.string().optional(),
  createdAt: dateTransform,
  updatedAt: dateTransform.optional(),
  completedAt: dateTransform.optional(),
});

export const ZUpdatedTask = z.object({
  id: z.string(),
  status: z.enum(['Inbox', 'Planned', 'Active', 'In Progress', 'Completed', 'Archived']),
});

export const ZRisk = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['Identified', 'Mitigated', 'Realized']).default('Identified'),
  createdAt: dateTransform,
});

export const ZResource = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  type: z.string(),
  createdAt: dateTransform,
});

export const ZRecommendation = z.object({
  id: z.string(),
  message: z.string(),
  type: z.enum(['coaching', 'warning', 'suggestion']).default('coaching'),
  createdAt: dateTransform,
});

export const ZHabitProfileUpdate = z.object({
  focusWindow: z.string().optional(),
  delayRisk: z.string().optional(),
  preferredSession: z.string().optional(),
  activeHours: z.string().optional(),
});

export const ZFocusModeUpdate = z.object({
  active: z.boolean(),
  coachingMessage: z.string().optional(),
  topTaskIds: z.array(z.string()).optional(),
});

export const ZAIResponseSchema = z.object({
  message: z.string(),
  newGoals: z.array(ZGoal).optional(),
  newProjects: z.array(ZProject).optional(),
  newTasks: z.array(ZTask).optional(),
  updatedTasks: z.array(ZUpdatedTask).optional(),
  newRisks: z.array(ZRisk).optional(),
  newResources: z.array(ZResource).optional(),
  newRecommendations: z.array(ZRecommendation).optional(),
  habitProfileUpdate: ZHabitProfileUpdate.optional(),
  focusModeUpdate: ZFocusModeUpdate.optional(),
});

export type AIResponse = z.infer<typeof ZAIResponseSchema>;
