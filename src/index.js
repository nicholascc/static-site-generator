const fs = require('fs-extra')
const path = require('path');
const chalk = require('chalk');

const println = console.log;
const colorEnabled = !process.argv.includes("--nocolor");

const descPath = "./site-description";
const outDescPath = path.join(descPath, "out.txt");
const globalVariablesPath = path.join(descPath, "global.json");
const outPath = "./site";

const statementRegex = /\$\<(.*?)\>\$/g;

function err(message, file="") {
  let fullMessage = "⚠ Error" + (file ? " in file \"" + file + "\"" : "") + ": " + message;
  if(colorEnabled) println(chalk.redBright(fullMessage));
  else println(fullMessage);
}

function assert(x, message, file="") {
  if(!x) {
    err(message, file);
  }
  return !x;
}

function updateSite() {
  println("Updating website...");

  let globalVariables = JSON.parse(fs.readFileSync(globalVariablesPath).toString('utf8'));
  
  fs.readFileSync(outDescPath)
    .toString('utf8')
    .split(/\r?\n/)
    .map(x => x.split('>').map(x => x.trim()))
    .filter(x => x.length == 3)
    .map(x => {
      return {
        inPath: path.join(descPath, x[0]),
        outPath: path.join(outPath, x[2]),
        evaluateTemplateCode: true ? x[1] === '$' : false
      }
    }).forEach(function (statement) {
      fs.readFile(statement.inPath, function (error, data) {
        if(error) {
          throw error;
        }
        data = data.toString('utf8');

        if(statement.evaluateTemplateCode) {
          data = parseFile(data, statement, statement.inPath, globalVariables);
          try {
            fs.ensureDirSync(path.dirname(statement.outPath));
            fs.writeFileSync(statement.outPath, data);
          } catch (error2) {
            err(error2, statement.inPath);
          }
        } else {
          fs.ensureDirSync(path.dirname(statement.outPath));
          fs.copyFile(statement.inPath, statement.outPath);
        }

      });
    });

  // TODO: Delete left-over output directory contents.
}

function parseFile(data, evaluateTemplateCode, filename, vars={}) {
  let parentPath = '';
  let currentlyFilling = '';
  let fillStartIndex = 0;
  let valueDict = {};

  function finishFill(fillEndIndex) {
    if(currentlyFilling) {
      valueDict[currentlyFilling] = data.slice(fillStartIndex, fillEndIndex);
    }
  }

  // First we just need to look for if we're inheriting from a file and if so what we should fill in for the variables. We ignore template code within those variable values, for now we just need to take the data from the fill commands and place it in valueDict, take the necessary data from the inherit command, and remove those commands from our data.
  data.replace(statementRegex, (str, statementStr, stmtStartIndex) => {
    const stmtEndIndex = str.length + stmtStartIndex;
    const statementArray = statementStr.trim().split(' ');
    const command = statementArray[0];
    const args = statementArray.slice(1,str.length);

    switch(command) {
      case "inherit":
        if(assert(args.length == 1, "One argument must be passed to 'inherit' command.", filename) ||
           assert(parentPath == '', "There cannot be more than one 'inherit' command in a file.", filename)) {
             return "";
           }

        parentPath = path.join(descPath, args[0]);
        return "";

      case "fill":
        finishFill(stmtStartIndex);
        fillStartIndex = stmtEndIndex;

        if(assert(parentPath != '', "A parent path must be provided through an 'inherit' command before a 'fill' command can be used.", filename) ||
           assert(args.length == 1, "One argument must be passed to 'fill' command.", filename)) {
             currentlyFilling = '';
             return "";
           }

        currentlyFilling = args[0];
        return "";

    }
    return str;
  });

  finishFill(data.length);

  if(parentPath) {
    if(assert(valueDict, "At least one 'fill' command must be provided if an 'inherit' command is used.", filename)) {
      valueDict["."] = data; // @Incomplete: what's the best behavior when no 'fill' commands are provided? For now just using the entire input data as output.
    }
  } else {
    valueDict["."] = data;
  }

  for(key in valueDict) {
    valueDict[key] = valueDict[key].replace(statementRegex, (str, statementStr, stmtStartIndex) => {
      const statementArray = statementStr.trim().split(' ');

      if(statementArray[0][0] === '-') {
        let variable = statementArray[0].slice(1);

        if(assert(variable.length > 0, "A '-' (denoting a variable) must be directly followed by a variable name.", filename) ||
           assert(variable in vars, "Variable '" + variable + "' must be set.", filename)) {
             return str; // @Incomplete: what's the best behavior when a variable is not found? For now just outputting the command itself as if it were raw text.
           }
        return vars[variable];
      }

      const command = statementArray[0];
      const args = statementArray.slice(1,str.length);

      switch(command) {
        default:
          err("Unknown command " + command, filename);
          return str; // @Incomplete: what's the best behavior when a command is unknown? For now just outputting the command itself as if it were raw text.
      }
    });
  }
  if(parentPath) {
    const newVars = {};

    Object.keys(vars)
      .forEach(key => newVars[key] = vars[key]);

    Object.keys(valueDict)
      .forEach(key => newVars[key] = valueDict[key]);

    return parseFile(fs.readFileSync(parentPath).toString('utf8'), true, parentPath, newVars);
  } else {
    return valueDict["."];
  }

}

updateSite();

if(process.argv[2] == "watch") {

    fs.watch(descPath, {
      recursive: true
    }, (event, trigger) => {
      try {
        updateSite();
      } catch (error) {
        println(error);
      }
    });
}
