# Start with our reliable Python runtime
FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y curl git wget nano

# Download and install Code-Server (VS Code in the browser)
RUN curl -fsSL https://code-server.dev/install.sh | sh

# Set the working directory
WORKDIR /workspace

# Expose the port Code-Server runs on
EXPOSE 8080

# SECURITY WARNING: --auth none is used for local demo purposes only.
# Launch Code-Server in the background, then tail /dev/null to keep container alive
CMD ["/bin/sh", "-c", "code-server --auth none --bind-addr 0.0.0.0:8080 /workspace & tail -f /dev/null"]