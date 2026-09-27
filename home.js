// How many thumbnails the home page's photo strip shows
const STRIP_SIZE = 8;

function shuffle(items) {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Shows random thumbnails, one per gallery where possible, each linking to its gallery
async function loadPhotoStrip() {
    const dirs = shuffle((await fetchDirectory('/')).map(e => e.href));

    // Fetch listings a batch at a time until enough galleries have thumbnails
    // (only thumbnails: originals are far too big for a strip like this)
    const galleries = [];
    for (let i = 0; i < dirs.length && galleries.length < STRIP_SIZE; i += STRIP_SIZE) {
        const batch = await Promise.allSettled(dirs.slice(i, i + STRIP_SIZE).map(async dir => ({
            dir,
            name: decodeURI(dir.replace(/\/$/, '')),
            thumbnails: shuffle((await fetchDirectory(`/${dir}`))
                .map(e => e.href)
                .filter(f => f.includes('-thumbnail.'))),
        })));
        galleries.push(...batch
            .filter(r => r.status === 'fulfilled' && r.value.thumbnails.length > 0)
            .map(r => r.value));
    }

    // Round-robin so every gallery gets a photo before any gets a second
    const picks = [];
    while (picks.length < STRIP_SIZE && galleries.some(g => g.thumbnails.length > 0)) {
        for (const gallery of galleries) {
            if (picks.length < STRIP_SIZE && gallery.thumbnails.length > 0) {
                picks.push({ ...gallery, thumbnail: gallery.thumbnails.pop() });
            }
        }
    }
    if (picks.length === 0) return;

    const strip = document.getElementById('photo-strip');
    for (const { dir, name, thumbnail } of shuffle(picks)) {
        const link = document.createElement('a');
        link.href = `/otos#${slugify(name)}`;
        link.title = name;

        const img = document.createElement('img');
        img.src = `${baseUrl}/${dir}${thumbnail}`;
        img.alt = `${name} photo`;
        img.loading = 'lazy';

        link.appendChild(img);
        strip.appendChild(link);
    }

    document.getElementById('recent-photos').hidden = false;
}

// The section stays hidden if the photo server can't be reached
loadPhotoStrip().catch(() => {});
