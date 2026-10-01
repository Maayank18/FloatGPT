/**
 * FloatGPT — Skill Registry
 * 
 * Central registry for versioned, declarative skills.
 * Enforces capability dependencies, lifecycle states, and discovery.
 */

import { SkillDefinition, SkillCategory, SkillLifecycle } from './types';
import { CapabilityRegistry } from '../fabric/registry';

export class SkillRegistry {
  private static skills: Map<string, SkillDefinition> = new Map();

  private static buildKey(id: string, version: string): string {
    return `${id.toLowerCase()}@${version}`;
  }

  /**
   * Registers a skill in the catalog.
   * Validates that all required capabilities exist in the CapabilityRegistry.
   */
  static register(skill: SkillDefinition): boolean {
    // 1. Validate that all required capabilities are registered
    for (const capId of skill.requiredCapabilities) {
      if (!CapabilityRegistry.has(capId)) {
        console.warn(
          `[SkillRegistry] Cannot register skill "${skill.id}@${skill.version}". Missing required capability: "${capId}".`
        );
        return false;
      }
    }

    const key = this.buildKey(skill.id, skill.version);
    const updated = {
      ...skill,
      createdAt: skill.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    this.skills.set(key, updated);
    return true;
  }

  /**
   * Retrieves a skill by ID and optional version.
   * If version is omitted, returns the highest active version.
   */
  static get(id: string, version?: string): SkillDefinition | null {
    if (version) {
      return this.skills.get(this.buildKey(id, version)) || null;
    }

    // Find all versions of this skill
    const prefix = `${id.toLowerCase()}@`;
    const matching: SkillDefinition[] = [];
    for (const [k, v] of this.skills.entries()) {
      if (k.startsWith(prefix) && v.lifecycle === 'ACTIVE') {
        matching.push(v);
      }
    }

    if (matching.length === 0) {
      // Fallback: check any matching regardless of lifecycle
      for (const [k, v] of this.skills.entries()) {
        if (k.startsWith(prefix)) matching.push(v);
      }
    }

    if (matching.length === 0) return null;

    // Sort descending by version string or updatedAt
    matching.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
    return matching[0];
  }

  /**
   * Checks if a skill exists.
   */
  static has(id: string, version?: string): boolean {
    return this.get(id, version) !== null;
  }

  /**
   * Retrieves all registered skills.
   */
  static getAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * Retrieves skills filtered by category and active lifecycle.
   */
  static getByCategory(category: SkillCategory): SkillDefinition[] {
    return Array.from(this.skills.values()).filter(
      s => s.category === category && s.lifecycle === 'ACTIVE'
    );
  }

  /**
   * Updates the lifecycle status of a registered skill.
   */
  static updateLifecycle(id: string, version: string, lifecycle: SkillLifecycle): boolean {
    const key = this.buildKey(id, version);
    const skill = this.skills.get(key);
    if (!skill) return false;

    skill.lifecycle = lifecycle;
    skill.updatedAt = Date.now();
    this.skills.set(key, skill);
    return true;
  }

  /**
   * Clears all registered skills.
   */
  static clear(): void {
    this.skills.clear();
  }
}
