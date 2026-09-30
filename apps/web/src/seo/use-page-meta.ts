import { useEffect } from 'react';
import type { PageMeta } from './pages';

function setMeta(name: string, content: string | null): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (content === null) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement('meta');
    element.name = name;
    document.head.append(element);
  }
  element.content = content;
}

/**
 * Keeps title, description and robots directives in sync on client-side
 * navigation. Prerendered pages already contain the same tags.
 */
export function usePageMeta(meta: PageMeta): void {
  const { title, description, noindex } = meta;
  useEffect(() => {
    document.title = title;
    setMeta('description', description);
    setMeta('robots', noindex ? 'noindex' : null);
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) {
      if (noindex) canonical.remove();
      else canonical.href = `${window.location.origin}${window.location.pathname}`;
    }
  }, [title, description, noindex]);
}
