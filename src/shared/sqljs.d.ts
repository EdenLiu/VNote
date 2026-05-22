declare module 'sql.js' {
  export interface Statement {
    step(): boolean;
    getAsObject(): Record<string, string | number | null>;
    free(): void;
  }

  export interface Database {
    run(sql: string, params?: unknown[]): void;
    prepare(sql: string, params?: unknown[]): Statement;
    export(): Uint8Array;
  }

  export interface SqlJsStatic {
    Database: new (data?: Buffer | Uint8Array) => Database;
  }

  export default function initSqlJs(options?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}
