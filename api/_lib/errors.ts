/** HTTP-level error carrying a status code. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Error returned by the GitHub REST API. */
export class GhError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'GhError';
  }
}

export function errorStatus(e: unknown): number {
  if (e instanceof HttpError) return e.status;
  if (e instanceof GhError) return e.status === 404 ? 404 : 502;
  return 500;
}
