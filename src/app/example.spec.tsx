import type { ComponentProps, ReactNode } from 'react';

import { ApolloClient, ApolloLink, InMemoryCache } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import { buildSchema, concatAST, parse, validate } from 'graphql';
import { exampleFragment } from 'graphql/fragments/example.fragment';
import { BootstrapDocument } from 'graphql/graphql-api-types';
import { useApolloLazyQuery } from 'graphql/hooks/use-apollo-lazy-query';
import { useApolloQuery } from 'graphql/hooks/use-apollo-query';

import ExampleProvider, { useExampleContext } from 'core/contexts/example';
import type { ExampleContextValue, ExampleProviderProps } from 'core/contexts/example';
import { shallow, useExampleStore } from 'core/stores/example';
import type { ExampleStore } from 'core/stores/example';

import { ExamplePage } from 'features/example/pages/example';

import { i18n, i18nReady } from 'bootstrap/i18n';

beforeEach(async () => {
  await i18nReady;
  useExampleStore.getState().actions.reset();
});

afterEach(() => {
  cleanup();
  useExampleStore.getState().actions.reset();
});

describe('canonical examples', () => {
  it('exports the provider, consumer, and store types through their barrels', () => {
    expectTypeOf<ExampleProviderProps>().toEqualTypeOf<ComponentProps<typeof ExampleProvider>>();
    expectTypeOf<ExampleContextValue>().toEqualTypeOf<ReturnType<typeof useExampleContext>>();
    expectTypeOf<ExampleStore>().toEqualTypeOf<ReturnType<typeof useExampleStore.getState>>();
  });

  it('consumes generated documents through both project Apollo wrappers', async () => {
    const client = new ApolloClient({ cache: new InMemoryCache(), link: ApolloLink.empty() });
    client.writeQuery({ query: BootstrapDocument, variables: { name: 'World' }, data: { hello: 'Hello, World!' } });

    const Wrapper = ({ children }: { children: ReactNode }) => {
      return <ApolloProvider client={client}>{children}</ApolloProvider>;
    };

    const query = renderHook(() => useApolloQuery(BootstrapDocument, { variables: { name: 'World' } }), {
      wrapper: Wrapper,
    });
    const lazy = renderHook(() => useApolloLazyQuery(BootstrapDocument), { wrapper: Wrapper });

    try {
      expect(query.result.current.data?.hello).toBe('Hello, World!');
      expect(lazy.result.current[1].called).toBe(false);
      await act(async () => {
        await lazy.result.current[0]({ variables: { name: 'World' } });
      });
      expect(lazy.result.current[1].data?.hello).toBe('Hello, World!');
    } finally {
      query.unmount();
      lazy.unmount();
      client.stop();
    }
  });

  it('renders translations and connects the context, utility, store, and toggle hook', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ExampleProvider label="  Example   Reader  ">
          <ExamplePage />
        </ExampleProvider>
      </I18nextProvider>
    );

    expect(screen.getByRole('heading', { name: 'Example' })).toBeDefined();
    expect(screen.getByText('Hello, Example Reader!')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Increment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increment' }));
    expect(screen.getByText('Count: 2')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText('Count: 0')).toBeDefined();

    const details = document.getElementById('example-details');
    expect(details?.hidden).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
    expect(details?.hidden).toBe(false);
    expect(screen.getByRole('button', { name: 'Hide details' }).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Hide details' }));
    expect(details?.hidden).toBe(true);
  });

  it('requires the context provider and propagates changed provider values', () => {
    expect(() => renderHook(() => useExampleContext())).toThrow(
      'useExampleContext must be used within ExampleProvider.'
    );

    const Consumer = () => {
      const { label } = useExampleContext();
      return <span>{label}</span>;
    };

    const { rerender } = render(
      <ExampleProvider label="First">
        <Consumer />
      </ExampleProvider>
    );
    expect(screen.getByText('First')).toBeDefined();
    rerender(
      <ExampleProvider label="Second">
        <Consumer />
      </ExampleProvider>
    );
    expect(screen.getByText('Second')).toBeDefined();
  });

  it('updates store state immutably and preserves action identities', () => {
    const previous = useExampleStore.getState();
    previous.actions.increment();
    const current = useExampleStore.getState();

    expect(previous.state.count).toBe(0);
    expect(current.state.count).toBe(1);
    expect(current.actions).toBe(previous.actions);
    expect(shallow({ count: 1 }, { count: current.state.count })).toBe(true);
  });

  it('validates the flat fragment against the bootstrap schema', () => {
    const schema = buildSchema(readFileSync('schema.graphql', 'utf8'));
    const document = concatAST([parse('query ExampleVerification { ...Example }'), exampleFragment]);

    expect(validate(schema, document)).toEqual([]);
  });
});
