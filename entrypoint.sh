#!/bin/sh
# Limpiamos el URL de caracteres invisibles (\r) que suelen venir de Windows
CLEAN_URL=$(echo $POCKETBASE_URL | tr -d '\r')

echo "Injecting POCKETBASE_URL: $CLEAN_URL"

# Creamos el archivo de configuración para el frontend
echo "window.APP_CONFIG = { POCKETBASE_URL: '$CLEAN_URL' };" > /usr/share/nginx/html/config.js

# Iniciamos Nginx (esta es la forma oficial de los scripts en /docker-entrypoint.d/)
# El entrypoint de la imagen base de nginx se encarga de llamar a este script.
