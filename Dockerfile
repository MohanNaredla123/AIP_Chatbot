FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /

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

COPY rag_service/requirements.txt ./rag_service/

COPY pyproject.toml uv.lock ./

RUN uv add -r rag_service/requirements.txt

COPY . .

ENV PYTHONPATH=/rag_service
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/ping || exit 1

CMD ["uv", "run", "python", "-m", "rag_service.service"]