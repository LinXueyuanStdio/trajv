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

      const html = await getHtmlForWebview(webviewPanel.webview, context, document.uri);
      webviewPanel.webview.html = html;

      // Prepare file content; send only after webview signals ready to avoid race conditions
      const fileContent = await vscode.workspace.fs.readFile(document.uri);
      const text = new TextDecoder().decode(fileContent);

      let didSend = false;
      const sendLoad = () => {
        if (didSend) return;
        didSend = true;
        webviewPanel.webview.postMessage({ type: 'load', uri: document.uri.toString(), content: text });
      };

      // Fallback: if 'ready' not received within 1500ms, try sending anyway; also retry once later
      const t1 = setTimeout(() => sendLoad(), 1500);
      const t2 = setTimeout(() => sendLoad(), 3000);

      // Save requests from webview are ignored (readonly)
      webviewPanel.webview.onDidReceiveMessage(async (msg) => {
        if (msg?.type === 'ready') {
          clearTimeout(t1); clearTimeout(t2);
          sendLoad();
          return;
        }
        if (msg?.type === 'requestReload') {
          const data = await vscode.workspace.fs.readFile(document.uri);
          webviewPanel.webview.postMessage({ type: 'load', uri: document.uri.toString(), content: new TextDecoder().decode(data) });
        }
      });
    }
  };

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider('trajv.jsonlViewer', provider, { webviewOptions: { retainContextWhenHidden: true } })
  );
}

export function deactivate() {}

async function getHtmlForWebview(webview: vscode.Webview, context: vscode.ExtensionContext, documentUri: vscode.Uri): Promise<string> {
  // Use workspace root or document directory as base for index.html
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const docDir = path.dirname(documentUri.fsPath);
  const baseRoot = workspaceFolder || docDir;
  const indexPath = path.join(baseRoot, 'index.html');
  let html = '';
  try {
    html = fs.readFileSync(indexPath, 'utf8');
  } catch (e) {
    // Fallback to bundled template
    const bundled = path.join(context.extensionPath, 'media', 'template-index.html');
    try {
      html = fs.readFileSync(bundled, 'utf8');
    } catch {
      return basicHtml();
    }
  }

  // Inject CSP and boot script
  const nonce = getNonce();
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource} https:; font-src ${webview.cspSource} data:; connect-src ${webview.cspSource} https:;">`;
  // Pre-inject hide style to guarantee no flash of file controls in editor-open scenario
  const preHideCss = `<style id="vscode-hide-style">#fileArea, #trajectorySelect { display: none !important; }</style>`;

  const script = `
    <script nonce="${nonce}">
      const vscodeApi = acquireVsCodeApi();
      // Notify extension when webview is ready to receive messages
      (function(){
        const postReady = () => { try { vscodeApi.postMessage({ type: 'ready' }); } catch(_){} };
        if (document.readyState === 'complete' || document.readyState === 'interactive') { postReady(); }
        else { window.addEventListener('DOMContentLoaded', postReady, { once: true }); }
      })();
      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (msg?.type === 'load') {
          const content = msg.content || '';
          try {
            // Force hide file controls via an injected style to prevent re-show
            (function(){
              try{
                if(!document.getElementById('vscode-hide-style')){
                  const st = document.createElement('style');
                  st.id = 'vscode-hide-style';
                  st.textContent = '#fileArea, #trajectorySelect { display: none !important; }';
                  document.head.appendChild(st);
                }
              }catch(e){}
            })();
            // Prefer rich template pipeline when available
            const hideEl = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };
            const getFileName = () => {
              try { const u = new URL(msg.uri); const p = u.pathname || ''; const n = decodeURIComponent(p.split('/').pop() || 'Active Document'); return n || 'Active Document'; } catch { return 'Active Document'; }
            };
            if (typeof parseJSONL === 'function') {
              try {
                if (typeof enterCompact === 'function') enterCompact();
                hideEl('fileArea');
                hideEl('trajectorySelect');
                const parsed = parseJSONL(content);
                const name = getFileName();
                try {
                  // Use global state/refresh if present
                  if (typeof state !== 'undefined' && state && state.files && typeof state.files.set === 'function' && typeof refreshFileSelect === 'function') {
                    state.files.clear();
                    state.files.set(name, { steps: parsed.steps || [], rawLines: parsed.rawLines || [], mtime: Date.now() });
                    state.currentFile = name;
                    state.currentIndex = 0;
                    refreshFileSelect();
                    // Update status text to loaded filename
                    try { const st = document.getElementById('status'); if (st) { st.textContent = name; st.style.display = ''; } } catch(_){ }
                    return; // done
                  }
                } catch {}
              } catch (err) {
                console.error('Template load failed, fallback to plain view', err);
              }
            }
            // Fallback: simple plain text view
            const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
            const container = document.getElementById('jsonl-root') || document.body;
            container.innerHTML = '';
            const pre = document.createElement('pre');
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.wordBreak = 'break-word';
            pre.textContent = lines.map((l, i) => '[' + (i+1) + '] ' + l).join('\\n');
            container.appendChild(pre);
          } catch (err) {
            console.error(err);
          }
        }
      });
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
  // Rewrite local resource URLs to webview URIs if there are src/href to local files
  // If using bundled template, treat its folder as root for resource rewriting
  const usedRoot = fs.existsSync(indexPath) ? baseRoot : path.join(context.extensionPath, 'media');
  html = rewriteLocalLinks(html, webview, usedRoot);
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
