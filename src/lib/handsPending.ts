import type { HandsPending } from './hands';

let pending: HandsPending = null;

export function getHandsPending(): HandsPending {
  return pending;
}

export function setHandsPending(next: HandsPending): void {
  pending = next;
}
