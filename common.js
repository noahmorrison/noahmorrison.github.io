const baseUrl = 'https://photos.norwich.morrison.ph';

// Returns the listing's entries as { href, size }; nginx's autoindex prints each
// file's size (e.g. "16M") after its link
async function fetchDirectory(path = '') {
    // Listings change whenever photos are published, so don't trust a cached copy
    const response = await fetch(`${baseUrl}${path}`, { cache: 'no-cache' });
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    return Array.from(doc.querySelectorAll('a'))
        .map(a => {
            const size = (a.nextSibling?.textContent || '').trim().match(/(\d+(?:\.\d+)?)([KMG])$/);
            return { href: a.getAttribute('href'), size: size ? `${size[1]} ${size[2]}B` : '' };
        })
        .filter(({ href }) => href && href !== '../' && !href.startsWith('/'));
}

function slugify(name) {
    return name.trim().replace(/\s+/g, '-');
}
