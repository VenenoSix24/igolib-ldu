# Dockerfile Example
FROM python:3.11-slim

WORKDIR /app

# Install poetry or pipenv if you use them, or just use requirements.txt
# Using requirements.txt example:
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy your application code
COPY . .

# Make sure your data_process files are included if needed, or adjust paths
# COPY ./data_process ./data_process
# COPY ./templates ./templates

# Expose the port Uvicorn will run on
EXPOSE 8000

# Command to run the application using Uvicorn
# Use 0.0.0.0 to bind to all interfaces inside the container
CMD ["uvicorn", "beta:app", "--host", "0.0.0.0", "--port", "8000"]