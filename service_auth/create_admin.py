from getpass import getpass

from sqlalchemy.exc import IntegrityError

from .database import SessionLocal
from .models import SERVICES_ADMIN, Administrateur, AdministrateurService, Utilisateur
from .security import hash_password

LIBELLES = {
    "VEHICULE": "Véhicules (Leila)",
    "RESERVATION": "Réservations (Maryam)",
    "CONTRAT": "Contrats (Sara)",
    "RETOUR": "Retours (Hasna)",
}


def choisir_service() -> str:
    print("Service géré par cet administrateur :")
    for numero, service in enumerate(SERVICES_ADMIN, start=1):
        print(f"  {numero}. {LIBELLES[service]}")
    choix = input("Numéro du service (1-4): ").strip()
    if choix not in {str(i) for i in range(1, len(SERVICES_ADMIN) + 1)}:
        raise SystemExit("Choix de service invalide.")
    return SERVICES_ADMIN[int(choix) - 1]


def main():
    nom = input("Nom de l'administrateur: ").strip()
    email = input("E-mail: ").strip().casefold()
    service = choisir_service()
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
            role="ADMINISTRATEUR",
        )
        db.add(user)
        db.flush()

        db.add(Administrateur(id=user.id))
        db.flush()
        db.add(AdministrateurService(administrateur_id=user.id, service=service))
        db.commit()

        print(f"Administrateur créé: {email} (service {LIBELLES[service]})")

    except IntegrityError as exc:
        db.rollback()
        raise SystemExit("Cet e-mail existe déjà.") from exc

    finally:
        db.close()


if __name__ == "__main__":
    main()
