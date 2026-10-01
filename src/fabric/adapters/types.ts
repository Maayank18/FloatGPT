/**
 * FloatGPT — Execution Adapter Interface (Adapter SDK)
 * 
 * Standard contract implemented by all native and virtual adapters.
 */

import { StructuredAction, ActionResult, VerificationResult, Capability } from '../protocol';

export interface IExecutionAdapter {
  readonly id: string;
  readonly platform: 'windows' | 'macos' | 'linux' | 'universal';

  /**
   * Returns true if this adapter is available and detected on the current host.
   */
  detect(): Promise<boolean>;

  /**
   * Returns the list of capabilities supported by this adapter.
   */
  capabilities(): Capability[];

  /**
   * Executes the structured action through this adapter.
   */
  execute(action: StructuredAction): Promise<ActionResult>;

  /**
   * Verifies that the expected outcome of the action occurred.
   */
  verify(action: StructuredAction): Promise<VerificationResult>;
}
