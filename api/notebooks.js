import { list, put } from '@vercel/blob';

const MAX_BYTES = 5 * 1024 * 1024;
const valid = b => b && /^[a-f0-9-]{36}$/i.test(b.id) && typeof b.filename === 'string' && b.filename.toLowerCase().endsWith('.ipynb') && Array.isArray(b.notebook?.cells) && Array.isArray(b.cells);
const respond = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function GET() {
  try {
    const books = [];
    let cursor;
    do {
      const page = await list({ prefix: 'notebooks/', limit: 1000, cursor });
      for (const blob of page.blobs) {
        const response = await fetch(blob.url);
        if (response.ok) books.push(await response.json());
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return respond(books);
  } catch { return respond({ error: 'Could not load notebooks.' }, 500); }
}

export async function POST(request) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BYTES) return respond({ error: 'Notebook is too large (5 MB maximum).' }, 413);
  let book;
  try { book = JSON.parse(raw); } catch { return respond({ error: 'Invalid JSON.' }, 400); }
  if (!valid(book)) return respond({ error: 'Upload a valid .ipynb notebook.' }, 400);
  try {
    await put(`notebooks/${book.id}.json`, raw, { access: 'public', contentType: 'application/json', allowOverwrite: true });
    return respond({ ok: true, id: book.id }, 201);
  } catch { return respond({ error: 'Could not save notebook.' }, 500); }
}

