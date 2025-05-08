// Type definitions for next/server
declare module 'next/server' {
  export interface NextRequest extends Request {
    nextUrl: URL;
  }
  
  export interface NextResponse extends Response {
    cookies: {
      get(name: string): { name: string; value: string } | undefined;
      getAll(): { name: string; value: string }[];
      set(name: string, value: string, options?: { path?: string; maxAge?: number }): void;
      delete(name: string): void;
    };
  }
  
  export function NextResponse(): NextResponse;
  export namespace NextResponse {
    function json(body: any, init?: ResponseInit): NextResponse;
    function redirect(url: string | URL, init?: number | ResponseInit): NextResponse;
    function rewrite(destination: string | URL, init?: number | ResponseInit): NextResponse;
    function next(init?: ResponseInit): NextResponse;
  }
} 