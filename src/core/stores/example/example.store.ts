import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { shallow } from 'zustand/shallow';
import { createWithEqualityFn } from 'zustand/traditional';

import type { ExampleStore } from './example.types';

export { shallow };

export const useExampleStore = createWithEqualityFn<ExampleStore>()(
  devtools(
    immer((set) => ({
      state: { count: 0 },
      actions: {
        increment: () =>
          set(
            (store) => {
              store.state.count += 1;
            },
            false,
            'example/increment'
          ),
        reset: () =>
          set(
            (store) => {
              store.state.count = 0;
            },
            false,
            'example/reset'
          ),
      },
    })),
    { name: 'example' }
  ),
  shallow
);
