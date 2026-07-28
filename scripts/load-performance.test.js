const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const extensionTs = fs.readFileSync(path.join(root, 'src', 'extension.ts'), 'utf8');
const templateHtml = fs.readFileSync(path.join(root, 'media', 'template-index.html'), 'utf8');
const rootIndexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const firstStyleBlock = (html) => html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1] || '';

test('VS Code custom editor streams by webview URI instead of posting full content', () => {
  assert.match(extensionTs, /stat\(document\.uri\)/);
  assert.match(extensionTs, /asWebviewUri\(document\.uri\)/);
  assert.match(extensionTs, /type:\s*'loadUri'/);
  assert.doesNotMatch(extensionTs, /content:\s*text/);
});

test('VS Code custom editor paints an initial shell before async bootstrap', () => {
  assert.match(extensionTs, /function\s+initialShellHtml/);
  assert.match(extensionTs, /webviewPanel\.webview\.html\s*=\s*initialShellHtml\(\)/);
  assert.match(extensionTs, /void\s+bootstrapWebview\(\)/);

  const resolveBody = extensionTs.match(/resolveCustomEditor:[\s\S]*?const bootstrapWebview = async \(\) =>/)?.[0] || '';
  assert.doesNotMatch(resolveBody, /await\s+getHtmlForWebview/);
});

test('VS Code custom editor always uses bundled template, not workspace index.html', () => {
  assert.match(extensionTs, /const templateRoot = path\.join\(context\.extensionPath,\s*'media'\)/);
  assert.match(extensionTs, /const templatePath = path\.join\(templateRoot,\s*'template-index\.html'\)/);
  assert.match(extensionTs, /readFileSync\(templatePath/);
  assert.doesNotMatch(extensionTs, /readFileSync\(indexPath/);
  assert.doesNotMatch(extensionTs, /existsSync\(indexPath\)/);
  assert.doesNotMatch(extensionTs, /path\.join\(baseRoot,\s*'index\.html'\)/);
});

test('bundled VS Code template hides upload controls while plain index keeps them visible', () => {
  assert.match(firstStyleBlock(templateHtml), /#fileArea,\s*#trajectorySelect\s*\{\s*display:\s*none\s*!important/);
  assert.doesNotMatch(firstStyleBlock(rootIndexHtml), /#fileArea,\s*#trajectorySelect\s*\{\s*display:\s*none\s*!important/);
  assert.match(extensionTs, /const preHideCss = `<style id="vscode-hide-style">#fileArea, #trajectorySelect \{ display: none !important; \}<\/style>`/);
});

test('plain index keeps the original flexible header spacer design', () => {
  assert.match(firstStyleBlock(rootIndexHtml), /\.grow\{flex:1 1 auto;\}/);
  assert.match(firstStyleBlock(templateHtml), /\.grow\{display:none;\}/);
});

test('HTML template exposes visible load progress and interruptible parsing', () => {
  assert.match(templateHtml, /id="loadProgress"/);
  assert.match(templateHtml, /id="loadProgressBar"/);
  assert.match(templateHtml, /function\s+formatBytes/);
  assert.match(templateHtml, /function\s+abortActiveLoad/);
  assert.match(templateHtml, /AbortController/);
  assert.match(templateHtml, /throwIfAborted/);
});

test('VS Code message handler delegates to async loaders without synchronous content parsing', () => {
  assert.match(templateHtml, /async function\s+loadFileFromWebviewUri/);
  assert.match(templateHtml, /async function\s+loadInjectedContent/);
  assert.match(templateHtml, /function\s+waitForInitialPaint/);
  assert.match(templateHtml, /msg\.type === 'loadUri'/);
  assert.doesNotMatch(templateHtml, /parseJSONL\(content\)/);
});

test('completed loads hide progress and show filename with file size', () => {
  assert.match(templateHtml, /function\s+formatLoadedFileLabel/);
  assert.match(templateHtml, /function\s+setLoadedFileStatus/);
  assert.match(templateHtml, /statusEl\.title\s*=\s*fullPath\|\|label/);

  const completeLoadProgress = templateHtml.match(/function\s+completeLoadProgress[\s\S]*?\n  \}/)?.[0] || '';
  assert.match(completeLoadProgress, /hideLoadProgress\(\)/);
  assert.match(completeLoadProgress, /setLoadedFileStatus\(label,totalBytes,fullPath\)/);
  assert.doesNotMatch(completeLoadProgress, /showLoadProgress\(/);
});

test('right header status and progress stay in one anchored container', () => {
  assert.match(templateHtml, /class="header-right"/);
  assert.match(templateHtml, /\.grow\{display:none/);
  assert.match(templateHtml, /\.header-right\{[^}]*margin-left:auto/);
  assert.match(templateHtml, /\.header-right\{[^}]*justify-content:flex-end/);
  assert.match(templateHtml, /\.header-right\{[^}]*max-width:none/);
  assert.match(templateHtml, /<div class="header-right">\s*<div class="status" id="status">/);
});
