import glob
import re

files = glob.glob('*.html')
for file in files:
    if file == 'admin.html' or file == 'proximamente.html':
        continue
    
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Logo text removal
    pattern_logo = r'(<a href="index\.html" class="logo">.*?<img.*?>)\s*LA BUFARRA\s*(</a>)'
    content = re.sub(pattern_logo, r'\1\n            \2', content, flags=re.DOTALL | re.IGNORECASE)

    # Flag replacement
    pattern_flags = r'<li style="display:flex; gap:0\.5rem; align-items:center;">.*?🇪🇸.*?🇺🇸.*?</li>'
    new_flags = '''<li style="display:flex; gap:0.5rem; align-items:center; font-family: var(--font-display);">
                    <a href="#" style="font-size:1rem; font-weight:800; color:var(--text-main);">ES</a>
                    <span style="color:var(--text-muted); font-size:1rem;">/</span>
                    <a href="#" style="font-size:1rem; font-weight:800; color:var(--text-muted); cursor:not-allowed;" title="Soon...">EN</a>
                </li>'''
    
    content = re.sub(pattern_flags, new_flags, content, flags=re.DOTALL)

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
print("Updated HTML files!")
