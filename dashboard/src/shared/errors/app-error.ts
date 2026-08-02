// dashboard/src/shared/errors/app-error.ts

export interface ErrorDetails {
  code: string;
  message: string;
  statusCode: number;
  context?: Record<string, any>;
  correlationId?: string;
  recoverySuggestion?: string;
}

export class AppError extends Error implements ErrorDetails {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context?: Record<string, any>;
  public readonly correlationId?: string;
  public readonly recoverySuggestion?: string;

  constructor(details: ErrorDetails) {
    super(details.message);
    this.name = this.constructor.name;
    this.code = details.code;
    this.statusCode = details.statusCode;
    this.context = details.context;
    this.correlationId = details.correlationId;
    this.recoverySuggestion = details.recoverySuggestion;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', context?: Record<string, any>) {
    super({
      code: 'AUTHENTICATION_ERROR',
      statusCode: 401,
      message,
      context,
      recoverySuggestion: 'Please log in again to refresh your session cookie.',
    });
  }
}

export class PermissionError extends AppError {
  constructor(message = 'Permission denied', context?: Record<string, any>) {
    super({
      code: 'PERMISSION_ERROR',
      statusCode: 403,
      message,
      context,
      recoverySuggestion: 'Verify your account permissions or connected account scopes.',
    });
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request parameters', context?: Record<string, any>) {
    super({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message,
      context,
      recoverySuggestion: 'Check request payload parameters against schema.',
    });
  }
}

export class GraphApiError extends AppError {
  constructor(message = 'Meta Graph API error', context?: Record<string, any>) {
    super({
      code: 'GRAPH_API_ERROR',
      statusCode: 502,
      message,
      context,
      recoverySuggestion: 'Check access token validity or rate limits.',
    });
  }
}

export class AutomationError extends AppError {
  constructor(message = 'Automation workflow error', context?: Record<string, any>) {
    super({
      code: 'AUTOMATION_ERROR',
      statusCode: 500,
      message,
      context,
    });
  }
}

export class ConfigurationError extends AppError {
  constructor(message = 'Invalid system configuration', context?: Record<string, any>) {
    super({
      code: 'CONFIGURATION_ERROR',
      statusCode: 500,
      message,
      context,
      recoverySuggestion: 'Check meta_config table or environment variables.',
    });
  }
}
