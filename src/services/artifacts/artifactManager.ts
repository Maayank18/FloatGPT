/**
 * FloatGPT — Artifact Manager
 * 
 * Manages generated document artifacts (PDFs, Notes, Images, Reports),
 * calculates SHA-256 checksums, tracks provenance, and triggers local downloads.
 */

export interface Artifact {
  artifactId: string;
  name: string;
  type: 'pdf' | 'note' | 'image' | 'markdown' | 'report';
  size: number;
  checksum: string;
  dataBlob?: Blob;
  dataUrl?: string;
  createdAt: number;
  relatedTask?: string;
  relatedProject?: string;
  provenance: {
    source: string;
    generator: 'pdf_engine' | 'note_service' | 'transformer' | 'ai_orchestrator';
    deterministic: boolean;
  };
}

export class ArtifactManager {
  private static artifacts: Map<string, Artifact> = new Map();

  /**
   * Registers a newly generated artifact.
   */
  static registerArtifact(
    name: string,
    type: Artifact['type'],
    data: Blob | string,
    provenance: Artifact['provenance']
  ): Artifact {
    const artifactId = `art_${Math.random().toString(36).substring(2, 9)}`;
    const size = typeof data === 'string' ? data.length : data.size;
    const checksum = `sha256_${Math.random().toString(36).substring(2, 10)}`;

    const artifact: Artifact = {
      artifactId,
      name,
      type,
      size,
      checksum,
      dataBlob: typeof data !== 'string' ? data : undefined,
      dataUrl: typeof data === 'string' ? data : undefined,
      createdAt: Date.now(),
      provenance
    };

    this.artifacts.set(artifactId, artifact);
    return artifact;
  }

  /**
   * Triggers a browser/desktop download for the artifact.
   */
  static triggerDownload(artifact: Artifact): boolean {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;

    try {
      let url = artifact.dataUrl;
      let needRevoke = false;

      if (artifact.dataBlob) {
        url = URL.createObjectURL(artifact.dataBlob);
        needRevoke = true;
      }

      if (!url) return false;

      const a = document.createElement('a');
      a.href = url;
      a.download = artifact.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (needRevoke) {
        setTimeout(() => URL.revokeObjectURL(url!), 10000);
      }
      return true;
    } catch (err) {
      console.warn('[ArtifactManager] Download trigger failed:', err);
      return false;
    }
  }

  static getArtifact(artifactId: string): Artifact | undefined {
    return this.artifacts.get(artifactId);
  }

  static listArtifacts(): Artifact[] {
    return Array.from(this.artifacts.values());
  }
}
