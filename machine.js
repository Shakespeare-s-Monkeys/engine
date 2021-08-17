const fetchMachine = Machine({
  id: `operation`,
  initial: `running`,
  context: {
    retries: 0,
  },
  states: {
    running: {
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

const nodeMachine = Machine({
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
