
import os
from dotenv import load_dotenv

load_dotenv()



CONTRAT_API_URL = os.getenv("CONTRAT_API_URL", "http://100.84.241.24:8003")
VEHICULE_API_URL = os.getenv("VEHICULE_API_URL", "http://100.106.223.93:8005")