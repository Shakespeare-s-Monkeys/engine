const {
  createMachine,
  assign,
  spawn,
  interpret,
  send,
  sendParent,
} = require(`xstate`)
const util = require(`util`)
const fs = require(`fs-extra`)
const got = require(`got`)
const { parse } = require(`node-html-parser`)

async function createFileService(id) {
  console.log(`in createFileService`)
  const newValue = Math.random()
  await fs.writeFile(
    `./src/pages/${id}.md`,
    `---
title: "${newValue}"
---

sup`
  )

  return {
    selector: `#title`,
    pagePath: `/${id}`,
    value: newValue.toString(),
  }
}

const checkIfDeployed = async ({ selector, pagePath, rootUrl }) => {
  const pageURL = `${rootUrl}${pagePath}`
  console.log({ pageURL })

  let response
  try {
    response = await got(pageURL)
  } catch (e) {
    console.log(e)
    // Ignore 404 errors and just return
    return { statusCode: response.statusCode }
  }

  const root = parse(response.body)

  const value = root.querySelector(selector)?.rawText

  return { value, statusCode: response.statusCode }
}

async function checkOperation(id) {
  console.log(`in checkOperation`)
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ completed: true })
    }, 1000)
  })
}

function createEngineMachine(context) {
  return createMachine({
    id: `operation`,
    initial: `running`,
    context: {
      operations: [],
      nodes: [],
      interval: 10,
      operationsCount: 20,
      rootUrl: ``,
      ...context,
    },
    states: {
      running: {},
    },
    on: {
      TICK: {
        actions: assign({
          operations: (context) => {
            const newOperation = spawn(
              createOperationMachine({
                id: 1,
                verb: `create`,
                rootUrl: context.rootUrl,
              }),
              {
                // sync: true,
              }
            )
            return [...context.operations, newOperation]
          },
        }),
      },
      NODE_UPDATED: {
        actions: assign({
          nodes: (context, event) => {
            return [...context.nodes, event.eventData]
          },
        }),
      },
    },
  })
}

function createOperationMachine(context) {
  return createMachine({
    id: `operation`,
    initial: `operating`,
    context: { ...context, createdAt: Date.now() },
    states: {
      operating: {
        invoke: {
          id: `runOperation`,
          src: (context) => {
            switch (context.verb) {
              case `create`:
                return createFileService(context.id)
              case `delete`:
                return deleteFileService(context.id)
              default:
              // code block
            }
          },
          onDone: {
            target: `checking`,
            actions: [
              assign({ node: (_, event) => event.data }),
              sendParent((_, event) => {
                const action = {
                  type: `NODE_UPDATED`,
                  eventData: { ...event.data, id: context.id },
                }
                return action
              }),
            ],
          },
          onError: {
            target: `failure`,
            actions: assign({ error: (_, event) => event.data }),
          },
        },
      },
      checking: {
        invoke: {
          id: `checkOperationCompleted`,
          src: (context, event) => async (callback, onReceive) => {
            let finished = false
            while (!finished) {
              const res = await checkIfDeployed({
                selector: context.node.selector,
                pagePath: context.node.pagePath,
                value: context.node.value,
                rootUrl: context.rootUrl,
              })
              if (res.statusCode !== 200 || res.value !== context.node.value) {
                callback({ type: `FAILED_CHECK`, res })
              } else {
                finished = true
                callback({ type: `SUCCESS`, res })
              }
            }
          },
        },
        on: {
          FAILED_CHECK: {
            actions: (_, event) => console.log(`got TEST`, event),
          },
          SUCCESS: {
            target: `completed`,
            actions: assign({
              completedAt: Date.now(),
              elapsed: (context) => Date.now() - context.createdAt,
            }),
          },
        },
      },

      completed: {
        type: `final`,
      },
      failure: {
        type: `final`,
      },
    },
  })
}

// invoke service to create file and return to operation and it returns it to engine
// operation machine invokes check callback service which responds with events of failed and success checks
//
// TODO still
// on shutdown, engine create delete operations for nodes.
// log everything w/ Pino & child loggers
// then refactor all this code to the engine proper & rework the markdown example with the engine.

const nodeMachine = createMachine({
  id: `node`,
  initial: `creating`,
  context: {
    retries: 0,
  },
  states: {
    creating: {
      on: {
        FOUND: `completed`,
        FAILURE: `failure`,
      },
    },
    completed: {
      type: `final`,
    },
    failure: {
      type: `final`,
    },
  },
})

const engineService = interpret(
  createEngineMachine({
    interval: 1,
    rootUrl: `http://localhost:9000`,
  })
).onTransition((state) =>
  console.log(
    `engine transition`,
    state.event.type,
    `operations`,
    util.inspect(
      state.context.operations.map((o) => {
        return {
          value: o.state.value,
          context: o.state.context,
        }
      }),
      false,
      null,
      true /* enable colors */
    ),
    `nodes`,
    util.inspect(state.context.nodes, false, null, true /* enable colors */)
  )
)

// Start the service
engineService.start()

engineService.send({ type: `TICK` })
