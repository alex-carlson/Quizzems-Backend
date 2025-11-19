import { gql } from 'apollo-server-express';

const typeDefs = gql`
    type Query {
        hello: String
    }

    type User {
        public_id: Int!
        username: String!
        username_slug: String!
    }

    type QuizScores {
        id: Int!
        percentage: Int!
    }
`;

export default typeDefs;