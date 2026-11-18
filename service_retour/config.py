
import os
from dotenv import load_dotenv

load_dotenv()

RESERVATION_API_URL = os.getenv("RESERVATION_API_URL")
CONTRAT_API_URL = os.getenv("CONTRAT_API_URL")
VEHICULE_API_URL = os.getenv("VEHICULE_API_URL")
