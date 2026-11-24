
import os
from dotenv import load_dotenv

load_dotenv()



# Adresses des autres services : noms Docker Compose par défaut, jamais d'IP écrite en dur.
# En dehors de Docker : CONTRAT_API_URL=http://localhost:8003, VEHICULE_API_URL=http://localhost:8005
CONTRAT_API_URL = os.getenv("CONTRAT_API_URL", "http://service_contrat:8000")
VEHICULE_API_URL = os.getenv("VEHICULE_API_URL", "http://service_vehicule:8000")

# Clés X-API-Key données par les services appelés (clôture du contrat, statut du véhicule)
RETOUR_CONTRAT_API_KEY = os.getenv("RETOUR_CONTRAT_API_KEY", "")
RETOUR_VEHICULE_API_KEY = os.getenv("RETOUR_VEHICULE_API_KEY", "")
