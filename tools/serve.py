"""
Servidor local para testar o jogo. Igual ao `python -m http.server`, mas:
  - manda o navegador não guardar cache, então ele sempre carrega a versão mais nova dos arquivos
  - serve sempre a pasta do projeto (a pasta acima de tools/), de onde quer que seja iniciado

Uso:
    python tools/serve.py          (porta 8090)
    python tools/serve.py 8080     (outra porta)
"""
import functools
import http.server
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    print(f'Servindo {ROOT} em http://localhost:{port}', flush=True)
    http.server.ThreadingHTTPServer(('', port), handler).serve_forever()
