#!/bin/sh
set -eu

BOOTSTRAP_DIR="/opt/bootstrap"
RUNTIME_DIR="/opt/cutout-runtime"
VENV_DIR="${RUNTIME_DIR}/venv"
MODEL_DIR="${RUNTIME_DIR}/models"
READY_MARKER="${RUNTIME_DIR}/.ready"
MODEL_NAME="${AI_CUTOUT_REMBG_MODEL:-u2net}"
MODEL_FILE="${MODEL_DIR}/${MODEL_NAME}.onnx"
MODEL_MIRROR="${REMBG_MODEL_MIRROR:-https://ghproxy.net/}"
MODEL_URL="${MODEL_MIRROR%/}/https://github.com/danielgatis/rembg/releases/download/v0.0.0/${MODEL_NAME}.onnx"
APT_MIRROR_ROOT="${APT_MIRROR_ROOT:-http://mirrors.cloud.tencent.com/debian}"
APT_SECURITY_MIRROR_ROOT="${APT_SECURITY_MIRROR_ROOT:-http://mirrors.cloud.tencent.com/debian-security}"
PIP_INDEX_URL="${PIP_INDEX_URL:-https://mirrors.cloud.tencent.com/pypi/simple}"
PIP_TRUSTED_HOST="${PIP_TRUSTED_HOST:-mirrors.cloud.tencent.com}"
PIP_EXTRA_INDEX_URL="${PIP_EXTRA_INDEX_URL:-}"

rewrite_apt_sources() {
  for f in /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list; do
    [ -f "${f}" ] || continue
    sed -i "s|http://deb.debian.org/debian|${APT_MIRROR_ROOT}|g" "${f}"
    sed -i "s|https://deb.debian.org/debian|${APT_MIRROR_ROOT}|g" "${f}"
    sed -i "s|http://security.debian.org/debian-security|${APT_SECURITY_MIRROR_ROOT}|g" "${f}"
    sed -i "s|https://security.debian.org/debian-security|${APT_SECURITY_MIRROR_ROOT}|g" "${f}"
    sed -i "s|http://deb.debian.org|${APT_MIRROR_ROOT}|g" "${f}"
    sed -i "s|https://deb.debian.org|${APT_MIRROR_ROOT}|g" "${f}"
    sed -i "s|http://security.debian.org|${APT_SECURITY_MIRROR_ROOT}|g" "${f}"
    sed -i "s|https://security.debian.org|${APT_SECURITY_MIRROR_ROOT}|g" "${f}"
  done
}

pip_install() {
  if [ -n "${PIP_EXTRA_INDEX_URL}" ]; then
    "${VENV_DIR}/bin/python" -m pip install \
      --no-cache-dir \
      --index-url "${PIP_INDEX_URL}" \
      --trusted-host "${PIP_TRUSTED_HOST}" \
      --extra-index-url "${PIP_EXTRA_INDEX_URL}" \
      "$@"
    return
  fi

  "${VENV_DIR}/bin/python" -m pip install \
    --no-cache-dir \
    --index-url "${PIP_INDEX_URL}" \
    --trusted-host "${PIP_TRUSTED_HOST}" \
    "$@"
}

mkdir -p "${RUNTIME_DIR}" "${MODEL_DIR}" /app/scripts
cp "${BOOTSTRAP_DIR}/cutout_worker.py" /app/scripts/cutout_worker.py
chmod 755 /app/scripts/cutout_worker.py

if [ ! -f "${READY_MARKER}" ]; then
  export DEBIAN_FRONTEND=noninteractive
  rewrite_apt_sources
  apt-get update
  apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libgomp1 \
    python3 \
    python3-pip \
    python3-venv
  rm -rf /var/lib/apt/lists/*

  python3 -m venv "${VENV_DIR}"
  pip_install --upgrade pip setuptools wheel
  pip_install pillow==10.4.0 rembg==2.0.59 onnxruntime==1.22.0

  if [ ! -s "${MODEL_FILE}" ]; then
    curl --fail --location --retry 5 --retry-delay 5 --output "${MODEL_FILE}" "${MODEL_URL}"
  fi

  touch "${READY_MARKER}"
fi

export PATH="${VENV_DIR}/bin:${PATH}"
export U2NET_HOME="${MODEL_DIR}"
export XDG_DATA_HOME="${MODEL_DIR}"
export AI_CUTOUT_PYTHON="${AI_CUTOUT_PYTHON:-python3}"

exec /usr/local/bin/docker-entrypoint.sh node dist/server.js
