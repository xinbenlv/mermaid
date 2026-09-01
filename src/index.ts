export { SPEC_VERSION, makeCollapseState } from './types.js';
export type { CollapseState, CollapseSource } from './types.js';

export { computeDiagramId } from './identity.js';

export { applyOverrides, readAuthoredViews } from './rewrite.js';
export type { ViewOverride } from './rewrite.js';

export type { CollapseStateAdapter } from './storage/types.js';
export { createMemoryAdapter } from './storage/memoryAdapter.js';
export { createLocalStorageAdapter } from './storage/localStorageAdapter.js';

export {
  EVENT_TOGGLE,
  EVENT_CHANGE,
  dispatchToggle,
  dispatchChange,
} from './events.js';
export type { ToggleEventDetail, ChangeEventDetail } from './events.js';

export { renderCollapsible } from './render.js';
export type { MermaidLike, RenderOptions } from './render.js';
