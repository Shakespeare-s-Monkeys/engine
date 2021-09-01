const { createEngineMachine } = require(`../`)
const http = require(`http`)
const { interpret } = require(`xstate`)
const fs = require(`fs-extra`)
const execa = require(`execa`)
const path = require(`path`)

it(`can create nodes, check if they exist, and then delete nodes and check they're gone`, (done) => {
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

  async function deleteOperator(node) {
    nodes.delete(node.id.toString())
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

it.only(`can make updates to a pool of pre-existing nodes`, (done) => {
  console.log(`hi`)
  const nodes = new Set()
  let serverCalled = false
  let updateOperatorCallCount = 0

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

  async function updateOperator(id) {
    nodes.add(id.toString())
    updateOperatorCallCount += 1
    return {
      pagePath: `/${id}`,
      selector: `#selectme`,
      value: `${id}`,
    }
  }

  const config = {
    rootUrl: `http://localhost:8100`,
    operators: {
      update: updateOperator,
    },
    nodePool: [
      {
        id: 1,
      },
      {
        id: 2,
      },
      {
        id: 3,
      },
    ],
    operationsLimit: 5,
    interval: 0.2,
  }

  const engineService = interpret(createEngineMachine(config)).onTransition(
    (state) => {
      if (state.changed) {
        console.log(
          state.event.type,
          state.value,
          state.context.operations.map((o) => o.state.context.id),
          state.context.nodes
        )
      }
      if (state.value === `done`) {
        console.log(`DONE`, {
          serverCalled,
          updateOperatorCallCount,
          nodes,
          operationsLength: state.context.operations.length,
          nodesLength: Object.values(state.context.nodes).length,
        })
        server.close()
        expect(serverCalled).toBeTruthy()
        expect(updateOperatorCallCount).toBe(5)
        expect(state.context.operations.length).toBe(5)
        expect(Object.values(state.context.nodes).length).toBe(3)
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
