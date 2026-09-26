import { gql } from '@apollo/client';

// Query is the only object in the bootstrap schema; replace it with a domain type when available.
export const exampleFragment = gql`
  fragment Example on Query {
    hello(name: "World")
  }
`;
