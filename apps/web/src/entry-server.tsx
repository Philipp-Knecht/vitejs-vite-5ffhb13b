import { ALL_KNOWLEDGE } from '@kaufcheck/catalog/knowledge-eager';
import { STATIC_PAGES as ROUTES } from '@kaufcheck/shared';
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { createQueryClient } from './api/queries';
import { App } from './App';
import { ADVISOR_AVAILABLE, MODEL_PAGES_AVAILABLE } from './features/advisor/availability';
import { PreloadedModelContext } from './features/models/preloaded';
import { modelPageMeta } from './seo/model-meta';
import { STATIC_PAGE_META, type PageMeta } from './seo/pages';

/** Pages that depend on researched models stay out of search engines until there are enough. */
export const STATIC_PAGES = ROUTES.map((page) => {
  if (page.path === '/auto-berater') return { ...page, indexable: ADVISOR_AVAILABLE };
  if (page.path === '/modelle') return { ...page, indexable: MODEL_PAGES_AVAILABLE };
  return page;
});

/** One prerendered, indexable page per researched model. */
export const MODEL_PAGES = ALL_KNOWLEDGE.map((model) => ({
  path: `/modelle/${model.id}`,
  indexable: true,
  name: `${model.make} ${model.model}`,
}));

/**
 * Renders a static page to HTML for prerendering (build time only). Model
 * pages also return their data, which the page embeds for hydration.
 */
export function render(path: string): { html: string; meta: PageMeta; data: unknown } {
  const model = ALL_KNOWLEDGE.find((item) => `/modelle/${item.id}` === path) ?? null;
  const meta = model ? modelPageMeta(model) : STATIC_PAGE_META[path];
  if (!meta) throw new Error(`No metadata for static page ${path}`);
  const html = renderToString(
    <StrictMode>
      <PreloadedModelContext.Provider value={model}>
        <StaticRouter location={path}>
          <App queryClient={createQueryClient()} />
        </StaticRouter>
      </PreloadedModelContext.Provider>
    </StrictMode>,
  );
  return { html, meta, data: model };
}
