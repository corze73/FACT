import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';

const read = (path) => readFileSync(resolve(cwd(), path), 'utf8');

describe('web quality safeguards', () => {
  it('provides keyboard navigation landmarks and visible focus', () => {
    const layout = read('apps/web/src/pages/Layout.jsx');
    const css = read('apps/web/src/index.css');

    expect(layout).toContain('Skip to main content');
    expect(layout).toContain('id="main-content"');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion: reduce');
  });

  it('shows recoverable error and unknown-page states', () => {
    const main = read('apps/web/src/main.jsx');
    const routes = read('apps/web/src/pages/index.jsx');
    const boundary = read('apps/web/src/components/AppErrorBoundary.jsx');

    expect(main).toContain('<AppErrorBoundary>');
    expect(boundary).toContain('Reload page');
    expect(boundary).toContain("source: 'react.error-boundary'");
    expect(routes).toContain('<Route path="*" element={<NotFound />} />');
  });

  it('loads page-level journeys on demand', () => {
    const routes = read('apps/web/src/pages/index.jsx');

    expect(routes).toContain("import { lazy, Suspense } from 'react'");
    expect(routes).toContain("const AdminDashboard = lazy(() => import('./AdminDashboard'))");
    expect(routes).toContain('<Suspense fallback={<PageLoading />}>');
  });

  it('does not show development-only availability warnings in the live layout', () => {
    const layout = read('apps/web/src/pages/Layout.jsx');

    expect(layout).not.toContain('DevelopmentDisclaimer');
  });

  it('keeps password recovery outside authenticated account layouts', () => {
    const layout = read('apps/web/src/pages/Layout.jsx');
    const entities = read('apps/web/src/api/entities.jsx');
    const resetPage = read('apps/web/src/pages/ResetPassword.jsx');

    expect(layout).toContain("'ForgotPassword'");
    expect(layout).toContain("'ResetPassword'");
    expect(layout).toContain('isStandalonePublicPage');
    expect(entities).toContain('await auth.signOut()');
    expect(entities).not.toContain('// Auto-login the user after a successful password reset');
    expect(resetPage).toContain('Please sign in again with your new password.');
  });

  it('provides an installable mobile web app with a safe offline fallback', () => {
    const html = read('apps/web/index.html');
    const manifest = JSON.parse(read('apps/web/public/app.webmanifest'));
    const serviceWorker = read('apps/web/public/service-worker.js');
    const main = read('apps/web/src/main.jsx');

    expect(html).toContain('rel="manifest"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('name="theme-color"');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some((icon) => icon.sizes === '192x192')).toBe(true);
    expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true);
    expect(serviceWorker).toContain("request.mode === 'navigate'");
    expect(serviceWorker).not.toContain("caches.put(request, response)");
    expect(main).toContain("navigator.serviceWorker.register('/service-worker.js')");
  });
});
