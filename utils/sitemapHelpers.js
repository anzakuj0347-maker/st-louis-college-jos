const navigation = require('../config/navigation');

const EXCLUDED_PATH_PREFIXES = ['/results', '/staff', '/slc-admin', '/press-club'];

function collectNavPaths(items = navigation) {
  const paths = [];
  for (const item of items) {
    if (item.path) paths.push(item.path);
    if (item.children?.length) paths.push(...collectNavPaths(item.children));
  }
  return paths;
}

function isPublicPath(path) {
  return !EXCLUDED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatLastMod(date) {
  if (!date) return null;
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function buildAbsoluteUrl(baseUrl, path) {
  if (path === '/') return `${baseUrl}/`;
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildSitemapXml(baseUrl, pathEntries) {
  const body = pathEntries
    .map(({ path, lastmod }) => {
      const loc = escapeXml(buildAbsoluteUrl(baseUrl, path));
      const lastModTag = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : '';
      return `  <url>\n    <loc>${loc}</loc>${lastModTag}\n  </url>`;
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</urlset>'
  ].join('\n');
}

function mergePathEntries(navPaths, cmsPages) {
  const byPath = new Map();

  navPaths.filter(isPublicPath).forEach((path) => {
    byPath.set(path, { path, lastmod: null });
  });

  cmsPages.forEach((page) => {
    const path = `/${page.section}/${page.slug}`;
    if (!isPublicPath(path)) return;
    byPath.set(path, {
      path,
      lastmod: formatLastMod(page.updatedAt || page.createdAt)
    });
  });

  byPath.set('/admission/apply-now/access', { path: '/admission/apply-now/access', lastmod: null });

  return Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function getSiteBaseUrl(req) {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
  return `${protocol}://${req.get('host')}`;
}

module.exports = {
  collectNavPaths,
  mergePathEntries,
  buildSitemapXml,
  getSiteBaseUrl
};
