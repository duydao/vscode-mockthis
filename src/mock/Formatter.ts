import { StringBuilder } from '../helpers/StringBuilder';

export function formatMock(importStatement: string, className: string, constructor: Constructor = {name: '', params: []}, tests: TestMethod[]) {
  const {name, params} = constructor;

  const mock = new StringBuilder();
  let mainVariable = uncapitalize(className);

  if (tests.length > 1) {
    mock.appendLine(`describe('${capitalize(split(className))}', () => {`);
    mock.appendLine(`  let ${mainVariable}: ${className};`);
    params.forEach(item => {
      mock.appendLine(`  let ${item.name};`);
    });
    mock.appendLine();

    // setup
    if (params.length > 0) {
      mock.appendLine(`  beforeEach(() => {`);
      params.forEach(item => {
        mock.appendLine(`  ${item.name} = jasmine.createSpyObj('${item.name}', ['']);`);
      });
      mock.appendLine(`  ${mainVariable} = new ${name}(${params.map(param => param.name).join(', ')});`);
      mock.appendLine('  });');
      mock.appendLine();
    }
  }

  // test specs
  tests.forEach((test, index, arr) => {
    let addTick = false;
    if (test.returnValue && test.returnValue.isPromise) {
      mock.appendLine(`it('${split(test.name)}', async(() => {`);
    } else if (test.returnValue && test.returnValue.isObservable) {
      mock.appendLine(`it('${split(test.name)}', async(() => {`);
    } else if (test.isAsync) {
      mock.appendLine(`it('${split(test.name)}', fakeAsync(() => {`);
      addTick = true;
    } else {
      mock.appendLine(`it('${split(test.name)}', () => {`);
    }

    test.params.forEach(param => {
      if (param.identifiers.length > 0) {
        let paramNames = param.identifiers.map(identifier => {
          if (identifier.isObjectPattern) {
            return uncapitalize(param.type);
          }
          return identifier.name;
        }).join(', ');
        mock.appendLine(`  let ${paramNames}; // ${param.type}`);
      } else {
        mock.appendLine(`  let ${param.name}; // ${param.type}`);
      }
    });

    if (test.returnValue) {
      let { isPromise, isObservable } = test.returnValue;
      if (isPromise) {
        mock.appendLine(`  ${createMethodCall(mainVariable, name, test)}`)
          .appendLine(`    .then(result => {`)
          .appendLine(`      expect(result);`)
          .appendLine(`    });`);
      } else if (isObservable) {
        mock.appendLine(`  ${createMethodCall(mainVariable, name, test)}`)
          .appendLine(`    .subscribe(result => {`)
          .appendLine(`      expect(result);`)
          .appendLine(`    });`);
      } else {
        mock.appendLine(`  let result = ${createMethodCall(mainVariable, name, test)};`);
        mock.appendLine(`  expect(result);`);
      }
    } else {
      mock.appendLine(`  ${createMethodCall(mainVariable, name, test)};`);
    }

    if (addTick) {
      mock.appendLine(`  tick();`);
    }

    if (arr.length > 1) {
      mock.appendLine(`  fail('not implemented');`);
    }

    if (!test.isAsync) {
      mock.appendLine(`});`);
    } else {
      mock.appendLine(`}));`);
    }

    if (index !== arr.length - 1) {
      mock.appendLine();
    }
  });

  if (tests.length > 1) {
    mock.appendLine('});');
  }

  let result = mock.toString();
  let imports = new StringBuilder();
  if (result.indexOf('fakeAsync') && result.indexOf('async')) {
    imports.appendLine(`import { async, fakeAsync, tick } from '@angular/core/testing';`);
  }
  imports.appendLine(importStatement);

  return imports.toString() + mock.toString();
}

function split(text: string): string {
  return text.split(/(?=[A-Z])/).join(' ').toLowerCase();
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function uncapitalize(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function createMethodCall(mainName: string, className: string, testMethod: TestMethod): string {
  // let params = testMethod.params.map(item => item.name).join(', ');

  let paramNames: string = testMethod.params
    .map(param => {
      if (param.identifiers.length && param.identifiers[0].isObjectPattern) {
        return uncapitalize(param.type);
      } else {
        return param.name;
      }
    })
    .join(', ');

  let methodCall = '';
  if (testMethod.isPrivate) {
    methodCall = `${mainName}['${testMethod.name}'](${paramNames})`;
  } else if (testMethod.isStatic) {
    methodCall = `${className}.${testMethod.name}(${paramNames})`;
  } else {
    methodCall = `${mainName}.${testMethod.name}(${paramNames})`;
  }
  return methodCall;
}