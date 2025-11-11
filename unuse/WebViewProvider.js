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
        // ドキュメント保存時のフック
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (doc.uri.fsPath === this.activeFilePath) {
                this.handleEdit(doc.getText());
            }
        });
    }
    // WebView初期化
    resolveWebviewView(webviewView) {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        this.updateWebview();
    }
    // 空白・改行・タブを除外して有効文字をカウント（Intl.Segmenterを使用し、日本語文字に対応）
    segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
    countEffectiveChars(text) {
        const segments = [...this.segmenter.segment(text)];
        return segments.filter(seg => !/[\s\t\n\r]/.test(seg.segment)).length;
    }
    // アクティブファイル変更時
    setActiveFile(filePath) {
        this.activeFilePath = filePath;
        const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === filePath);
        this.previousContent = doc ? doc.getText() : '';
        this.updateWebview();
    }
    // 編集確定時（保存時）
    handleEdit(newContent) {
        const date = new Date().toLocaleDateString('ja-JP', {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\//g, '-');
        const prev = this.previousContent;
        const prevCount = this.countEffectiveChars(prev);
        const newCount = this.countEffectiveChars(newContent);
        // 差分
        let added = 0;
        let removed = 0;
        // 差分を判定
        const maxLen = Math.max(prev.length, newContent.length);
        for (let i = 0; i < maxLen; i++) {
            const oldChar = prev[i];
            const newChar = newContent[i];
            if (oldChar !== newChar) {
                if (newChar && !/[\s\t\n\r]/.test(newChar))
                    added++;
                if (oldChar && !/[\s\t\n\r]/.test(oldChar))
                    removed++;
            }
        }
        // 結果更新
        const history = this.historyMap.get(this.activeFilePath || '') || [];
        const existing = history.find(h => h.date === date);
        if (existing) {
            existing.addedCount += added;
            existing.removedCount += removed;
            existing.charCount = newCount;
        }
        else {
            history.push({
                date,
                addedCount: added,
                removedCount: removed,
                charCount: newCount
            });
        }
        this.historyMap.set(this.activeFilePath || '', history);
        this.previousContent = newContent;
        this.updateWebview();
    }
    // WebView更新
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
        <body style="padding: 5px;">
          <table border="1" cellspacing="0" cellpadding="2">
            <tr><th>Date</th><th>Del</th><th>Add</th><th>Rslt</th></tr>
            ${rows || '<tr><td colspan="4">履歴なし</td></tr>'}
          </table>
        </body>
      </html>`;
    }
}
exports.WebViewProvider = WebViewProvider;
//# sourceMappingURL=WebViewProvider.js.map