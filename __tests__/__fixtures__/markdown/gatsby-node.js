const path = require(`path`)

exports.createPages = async ({graphql, getNode, actions}) => {
  const {createPage} = actions
  const data = await graphql(`{ allMarkdownRemark { nodes { id, parent { id } }}}`)
  const template = path.resolve(`./src/templates/markdown.js`)
  data.data.allMarkdownRemark.nodes.forEach(node => {
    const fileNode = getNode(node.parent.id)
    createPage({
      path: `/${fileNode.name}`,
      component: template,
      context: {
        id: node.id
      },
    })
  })
}
