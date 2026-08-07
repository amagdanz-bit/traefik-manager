import os

from PIL import Image

copied = 0
for theme in ("dark", "light"):
    for f in sorted(os.listdir(f"/new/{theme}")):
        im = Image.open(f"/new/{theme}/{f}").convert("RGB")
        im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
        im.save(f"/img/{theme}-{f[:-4]}.png", optimize=True)
        copied += 1

CAROUSEL = ("dashboard", "routes-cards", "middlewares-cards", "services-cards", "route-map",
            "tls-options", "certs", "crowdsec", "logs", "plugins", "static-config")

for theme in ("dark", "light"):
    frames = []
    for n in CAROUSEL:
        p = f"/img/{theme}-{n}.png"
        if not os.path.exists(p):
            print(f"carousel: missing {theme}-{n}.png, skipped")
            continue
        frames.append(Image.open(p).convert("RGB").resize((1280, 720), Image.LANCZOS))
    frames[0].save(f"/img/readme-carousel-{theme}.gif", save_all=True,
                   append_images=frames[1:], duration=2400, loop=0, optimize=True)

print(f"{copied} screenshots installed, 2 carousel GIFs rebuilt from {len(CAROUSEL)} tabs")
