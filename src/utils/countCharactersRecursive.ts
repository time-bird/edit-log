import * as vscode from 'vscode';
import * as path from 'path';
import { CharacterCounter } from './characterCounter';

// 計算から除外する拡張子のリスト
const EXCLUDE_EXTENSIONS = new Set([
	'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.pdf', '.zip', '.exe', '.dll', '.bin', '.pdf'
]);

// ファイルごとの統計情報
export interface FileStat {
	filePath: string;      // フルパス
	relativePath: string;  // フォルダからの相対パス（表示用）
	count: number;         // 文字数
}

export interface FolderStatResult {
	total: number;         // 合計（除外指定されたものを除く）
	files: FileStat[];     // 全ファイルリスト
}

/**
 * フォルダを再帰的に走査し、すべてのファイルの文字数とリストを返す
 * @param uri 探索するフォルダのURI
 * @param rootPath 相対パス計算用のルートパス（再帰呼び出し用）
 */
export async function getFolderStats(uri: vscode.Uri, rootPath?: string): Promise<FileStat[]> {
	const currentRoot = rootPath || uri.fsPath;
	let results: FileStat[] = [];
	
	const stat = await vscode.workspace.fs.stat(uri);
	
	if (stat.type === vscode.FileType.Directory) {
		const entries = await vscode.workspace.fs.readDirectory(uri);
		for (const [name, type] of entries) {
			if (name === '.git' || name === 'node_modules') continue;
			const childUri = vscode.Uri.file(path.join(uri.fsPath, name));
			// 再帰的に取得して配列を結合
			results = results.concat(await getFolderStats(childUri, currentRoot));
		}
	} else if (stat.type === vscode.FileType.File) {
		const ext = path.extname(uri.fsPath).toLowerCase();
		if (!EXCLUDE_EXTENSIONS.has(ext)) {
			try {
				const uint8Array = await vscode.workspace.fs.readFile(uri);
				const content = Buffer.from(uint8Array).toString('utf8');
				const count = CharacterCounter.count(content);
				results.push({
					filePath: uri.fsPath,
					relativePath: path.relative(currentRoot, uri.fsPath),
					count: count
				});
			} catch {
				// 読み取れないファイルは無視
			}
		}
	}
	return results;
}