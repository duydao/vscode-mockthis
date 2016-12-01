import * as path from 'path';
import * as vscode from 'vscode';

export interface SpecFileSwitcherBehavior {
  findFiles(include: string, exclude: string): Thenable<vscode.Uri[]>;
  showWarningMessage(message: string, ...items: string[]): void;
}

class DefaultSpecFileSwitcherBehavior implements SpecFileSwitcherBehavior {
  findFiles(include: string, exclude: string): Thenable<vscode.Uri[]> {
    return vscode.workspace.findFiles(include, exclude, 100);
  }
  showWarningMessage(message: string, ...items: string[]) {
    vscode.window.showWarningMessage(message, ...items);
  }
}

export class SpecFileSwitcher {
  private editorFileName: string;
  private fileSuffixes: string[];
  private excludePattern: string;
  private behavior: SpecFileSwitcherBehavior;
  private currentIndex: number;
  public matchingFiles: string[];
  public callback: (name: string) => void;

  public constructor(behavior?: SpecFileSwitcherBehavior) {
    this.behavior = behavior ? behavior : new DefaultSpecFileSwitcherBehavior;
    this.currentIndex = -1;
  }

  public readFiles(callsNext?: boolean): Thenable<void> {
    let name: string = path.parse(this.editorFileName).name;
    let ext: string = path.parse(this.editorFileName).ext;
    let unitTestBase: string = name;
    this.fileSuffixes.some(suffix => name.endsWith(suffix));

    this.matchingFiles = [];
    let self = this;
    let promise: Thenable<vscode.Uri[]> = this.behavior.findFiles('**/' + unitTestBase + '{,' + this.fileSuffixes.join(',') + '}' + ext, self.excludePattern);
    return promise.then(uris => {
      if (!uris) {
        return;
      }
      uris.forEach(uri => {
        self.matchingFiles.push(uri.fsPath);
      });
      self.matchingFiles.sort();
      self.currentIndex = self.matchingFiles.indexOf(self.editorFileName);
      if (callsNext) {
        self.callNext();
      }
    });
  }

  public next() {
    if (this.currentIndex < 0) {
      this.readFiles(true);
    } else {
      this.callNext();
    }
  }

  public isFirstTime() {
    return !this.matchingFiles;
  }

  public hasNext() {
    return this.matchingFiles && 1 < this.matchingFiles.length;
  }

  private callNext() {
    if (!this.hasNext()) {
      this.behavior.showWarningMessage('Not found match files...');
      return;
    }
    this.currentIndex = (this.currentIndex + 1) % this.matchingFiles.length;
    this.callback(this.matchingFiles[this.currentIndex]);
  }

  public readFilesBy(editorFileName: string, fileSuffixes: string[], excludePatterns: string[]): Thenable<void> {
    this.editorFileName = editorFileName;
    this.fileSuffixes = fileSuffixes;
    this.excludePattern = this.resolveExcludePatterns(excludePatterns);
    return this.readFiles();
  }

  private resolveExcludePatterns(excludePatterns: string[]): string {
    return excludePatterns ? '{' + excludePatterns.join(',') + '}' : null;
  }

  public currentFileOfToggle(): string {
    return this.isFirstTime() ? null : this.matchingFiles[this.currentIndex];
  }

  public outputMatchingFiles() {
    if (!this.matchingFiles) {
      console.log('null');
      return;
    }
    else if (this.matchingFiles.length === 0) {
      console.log('[]');
      return;
    }
    console.log(this.matchingFiles.join('\n'));
  }
}