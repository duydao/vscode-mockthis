import * as path from 'path';
import * as ts from 'typescript';
import * as fs from 'fs';
import * as vscode from 'vscode';

const supportedNodeKinds = [
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.PropertyDeclaration,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.EnumMember,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.MethodSignature,
  ts.SyntaxKind.PropertySignature,
  ts.SyntaxKind.Constructor,
  ts.SyntaxKind.FunctionExpression];

export function exists(file: string): boolean {
  return fs.existsSync(file);
}

export function touch(file: string): void {
  fs.closeSync(fs.openSync(file, 'a'));
}

export function fixWinPath(filePath: string) {
  if (path.sep === '\\') {
    return filePath.replace(/\\/g, '/');
  }

  return filePath;
}

export function toUri(filePath: string, resolve = true) {
  let pathName = filePath;

  if (resolve) {
    pathName = path.resolve(filePath);
  }

  pathName = pathName.replace(/\\/g, '/');

  // Windows drive letter must be prefixed with a slash
  if (pathName[0] !== '/') {
    pathName = `/${pathName}`;
  }

  return encodeURI(`file://${pathName}`);
};

export function findChildForPosition(node: ts.Node, position: number): ts.Node {
  let lastMatchingNode: ts.Node;

  const findChildFunc = (n: ts.Node) => {
    const start = n.pos;
    const end = n.end;

    if (start > position) {
      return;
    }

    if (start <= position && end >= position) {
      lastMatchingNode = n;
    }

    n.getChildren().forEach(findChildFunc);
  };

  findChildFunc(node);

  return lastMatchingNode;
}

export function findFirstChildOfKindDepthFirst(node: ts.Node, kinds = supportedNodeKinds): ts.Node {
  let children = node.getChildren();
  for (let c of children) {
    if (nodeIsOfKind(c, kinds)) {
      return c;
    }

    const matching = findFirstChildOfKindDepthFirst(c, kinds);
    if (matching) {
      return matching;
    }
  }

  return null;
}

export function findChildrenOfKind(node: ts.Node, kinds = supportedNodeKinds) {
  let children: ts.Node[] = [];

  node.getChildren().forEach(c => {
    if (nodeIsOfKind(c, kinds)) {
      children.push(c);
    }

    children = children.concat(findChildrenOfKind(c, kinds));
  });

  return children;
}

export function findNonVoidReturnInCurrentScope(node: ts.Node) {
  let returnNode: ts.ReturnStatement;

  const children = node.getChildren();

  returnNode = <ts.ReturnStatement>children.find(n => n.kind === ts.SyntaxKind.ReturnStatement);

  if (returnNode) {
    if (returnNode.getChildren().length > 1) {
      return returnNode;
    }
  }

  for (let child of children) {
    if (child.kind === ts.SyntaxKind.FunctionDeclaration || child.kind === ts.SyntaxKind.FunctionExpression || child.kind === ts.SyntaxKind.ArrowFunction) {
      continue;
    }

    returnNode = findNonVoidReturnInCurrentScope(child);
    if (returnNode) {
      return returnNode;
    }
  }

  return returnNode;
}

export function findVisibleChildrenOfKind(node: ts.Node, kinds = supportedNodeKinds) {
  let children = findChildrenOfKind(node, kinds);

  return children.filter(child => {
    if (child.modifiers && child.modifiers.find(m => m.kind === ts.SyntaxKind.PrivateKeyword)) {
      return false;
    }

    if (child.kind === ts.SyntaxKind.ClassDeclaration ||
      child.kind === ts.SyntaxKind.InterfaceDeclaration ||
      child.kind === ts.SyntaxKind.FunctionDeclaration) {
      if (!child.modifiers || !child.modifiers.find(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        return false;
      }
    }

    return true;
  });
}

export function nodeIsOfKind(node: ts.Node, kinds = supportedNodeKinds) {
  return !!node && !!kinds.find(k => node.kind === k);
}

export function findFirstParent(node: ts.Node, kinds = supportedNodeKinds) {
  let parent = node.parent;
  while (parent) {
    if (nodeIsOfKind(parent, kinds)) {
      return parent;
    }

    parent = parent.parent;
  }

  return null;
}

export function findConstructor(sourceFile: ts.SourceFile): Constructor {
  const nodes = findChildrenOfKind(sourceFile);
  for (let node of nodes) {
    switch (node.kind) {
      case ts.SyntaxKind.Constructor:
        return convertToConstructor(<ts.ConstructorDeclaration>node);
    }
  };
  return null;
}

export function convertToConstructor(node: ts.ConstructorDeclaration): Constructor {
  let name = (<ts.ClassDeclaration>node.parent).name.getText();
  let params = node.parameters.map(parameter => convertToParameter(parameter));
  return { name, params };
}

export function convertToParameter(item: ts.ParameterDeclaration): Parameter {
  let name = item.name.getText();
  let type = item.type ? item.type.getText() : null;
  let identifiers: Identifier[] = [];
  findIdentifier(identifiers, item);
  return { name, type, identifiers };
}

export function getConfig<T>(key: string, defaultValue: T): T {
  return vscode.workspace.getConfiguration('mockthis').get<T>(key, defaultValue);
}

function findIdentifier(result: Identifier[], node: ts.Node): void {
  if (node.kind === ts.SyntaxKind.Identifier) {
    switch (node.parent.kind) {
      case ts.SyntaxKind.BindingElement:
        result.push({
          name: node.getText(),
          isArrayPattern: node.parent.parent.kind === ts.SyntaxKind.ArrayBindingPattern,
          isObjectPattern: node.parent.parent.kind === ts.SyntaxKind.ObjectBindingPattern
        });
        break;
    }
  }
  node.getChildren().forEach(child => findIdentifier(result, child));
}

export function isSpecFile(fileName: string): boolean {
  if (!fileName) {
    return false;
  }
  let extname = path.extname(fileName);
  let basename = path.basename(fileName, extname);
  return fileName && getConfig<string[]>('specSuffix', ['.spec'])
    .some(suffix => basename.endsWith(suffix));
}

export function findMethodName(node: ts.MethodDeclaration | ts.FunctionDeclaration | ts.MethodSignature): string {
  if (node === null) {
    return null;
  }

  if (node.name) {
    return node.name.getText();
  }

  return findMethodName(<any>findFirstParent(node, [ts.SyntaxKind.MethodDeclaration, ts.SyntaxKind.FunctionDeclaration, ts.SyntaxKind.MethodSignature]));
}