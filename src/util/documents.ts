/**
 * What counts as a document worth auditing.
 *
 * A crawl follows whatever is linked, and plenty of what is linked is not a
 * page: an image, a JSON endpoint, a stylesheet, llms.txt. None of those has a
 * title tag, so a metadata check run against one produces a finding that is
 * literally true and completely useless. spec/false-positives.md says a false
 * finding costs more than a missed one, and ten of them at the top of a first
 * audit teach the reader to distrust everything under them.
 *
 * One predicate, three callers: the builtin crawler does not spend crawl budget
 * on them, tiering does not count them in the distribution, and the site checks
 * do not audit them. Three separate versions of this rule is how the three
 * drift apart.
 */

/** Paths that are documents in the HTTP sense but never pages a buyer reads. */
const NON_CONTENT_PATHS = [
  /(^|\/)sitemap(?:[-_.].*)?\.xml$/i,
  /(^|\/)robots\.txt$/i,
  /(^|\/)feed(?:\.xml|\/)?$/i,
  /(^|\/)rss(?:\.xml|\/)?$/i,
  /(^|\/)atom\.xml$/i,
];

/**
 * Extensions that are assets, data or downloads. Deliberately a denylist: an
 * allowlist would have to enumerate every extension a page is ever served
 * under (.html, .php, .aspx, extensionless, trailing slash) and would silently
 * drop a real page the first time it met one it did not know.
 */
const NON_CONTENT_EXTENSIONS = new Set([
  // images
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp', 'tif', 'tiff',
  // media
  'mp4', 'webm', 'mov', 'avi', 'mp3', 'wav', 'ogg', 'oga', 'ogv', 'm4a', 'm4v',
  // fonts
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  // code and style
  'css', 'js', 'mjs', 'cjs', 'map', 'wasm',
  // data
  'json', 'jsonld', 'xml', 'csv', 'tsv', 'txt', 'yaml', 'yml',
  // documents and archives
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'gz', 'tgz', 'bz2',
  'rar', '7z', 'dmg', 'exe', 'apk', 'pkg',
]);

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0].split('#')[0];
  }
}

function extensionOf(path: string): string | null {
  const file = path.slice(path.lastIndexOf('/') + 1);
  const dot = file.lastIndexOf('.');
  if (dot <= 0) return null; // no dot, or a dotfile like /.well-known
  return file.slice(dot + 1).toLowerCase();
}

/** True when this URL is a page a buyer could read, so worth crawling and auditing. */
export function isContentDocument(url: string): boolean {
  const path = pathOf(url);
  if (NON_CONTENT_PATHS.some((pattern) => pattern.test(path))) return false;
  const extension = extensionOf(path);
  return extension === null || !NON_CONTENT_EXTENSIONS.has(extension);
}

/**
 * True when a response body is worth parsing as a page.
 *
 * A missing header is treated as HTML rather than skipped: the parser reads
 * what is there and produces nothing if there is nothing, which is the safer
 * error than dropping a real page because a server was terse. An asset that
 * gets this far is caught by its extension anyway.
 */
export function isHtmlContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return true;
  return /html/i.test(contentType);
}
