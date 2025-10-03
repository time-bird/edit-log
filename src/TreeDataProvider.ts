import * as vscode from 'vscode';

// 1日分の編集履歴
export interface FileHistory {
  date: string;       // YYYY-MM-DD
  editedCount: number; // その日の編集累計
  charCount: number;   // その日の最終文字数
}

// ファイルごとの履歴をメモリ管理
export const fileStats: {
  [filePath: string]: {
    charCount: number;
    history: FileHistory[];
  };
} = {};

// 空白・改行・タブを除いて文字数をカウント（日本語も1文字=1）
export function countChars(text: string): number {
  return Array.from(text).filter(ch => !/\s/.test(ch)).length;
}

// 1行分の表示アイテム
export class LogItem extends vscode.TreeItem {
  constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.None); // インデント最小化
    this.iconPath = undefined;
    this.contextValue = undefined;
  }
}

// TreeDataProvider 本体
export class EditLogProvider implements vscode.TreeDataProvider<LogItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<LogItem | undefined | void> =
    new vscode.EventEmitter<LogItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<LogItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private activeFile: string | undefined;

  setActiveFile(file: string) {
    this.activeFile = file;

    // 今日の日付
    const today = new Date().toISOString().split('T')[0];
    const text = vscode.window.activeTextEditor?.document.getText() || '';
    const charCount = countChars(text);

    // ファイル履歴が未登録なら初期化
    if (!fileStats[file]) {
      fileStats[file] = { charCount, history: [] };
    }

    // 今日のログがまだなければ追加
    let todayLog = fileStats[file].history.find(h => h.date === today);
    if (!todayLog) {
      todayLog = { date: today, editedCount: 0, charCount };
      fileStats[file].history.push(todayLog);
    } else {
      // 文字数だけ更新しておく
      todayLog.charCount = charCount;
    }
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: LogItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<LogItem[]> {
    if (!this.activeFile) return Promise.resolve([]);
    const stats = fileStats[this.activeFile];
    if (!stats) return Promise.resolve([]);

    // 日付降順（新しい日付を上に）
    const sortedHistory = [...stats.history].sort((a, b) => b.date.localeCompare(a.date));

    return Promise.resolve(
      sortedHistory.map(
        h => new LogItem(`${h.date} | Edited: ${h.editedCount} | Chars: ${h.charCount}`)
      )
    );
  }
}
