from django.core.management.base import BaseCommand
from django.utils import timezone
from workspace.models import Workspace

class Command(BaseCommand):
    help = 'Permanently purges archived workspaces that have passed the 30-day recovery deadline.'

    def handle(self, *args, **options):
        now = timezone.now()
        # Find archived workspaces past deadline
        to_purge = Workspace.objects.filter(
            is_archived=True,
            scheduled_deletion_at__lte=now
        )
        count = to_purge.count()
        if count > 0:
            to_purge.delete()
            self.stdout.write(self.style.SUCCESS(f"Successfully purged {count} archived workspaces."))
        else:
            self.stdout.write(self.style.SUCCESS("No workspaces met the purge criteria. 0 purged."))
