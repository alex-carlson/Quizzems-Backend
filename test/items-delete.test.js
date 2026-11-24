import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://supabase.example.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

let mockFetch;
globalThis.fetch = (...args) => mockFetch(...args);
const { RemoveItemFromCollection } = await import('../controllers/itemsController.js');

async function removeItem({ items, cards, itemId, cardError = false }) {
    const collection = {
        id: 1,
        category: 'Quiz',
        author_public_id: 2,
        collaborators: [],
        items: structuredClone(items)
    };
    const remainingCards = structuredClone(cards);
    const requests = [];
    mockFetch = async (input, init) => {
        const url = new URL(input);
        const method = init.method;
        requests.push({ url, method });
        let body;

        if (url.pathname === '/rest/v1/profiles' && method === 'GET') {
            body = [{ public_id: 2 }];
        } else if (url.pathname === '/rest/v1/collections' && method === 'GET') {
            body = [collection];
        } else if (url.pathname === '/rest/v1/collections' && method === 'PATCH') {
            collection.items = JSON.parse(init.body).items;
            body = { id: collection.id };
        } else if (url.pathname === '/rest/v1/cards' && method === 'DELETE') {
            if (cardError) {
                return new Response(JSON.stringify({ message: 'Card deletion failed' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            const deleted = [];
            for (let i = remainingCards.length - 1; i >= 0; i--) {
                const card = remainingCards[i];
                if (url.searchParams.get('id') === `eq.${card.id}` &&
                    url.searchParams.get('collection') === `eq.${card.collection}`) {
                    deleted.push({ id: card.id });
                    remainingCards.splice(i, 1);
                }
            }
            body = deleted;
        } else {
            throw new Error(`Unexpected request: ${method} ${url}`);
        }

        return new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    };

    const response = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };

    await RemoveItemFromCollection({
        body: { category: 'Quiz', itemId, author_id: 2 },
        headers: { authorization: 'Bearer test-token' },
        user: { id: 'user-id' }
    }, response);

    return { response, collection, remainingCards, requests };
}

test('deletes only the matching ID when question and answer are duplicated', async () => {
    const items = [
        { id: 'first', question: 'Same?', answer: ['Yes'] },
        { id: 'second', question: 'Same?', answer: ['Yes'] }
    ];
    const result = await removeItem({
        items,
        cards: [{ id: 'first', collection: 1 }, { id: 'second', collection: 1 }],
        itemId: 'first'
    });

    assert.equal(result.response.statusCode, 200);
    assert.deepEqual(result.response.body.items, [items[1]]);
    assert.deepEqual(result.remainingCards, [{ id: 'second', collection: 1 }]);
});

test('deletes a card missing from embedded items without changing the collection', async () => {
    const items = [{ id: 'other', question: 'Same?', answer: ['Yes'] }];
    const result = await removeItem({
        items,
        cards: [{ id: 'orphan', collection: 1 }],
        itemId: 'orphan'
    });

    assert.equal(result.response.statusCode, 200);
    assert.deepEqual(result.response.body.items, items);
    assert.deepEqual(result.remainingCards, []);
    assert.equal(result.requests.some(request => request.method === 'PATCH'), false);
});

test('does not delete a card from another collection', async () => {
    const result = await removeItem({
        items: [],
        cards: [{ id: 'other-card', collection: 2 }],
        itemId: 'other-card'
    });

    assert.equal(result.response.statusCode, 404);
    assert.deepEqual(result.remainingCards, [{ id: 'other-card', collection: 2 }]);
});

test('reports card deletion failures', async () => {
    const result = await removeItem({
        items: [],
        cards: [{ id: 'orphan', collection: 1 }],
        itemId: 'orphan',
        cardError: true
    });

    assert.equal(result.response.statusCode, 500);
    assert.equal(result.response.body.error, 'Failed to delete card');
});
