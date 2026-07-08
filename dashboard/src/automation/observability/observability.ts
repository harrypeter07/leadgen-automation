export interface StructuredLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context: Record<string, any>;
}

export interface Metric {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: Date;
}

export interface AuditRecord {
  id: string;
  workspaceId: string;
  userId: string;
  action: string;
  resource: string;
  timestamp: Date;
  meta: Record<string, any>;
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  attributes: Record<string, string>;
}

export interface ObservabilityManager {
  log(level: 'info' | 'warn' | 'error' | 'debug', msg: string, ctx?: Record<string, any>): void;
  recordMetric(name: string, val: number, tags?: Record<string, string>): void;
  recordAudit(record: Omit<AuditRecord, 'id' | 'timestamp'>): Promise<void>;
  startSpan(name: string, parentTraceId?: string): TraceSpan;
  endSpan(span: TraceSpan): void;
}

export class AppObservabilityService implements ObservabilityManager {
  private static instance: AppObservabilityService;

  private constructor() {}

  public static getInstance(): AppObservabilityService {
    if (!AppObservabilityService.instance) {
      AppObservabilityService.instance = new AppObservabilityService();
    }
    return AppObservabilityService.instance;
  }

  public log(level: 'info' | 'warn' | 'error' | 'debug', msg: string, ctx: Record<string, any> = {}): void {
    const log: StructuredLog = {
      timestamp: new Date(),
      level,
      message: msg,
      context: ctx
    };
    console.log(`[StructuredLog] [${log.level.toUpperCase()}] ${log.message}`, JSON.stringify(log.context));
  }

  public recordMetric(name: string, val: number, tags: Record<string, string> = {}): void {
    const metric: Metric = {
      name,
      value: val,
      tags,
      timestamp: new Date()
    };
    console.log(`[Metric] ${metric.name}: ${metric.value}`, JSON.stringify(metric.tags));
  }

  public async recordAudit(record: Omit<AuditRecord, 'id' | 'timestamp'>): Promise<void> {
    const audit: AuditRecord = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      ...record
    };
    console.log(`[AuditTrail] User ${audit.userId} performed "${audit.action}" on resource "${audit.resource}"`);
  }

  public startSpan(name: string, parentTraceId?: string): TraceSpan {
    return {
      traceId: parentTraceId || Math.random().toString(36).substring(7),
      spanId: Math.random().toString(36).substring(7),
      name,
      startTime: new Date(),
      attributes: {}
    };
  }

  public endSpan(span: TraceSpan): void {
    span.endTime = new Date();
    const duration = span.endTime.getTime() - span.startTime.getTime();
    console.log(`[TraceSpan] Span "${span.name}" finished in ${duration}ms (Trace ID: ${span.traceId})`);
  }
}
