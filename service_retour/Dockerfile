
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .

# Connexion lente vers PyPI : délai et nombre de tentatives de pip augmentés
ENV PIP_DEFAULT_TIMEOUT=300 PIP_RETRIES=10
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
