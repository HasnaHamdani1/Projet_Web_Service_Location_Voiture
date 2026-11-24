
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN addgroup --system --gid 10006 appgroup \
    && adduser --system --uid 10006 --ingroup appgroup appuser

COPY --chown=appuser:appgroup . ./

# Donner à appuser le droit d'écrire dans /app
RUN chown appuser:appgroup /app

USER appuser

EXPOSE 3000

CMD ["python", "server.py"]

