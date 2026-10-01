/**
 * FloatGPT — Global Emergency Kill Switch
 * 
 * Provides an immediate, non-LLM-dependent hardware abort switch.
 * Instantly terminates active adapter executions and rejects new incoming actions.
 */

type KillSwitchListener = (isHalted: boolean) => void;

export class KillSwitch {
  private static halted: boolean = false;
  private static listeners: Set<KillSwitchListener> = new Set();

  /**
   * Returns whether the global kill switch is currently engaged.
   */
  static isHalted(): boolean {
    return this.halted;
  }

  /**
   * Engages the kill switch, stopping all action brokers immediately.
   */
  static trigger(reason: string = 'User initiated emergency stop') {
    this.halted = true;
    console.warn(`🛑 [KILL SWITCH ENGAGED]: ${reason}`);
    this.notifyListeners();
  }

  /**
   * Resets the kill switch, allowing normal execution to resume.
   */
  static reset() {
    this.halted = false;
    console.log(`🟢 [KILL SWITCH RESET]: Normal execution restored`);
    this.notifyListeners();
  }

  static subscribe(listener: KillSwitchListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private static notifyListeners() {
    this.listeners.forEach(l => {
      try {
        l(this.halted);
      } catch (err) {
        console.error('[KillSwitch] Listener error:', err);
      }
    });
  }
}
