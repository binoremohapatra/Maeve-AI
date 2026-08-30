FROM python:3.10-slim

# Install system dependencies required by OpenCV and MediaPipe
RUN apt-get update && apt-get install -y \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements from the vision folder
COPY vision/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the services folder
COPY services/ ./services/

ENV VISION_MODE=cloud
ENV PORT=5003
EXPOSE 5003

# Run the vision server from within the services folder
WORKDIR /app/services
CMD uvicorn vision_server:app --host 0.0.0.0 --port ${PORT:-5003}
