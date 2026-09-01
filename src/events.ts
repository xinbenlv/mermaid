/**
 * SPEC.md "Reference → Event contract". Namespaced deliberately, so a future native implementation
 * can emit the same events and existing listeners keep working.
 */

export const EVENT_TOGGLE = 'mermaid-collapse:toggle' as const;
export const EVENT_CHANGE = 'mermaid-collapse:change' as const;

export interface ToggleEventDetail {
  diagramId: string;
  subgraphId: string;
  /** The state it's about to become — dispatched before the write. */
  nextCollapsed: boolean;
}

export interface ChangeEventDetail {
  diagramId: string;
  subgraphId: string;
  collapsed: boolean;
}

export function dispatchToggle(target: EventTarget, detail: ToggleEventDetail): void {
  target.dispatchEvent(
    new CustomEvent<ToggleEventDetail>(EVENT_TOGGLE, { bubbles: true, composed: true, detail })
  );
}

export function dispatchChange(target: EventTarget, detail: ChangeEventDetail): void {
  target.dispatchEvent(
    new CustomEvent<ChangeEventDetail>(EVENT_CHANGE, { bubbles: true, composed: true, detail })
  );
}
