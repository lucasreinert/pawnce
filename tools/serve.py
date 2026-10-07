"""
Servidor local para testar o jogo. Igual ao `python -m http.server`, mas:
  - manda o navegador não guardar cache, então ele sempre carrega a versão mais nova dos arquivos
  - serve sempre a pasta do projeto (a pasta acima de tools/), de onde quer que seja iniciado

Uso:
    python tools/serve.py           (porta 8090)
    python tools/serve.py 8080      (outra porta)
    python tools/serve.py --site    (serve _site/, a versão publicada montada por tools/prepare_site.py)
"""
import functools
import http.server
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.webmanifest': 'application/manifest+json', '.js': 'text/javascript'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    port = int(args[0]) if args else 8090
    folder = ROOT / '_site' if '--site' in sys.argv else ROOT
    handler = functools.partial(NoCacheHandler, directory=str(folder))
    print(f'Servindo {folder} em http://localhost:{port}', flush=True)
    http.server.ThreadingHTTPServer(('', port), handler).serve_forever()
