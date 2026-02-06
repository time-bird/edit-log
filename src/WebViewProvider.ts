import * as vscode from 'vscode';
import * as path from 'path';
import { getFolderStats, FileStat } from './utils/countCharactersRecursive';
import { CharacterCounter } from './utils/characterCounter';
import { HistoryManager, HistoryEntry } from './utils/historyManager';

export class WebViewProvider implements vscode.WebviewViewProvider {
	// 変数定義
	private view?: vscode.WebviewView;
	private activeFilePath?: string;
	private activeFolderPath?: string;
	private isFolderListVisible: boolean = false;	// フォルダ開閉チェック用
	
	// フォルダ統計データ
	private folderFiles: FileStat[] = []; // 全ファイルのリスト
	private folderTotal: number = 0;      // 除外設定を考慮した合計

	private lastFileCharCount: number = 0;

	constructor(private context: vscode.ExtensionContext) {
		vscode.workspace.onDidSaveTextDocument(async (doc) => {
			if (this.activeFilePath === doc.uri.fsPath) {
				await this.refreshAllStats(doc.getText());
			} else if (this.activeFolderPath && doc.uri.fsPath.startsWith(this.activeFolderPath)) {
				// 同じフォルダ内の別ファイルが保存された場合もフォルダ合計を更新する必要がある
				await this.refreshFolderStatsOnly();
			}
		});
	}

