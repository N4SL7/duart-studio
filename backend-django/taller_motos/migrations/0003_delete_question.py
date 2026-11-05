from django.db import migrations


class Migration(migrations.Migration):
    """Elimina el modelo Question que quedó de una práctica anterior."""

    dependencies = [
        ('taller_motos', '0002_question'),
    ]

    operations = [
        migrations.DeleteModel(name='Question'),
    ]
