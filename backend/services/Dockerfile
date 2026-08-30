FROM python:3.10-slim

RUN apt-get update && apt-get install -y \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY vision_server.py camera_manager.py spatial_analyzer.py ./

ENV VISION_MODE=cloud
ENV PORT=5003
EXPOSE 5003

CMD uvicorn vision_server:app --host 0.0.0.0 --port ${PORT:-5003}
