from django.apps import AppConfig
from django.core.exceptions import ImproperlyConfigured
from django.conf import settings
from cryptography.fernet import Fernet

class TaskConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "task"

    def ready(self):
        key = getattr(settings, 'PROVIDER_CREDENTIAL_ENCRYPTION_KEY', None)
        if not key:
            raise ImproperlyConfigured(
                "PROVIDER_CREDENTIAL_ENCRYPTION_KEY is missing from Django settings. "
                "Generate a key using: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\" "
                "and add it to your environment/configuration."
            )
        try:
            # Validate that the key is a valid Fernet key
            Fernet(key.encode() if isinstance(key, str) else key)
        except Exception as e:
            raise ImproperlyConfigured(
                f"PROVIDER_CREDENTIAL_ENCRYPTION_KEY is invalid. Details: {str(e)}"
            )
