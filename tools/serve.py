"""
Servidor local para testar o jogo. Igual ao `python -m http.server`, mas manda o navegador não
guardar cache, então ele sempre carrega a versão mais nova dos arquivos depois de uma edição.

Uso:
    python tools/serve.py          (porta 8090)
    python tools/serve.py 8080     (outra porta)
"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
    print(f'Servindo em http://localhost:{port}', flush=True)
    http.server.ThreadingHTTPServer(('', port), NoCacheHandler).serve_forever()
