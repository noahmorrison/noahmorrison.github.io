const baseUrl = 'https://photos.norwich.morrison.ph';

async function fetchDirectory(path = '') {
    const response = await fetch(`${baseUrl}${path}`);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const links = Array.from(doc.querySelectorAll('a'))
        .map(a => a.getAttribute('href'))
        .filter(href => href && href !== '../' && !href.startsWith('/'));

    return links;
}

function slugify(name) {
    return name.trim().replace(/\s+/g, '-');
}

let directories = [];
let categoryNames = [];

function dirForSlug(slug) {
    const idx = categoryNames.findIndex(name => slugify(name) === slug);
    return idx === -1 ? null : directories[idx];
}

function renderNav() {
    const nav = document.getElementById('gallery-nav');
    nav.innerHTML = '';

    categoryNames.forEach((name, i) => {
        const link = document.createElement('a');
        link.href = `#${slugify(name)}`;
        link.textContent = name;
        link.className = 'gallery-nav-link';
        nav.appendChild(link);
    });
}

function setActiveNavLink(slug) {
    document.querySelectorAll('.gallery-nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${slug}`);
    });
}

async function loadGallery(dir, categoryName) {
    const galleries = document.getElementById('galleries');
    galleries.innerHTML = '';

    const photos = await fetchDirectory(`/${dir}`);
    if (photos.length === 0) {
        return;
    }

    const fullPhotos = photos.filter(f => !f.includes('-thumbnail.') && !f.includes('-square.'));
    const thumbnails = photos.filter(f => f.includes('-thumbnail.'));

    const section = document.createElement('div');
    section.className = 'photo-category';
    section.innerHTML = `<h2>${categoryName}</h2>`;

    const gallery = document.createElement('div');
    gallery.className = 'photo-gallery';

    for (const photo of fullPhotos) {
        const item = document.createElement('div');
        item.className = 'photo-item';

        const photoName = photo.substring(0, photo.lastIndexOf("."));

        const fullUrl = `${baseUrl}/${dir}${photo}`;
        var url = fullUrl;
        var thumbnail = thumbnails.filter(t => t.startsWith(`${photoName}-thumbnail`))[0];
        if (typeof thumbnail !== 'undefined') {
            url = `${baseUrl}/${dir}${thumbnail}`;
        }

        const img = document.createElement('img');
        img.src = url;
        img.alt = `${categoryName} photo`;

        item.addEventListener('click', () => {
            openLightbox(fullUrl, `${categoryName} photo`);
        });

        item.appendChild(img);
        gallery.appendChild(item);
    }

    section.appendChild(gallery);
    galleries.appendChild(section);
}

async function showFromHash() {
    let slug = decodeURIComponent(location.hash.replace(/^#/, ''));

    let dir = slug ? dirForSlug(slug) : null;

    if (!dir) {
        dir = directories[0];
        slug = slugify(categoryNames[0]);
        if (dir) {
            history.replaceState(null, '', `#${slug}`);
        }
    }

    if (!dir) return;

    const categoryName = categoryNames[directories.indexOf(dir)];
    setActiveNavLink(slug);
    await loadGallery(dir, categoryName);
}

async function loadGalleries() {
    initLightbox();

    directories = (await fetchDirectory('/')).reverse();
    categoryNames = directories.map(dir => decodeURI(dir.replace(/\/$/, '')));

    renderNav();
    await showFromHash();

    window.addEventListener('hashchange', showFromHash);
}

let lightboxOverlay, lightboxImg;

function initLightbox() {
    lightboxOverlay = document.getElementById('lightbox-overlay');
    lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.getElementById('lightbox-close');

    const close = () => {
        lightboxOverlay.classList.remove('visible');
        setTimeout(() => {
            lightboxOverlay.classList.remove('active');
            lightboxImg.src = '';
        }, 250);
    };

    lightboxOverlay.addEventListener('click', (e) => {
        if (e.target !== lightboxImg) close();
    });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
    });
}

function openLightbox(url, alt) {
    lightboxImg.src = url;
    lightboxImg.alt = alt;
    lightboxOverlay.classList.add('active');
    void lightboxOverlay.offsetWidth;
    lightboxOverlay.classList.add('visible');
}

loadGalleries();
