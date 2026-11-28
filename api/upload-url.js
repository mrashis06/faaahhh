import { issueSignedToken, presignUrl, head, put } from '@vercel/blob';

const MAX_BYTES = 50 * 1024 * 1024;
const validId = id => typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id);
const folder = type => type === 'pkt' ? 'pkt-files' : type === 'c' ? 'c-files' : type === 'ipynb' ? 'notebooks' : null;

export async function POST(request) {
  let input;
  try { input = await request.json(); }
  catch { return Response.json({ error: 'Invalid upload request.' }, { status: 400 }); }

  const target = folder(input?.type);
  if (input?.action === 'complete') {
    const meta = input.meta;
    if (!target || !validId(input?.id) || !meta || meta.id !== input.id || typeof meta.filename !== 'string' || meta.filename.length > 255 || !meta.filename.toLowerCase().endsWith(input.type === 'pkt' ? '.pkt' : input.type === 'c' ? '.c' : '.ipynb')) {
      return Response.json({ error: 'Invalid file metadata.' }, { status: 400 });
    }
    try {
      const blob = await head(`${target}/${input.id}.json`);
      if (!blob) throw new Error('Uploaded file not found');
      const summary = {
        id: input.id, filename: meta.filename, title: String(meta.title || meta.filename).slice(0, 255),
        description: String(meta.description || '').slice(0, 500), fileType: input.type,
        tags: Array.isArray(meta.tags) ? meta.tags.slice(0, 20).map(tag => String(tag).slice(0, 60)) : [],
        created: Number(meta.created) || Date.now(), updated: Number(meta.updated) || Date.now(),
        starred: Boolean(meta.starred), collection: meta.collection ? String(meta.collection).slice(0, 255) : null,
        lastOpened: Number(meta.lastOpened) || null,
      };
      await put(`metadata/${input.id}.json`, JSON.stringify(summary), { access: 'public', contentType: 'application/json', allowOverwrite: true });
      return Response.json({ ok: true, blobUrl: blob.url }, { headers: { 'cache-control': 'no-store' } });
    } catch (error) {
      console.error('Could not complete direct upload', error);
      return Response.json({ error: 'Could not finish cloud save.' }, { status: 500 });
    }
  }
  if (!target || !validId(input?.id) || !Number.isSafeInteger(input?.size) || input.size < 1 || input.size > MAX_BYTES) {
    return Response.json({ error: 'Files must be 50 MB or smaller.' }, { status: 400 });
  }

  const pathname = `${target}/${input.id}.json`;
  try {
    const validUntil = Date.now() + 5 * 60 * 1000;
    const token = await issueSignedToken({
      pathname,
      operations: ['put'],
      validUntil,
      maximumSizeInBytes: MAX_BYTES,
      allowedContentTypes: ['application/json'],
    });
    const { presignedUrl } = await presignUrl(token, {
      pathname,
      operation: 'put',
      validUntil,
      maximumSizeInBytes: MAX_BYTES,
      allowedContentTypes: ['application/json'],
      allowOverwrite: true,
    });
    return Response.json({ uploadUrl: presignedUrl }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('Could not create direct upload URL', error);
    return Response.json({ error: 'Direct upload is unavailable.' }, { status: 500 });
  }
}
