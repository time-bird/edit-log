import * as vscode from 'vscode';

export interface FileHistory {
  date: string;        
  addedCount: number;  
  removedCount: number;
  charCount: number;   
}

export class WebViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private activeFilePath?: string;
  private previousContent: string = '';
  private historyMap: Map<string, FileHistory[]> = new Map();

  constructor(private context: vscode.ExtensionContext) {
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
          const history = this.historyMap.get(oldPath)!;
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

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    this.updateWebview();
  }

  private segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });

  private countEffectiveChars(text: string): number {
    const segments = [...this.segmenter.segment(text)];
    return segments.filter(seg => !/[\s\t\n\r]/.test(seg.segment)).length;
  }

  public setActiveFile(filePath: string) {
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

  private updateHistory(newContent: string) {
    if (!this.activeFilePath) return;

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
      } else if (diff < 0) {
        today.removedCount += -diff;
      }
      today.charCount = effectiveChars;
    } else {
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
      </tr>`).join('');

    this.view.webview.html = `
      <html>
        <body style="padding:5px; overflow-x:auto;">
          <table border="1" cellspacing="0" cellpadding="2" style="border-collapse:collapse; table-layout:auto; white-space:nowrap;">
            <tr>
              <th style="font-weight:normal;">Date</th>
              <th style="font-weight:normal;">Del</th>
              <th style="font-weight:normal;">Add</th>
              <th style="font-weight:normal;">Rslt</th>
            </tr>
            ${rows || '<tr><td colspan="4">履歴なし</td></tr>'}
          </table>
        </body>
      </html>`;
  }
}
