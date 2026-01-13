import * as vscode from 'vscode';
import { WebViewProvider } from './WebViewProvider';

export function activate(context: vscode.ExtensionContext) {

  const provider = new WebViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('edit-log', provider)
  );

  // アクティブエディタ変更時
  vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor?.document) {
      provider.setActiveFile(editor.document.uri.fsPath);
    }
  });

  // 初期化時に現在アクティブなファイルを設定
  if (vscode.window.activeTextEditor?.document) {
    provider.setActiveFile(vscode.window.activeTextEditor.document.uri.fsPath);
  }
}

export function deactivate() {}
