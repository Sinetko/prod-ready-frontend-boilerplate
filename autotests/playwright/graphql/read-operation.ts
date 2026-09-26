import type { Request } from '@playwright/test';
import { getOperationAST, parse } from 'graphql';
import type { JsonObject } from '../types/mocking';

export function readOperation(request: Request): { name: string; variables: JsonObject } | undefined {
  try {
    const params = new URL(request.url()).searchParams;
    const body: unknown =
      request.method() === 'GET'
        ? {
            query: params.get('query'),
            operationName: params.get('operationName'),
            variables: JSON.parse(params.get('variables') ?? '{}'),
          }
        : request.method() === 'POST'
          ? request.postDataJSON()
          : undefined;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
    const payload = body as Record<string, unknown>;
    if (typeof payload.query !== 'string') return undefined;
    const name = payload.operationName;
    if (name != null && typeof name !== 'string') return undefined;
    const operation = getOperationAST(parse(payload.query), name);
    if (!operation?.name) return undefined;
    const variables = payload.variables ?? {};
    if (typeof variables !== 'object' || Array.isArray(variables)) return undefined;
    return { name: operation.name.value, variables: variables as JsonObject };
  } catch {
    return undefined;
  }
}
