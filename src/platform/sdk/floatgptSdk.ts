/**
 * FloatGPT — Developer Platform SDK
 * 
 * Official SDK for enterprise developers to build, register,
 * and publish custom Skills, Connectors, and Capabilities.
 */

import { SkillDefinition } from '../../skills/types';
import { SkillRegistry } from '../../skills/registry';
import { IConnector } from '../integrations/types';

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  skills?: SkillDefinition[];
  connectors?: IConnector[];
}

export class FloatGPTSDK {
  private static registeredExtensions: Map<string, ExtensionManifest> = new Map();

  /**
   * Registers a validated enterprise extension package.
   */
  static registerExtension(manifest: ExtensionManifest): { success: boolean; registeredSkills: number; errors?: string[] } {
    if (!manifest.id || !manifest.version) {
      return { success: false, registeredSkills: 0, errors: ['Manifest must specify id and version.'] };
    }

    const errors: string[] = [];
    let skillCount = 0;

    // Register all skills in manifest
    for (const skill of manifest.skills || []) {
      const ok = SkillRegistry.register(skill);
      if (ok) {
        skillCount++;
      } else {
        errors.push(`Failed to register skill "${skill.id}". Required capabilities may be missing.`);
      }
    }

    this.registeredExtensions.set(manifest.id, manifest);
    return {
      success: errors.length === 0,
      registeredSkills: skillCount,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  static getExtension(id: string): ExtensionManifest | null {
    return this.registeredExtensions.get(id) || null;
  }

  static listExtensions(): ExtensionManifest[] {
    return Array.from(this.registeredExtensions.values());
  }

  static clear(): void {
    this.registeredExtensions.clear();
  }
}
