import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import LiteratureHome from './LiteratureHome';
import { recent, sources } from '../mocks/_data/paperseek';

vi.stubGlobal('React', React);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe('literature home preview', () => {
  it('shows one recent search and disables real submission', () => {
    const html = renderToStaticMarkup(React.createElement(LiteratureHome, { mockData: { sources, recent } }));
    expect(html.match(/人工智能与科学研究/g)).toHaveLength(1);
    expect(html).not.toContain('下一步');
    expect(html).toMatch(/<button type="submit"[^>]*disabled/);
    expect(html).toContain('预览模式');
  });
});
