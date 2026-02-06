import * as vscode from 'vscode';
import * as path from 'path';

export interface HistoryEntry {
    date: string;
    addedCount: number;
    removedCount: number;
    charCount: number;
}

// インポート結果の型定義
export interface ImportResult {
    sourcePath: string; // CSVに記録されていた元ファイルのパス
    entries: HistoryEntry[];
}

export class HistoryManager {
    /**
     * CSVエクスポート（1行目にターゲットパスを記録）
     */
    public static async exportToCSV(filePath: string, history: HistoryEntry[]) {
        if (!history || history.length === 0) {
            vscode.window.showWarningMessage('No history to export.');
            return;
        }

        const fileName = path.basename(filePath);
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`${fileName}_history.csv`),
            filters: { 'CSV Files': ['csv'] }
        });

        if (saveUri) {
            // 1行目にメタデータとしてパスを記録、2行目にヘッダー
            const metadata = `SourceFile:${filePath}\n`;
            const header = 'Date,Removed,Added,Total\n';
            const rows = history.map(h => 
                `${h.date},${h.removedCount},${h.addedCount},${h.charCount}`
            ).join('\n');

            const content = Buffer.from(metadata + header + rows, 'utf8');
            await vscode.workspace.fs.writeFile(saveUri, content);
            vscode.window.showInformationMessage(`Exported: ${path.basename(saveUri.fsPath)}`);
        }
    }

    /**
     * CSVインポート（メタデータとデータを抽出）
     */
    public static async importFromCSV(): Promise<ImportResult | null> {
        const openUri = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'CSV Files': ['csv'] }
        });

        if (!openUri || openUri.length === 0) return null;

        try {
            const uint8Array = await vscode.workspace.fs.readFile(openUri[0]);
            const content = Buffer.from(uint8Array).toString('utf8');
            const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
            
            if (lines.length < 3) throw new Error('Invalid format');

            // 1行目からパス情報を抽出 (例: "SourceFile:C:\path\to\file.ts")
            const firstLine = lines[0];
            const sourcePath = firstLine.startsWith('SourceFile:') 
                ? firstLine.replace('SourceFile:', '').trim() 
                : '';

            // 3行目以降がデータ（2行目はヘッダーなので飛ばす）
            const entries: HistoryEntry[] = lines.slice(2).map(line => {
                const [date, removed, added, total] = line.split(',');
                return {
                    date,
                    removedCount: parseInt(removed) || 0,
                    addedCount: parseInt(added) || 0,
                    charCount: parseInt(total) || 0
                };
            });

            return { sourcePath, entries };
        } catch (error) {
            vscode.window.showErrorMessage('Failed to parse CSV file. Ensure it was exported by Edit Log.');
            return null;
        }
    }
}