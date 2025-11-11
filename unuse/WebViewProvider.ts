import * as vscode from 'vscode';

// 1日分の編集履歴
export interface FileHistory {
  date: string;        // YY-MM-DD
  addedCount: number;  // 追加文字数
  removedCount: number;// 削除文字数
  charCount: number;   // その日の最終文字数
}

export class WebViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private activeFilePath?: string;
  private previousContent: string = '';
  private historyMap: Map<string, FileHistory[]> = new Map();

  constructor(private context: vscode.ExtensionContext) {
    // ドキュメント保存時のフック
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.uri.fsPath === this.activeFilePath) {
        this.handleEdit(doc.getText());
      }
    });
  }

  // WebView初期化
  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    this.updateWebview();
  }

  // 空白・改行・タブを除外して有効文字をカウント（Intl.Segmenterを使用し、日本語文字に対応）
  private segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });

  private countEffectiveChars(text: string): number {
    const segments = [...this.segmenter.segment(text)];
    return segments.filter(seg => !/[\s\t\n\r]/.test(seg.segment)).length;
  }

  // アクティブファイル変更時
  public setActiveFile(filePath: string) {
    this.activeFilePath = filePath;
    const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === filePath);
    this.previousContent = doc ? doc.getText() : '';
    this.updateWebview();
  }

  // 編集確定時（保存時）
  private handleEdit(newContent: string) {
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
        if (newChar && !/[\s\t\n\r]/.test(newChar)) added++;
        if (oldChar && !/[\s\t\n\r]/.test(oldChar)) removed++;
      }
    }

    // 結果更新
    const history = this.historyMap.get(this.activeFilePath || '') || [];
    const existing = history.find(h => h.date === date);
    if (existing) {
      existing.addedCount += added;
      existing.removedCount += removed;
      existing.charCount = newCount;
    } else {
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
  private updateWebview() {
    if (!this.view) return;

    const histories = this.activeFilePath
      ? this.historyMap.get(this.activeFilePath) || []
      : [];

    const rows = histories.map(h =>
      `<tr>
        <td>${h.date}</td>
        <td>-${h.removedCount}</td>
        <td>+${h.addedCount}</td>
        <td>=${h.charCount}</td>
      </tr>`
    ).join('');

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
