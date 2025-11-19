import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';

// GraphQL code
import { ApolloServer } from 'apollo-server-express';
import typeDefs from './typeDefs.js';

const resolvers = {
    Query: {
        hello: () => 'Hello World!',
    },
}

const server = new ApolloServer({ typeDefs, resolvers });

async function createApp() {
    await server.start();

    const app = express();
    server.applyMiddleware({ app });

    app.use(cors());

    app.use(express.json());

    app.use('/', routes);

    return app;
}

export default createApp;
