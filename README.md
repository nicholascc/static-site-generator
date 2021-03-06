
# static-site-generator

---

A simple template language for generating static websites using HTML, JS, and CSS.

`static-site-generator`'s goal is to make development of static websites using raw HTML, CSS, and JS as frictionless as possible by reducing repetition.

## Setup

Currently, this project doesn't have a standalone command-line utility or associated `npm` package, so to use it you just need to clone this git repository and use the included scripts to run the template engine.

To set up a local clone of this project, run:
```
git clone https://github.com/nicholascc/static-site-generator.git
cd static-site-generator
npm install
```

## Usage

---

### Basic directory structure

```
.
├── desc/
│   ├── out.txt
│   ├── global.json
│   └── other files...
└── gen/
    └── resulting website is placed here...
```

The `static-site-generator` engine takes a description folder (`desc/`) containing templates and other specialized files, and uses that data to generate a static website (in the `gen/` folder) which can be hosted using any static file hosting service you like (e.g. Github Pages, Netlify, Surge, Amazon S3).

### Commands

- `npm run serve` - starts a basic web server (using [http-server](https://www.npmjs.com/package/http-server)) which hosts the contents of `gen/` at http://localhost:8080/.

- `npm run build` - generates a website based on the description (in `desc/`)

- `npm run watch` - starts a process watching for changes in `desc/`; upon any updates to `desc/` it regenerates the website based on the updated description. Note that this command currently doesn't watch subdirectories of `desc/` and doesn't delete files in `gen/` once their corresponding description files are removed (these are both bugs and should be fixed).

Recommended usage is to run both `serve` and `watch` simultaneously so that you can view new changes in your web browser just by refreshing the page.

### Special description files

The `desc/` folder contains 2 special files: `out.txt` and `global.json`.

`global.json` is a JSON file parsed as a flat dictionary defining global variables that can be used in any template.

`out.txt` directs the template engine on how to translate the description to a generated site. Each line represents a copy operation where one file or directory in the `desc/` folder is moved to the `gen/` folder, with files optionally passing through the template engine first.

For example:

```
# Comments are prefixed by a '#' character
index.css >> index.css

# The '$' character in the below instruction means that this file should be evaluated with the template engine before copying
home_page.html >$> index.html

# Directories can be copied as well as files.
img/ >> img/
```

The above `out.txt` file will cause the generator, when run, to
1. copy `desc/index.css` to `gen/index.css`
2. execute `desc/home_page.html` with the template engine and copy it to `gen/index.html`
3. copy `desc/img/` and its contents to `gen/img/`

### The template engine file format

The template engine is designed for HTML, but it also works with any other plain-text file format. Template commands are delimited with `$<` and `>$` and have space-separated arguments; for example, a command to define the variable `contents` would be written like `$<def contents>$`.

#### Commands:

* A variable literal starts with `-`. For example, `$<-content>$` will be replaced by the value stored in variable `content`.

* The `def` command takes all the lines that follow it until the end of the file or another `def` command, and places those lines in the variable named by its second argument. Note that all variables are constant and cannot be redefined.

* The `inherit` command can only occur once in a file and should be placed in the file's first line. If an `inherit` command is encountered in a file, then that file will only be used to define variables, and once those variables are defined, the template engine will move to generating using the file referenced by the inherit command (that file can also inherit from another file; the command is recursive).

For example, if a file `home.html` has the following data:

```
$<inherit website.html>$

$<def body>$
<h1>
  This is the website's home page.
</h1>
```

and `website.html` has the following data:

```
<!DOCTYPE html>
<html>
<head>
  <title>Example Website</title>
</head>
<body>
  <!-- A website header might be included here -->
  <div class="body">
    $<-body>$
  </div>
</body>
```

then the template engine, when evaluated on `home.html`, will output the file:

```
<!DOCTYPE html>
<html>
<head>
  <title>Example Website</title>
</head>
<body>
  <!-- TODO: Add a website header here. -->
  <div class="body">
    <h1>
      This is the website's home page.
    </h1>
  </div>
</body>
```

Nothing about this process is specific to HTML; `static-site-generator` will work just as well for any other plain-text file format.
