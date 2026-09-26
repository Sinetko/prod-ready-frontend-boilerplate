import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useExample } from './index';

afterEach(cleanup);

describe('useExample', () => {
  it('starts disabled and toggles using the latest state', () => {
    const { result } = renderHook(() => useExample());

    expect(result.current.enabled).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(true);
    act(() => {
      result.current.toggle();
      result.current.toggle();
    });
    expect(result.current.enabled).toBe(true);
  });

  it('resets to the current configured initial value', () => {
    const { result, rerender } = renderHook((initialEnabled) => useExample({ initialEnabled }), {
      initialProps: true,
    });

    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(false);
    act(() => result.current.reset());
    expect(result.current.enabled).toBe(true);
    rerender(false);
    act(() => result.current.reset());
    expect(result.current.enabled).toBe(false);
  });
});
