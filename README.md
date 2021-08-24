# Name TBD

An simulation/e2e/load/fuzz/performance testing tool for Gatsby integrations.

Gatsby sites are distributed systems and TBD name is a framework for
testing them.

This tool lets you setup tests for specific Gatsby sites and integrations.
You provide "operators" that when called, modify data on a backend. The
engine then tests that these modifications correctly come through to the
website and measure the latency.

## How to use

Install the package

`yarn add shakespeares-monkey`

Then import it into a test config file and run:

```
// test.js
const { run } = require(`shakespeares-monkey`)

const config = {...}

run(config, (newState) => {
  // This callback function is called whenever there's
  // an update during running.
  console.log(newState)
})
```

## Config options

- **operators**:
  - **create**: an async function that creates a node in some backend. It's called with an auto-incrementing id (1,2,3,4,etc) for each operation. This is the id of the node that should be created.
    - the create operator must return an object with the following fields.
      - **pagePath**: the relative path for where the page for the created node
      - **value**: A random value set on the node that will also be on the page. This is used by the engine to verify the change came through correctly.
      - **selector**: the css selector for scraping the value from the HTML e.g. `#title` if the value is put into a `<div id="title">` element.
      - **context**: Any additional information the test needs about the node to update or delete it later. E.g. the node's id on the backend.
  - **delete**: an async function that deletes a node in some backend. It's called with the node object.
  - **update**: not yet supported.
- **rootUrl**: The URL of the site that the engine will check for the deployment of the result of an operation. 
- **operationsLimit**: How many operations to run.
- **interval**: The cadence on which the engine will schedule operations.

See the examples folder for sample test code.
