import * as vs from 'vscode';
import * as ts from 'typescript';
import * as path from 'path';
import * as utils from './helpers/utils';
import * as formatter from './mock/Formatter';
import { LanguageServiceHost } from './mock/LanguageServiceHost';

type MethodType = ts.MethodDeclaration | ts.FunctionDeclaration | ts.MethodSignature;
const METHOD_KINDS = [
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.MethodSignature,
  ts.SyntaxKind.Constructor
];

export class MockThis implements vs.Disposable {
  private languageServiceHost: LanguageServiceHost;
  private services: ts.LanguageService;
  private program: ts.Program;
  private outputChannel: vs.OutputChannel;

  constructor() {
    this.languageServiceHost = new LanguageServiceHost();
    this.services = ts.createLanguageService(this.languageServiceHost, ts.createDocumentRegistry());
    this.program = this.services.getProgram();
  }

  mockThis(editor: vs.TextEditor, edit: vs.TextEditorEdit, commandName: string) {
    if (utils.isSpecFile(editor.document.fileName)) {
      vs.window.showInformationMessage('Spec files cannot be mocked.');
      return;
    }

    let sourceFile = this.getSourceFile(editor.document);
    const nodes = utils.findChildrenOfKind(sourceFile);

    let className: string;
    let constructor: Constructor;
    nodes.forEach(node => {
      switch (node.kind) {
        case ts.SyntaxKind.ClassDeclaration:
            className = (<ts.ClassDeclaration>node).name.text;
          break;
        case ts.SyntaxKind.Constructor:
          constructor = utils.convertToConstructor(<ts.ConstructorDeclaration>node);
          break;
      }
    });

    const selection = editor.selection;
    const caret = selection.start;

    const position = ts.getPositionOfLineAndCharacter(sourceFile, caret.line, caret.character);
    const node = utils.findChildForPosition(sourceFile, position);
    const documentNode = utils.nodeIsOfKind(node) ? node : utils.findFirstParent(node);

    if (!documentNode) {
      this.showErrorMessage(commandName, 'at the current caret position');
      return;
    }

    let testMethod: TestMethod = null;
    if (utils.nodeIsOfKind(documentNode, METHOD_KINDS)) {
      testMethod = this.parseMethod(<MethodType>documentNode);
    } else {
      let node = <MethodType>utils.findFirstParent(documentNode, METHOD_KINDS);
      if (node) {
        testMethod = this.parseMethod(node);
      }
    }
    let specFile = this.getSpecFile(sourceFile.fileName);
    if (specFile && testMethod) {
      utils.touch(specFile.fileName);
      this.writeSpecToEditor(specFile, className, constructor, testMethod);
    } else if (!specFile) {
      this.showErrorMessage(commandName, 'Could not write specs to file');
    } else {
      vs.window.showInformationMessage('No methods found.');
    }
  }

  mockEverything(editor: vs.TextEditor, edit: vs.TextEditorEdit, commandName: string) {
    if (utils.isSpecFile(editor.document.fileName)) {
      vs.window.showInformationMessage('Spec files cannot be mocked.');
      return;
    }

    let sourceFile = this.getSourceFile(editor.document);
    const nodes = utils.findChildrenOfKind(sourceFile);

    let className: string;
    let constructor: Constructor;
    let tests: TestMethod[] = [];
    nodes.forEach(node => {
      switch (node.kind) {
        case ts.SyntaxKind.ClassDeclaration:
            className = (<ts.ClassDeclaration>node).name.text;
          break;
        case ts.SyntaxKind.Constructor:
          constructor = utils.convertToConstructor(<ts.ConstructorDeclaration>node);
          break;
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.MethodSignature:
          tests.push(this.parseMethod(<MethodType>node));
          break;
      }
    });

    let specFile = this.getSpecFile(sourceFile.fileName);
    if (specFile && (constructor || tests.length > 0)) {
      utils.touch(specFile.fileName);
      let importStatement = `import { ${className} } from './${path.basename(editor.document.fileName, '.ts')}';\n`;
      this.writeEverythingToEditor(
        specFile,
        importStatement,
        className,
        constructor,
        tests);
    } else if (!specFile) {
      this.showErrorMessage(commandName, 'Could not write specs to file');
    } else {
      vs.window.showInformationMessage('No methods found.');
    }
  }

