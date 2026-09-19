import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import * as http from "http";
import { AddressInfo } from "net";
import {
  initialize,
  MidiClip,
  Handle,
  type ActivationContext,
} from "@ableton-extensions/sdk";

interface DialogResult {
  sampleRate: number;
}

// Lazily resolved once — the dialog tree sits alongside dist/extension.js in
// the installed .ablx, so __dirname/dialog/index.html is stable.
let _dialogTemplate: string | null = null;
function getDialogTemplate(): { html: string; dir: string } {
  const dir = path.join(__dirname, "dialog");
  if (_dialogTemplate === null) {
    _dialogTemplate = fsSync.readFileSync(
      path.join(dir, "index.html"),
      "utf-8",
    );
  }
  return { html: _dialogTemplate, dir };
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".map": "application/json; charset=utf-8",
};

interface DialogServer {
  url: string;
  setIndexHtml: (html: string) => void;
  close: () => Promise<void>;
}

// Bridge from the WebView dialog → Node console.* → ExtensionHost.txt.
// Edge WebView2 / WebKit don't expose devtools inside Live, so without this
// bridge any error in the dialog is effectively invisible.
function logFromDialog(level: string, parts: string[]): void {
  const msg = `[dialog ${level}] ${parts.join(" ")}`;
  if (level === "error") console.error(msg);
  else if (level === "warn") console.warn(msg);
  else console.log(msg);
}

