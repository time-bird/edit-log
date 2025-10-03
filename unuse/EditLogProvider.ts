import * as vscode from 'vscode';

export interface FileHistory {
  date: string;
  editedCount: number;
  charCount: number;
}

export const fileStats: {
  [filePath: string]: {
    charCount: number;
    history: FileHistory[];
  };
} = {};

export function countChars(text: string): number {
  return Array.from(text).filter(ch => !/\s/.test(ch)).length;
}

export class EditLogProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private activeFile: string | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    // 初期表示
    this._view.webview.html = this.getHtml([]);
  }

  setActiveFile(filePath: string) {
    this.activeFile = filePath;
    this.update();
  }

  update() {
    if (!this._view) return;

    if (!this.activeFile || !fileStats[this.activeFile]) {
      this._view.webview.html = this.getHtml([]);
      return;
    }

    const stats = fileStats[this.activeFile];
    const sortedHistory = [...stats.history].sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    this._view.webview.html = this.getHtml(sortedHistory);
  }

  private getHtml(history: FileHistory[]): string {
    const listItems = history
      .map(
        h =>
          `<li>${h.date} | Edited: ${h.editedCount} | Chars: ${h.charCount}</li>`
      )
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
