import http from "node:http";
import type { AddressInfo } from "node:net";

const SIDEBAR = `
<aside>
  <a href="/dashboard">Dashboard</a>
  <a href="/webinars">Webinars</a>
  <a href="/leads">Leads</a>
  <a href="/settings">Settings</a>
  <a href="/dashboard">Dashboard (dup)</a>
</aside>
`;

function page(title: string): string {
  return `<!doctype html><html><head><title>${title}</title></head><body>${SIDEBAR}<main><h1>${title}</h1></main></body></html>`;
}

const ROUTES: Record<string, string> = {
  "/dashboard": page("Dashboard"),
  "/webinars": page("Webinars"),
  "/leads": page("Leads"),
  "/settings": page("Settings"),
};

export type FixtureServer = { url: string; close: () => Promise<void> };

export function startFixtureServer(): Promise<FixtureServer> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? "/";
      const body = ROUTES[url];
      if (!body) {
        res.writeHead(404, { "content-type": "text/html" });
        res.end("not found");
        return;
      }
      res.writeHead(200, { "content-type": "text/html" });
      res.end(body);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      const url = `http://127.0.0.1:${addr.port}`;
      resolve({
        url,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}