// Tiny localhost HTTP server that serves the Vite-built dialog tree with the
// COOP/COEP headers SharedArrayBuffer requires. Ableton's webview blocks ES
// modules and AudioWorklet from file:// origins, so we serve over http://
// instead. The same server also accepts a single POST to
// `/result/<token>` that streams the rendered WAV directly to disk — this
// avoids shuttling a multi-hundred-MB base64 blob through the host IPC
// bridge when the dialog finishes rendering.
function startDialogServer(
  dialogDir: string,
  // sink: ResultSink,
): Promise<DialogServer> {
  return new Promise((resolve, reject) => {
    let resultConsumed = false;
    let indexHtml = "";
    const server = http.createServer(async (req, res) => {
      // SharedArrayBuffer / AudioWorklet need cross-origin isolation.
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      // Don't cache; each dialog session has a fresh injected index.html.
      res.setHeader("Cache-Control", "no-store");

      const rawPath = (req.url || "/").split("?")[0];

      if (req.method === "POST" && rawPath === "/log") {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c as Buffer));
        req.on("end", () => {
          try {
            const body = Buffer.concat(chunks).toString("utf-8");
            const payload = JSON.parse(body) as {
              level?: string;
              parts?: unknown[];
            };
            const level =
              typeof payload.level === "string" ? payload.level : "log";
            const parts = Array.isArray(payload.parts)
              ? payload.parts.map((p) =>
                  typeof p === "string" ? p : JSON.stringify(p),
                )
              : [];
            logFromDialog(level, parts);
          } catch (e) {
            console.warn("[pinch] malformed /log payload:", e);
          }
          res.writeHead(204);
          res.end();
        });
        req.on("error", () => {
          res.writeHead(400);
          res.end();
        });
        return;
      }

      // if (req.method === "POST" && rawPath === `/result/${sink.token}`) {
      //   if (resultConsumed) {
      //     res.writeHead(409);
      //     res.end("already consumed");
      //     return;
      //   }
      //   resultConsumed = true;
      //   const ws = fsSync.createWriteStream(sink.outPath);
      //   const cleanup = (err: Error) => {
      //     ws.destroy();
      //     void safeUnlink(sink.outPath);
      //     if (!res.headersSent) {
      //       res.writeHead(500);
      //       res.end(String(err.message ?? err));
      //     }
      //   };
      //   req.on("error", cleanup);
      //   ws.on("error", cleanup);
      //   ws.on("finish", () => {
      //     res.writeHead(204);
      //     res.end();
      //   });
      //   req.pipe(ws);
      //   return;
      // }

      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405);
        res.end("method not allowed");
        return;
      }

      if (rawPath === "/" || rawPath === "/index.html") {
        res.setHeader("Content-Type", MIME_TYPES[".html"]);
        res.end(indexHtml);
        return;
      }
      // Reject anything that escapes the dialog tree.
      const normalized = path
        .normalize(decodeURIComponent(rawPath))
        .replace(/^[\\/]+/, "");
      const filePath = path.join(dialogDir, normalized);
      if (
        !filePath.startsWith(dialogDir + path.sep) &&
        filePath !== dialogDir
      ) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      try {
        const data = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader(
          "Content-Type",
          MIME_TYPES[ext] ?? "application/octet-stream",
        );
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo | null;
      if (!addr) {
        reject(new Error("failed to bind dialog server"));
        return;
      }
      const url = `http://127.0.0.1:${addr.port}/`;
      resolve({
        url,
        setIndexHtml: (html: string) => {
          indexHtml = html;
        },
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

async function showErrorDialog(
  context: ReturnType<typeof initialize>,
  message: string,
): Promise<void> {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background: #c0c0c0;
  color: #000;
  display: flex; align-items: center; justify-content: center;
  height: 100vh; margin: 0; padding: 20px; box-sizing: border-box;
}
.card { max-width: 460px; text-align: center; }
h1 { font-size: 18px; margin: 0 0 10px; }
p { font-size: 14px; margin: 0; line-height: 1.4; }
</style>
</head>
<body>
  <div class="card">
    <h1>Pinch</h1>
    <p>${message.replace(/</g, "&lt;")}</p>
  </div>
</body>
</html>`;
  await context.ui.showModalDialog(
    `data:text/html,${encodeURIComponent(html)}`,
    440,
    170,
  );
}

function activate(activation: ActivationContext) {
  const context = initialize(activation, "1.0.0");

  context.commands.registerCommand("pinch.process", async (handle) => {
    try {
      const clip = context.getObjectFromHandle(handle as Handle, MidiClip);

      // 1. Patch the index.html template with the per-invocation data.
      const { html: template, dir: dialogDir } = getDialogTemplate();
      const inject = (hay: string, needle: string, value: string) =>
        hay.replace(needle, () => value);

      // jsonEsc: produces a JS string literal safe to drop into an inline
      // <script>. `JSON.stringify` doesn't escape `</script>` or U+2028/2029
      // line separators, so we patch those manually.
      const jsonEsc = (s: string) =>
        JSON.stringify(s)
          .replace(/<\//g, "<\\/")
          .replace(/\u2028/g, "\\u2028")
          .replace(/\u2029/g, "\\u2029");

      let html = template;
      html = inject(html, '"__CLIP_NAME__"', jsonEsc(clip.name));

      // Serve the dialog over http://localhost so the webview accepts ES modules etc

      const server = await startDialogServer(dialogDir);
      server.setIndexHtml(html);

      let resultJson: string;
      try {
        resultJson = await context.ui.showModalDialog(server.url, 840, 540);
      } finally {
        await server.close();
      }

      if (!resultJson) {
        // cancel
        return;
      }
      let result: DialogResult;
      try {
        result = JSON.parse(resultJson) as DialogResult;
      } catch {
        await showErrorDialog(context, "Dialog returned malformed result.");
        return;
      }

      // should now have a successfully parsed JSON result in 'result'
      console.log(`***** with`, result, JSON.stringify(result), `\n`);
    } catch (err) {
      console.error("[pinch] command failed:", err);
      const message =
        err instanceof Error
          ? `${err.message}\n${err.stack ?? ""}`
          : err === undefined
            ? "(unknown error — caught undefined)"
            : typeof err === "object"
              ? JSON.stringify(err, null, 2)
              : String(err);
      try {
        await showErrorDialog(context, message);
      } catch {
        /* ignore */
      }
    }
  });

  context.ui.registerContextMenuAction(
    "MidiClip",
    "Open Pinch",
    "pinch.process",
  );
}

module.exports = { activate };
