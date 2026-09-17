from datetime import datetime, timedelta, timezone
from sqlmodel import SQLModel, Session, select
from src.database import engine, init_db
from src.models.branch import Branch
from src.models.user import User, UserRole
from src.models.queue import QueueEntry, QueueStatus, QueueStatusHistory
from src.security import hash_password


def seed():
    import src.models  # noqa: F401
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        
        # 1. Create Branches if not present
        branches_data = [
            {
                "name": "La Terraza Azul",
                "street": "Av. Larco",
                "exterior_number": "742",
                "interior_number": None,
                "neighborhood": "Miraflores",
                "city": "Lima",
                "state": "Lima",
                "country": "Perú",
                "postal_code": "15074",
            },
            {
                "name": "Cuatro Vientos",
                "street": "Av. Conquistadores",
                "exterior_number": "380",
                "interior_number": None,
                "neighborhood": "San Isidro",
                "city": "Lima",
                "state": "Lima",
                "country": "Perú",
                "postal_code": "15073",
            },
            {
                "name": "Casa Mediterránea",
                "street": "Av. Andrés Bello",
                "exterior_number": "1250",
                "interior_number": "Local 4",
                "neighborhood": "Providencia",
                "city": "Santiago",
                "state": "Región Metropolitana",
                "country": "Chile",
                "postal_code": "7500000",
            },
        ]

        branch_map = {}
        for b_data in branches_data:
            stmt = select(Branch).where(Branch.name == b_data["name"])
            existing = session.exec(stmt).first()
            if not existing:
                b = Branch(**b_data)
                session.add(b)
                session.flush()
                branch_map[b.name] = b
                print(f"Created branch: {b.name} (ID: {b.id})")
            else:
                branch_map[existing.name] = existing

        session.commit()

        # 2. Create Staff Users
        terraza = branch_map["La Terraza Azul"]
        cuatro = branch_map["Cuatro Vientos"]
        santiago = branch_map["Casa Mediterránea"]

        users_data = [
            {
                "name": "Admin Mesa247",
                "email": "admin@mesa247.pe",
                "password": "admin123",
                "role": UserRole.ADMIN,
                "branch_id": terraza.id,
            },
            {
                "name": "Camila Host (Terraza Azul)",
                "email": "host@mesa247.pe",
                "password": "host123",
                "role": UserRole.HOST,
                "branch_id": terraza.id,
            },
            {
                "name": "Rodrigo Manager (Terraza Azul)",
                "email": "manager@mesa247.pe",
                "password": "manager123",
                "role": UserRole.MANAGER,
                "branch_id": terraza.id,
            },
            {
                "name": "Diego Host (Cuatro Vientos)",
                "email": "host_cuatrovientos@mesa247.pe",
                "password": "host123",
                "role": UserRole.HOST,
                "branch_id": cuatro.id,
            },
            {
                "name": "Valentina Host (Santiago)",
                "email": "host_santiago@mesa247.pe",
                "password": "host123",
                "role": UserRole.HOST,
                "branch_id": santiago.id,
            },
        ]

        for u_data in users_data:
            stmt = select(User).where(User.email == u_data["email"])
            existing = session.exec(stmt).first()
            if not existing:
                u = User(
                    name=u_data["name"],
                    email=u_data["email"],
                    password_hash=hash_password(u_data["password"]),
                    role=u_data["role"],
                    branch_id=u_data["branch_id"],
                    is_active=True,
                )
                session.add(u)
                print(f"Created user: {u.email} ({u.role.value})")

        session.commit()

        # 3. Create Queue History (Past days and Current day)
        now = datetime.now(timezone.utc)
        today_midnight = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=timezone.utc)

        # Clear existing queue entries to have clean, predictable seed data
        # Check if queue has entries
        existing_queues = session.exec(select(QueueEntry)).first()
        if not existing_queues:
            # Seed past days for La Terraza Azul (e.g. day -3, day -2, day -1)
            past_samples = [
                # Day -3
                {"days_ago": 3, "name": "Alvaro Soler", "phone": "+51981111222", "party": 2, "status": QueueStatus.SEATED, "wait_min": 18},
                {"days_ago": 3, "name": "Patricia Vega", "phone": "+51982222333", "party": 4, "status": QueueStatus.SEATED, "wait_min": 25},
                {"days_ago": 3, "name": "Esteban Morales", "phone": "+51983333444", "party": 3, "status": QueueStatus.CANCELLED, "wait_min": 12},
                # Day -2
                {"days_ago": 2, "name": "Gabriel Salas", "phone": "+51984444555", "party": 5, "status": QueueStatus.SEATED, "wait_min": 22},
                {"days_ago": 2, "name": "Luciana Ramos", "phone": "+51985555666", "party": 2, "status": QueueStatus.NO_SHOW, "wait_min": 20, "was_called": True},
                {"days_ago": 2, "name": "Fernando Paz", "phone": "+51986666777", "party": 4, "status": QueueStatus.SEATED, "wait_min": 16},
                # Day -1 (Yesterday)
                {"days_ago": 1, "name": "Valeria Rojas", "phone": "+51987777888", "party": 3, "status": QueueStatus.SEATED, "wait_min": 19},
                {"days_ago": 1, "name": "Martin Gomez", "phone": "+51988888999", "party": 6, "status": QueueStatus.SEATED, "wait_min": 30},
                {"days_ago": 1, "name": "Lorena Ruiz", "phone": "+51989999000", "party": 2, "status": QueueStatus.CANCELLED, "wait_min": 9},
                {"days_ago": 1, "name": "Javier Fernandez", "phone": "+51980000111", "party": 4, "status": QueueStatus.NO_SHOW, "wait_min": 25, "was_called": True},
            ]

            for s in past_samples:
                check_in = today_midnight - timedelta(days=s["days_ago"], hours=-14, minutes=-(s["wait_min"] * 2))
                entry = QueueEntry(
                    branch_id=terraza.id,
                    customer_name=s["name"],
                    phone_number=s["phone"],
                    party_size=s["party"],
                    check_in_time=check_in,
                    status=s["status"],
                    wait_time_seconds=s["wait_min"] * 60,
                    was_called=s.get("was_called", s["status"] in (QueueStatus.SEATED, QueueStatus.NO_SHOW)),
                    called_at=check_in + timedelta(minutes=s["wait_min"] - 5) if s.get("was_called", False) or s["status"] == QueueStatus.SEATED else None,
                    seated_at=check_in + timedelta(minutes=s["wait_min"]) if s["status"] == QueueStatus.SEATED else None,
                    cancelled_at=check_in + timedelta(minutes=s["wait_min"]) if s["status"] == QueueStatus.CANCELLED else None,
                    no_show_at=check_in + timedelta(minutes=s["wait_min"]) if s["status"] == QueueStatus.NO_SHOW else None,
                    created_at=check_in,
                    updated_at=check_in + timedelta(minutes=s["wait_min"]),
                )
                session.add(entry)
                session.flush()

                # History
                h1 = QueueStatusHistory(
                    queue_entry_id=entry.id,
                    from_status=None,
                    to_status=QueueStatus.RESERVED.value,
                    changed_at=check_in,
                    duration_seconds=0,
                )
                session.add(h1)
                if s["status"] != QueueStatus.RESERVED:
                    h2 = QueueStatusHistory(
                        queue_entry_id=entry.id,
                        from_status=QueueStatus.RESERVED.value,
                        to_status=s["status"].value,
                        changed_at=check_in + timedelta(minutes=s["wait_min"]),
                        duration_seconds=s["wait_min"] * 60,
                    )
                    session.add(h2)

            # Seed CURRENT DAY for La Terraza Azul
            # Some completed today earlier:
            today_completed = [
                {"hours_ago": 4, "name": "Renzo Dávila", "phone": "+51971112233", "party": 2, "status": QueueStatus.SEATED, "wait_min": 14},
                {"hours_ago": 3, "name": "Milagros Cruz", "phone": "+51972223344", "party": 4, "status": QueueStatus.SEATED, "wait_min": 21},
                {"hours_ago": 2, "name": "Joaquín Flores", "phone": "+51973334455", "party": 3, "status": QueueStatus.CANCELLED, "wait_min": 8},
                {"hours_ago": 1, "name": "Daniela Castro", "phone": "+51974445566", "party": 2, "status": QueueStatus.NO_SHOW, "wait_min": 15, "was_called": True},
            ]
            for s in today_completed:
                check_in = now - timedelta(hours=s["hours_ago"])
                entry = QueueEntry(
                    branch_id=terraza.id,
                    customer_name=s["name"],
                    phone_number=s["phone"],
                    party_size=s["party"],
                    check_in_time=check_in,
                    status=s["status"],
                    wait_time_seconds=s["wait_min"] * 60,
                    was_called=s.get("was_called", s["status"] == QueueStatus.SEATED),
                    called_at=check_in + timedelta(minutes=s["wait_min"] - 5) if s.get("was_called", False) or s["status"] == QueueStatus.SEATED else None,
                    seated_at=check_in + timedelta(minutes=s["wait_min"]) if s["status"] == QueueStatus.SEATED else None,
                    cancelled_at=check_in + timedelta(minutes=s["wait_min"]) if s["status"] == QueueStatus.CANCELLED else None,
                    no_show_at=check_in + timedelta(minutes=s["wait_min"]) if s["status"] == QueueStatus.NO_SHOW else None,
                    created_at=check_in,
                    updated_at=check_in + timedelta(minutes=s["wait_min"]),
                )
                session.add(entry)
                session.flush()

                h1 = QueueStatusHistory(
                    queue_entry_id=entry.id,
                    from_status=None,
                    to_status=QueueStatus.RESERVED.value,
                    changed_at=check_in,
                    duration_seconds=0,
                )
                session.add(h1)
                h2 = QueueStatusHistory(
                    queue_entry_id=entry.id,
                    from_status=QueueStatus.RESERVED.value,
                    to_status=s["status"].value,
                    changed_at=check_in + timedelta(minutes=s["wait_min"]),
                    duration_seconds=s["wait_min"] * 60,
                )
                session.add(h2)

            # Currently ACTIVE in Queue for La Terraza Azul (1 called, 4 reserved)
            active_samples = [
                {"mins_ago": 28, "name": "Carlos Mendoza", "phone": "+51999888777", "party": 5, "status": QueueStatus.CALLED, "called_mins_ago": 3},
                {"mins_ago": 22, "name": "María José Gutierrez", "phone": "+51988777666", "party": 2, "status": QueueStatus.RESERVED},
                {"mins_ago": 16, "name": "Andrés Quispe", "phone": "+51977666555", "party": 4, "status": QueueStatus.RESERVED},
                {"mins_ago": 9, "name": "Fiorella Wong", "phone": "+51966555444", "party": 3, "status": QueueStatus.RESERVED},
                {"mins_ago": 3, "name": "Gonzalo Barrientos", "phone": "+51955444333", "party": 2, "status": QueueStatus.RESERVED},
            ]

            for a in active_samples:
                check_in = now - timedelta(minutes=a["mins_ago"])
                called_at = now - timedelta(minutes=a["called_mins_ago"]) if a.get("called_mins_ago") else None
                entry = QueueEntry(
                    branch_id=terraza.id,
                    customer_name=a["name"],
                    phone_number=a["phone"],
                    party_size=a["party"],
                    check_in_time=check_in,
                    status=a["status"],
                    was_called=(a["status"] == QueueStatus.CALLED),
                    called_at=called_at,
                    created_at=check_in,
                    updated_at=called_at if called_at else check_in,
                )
                session.add(entry)
                session.flush()

                h1 = QueueStatusHistory(
                    queue_entry_id=entry.id,
                    from_status=None,
                    to_status=QueueStatus.RESERVED.value,
                    changed_at=check_in,
                    duration_seconds=0,
                )
                session.add(h1)
                if a["status"] == QueueStatus.CALLED and called_at:
                    h2 = QueueStatusHistory(
                        queue_entry_id=entry.id,
                        from_status=QueueStatus.RESERVED.value,
                        to_status=QueueStatus.CALLED.value,
                        changed_at=called_at,
                        duration_seconds=int((called_at - check_in).total_seconds()),
                    )
                    session.add(h2)

            session.commit()
            print("Successfully seeded queue entries (past days and today)!")


if __name__ == "__main__":
    seed()
