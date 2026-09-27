"""Browser tests for the /otos photo gallery lightbox.

The photo server is stubbed so the tests are deterministic and don't depend on
CORS or on what's currently uploaded.
"""
import os
import sys

from playwright.sync_api import expect, sync_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:4000")
PHOTO_HOST = "https://photos.norwich.morrison.ph"
RESULTS = "test-results"

# Directory listings, as the photo server's autoindex would return them
LISTINGS = {
    "/": ["Solo/", "Big%20Trip/"],
    "/Big%20Trip/": [
        "a.jpg", "a-thumbnail.jpg", "a-square.jpg",
        "b.jpg", "b-thumbnail.jpg",
        "c.jpg",
    ],
    "/Solo/": ["only.jpg"],
}
COLORS = ["#cc241d", "#98971a", "#458588", "#b16286", "#d79921"]


def listing_html(links):
    items = "".join(f'<a href="{href}">{href}</a>\n' for href in ["../", *links])
    return f"<html><body><pre>{items}</pre></body></html>"


def photo_svg(name):
    color = COLORS[sum(map(ord, name)) % len(COLORS)]
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">'
        f'<rect width="100%" height="100%" fill="{color}"/>'
        '<text x="50%" y="50%" font-size="80" text-anchor="middle" '
        f'fill="white" font-family="sans-serif">{name}</text></svg>'
    )


def stub_photo_server(route):
    path = route.request.url[len(PHOTO_HOST):] or "/"
    headers = {"Access-Control-Allow-Origin": "*"}
    if path in LISTINGS:
        route.fulfill(body=listing_html(LISTINGS[path]), content_type="text/html", headers=headers)
    else:
        name = path.rsplit("/", 1)[-1]
        route.fulfill(body=photo_svg(name), content_type="image/svg+xml", headers=headers)


failures = []


def check(name, fn):
    try:
        fn()
        print(f"  ok    {name}")
    except Exception as e:  # noqa: BLE001
        failures.append(name)
        print(f"  FAIL  {name}\n        {str(e).splitlines()[0]}")