	/*** 実体処理 ***/
	public async updateTarget(filePath: string) {
		this.activeFilePath = filePath;
		this.activeFolderPath = path.dirname(filePath);

		// フォルダ情報を全スキャンして取得
		await this.calculateFolderStats();

		// ファイル個別の現在値を取得
		const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === filePath);
		const currentContent = doc ? doc.getText() : (await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))).toString();
		const currentCount = CharacterCounter.count(currentContent);
		
		this.lastFileCharCount = currentCount;
		this.saveFileHistory(filePath, currentCount, 0);
		this.updateWebview();
	}

	// フォルダの統計のみ再計算（他のファイル保存時やチェックボックス変更時）
	private async refreshFolderStatsOnly() {
		if (!this.activeFolderPath) return;
		await this.calculateFolderStats();
		this.updateWebview();
	}

	private async refreshAllStats(newContent: string) {
		if (!this.activeFilePath || !this.activeFolderPath) return;

		// 1. フォルダ合計を再計算
		await this.calculateFolderStats();

		// 2. ファイル個別の差分を計算
		const currentCount = CharacterCounter.count(newContent);
		const diff = currentCount - this.lastFileCharCount;

		if (diff !== 0) {
			this.saveFileHistory(this.activeFilePath, currentCount, diff);
			this.lastFileCharCount = currentCount;
		}
		this.updateWebview();
	}

	/*** フォルダ内ファイル文字数合計：フォルダ内のファイルをスキャンし、除外設定を加味して合計を出す ***/
	private async calculateFolderStats() {
		if (!this.activeFolderPath) return;
		
		// 全ファイルを取得
		this.folderFiles = await getFolderStats(vscode.Uri.file(this.activeFolderPath));

		// 除外設定を取得
		const excludedFiles = this.getExcludedFiles(this.activeFolderPath);
		
		// 合計計算 (除外リストに含まれていないものだけ足す)
		this.folderTotal = this.folderFiles.reduce((sum, file) => {
			if (excludedFiles.includes(file.relativePath)) {
				return sum;
			}
			return sum + file.count;
		}, 0);
	}

	/*** フォルダ内ファイル文字数合計：除外ファイルの取得 (WorkspaceState) ***/
	private getExcludedFiles(folderPath: string): string[] {
		const allExclusions = this.context.workspaceState.get<{[key: string]: string[]}>('folderExclusions', {});
		return allExclusions[folderPath] || [];
	}

	/*** フォルダ内ファイル文字数合計：除外ファイルの保存 ***/
	private async toggleExclusion(relativePath: string) {
		if (!this.activeFolderPath) return;
		
		const allExclusions = this.context.workspaceState.get<{[key: string]: string[]}>('folderExclusions', {}) || {};
		let currentExclusions = allExclusions[this.activeFolderPath] || [];

		if (currentExclusions.includes(relativePath)) {
			// 除外解除 (チェックON)
			currentExclusions = currentExclusions.filter(p => p !== relativePath);
		} else {
			// 除外追加 (チェックOFF)
			currentExclusions.push(relativePath);
		}

		allExclusions[this.activeFolderPath] = currentExclusions;
		await this.context.workspaceState.update('folderExclusions', allExclusions);

		// 再計算して更新
		await this.refreshFolderStatsOnly();
	}

	/*** 変更履歴の保存 ***/
	private saveFileHistory(filePath: string, total: number, diff: number) {
		const date = new Date().toISOString().split('T')[0];	//ISO日付形式
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

	/*** 変更履歴：エクスポート ***/
	public async exportCurrentHistory() {
			if (!this.activeFilePath) return;
			const allHistory = this.context.workspaceState.get<{[key: string]: HistoryEntry[]}>('fileHistories', {});
			const history = allHistory[this.activeFilePath] || [];
			await HistoryManager.exportToCSV(this.activeFilePath, history);
	}

	/*** 変更履歴：インポート ***/
	public async importCurrentHistory() {
		if (!this.activeFilePath) {
			vscode.window.showWarningMessage('Please open a file in the editor first.');
			return;
		}

		const result = await HistoryManager.importFromCSV();
		
		if (result) {
			// パスの不一致チェック
			// ※ OSによるパス区切りの違いや大文字小文字を考慮して normalize するのが安全ですが、
			//   単純な比較でも多くのケースで機能します。
			if (result.sourcePath !== this.activeFilePath) {
				const activeName = path.basename(this.activeFilePath);
				const csvSourceName = path.basename(result.sourcePath);
				
				const choice = await vscode.window.showErrorMessage(
					`File mismatch! The CSV is for "${csvSourceName}", but the current file is "${activeName}". Do you want to proceed anyway?`,
					'Yes, Import Anyway', 'Cancel'
				);
				
				if (choice !== 'Yes, Import Anyway') {
					return; // 中断
				}
			}

			let allHistory = this.context.workspaceState.get<{[key: string]: HistoryEntry[]}>('fileHistories', {});
			allHistory[this.activeFilePath] = result.entries; 
			await this.context.workspaceState.update('fileHistories', allHistory);
			
			this.updateWebview();
			vscode.window.showInformationMessage('History imported successfully.');
		}
	}

	public resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;

    webviewView.webview.options = {
			enableScripts: true,
			// ローカルリソースの読み込み許可設定
			localResourceRoots: [
				this.context.extensionUri,
				// codiconsのdistディレクトリを明示的に許可
				vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist')
			]
    };

		// フロントエンドからのメッセージ受信
		webviewView.webview.onDidReceiveMessage(async message => {
			switch (message.command) {
				case 'toggleExclusion':
					this.toggleExclusion(message.path);
					return;
				case 'toggleFolderList':
					// バックエンドの状態を更新して再描画
					this.isFolderListVisible = !this.isFolderListVisible;
					this.updateWebview();
					return;
				case 'toggleAll':
					// 一括操作のメッセージハンドラ
					await this.toggleAllExclusions(message.checkAll);
					return;
			}
		});
		this.updateWebview();
	}

	/*** 選択ファイルリスト一括ON/OFFロジック ***/
	private async toggleAllExclusions(checkAll: boolean) {
		if (!this.activeFolderPath) return;
		const allExclusions = this.context.workspaceState.get<{[key: string]: string[]}>('folderExclusions', {}) || {};
		
		if (checkAll) {
			allExclusions[this.activeFolderPath] = []; // 全てON（除外なし）
		} else {
			allExclusions[this.activeFolderPath] = this.folderFiles.map(f => f.relativePath); // 全て除外
		}

		await this.context.workspaceState.update('folderExclusions', allExclusions);
		await this.refreshFolderStatsOnly();
	}

	/***** 画面表示本体 *****/
	private updateWebview() {
		if (!this.view) return;

		const fileName = this.activeFilePath ? path.basename(this.activeFilePath) : '-';
		const webview = this.view.webview;
		
		// フォルダ内ファイル文字数合計の除外ファイル配列の読みこみ
		const excludedFiles = this.activeFolderPath ? this.getExcludedFiles(this.activeFolderPath) : [];

    // チェックリストアイコン：codicon.css への URI を作成
    const codiconsUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );
		
		// チェックリスト最上部の「すべてチェックON/OFF」チェックボックス
		const isAllChecked = this.folderFiles.length > 0 && excludedFiles.length === 0;

		// 現在の状態に合わせてクラス名を決定する
		const checkContainerClass = this.isFolderListVisible ? 'visible' : '';
	
		// 履歴テーブル作成
		const allHistory = this.context.workspaceState.get<{[key: string]: any[]}>('fileHistories', {});
		const history = this.activeFilePath ? allHistory[this.activeFilePath] || [] : [];
		const fileRows = [...history].reverse().map(h => `
			<tr>
				<td style="color: var(--vscode-sideBar-foreground); font-size: 0.9em; padding-right: 4px;">
				${h.date}</td>
				<td style="color: var(--vscode-charts-red); text-align: right; padding-right: 4px;">
				-${h.removedCount.toLocaleString()}</td>
				<td style="color: var(--vscode-charts-green); text-align: right; padding-right: 4px;">
				+${h.addedCount.toLocaleString()}</td>
				<td style="font-weight: bold; text-align: right;">
				${h.charCount.toLocaleString()}</td>
			</tr>
		`).join('');
		
		// フォルダ内ファイル文字数合計のファイルチェックリストのHTML作成
		const checkListRows = this.folderFiles.map(f => {
    const isChecked = !excludedFiles.includes(f.relativePath);
    return `
			<div class="check-row">
				<label style="display: flex; align-items: center; cursor: pointer; width: 100%; min-width: 0;">
					<input type="checkbox" ${isChecked ? 'checked' : ''} 
						onclick="toggleFile('${f.relativePath.replace(/\\/g, '\\\\')}')" style="flex-shrink: 0;">
					<span class="chk-name-label" title="${f.relativePath}">
						${f.relativePath}
					</span>
					<span style="opacity: 0.7; font-size: 0.9em; flex-shrink: 0; margin-left: 3px;">
						${f.count.toLocaleString()}
					</span>
				</label>
			</div>
		`;
		}).join('');

		// 本体WebViewの設定
		this.view.webview.html = /*html*/ `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';">
				
				<link href="${codiconsUri}" rel="stylesheet" />
				<style>
				html {
					scrollbar-color: unset !important;
					scrollbar-width: auto !important;
					overflow: auto;
					}
				/* スクロールバー設定 */
				::-webkit-scrollbar-track { background: transparent !important; }
				::-webkit-scrollbar-thumb { 
					background-color: transparent;
					background-clip: content-box; 
					}
				::-webkit-scrollbar-thumb:hover { 
					background-color: var(--vscode-scrollbarSlider-hoverBackground) !important; 
					}
				::-webkit-scrollbar-thumb:active {
					background-color: var(--vscode-scrollbarSlider-activeBackground) !important;
					}
				::-webkit-scrollbar-corner { background-color: transparent; }

				body { 
					margin: 0;
					padding: 10px;
					font-family: var(--vscode-font-family); 
					font-size: var(--vscode-font-size);
					font-weight: normal; 
					color: var(--vscode-foreground); 
				}

				.header-row { 
					display: flex; 
					justify-content: space-between; 
					align-items: center; 
					margin-bottom: 2px; 
					gap: 5px;
				}
				
				/* 省略表示（...）のための共通設定 */
				.name-label, .chk-name-label {
					white-space: nowrap;      /* 改行させない */
					overflow: hidden;         /* はみ出した分を隠す */
					text-overflow: ellipsis;  /* はみ出した部分を「...」にする */
					min-width: 0;             /* 縮小を許可する */
					}

				/* ヘッダー（Folder/File名）固有のスタイル */
				.name-label {
					color: var(--vscode-sideBar-foreground);
					flex-shrink: 1;
					}

				/* チェックリスト内ファイル名固有のスタイル */
				.chk-name-label { 
					margin-left: 5px; 
					flex: 1; 
					}
		
				.check-btn {
					flex-shrink: 0; background: none; border: none; 
					color: var(--vscode-icon-foreground);
					cursor: pointer; display: flex; align-items: center; padding: 0px 0;
				}
				.check-btn:hover { color: var(--vscode-sideBar-foreground); }
				
				/* フォルダ内ファイル選択チェックリスト全体 */
				#check-container {
					display: none;
					border: 2px solid var(--vscode-panel-border);
					background-color: var(--vscode-editor-background);
					margin-bottom: 5px;
					max-height: 250px;
					overflow-y: auto;
					position: relative;
				}
				#check-container.visible { display: block; }

				/* 一括操作行のStickyスタイル: 背景色を少し変える */
				.sticky-header {
					position: sticky; top: 0; z-index: 10;
					background-color: var(--vscode-editorWidget-background);
					padding: 4px 5px;
					border-bottom: 1px solid var(--vscode-panel-border);
				}

				/* 個別ファイルリスト見出し */
				.select-list-header {
					background: var(--vscode-sideBar-background);
					color: var(--vscode-descriptionForeground);
					font-size: 0.8em;
					font-weight: bold;
					padding: 5px;
				}

				.check-row { 
					padding: 2px 5px; 
					border-bottom: 1px solid var(--vscode-panel-border); 
				}
				.check-row:last-child { border-bottom: none; }
				
				table { 
					width: 100%; 
					border-collapse: collapse; 
					margin-bottom: 5px; 
					}

				/* フォルダ内合計数表示の下の部分の線を太くする */
				.total-row {
					border-bottom: 2px solid var(--vscode-panel-border);
					padding-bottom: 5px;
					margin-bottom: 5px;
					}

				tr { border-bottom: 1px solid var(--vscode-panel-border); }
				th { color: var(--vscode-descriptionForeground); font-size: 0.8em; text-align: left; font-weight: bold; }
				td { padding: 3px 0; white-space: nowrap; }
				</style>
			</head>
			
			<body>
				<div class="header-row">
					<div class="name-label" title="${path.basename(this.activeFolderPath || '')}">
						<i class="codicon codicon-folder" style="color: var(--vscode-descriptionForeground); vertical-align: middle; padding-right: 2px;"></i>
						${path.basename(this.activeFolderPath || '')}
					</div>
					<button class="check-btn" onclick="toggleFolderList()">
						<i class="codicon codicon-checklist"></i>
					</button>
				</div>

				<div id="check-container" class="${checkContainerClass}">
					<div class="sticky-header">
						<label style="display: flex; align-items: center; cursor: pointer;">
							<input type="checkbox" ${isAllChecked ? 'checked' : ''} onchange="toggleAll(this.checked)">
							<span style="margin-left: 5px;">Toggle All Files</span>
						</label>
					</div>
					<div class="select-list-header">
						Include :
					</div>
					${checkListRows}
				</div>

				<table>
					<tr>
						<td class="total-row" style="font-weight: bold; text-align: right;">
							<span style="color: var(--vscode-descriptionForeground); font-size: 0.8em;">Total :</span> 
							${this.folderTotal.toLocaleString()}
						</td>
					</tr>
				</table>

				<div class="name-label" title="${fileName}" style="padding-bottom: 6px;">
					<i class="codicon codicon-file-text" style="color: var(--vscode-descriptionForeground); vertical-align: middle; padding-right: 2px;"></i>
					${fileName}
				</div>
				<table>
					<tr><th>Date</th><th>Del</th><th>Add</th><th>Total</th></tr>
					${fileRows}
				</table>

				<script>
					const vscode = acquireVsCodeApi();

					// フォルダリストの開閉をバックエンドに通知
					function toggleFolderList() {
						vscode.postMessage({ command: 'toggleFolderList' });
					}

					// 個別ファイルのトグルを通知
					function toggleFile(path) {
						vscode.postMessage({ command: 'toggleExclusion', path: path });
					}

					// 一括操作の通知
					function toggleAll(isChecked) {
						vscode.postMessage({ command: 'toggleAll', checkAll: isChecked });
					}
				</script>
			</body>
			</html>`;
	}
}