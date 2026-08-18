from PIL import Image

img = Image.open('assets/images/app.icon.png').convert('RGB')
w, h = img.size
print('Taille:', w, 'x', h)

# Le logo : bordure noire sur les bords, fond gradient vert au centre.
# On échantillonne le fond à différents rayons (hors icône centrale).
cx, cy = w // 2, h // 2

def sample_at(rx, ry):
    x = int(cx + rx * w)
    y = int(cy + ry * h)
    return img.getpixel((x, y))

positions = [
    (0.0, 0.30, 'haut'),
    (0.0, -0.30, 'bas'),
    (-0.30, 0.0, 'gauche'),
    (0.30, 0.0, 'droite'),
    (0.0, 0.18, 'haut proche'),
    (0.0, -0.18, 'bas proche'),
    (-0.18, 0.0, 'gauche proche'),
    (0.18, 0.0, 'droite proche'),
]
for rx, ry, label in positions:
    c = sample_at(rx, ry)
    print('%s: RGB%s  #%02X%02X%02X' % (label, c, c[0], c[1], c[2]))
