import os

from cryptography.fernet import Fernet, InvalidToken

from core import env
from core.env import logger


def get_otp_fernet() -> Fernet:
    key = os.environ.get('OTP_ENCRYPTION_KEY', '').strip()
    if not key:
        if os.path.exists(env.OTP_KEY_PATH):
            with open(env.OTP_KEY_PATH) as f:
                key = f.read().strip()
        else:
            key = Fernet.generate_key().decode()
            os.makedirs(os.path.dirname(env.OTP_KEY_PATH), exist_ok=True)
            with open(env.OTP_KEY_PATH, 'w') as f:
                f.write(key)
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_secret(secret: str) -> str:
    if not secret:
        return ''
    return get_otp_fernet().encrypt(secret.encode()).decode()


def decrypt_secret(token: str) -> str:
    if not token:
        return ''
    try:
        return get_otp_fernet().decrypt(token.encode()).decode()
    except (InvalidToken, Exception):
        logger.warning("Failed to decrypt secret (encryption key mismatch?) - treating as empty")
        return ''
