# FlipFeeds Test Suite

## Running Tests

### Unit & Integration Tests (Vitest)
```bash
pnpm test          # Run all tests once
pnpm test:watch    # Watch mode
pnpm test:coverage # With coverage report
```

### E2E Tests (Playwright)
```bash
pnpm test:e2e                    # All browsers
pnpm test:e2e --project=chromium # Chrome only
```

## Test Structure
- `packages/*/tests/` — Unit and integration tests per package
- `tests/e2e/` — End-to-end Playwright tests

## Phase 1 Quality Gates
- [ ] Monorepo builds: `pnpm build` succeeds
- [ ] Canvas renders: Phaser canvas visible with non-zero dimensions
- [ ] WebSocket works: ping/pong completes
- [ ] Event bridge: GAME_READY propagates from Phaser to React
- [ ] Cross-browser: No console errors in Chrome, Firefox, Safari
- [ ] Responsive: Canvas fills viewport
