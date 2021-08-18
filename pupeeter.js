const puppeteer = require(`puppeteer`)
const NanoTimer = require(`nanotimer`)
const _ = require(`lodash`)
const fs = require(`fs-extra`)
const { setTimeout } = require(`timers/promises`)
const http = require(`http`)
const prettyMilliseconds = require(`pretty-ms`)
const asciichart = require(`asciichart`)
const { parse } = require(`node-html-parser`)
const got = require(`got`)

function hitWebhook() {
  const options = {
    hostname: `localhost`,
    port: 8000,
    path: `/__refresh`,
    method: `POST`,
  }

  const req = http.request(options, (res) => {
    // console.log(`statusCode: ${res.statusCode}`)

    res.on(`data`, (d) => {
      process.stdout.write(d)
    })
  })

  req.on(`error`, (error) => {
    console.error(error)
  })

  req.end()
}

const states = {
  COMPLETED: `COMPLETED`,
  FAILED: `FAILED`,
  RUNNING: `RUNNING`,
}

let last = Date.now()
const is404 = async ({ pagePath, rootUrl }) => {
  let finished = false
  async function loop() {
    const browser = await puppeteer.launch()

    const page = await browser.newPage()
    const response = await page.goto(`${rootUrl}${pagePath}`)
    console.log(`deleted page ${pagePath} statusCode: ${response.status()}`)
    console.trace()
    // If it's a 404 page, exit loop and try again.
    return response.status()
  }

  while (!finished) {
    const status = await loop()
    if (status !== 404) {
    }
    if (status === 404) {
      finished = true
      return states.COMPLETED
    }
  }
}

const waitForChange = async ({ selector, value, pagePath, rootUrl }) => {
  let finished = false
  async function loop() {
    const pageURL = `${rootUrl}${pagePath}`

    let html
    try {
      html = await got(pageURL).text()
    } catch {
      // Ignore 404 errors and just return
      return
    }

    const root = parse(html)

    const value = root.querySelector(selector)?.rawText
    return value

    // const browser = await puppeteer.launch()

    // const page = await browser.newPage()
    // const response = await page.goto(`${rootUrl}${pagePath}`)
    // console.log(`page ${pagePath} statusCode: ${response.status()}`)
    // // If it's a 404 page, exit loop and try again.
    // if (response.status() === 404) {
    // return false
    // }

    // await page.waitForFunction(
    // `document.getElementById("gatsby-focus-wrapper")`
    // )

    // let element
    // try {
    // element = await page.waitForSelector(selector, { timeout: 1500 })
    // } catch (e) {
    // return states.FAILED
    // }
    // const value = await element.evaluate((el) => el.textContent)
    // const now = Date.now()
    // const diff = now - last
    // last = now

    // await browser.close()

    return value
  }

  while (!finished) {
    const latestValue = await loop()
    if (latestValue === states.FAILED) {
      finished = true
      return states.FAILED
    }
    if (value === latestValue) {
      // console.log({value, latestValue})
      finished = true
      return states.COMPLETED
    }
  }
}

async function writeFile(id) {
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

async function deleteFile(id) {
  await fs.unlink(`./src/pages/${id}.md`)

  return {
    pagePath: `/${id}`,
  }
}

const actor = {
  create: async (id) => writeFile(id),
  delete: async (id) => deleteFile(id),
}

async function engine() {
  const startRun = Date.now()
  const config = {
    interval: 0.6,
    operationsCount: 20,
    rootUrl: `http://localhost:9000`,
  }

  const timer = new NanoTimer()
  const nodePool = []

  timer.setInterval(tick, ``, `${config.interval}s`)

  let operations = []
  let nodes = []

  function areWeDone() {
    return (
      finishedStartingOperations &&
      !operations.some((op) => op.state === states.RUNNING)
    )
  }

  let finishedStartingOperations = false
  let tickCount = 0
  async function tick() {
    tickCount += 1
    console.log({ tickCount, operationsCount: config.operationsCount })
    if (tickCount > config.operationsCount) {
      finishedStartingOperations = true
      timer.clearInterval()

      if (areWeDone()) {
        onExit()
      }
      return
    }

    let operation
    if (tickCount === 8) {
      operation = {
        id: `s-1`,
        verb: `delete`,
        state: states.RUNNING,
      }
    } else {
      operation = {
        id: `s-${tickCount}`,
        verb: `create`,
        state: states.RUNNING,
      }
    }

    nodePool.push(operation.id)

    operations.push(operation)

    const { selector, value, pagePath } = await actor[operation.verb](
      operation.id
    )
    console.log(`operation "${operation.verb}" started for ${pagePath}`)
    const start = Date.now()

    let result

    if (operation.verb === `create`) {
      result = await waitForChange({
        selector,
        value,
        pagePath,
        rootUrl: config.rootUrl,
      })
    }
    if (operation.verb === `delete`) {
      result = await is404({
        pagePath,
        rootUrl: config.rootUrl,
      })
    }

    const end = Date.now()
    operation.state = result
    operation.elapsed = end - start
    console.log(
      `operation "${
        operation.verb
      }" completed for ${pagePath} in ${prettyMilliseconds(end - start)}`
    )

    if (areWeDone()) {
      onExit()
    } else {
      const stateGroups = _.groupBy(operations.map((op) => op.state))
      console.log(
        { finishedStartingOperations },
        operations.length,
        Object.entries(stateGroups).map(
          ([state, ops]) => `${state}: ${ops.length}`
        )
      )
    }
  }

  function onExit() {
    const endRun = Date.now()
    const runTime = endRun - startRun

    console.log(`Run finished and took ${prettyMilliseconds(runTime)}`)
    console.log(
      `Average time / operation: ${prettyMilliseconds(
        _.sumBy(operations, (op) => op.elapsed) / operations.length
      )}`
    )
    console.log(
      asciichart.plot(
        operations.map((op) => op.elapsed),
        { height: 6 }
      )
    )
    console.log(operations)
    process.exit()
  }
}

engine()
