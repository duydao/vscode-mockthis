import * as vs from 'vscode';
import * as serializeError from 'serialize-error';
import { StringBuilder } from './helpers/StringBuilder';
import { SpecFileSwitcher } from './switcher/SpecFileSwitcher';
import { SpecFileHandler } from './switcher/SpecFileHandler';
import { MockThis } from './mockThis';

let mocker: MockThis;

export function activate(context: vs.ExtensionContext): void {
  activateSpecSwitcher(context);
  activateMockThis(context);
}

function lazyInitializeDocumenter() {
  if (!mocker) {
    mocker = new MockThis();
  }
}

function verifyLanguageSupport(document: vs.TextDocument, commandName: string) {
  if (['javascript', 'typescript'].indexOf(document.languageId.toLowerCase()) === -1) {
    vs.window.showWarningMessage(`'${commandName}' only supports JavaScript or TypeScript files.`);
    return false;
  }

  return true;
}

function reportError(error: Error, action: string) {
  vs.window.showErrorMessage(`Sorry! '${action}' encountered an error.`, 'Report Issue').then(() => {
    try {
      const sb = new StringBuilder();
      sb.appendLine('Platform: ' + process.platform);
      sb.appendLine();
      sb.appendLine('Steps to reproduce the error:');
      sb.appendLine();
      sb.appendLine('Code excerpt that reproduces the error (optional):');
      sb.appendLine();
      sb.appendLine('Exception:');
      sb.appendLine(JSON.stringify(serializeError(error)));
      console.error(sb.toString());
    }
    catch (reportErr) {
      reportError(reportErr, 'Report Error');
    }
  });
}

function runCommand(commandName: string, document: vs.TextDocument, callback: () => void) {
  if (!verifyLanguageSupport(document, commandName)) {
    return;
  }

  try {
    lazyInitializeDocumenter();
    callback();
  }
  catch (e) {
    reportError(e, commandName);
  }
}

function activateMockThis(context: vs.ExtensionContext): void {
  context.subscriptions.push(vs.commands.registerTextEditorCommand('mockthis.mockThis', (editor, edit) => {
    const commandName = 'Mock This';

    runCommand(commandName, editor.document, () => {
      mocker.mockThis(editor, edit, commandName);
    });
  }));

  context.subscriptions.push(vs.commands.registerTextEditorCommand('mockthis.mockEverything', (editor, edit) => {
    const commandName = 'Mock Everything';

    runCommand(commandName, editor.document, () => {
      mocker.mockEverything(editor, edit, commandName);
    });
  }));
}

function activateSpecSwitcher(context: vs.ExtensionContext) {
  let switcher = new SpecFileSwitcher();
  let controller = new SpecFileHandler(switcher);
  switcher.callback = name => {
    vs.workspace.openTextDocument(name).then(doc => {
      vs.window.showTextDocument(doc).then(editor => {

      }, err => {
        console.error(err);
      });
    }, err => {
      console.error(err);
    });
  };

  if (vs.window.activeTextEditor) {
    controller.readFilesIfChangedEditor(vs.window.activeTextEditor);
  }

  context.subscriptions.push(controller);
  context.subscriptions.push(vs.commands.registerCommand('mockthis.toggleSpec', (editor, edit) => {
    switcher.next();
  }));
}
