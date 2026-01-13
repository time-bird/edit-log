import * as vscode from 'vscode';
import * as path from 'path';
import { CharacterCounter } from './characterCounter';

// 計算から除外する拡張子のリスト（画像やバイナリ）
const EXCLUDE_EXTENSIONS = new Set([
	'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.pdf', '.zip', '.exe', '.dll', '.bin', '.pdf'
]);

export async function countCharactersRecursive(uri: vscode.Uri): Promise<number> {
	const stat = await vscode.workspace.fs.stat(uri);
	
	if (stat.type === vscode.FileType.Directory) {
		let subtotal = 0;
		const entries = await vscode.workspace.fs.readDirectory(uri);
		for (const [name, type] of entries) {
			if (name === '.git' || name === 'node_modules') continue;
			const childUri = vscode.Uri.file(path.join(uri.fsPath, name));
			subtotal += await countCharactersRecursive(childUri);
		}
		return subtotal;
	} else if (stat.type === vscode.FileType.File) {
		const ext = path.extname(uri.fsPath).toLowerCase();
		if (EXCLUDE_EXTENSIONS.has(ext)) return 0;

		try {
			const uint8Array = await vscode.workspace.fs.readFile(uri);
			const content = Buffer.from(uint8Array).toString('utf8');
			return CharacterCounter.count(content);
		} catch {
			return 0; // 読み取れないファイルは0文字として扱う
		}
	}
	return 0;
}