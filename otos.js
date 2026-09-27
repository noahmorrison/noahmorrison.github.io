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

    lightboxPhotos = [];

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

        const index = lightboxPhotos.length;
        lightboxPhotos.push({ url: fullUrl, alt: `${categoryName} photo` });

        item.addEventListener('click', () => {
            openLightbox(index);
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
let lightboxPhotos = [];
let lightboxIndex = 0;

function isLightboxOpen() {
    return lightboxOverlay.classList.contains('active');
}

function initLightbox() {
    lightboxOverlay = document.getElementById('lightbox-overlay');
    lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.getElementById('lightbox-close');
    const prevBtn = document.getElementById('lightbox-prev');
    const nextBtn = document.getElementById('lightbox-next');

    const close = () => {
        lightboxOverlay.classList.remove('visible');
        document.body.classList.remove('lightbox-open');
        setTimeout(() => {
            lightboxOverlay.classList.remove('active');
            lightboxImg.src = '';
        }, 250);
    };

    lightboxOverlay.addEventListener('click', (e) => {
        if (e.target === lightboxOverlay) close();
    });
    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', () => stepLightbox(-1));
    nextBtn.addEventListener('click', () => stepLightbox(1));

    document.addEventListener('keydown', (e) => {
        if (!isLightboxOpen()) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') stepLightbox(-1);
        else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') stepLightbox(1);
        else return;
        e.preventDefault();
    });

    // Mouse wheel / trackpad: one photo per gesture
    let wheelLocked = false;
    lightboxOverlay.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        if (wheelLocked || Math.abs(delta) < 10) return;
        wheelLocked = true;
        setTimeout(() => { wheelLocked = false; }, 350);
        stepLightbox(delta > 0 ? 1 : -1);
    }, { passive: false });

    // Touch swipe
    let touchX = null, touchY = null;
    lightboxOverlay.addEventListener('touchstart', (e) => {
        touchX = e.touches[0].clientX;
        touchY = e.touches[0].clientY;
    }, { passive: true });
    lightboxOverlay.addEventListener('touchend', (e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        const dy = e.changedTouches[0].clientY - touchY;
        touchX = touchY = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            stepLightbox(dx < 0 ? 1 : -1);
        }
    });
}

function showLightboxPhoto(index) {
    const count = lightboxPhotos.length;
    lightboxIndex = (index + count) % count;
    const photo = lightboxPhotos[lightboxIndex];
    lightboxImg.src = photo.url;
    lightboxImg.alt = photo.alt;

    // Preload neighbours so scrolling feels instant
    [lightboxIndex - 1, lightboxIndex + 1].forEach(i => {
        new Image().src = lightboxPhotos[(i + count) % count].url;
    });

    lightboxOverlay.classList.toggle('single', count < 2);
}

function stepLightbox(direction) {
    if (lightboxPhotos.length < 2) return;
    showLightboxPhoto(lightboxIndex + direction);
}

function openLightbox(index) {
    showLightboxPhoto(index);
    lightboxOverlay.classList.add('active');
    document.body.classList.add('lightbox-open');
    void lightboxOverlay.offsetWidth;
    lightboxOverlay.classList.add('visible');
}

loadGalleries();
