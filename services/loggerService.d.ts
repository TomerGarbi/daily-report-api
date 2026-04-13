declare class LoggerService {
    private log;
    info(message: string, context?: string, meta?: Record<string, unknown>, user?: string): void;
    warn(message: string, context?: string, meta?: Record<string, unknown>, user?: string): void;
    error(message: string, context?: string, meta?: Record<string, unknown>, user?: string): void;
    debug(message: string, context?: string, meta?: Record<string, unknown>, user?: string): void;
}
export declare const logger: LoggerService;
export {};
//# sourceMappingURL=loggerService.d.ts.map