FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY service_auth/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && addgroup --system --gid 10004 appgroup \
    && adduser --system --uid 10004 --ingroup appgroup appuser

COPY --chown=appuser:appgroup service_auth/ ./service_auth/

USER appuser
EXPOSE 8000
CMD ["uvicorn", "service_auth.main:app", "--host", "0.0.0.0", "--port", "8000"]
