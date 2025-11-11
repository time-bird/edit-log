import * as vscode from 'vscode';
import { EditLogProvider, fileStats, countChars } from './EditLogProvider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new EditLogProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('edit-log', provider)
  );

  // 初期アクティブエディタ設定
  const editor = vscode.window.activeTextEditor;
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

  vscode.workspace.onDidChangeTextDocument(event => {
    const filePath = event.document.uri.fsPath;
    if (!fileStats[filePath]) return;

    let edited = 0;
    event.contentChanges.forEach(change => {
      // IME未確定文字を無視
      if (change.rangeLength === 0 && /\uFFFC/.test(change.text)) return;

      const added = countChars(change.text);
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

    provider.setActiveFile(filePath);
  });
}

export function deactivate() {}
