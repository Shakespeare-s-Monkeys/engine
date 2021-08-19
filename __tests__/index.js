const { createEngineMachine } = require(`../machine`)
const http = require(`http`)
const { interpret } = require(`xstate`)
const util = require(`util`)

it(`can create nodes, check if they exist, and then delete nodes and check they're gone`, async (done) => {
  const nodes = new Set()
  let serverCalled = false
  let createOperatorCallCount = 0
  let deleteOperatorCallCount = 0

  // Create a local server to receive data from
  const server = http.createServer((req, res) => {
    serverCalled = true
    const id = req.url.slice(1)
    if (nodes.has(id)) {
      res.writeHead(200)
      res.end(`<div id="selectme">${req.url.slice(1)}</div>`)
    } else {
      res.writeHead(404).end()
    }
  })

  server.listen(8100)

  async function createOperator(id) {
    nodes.add(id.toString())
    createOperatorCallCount += 1
    return {
      pagePath: `/${id}`,
      selector: `#selectme`,
      value: `${id}`,
    }
  }

  async function deleteOperator(id) {
    nodes.delete(id.toString())
    deleteOperatorCallCount += 1
    return
  }

  const config = {
    rootUrl: `http://localhost:8100`,
    operators: {
      create: createOperator,
      delete: deleteOperator,
    },
    operationsLimit: 4,
    interval: 0.2,
  }

  const engineService = interpret(createEngineMachine(config)).onTransition(
    (state) => {
      if (state.value === `done`) {
        // console.log(`DONE`)
        // console.log({
        // serverCalled,
        // createOperatorCallCount,
        // deleteOperatorCallCount,
        // nodesSize: nodes.size,
        // operationsLength: state.context.operations.length,
        // inFlight: Object.values(state.context.nodes).some(
        // (node) => node.inFlight
        // ),
        // })
        // console.log(Object.values(state.context.nodes))
        server.close()
        expect(serverCalled).toBeTruthy()
        expect(createOperatorCallCount).toBe(2)
        expect(deleteOperatorCallCount).toBe(2)
        expect(nodes.size).toBe(0)
        expect(state.context.operations.length).toBe(4)
        expect(Object.values(state.context.nodes).length).toBe(2)
        expect(
          Object.values(state.context.nodes).some((node) => node.inFlight)
        ).toBe(false)
        done()
      }
    }
  )

  // Start the service
  engineService.start()
})
