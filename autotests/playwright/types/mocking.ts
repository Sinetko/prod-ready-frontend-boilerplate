import type { Request } from '@playwright/test';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface MockResponse<TBody extends JsonValue = JsonValue> {
  body: TBody;
  status?: number;
  headers?: Record<string, string>;
}

export interface MockDefinition {
  name: string;
  matches: (request: Request) => boolean;
  response: MockResponse;
}

export interface RestMockOptions<TBody extends JsonValue> extends MockResponse<TBody> {
  method: string;
  path: string;
}

export interface GraphqlMockOptions<TData extends JsonValue> extends MockResponse<{
  data?: TData;
  errors?: { message: string }[];
}> {
  endpoint: string;
  operation: string;
  variables?: JsonObject;
}
