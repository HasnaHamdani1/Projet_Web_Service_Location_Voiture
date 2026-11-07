from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ClientRegistration(BaseModel):
    nom: str = Field(min_length=1, max_length=100)
    email: EmailStr
    mot_de_passe: str = Field(min_length=12, max_length=128)
    telephone: str | None = Field(default=None, max_length=30)
    adresse: str = Field(min_length=1, max_length=255)

    @field_validator("nom", "adresse")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Ce champ ne peut pas être vide")
        return cleaned


class LoginRequest(BaseModel):
    email: EmailStr
    mot_de_passe: str = Field(min_length=1, max_length=128)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nom: str
    email: EmailStr
    telephone: str | None
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
