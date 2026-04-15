#!/bin/bash
# First-time setup for TROT Edu Admin (Django)
set -e

echo "==> Installing Python dependencies"
pip install -r requirements.txt

echo "==> Copying .env template (edit it before continuing)"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    Created .env — fill in DJANGO_SECRET_KEY and GOOGLE_APPLICATION_CREDENTIALS"
fi

echo "==> Running Django migrations (for session/auth tables)"
python manage.py migrate

echo "==> Creating admin user"
python manage.py create_admin

echo ""
echo "Done! Start the server with:"
echo "  python manage.py runserver 8080"
echo ""
echo "Then open: http://localhost:8080/login/"
echo ""
echo "IMPORTANT: Place your Firebase service account key at:"
echo "  $(pwd)/serviceAccountKey.json"
echo "  (Download from Firebase Console > Project Settings > Service Accounts)"
