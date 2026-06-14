FROM python:3.11-slim
# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    libboost-all-dev \
    pkg-config \
    gfortran \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Actualizar pip
RUN pip install --upgrade pip

# Instalar dlib primero
RUN pip install dlib-bin==19.24.2.post1

# Instalar el resto
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY . .

EXPOSE 5001

# Cambia "app.py" por el nombre de tu archivo principal
CMD ["python", "app.py"]