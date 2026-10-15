#!/bin/sh
set -eu
umask 077
if [ ! -s /certs/localhost.key ] || [ ! -s /certs/localhost.crt ] || ! openssl x509 -checkend 86400 -noout -in /certs/localhost.crt; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 30 \
    -keyout /certs/localhost.key -out /certs/localhost.crt \
    -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
fi
