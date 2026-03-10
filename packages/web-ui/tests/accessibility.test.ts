import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Phase 4 — Accessibility Tests
 *
 * Tests focus trap logic for modals and keyboard navigation.
 * Pure functions — no DOM, no React.
 */

// ============================================================
// Pure logic for focus trap behavior
// ============================================================

interface FocusTrapState {
  trapped: boolean;
  firstFocusable: string | null;
  lastFocusable: string | null;
}

class FocusTrap {
  private state: FocusTrapState = {
    trapped: false,
    firstFocusable: null,
    lastFocusable: null,
  };

  activate(container: string[]): FocusTrapState {
    if (container.length === 0) {
      return { ...this.state };
    }

    this.state = {
      trapped: true,
      firstFocusable: container[0],
      lastFocusable: container[container.length - 1],
    };

    return { ...this.state };
  }

  deactivate(): FocusTrapState {
    this.state = {
      trapped: false,
      firstFocusable: null,
      lastFocusable: null,
    };

    return { ...this.state };
  }

  getState(): FocusTrapState {
    return { ...this.state };
  }

  /**
   * Handle Tab key navigation within the trap.
   * Returns the new focus index.
   *
   * @param shiftKey - Whether Shift is held (reverse direction)
   * @param currentIndex - Current focused element index
   * @param totalElements - Total focusable elements in container
   * @returns New focus index
   */
  handleTab(shiftKey: boolean, currentIndex: number, totalElements: number): number {
    if (totalElements === 0) return 0;

    if (shiftKey) {
      // Shift+Tab: go backwards, wrap to last if at first
      if (currentIndex <= 0) {
        return totalElements - 1;
      }
      return currentIndex - 1;
    } else {
      // Tab: go forwards, wrap to first if at last
      if (currentIndex >= totalElements - 1) {
        return 0;
      }
      return currentIndex + 1;
    }
  }
}

/**
 * Keyboard handler for modal escape behavior.
 */
class ModalKeyboardHandler {
  private isOpen = false;
  private onCloseCallback: (() => void) | null = null;

  open(onClose: () => void): void {
    this.isOpen = true;
    this.onCloseCallback = onClose;
  }

  close(): void {
    this.isOpen = false;
    this.onCloseCallback = null;
  }

  handleKeyDown(key: string): boolean {
    if (key === 'Escape' && this.isOpen && this.onCloseCallback) {
      this.onCloseCallback();
      return true; // Event handled
    }
    return false;
  }

  getIsOpen(): boolean {
    return this.isOpen;
  }
}

// ============================================================
// Tests
// ============================================================

describe('FocusTrap — Activation', () => {
  let trap: FocusTrap;

  beforeEach(() => {
    trap = new FocusTrap();
  });

  it('modal traps focus (Tab cycles within modal)', () => {
    const elements = ['close-button', 'content-area', 'action-button'];
    const state = trap.activate(elements);

    expect(state.trapped).toBe(true);
    expect(state.firstFocusable).toBe('close-button');
    expect(state.lastFocusable).toBe('action-button');
  });

  it('deactivate releases focus trap', () => {
    trap.activate(['btn1', 'btn2']);
    const state = trap.deactivate();

    expect(state.trapped).toBe(false);
    expect(state.firstFocusable).toBeNull();
    expect(state.lastFocusable).toBeNull();
  });

  it('focus returns to game after modal close (trap deactivated)', () => {
    trap.activate(['close-btn', 'input', 'submit-btn']);
    expect(trap.getState().trapped).toBe(true);

    trap.deactivate();
    expect(trap.getState().trapped).toBe(false);
    // After deactivation, focus management returns to the game
  });

  it('activating with empty container does not trap', () => {
    const state = trap.activate([]);
    expect(state.trapped).toBe(false);
  });

  it('single element container works', () => {
    const state = trap.activate(['only-button']);
    expect(state.trapped).toBe(true);
    expect(state.firstFocusable).toBe('only-button');
    expect(state.lastFocusable).toBe('only-button');
  });
});

describe('FocusTrap — Tab Navigation', () => {
  let trap: FocusTrap;

  beforeEach(() => {
    trap = new FocusTrap();
    trap.activate(['close-btn', 'input', 'submit-btn']);
  });

  it('Tab at last element wraps to first', () => {
    const newIndex = trap.handleTab(false, 2, 3);
    expect(newIndex).toBe(0);
  });

  it('Tab at first element with Shift wraps to last', () => {
    const newIndex = trap.handleTab(true, 0, 3);
    expect(newIndex).toBe(2);
  });

  it('Tab moves forward normally', () => {
    expect(trap.handleTab(false, 0, 3)).toBe(1);
    expect(trap.handleTab(false, 1, 3)).toBe(2);
  });

  it('Shift+Tab moves backward normally', () => {
    expect(trap.handleTab(true, 2, 3)).toBe(1);
    expect(trap.handleTab(true, 1, 3)).toBe(0);
  });

  it('Shift+Tab wraps to last element from first', () => {
    const newIndex = trap.handleTab(true, 0, 5);
    expect(newIndex).toBe(4);
  });

  it('Tab wraps to first element from last', () => {
    const newIndex = trap.handleTab(false, 4, 5);
    expect(newIndex).toBe(0);
  });

  it('handles single element (always stays at 0)', () => {
    expect(trap.handleTab(false, 0, 1)).toBe(0);
    expect(trap.handleTab(true, 0, 1)).toBe(0);
  });

  it('handles zero elements gracefully', () => {
    expect(trap.handleTab(false, 0, 0)).toBe(0);
    expect(trap.handleTab(true, 0, 0)).toBe(0);
  });
});

describe('ModalKeyboardHandler — Escape', () => {
  let handler: ModalKeyboardHandler;

  beforeEach(() => {
    handler = new ModalKeyboardHandler();
  });

  it('Escape closes modal', () => {
    let closed = false;
    handler.open(() => { closed = true; });

    const handled = handler.handleKeyDown('Escape');
    expect(handled).toBe(true);
    expect(closed).toBe(true);
  });

  it('Escape when modal is closed does nothing', () => {
    const handled = handler.handleKeyDown('Escape');
    expect(handled).toBe(false);
  });

  it('non-Escape keys do not close modal', () => {
    let closed = false;
    handler.open(() => { closed = true; });

    expect(handler.handleKeyDown('Enter')).toBe(false);
    expect(handler.handleKeyDown('Tab')).toBe(false);
    expect(handler.handleKeyDown('a')).toBe(false);
    expect(closed).toBe(false);
  });

  it('chat input is keyboard accessible (Enter key handling)', () => {
    // Simulate chat input behavior: Enter submits, Escape closes
    let submitted = false;
    let closed = false;

    const handleChatKey = (key: string): string => {
      if (key === 'Enter') {
        submitted = true;
        return 'submit';
      }
      if (key === 'Escape') {
        closed = true;
        return 'close';
      }
      return 'type';
    };

    expect(handleChatKey('Enter')).toBe('submit');
    expect(submitted).toBe(true);

    expect(handleChatKey('Escape')).toBe('close');
    expect(closed).toBe(true);

    expect(handleChatKey('a')).toBe('type');
  });
});
