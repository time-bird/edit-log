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
				<td style="color: var(--vscode-descriptionForeground); padding: 4px;">${h.date}</td>
				<td style="color: var(--vscode-charts-red); padding: 4px; text-align: right;">-${h.removedCount.toLocaleString()}</td>
				<td style="color: var(--vscode-charts-green); padding: 4px; text-align: right;">+${h.addedCount.toLocaleString()}</td>
				<td style="font-weight: bold; padding: 4px; text-align: right;">${h.charCount.toLocaleString()}</td>
			</tr>
		`).join('');

		this.view.webview.html = `
			<!DOCTYPE html>
			<html>
			<head>
			<style>
				/* 重要：ブラウザの新しいスクロールバー設定をリセットしwebkit-scrollbarのカスタムスタイルを有効化 */
				html {
						scrollbar-color: unset !important;
						scrollbar-width: auto !important;
				}

				body {
						font-family: var(--vscode-font-family);
						padding: 10px;
						font-size: 0.8em;
						color: var(--vscode-foreground);
						overflow-x: auto;  
						overflow-y: auto;
						white-space: nowrap; /* テキストを勝手に折り返さない */
				}

				/* VS Code 純正風スクロールバーの定義 */
				::-webkit-scrollbar {
						width: 10px;  /* 縦の幅 */
						height: 10px; /* 横の高さ */
				}

				::-webkit-scrollbar-track {
						background: transparent;
				}

				/* 通常時は透明にし、ホバー時のみ表示する（VS Codeの標準的な挙動） */
				::-webkit-scrollbar-thumb {
						background: transparent;
				}

				/* Webviewエリアにマウスが乗った時にスライダーを表示 */
				body:hover ::-webkit-scrollbar-thumb {
						background: var(--vscode-scrollbarSlider-background);
				}

				/* スライダー自体にホバーした時 */
				::-webkit-scrollbar-thumb:hover {
						background: var(--vscode-scrollbarSlider-hoverBackground) !important;
				}

				/* ドラッグ中 */
				::-webkit-scrollbar-thumb:active {
						background: var(--vscode-scrollbarSlider-activeBackground) !important;
				}

				/* テーブル等のスタイルは維持 */
				table { width: 100%; border-collapse: collapse; }
				th { padding: 4px; text-align: right; }
				th:first-child { text-align: left; }
				.gray-text { color: var(--vscode-descriptionForeground); }
			</style>
			</head>
			
			<body>
				<div style="margin-bottom: 5px; opacity: 0.7;">Folder : ${folderName}</div>
				<table style="width: 100%; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 5px; margin-bottom: 10px;">
					<tr style="font-weight: bold;">
						<td style="text-align: right;">Total : ${this.folderTotal.toLocaleString()}</td>
					</tr>
				</table>

				<div style="margin-bottom: 5px; opacity: 0.7;">File : ${fileName}</div>
				<table style="width: 100%; border-collapse: collapse; text-align: left;">
					<tr style="opacity: 0.6; font-size: 0.7em; border-bottom: 1px solid var(--vscode-panel-border);">
						<th>Date</th><th>Del</th><th>Add</th><th>Total</th>
					</tr>
					${fileRows}
				</table>
			</body>
			</html>`;
	}
}