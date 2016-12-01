export class StringBuilder {
  private text: string[] = [];

  append(text = '', newLine = false): this {
    if (text) {
      this.text.push(text);
    }
    if (newLine) {
      this.text.push('\n');
    }
    return this;
  }

  appendLine(text = ''): this {
    this.append(text, true);
    return this;
  }

  emptyLine(): this {
    this.text.push('\n');
    return this;
  }

  clear(): this {
    this.text = [];
    return this;
  }

  toString(): string {
    return this.text.join('');
  }
}
