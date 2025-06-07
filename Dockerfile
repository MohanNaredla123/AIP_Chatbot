FROM python:3.13-slim

WORKDIR /rag_service

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    build-essential \
    cmake \
    make \
    libc6-dev \
    libstdc++6 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH=/rag_service
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/ping || exit 1

CMD ["python", "-m", "uvicorn", "rag_service.service:app", "--host", "0.0.0.0", "--port", "8000"]