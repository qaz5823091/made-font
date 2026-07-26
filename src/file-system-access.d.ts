// TypeScript's bundled lib.dom.d.ts declares FileSystemDirectoryHandle without
// its async-iterator helpers. We enumerate OPFS with entries(), so declare just
// that surface via interface merging — this replaces the blanket @ts-ignore the
// import code used to carry.
interface FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>
}
