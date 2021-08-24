const { run } = require(`shakespeares-monkeys`)
const fs = require(`fs-extra`)

async function createOperator(id) {
  console.log(`createOperator`, id)
  const newValue = Math.random()
  await fs.outputFile(
    `./src/pages/${id}/index.md`,
    `---
title: "${newValue}"
---

sup`
  )

  return {
    selector: `h1`,
    pagePath: `/${id}/`,
    value: newValue.toString(),
  }
}

async function deleteOperator(id) {
  await fs.unlink(`./src/pages/${id}/index.md`)

  return
}

const config = {
  rootUrl: `http://localhost:8000`,
  operators: {
    create: createOperator,
    delete: deleteOperator,
  },
  operationsLimit: 6,
  interval: 2,
}

run(config,
  (state) => {
    console.log(`event: `, state.event.type)
    if (state.changed) {
      console.log(state.value, state.context)
    }
  }
)


