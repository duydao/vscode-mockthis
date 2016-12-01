interface Constructor {
  name: string;
  params: Parameter[];
}

interface TestMethod extends Constructor {
  returnValue: TestMethodReturnValue;
  isAsync: boolean;
  isPrivate: boolean;
  isStatic: boolean;
}

interface TestMethodReturnValue {
  isArray: boolean;
  isString: boolean;
  isBoolean: boolean;
  isNumber: boolean;
  isPromise: boolean;
  isObservable: boolean;
  [key: string]: boolean;
}

interface Parameter {
  name: string;
  type: string;
  identifiers: Identifier[];
}

interface Identifier {
  name: string;
  isArrayPattern: boolean;
  isObjectPattern: boolean;
}

interface SpecConfig {
  fileName: string,
  importStatement?: string,
  className?: string,
  constructor: Constructor,
  tests: TestMethod[],
  insideDescribe: boolean
}