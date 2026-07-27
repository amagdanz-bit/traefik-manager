"""Reading TLS certificate metadata from acme.json and file-based certs."""
import os

from core import config as cfg_mod
from core import env
from core.env import logger




def _parse_cert_expiry(pem_bytes):
    try:
        import base64
        from cryptography import x509
        from cryptography.hazmat.backends import default_backend
        if isinstance(pem_bytes, str):
            pem_bytes = base64.b64decode(pem_bytes)
        cert_obj = x509.load_pem_x509_certificate(pem_bytes, default_backend())
        return cert_obj.not_valid_after_utc.strftime('%Y-%m-%dT%H:%M:%SZ')
    except Exception as ex:
        logger.debug(f"Cert parse error: {ex}")
        return None


def _certs_from_tls_configs():
    certs = []
    for p in env.CONFIG_PATHS:
        config = cfg_mod.load_config(p)
        for entry in (config.get('tls') or {}).get('certificates') or []:
            cert_file = entry.get('certFile', '')
            if not cert_file or not os.path.exists(cert_file):
                continue
            try:
                pem_bytes = open(cert_file, 'rb').read()
                not_after = _parse_cert_expiry(pem_bytes)
                try:
                    from cryptography import x509
                    from cryptography.hazmat.backends import default_backend
                    cert_obj = x509.load_pem_x509_certificate(pem_bytes, default_backend())
                    sans = [n.value for n in cert_obj.subject_alternative_names(x509.SubjectAlternativeName).get_values_for_type(x509.DNSName)]
                    main = sans[0] if sans else os.path.basename(cert_file)
                except Exception:
                    sans = []
                    main = os.path.basename(cert_file)
                certs.append({'resolver': 'file', 'main': main, 'sans': sans, 'not_after': not_after, 'certFile': cert_file})
            except Exception as ex:
                logger.debug(f"Error reading cert file {cert_file}: {ex}")
    return certs
