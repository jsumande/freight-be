FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install curl for uv installation
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install uv package manager
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

COPY pyproject.toml README.md ./

# Sync dependencies
RUN uv sync --frozen || uv sync

COPY . .

# Run migrations and collect static on container startup
EXPOSE 4040

CMD ["uv", "run", "python", "manage.py", "runserver", "0.0.0.0:4040"]
