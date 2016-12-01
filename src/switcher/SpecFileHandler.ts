import * as vscode from 'vscode';
import { SpecFileSwitcher } from './SpecFileSwitcher';

export class SpecFileHandler {
  private finder: SpecFileSwitcher;
  private _disposable: vscode.Disposable;

  constructor(finder: SpecFileSwitcher) {
    this.finder = finder;

    // subscribe to selection change and editor activation events
    let subscriptions: vscode.Disposable[] = [];
    // vscode.window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
    vscode.window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);

    // create a combined disposable from both event subscriptions
    this._disposable = vscode.Disposable.from(...subscriptions);
  }

  public dispose(): void {
    this._disposable.dispose();
  }

  private _onEvent(editor: vscode.TextEditor): void {
    this.readFilesIfChangedEditor(editor);
  }

  public readFilesIfChangedEditor(editor: vscode.TextEditor): void {
    let editorFileName: string = editor.document.fileName;
    if (editorFileName === this.finder.currentFileOfToggle()) {
      return;
    }
    let searchExclude = vscode.workspace.getConfiguration('search').get('exclude');
    let unittestSuffixes: string[] = vscode.workspace.getConfiguration().get<string[]>('mockthis.specSuffix', ['.spec']);
    this.finder.readFilesBy(editorFileName, unittestSuffixes, this.extractSearchExclude(searchExclude));
  }

  public extractSearchExclude(searchExclude: any): string[] {
    return Object.keys(searchExclude).filter(value => searchExclude[value] === true);
  }
}
