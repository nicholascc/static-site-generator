const fs = require('fs-extra')
const path = require('path');
const chalk = require('chalk');

const println = console.log;
const colorEnabled = !process.argv.includes("--nocolor");

const descPath = "./site-description";
const outDescPath = path.join(descPath, "out.txt");
const outPath = "./site";

const statementRegex = /\$\<(.*?)\>\$/g;

function err(message) {
  if(colorEnabled) println(chalk.redBright("⚠ Error:", message));
  else println("⚠ Error:", message);
}

function assert(x, message) {
  if(!x) {
    err(message);
  }
  return !x;
}

function updateSite() {
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
      fs.readFile(statement.inPath, function (err, data) {
        if(err) {
          throw err;
        }
        data = data.toString('utf8');

        if(statement.evaluateTemplateCode) {
          data = parseFile(data, statement);
          try {
            fs.ensureDirSync(path.dirname(statement.outPath));
            fs.writeFileSync(statement.outPath, data);
          } catch (error) {
            err(error);
          }
        } else {
          //println("Skipping evaluating template code in file", statement.inPath);
          fs.copyFile(statement.inPath, statement.outPath);
        }

      });
    });

  // TODO: Delete left-over output directory contents.

  println("Updating website.");
}

function parseFile(data, evaluateTemplateCode, slots={}) {
  let parentPath = '';
  let currentlyFilling = '';
  let fillStartIndex = 0;
  let fillDict = {};

  function finishFill(fillEndIndex) {
    if(currentlyFilling) {
      fillDict[currentlyFilling] = data.slice(fillStartIndex, fillEndIndex);
    }
  }

  // First we just need to look for if we're inheriting from a file and if so what we should fill in for the slots. We ignore template code within those slots, for now we just need to take the data from the fill commands and place it in fillDict, take the necessary data from the inherit command, and remove those commands from our data.
  data.replace(statementRegex, (str, statementStr, stmtStartIndex) => {
    const stmtEndIndex = str.length + stmtStartIndex;
    const statementArray = statementStr.split(' ');
    const command = statementArray[0];
    const args = statementArray.slice(1,str.length);

    switch(command) {
      case "inherit":
        if(assert(args.length == 1, "One argument must be passed to 'inherit' command.") ||
           assert(parentPath == '', "There cannot be more than one 'inherit' command in a file.")) {
             return "";
           }

        parentPath = path.join(descPath, args[0]);
        return "";

      case "fill":
        finishFill(stmtStartIndex);
        fillStartIndex = stmtEndIndex;

        if(assert(parentPath != '', "A parent path must be provided through an 'inherit' command before a 'fill' command can be used.") ||
           assert(args.length == 1, "One argument must be passed to 'fill' command.")) {
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
    if(assert(fillDict, "At least one 'fill' command must be provided if an 'inherit' command is used.")) {
      fillDict["."] = data; // @Incomplete: what's the best behavior when no 'fill' commands are provided? For now just using the entire input data as output.
    }
  } else {
    fillDict["."] = data;
  }

  for(key in fillDict) {
    fillDict[key] = fillDict[key].replace(statementRegex, (str, statementStr, stmtStartIndex) => {
      const statementArray = statementStr.split(' ');
      const command = statementArray[0];
      const args = statementArray.slice(1,str.length);

      switch(command) {
        case "slot":
          if(assert(args.length == 1, "One argument must be passed to 'slot' command.") ||
             assert(args[0] in slots, "Slot '" + args[0] + "' must be filled.")) {
               return str; // @Incomplete: what's the best behavior when a slot command fails? For now just outputting the command itself as if it were raw text.
             }
          return slots[args[0]];
        default:
          err("Unknown command " + command);
          return str; // @Incomplete: what's the best behavior when a command is unknown? For now just outputting the command itself as if it were raw text.
      }
    });
  }
  if(parentPath) {
    return parseFile(fs.readFileSync(parentPath).toString('utf8'), true, fillDict);
  } else {
    return fillDict["."];
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
