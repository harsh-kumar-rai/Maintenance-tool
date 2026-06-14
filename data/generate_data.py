import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta

# -------------------------------
# LOAD ASSET MASTER
# -------------------------------

assets = pd.read_csv("assets.csv")

START_DATE = datetime(2025, 1, 1)
DAYS = 365

sensor_records = []
maintenance_records = []

record_id = 1

# -------------------------------
# EQUIPMENT BASELINES
# -------------------------------

equipment_profiles = {
    "Blast Furnace": {
        "temp": (900, 1200),
        "vibration": (2, 4),
        "pressure": (95, 115),
        "current": (300, 500),
        "flow": (500, 800),
    },
    "BOF Converter": {
        "temp": (1500, 1700),
        "vibration": (2, 4),
        "pressure": (90, 110),
        "current": (250, 400),
        "flow": (300, 500),
    },
    "Continuous Caster": {
        "temp": (700, 1000),
        "vibration": (2, 5),
        "pressure": (85, 110),
        "current": (120, 250),
        "flow": (250, 450),
    },
    "Rolling Mill": {
        "temp": (60, 100),
        "vibration": (3, 6),
        "pressure": (90, 110),
        "current": (100, 250),
        "flow": (150, 300),
    },
    "Ladle Furnace": {
        "temp": (1400, 1650),
        "vibration": (2, 4),
        "pressure": (90, 110),
        "current": (200, 400),
        "flow": (100, 250),
    },
    "Cooling Pump": {
        "temp": (40, 80),
        "vibration": (2, 5),
        "pressure": (90, 130),
        "current": (40, 90),
        "flow": (180, 300),
    },
    "Exhaust Fan": {
        "temp": (40, 70),
        "vibration": (2, 5),
        "pressure": (85, 110),
        "current": (40, 90),
        "flow": (100, 250),
    },
    "Compressor": {
        "temp": (60, 90),
        "vibration": (2, 4),
        "pressure": (100, 140),
        "current": (60, 120),
        "flow": (100, 250),
    },
    "Crane": {
        "temp": (30, 60),
        "vibration": (1, 3),
        "pressure": (0, 0),
        "current": (20, 80),
        "flow": (0, 0),
    }
}

failure_modes = [
    "Bearing Wear",
    "Lubrication Failure",
    "Misalignment",
    "Motor Overheating",
    "Cooling System Failure",
]

# -------------------------------
# GENERATE DATA
# -------------------------------

for _, asset in assets.iterrows():

    asset_id = asset["asset_id"]
    equipment_type = asset["equipment_type"]

    profile = equipment_profiles[equipment_type]

    temp_base = np.mean(profile["temp"])
    vib_base = np.mean(profile["vibration"])
    pressure_base = np.mean(profile["pressure"])
    current_base = np.mean(profile["current"])
    flow_base = np.mean(profile["flow"])

    degradation = 0
    active_failure = None

    for day in range(DAYS):

        timestamp = START_DATE + timedelta(days=day)

        # introduce failure occasionally
        if active_failure is None and random.random() < 0.02:
            active_failure = random.choice(failure_modes)

        if active_failure:

            degradation += random.uniform(0.5, 2.0)

            temp = temp_base + degradation
            vibration = vib_base + degradation / 4

            pressure = pressure_base - degradation / 5
            current = current_base + degradation / 3
            flow = max(0, flow_base - degradation)

        else:

            temp = np.random.normal(temp_base, temp_base * 0.03)
            vibration = np.random.normal(vib_base, 0.4)

            pressure = np.random.normal(pressure_base, 2)
            current = np.random.normal(current_base, 5)

            flow = np.random.normal(flow_base, 5)

        # health score
        health = max(
            0,
            min(
                100,
                100
                - (vibration * 4)
                - max(0, temp - temp_base) * 0.2,
            ),
        )

        # risk score
        risk = int(
            min(
                100,
                max(
                    0,
                    (100 - health)
                    + random.randint(-5, 5),
                ),
            )
        )

        sensor_records.append(
            [
                timestamp,
                asset_id,
                round(temp, 2),
                round(vibration, 2),
                round(pressure, 2),
                round(current, 2),
                round(flow, 2),
                round(health, 2),
                risk,
            ]
        )

        # maintenance trigger
        if health < 55:

            maintenance_records.append(
                [
                    f"REC-{record_id:05d}",
                    asset_id,
                    timestamp.date(),
                    "Condition-based maintenance",
                    active_failure
                    if active_failure
                    else "General degradation",
                    "Inspection and repair completed",
                    round(random.uniform(2, 12), 1),
                ]
            )

            record_id += 1

            degradation = 0
            active_failure = None

# -------------------------------
# SAVE FILES
# -------------------------------

sensor_df = pd.DataFrame(
    sensor_records,
    columns=[
        "timestamp",
        "asset_id",
        "temperature",
        "vibration",
        "pressure",
        "current",
        "flow_rate",
        "health_score",
        "risk_score",
    ],
)

maintenance_df = pd.DataFrame(
    maintenance_records,
    columns=[
        "record_id",
        "asset_id",
        "date",
        "issue",
        "root_cause",
        "action_taken",
        "downtime_hours",
    ],
)

sensor_df.to_csv("sensor_data.csv", index=False)
maintenance_df.to_csv("maintenance_history.csv", index=False)

print("Generated:")
print(sensor_df.shape)
print(maintenance_df.shape)