# Holoform Studio — self-hosted 3D reconstruction worker
#
# Builds COLMAP (from the official image) + OpenMVS + obj2gltf, then runs the
# Python worker loop. Requires an NVIDIA GPU at runtime:
#   docker build -t holoform-worker ./worker
#   docker run --gpus all --rm \
#     -e APP_URL=https://your-app.vercel.app \
#     -e WORKER_TOKEN=your-shared-secret \
#     holoform-worker
#
# The build is heavy (OpenMVS pulls CGAL/Ceres/VCG). Expect 20-40 min the
# first time. If you already run a COLMAP+OpenMVS box, skip this image and
# just run run.py with COLMAP_BIN / OPENMVS_BIN_DIR pointing at your binaries.

FROM colmap/colmap:latest

ENV DEBIAN_FRONTEND=noninteractive

# --- OpenMVS build deps + Node (for obj2gltf) + Python ------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
      git cmake build-essential \
      libboost-all-dev libeigen3-dev libopencv-dev \
      libcgal-dev libcgal-qt5-dev \
      libceres-dev \
      python3 python3-pip \
      curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g obj2gltf

# --- VCGLib (OpenMVS header-only dependency) ---------------------------------
RUN git clone --depth 1 https://github.com/cdcseacave/VCG.git /opt/vcglib

# --- OpenMVS -----------------------------------------------------------------
RUN git clone --depth 1 https://github.com/cdcseacave/openMVS.git /opt/openMVS \
    && mkdir /opt/openMVS/build && cd /opt/openMVS/build \
    && cmake .. -DCMAKE_BUILD_TYPE=Release -DVCG_ROOT=/opt/vcglib \
    && make -j"$(nproc)" \
    && make install \
    && rm -rf /opt/openMVS/build

ENV OPENMVS_BIN_DIR=/usr/local/bin/OpenMVS
ENV OBJ2GLTF_BIN=obj2gltf
ENV WORK_DIR=/work

WORKDIR /app
COPY run.py /app/run.py

ENTRYPOINT ["python3", "/app/run.py"]
