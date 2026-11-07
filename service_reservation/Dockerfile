FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY service_reservation/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && addgroup --system --gid 10003 appgroup \
    && adduser --system --uid 10003 --ingroup appgroup appuser

COPY --chown=appuser:appgroup service_reservation/ ./service_reservation/

USER appuser
EXPOSE 8000
CMD ["uvicorn", "service_reservation.main:app", "--host", "0.0.0.0", "--port", "8000"]
