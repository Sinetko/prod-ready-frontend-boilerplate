import { gql } from '@apollo/client';
import { MockedProvider } from '@apollo/client/testing/react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { useApolloMutation } from './index';

afterEach(cleanup);

it('passes mutation variables through and returns the result', async () => {
  const mutation = gql`
    mutation Save($name: String!) {
      save(name: $name)
    }
  `;
  const mocks = [{ request: { query: mutation, variables: { name: 'World' } }, result: { data: { save: 'World' } } }];
  const { result } = renderHook(() => useApolloMutation(mutation), {
    wrapper: ({ children }) => <MockedProvider mocks={mocks}>{children}</MockedProvider>,
  });
  await act(async () => {
    const response = await result.current[0]({ variables: { name: 'World' } });
    expect(response.data).toEqual({ save: 'World' });
  });
  expect(result.current[1].data).toEqual({ save: 'World' });
});