  private parseMethod(method: MethodType): TestMethod {
    let name = utils.findMethodName(method);
    let params = method.parameters.map(parameter => utils.convertToParameter(parameter));
    let returnValue = this.parseReturnValue(method);

    let isAsync = /(Observable|\.subscribe\(|Promise|then)/.test(method.getText());
    let isPrivate = false;
    let isStatic = false;
    if (method.modifiers) {
      isPrivate = method.modifiers.some(item => item.kind === ts.SyntaxKind.PrivateKeyword);
      isStatic = method.modifiers.some(item => item.kind === ts.SyntaxKind.StaticKeyword);
    }

    return {
      name,
      params,
      returnValue,
      isAsync,
      isPrivate,
      isStatic
    };
  }

  private parseReturnValue(method: MethodType): TestMethodReturnValue {
    let methodReturnValue: TestMethodReturnValue = null;

    if (utils.findNonVoidReturnInCurrentScope(method) || (method.type && method.type.getText() !== 'void')) {
      methodReturnValue = {
        isArray: false,
        isString: false,
        isBoolean: false,
        isNumber: false,
        isPromise: false,
        isObservable: false
      };

      if (method.type) {
        let returnValue = method.type.getText();
        Object.keys(methodReturnValue)
          .map(key => key.slice(2))
          .filter(key => returnValue.toLowerCase().indexOf(key.toLowerCase()) !== -1)
          .forEach(key => {
            methodReturnValue['is' + key] = true;
          });
      }
    }

    return methodReturnValue;
  }

  private async writeSpecToEditor(specFile: ts.SourceFile, className: string, constructorRef: Constructor, testMethod: TestMethod): Promise<any> {
    return this.writeToEditor({fileName: specFile.fileName, className, constructorRef, tests: [testMethod], insideDescribe: true});
  }

  private async writeEverythingToEditor(specFile: ts.SourceFile, importStatement: string, className: string, constructorRef: Constructor, tests: TestMethod[]) {
    return this.writeToEditor({fileName: specFile.fileName, importStatement, className, constructorRef, tests, insideDescribe: false});
  }

  private async writeToEditor({fileName, importStatement, className, constructorRef, tests, insideDescribe}: SpecConfig) {
    let text = formatter.formatMock(importStatement, className, constructorRef, tests);
    let uri = vs.Uri.parse(utils.toUri(fileName));
    let document = await vs.workspace.openTextDocument(uri);
    let editor = await vs.window.showTextDocument(document);
    let success = false;
    if (document.lineCount === 0) {
      success = await editor.edit(edit => edit.insert(new vs.Position(0, 0), text));
    } else {
      let lastLineCount = document.lineCount - 1;
      if (insideDescribe) {
        let lastLine: vs.TextLine = null;
        for (let i = lastLineCount; i >= 0; i -= 1) {
          lastLine = document.lineAt(i);
          if (lastLine.text.trim() === '});') {
            lastLineCount = Math.max(i, 0);
            break;
          }
        }
      }
      success = await editor.edit(edit => edit.insert(
        new vs.Position(lastLineCount, 0),
        importStatement ? text : this.filterImport(text)
      ));
    }
    if (success) {
      await vs.commands.executeCommand('editor.action.formatDocument');
    }
  }

  private filterImport(text: string): string {
    return text.split('\n').filter(s => !s.startsWith('import')).join('\n');
  }

  private getSourceFile(document: vs.TextDocument): ts.SourceFile {
    const fileName = utils.fixWinPath(document.fileName);
    const fileText = document.getText();
    this.languageServiceHost.setCurrentFile(fileName, fileText);
    return this.services.getSourceFile(fileName);
  }

  private getSpecFile(fileName: string): ts.SourceFile {
    let suffixes = utils.getConfig<string[]>('specSuffix', ['.spec']);
    let defaultExtension = utils.getConfig<string>('defaultExtension', '.spec');
    let dirname = path.dirname(fileName);
    let ext = path.extname(fileName);
    let target: string = null;

    for (let suffix of suffixes.filter(s => s !== defaultExtension)) {
      let basename = path.basename(fileName, ext);
      let specFile = path.join(dirname, basename + suffix + ext);
      if (utils.exists(specFile)) {
        target = specFile;
        break;
      }
    }

    // use the default extension if no files were found
    if (!target) {
      let basename = path.basename(fileName, ext);
      let suffix = defaultExtension;
      let specFile = path.join(dirname, basename + suffix + ext);
      target = specFile;
    }

    // craeate file if it does not exist
    if (target) {
      return this.services.getSourceFile(target);
    }

    return null;
  }

  private showErrorMessage(commandName: string, condition: string) {
    vs.window.showErrorMessage(`Sorry! '${commandName}' wasn't able to produce spec ${condition}.`);
  }

  dispose() {
    if (this.outputChannel) {
      this.outputChannel.dispose();
    }
    this.services.dispose();
  }
}
