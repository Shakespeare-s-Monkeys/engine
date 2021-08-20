const { createEngineMachine } = require(`../../../machine`)
const { interpret } = require(`xstate`)
const fs = require(`fs-extra`)

async function createOperator(id) {
  console.log(`createOperator`, id)
  const newValue = Math.random()
  await fs.writeFile(
    `./src/pages/s-${id}.md`,
    `---
title: "${newValue}"
---

sup`
  )

  return {
    selector: `#title`,
    pagePath: `/s-${id}`,
    value: newValue.toString(),
  }
}

async function deleteOperator(id) {
  await fs.unlink(`./src/pages/s-${id}.md`)

  return
}

const config = {
  rootUrl: `http://localhost:8000`,
  operators: {
    create: createOperator,
    delete: deleteOperator,
  },
  operationsLimit: 4,
  interval: 2,
}.nodes

const engineService = interpret(createEngineMachine(config)).onTransition(
  (state) => {
    console.log(state.value, state.event.type, state.context)
  }
)

engineService.start()
