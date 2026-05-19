#!/bin/bash

# Set up the directory to store the PEM file

# Retrieve the secret from AWS Secrets Manager and store it in a PEM file
SECRET=$(aws secretsmanager get-secret-value --secret-id ATLAS_CERT --query SecretString --output text)

# Save the secret to a PEM file
echo "$SECRET" > ./certs/client.pem

HOSTNAME="0.0.0.0" node server.js