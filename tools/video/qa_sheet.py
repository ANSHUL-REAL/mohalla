# qa_sheet.py <out.jpg> <img...> : glue QA frames into a 2-column contact sheet with labels
import sys
from PIL import Image, ImageDraw, ImageFont
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert('RGB') for f in files]
w = 960; h = max(int(i.height * w / i.width) for i in ims)
cols = 2; rows = (len(ims) + 1) // 2
sheet = Image.new('RGB', (cols * w, rows * (h + 30)), 'white')
d = ImageDraw.Draw(sheet); f = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 20)
for k, (im, name) in enumerate(zip(ims, files)):
    im = im.resize((w, int(im.height * w / im.width)))
    x, y = (k % cols) * w, (k // cols) * (h + 30)
    d.text((x + 6, y + 2), name.split('/')[-1], fill='black', font=f)
    sheet.paste(im, (x, y + 30))
sheet.save(out, quality=80)
