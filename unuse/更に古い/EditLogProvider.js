"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditLogProvider = exports.fileStats = void 0;
exports.countChars = countChars;
exports.fileStats = {};
function countChars(text) {
    return Array.from(text).filter(ch => !/\s/.test(ch)).length;
}
class EditLogProvider {
    context;
    _view;
    activeFile;
    constructor(context) {
        this.context = context;
    }
    resolveWebviewView(webviewView) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        // 初期表示
        this._view.webview.html = this.getHtml([]);
    }
    setActiveFile(filePath) {
        this.activeFile = filePath;
        this.update();
    }
    update() {
        if (!this._view)
            return;
        if (!this.activeFile || !exports.fileStats[this.activeFile]) {
            this._view.webview.html = this.getHtml([]);
            return;
        }
        const stats = exports.fileStats[this.activeFile];
        const sortedHistory = [...stats.history].sort((a, b) => b.date.localeCompare(a.date));
        this._view.webview.html = this.getHtml(sortedHistory);
    }
    getHtml(history) {
        const listItems = history
            .map(h => `<li>${h.date} | Edited: ${h.editedCount} | Chars: ${h.charCount}</li>`)
            .join('');
        return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: sans-serif; margin: 0; padding: 8px; }
    ul { padding-left: 0; list-style: none; margin: 0; }
    li { margin: 2px 0; }
  </style>
</head>
<body>
  <ul>
    ${listItems || '<li>No data available.</li>'}
  </ul>
</body>
</html>`;
    }
}
exports.EditLogProvider = EditLogProvider;
//# sourceMappingURL=EditLogProvider.js.map