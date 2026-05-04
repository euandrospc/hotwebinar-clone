export type RequestLike = {
  url(): string;
  method(): string;
  resourceType(): string;
  headers(): Record<string, string>;
  postData(): string | null;
};

export type ResponseLike = {
  request(): RequestLike;
  status(): number;
  headers(): Record<string, string>;
  body(): Promise<Buffer>;
};

export type Captured = {
  url: string;
  method: string;
  status: number;
  resourceType: string;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  responseHeaders: Record<string, string>;
  responseBody: string | null;
  timing: number;
  truncated: boolean;
};

export type CaptureOptions = {
  startedAt: number;
  now: () => number;
  bodyMaxChars: number;
};

const BINARY_TYPES = [
  "video/",
  "image/",
  "font/",
  "audio/",
  "application/octet-stream",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/wasm",
  "application/vnd.ms-",
  "application/vnd.openxmlformats-",
];

function isBinary(contentType: string | undefined): boolean {
  if (!contentType) return false;
  const lower = contentType.toLowerCase();
  return BINARY_TYPES.some((p) => lower.startsWith(p));
}

export async function capturedFromResponse(resp: ResponseLike, opts: CaptureOptions): Promise<Captured> {
  const req = resp.request();
  const responseHeaders = resp.headers();
  let body: string | null = null;
  let truncated = false;

  if (!isBinary(responseHeaders["content-type"])) {
    try {
      const buf = await resp.body();
      const str = buf.toString("utf8");
      if (str.length > opts.bodyMaxChars) {
        body = str.slice(0, opts.bodyMaxChars);
        truncated = true;
      } else {
        body = str;
      }
    } catch {
      body = null;
    }
  }

  return {
    url: req.url(),
    method: req.method(),
    status: resp.status(),
    resourceType: req.resourceType(),
    requestHeaders: req.headers(),
    requestBody: req.postData(),
    responseHeaders,
    responseBody: body,
    timing: opts.now() - opts.startedAt,
    truncated,
  };
}

