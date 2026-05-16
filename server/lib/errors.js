/**
 * Error subclass for user-facing messages that should be returned
 * as JSON { error: message } with the given HTTP status code.
 */
export class UserFacingError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'UserFacingError';
    this.statusCode = statusCode;
  }
}
