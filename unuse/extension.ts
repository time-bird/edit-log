import * as vscode from 'vscode';
import { NodeDependenciesProvider } from './NodeDependenciesProvider';

export function activate(context: vscode.ExtensionContext) {
  const rootPath =
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;

  if (rootPath) {
    const provider = new NodeDependenciesProvider(rootPath);

    vscode.window.registerTreeDataProvider('edit-log', provider);

    const treeView = vscode.window.createTreeView('edit-log', {
      treeDataProvider: provider,
    });
    context.subscriptions.push(treeView);
  } else {
    vscode.window.showInformationMessage('No workspace folder open.');
  }
}