def main():
    os.makedirs(RESULTS, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.route(f"{PHOTO_HOST}/**", stub_photo_server)
        page.route(PHOTO_HOST, stub_photo_server)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        overlay = page.locator("#lightbox-overlay")
        img = page.locator("#lightbox-img")
        items = page.locator(".photo-item")

        def expect_photo(name):
            expect(img).to_have_attribute("src", f"{PHOTO_HOST}/Big%20Trip/{name}")

        def wheel(dy):
            page.mouse.move(640, 400)
            page.mouse.wheel(0, dy)

        def swipe(dx):
            page.evaluate(
                """dx => {
                    const el = document.getElementById('lightbox-overlay');
                    const touch = x => new Touch({identifier: 1, target: el, clientX: x, clientY: 400});
                    el.dispatchEvent(new TouchEvent('touchstart', {touches: [touch(640)], bubbles: true}));
                    el.dispatchEvent(new TouchEvent('touchend', {changedTouches: [touch(640 + dx)], bubbles: true}));
                }""",
                dx,
            )

        print(f"Testing {BASE_URL}/otos")
        page.goto(f"{BASE_URL}/otos#Big-Trip")

        def gallery_loads():
            expect(items).to_have_count(3)
            expect(page.locator(".photo-item img").first).to_have_attribute(
                "src", f"{PHOTO_HOST}/Big%20Trip/a-thumbnail.jpg")
            page.screenshot(path=f"{RESULTS}/gallery.png")

        def click_opens_lightbox():
            items.nth(1).click()
            expect(overlay).to_have_class("lightbox-overlay active visible")
            expect_photo("b.jpg")
            expect(page.locator("body")).to_have_class("lightbox-open")
            page.wait_for_timeout(400)  # let the fade-in finish
            page.screenshot(path=f"{RESULTS}/lightbox.png")

        def arrow_keys():
            page.keyboard.press("ArrowRight")
            expect_photo("c.jpg")
            page.keyboard.press("ArrowLeft")
            expect_photo("b.jpg")
            page.keyboard.press("ArrowDown")
            expect_photo("c.jpg")
            page.keyboard.press("ArrowUp")
            expect_photo("b.jpg")

        def wraps_around():
            page.keyboard.press("ArrowRight")
            page.keyboard.press("ArrowRight")
            expect_photo("a.jpg")
            page.keyboard.press("ArrowLeft")
            expect_photo("c.jpg")

        def wheel_steps_once_per_gesture():
            page.wait_for_timeout(400)
            wheel(120)
            wheel(120)
            wheel(120)
            expect_photo("a.jpg")
            page.wait_for_timeout(400)
            wheel(-120)
            expect_photo("c.jpg")

        def page_does_not_scroll_behind():
            assert page.evaluate("window.scrollY") == 0, "page scrolled behind lightbox"

        def arrow_buttons():
            page.click("#lightbox-next")
            expect_photo("a.jpg")
            expect(overlay).to_have_class("lightbox-overlay active visible")
            page.click("#lightbox-prev")
            expect_photo("c.jpg")

        def swipe_gestures():
            swipe(-150)
            expect_photo("a.jpg")
            swipe(150)
            expect_photo("c.jpg")
            swipe(-20)  # too short to count
            expect_photo("c.jpg")

        def clicking_image_keeps_open():
            img.click()
            page.wait_for_timeout(300)
            expect(overlay).to_have_class("lightbox-overlay active visible")

        def background_click_closes():
            overlay.click(position={"x": 5, "y": 400})
            expect(overlay).not_to_have_class("lightbox-overlay active visible")
            expect(overlay).to_be_hidden()
            expect(page.locator("body")).not_to_have_class("lightbox-open")

        def escape_closes():
            items.nth(0).click()
            expect_photo("a.jpg")
            page.keyboard.press("Escape")
            expect(overlay).to_be_hidden()

        def keys_ignored_when_closed():
            page.keyboard.press("ArrowRight")
            expect(overlay).to_be_hidden()

        def switching_gallery_resets_photos():
            page.click(".gallery-nav-link[href='#Solo']")
            expect(items).to_have_count(1)
            items.nth(0).click()
            expect(img).to_have_attribute("src", f"{PHOTO_HOST}/Solo/only.jpg")
            expect(page.locator("#lightbox-next")).to_be_hidden()
            expect(page.locator("#lightbox-prev")).to_be_hidden()
            page.keyboard.press("ArrowRight")
            expect(img).to_have_attribute("src", f"{PHOTO_HOST}/Solo/only.jpg")
            page.wait_for_timeout(400)  # let the fade-in finish
            page.screenshot(path=f"{RESULTS}/single.png")

        def mobile_layout():
            page.keyboard.press("Escape")
            page.set_viewport_size({"width": 390, "height": 844})
            page.goto(f"{BASE_URL}/otos#Big-Trip")
            items.nth(0).click()
            expect_photo("a.jpg")
            page.wait_for_timeout(400)  # let the fade-in finish
            page.screenshot(path=f"{RESULTS}/lightbox-mobile.png")
            # Controls must be tappable, not covered by a full-width photo
            for control in ["lightbox-prev", "lightbox-next", "lightbox-close"]:
                on_top = page.evaluate(
                    """id => {
                        const r = document.getElementById(id).getBoundingClientRect();
                        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2).id;
                    }""",
                    control,
                )
                assert on_top == control, f"#{control} is covered by #{on_top}"
            page.click("#lightbox-prev")
            expect_photo("c.jpg")

        def no_js_errors():
            assert not errors, errors

        for name, fn in [
            ("gallery loads", gallery_loads),
            ("clicking a photo opens the lightbox", click_opens_lightbox),
            ("arrow keys step through photos", arrow_keys),
            ("navigation wraps around", wraps_around),
            ("mouse wheel steps once per gesture", wheel_steps_once_per_gesture),
            ("page doesn't scroll behind lightbox", page_does_not_scroll_behind),
            ("prev/next buttons", arrow_buttons),
            ("swipe gestures", swipe_gestures),
            ("clicking the image keeps it open", clicking_image_keeps_open),
            ("clicking the background closes", background_click_closes),
            ("escape closes", escape_closes),
            ("arrow keys ignored when closed", keys_ignored_when_closed),
            ("switching gallery resets photos", switching_gallery_resets_photos),
            ("mobile layout", mobile_layout),
            ("no JS errors", no_js_errors),
        ]:
            check(name, fn)

        browser.close()

    print(f"\n{len(failures)} failed" if failures else "\nall passed")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
