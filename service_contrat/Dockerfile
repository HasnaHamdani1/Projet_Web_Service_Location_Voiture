FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY service_contrat/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

RUN addgroup --system --gid 10001 appgroup \
    && adduser --system --uid 10001 --ingroup appgroup appuser

COPY --chown=appuser:appgroup service_contrat/ ./service_contrat/

USER appuser

EXPOSE 8000

CMD ["uvicorn", "service_contrat.main:app", "--host", "0.0.0.0", "--port", "8000"]
