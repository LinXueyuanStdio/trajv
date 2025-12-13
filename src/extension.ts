import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  const provider: vscode.CustomReadonlyEditorProvider = {
    openCustomDocument: async (uri: vscode.Uri) => {
      return { uri, dispose: () => {} };
    },
    resolveCustomEditor: async (document: vscode.CustomDocument, webviewPanel: vscode.WebviewPanel) => {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const docDir = path.dirname(document.uri.fsPath);
      const baseRoot = workspaceRoot || docDir;
      webviewPanel.webview.options = {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(baseRoot),
          vscode.Uri.file(docDir),
          vscode.Uri.file(path.join(context.extensionPath, 'media'))
        ]
      };

      webviewPanel.webview.html = initialShellHtml();

      const buildLoadMessage = async () => {
        const stat = await vscode.workspace.fs.stat(document.uri);
        return {
          type: 'loadUri',
          uri: document.uri.toString(),
          webviewUri: webviewPanel.webview.asWebviewUri(document.uri).toString(),
          name: path.basename(document.uri.fsPath),
          size: stat.size,
          mtime: stat.mtime
        };
      };

      let didSend = false;
      const sendLoad = async (force = false) => {
        if (didSend && !force) return;
        didSend = true;
        try {
          webviewPanel.webview.postMessage(await buildLoadMessage());
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          webviewPanel.webview.postMessage({ type: 'loadError', message });
        }
      };

      let t1: ReturnType<typeof setTimeout> | undefined;
      let t2: ReturnType<typeof setTimeout> | undefined;
      const clearLoadTimers = () => {
        if (t1) clearTimeout(t1);
        if (t2) clearTimeout(t2);
        t1 = undefined;
        t2 = undefined;
      };
      const startLoadTimers = () => {
        clearLoadTimers();
        // Fallback: if 'ready' is not received, try sending after the app shell is installed.
        t1 = setTimeout(() => sendLoad(), 1500);
        t2 = setTimeout(() => sendLoad(), 3000);
      };

      // Save requests from webview are ignored (readonly)
      webviewPanel.webview.onDidReceiveMessage(async (msg) => {
        if (msg?.type === 'ready') {
          clearLoadTimers();
          sendLoad();
          return;
        }
        if (msg?.type === 'requestReload') {
          await sendLoad(true);
        }
      });

      const bootstrapWebview = async () => {
        try {
          const html = await getHtmlForWebview(webviewPanel.webview, context, document.uri);
          webviewPanel.webview.html = html;
          startLoadTimers();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          webviewPanel.webview.html = basicHtml(`Failed to initialize TrajV: ${message}`);
        }
      };

      void bootstrapWebview();
    }
  };

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider('trajv.jsonlViewer', provider, { webviewOptions: { retainContextWhenHidden: true } })
  );
}

export function deactivate() {}

function initialShellHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <style>
    :root{color-scheme:dark;--bg:#1e1f22;--panel:#2a2d31;--border:#444c56;--text:#e6e6e6;--muted:#9aa0a6}
    body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
    header{height:48px;display:flex;align-items:center;gap:12px;padding:0 16px;background:var(--panel);border-bottom:1px solid var(--border)}
    h1{font-size:15px;margin:0;font-weight:600}
    .status{margin-left:auto;color:var(--muted);font-size:12px}
    main{padding:16px;color:var(--muted);font-size:13px}
  </style>
</head>
<body>
  <header><h1>Trajectory Browser</h1><div class="status">Preparing viewer...</div></header>
  <main>Loading interface...</main>
</body>
</html>`;
}

async function getHtmlForWebview(webview: vscode.Webview, context: vscode.ExtensionContext, _documentUri: vscode.Uri): Promise<string> {
  const templateRoot = path.join(context.extensionPath, 'media');
  const templatePath = path.join(templateRoot, 'template-index.html');
  let html: string;
  try {
    html = fs.readFileSync(templatePath, 'utf8');
  } catch {
    return basicHtml('Bundled TrajV template not found.');
  }

  // Inject CSP and boot script
  const nonce = getNonce();
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource} https:; font-src ${webview.cspSource} data:; connect-src ${webview.cspSource} https:;">`;
  // Pre-inject hide style to guarantee no flash of file controls in editor-open scenario
  const preHideCss = `<style id="vscode-hide-style">#fileArea, #trajectorySelect { display: none !important; }</style>`;

  const script = `
    <script nonce="${nonce}">
      const vscodeApi = window.__trajvVscodeApi || acquireVsCodeApi();
      window.__trajvVscodeApi = vscodeApi;
      // Notify extension when webview is ready to receive messages
      (function(){
        const postReady = () => { try { vscodeApi.postMessage({ type: 'ready' }); } catch(_){} };
        if (document.readyState === 'complete' || document.readyState === 'interactive') { postReady(); }
        else { window.addEventListener('DOMContentLoaded', postReady, { once: true }); }
      })();
    </script>`;

  // Ensure a root element exists for rendering
  if (!/id=["']jsonl-root["']/.test(html)) {
    html = html.replace(/<body([^>]*)>/i, (m, attrs) => `<body$1><div id="jsonl-root"></div>`);
  }

  // place CSP and script before closing head/body
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${csp}\n${preHideCss}\n</head>`);
  } else {
    html = html.replace('<html>', `<html><head>${csp}${preHideCss}</head>`);
  }
  if (html.includes('</body>')) {
    html = html.replace('</body>', `${script}\n</body>`);
  } else {
    html += script;
  }
  // Add nonce to all existing <script> tags to satisfy CSP
  html = html.replace(/<script(\s+[^>]*?)?>/gi, (m) => {
    if (/nonce\s*=/.test(m)) return m; // already has nonce
    if (m.endsWith('>')) {
      return m.slice(0, -1) + ` nonce="${nonce}">`;
    }
    return m;
  });
  html = rewriteLocalLinks(html, webview, templateRoot);
  return html;
}

function basicHtml(message?: string): string {
  const note = message ? `<div style="color:#888;font-size:12px;margin-bottom:8px;">${escapeHtml(message)}</div>` : '';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' 'self';"></head><body><div id="jsonl-root"></div>${note}</body></html>`;
}

function rewriteLocalLinks(html: string, webview: vscode.Webview, root: string): string {
  // Replace src/href attributes pointing to local files with webview URI
  return html.replace(/(src|href)=("|')([^"']+)(\2)/g, (match, attr, quote, url) => {
    if (/^(https?:|vscode-webview-resource:|data:|mailto:|#)/i.test(url)) return match;
    const abs = path.resolve(root, url);
    const onDisk = vscode.Uri.file(abs);
    const webUri = webview.asWebviewUri(onDisk).toString();
    return `${attr}=${quote}${webUri}${quote}`;
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getNonce() {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 16; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
