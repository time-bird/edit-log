import * as vscode from 'vscode';

// 1日分の編集履歴
export interface FileHistory {
  date: string;        // YYYY-MM-DD
  addedCount: number;  // 追加文字数
  removedCount: number;// 削除文字数
  charCount: number;   // その日の最終文字数
}

// 空白・改行・タブを除いた文字数をカウント
export function countChars(text: string): number {
  return Array.from(text).filter(ch => !/\s/.test(ch)).length;
}

export class WebViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private activeFile: string | undefined;
  private fileStats: { [filePath: string]: { history: FileHistory[] } } = {};

  private updateTimeout?: NodeJS.Timeout;
  private readonly UPDATE_INTERVAL = 800; // 確定後に更新する間隔(ms)

  constructor(private readonly context: vscode.ExtensionContext) {
    const stored = this.context.globalState.get<{ [filePath: string]: { history: FileHistory[] } }>('fileStats');
    if (stored) this.fileStats = stored;

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

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    this.update();
  }

  setActiveFile(filePath: string) {
    this.activeFile = filePath;
    this.updateActiveFileStats();
    this.update();
  }

  private updateActiveFileStats() {
    if (!this.activeFile) return;
    const today = new Date().toISOString().split('T')[0];
    const text = vscode.window.activeTextEditor?.document.getText() || '';
    const charCount = countChars(text);

    if (!this.fileStats[this.activeFile]) this.fileStats[this.activeFile] = { history: [] };

    let todayLog = this.fileStats[this.activeFile].history.find(h => h.date === today);
    if (!todayLog) {
      todayLog = { date: today, addedCount: 0, removedCount: 0, charCount };
      this.fileStats[this.activeFile].history.push(todayLog);
    } else {
      todayLog.charCount = charCount;
    }

    this.save();
  }

  private scheduleUpdate() {
    if (this.updateTimeout) clearTimeout(this.updateTimeout);
    this.updateTimeout = setTimeout(() => this.updateTodayStats(), this.UPDATE_INTERVAL);
  }

  private updateTodayStats() {
    if (!this.activeFile) return;
    const today = new Date().toISOString().split('T')[0];
    const stats = this.fileStats[this.activeFile];
    if (!stats) return;

    const text = vscode.window.activeTextEditor?.document.getText() || '';
    const charCount = countChars(text);

    let todayLog = stats.history.find(h => h.date === today);
    if (!todayLog) {
      todayLog = { date: today, addedCount: charCount, removedCount: 0, charCount };
      stats.history.push(todayLog);
    } else {
      // 既存ログは差分を正しく確定後に反映
      const prevCharCount = todayLog.charCount || 0;
      todayLog.addedCount = charCount > prevCharCount ? charCount - prevCharCount : 0;
      todayLog.removedCount = charCount < prevCharCount ? prevCharCount - charCount : 0;
      todayLog.charCount = charCount;
    }

    this.save();
    this.update();
  }

  private save() {
    this.context.globalState.update('fileStats', this.fileStats);
  }

  update() {
    if (!this._view) return;

    if (!this.activeFile || !this.fileStats[this.activeFile]) {
      this._view.webview.html = this.getHtml([]);
      return;
    }

    const sortedHistory = [...this.fileStats[this.activeFile].history].sort((a, b) => b.date.localeCompare(a.date));
    this._view.webview.html = this.getHtml(sortedHistory);
  }

  private getHtml(history: FileHistory[]): string {
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
