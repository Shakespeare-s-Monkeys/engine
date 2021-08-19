import * as React from "react"
import {graphql} from "gatsby"

export default function MarkdownTemplate ({data}) {
  console.log({data})

  return <div id="title">{data.markdownRemark.frontmatter.title}</div>
}

export const query = graphql`
  query ($id: String!) {
    markdownRemark(id: { eq: $id }) {
      id
      frontmatter {
        title
      }
    }
  }
`
