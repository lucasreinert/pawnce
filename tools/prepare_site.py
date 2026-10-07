"""
Monta a versão publicada do jogo (PWA) em _site/, só com o que o jogo precisa:
index.html, manifest, lib/, src/, assets/ (sem assets/source/) e icons/.
Também gera o sw.js final com a versão (BUILD) e a lista de arquivos para jogar offline.

Usado pelo workflow do GitHub Pages (.github/workflows/pages.yml). Para testar localmente:
    python tools/prepare_site.py
    python tools/serve.py --site      (serve a pasta _site/)
"""
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / '_site'
INCLUDE = ['index.html', 'manifest.webmanifest', 'lib', 'src', 'assets', 'icons']


def main():
    build = sys.argv[1] if len(sys.argv) > 1 else 'local'
    if SITE.exists():
        shutil.rmtree(SITE)
    SITE.mkdir()

    for item in INCLUDE:
        src = ROOT / item
        if src.is_dir():
            shutil.copytree(src, SITE / item, ignore=shutil.ignore_patterns('source'))
        else:
            shutil.copy2(src, SITE / item)

    files = sorted(p.relative_to(SITE).as_posix() for p in SITE.rglob('*') if p.is_file())
    sw = (ROOT / 'sw.js').read_text(encoding='utf-8')
    sw = sw.replace('__BUILD__', build).replace('[/*__FILES__*/]', json.dumps(['./'] + files, indent=2))
    (SITE / 'sw.js').write_text(sw, encoding='utf-8')
    (SITE / '.nojekyll').write_text('', encoding='utf-8')  # GitHub Pages: servir os arquivos como estão

    print(f'_site/ pronto (versão {build}, {len(files)} arquivos)')


if __name__ == '__main__':
    main()
