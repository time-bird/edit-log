import * as vscode from 'vscode';
import * as path from 'path';
import { countCharactersRecursive } from './utils/countCharactersRecursive';
import { CharacterCounter } from './utils/characterCounter';

export class WebViewProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;
    private activeFilePath?: string;
    private activeFolderPath?: string;
    private folderTotal: number = 0;
    private lastFileCharCount: number = 0;

    constructor(private context: vscode.ExtensionContext) {
        // 保存時の処理
        vscode.workspace.onDidSaveTextDocument(async (doc) => {
            if (this.activeFilePath === doc.uri.fsPath) {
                await this.refreshAllStats(doc.getText());
            }
        });
    }

    // ファイルが選択された時に呼ばれる
    public async updateTarget(filePath: string) {
        this.activeFilePath = filePath;
        this.activeFolderPath = path.dirname(filePath);

        // フォルダ合計の計算
        this.folderTotal = await countCharactersRecursive(vscode.Uri.file(this.activeFolderPath));

        // ファイル個別の現在値を取得
        const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === filePath);
        const currentContent = doc ? doc.getText() : (await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))).toString();
        const currentCount = CharacterCounter.count(currentContent);
        
        this.lastFileCharCount = currentCount;

        // 初回ロード時、履歴に今日のエントリがなければ作成（差分0）
        this.saveFileHistory(filePath, currentCount, 0);
        this.updateWebview();
    }

    private async refreshAllStats(newContent: string) {
        if (!this.activeFilePath || !this.activeFolderPath) return;

        // 1. フォルダ合計を再計算
        this.folderTotal = await countCharactersRecursive(vscode.Uri.file(this.activeFolderPath));

        // 2. ファイル個別の差分を計算
        const currentCount = CharacterCounter.count(newContent);
        const diff = currentCount - this.lastFileCharCount;

        if (diff !== 0) {
            this.saveFileHistory(this.activeFilePath, currentCount, diff);
            this.lastFileCharCount = currentCount;
        }
        this.updateWebview();
    }

    // 履歴の保存 (VS Codeのワークスペース領域に保存)
    private saveFileHistory(filePath: string, total: number, diff: number) {
        const date = new Date().toLocaleDateString();
        // ワークスペースごとの保存領域から取得
        let allHistory = this.context.workspaceState.get<{[key: string]: any[]}>('fileHistories', {});
        let history = allHistory[filePath] || [];

        let today = history.find(h => h.date === date);
        if (today) {
            if (diff > 0) today.addedCount += diff;
            else if (diff < 0) today.removedCount += Math.abs(diff);
            today.charCount = total;
        } else if (diff !== 0 || history.length === 0) {
            history.push({
                date,
                addedCount: diff > 0 ? diff : 0,
                removedCount: diff < 0 ? Math.abs(diff) : 0,
                charCount: total
            });
        }

        allHistory[filePath] = history;
        this.context.workspaceState.update('fileHistories', allHistory);
    }

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        this.updateWebview();
    }

    private updateWebview() {
        if (!this.view) return;

        const fileName = this.activeFilePath ? path.basename(this.activeFilePath) : '-';
        const folderName = this.activeFolderPath ? path.basename(this.activeFolderPath) : '-';
        const todayStr = new Date().toLocaleDateString();

        // ファイル履歴の取得
        const allHistory = this.context.workspaceState.get<{[key: string]: any[]}>('fileHistories', {});
        const history = this.activeFilePath ? allHistory[this.activeFilePath] || [] : [];

        const fileRows = [...history].reverse().map(h => `
            <tr>
                <td>${h.date}</td>
                <td style="color: #ff8888;">-${h.removedCount}</td>
                <td style="color: #88ff88;">+${h.addedCount}</td>
                <td style="font-weight: bold;">${h.charCount}</td>
            </tr>
        `).join('');

        this.view.webview.html = `
            <!DOCTYPE html>
            <html>
            <body style="font-family: sans-serif; padding: 10px; font-size: 0.9em;">
                <div style="margin-bottom: 5px; opacity: 0.7;">Folder Total: ${folderName}</div>
                <table style="width: 100%; border-bottom: 1px solid #555; padding-bottom: 10px; margin-bottom: 10px;">
                    <tr style="font-weight: bold;">
                        <td style="width: 40%;">${todayStr}</td>
                        <td style="text-align: right;">Total: ${this.folderTotal.toLocaleString()}</td>
                    </tr>
                </table>

                <hr style="border: 0; border-top: 1px solid #888; margin: 15px 0;">

                <div style="margin-bottom: 5px; opacity: 0.7;">File History: ${fileName}</div>
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <tr style="opacity: 0.6; font-size: 0.8em; border-bottom: 1px solid #444;">
                        <th>Date</th><th>Del</th><th>Add</th><th>Total</th>
                    </tr>
                    ${fileRows}
                </table>
            </body>
            </html>`;
    }
}