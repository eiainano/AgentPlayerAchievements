export interface McpErrorResult {
  content: { type: 'text'; text: string }[];
  isError: true;
  [key: string]: unknown;
}

export function formatMcpError(code: string, message: string): McpErrorResult {
  return {
    content: [{ type: 'text', text: `[${code}] ${message}` }],
    isError: true,
  };
}

export const ErrorCodes = {
  ENGINE_NOT_INIT: 'ENGINE_NOT_INIT',
  INVALID_EVENT: 'INVALID_EVENT',
  STORE_ERROR: 'STORE_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  UNKNOWN_ACTION: 'UNKNOWN_ACTION',
  NOT_FOUND: 'NOT_FOUND',
} as const;
