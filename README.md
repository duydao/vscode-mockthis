# Mock This for vscode
Generate Jasmine specs for TypeScript files in Angular 2 projects.

# How to install
This plugin will be available in the marketplace shortly. In the mean time, we can generate a .vsix file and install it manually:

cd /path/to/this/project
npm install -g vsce
npm install
vsce package
code --install-extension vscode-mockthis-0.2.2.vsix

# Commands
## Switch between code and spec file
`ctrl+j` or `cmd+j`

## Mock Everything
Generate a spec file for the code file.

Command Palette -> Mock Everything

or

`ctrl+alt+j` or `cmd+alt+j`

## Mock This

Generate a spec for the selected method.

Command Palette -> Mock This

or 

`ctrl+shift+j` or `cmd+shift+j`


## Todo
- More options
- Generate mocks

## Changes
### 0.2.2
- First release

## License
MIT
