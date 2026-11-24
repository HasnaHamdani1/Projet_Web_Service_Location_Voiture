FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
RUN addgroup --system --gid 10006 appgroup \
    && adduser --system --uid 10006 --ingroup appgroup appuser \
    && chown appuser:appgroup /app

# server.py écrit config.js dans /app au démarrage : le dossier doit appartenir à appuser
COPY --chown=appuser:appgroup . ./
USER appuser

EXPOSE 3000
CMD ["python", "server.py"]
