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

async function loadGalleries() {
    const galleries = document.getElementById('galleries');

    const directories = (await fetchDirectory('/')).reverse();
    for (const dir of directories) {
        const categoryName = decodeURI(dir.replace('/', ''));

        // Get photos in this directory
        const photos = await fetchDirectory(`/${dir}`);
        if (photos.length == 0) {
            continue;
        }

        const fullPhotos = photos.filter(f => !f.includes('-thumbnail.') && !f.includes('-square.'));
        const thumbnails = photos.filter(f => f.includes('-thumbnail.'));

        // Create category section
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
            var thumbnail = thumbnails.filter(t => t.startsWith(`${photoName}-thumbnail`))[0]
            if (typeof thumbnail !== 'undefined') {
                url = `${baseUrl}/${dir}${thumbnail}`
            }

            const img = document.createElement('img');
            img.src = url;
            img.alt = `${categoryName} photo`;

            // Click to view full size
            item.addEventListener('click', () => {
                window.open(fullUrl, '_blank');
            });

            item.appendChild(img);
            gallery.appendChild(item);
        }

        section.appendChild(gallery);
        galleries.appendChild(section);
    }
}

loadGalleries();