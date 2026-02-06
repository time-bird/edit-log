import * as vscode from 'vscode';
import { WebViewProvider } from './WebViewProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new WebViewProvider(context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('edit-log', provider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('edit-log.exportCSV', () => {
            provider.exportCurrentHistory();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('edit-log.importCSV', () => {
            provider.importCurrentHistory();
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor?.document && editor.document.uri.scheme === 'file') {
                provider.updateTarget(editor.document.uri.fsPath);
            }
        })
    );

    if (vscode.window.activeTextEditor?.document) {
        provider.updateTarget(vscode.window.activeTextEditor.document.uri.fsPath);
    }
}