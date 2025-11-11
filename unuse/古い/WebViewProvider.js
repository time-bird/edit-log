"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebViewProvider = void 0;
exports.countChars = countChars;
const vscode = __importStar(require("vscode"));
// 空白・改行・タブを除いた文字数をカウント
function countChars(text) {
    return Array.from(text).filter(ch => !/\s/.test(ch)).length;
}
class WebViewProvider {
    context;
    _view;
    activeFile;
    fileStats = {};
    updateTimeout;
    UPDATE_INTERVAL = 800; // 確定後に更新する間隔(ms)
    constructor(context) {
        this.context = context;
        const stored = this.context.globalState.get('fileStats');
        if (stored)
            this.fileStats = stored;
        // アクティブエディタ変更時に自動で更新
        vscode.window.onDidChangeActiveTextEditor(() => {
            this.activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
            this.updateActiveFileStats();
            this.update();
        });
        // 編集イベント
        vscode.workspace.onDidChangeTextDocument(event => {
            if (this.activeFile && event.document.uri.fsPath === this.activeFile) {
                this.scheduleUpdate();
            }
        });
    }
    resolveWebviewView(webviewView) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        this.update();
    }
    setActiveFile(filePath) {
        this.activeFile = filePath;
        this.updateActiveFileStats();
        this.update();
    }
    updateActiveFileStats() {
        if (!this.activeFile)
            return;
        const today = new Date();
        const yy = String(today.getFullYear()).slice(-2);
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yy}-${mm}-${dd}`; // ← ここが変更ポイント
        const text = vscode.window.activeTextEditor?.document.getText() || '';
        const charCount = countChars(text);
        if (!this.fileStats[this.activeFile])
            this.fileStats[this.activeFile] = { history: [] };
        let todayLog = this.fileStats[this.activeFile].history.find(h => h.date === todayStr);
        if (!todayLog) {
            todayLog = { date: todayStr, addedCount: 0, removedCount: 0, charCount };
            this.fileStats[this.activeFile].history.push(todayLog);
        }
        else {
            todayLog.charCount = charCount;
        }
        this.save();
    }
    scheduleUpdate() {
        if (this.updateTimeout)
            clearTimeout(this.updateTimeout);
        this.updateTimeout = setTimeout(() => this.updateTodayStats(), this.UPDATE_INTERVAL);
    }
    updateTodayStats() {
        if (!this.activeFile)
            return;
        const today = new Date();
        const yy = String(today.getFullYear()).slice(-2);
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yy}-${mm}-${dd}`; // ← 同様に変更
        const stats = this.fileStats[this.activeFile];
        if (!stats)
            return;
        const text = vscode.window.activeTextEditor?.document.getText() || '';
        const charCount = countChars(text);
        let todayLog = stats.history.find(h => h.date === todayStr);
        if (!todayLog) {
            todayLog = { date: todayStr, addedCount: charCount, removedCount: 0, charCount };
            stats.history.push(todayLog);
        }
        else {
            const prevCharCount = todayLog.charCount || 0;
            todayLog.addedCount = charCount > prevCharCount ? charCount - prevCharCount : 0;
            todayLog.removedCount = charCount < prevCharCount ? prevCharCount - charCount : 0;
            todayLog.charCount = charCount;
        }
        this.save();
        this.update();
    }
    save() {
        this.context.globalState.update('fileStats', this.fileStats);
    }
    update() {
        if (!this._view)
            return;
        if (!this.activeFile || !this.fileStats[this.activeFile]) {
            this._view.webview.html = this.getHtml([]);
            return;
        }
        const sortedHistory = [...this.fileStats[this.activeFile].history].sort((a, b) => b.date.localeCompare(a.date));
        this._view.webview.html = this.getHtml(sortedHistory);
    }
    getHtml(history) {
        const listItems = history
            .map(h => `<li>${h.date} | -: ${h.removedCount} | +: ${h.addedCount} | =: ${h.charCount}</li>`)
            .join('');
        return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <style>
    html, body {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      overflow-x: auto; /* 水平スクロール */
      overflow-y: auto; /* 垂直スクロール */
      font-family: sans-serif;
    }
    ul {
      padding-left: 0;
      margin: 0;
      list-style: none;
      white-space: nowrap; /* 行が長くても折り返さず水平スクロール */
    }
    li {
      margin: 2px 0;
    }
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
exports.WebViewProvider = WebViewProvider;
//# sourceMappingURL=WebViewProvider.js.map