import { describe, expect, it } from 'vitest';

import { example } from './index';

describe('example', () => {
  it.each([
    ['  Hello   World  ', 'Hello World'],
    ['Hello\n\tWorld', 'Hello World'],
    ['  ', ''],
    ['', ''],
    ['Already normalized', 'Already normalized'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(example(input)).toBe(expected);
  });
});
