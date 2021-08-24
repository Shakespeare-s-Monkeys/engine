const { run } = require(`shakespeares-monkeys`)
const got = require(`got`)

async function createOperator(id) {
  const newValue = Math.random()
  const res = await got.post(
    // replace with the url for your Drupal instance.
    `https://dev-gatsby-drupal-stress-testing.pantheonsite.io/jsonapi/node/article`,
    {
      headers: {
        Accept: `application/vnd.api+json`,
        "Content-type": `application/vnd.api+json`,
        // Replace with the base64 version for your API user's username/password
        Authorization: `Basic BWRtaW58cAFzc3dvcmQ=`,
      },
      responseType: `json`,
      json: {
        data: {
          type: `node--article`,
          attributes: {
            title: `${newValue}`,
            body: {
              value: `Custom value`,
              format: `plain_text`,
            },
          },
        },
      },
    }
  )

  const nodeId = res.body.data.id

  return {
    pagePath: `/${id}`,
    selector: `#title`,
    value: newValue,
    context: {
      // Set the Drupal node id on the context so we can delete it later.
      drupalId: nodeId,
    },
  }
}

async function deleteOperator(node) {
  await got.delete(
    `https://dev-gatsby-drupal-stress-testing.pantheonsite.io/jsonapi/node/article/${node.context.drupalId}`,
    {
      headers: {
        Accept: `application/vnd.api+json`,
        "Content-type": `application/vnd.api+json`,
        Authorization: `Basic BWRtaW58cAFzc3dvcmQ=`,
      },
    }
  )
}

const prodConfig = {
  // replace with the URL of your build/preview instance.
  rootUrl: `https://drupalgatsbyintegrationtestmai.gatsbyjs.io/`,
  operators: {
    create: createOperator,
    delete: deleteOperator,
  },
  operationsLimit: 15,
  interval: 5,
}

run(prodConfig, (state) => {
  console.log(`event: `, state.event.type)
  if (state.changed) {
    console.log(
      state.value,
      `latencies`,
      state.context.operations
        .filter((op) => op.state.value === `completed`)
        .map((op) => op.state.context.latency)
        .join(`\n`),
      state.context.operations
        .filter((op) => op.state.value !== `completed`)
        .map((op) => {
          return {
            value: op.state.value,
            id: op.state.context.id,
            checkCount: op.state.context.checkCount,
          }
        }),
      `nodes`,
      Object.values(state.context.nodes)
        .filter((n) => n.inFlight)
        .map((n) => {
          return {
            pagePath: n.pagePath,
            existsOnCMS: n.existsOnCMS,
            published: n.published,
          }
        })
    )
  }

  if (state.value === `done`) {
    console.log(
      `latencies`,
      state.context.operations.map((op) => op.state.context.latency).join(`\n`)
    )
  }
})
