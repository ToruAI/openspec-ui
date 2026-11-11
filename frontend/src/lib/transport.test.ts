import { describe, it, expect } from 'vitest';
import { errorMessage } from './transport';

describe('errorMessage', () => {
  it('uses the error field of a JSON body', () => {
    expect(errorMessage(400, '{"error":"Failed to delete idea: Invalid idea id"}')).toBe(
      'Failed to delete idea: Invalid idea id',
    );
  });

  it('uses a plain-text body, such as the server refusing a request', () => {
    expect(errorMessage(403, 'openspec-ui refused this change.\n')).toBe('openspec-ui refused this change.');
  });

  it('falls back to the status for empty or HTML bodies', () => {
    expect(errorMessage(404, '')).toBe('HTTP 404');
    expect(errorMessage(502, '<html>Bad gateway</html>')).toBe('HTTP 502');
    expect(errorMessage(500, '{"other":1}')).toBe('{"other":1}');
  });
});
