const fs = require('fs');
const path = require('path');

const PUBLIC_ROOT = path.join(__dirname, '..', 'public');
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.jfif', '.webp', '.svg', '.gif'];

function resolveHeroImagePath(imagePath) {
  if (!imagePath || !imagePath.startsWith('/images/')) return imagePath;

  const relativePath = imagePath.replace(/^\//, '');
  const absolutePath = path.join(PUBLIC_ROOT, relativePath);

  if (fs.existsSync(absolutePath)) return imagePath;

  const dir = path.dirname(absolutePath);
  const baseName = path.basename(absolutePath, path.extname(absolutePath));

  for (const ext of IMAGE_EXTENSIONS) {
    const candidate = path.join(dir, baseName + ext);
    if (fs.existsSync(candidate)) {
      return `/images/${baseName}${ext}`;
    }
  }

  return imagePath;
}

function resolveHeroSlides(slides) {
  return slides.map((slide) => {
    const resolved = typeof slide.toObject === 'function' ? slide.toObject() : { ...slide };
    resolved.image = resolveHeroImagePath(resolved.image);
    return resolved;
  });
}

module.exports = {
  resolveHeroImagePath,
  resolveHeroSlides
};
