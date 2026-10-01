/**
 * FloatGPT — Smart Note-Taker: Type Definitions
 */

export type NoteType = 
  | 'quick' 
  | 'meeting' 
  | 'study' 
  | 'research' 
  | 'project' 
  | 'technical' 
  | 'decision';

export interface ActionItem {
  task: string;
  owner?: string;
  deadline?: string;
  completed?: boolean;
}

export interface NoteSection {
  heading: string;
  content: string;
  bulletPoints?: string[];
}

export interface StructuredNote {
  noteId: string;
  title: string;
  noteType: NoteType;
  summary: string;
  sections: NoteSection[];
  keyPoints: string[];
  actionItems: ActionItem[];
  decisions: string[];
  questions: string[];
  tags: string[];
  sourceRef?: {
    type: 'chat' | 'pdf' | 'webpage' | 'screenshot' | 'file' | 'clipboard';
    name?: string;
    url?: string;
  };
  createdAt: number;
  updatedAt: number;
}
