"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditLogProvider = exports.LogItem = exports.fileStats = void 0;
exports.countChars = countChars;
const vscode = __importStar(require("vscode"));
// ファイルごとの履歴をメモリ管理
exports.fileStats = {};
// 空白・改行・タブを除いて文字数をカウント（日本語も1文字=1）
function countChars(text) {
    return Array.from(text).filter(ch => !/\s/.test(ch)).length;
}
// 1行分の表示アイテム
class LogItem extends vscode.TreeItem {
    constructor(label) {
        super(label, vscode.TreeItemCollapsibleState.None); // インデント最小化
        this.iconPath = undefined;
        this.contextValue = undefined;
    }
}
exports.LogItem = LogItem;
// TreeDataProvider 本体
class EditLogProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    activeFile;
    setActiveFile(file) {
        this.activeFile = file;
        // 今日の日付
        const today = new Date().toISOString().split('T')[0];
        const text = vscode.window.activeTextEditor?.document.getText() || '';
        const charCount = countChars(text);
        // ファイル履歴が未登録なら初期化
        if (!exports.fileStats[file]) {
            exports.fileStats[file] = { charCount, history: [] };
        }
        // 今日のログがまだなければ追加
        let todayLog = exports.fileStats[file].history.find(h => h.date === today);
        if (!todayLog) {
            todayLog = { date: today, editedCount: 0, charCount };
            exports.fileStats[file].history.push(todayLog);
        }
        else {
            // 文字数だけ更新しておく
            todayLog.charCount = charCount;
        }
        this.refresh();
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren() {
        if (!this.activeFile)
            return Promise.resolve([]);
        const stats = exports.fileStats[this.activeFile];
        if (!stats)
            return Promise.resolve([]);
        // 日付降順（新しい日付を上に）
        const sortedHistory = [...stats.history].sort((a, b) => b.date.localeCompare(a.date));
        return Promise.resolve(sortedHistory.map(h => new LogItem(`${h.date} | Edited: ${h.editedCount} | Chars: ${h.charCount}`)));
    }
}
exports.EditLogProvider = EditLogProvider;
//# sourceMappingURL=TreeDataProvider.js.map