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
const vscode = __importStar(require("vscode"));
class WebViewProvider {
    context;
    view;
    activeFilePath;
    previousContent = '';
    historyMap = new Map();
    constructor(context) {
        this.context = context;
        // 保存時に更新
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (doc.uri.fsPath === this.activeFilePath) {
                this.updateHistory(doc.getText());
            }
        });
        // ファイル移動・名前変更
        vscode.workspace.onDidRenameFiles(e => {
            e.files.forEach(f => {
                const oldPath = f.oldUri.fsPath;
                const newPath = f.newUri.fsPath;
                if (this.historyMap.has(oldPath)) {
                    const history = this.historyMap.get(oldPath);
                    this.historyMap.set(newPath, history);
                    this.historyMap.delete(oldPath);
                    if (this.activeFilePath === oldPath) {
                        this.activeFilePath = newPath;
                        const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === newPath);
                        this.previousContent = doc ? doc.getText() : '';
                        this.updateWebview();
                    }
                }
            });
        });
    }
    resolveWebviewView(webviewView) {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        this.updateWebview();
    }
    segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
    countEffectiveChars(text) {
        const segments = [...this.segmenter.segment(text)];
        return segments.filter(seg => !/[\s\t\n\r]/.test(seg.segment)).length;
    }
    setActiveFile(filePath) {
        this.activeFilePath = filePath;
        const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === filePath);
        this.previousContent = doc ? doc.getText() : '';
        const date = new Date().toLocaleDateString('ja-JP', {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\//g, '-');
        // 当日履歴を取得
        const history = this.historyMap.get(filePath) || [];
        const today = history.find(h => h.date === date);
        if (!today) {
            // 今日の履歴がまだなければ新規作成
            history.push({
                date,
                addedCount: 0,
                removedCount: 0,
                charCount: this.countEffectiveChars(this.previousContent)
            });
            this.historyMap.set(filePath, history);
        }
        this.updateWebview();
    }
    updateHistory(newContent) {
        if (!this.activeFilePath)
            return;
        const date = new Date().toLocaleDateString('ja-JP', {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\//g, '-');
        const effectiveChars = this.countEffectiveChars(newContent);
        const history = this.historyMap.get(this.activeFilePath) || [];
        let today = history.find(h => h.date === date);
        if (today) {
            // 前回の履歴から現在文字数との差を計算して加算/減算
            const prevCharCount = today.charCount;
            const diff = effectiveChars - prevCharCount;
            if (diff > 0) {
                today.addedCount += diff;
            }
            else if (diff < 0) {
                today.removedCount += -diff;
            }
            today.charCount = effectiveChars;
        }
        else {
            // 新規履歴
            today = {
                date,
                addedCount: effectiveChars,
                removedCount: 0,
                charCount: effectiveChars
            };
            history.push(today);
        }
        this.historyMap.set(this.activeFilePath, history);
        this.previousContent = newContent;
        this.updateWebview();
    }
    updateWebview() {
        if (!this.view)
            return;
        const histories = this.activeFilePath
            ? this.historyMap.get(this.activeFilePath) || []
            : [];
        const rows = histories.map(h => `<tr>
        <td>${h.date}</td>
        <td>-${h.removedCount}</td>
        <td>+${h.addedCount}</td>
        <td>=${h.charCount}</td>
      </tr>`).join('');
        this.view.webview.html = `
      <html>
        <body style="padding:5px; overflow-x:auto;">
          <table border="1" cellspacing="0" cellpadding="2" style="border-collapse:collapse; table-layout:auto; white-space:nowrap;">
            <tr>
              <th style="font-weight:normal;">Date</th>
              <th style="font-weight:normal;">Del</th>
              <th style="font-weight:normal;">Add</th>
              <th style="font-weight:normal;">Total</th>
            </tr>
            ${rows || '<tr><td colspan="4">No history available</td></tr>'}
          </table>
        </body>
      </html>`;
    }
}
exports.WebViewProvider = WebViewProvider;
//# sourceMappingURL=WebViewProvider.js.map