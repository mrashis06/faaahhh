# faaahhh for Vercel

Deploy this folder as the Vercel project `faaahhh`. Create a public Vercel Blob store and connect it to the project so `BLOB_READ_WRITE_TOKEN` is available to the function. The frontend calls `/api/notebooks` for persistent storage.

The app has no sign-in. Anyone with the URL can view and upload files. Each request is limited to 5 MB. Anonymous deletion is not exposed.

