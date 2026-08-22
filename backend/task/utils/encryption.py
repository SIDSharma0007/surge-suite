from cryptography.fernet import Fernet
from django.conf import settings

def get_fernet() -> Fernet:
    key = settings.PROVIDER_CREDENTIAL_ENCRYPTION_KEY
    return Fernet(key.encode() if isinstance(key, str) else key)

def encrypt_value(value: str) -> str:
    if not value:
        return ""
    f = get_fernet()
    return f.encrypt(value.encode()).decode()

def decrypt_value(encrypted_value: str) -> str:
    if not encrypted_value:
        return ""
    f = get_fernet()
    return f.decrypt(encrypted_value.encode()).decode()
