const fs = require('fs');
const path = require('path');

const println = console.log;

const descPath = "./site-description";
const outDescPath = path.join(descPath, "out.txt");
const outPath = "./site";

const statementRegex = /\$\<(.*?)\>\$/g;

function err(message) {
  println("Failed to update site due to an error.")
  println(message);
  println("Exiting...");
  process.exit(1);
}

function assert(x, message) {
  if(!x) {
    err(message);
  }
}

function updateSite() {
  const statementList = fs.readFileSync(outDescPath)
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
    });

  statementList.forEach(function (statement) {
      fs.readFile(statement.inPath, function (err, data) {
        if(err) {
          throw err;
        }
        data = data.toString('utf8');

        if(statement.evaluateTemplateCode) {
          data = parseFile(data, statement);
        } else {
          //println("Skipping evaluating template code in file", statement.inPath);
        }

        fs.writeFileSync(statement.outPath, data);
      });
    });

  // TODO: Delete left-over output directory contents.

  println("Website updated.");
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

  // First we just need to look for if we're inheriting from a file and if so what we should fill in for the slots. We ignore template code within those slots, for now we just need to divide into 'fill' and 'inherit' statements
  data.replace(statementRegex, (str, statementStr, startIndex) => {
    const endIndex = str.length + startIndex;
    const statementArray = statementStr.split(' ');
    const command = statementArray[0];
    const args = statementArray.slice(1,str.length);

    switch(command) {
      case "inherit":
        assert(args.length == 1, "One argument must be passed to 'inherit' command.");
        assert(parentPath == '', "There cannot be more than one 'inherit' command in a file.");

        parentPath = path.join(descPath, args[0]);
        return "";

      case "fill":
        assert(parentPath != '', "A parent path must be provided through an 'inherit' command before a 'fill' command can be used.");
        assert(args.length == 1, "One argument must be passed to 'fill' command.");

        finishFill(startIndex);
        currentlyFilling = args[0];
        fillStartIndex = endIndex;
        return "";

    }
    return str;
  });

  finishFill(data.length);

  if(parentPath) {
    assert(fillDict, "At least one 'fill' command must be provided if an 'inherit' command is used.");
  } else {
    fillDict["."] = data;
  }

  for(key in fillDict) {
    fillDict[key] = fillDict[key].replace(statementRegex, (str, statementStr, startIndex) => {
      const statementArray = statementStr.split(' ');
      const command = statementArray[0];
      const args = statementArray.slice(1,str.length);

      switch(command) {
        case "slot":
          assert(args.length == 1, "One argument must be passed to 'slot' command.");
          assert(args[0] in slots, "Slot '" + args[0] + "' must be filled.");
          return slots[args[0]];
        default:
          err("Unknown command " + command);
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
    updateSite();
  });
}
