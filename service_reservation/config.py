"""Configuration du service Réservation (variables d'environnement, voir .env.example)."""
from decimal import Decimal
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Base UNIQUE de l'équipe (exigence du module) : MySQL db_location_voitures.
    # SQLite n'est utilisé que par les tests automatisés (TEST_DATABASE_URL absent).
    DATABASE_URL: str = "mysql+pymysql://location_app:location_app@127.0.0.1:3306/db_location_voitures"

    # Jetons émis par service_auth (HS256, claims sub / role / exp) — même secret que l'équipe
    JWT_SECRET: str = ""
    # Clés des microservices appelants, format "nom:cle,nom2:cle2" (ex. contrats:xxxx)
    SERVICE_API_KEYS: str = ""
    # Lecture sans jeton (GET) : conservée tant que Contrats appelle sans authentification
    LECTURE_PUBLIQUE: bool = True

    CORS_ORIGINS: str = ""
    LOG_LEVEL: str = "INFO"
    APP_TIMEZONE: str = "Africa/Casablanca"

    # Services de l'équipe
    VEHICLE_SERVICE_URL: str = "http://127.0.0.1:8005"
    VEHICLE_SERVICE_TIMEOUT: float = 5.0
    # Source des clients : "db" (lecture seule utilisateurs/clients) ou "http" (API Auth)
    CLIENT_PROVIDER: Literal["db", "http"] = "db"
    AUTH_SERVICE_URL: str = "http://127.0.0.1:8004"

    # Règles tarifaires (dossier §1.3)
    ASSISTANCE_DAILY_FEE: Decimal = Decimal("6.00")
    VAT_RATE: Decimal = Decimal("0.20")
    SECURITY_DEPOSIT: Decimal = Decimal("500.00")
    DEVISE: str = "€"
    HEURE_PAR_DEFAUT: str = "09:00"

    # E-mail de confirmation : "console" (logs) ou "smtp"
    EMAIL_BACKEND: Literal["console", "smtp"] = "console"
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = False
    EMAIL_FROM: str = "PARC AUTO <reservations@parcauto.local>"

    # Webhooks vers les autres services (reservation.confirmed, reservation.cancelled…)
    EVENT_WEBHOOK_URLS: str = ""

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def service_keys(self) -> dict[str, str]:
        result: dict[str, str] = {}
        for item in self.SERVICE_API_KEYS.split(","):
            if ":" in item:
                name, key = item.split(":", 1)
                if key.strip():
                    result[key.strip()] = name.strip()
        return result

    @property
    def webhook_urls(self) -> list[str]:
        return [u.strip() for u in self.EVENT_WEBHOOK_URLS.split(",") if u.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
