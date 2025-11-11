import * as vscode from 'vscode';
import { EditLogProvider, fileStats, countChars } from './TreeDataProvider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new EditLogProvider();
  vscode.window.registerTreeDataProvider('edit-log', provider);

  // アクティブエディタ切替時
  vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor && editor.document.uri.scheme === 'file') {
      const filePath = editor.document.uri.fsPath;
      if (!fileStats[filePath]) {
        fileStats[filePath] = {
          charCount: countChars(editor.document.getText()),
          history: [],
        };
      }
      provider.setActiveFile(filePath);
    }
  });

  // ファイル編集を検知
  vscode.workspace.onDidChangeTextDocument(event => {
    const filePath = event.document.uri.fsPath;
    if (!fileStats[filePath]) return;

    let edited = 0;

    event.contentChanges.forEach(change => {
      // IME 未確定文字を無視
      // 未確定中は 'rangeLength === 0' かつ 'text に制御文字や \u{FFFC} が含まれる場合'
      if (change.rangeLength === 0 && /\uFFFC/.test(change.text)) {
        return;
      }

      // 追加文字数（確定文字のみ）
      const added = countChars(change.text);

      // 削除文字数（確定文字のみ）
      let removed = 0;
      if (change.rangeLength > 0) {
        const docText = event.document.getText();
        const deletedText = docText.slice(change.rangeOffset, change.rangeOffset + change.rangeLength);
        removed = countChars(deletedText);
      }

      edited += Math.max(added, removed);
    });

    const today = new Date().toISOString().split('T')[0];
    const charCount = countChars(event.document.getText());

    let todayLog = fileStats[filePath].history.find(h => h.date === today);
    if (!todayLog) {
      todayLog = { date: today, editedCount: 0, charCount };
      fileStats[filePath].history.push(todayLog);
    }

    todayLog.editedCount += edited;
    todayLog.charCount = charCount;

    provider.refresh();
  });
}

export function deactivate() {}
