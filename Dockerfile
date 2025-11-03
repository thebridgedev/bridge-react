# syntax=docker/dockerfile:1

# Supports ARM + x86-64
FROM node:22 AS base

# -------------------------
# Global setup
# -------------------------
ARG APP_USER=appuser
ENV APP_USER=$APP_USER

# Install system dependencies
RUN apt-get update && apt-get install -y \
    zsh \
    unzip \
    curl \
    iproute2 \
    lsof \
    vim \
    less \
    jq \
    dumb-init \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set zsh as the default shell for subsequent RUN/CMD instructions
SHELL ["/bin/zsh", "-c"]

# Install Bun dynamically depending on architecture
RUN ARCH=$(uname -m | sed 's/x86_64/x64/; s/aarch64/aarch64/') \
    && curl -fsSL https://github.com/oven-sh/bun/releases/latest/download/bun-linux-$ARCH.zip -o bun.zip \
    && unzip bun.zip \
    && mv bun-linux-$ARCH/bun /usr/local/bin/bun \
    && rm -rf bun-linux-$ARCH bun.zip

# Create the non-root user and set up home directory
RUN groupadd -r $APP_USER && \
    useradd -r -s /bin/zsh -g $APP_USER $APP_USER && \
    mkdir -p /home/$APP_USER && \
    chown -R $APP_USER:$APP_USER /home/$APP_USER

WORKDIR /home/$APP_USER

# -------------------------
# Dev stage
# -------------------------
FROM base AS dev

# Copy code
COPY . .

# Fix permissions for the non-root user
RUN chown -R $APP_USER:$APP_USER /home/$APP_USER

USER $APP_USER

RUN bun install

CMD ["zsh"]
