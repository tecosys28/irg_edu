"""python manage.py create_admin  — creates/resets the superuser for the admin panel."""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

# ── Hardcoded super-admin credentials (insider access only) ──────────────────
ADMIN_USERNAME = 'tidkejp@gmail.com'
ADMIN_EMAIL    = 'tidkejp@gmail.com'
ADMIN_PASSWORD = 'admin@123'

class Command(BaseCommand):
    help = 'Create or reset the insider admin superuser'

    def handle(self, *args, **options):
        User = get_user_model()

        if User.objects.filter(username=ADMIN_USERNAME).exists():
            user = User.objects.get(username=ADMIN_USERNAME)
            user.set_password(ADMIN_PASSWORD)
            user.email = ADMIN_EMAIL
            user.is_staff = True
            user.is_superuser = True
            user.save()
            self.stdout.write(self.style.SUCCESS(f'Admin "{ADMIN_USERNAME}" password reset.'))
        else:
            User.objects.create_superuser(
                username=ADMIN_USERNAME,
                email=ADMIN_EMAIL,
                password=ADMIN_PASSWORD
            )
            self.stdout.write(self.style.SUCCESS(f'Admin "{ADMIN_USERNAME}" created.'))
