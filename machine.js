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
const { setTimeout } = require(`timers/promises`)
const NanoTimer = require(`nanotimer`)
const prettyMilliseconds = require(`pretty-ms`)
const asciichart = require(`asciichart`)
const _ = require(`lodash`)

async function createFileService(id) {
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

const checkIfDeployed = async ({ selector, pagePath, rootUrl }) => {
  const pageURL = `${rootUrl}${pagePath}`

  let response
  try {
    response = await got(pageURL)
  } catch (e) {
    // Ignore 404 errors and just return
    return { statusCode: e.response.statusCode }
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

let idCounter = 0
function getNextId() {
  idCounter += 1
  return idCounter
}

function createEngineMachine(context) {
  return createMachine({
    id: `engine`,
    strict: true,
    initial: `running`,
    context: {
      operations: [],
      nodes: [],
      interval: 10,
      operationsLimit: 20,
      rootUrl: ``,
      createdAt: Date.now(),
      ...context,
    },
    states: {
      running: {
        invoke: {
          src: (context) => (cb) => {
            const timer = new NanoTimer()
            timer.setInterval(() => cb(`TICK`), ``, `${context.interval}s`)

            return () => {
              timer.clearInterval()
            }
          },
        },
        always: [
          {
            target: `done`,
            cond: (context) => {
              const readyToBeDone =
                context.operations.length >= context.operationsLimit &&
                !context.operations.some((op) => op.state.value !== `completed`)

              console.log(
                context.operations.length,
                context.operationsLimit,
                context.operations.map((op) => op.state.value)
              )
              console.log(`running`, { readyToBeDone })

              return readyToBeDone
            },
          },
        ],
        on: {
          TICK: {
            actions: assign({
              operations: (context) => {
                if (context.operations.length < context.operationsLimit) {
                  console.log(`creating operation`)
                  const newOperation = spawn(
                    createOperationMachine({
                      id: getNextId(),
                      verb: `create`,
                      rootUrl: context.rootUrl,
                    }),
                    {
                      // sync: true,
                    }
                  )
                  return [...context.operations, newOperation]
                } else {
                  return context.operations
                }
              },
            }),
          },
        },
      },
      done: {
        type: `final`,
        entry: (context) => {
          console.log(`I'm done`)
          console.log(context)
          const completedAt = Date.now()
          const runTime = completedAt - context.createdAt

          console.log(`Run finished and took ${prettyMilliseconds(runTime)}`)
          console.log(
            `Average time / operation: ${prettyMilliseconds(
              _.sumBy(context.operations, (op) => op.state.context.latency) /
                context.operations.length
            )}`
          )
          console.log(
            `\n` +
              asciichart.plot(
                context.operations.map((op) => op.state.context.latency),
                { height: 6 }
              )
          )
        },
      },
    },
    on: {
      NODE_UPDATED: {
        actions: assign({
          nodes: (context, event) => {
            return [...context.nodes, event.eventData]
          },
        }),
      },
      // OPERATION_COMPLETED: [
      // {
      // target: `done`,
      // cond: (context) => {
      // const readyToBeDone =
      // context.operations.length >= context.operationsLimit &&
      // !context.operations.some((op) => op.state.value === `running`)

      // console.log(
      // context.operations.length,
      // context.operationsLimit,
      // context.operations.some((op) => op.state.value === `running`)
      // )
      // console.log(`OPERATION_COMPLETED`, { readyToBeDone })

      // return readyToBeDone
      // },
      // },
      // { target: `waiting` },
      // ],
    },
  })
}

function createOperationMachine(context) {
  return createMachine({
    id: `operation`,
    strict: true,
    initial: `running`,
    context: { ...context, createdAt: Date.now(), checks: [], checkCount: 0 },
    states: {
      running: {
        invoke: {
          id: `runOperation`,
          src: (context) => {
            console.log({ context })
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
                callback({
                  type: `FAILED_CHECK`,
                  res: { ...res, timestamp: Date.now() },
                })
                await setTimeout(50)
              } else {
                finished = true
                callback({ type: `SUCCESS`, res })
              }
            }
          },
        },
        on: {
          FAILED_CHECK: {
            actions: assign({
              checks: (context, event) => [...context.checks, event.res],
              checkCount: (context) => (context.checkCount += 1),
            }),
          },
          SUCCESS: {
            target: `completed`,
            actions: assign({
              completedAt: Date.now(),
              latency: (context) => Date.now() - context.createdAt,
            }),
          },
        },
      },

      completed: {
        type: `final`,
        entry: sendParent(() => {
          const action = {
            type: `OPERATION_COMPLETED`,
          }
          return action
        }),
      },
      failure: {
        type: `final`,
        entry: sendParent(() => {
          const action = {
            type: `OPERATION_FAILED`,
          }
          return action
        }),
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
// make operationsLimit work — scale up the number of nodes and then start deleting them.
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
    operationsLimit: 10,
    rootUrl: `http://localhost:9000`,
  })
).onTransition((state) =>
  console.log(
    `engine transition`,
    state.value,
    state.event.type,
    `operations`,
    util.inspect(
      state.context.operations.map((o) => {
        return {
          value: o.state.value,
          // context: o.state.context,
        }
      }),
      false,
      null,
      true /* enable colors */
    ),
    `nodes`,
    state.context.nodes.length
    // util.inspect(state.context.nodes, false, null, true [> enable colors <])
  )
)

// Start the service
engineService.start()
