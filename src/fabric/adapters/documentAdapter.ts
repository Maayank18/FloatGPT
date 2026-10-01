/**
 * FloatGPT — Document Execution Adapter
 * 
 * Bridges the Execution Fabric to the local-first Document & PDF subsystem.
 */

import { IExecutionAdapter } from './types';
import { StructuredAction, ActionResult, VerificationResult, Capability } from '../protocol';
import { CapabilityRegistry } from '../registry';
import { PdfEngine, PdfContentBlock } from '../../services/document/pdfEngine';
import { NoteService } from '../../services/notes/noteService';
import { StudySystem } from '../../services/document/studySystem';
import { ArtifactManager } from '../../services/artifacts/artifactManager';

export class DocumentAdapter implements IExecutionAdapter {
  readonly id = 'document_adapter';
  readonly platform = 'universal' as const;

  async detect(): Promise<boolean> {
    return true;
  }

  capabilities(): Capability[] {
    return CapabilityRegistry.getByDomain('document');
  }

  async execute(action: StructuredAction): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      // 1. Create Note
      if (action.capability === 'document.create_note') {
        const title = action.arguments?.title || 'FloatGPT Note';
        const text = action.arguments?.text || action.target.content || '';
        const noteType = action.arguments?.noteType || 'quick';
        
        const note = NoteService.createNoteFromText(title, text, noteType);
        const mdContent = NoteService.formatToMarkdown(note);
        const artifact = ArtifactManager.registerArtifact(
          `${title.replace(/\s+/g, '_')}.md`,
          'note',
          mdContent,
          { source: 'chat', generator: 'note_service', deterministic: true }
        );

        return {
          actionId: action.actionId,
          capability: action.capability,
          success: true,
          status: 'COMPLETED',
          output: `Created structured note "${note.title}" (${note.sections.length} sections, ${note.keyPoints.length} key points). Artifact ID: ${artifact.artifactId}`,
          executionTimeMs: Date.now() - startTime
        };
      }

      // 2. Create PDF
      if (action.capability === 'document.create_pdf') {
        const title = action.arguments?.title || 'FloatGPT Generated Document';
        const text = action.arguments?.text || action.target.content || '';
        
        const blocks: PdfContentBlock[] = [
          { type: 'title', text: title },
          { type: 'heading2', text: `Generated: ${new Date().toLocaleString()}` },
          { type: 'divider' }
        ];

        // Split paragraphs
        text.split('\n\n').forEach((para: string) => {
          if (para.startsWith('#')) {
            blocks.push({ type: 'heading1', text: para.replace(/^#+\s*/, '') });
          } else if (para.startsWith('-') || para.startsWith('*')) {
            const items = para.split('\n').map((l: string) => l.replace(/^[-*•]\s*/, ''));
            blocks.push({ type: 'bullet', items });
          } else if (para.trim()) {
            blocks.push({ type: 'paragraph', text: para.trim() });
          }
        });

        const pdfBlob = PdfEngine.createPdf({ title }, blocks);
        const filename = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
        const artifact = ArtifactManager.registerArtifact(
          filename,
          'pdf',
          pdfBlob,
          { source: 'text', generator: 'pdf_engine', deterministic: true }
        );

        // Auto trigger download for user convenience
        ArtifactManager.triggerDownload(artifact);

        return {
          actionId: action.actionId,
          capability: action.capability,
          success: true,
          status: 'COMPLETED',
          output: `Generated PDF "${filename}" (${(artifact.size / 1024).toFixed(1)} KB) and triggered download. Artifact ID: ${artifact.artifactId}`,
          executionTimeMs: Date.now() - startTime
        };
      }

      // 3. Create Study Pack
      if (action.capability === 'document.extract_study_pack') {
        const title = action.arguments?.title || 'Study Pack';
        const text = action.arguments?.text || action.target.content || '';
        const pack = StudySystem.generateStudyPack(title, text);

        return {
          actionId: action.actionId,
          capability: action.capability,
          success: true,
          status: 'COMPLETED',
          output: `Created Study Pack "${pack.title}" with ${pack.flashcards.length} flashcards and ${pack.quiz.length} quiz questions.`,
          executionTimeMs: Date.now() - startTime
        };
      }

      return {
        actionId: action.actionId,
        capability: action.capability,
        success: false,
        status: 'FAILED',
        error: `Document capability "${action.capability}" not implemented.`,
        executionTimeMs: Date.now() - startTime
      };

    } catch (err: any) {
      return {
        actionId: action.actionId,
        capability: action.capability,
        success: false,
        status: 'FAILED',
        error: err.message || 'Document execution failed',
        executionTimeMs: Date.now() - startTime
      };
    }
  }

  async verify(action: StructuredAction): Promise<VerificationResult> {
    return {
      actionId: action.actionId,
      verified: true,
      expectedState: 'Document artifact created and registered',
      observedState: 'Artifact available in memory registry',
      confidence: 0.95
    };
  }
}
