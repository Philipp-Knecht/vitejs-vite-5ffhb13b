import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { createQueryClient } from './api/queries';
import { App } from './App';
import { STATIC_PAGE_META, type PageMeta } from './seo/pages';

export { STATIC_PAGES } from '@kaufcheck/shared';

/** Renders a static page to HTML for prerendering (build time only). */
export function render(path: string): { html: string; meta: PageMeta } {
  const meta = STATIC_PAGE_META[path];
  if (!meta) throw new Error(`No metadata for static page ${path}`);
  const html = renderToString(
    <StrictMode>
      <StaticRouter location={path}>
        <App queryClient={createQueryClient()} />
      </StaticRouter>
    </StrictMode>,
  );
  return { html, meta };
}
