import * as vscode from 'vscode';
import * as path from 'path';
import { getFolderStats, FileStat } from './utils/countCharactersRecursive'; // 名前変更に合わせてインポート修正
import { CharacterCounter } from './utils/characterCounter';

export class WebViewProvider implements vscode.WebviewViewProvider {
	private view?: vscode.WebviewView;
	private activeFilePath?: string;
	private activeFolderPath?: string;
	
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

	// フォルダ内のファイルをスキャンし、除外設定を加味して合計を出す
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

	// 除外ファイルの取得 (WorkspaceState)
	private getExcludedFiles(folderPath: string): string[] {
		const allExclusions = this.context.workspaceState.get<{[key: string]: string[]}>('folderExclusions', {});
		return allExclusions[folderPath] || [];
	}

	// 除外ファイルの保存
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

	private saveFileHistory(filePath: string, total: number, diff: number) {
		// (変更なしのため省略。元のコードと同じ)
		const date = new Date().toLocaleDateString();
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
		webviewView.webview.onDidReceiveMessage(message => {
			switch (message.command) {
				case 'toggleExclusion':
					this.toggleExclusion(message.path);
					return;
			}
		});

		this.updateWebview();
	}

	private updateWebview() {
		if (!this.view) return;

		const fileName = this.activeFilePath ? path.basename(this.activeFilePath) : '-';
		const webview = this.view.webview;

    // チェックリストアイコン：codicon.css への URI を作成
    const codiconsUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );
	
		// 履歴テーブル作成
		const allHistory = this.context.workspaceState.get<{[key: string]: any[]}>('fileHistories', {});
		const history = this.activeFilePath ? allHistory[this.activeFilePath] || [] : [];
		const fileRows = [...history].reverse().map(h => `
			<tr>
				<td style="color: var(--vscode-descriptionForeground); padding-right: 4px;">
				${h.date}</td>
				<td style="color: var(--vscode-charts-red); text-align: right; padding-right: 4px;">
				-${h.removedCount.toLocaleString()}</td>
				<td style="color: var(--vscode-charts-green); text-align: right; padding-right: 4px;">
				+${h.addedCount.toLocaleString()}</td>
				<td style="font-weight: bold; text-align: right;">
				${h.charCount.toLocaleString()}</td>
			</tr>
		`).join('');

		// フォルダ内ファイル文字数合計の除外ファイル配列の読みこみ
		const excludedFiles = this.activeFolderPath ? this.getExcludedFiles(this.activeFolderPath) : [];
		
		// フォルダ内ファイル文字数合計のファイルチェックリストのHTML作成
		const checkListRows = this.folderFiles.map(f => {
			const isChecked = !excludedFiles.includes(f.relativePath);
			return `
				<div class="check-row">
					<label style="display: flex; align-items: center; cursor: pointer; width: 100%;">
						<input type="checkbox" ${isChecked ? 'checked' : ''} 
							onclick="toggleFile('${f.relativePath.replace(/\\/g, '\\\\')}')">
						<span style="margin-left: 5px; flex: 1; overflow: hidden; text-overflow: ellipsis;" title="${f.relativePath}">
							${f.relativePath}
						</span>
						<span style="opacity: 0.7; font-size: 0.9em;">${f.count.toLocaleString()}</span>
					</label>
				</div>
			`;
		}).join('');

		// 本体WebViewの設定
		this.view.webview.html = `
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
					}
				body { 
					font-family: var(--vscode-font-family); 
					padding: 10px; font-size: 0.8em; 
					color: var(--vscode-foreground); 
					}
				
				.header-row { 
					display: flex; 
					justify-content: space-between; 
					align-items: center; 
					margin-bottom: 3px; 
					gap: 5px; /* 文字とアイコンの間の最低限の隙間 */
					}
				.name-label {
					color: var(--vscode-descriptionForeground);
					white-space: nowrap;      /* 改行させない */
					overflow: hidden;         /* はみ出した分を隠す */
					text-overflow: ellipsis;  /* はみ出した部分を「...」にする */
					flex-shrink: 1;           /* 画面が狭い時に縮むことを許可する */
					min-width: 0;             /* flexアイテムの縮小を正しく機能させる */
					}
				.check-btn {
					flex-shrink: 0;           /* アイコンボタンは絶対に縮ませない */
					background: none; border: none; 
					color: var(--vscode-icon-foreground);
					cursor: pointer;
					display: flex; align-items: center;
					padding: 2px 0;
					}
				.check-btn:hover { 
					color: var(--vscode-foreground); 
					}
				.codicon { 
					font-size: 14px;	 /* アイコンサイズの調整 */ 
					}

				#check-container {
					display: none; /* デフォルト非表示 */
					border: 1px solid var(--vscode-panel-border);
					background-color: var(--vscode-editor-background);
					margin-bottom: 5px;
					max-height: 200px;
					overflow-y: auto;
					padding: 5px;
				}
				#check-container.visible { 
					display: block; 
					}
				.check-row { 
					padding: 2px 0; 
					border-bottom: 1px solid var(--vscode-panel-border); 
					}
				.check-row:last-child { 
					border-bottom: none; 
					}
				
				table { 
					width: 100%; 
					border-collapse: collapse;
					border-bottom: 1px solid var(--vscode-panel-border);
					padding-bottom: 5px;
					margin-bottom: 5px; 
					}
				tr {
					border-bottom: 1px solid var(--vscode-panel-border);
					}
				th { 
					color: var(--vscode-descriptionForeground);
					font-size: 0.8em;
					text-align: left;
					font-weight: bold; 
					}
				td {
					padding-top: 2px;
					padding-bottom: 3px; 
					margin-bottom: 3px;
					}
				</style>
			</head>
			
			<body>
				<div class="header-row">
					<div class="name-label" title="${path.basename(this.activeFolderPath || '')}">
						Folder : ${path.basename(this.activeFolderPath || '')}
					</div>
					<button class="check-btn" onclick="document.getElementById('check-container').classList.toggle('visible')">
						<i class="codicon codicon-checklist"></i>
					</button>
				</div>

				<div id="check-container">
					<div style="font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid var(--vscode-panel-border);">Include in Total:</div>
					${checkListRows}
				</div>

				<table>
					<tr>
						<td style="font-weight: bold; text-align: right;">
							Total : ${this.folderTotal.toLocaleString()}
						</td>
					</tr>
				</table>

				<div class="name-label" title="${fileName}" style="padding-bottom: 5px;">
					File : ${fileName}
				</div>
				<table>
					<tr>
						<th>Date</th><th>Del</th><th>Add</th><th>Total</th>
					</tr>
					${fileRows}
				</table>

				<script>
					const vscode = acquireVsCodeApi();
					function toggleFile(path) {
						vscode.postMessage({
							command: 'toggleExclusion',
							path: path
						});
					}
				</script>
			</body>
			</html>`;
	}
}