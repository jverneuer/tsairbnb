# tsairbnb Lambda container image.
# Bundles the Node 24 runtime + the curl-impersonate TLS-impersonation binary.
#
# curl-impersonate is what pyairbnb's `curl_cffi(impersonate="chrome124")` wraps under
# the hood. Node's built-in fetch/undici emit a non-browser JA3/H2 fingerprint and get
# 403'd by Airbnb's Cloudflare edge. We shell out to this binary per request.
#
# We install the prebuilt chrome124 profile binary. The binary must match the Lambda
# platform (linux/amd64 or linux/arm64) — set TARGETPLATFORM via docker build --platform.
# See ATTRIBUTION.md for the curl-impersonate source.

FROM --platform=${TARGETPLATFORM} public.ecr.aws/lambda/nodejs:24 AS base

# --- install curl-impersonate (chrome124 profile) ---
ARG CURL_IMPERSONATE_VERSION=0.6.1
ARG ARCH
RUN dnf install -y tar gzip && \
    if [ -z "$ARCH" ]; then case "${TARGETPLATFORM}" in \
      linux/amd64) ARCH=x86_64 ;; linux/arm64) ARCH=aarch64 ;; \
      *) echo "unsupported platform ${TARGETPLATFORM}" && exit 1 ;; esac; fi && \
    curl -fsSL "https://github.com/lwthiker/curl-impersonate/releases/download/v${CURL_IMPERSONATE_VERSION}/curl-impersonate-v${CURL_IMPERSONATE_VERSION}.${ARCH}-linux-gnu.tar.gz" \
      -o /tmp/ci.tgz && \
    tar -xzf /tmp/ci.tgz -C /usr/local/bin && \
    rm /tmp/ci.tgz && \
    curl-impersonate-chrome --version && \
    dnf clean all

# --- copy compiled Lambda handler ---
WORKDIR ${LAMBDA_TASK_ROOT}
COPY dist/lambda.js .
CMD ["lambda.handler"]
