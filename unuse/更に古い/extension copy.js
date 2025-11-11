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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const EditLogProvider_1 = require("./EditLogProvider");
function activate(context) {
    const provider = new EditLogProvider_1.EditLogProvider(context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('edit-log', provider));
    // 初期アクティブエディタ設定
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.scheme === 'file') {
        const filePath = editor.document.uri.fsPath;
        if (!EditLogProvider_1.fileStats[filePath]) {
            EditLogProvider_1.fileStats[filePath] = {
                charCount: (0, EditLogProvider_1.countChars)(editor.document.getText()),
                history: [],
            };
        }
        provider.setActiveFile(filePath);
    }
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.uri.scheme === 'file') {
            const filePath = editor.document.uri.fsPath;
            if (!EditLogProvider_1.fileStats[filePath]) {
                EditLogProvider_1.fileStats[filePath] = {
                    charCount: (0, EditLogProvider_1.countChars)(editor.document.getText()),
                    history: [],
                };
            }
            provider.setActiveFile(filePath);
        }
    });
    vscode.workspace.onDidChangeTextDocument(event => {
        const filePath = event.document.uri.fsPath;
        if (!EditLogProvider_1.fileStats[filePath])
            return;
        let edited = 0;
        event.contentChanges.forEach(change => {
            // IME未確定文字を無視
            if (change.rangeLength === 0 && /\uFFFC/.test(change.text))
                return;
            const added = (0, EditLogProvider_1.countChars)(change.text);
            let removed = 0;
            if (change.rangeLength > 0) {
                const docText = event.document.getText();
                const deletedText = docText.slice(change.rangeOffset, change.rangeOffset + change.rangeLength);
                removed = (0, EditLogProvider_1.countChars)(deletedText);
            }
            edited += Math.max(added, removed);
        });
        const today = new Date().toISOString().split('T')[0];
        const charCount = (0, EditLogProvider_1.countChars)(event.document.getText());
        let todayLog = EditLogProvider_1.fileStats[filePath].history.find(h => h.date === today);
        if (!todayLog) {
            todayLog = { date: today, editedCount: 0, charCount };
            EditLogProvider_1.fileStats[filePath].history.push(todayLog);
        }
        todayLog.editedCount += edited;
        todayLog.charCount = charCount;
        provider.setActiveFile(filePath);
    });
}
function deactivate() { }
//# sourceMappingURL=extension%20copy.js.map