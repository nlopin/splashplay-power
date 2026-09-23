/**
 * In-memory stand-in for the parts of `@netlify/blobs` stores we use, with
 * the same conditional-write semantics (`onlyIfNew`, `onlyIfMatch`) so
 * concurrency logic can be tested without Netlify.
 */
export type MemoryBlobStore = ReturnType<typeof createMemoryBlobStore>;

export function createMemoryBlobStore() {
  const blobs = new Map<string, { data: string; etag: string }>();
  let version = 0;
  let failNext: Error | null = null;

  function maybeFail() {
    if (failNext) {
      const err = failNext;
      failNext = null;
      throw err;
    }
  }

  return {
    blobs,
    /** Makes the next store call throw `err`. */
    failNextCall(err: Error = new Error("blob store unavailable")) {
      failNext = err;
    },
    peek(key: string): unknown {
      const blob = blobs.get(key);
      return blob ? JSON.parse(blob.data) : null;
    },
    async setJSON(
      key: string,
      value: unknown,
      options: { onlyIfNew?: boolean; onlyIfMatch?: string } = {},
    ) {
      maybeFail();
      const current = blobs.get(key);
      if (options.onlyIfNew && current) return { modified: false };
      if (options.onlyIfMatch && current?.etag !== options.onlyIfMatch) {
        return { modified: false };
      }
      const etag = `"v${++version}"`;
      blobs.set(key, { data: JSON.stringify(value), etag });
      return { modified: true, etag };
    },
    async getWithMetadata(key: string, _options?: { type: "json" }) {
      maybeFail();
      const blob = blobs.get(key);
      if (!blob) return null;
      return { data: JSON.parse(blob.data), etag: blob.etag, metadata: {} };
    },
    async delete(key: string) {
      maybeFail();
      blobs.delete(key);
    },
  };
}
