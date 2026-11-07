from getpass import getpass

from sqlalchemy.exc import IntegrityError

from .database import SessionLocal
from .models import Administrateur, Utilisateur
from .security import hash_password


def main():
    nom = input("Nom de l'administrateur: ").strip()
    email = input("E-mail: ").strip().casefold()
    password = getpass("Mot de passe (12 caractères minimum): ")
    confirmation = getpass("Confirmer le mot de passe: ")
    if not nom or "@" not in email or len(password) < 12 or password != confirmation:
        raise SystemExit("Mot de passe invalide ou confirmation différente.")

    db = SessionLocal()
    try:
        user = Utilisateur(
            nom=nom,
            email=email,
            mot_de_passe=hash_password(password),
        )
        db.add(user)
        db.flush()
        db.add(Administrateur(id=user.id))
        db.commit()
        print(f"Administrateur créé: {email}")
    except IntegrityError as exc:
        db.rollback()
        raise SystemExit("Cet e-mail existe déjà.") from exc
    finally:
        db.close()


if __name__ == "__main__":
    main()
