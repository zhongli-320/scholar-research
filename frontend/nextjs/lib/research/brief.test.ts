import { describe, expect, it } from 'vitest';
import { DEFAULT_BRIEF, startPayload } from './brief';

describe('research start payload', () => {
  it('carries the browser run id so a detached backend job can be recovered', () => {
    expect(startPayload('question', DEFAULT_BRIEF, 'run-123')).toMatchObject({
      task: 'question',
      research_id: 'run-123',
    });
  });
});
