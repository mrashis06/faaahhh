import { list, put, del } from '@vercel/blob';

const MAX_BYTES = 5 * 1024 * 1024;
const valid = b => b && /^[a-f0-9-]{36}$/i.test(b.id) && typeof b.filename === 'string' && ((b.fileType==='c' && b.filename.toLowerCase().endsWith('.c') && typeof b.source==='string') || (b.fileType!=='c' && b.filename.toLowerCase().endsWith('.ipynb') && Array.isArray(b.notebook?.cells) && Array.isArray(b.cells)));
const respond = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function GET() {
  try {
    const books = [];
    let cursor;
    for (const prefix of ['notebooks/','c-files/']) { cursor = undefined; do {
      const page = await list({ prefix, limit: 1000, cursor });
      const pageBooks = await Promise.all(page.blobs.map(async blob => {
        try { const response = await fetch(blob.url); return response.ok ? await response.json() : null; }
        catch { return null; }
      }));
      books.push(...pageBooks.filter(Boolean));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor); }
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
    await put(`${book.fileType==='c'?'c-files':'notebooks'}/${book.id}.json`, raw, { access: 'public', contentType: 'application/json', allowOverwrite: true });
    return respond({ ok: true, id: book.id }, 201);
  } catch { return respond({ error: 'Could not save notebook.' }, 500); }
}


export async function DELETE(request){try{const u=new URL(request.url),id=u.searchParams.get('id'),type=u.searchParams.get('type')==='c'?'c-files':'notebooks';if(!id)return respond({error:'Invalid id'},400);await del(type+'/'+id+'.json');return respond({ok:true})}catch{return respond({error:'Could not delete file'},500)}}
