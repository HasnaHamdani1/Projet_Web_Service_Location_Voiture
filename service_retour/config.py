
import os
from dotenv import load_dotenv

load_dotenv()


RESERVATION_API_URL = os.getenv("RESERVATION_API_URL", "http://localhost:5001")
CONTRAT_API_URL = os.getenv("CONTRAT_API_URL", "http://localhost:5002")
VEHICULE_API_URL = os.getenv("VEHICULE_API_URL", "http://localhost:5003")